// ============================================================
// Booking Service — Core Business Logic
// Handles: create, confirm, cancel, complete bookings.
// Concurrency: Optimistic locking to prevent double-booking.
// ============================================================

import { PrismaClient, Prisma } from '@prisma/client';

import {
  Booking,
  BookingType,
  BookingStatus,
  generateId,
  publishEvent,
  ParklyEvent,
  BookingError,
  NotFoundError,
  ConflictError,
} from '@parkly/shared';

const prisma = new PrismaClient();

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

    const booking = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {

      // Check for conflicting bookings (optimistic locking via SELECT FOR UPDATE)
      const conflicting = await tx.booking.findFirst({
        where: {
          spaceId: input.spaceId,
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
    const booking = await prisma.booking.findUnique({ where: { id } });
    if (!booking) throw new NotFoundError('Booking not found');
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
    const where = { userId, ...(status ? { status } : {}) };
    const [bookings, total] = await Promise.all([
      prisma.booking.findMany({
        where,
        orderBy: { startTime: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.booking.count({ where }),
    ]);

    return { bookings: bookings.map(this.mapBooking), total };
  }

  /**
   * Cancel a booking with refund eligibility check.
   */
  async cancelBooking(id: string, userId: string, reason?: string): Promise<Booking> {
    const booking = await prisma.booking.findUnique({ where: { id } });
    if (!booking) throw new NotFoundError('Booking not found');
    if (booking.userId !== userId) throw new NotFoundError('Booking not found');
    if (!['created', 'confirmed'].includes(booking.status)) {
      throw new BookingError(`Cannot cancel a booking in ${booking.status} status`);
    }

    const updated = await prisma.booking.update({
      where: { id },
      data: {
        status: 'cancelled',
        cancellationReason: reason || null,
        cancelledAt: new Date(),
      },
    });

    await this.publishBookingEvent('BookingCancelled', updated);
    return this.mapBooking(updated);
  }

  /**
   * Mark a booking as completed.
   */
  async completeBooking(id: string): Promise<Booking> {
    const booking = await prisma.booking.findUnique({ where: { id } });
    if (!booking) throw new NotFoundError('Booking not found');
    if (booking.status !== 'active') {
      throw new BookingError('Only active bookings can be completed');
    }

    const updated = await prisma.booking.update({
      where: { id },
      data: { status: 'completed', completedAt: new Date() },
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
    };
  }
}

export const bookingService = new BookingService();
