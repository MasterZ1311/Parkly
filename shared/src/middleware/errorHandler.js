"use strict";
// ============================================================
// Parkly — Global Error Handler Middleware
// Fail-closed: swallows no errors, always returns structured response.
// SECURITY: Never leak stack traces or internal details to clients.
// ============================================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.errorHandler = errorHandler;
exports.notFoundHandler = notFoundHandler;
const errors_1 = require("../errors");
const logger_1 = require("../logger");
function errorHandler(err, req, res, _next) {
    const requestId = req.requestId || 'unknown';
    if ((0, errors_1.isParklyError)(err)) {
        // Log at appropriate level
        if (err.statusCode >= 500) {
            logger_1.logger.error({ requestId, err, path: req.path, method: req.method }, err.message);
        }
        else {
            logger_1.logger.warn({ requestId, code: err.code, path: req.path }, err.message);
        }
        const body = {
            success: false,
            error: err.toJSON(),
            meta: { requestId, timestamp: new Date().toISOString() },
        };
        if (err instanceof errors_1.RateLimitError) {
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
    logger_1.logger.error({ requestId, err, path: req.path, method: req.method }, 'Unhandled error');
    res.status(500).json({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' },
        meta: { requestId, timestamp: new Date().toISOString() },
    });
}
/**
 * 404 handler — mount after all routes
 */
function notFoundHandler(req, res) {
    res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: `Route ${req.method} ${req.path} not found` },
        meta: { requestId: req.requestId || 'unknown', timestamp: new Date().toISOString() },
    });
}
//# sourceMappingURL=errorHandler.js.map