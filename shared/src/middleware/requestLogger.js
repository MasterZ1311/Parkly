"use strict";
// ============================================================
// Parkly — Request Logger + Correlation ID Middleware
// ============================================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.requestLogger = requestLogger;
exports.securityHeaders = securityHeaders;
const uuid_1 = require("uuid");
const logger_1 = require("../logger");
/**
 * Assigns a correlation ID to each request and logs request/response.
 */
function requestLogger(req, res, next) {
    const requestId = req.headers['x-request-id'] || (0, uuid_1.v4)();
    req.requestId = requestId;
    res.setHeader('X-Request-Id', requestId);
    const start = Date.now();
    // Log incoming request (no body to avoid PII leakage)
    logger_1.logger.info({
        requestId,
        method: req.method,
        path: req.path,
        query: req.query,
        ip: req.ip,
        userAgent: req.headers['user-agent'],
    }, 'Incoming request');
    res.on('finish', () => {
        const duration = Date.now() - start;
        const level = res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'info';
        logger_1.logger[level]({ requestId, method: req.method, path: req.path, statusCode: res.statusCode, durationMs: duration }, 'Request completed');
    });
    next();
}
/**
 * HTTP security headers middleware.
 * SECURITY: Adds standard security headers to all responses.
 */
function securityHeaders(_req, res, next) {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Content-Security-Policy', "default-src 'self'; frame-ancestors 'none'");
    res.removeHeader('X-Powered-By');
    next();
}
//# sourceMappingURL=requestLogger.js.map