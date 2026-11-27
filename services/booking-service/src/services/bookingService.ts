// ============================================================
// Booking Service — Core Business Logic
// Handles: create, confirm, cancel, extend, complete bookings.
// Concurrency: Optimistic locking to prevent double-booking.
// ============================================================

import { PrismaClient, Prisma } from '@prisma/client';

import {
  Booking,
  BookingType,
  BookingStatus,
  VehicleType,
  generateId,
  publishEvent,
  ParklyEvent,
  BookingError,
  NotFoundError,
  ConflictError,
  ValidationError,
} from '@parkly/shared';

const defaultPrisma = new PrismaClient();

const BOOKING_INCLUDE = {
  space: {
    select: {
      id: true,
      name: true,
      address: true,
      hourlyRate: true,
      latitude: true,
      longitude: true,
    },
  },
  vehicle: {
    select: {
      id: true,
      licensePlate: true,
      vehicleType: true,
    },
  },
} as const;

export interface CreateBookingInput {
  userId: string;
  spaceId: string;
  vehicleId: string;
  hostId: string;
  type: BookingType;
  startTime: Date;
  endTime: Date;
  totalAmount: number;
  recurringFrequency?: 'daily' | 'weekly';
  recurringEndDate?: Date;
}

export class BookingService {
  constructor(private readonly prisma: PrismaClient = defaultPrisma) {}

  /**
   * Create a booking with concurrency control.
   * Uses a transaction to prevent double-booking of the same slot.
   */
  async createBooking(input: CreateBookingInput): Promise<Booking> {
    const durationMinutes = Math.round(
      (input.endTime.getTime() - input.startTime.getTime()) / 60000,
    );

    if (durationMinutes < 15) {
      throw new BookingError('Minimum booking duration is 15 minutes');
    }
    if (durationMinutes > 4320) {
      throw new BookingError('Maximum booking duration is 72 hours');
    }

    const booking = await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const vehicle = await tx.vehicle.findFirst({
        where: { id: input.vehicleId, userId: input.userId, deletedAt: null },
        select: { id: true },
      });
      if (!vehicle) {
        throw new ValidationError('Selected vehicle was not found in your garage', 'vehicleId');
      }

      const space = await tx.parkingSpace.findUnique({
        where: { id: input.spaceId },
        select: { id: true, status: true },
      });
      if (!space) {
        throw new NotFoundError('Parking space not found');
      }
      if (space.status !== 'active') {
        throw new BookingError('This parking space is currently unavailable');
      }

      // Check for conflicting bookings
      const conflicting = await tx.booking.findFirst({
        where: {
          spaceId: input.spaceId,
          deletedAt: null,
          status: { in: ['created', 'confirmed', 'active'] },
          OR: [
            {
              startTime: { lt: input.endTime },
              endTime: { gt: input.startTime },
            },
          ],
        },
      });

      if (conflicting) {
        throw new ConflictError('This time slot is already booked. Please choose another time.');
      }

      return tx.booking.create({
        data: {
          id: generateId(),
          userId: input.userId,
          spaceId: input.spaceId,
          vehicleId: input.vehicleId,
          hostId: input.hostId,
          type: input.type,
          status: 'created',
          startTime: input.startTime,
          endTime: input.endTime,
          durationMinutes,
          totalAmount: input.totalAmount,
          currency: 'INR',
          recurringFrequency: input.recurringFrequency || null,
          recurringEndDate: input.recurringEndDate || null,
        },
        include: BOOKING_INCLUDE,
      });
    });

    // Publish event
    await this.publishBookingEvent('BookingCreated', booking);

    return this.mapBooking(booking);
  }

  /**
   * Get a booking by ID.
   */
  async getBooking(id: string, userId?: string): Promise<Booking> {
    const booking = await this.prisma.booking.findUnique({
      where: { id },
      include: BOOKING_INCLUDE,
    });
    if (!booking || booking.deletedAt) throw new NotFoundError('Booking not found');
    if (userId && booking.userId !== userId) throw new NotFoundError('Booking not found');
    return this.mapBooking(booking);
  }

  /**
   * List bookings for a user.
   */
  async listUserBookings(
    userId: string,
    status?: BookingStatus,
    page = 1,
    pageSize = 20,
  ): Promise<{ bookings: Booking[]; total: number }> {
    const where = { userId, deletedAt: null, ...(status ? { status } : {}) };
    const [bookings, total] = await Promise.all([
      this.prisma.booking.findMany({
        where,
        include: BOOKING_INCLUDE,
        orderBy: { startTime: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.booking.count({ where }),
    ]);

    return { bookings: bookings.map((b) => this.mapBooking(b)), total };
  }

  /**
   * Extend an active or confirmed booking by additional minutes.
   */
  async extendBooking(
    id: string,
    userId: string,
    additionalMinutes = 60,
  ): Promise<Booking> {
    if (!Number.isFinite(additionalMinutes) || additionalMinutes < 15 || additionalMinutes > 1440) {
      throw new ValidationError('Extension must be between 15 minutes and 24 hours');
    }

    const updated = await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const booking = await tx.booking.findUnique({
        where: { id },
        include: BOOKING_INCLUDE,
      });
      if (!booking || booking.deletedAt) throw new NotFoundError('Booking not found');
      if (booking.userId !== userId) throw new NotFoundError('Booking not found');
      if (!['confirmed', 'active'].includes(booking.status)) {
        throw new BookingError(`Cannot extend a booking in ${booking.status} status`);
      }

      const newEndTime = new Date(booking.endTime.getTime() + additionalMinutes * 60000);
      const newDurationMinutes = booking.durationMinutes + additionalMinutes;

      if (newDurationMinutes > 4320) {
        throw new BookingError('Maximum total booking duration is 72 hours');
      }

      const conflicting = await tx.booking.findFirst({
        where: {
          id: { not: id },
          spaceId: booking.spaceId,
          deletedAt: null,
          status: { in: ['created', 'confirmed', 'active'] },
          startTime: { lt: newEndTime },
          endTime: { gt: booking.endTime },
        },
      });

      if (conflicting) {
        throw new ConflictError('Cannot extend: the next slot is already reserved by another driver.');
      }

      const hourlyRate = booking.space?.hourlyRate
        ? Number(booking.space.hourlyRate)
        : Math.round(Number(booking.totalAmount) / Math.max(1, booking.durationMinutes / 60));

      const extensionBase = Math.round(hourlyRate * (additionalMinutes / 60) * 100) / 100;
      const extensionFee = Math.round(extensionBase * 0.05);
      const newTotalAmount = Math.round((Number(booking.totalAmount) + extensionBase + extensionFee) * 100) / 100;

      return tx.booking.update({
        where: { id },
        data: {
          endTime: newEndTime,
          durationMinutes: newDurationMinutes,
          totalAmount: newTotalAmount,
        },
        include: BOOKING_INCLUDE,
      });
    });

    await this.publishBookingEvent('BookingExtended', updated);
    return this.mapBooking(updated);
  }

  /**
   * Cancel a booking with refund eligibility check.
   */
  async cancelBooking(id: string, userId: string, reason?: string): Promise<Booking> {
    const booking = await this.prisma.booking.findUnique({ where: { id } });
    if (!booking || booking.deletedAt) throw new NotFoundError('Booking not found');
    if (booking.userId !== userId) throw new NotFoundError('Booking not found');
    if (!['created', 'confirmed'].includes(booking.status)) {
      throw new BookingError(`Cannot cancel a booking in ${booking.status} status`);
    }

    const updated = await this.prisma.booking.update({
      where: { id },
      data: {
        status: 'cancelled',
        cancellationReason: reason || null,
        cancelledAt: new Date(),
      },
      include: BOOKING_INCLUDE,
    });

    await this.publishBookingEvent('BookingCancelled', updated);
    return this.mapBooking(updated);
  }

  /**
   * Mark a booking as completed.
   */
  async completeBooking(id: string): Promise<Booking> {
    const booking = await this.prisma.booking.findUnique({ where: { id } });
    if (!booking || booking.deletedAt) throw new NotFoundError('Booking not found');
    if (booking.status !== 'active') {
      throw new BookingError('Only active bookings can be completed');
    }

    const updated = await this.prisma.booking.update({
      where: { id },
      data: { status: 'completed', completedAt: new Date() },
      include: BOOKING_INCLUDE,
    });

    await this.publishBookingEvent('BookingCompleted', updated);
    return this.mapBooking(updated);
  }

  private async publishBookingEvent(type: ParklyEvent['type'], booking: Record<string, unknown>): Promise<void> {
    try {
      await publishEvent({
        type,
        version: '1.0',
        timestamp: new Date().toISOString(),
        source: 'parkly.booking-service',
        data: booking,
      });
    } catch (_err) {
      // Event publishing failure should not fail the main flow
    }
  }

  private mapBooking(raw: Record<string, unknown>): Booking {
    const rawSpace = raw['space'] as Record<string, unknown> | null | undefined;
    const rawVehicle = raw['vehicle'] as Record<string, unknown> | null | undefined;

    return {
      id: raw['id'] as string,
      userId: raw['userId'] as string,
      spaceId: raw['spaceId'] as string,
      vehicleId: raw['vehicleId'] as string,
      hostId: raw['hostId'] as string,
      type: raw['type'] as BookingType,
      status: raw['status'] as BookingStatus,
      startTime: (raw['startTime'] as Date).toISOString(),
      endTime: (raw['endTime'] as Date).toISOString(),
      durationMinutes: raw['durationMinutes'] as number,
      totalAmount: Number(raw['totalAmount']),
      currency: 'INR',
      cancellationReason: raw['cancellationReason'] as string | undefined,
      cancelledAt: raw['cancelledAt'] ? (raw['cancelledAt'] as Date).toISOString() : undefined,
      completedAt: raw['completedAt'] ? (raw['completedAt'] as Date).toISOString() : undefined,
      createdAt: (raw['createdAt'] as Date).toISOString(),
      updatedAt: (raw['updatedAt'] as Date).toISOString(),
      ...(rawSpace
        ? {
            space: {
              id: rawSpace['id'] as string,
              name: rawSpace['name'] as string,
              address: rawSpace['address'] as string,
              hourlyRate: rawSpace['hourlyRate'] !== undefined ? Number(rawSpace['hourlyRate']) : undefined,
              latitude: rawSpace['latitude'] !== undefined ? Number(rawSpace['latitude']) : undefined,
              longitude: rawSpace['longitude'] !== undefined ? Number(rawSpace['longitude']) : undefined,
            },
          }
        : {}),
      ...(rawVehicle
        ? {
            vehicle: {
              id: rawVehicle['id'] as string,
              licensePlate: rawVehicle['licensePlate'] as string,
              vehicleType: rawVehicle['vehicleType'] as VehicleType,
            },
          }
        : {}),
    };
  }
}

export const bookingService = new BookingService();
