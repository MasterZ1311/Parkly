import { Result, AgentError } from '../../core';

export interface BookingHoldResult {
  bookingId: string;
  spaceId: string;
  status: 'created' | 'confirmed' | 'cancelled';
  totalAmount: number;
  currency: 'INR';
  holdExpiresAt: string;
  paymentIntentToken: string;
  qrCode: string;
}

export interface IBookingServiceTool {
  createHold(params: {
    spaceId: string;
    driverId: string;
    durationHours: number;
    hourlyRate: number;
  }): Promise<Result<BookingHoldResult, AgentError>>;

  releaseHold(bookingId: string): Promise<Result<void, AgentError>>;

  confirmBooking(bookingId: string): Promise<Result<void, AgentError>>;
}
