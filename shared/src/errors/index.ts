// ============================================================
// Parkly — Typed Error Classes
// ============================================================

export abstract class ParklyError extends Error {
  abstract readonly statusCode: number;
  abstract readonly code: string;

  constructor(
    message: string,
    public readonly field?: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = this.constructor.name;
    Error.captureStackTrace?.(this, this.constructor);
  }

  toJSON() {
    return {
      code: this.code,
      message: this.message,
      ...(this.field ? { field: this.field } : {}),
      ...(this.details ? { details: this.details } : {}),
    };
  }
}

export class ValidationError extends ParklyError {
  readonly statusCode = 400;
  readonly code = 'VALIDATION_ERROR';
}

export class AuthenticationError extends ParklyError {
  readonly statusCode = 401;
  readonly code = 'AUTHENTICATION_FAILED';
}

export class AuthorizationError extends ParklyError {
  readonly statusCode = 403;
  readonly code = 'AUTHORIZATION_FAILED';
}

export class NotFoundError extends ParklyError {
  readonly statusCode = 404;
  readonly code = 'NOT_FOUND';
}

export class ConflictError extends ParklyError {
  readonly statusCode = 409;
  readonly code = 'CONFLICT';
}

export class RateLimitError extends ParklyError {
  readonly statusCode = 429;
  readonly code = 'RATE_LIMIT_EXCEEDED';

  constructor(
    message: string,
    public readonly retryAfterSeconds: number = 60,
  ) {
    super(message);
  }
}

export class PaymentError extends ParklyError {
  readonly statusCode = 402;
  readonly code = 'PAYMENT_FAILED';
}

export class BookingError extends ParklyError {
  readonly statusCode = 422;
  readonly code = 'BOOKING_ERROR';
}

export class GeoError extends ParklyError {
  readonly statusCode = 400;
  readonly code = 'GEO_RESOLUTION_ERROR';

  constructor(
    message: string,
    public readonly suggestions: { text: string; coordinates?: { lat: number; lng: number } }[] = [],
  ) {
    super(message);
  }
}

export class ServiceUnavailableError extends ParklyError {
  readonly statusCode = 503;
  readonly code = 'SERVICE_UNAVAILABLE';
}

export class InternalError extends ParklyError {
  readonly statusCode = 500;
  readonly code = 'INTERNAL_ERROR';
}

/**
 * Type guard for ParklyError
 */
export function isParklyError(err: unknown): err is ParklyError {
  return err instanceof ParklyError;
}
