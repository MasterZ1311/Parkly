import { randomUUID } from 'node:crypto';
import { Result, ok, err, AgentError } from '../../core';
import {
  IBookingServiceTool,
  BookingHoldResult,
} from '../interfaces/booking-service-tool.interface';

export class MockBookingServiceProvider implements IBookingServiceTool {
  private holds: Map<string, BookingHoldResult> = new Map();
  private simulateConflict = false;

  public simulateCapacityConflict(conflict: boolean): void {
    this.simulateConflict = conflict;
  }

  public async createHold(params: {
    spaceId: string;
    driverId: string;
    durationHours: number;
    hourlyRate: number;
  }): Promise<Result<BookingHoldResult, AgentError>> {
    if (this.simulateConflict) {
      return err(
        new AgentError(
          'BUSINESS_INVARIANT_VIOLATION',
          'Concurrency Conflict: Slot already locked by another driver',
          { code: 409 }
        )
      );
    }

    const bookingId = `bk_${randomUUID().substring(0, 8)}`;
    const expires = new Date(Date.now() + 10 * 60 * 1000).toISOString(); // 10-minute hold
    const hold: BookingHoldResult = {
      bookingId,
      spaceId: params.spaceId,
      status: 'created',
      totalAmount: params.hourlyRate * params.durationHours,
      currency: 'INR',
      holdExpiresAt: expires,
      paymentIntentToken: `pi_token_${randomUUID().substring(0, 12)}`,
      qrCode: `PARKLY-QR-${bookingId}-${params.spaceId}`,
    };
    this.holds.set(bookingId, hold);
    return ok(hold);
  }

  public async releaseHold(bookingId: string): Promise<Result<void, AgentError>> {
    const existing = this.holds.get(bookingId);
    if (existing) {
      this.holds.set(bookingId, { ...existing, status: 'cancelled' });
    }
    return ok(undefined);
  }

  public async confirmBooking(bookingId: string): Promise<Result<void, AgentError>> {
    const existing = this.holds.get(bookingId);
    if (existing) {
      this.holds.set(bookingId, { ...existing, status: 'confirmed' });
    }
    return ok(undefined);
  }

  public getActiveHolds(): BookingHoldResult[] {
    return Array.from(this.holds.values());
  }

  public reset(): void {
    this.holds.clear();
    this.simulateConflict = false;
  }
}
