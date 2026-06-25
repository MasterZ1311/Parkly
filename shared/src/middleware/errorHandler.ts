// ============================================================
// Parkly — Global Error Handler Middleware
// Fail-closed: swallows no errors, always returns structured response.
// SECURITY: Never leak stack traces or internal details to clients.
// ============================================================

import { Request, Response, NextFunction } from 'express';
import { isParklyError, RateLimitError } from '../errors';
import { logger } from '../logger';
import { ApiResponse } from '../types';

export function errorHandler(
  err: unknown,
  req: Request,
  res: Response,
  _next: NextFunction,
): void {
  const requestId = req.requestId || 'unknown';

  if (isParklyError(err)) {
    // Log at appropriate level
    if (err.statusCode >= 500) {
      logger.error({ requestId, err, path: req.path, method: req.method }, err.message);
    } else {
      logger.warn({ requestId, code: err.code, path: req.path }, err.message);
    }

    const body: ApiResponse = {
      success: false,
      error: err.toJSON(),
      meta: { requestId, timestamp: new Date().toISOString() },
    };

    if (err instanceof RateLimitError) {
      res.setHeader('Retry-After', String(err.retryAfterSeconds));
      res.status(err.statusCode).json({
        ...body,
        error: { ...body.error, retryAfterSeconds: err.retryAfterSeconds },
      });
      return;
    }

    res.status(err.statusCode).json(body);
    return;
  }

  // Unknown / unexpected error — fail closed, don't leak details
  logger.error(
    { requestId, err, path: req.path, method: req.method },
    'Unhandled error',
  );

  res.status(500).json({
    success: false,
    error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' },
    meta: { requestId, timestamp: new Date().toISOString() },
  } as ApiResponse);
}

/**
 * 404 handler — mount after all routes
 */
export function notFoundHandler(req: Request, res: Response): void {
  res.status(404).json({
    success: false,
    error: { code: 'NOT_FOUND', message: `Route ${req.method} ${req.path} not found` },
    meta: { requestId: req.requestId || 'unknown', timestamp: new Date().toISOString() },
  } as ApiResponse);
}
