"use strict";
// ============================================================
// Parkly — Typed Error Classes
// ============================================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.InternalError = exports.ServiceUnavailableError = exports.GeoError = exports.BookingError = exports.PaymentError = exports.RateLimitError = exports.ConflictError = exports.NotFoundError = exports.AuthorizationError = exports.AuthenticationError = exports.ValidationError = exports.ParklyError = void 0;
exports.isParklyError = isParklyError;
class ParklyError extends Error {
    field;
    details;
    constructor(message, field, details) {
        super(message);
        this.field = field;
        this.details = details;
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
exports.ParklyError = ParklyError;
class ValidationError extends ParklyError {
    statusCode = 400;
    code = 'VALIDATION_ERROR';
}
exports.ValidationError = ValidationError;
class AuthenticationError extends ParklyError {
    statusCode = 401;
    code = 'AUTHENTICATION_FAILED';
}
exports.AuthenticationError = AuthenticationError;
class AuthorizationError extends ParklyError {
    statusCode = 403;
    code = 'AUTHORIZATION_FAILED';
}
exports.AuthorizationError = AuthorizationError;
class NotFoundError extends ParklyError {
    statusCode = 404;
    code = 'NOT_FOUND';
}
exports.NotFoundError = NotFoundError;
class ConflictError extends ParklyError {
    statusCode = 409;
    code = 'CONFLICT';
}
exports.ConflictError = ConflictError;
class RateLimitError extends ParklyError {
    retryAfterSeconds;
    statusCode = 429;
    code = 'RATE_LIMIT_EXCEEDED';
    constructor(message, retryAfterSeconds = 60) {
        super(message);
        this.retryAfterSeconds = retryAfterSeconds;
    }
}
exports.RateLimitError = RateLimitError;
class PaymentError extends ParklyError {
    statusCode = 402;
    code = 'PAYMENT_FAILED';
}
exports.PaymentError = PaymentError;
class BookingError extends ParklyError {
    statusCode = 422;
    code = 'BOOKING_ERROR';
}
exports.BookingError = BookingError;
class GeoError extends ParklyError {
    suggestions;
    statusCode = 400;
    code = 'GEO_RESOLUTION_ERROR';
    constructor(message, suggestions = []) {
        super(message);
        this.suggestions = suggestions;
    }
}
exports.GeoError = GeoError;
class ServiceUnavailableError extends ParklyError {
    statusCode = 503;
    code = 'SERVICE_UNAVAILABLE';
}
exports.ServiceUnavailableError = ServiceUnavailableError;
class InternalError extends ParklyError {
    statusCode = 500;
    code = 'INTERNAL_ERROR';
}
exports.InternalError = InternalError;
/**
 * Type guard for ParklyError
 */
function isParklyError(err) {
    return err instanceof ParklyError;
}
//# sourceMappingURL=index.js.map