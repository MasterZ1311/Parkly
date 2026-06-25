export declare abstract class ParklyError extends Error {
    readonly field?: string | undefined;
    readonly details?: unknown | undefined;
    abstract readonly statusCode: number;
    abstract readonly code: string;
    constructor(message: string, field?: string | undefined, details?: unknown | undefined);
    toJSON(): {
        details?: {} | undefined;
        field?: string | undefined;
        code: string;
        message: string;
    };
}
export declare class ValidationError extends ParklyError {
    readonly statusCode = 400;
    readonly code = "VALIDATION_ERROR";
}
export declare class AuthenticationError extends ParklyError {
    readonly statusCode = 401;
    readonly code = "AUTHENTICATION_FAILED";
}
export declare class AuthorizationError extends ParklyError {
    readonly statusCode = 403;
    readonly code = "AUTHORIZATION_FAILED";
}
export declare class NotFoundError extends ParklyError {
    readonly statusCode = 404;
    readonly code = "NOT_FOUND";
}
export declare class ConflictError extends ParklyError {
    readonly statusCode = 409;
    readonly code = "CONFLICT";
}
export declare class RateLimitError extends ParklyError {
    readonly retryAfterSeconds: number;
    readonly statusCode = 429;
    readonly code = "RATE_LIMIT_EXCEEDED";
    constructor(message: string, retryAfterSeconds?: number);
}
export declare class PaymentError extends ParklyError {
    readonly statusCode = 402;
    readonly code = "PAYMENT_FAILED";
}
export declare class BookingError extends ParklyError {
    readonly statusCode = 422;
    readonly code = "BOOKING_ERROR";
}
export declare class GeoError extends ParklyError {
    readonly suggestions: {
        text: string;
        coordinates?: {
            lat: number;
            lng: number;
        };
    }[];
    readonly statusCode = 400;
    readonly code = "GEO_RESOLUTION_ERROR";
    constructor(message: string, suggestions?: {
        text: string;
        coordinates?: {
            lat: number;
            lng: number;
        };
    }[]);
}
export declare class ServiceUnavailableError extends ParklyError {
    readonly statusCode = 503;
    readonly code = "SERVICE_UNAVAILABLE";
}
export declare class InternalError extends ParklyError {
    readonly statusCode = 500;
    readonly code = "INTERNAL_ERROR";
}
/**
 * Type guard for ParklyError
 */
export declare function isParklyError(err: unknown): err is ParklyError;
//# sourceMappingURL=index.d.ts.map