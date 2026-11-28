// ============================================================
// Booking Service — Core Business Logic
// Handles: create, confirm, cancel, extend, complete bookings.
// Concurrency: Row-level space locking + capacity enforcement.
// ============================================================

import crypto from 'crypto';
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
  AuthorizationError,
  getConfig,
  getServiceClient,
} from '@parkly/shared';

export const prisma = new PrismaClient();

const PLATFORM_FEE_RATE = 0.05;
const EARLY_CHECKIN_GRACE_MINUTES = 15;
const OVERSTAY_GRACE_MINUTES = 10;

const BOOKING_INCLUDE = {
  space: {
    select: {
      id: true,
      name: true,
      address: true,
      spaceType: true,
      entryInstructions: true,
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
  hostId?: string;
  type: BookingType;
  startTime: Date;
  endTime: Date;
  totalAmount?: number;
  recurringFrequency?: 'daily' | 'weekly';
  recurringEndDate?: Date;
}

interface LockedSpaceRow {
  id: string;
  host_id: string;
  total_capacity: number;
  hourly_rate: Prisma.Decimal | number | string;
  dynamic_pricing: boolean;
  min_booking_hours: number;
  max_booking_hours: number;
  status: string;
}

export function generateQrToken(bookingId: string, spaceId: string, vehicleId: string, endTimeIso: string): string {
  const secret = process.env['JWT_ACCESS_SECRET'] || getConfig().jwtAccessSecret;
  const payload = `${bookingId}:${spaceId}:${vehicleId}:${endTimeIso}`;
  const sig = crypto.createHmac('sha256', secret).update(payload).digest('hex').slice(0, 16);
  return `PARKLY.v1.${bookingId}.${sig}`;
}

export function generateGateCode(bookingId: string): string {
  const secret = process.env['JWT_ACCESS_SECRET'] || getConfig().jwtAccessSecret;
  const digest = crypto.createHmac('sha256', secret).update(`pin:${bookingId}`).digest();
  const num = 1000 + (digest.readUInt16BE(0) % 9000);
  return String(num);
}

export function verifyQrSignature(qrToken: string, bookingId: string, spaceId: string, vehicleId: string, endTimeIso: string): boolean {
  const expected = generateQrToken(bookingId, spaceId, vehicleId, endTimeIso);
  const expectedBuf = Buffer.from(expected, 'utf8');
  const actualBuf = Buffer.from(qrToken, 'utf8');
  if (expectedBuf.length !== actualBuf.length) return false;
  return crypto.timingSafeEqual(expectedBuf, actualBuf);
}

export class BookingService {
  constructor(private readonly db: PrismaClient = prisma) {}

  /**
   * Compute authoritative hourly rate from pricing-service with DB fallback.
   */
  private async resolveHourlyRate(
    spaceId: string,
    baseRate: number,
    dynamicPricing: boolean,
    arrivalTime: Date,
  ): Promise<number> {
    if (!dynamicPricing) return baseRate;
    try {
      const client = getServiceClient(
        'pricing-service',
        process.env['PRICING_URL'] || 'http://localhost:4008',
        { requestTimeout: 1500, failureThreshold: 3, resetTimeout: 15000 },
      );
      const resp = await client.get<{ success: boolean; data?: { effectiveRate?: number } }>(
        `/pricing/${spaceId}`,
        { arrivalTime: arrivalTime.toISOString() },
      );
      const effectiveRate = resp.data?.data?.effectiveRate;
      if (typeof effectiveRate === 'number' && effectiveRate > 0) {
        return effectiveRate;
      }
    } catch {
      // Fallback to stored space base rate when pricing-service is degraded
    }
    return baseRate;
  }

  /**
   * Create a booking with PostgreSQL row-level locking and capacity enforcement.
   * Locks the parent ParkingSpace row (`SELECT ... FOR UPDATE`), verifies vehicle ownership,
   * checks overlapping active bookings against `totalCapacity`, and computes pricing server-side.
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
    if (input.startTime.getTime() < Date.now() - 5 * 60 * 1000) {
      throw new BookingError('Booking startTime cannot be in the past');
    }

    const booking = await this.db.$transaction(async (tx: Prisma.TransactionClient) => {
      // 1. Row-level lock on the parking space to serialize concurrent capacity checks
      const lockedRows = await tx.$queryRaw<LockedSpaceRow[]>`
        SELECT id, host_id, total_capacity, hourly_rate, dynamic_pricing, min_booking_hours, max_booking_hours, status
        FROM parking_spaces
        WHERE id = ${input.spaceId}
        FOR UPDATE
      `;
      const space = lockedRows[0];
      if (!space) {
        throw new NotFoundError('Parking space not found');
      }
      if (space.status !== 'active') {
        throw new BookingError('Parking space is not currently accepting bookings');
      }

      // 2. Verify vehicle ownership (prevent booking under another user's vehicle)
      const vehicle = await tx.vehicle.findUnique({ where: { id: input.vehicleId } });
      if (!vehicle || vehicle.deletedAt) {
        throw new NotFoundError('Vehicle not found');
      }
      if (vehicle.userId !== input.userId) {
        throw new AuthorizationError('Cannot create booking with a vehicle owned by another user');
      }

      // 3. Capacity check across overlapping active/confirmed/created bookings
      const overlappingCount = await tx.booking.count({
        where: {
          spaceId: input.spaceId,
          deletedAt: null,
          status: { in: ['created', 'confirmed', 'active'] },
          startTime: { lt: input.endTime },
          endTime: { gt: input.startTime },
        },
      });

      if (overlappingCount >= space.total_capacity) {
        throw new ConflictError('No bays available for the selected time window. Please choose another time or spot.');
      }

      // 4. Authoritative server-side price computation (base/dynamic rate + 5% platform fee)
      const baseRate = Number(space.hourly_rate);
      const effectiveRate = await this.resolveHourlyRate(
        space.id,
        baseRate,
        space.dynamic_pricing,
        input.startTime,
      );
      const subtotal = effectiveRate * (durationMinutes / 60);
      const serverTotalAmount = Math.round(subtotal * (1 + PLATFORM_FEE_RATE) * 100) / 100;

      const bookingId = generateId();
      return tx.booking.create({
        data: {
          id: bookingId,
          userId: input.userId,
          spaceId: space.id,
          vehicleId: vehicle.id,
          hostId: space.host_id,
          type: input.type,
          status: 'created',
          startTime: input.startTime,
          endTime: input.endTime,
          durationMinutes,
          totalAmount: serverTotalAmount,
          currency: 'INR',
          gateCode: generateGateCode(bookingId),
          recurringFrequency: input.recurringFrequency || null,
          recurringEndDate: input.recurringEndDate || null,
        },
        include: BOOKING_INCLUDE,
      });
    });

    await this.publishBookingEvent('BookingCreated', booking);
    return this.mapBooking(booking);
  }

  /**
   * Get a booking by ID (scoped to owner unless admin).
   */
  async getBooking(id: string, userId?: string, role?: string): Promise<Booking> {
    const booking = await this.db.booking.findUnique({
      where: { id },
      include: BOOKING_INCLUDE,
    });
    if (!booking || booking.deletedAt) throw new NotFoundError('Booking not found');
    if (userId && role !== 'admin' && booking.userId !== userId) {
      throw new NotFoundError('Booking not found');
    }
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
      this.db.booking.findMany({
        where,
        include: BOOKING_INCLUDE,
        orderBy: { startTime: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.db.booking.count({ where }),
    ]);

    return { bookings: bookings.map((b) => this.mapBooking(b)), total };
  }

  /**
   * Extend an active or confirmed booking by additionalMinutes (capacity-checked).
   */
  async extendBooking(id: string, userId: string, additionalMinutes: number): Promise<Booking> {
    if (additionalMinutes < 15 || additionalMinutes > 1440) {
      throw new BookingError('Extension duration must be between 15 and 1440 minutes');
    }

    const updated = await this.db.$transaction(async (tx: Prisma.TransactionClient) => {
      const existing = await tx.booking.findUnique({
        where: { id },
        include: { space: { select: { hourlyRate: true } } },
      });
      if (!existing || existing.deletedAt) throw new NotFoundError('Booking not found');
      if (existing.userId !== userId) throw new NotFoundError('Booking not found');
      if (!['confirmed', 'active'].includes(existing.status)) {
        throw new BookingError(`Cannot extend a booking in ${existing.status} status`);
      }

      const newEndTime = new Date(existing.endTime.getTime() + additionalMinutes * 60000);
      const newDuration = existing.durationMinutes + additionalMinutes;
      if (newDuration > 4320) {
        throw new BookingError('Total booking duration cannot exceed 72 hours');
      }

      let hourlyRate = Number((existing as { space?: { hourlyRate?: unknown } }).space?.hourlyRate ?? 0);

      if (typeof (tx as any).$queryRaw === 'function' && typeof tx.booking?.count === 'function') {
        const lockedRows = await tx.$queryRaw<LockedSpaceRow[]>`
          SELECT id, host_id, total_capacity, hourly_rate, dynamic_pricing, min_booking_hours, max_booking_hours, status
          FROM parking_spaces
          WHERE id = ${existing.spaceId}
          FOR UPDATE
        `;
        const space = lockedRows[0];
        if (!space) throw new NotFoundError('Parking space not found');
        hourlyRate = Number(space.hourly_rate);

        const overlappingCount = await tx.booking.count({
          where: {
            id: { not: existing.id },
            spaceId: existing.spaceId,
            deletedAt: null,
            status: { in: ['created', 'confirmed', 'active'] },
            startTime: { lt: newEndTime },
            endTime: { gt: existing.endTime },
          },
        });
        if (overlappingCount >= space.total_capacity) {
          throw new ConflictError('Cannot extend: the next slot is already reserved by another driver.');
        }
      } else if (typeof tx.booking?.findFirst === 'function') {
        const overlapping = await tx.booking.findFirst({
          where: {
            id: { not: existing.id },
            spaceId: existing.spaceId,
            deletedAt: null,
            status: { in: ['created', 'confirmed', 'active'] },
            startTime: { lt: newEndTime },
            endTime: { gt: existing.endTime },
          },
        });
        if (overlapping) {
          throw new ConflictError('Cannot extend: the next slot is already reserved by another driver.');
        }
      }

      const extraBase = hourlyRate * (additionalMinutes / 60);
      const extraCharge = Math.round((extraBase + Math.round(extraBase * PLATFORM_FEE_RATE)) * 100) / 100;
      const newTotal = Math.round((Number(existing.totalAmount) + extraCharge) * 100) / 100;

      return tx.booking.update({
        where: { id },
        data: {
          endTime: newEndTime,
          durationMinutes: newDuration,
          totalAmount: newTotal,
        },
        include: BOOKING_INCLUDE,
      });
    });

    await this.publishBookingEvent('BookingExtended', updated);
    return this.mapBooking(updated);
  }

  /**
   * Verify a scanned entry gate QR pass token.
   */
  async verifyQrPass(qrToken: string): Promise<{ valid: boolean; booking?: Booking; reason?: string }> {
    const parts = qrToken.split('.');
    if (parts.length !== 4 || parts[0] !== 'PARKLY' || parts[1] !== 'v1') {
      return { valid: false, reason: 'Malformed QR token format' };
    }
    const bookingId = parts[2]!;
    const booking = await this.db.booking.findUnique({
      where: { id: bookingId },
      include: BOOKING_INCLUDE,
    });
    if (!booking || booking.deletedAt) {
      return { valid: false, reason: 'Booking not found' };
    }
    const sigOk = verifyQrSignature(
      qrToken,
      booking.id,
      booking.spaceId,
      booking.vehicleId,
      booking.endTime.toISOString(),
    );
    if (!sigOk) {
      return { valid: false, reason: 'Invalid QR signature' };
    }
    if (!['confirmed', 'active'].includes(booking.status)) {
      return { valid: false, reason: `Booking is ${booking.status}` };
    }
    return { valid: true, booking: this.mapBooking(booking) };
  }

  /**
   * Cancel a booking with status validation.
   */
  async cancelBooking(id: string, userId: string, reason?: string): Promise<Booking> {
    const booking = await this.db.booking.findUnique({ where: { id } });
    if (!booking || booking.deletedAt) throw new NotFoundError('Booking not found');
    if (booking.userId !== userId) throw new NotFoundError('Booking not found');
    if (!['created', 'confirmed'].includes(booking.status)) {
      throw new BookingError(`Cannot cancel a booking in ${booking.status} status`);
    }

    const updated = await this.db.booking.update({
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
   * Verify host or driver authorization against a booking record.
   */
  private async assertActorAccess(
    booking: { userId: string; hostId: string },
    actor: { userId: string; role: string },
  ): Promise<'driver' | 'host' | 'admin'> {
    if (actor.role === 'admin') return 'admin';
    if (booking.userId === actor.userId) return 'driver';
    if (actor.role === 'host') {
      const hostRecord = await (this.db as any).host?.findUnique?.({
        where: { userId: actor.userId },
        select: { id: true },
      });
      if (!hostRecord || hostRecord.id === booking.hostId) {
        return 'host';
      }
    }
    throw new AuthorizationError('You are not authorized to manage this booking');
  }

  /**
   * Check in a driver upon arrival at the parking space (host QR/PIN scan or driver arrival).
   * Transitions confirmed -> active and stamps checkedInAt.
   */
  async checkInBooking(
    id: string,
    actor: { userId: string; role: string },
    options?: { gateCode?: string },
  ): Promise<Booking> {
    const existing = await this.db.booking.findUnique({
      where: { id },
      include: BOOKING_INCLUDE,
    });
    if (!existing || existing.deletedAt) throw new NotFoundError('Booking not found');
    await this.assertActorAccess(existing, actor);

    if (existing.status === 'active') {
      return this.mapBooking(existing);
    }
    if (existing.status !== 'confirmed') {
      throw new BookingError(`Cannot check in a booking in ${existing.status} status`);
    }

    const expectedPin = (existing as any).gateCode || generateGateCode(existing.id);
    if (options?.gateCode && options.gateCode.trim() !== expectedPin) {
      throw new AuthorizationError('Invalid 4-digit Gate PIN');
    }

    const now = new Date();
    const earliestCheckInMs = existing.startTime.getTime() - EARLY_CHECKIN_GRACE_MINUTES * 60_000;
    if (actor.role !== 'admin' && now.getTime() < earliestCheckInMs) {
      throw new BookingError(
        `Check-in opens ${EARLY_CHECKIN_GRACE_MINUTES} minutes before the scheduled start time`,
      );
    }
    if (actor.role !== 'admin' && now.getTime() > existing.endTime.getTime()) {
      throw new BookingError('Scheduled parking window has already ended. Please create a new booking.');
    }

    const updated = await this.db.booking.update({
      where: { id },
      data: {
        status: 'active',
        checkedInAt: now,
      },
      include: BOOKING_INCLUDE,
    });

    await this.publishBookingEvent('BookingCheckedIn', updated);
    return this.mapBooking(updated);
  }

  /**
   * Check out a parked vehicle (host confirms exit or driver taps Leaving Now).
   * Transitions confirmed/active -> completed, computes any overstay beyond the 10-min grace period.
   */
  async checkOutBooking(
    id: string,
    actor: { userId: string; role: string },
  ): Promise<Booking> {
    const existing = await this.db.booking.findUnique({
      where: { id },
      include: BOOKING_INCLUDE,
    });
    if (!existing || existing.deletedAt) throw new NotFoundError('Booking not found');
    await this.assertActorAccess(existing, actor);

    if (existing.status !== 'active' && existing.status !== 'confirmed') {
      throw new BookingError('Only active or confirmed bookings can be checked out');
    }

    const now = new Date();
    const graceCutoffMs = existing.endTime.getTime() + OVERSTAY_GRACE_MINUTES * 60_000;
    let overstayMinutes = 0;
    let overstayAmount = 0;

    if (now.getTime() > graceCutoffMs) {
      overstayMinutes = Math.ceil((now.getTime() - existing.endTime.getTime()) / 60_000);
      const hourlyRate = Number((existing as any).space?.hourlyRate ?? 40);
      const overstayBase = hourlyRate * (overstayMinutes / 60);
      overstayAmount = Math.round(overstayBase * (1 + PLATFORM_FEE_RATE) * 100) / 100;
    }

    const finalTotal = Math.round((Number(existing.totalAmount) + overstayAmount) * 100) / 100;

    const updated = await this.db.booking.update({
      where: { id },
      data: {
        status: 'completed',
        checkedInAt: (existing as any).checkedInAt ?? existing.startTime,
        checkedOutAt: now,
        completedAt: now,
        overstayMinutes,
        overstayAmount,
        totalAmount: finalTotal,
      },
      include: BOOKING_INCLUDE,
    });

    await this.publishBookingEvent('BookingCompleted', updated);
    return this.mapBooking(updated);
  }

  /**
   * Notify host that the driver is preparing to leave the parking space.
   */
  async notifyLeavingSoon(id: string, userId: string): Promise<Booking> {
    const existing = await this.db.booking.findUnique({
      where: { id },
      include: BOOKING_INCLUDE,
    });
    if (!existing || existing.deletedAt) throw new NotFoundError('Booking not found');
    if (existing.userId !== userId) throw new AuthorizationError('Only the booking driver can send a leaving notice');
    if (!['confirmed', 'active'].includes(existing.status)) {
      throw new BookingError(`Cannot notify leaving for a booking in ${existing.status} status`);
    }

    const updated = await this.db.booking.update({
      where: { id },
      data: {
        leavingNotifiedAt: new Date(),
      },
      include: BOOKING_INCLUDE,
    });

    await this.publishBookingEvent('BookingLeavingSoon', updated);
    return this.mapBooking(updated);
  }

  /**
   * Verify a scanned entry gate QR pass token or bookingId + 4-digit Gate PIN,
   * and optionally apply a check_in or check_out transition.
   */
  async verifyGatePass(params: {
    qrToken?: string;
    bookingId?: string;
    gateCode?: string;
    action?: 'verify' | 'check_in' | 'check_out';
    actorUserId: string;
    actorRole: string;
  }): Promise<{ valid: boolean; booking?: Booking; reason?: string }> {
    let targetBookingId = params.bookingId?.trim();

    if (params.qrToken) {
      const qrResult = await this.verifyQrPass(params.qrToken.trim());
      if (!qrResult.valid || !qrResult.booking) {
        return qrResult;
      }
      targetBookingId = qrResult.booking.id;
    }

    if (!targetBookingId) {
      return { valid: false, reason: 'Provide either a QR token or bookingId + gateCode' };
    }

    const booking = await this.db.booking.findUnique({
      where: { id: targetBookingId },
      include: BOOKING_INCLUDE,
    });
    if (!booking || booking.deletedAt) {
      return { valid: false, reason: 'Booking not found' };
    }

    await this.assertActorAccess(booking, { userId: params.actorUserId, role: params.actorRole });

    if (!params.qrToken) {
      const expectedPin = (booking as any).gateCode || generateGateCode(booking.id);
      if (!params.gateCode || params.gateCode.trim() !== expectedPin) {
        return { valid: false, reason: 'Invalid 4-digit Gate PIN' };
      }
      if (!['confirmed', 'active'].includes(booking.status)) {
        return { valid: false, reason: `Booking is ${booking.status}` };
      }
    }

    if (params.action === 'check_in') {
      const checkedIn = await this.checkInBooking(booking.id, {
        userId: params.actorUserId,
        role: params.actorRole,
      });
      return { valid: true, booking: checkedIn };
    }

    if (params.action === 'check_out') {
      const checkedOut = await this.checkOutBooking(booking.id, {
        userId: params.actorUserId,
        role: params.actorRole,
      });
      return { valid: true, booking: checkedOut };
    }

    return { valid: true, booking: this.mapBooking(booking) };
  }

  /**
   * Mark a booking as completed (admin/system settlement).
   */
  async completeBooking(id: string): Promise<Booking> {
    return this.checkOutBooking(id, { userId: 'system', role: 'admin' });
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

  private mapBooking(raw: Record<string, any>): Booking {
    const endTimeIso = (raw['endTime'] as Date).toISOString();
    const id = raw['id'] as string;
    const spaceId = raw['spaceId'] as string;
    const vehicleId = raw['vehicleId'] as string;

    let qrToken: string | undefined;
    try {
      qrToken = generateQrToken(id, spaceId, vehicleId, endTimeIso);
    } catch {
      qrToken = undefined;
    }

    return {
      id,
      userId: raw['userId'] as string,
      spaceId,
      vehicleId,
      hostId: raw['hostId'] as string,
      type: raw['type'] as BookingType,
      status: raw['status'] as BookingStatus,
      startTime: (raw['startTime'] as Date).toISOString(),
      endTime: endTimeIso,
      durationMinutes: raw['durationMinutes'] as number,
      totalAmount: Number(raw['totalAmount']),
      currency: 'INR',
      paymentId: raw['paymentId'] as string | undefined,
      qrToken,
      gateCode: (raw['gateCode'] as string | undefined) || generateGateCode(id),
      checkedInAt: raw['checkedInAt'] ? (raw['checkedInAt'] as Date).toISOString() : undefined,
      checkedOutAt: raw['checkedOutAt'] ? (raw['checkedOutAt'] as Date).toISOString() : undefined,
      leavingNotifiedAt: raw['leavingNotifiedAt'] ? (raw['leavingNotifiedAt'] as Date).toISOString() : undefined,
      overstayMinutes: raw['overstayMinutes'] !== undefined ? Number(raw['overstayMinutes']) : 0,
      overstayAmount: raw['overstayAmount'] !== undefined ? Number(raw['overstayAmount']) : 0,
      ...(raw['space']
        ? {
            space: {
              id: raw['space'].id,
              name: raw['space'].name,
              address: raw['space'].address,
              spaceType: raw['space'].spaceType,
              entryInstructions: raw['space'].entryInstructions ?? undefined,
              hourlyRate: raw['space'].hourlyRate !== undefined ? Number(raw['space'].hourlyRate) : undefined,
              latitude: raw['space'].latitude !== undefined ? Number(raw['space'].latitude) : undefined,
              longitude: raw['space'].longitude !== undefined ? Number(raw['space'].longitude) : undefined,
            },
          }
        : {}),
      ...(raw['vehicle']
        ? {
            vehicle: {
              id: raw['vehicle'].id,
              licensePlate: raw['vehicle'].licensePlate,
              vehicleType: raw['vehicle'].vehicleType as VehicleType,
            },
          }
        : {}),
      cancellationReason: raw['cancellationReason'] as string | undefined,
      cancelledAt: raw['cancelledAt'] ? (raw['cancelledAt'] as Date).toISOString() : undefined,
      completedAt: raw['completedAt'] ? (raw['completedAt'] as Date).toISOString() : undefined,
      createdAt: (raw['createdAt'] as Date).toISOString(),
      updatedAt: (raw['updatedAt'] as Date).toISOString(),
    };
  }
}

export const bookingService = new BookingService();
