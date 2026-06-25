import { Request, Response, NextFunction } from 'express';
/**
 * Assigns a correlation ID to each request and logs request/response.
 */
export declare function requestLogger(req: Request, res: Response, next: NextFunction): void;
/**
 * HTTP security headers middleware.
 * SECURITY: Adds standard security headers to all responses.
 */
export declare function securityHeaders(_req: Request, res: Response, next: NextFunction): void;
//# sourceMappingURL=requestLogger.d.ts.map