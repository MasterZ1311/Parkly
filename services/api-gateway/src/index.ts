// ============================================================
// API Gateway — BFF (Backend for Frontend)
// JWT validation, rate limiting, proxy routing.
// ============================================================

import 'dotenv/config';
import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { createProxyMiddleware } from 'http-proxy-middleware';
import {
  authenticate,
  errorHandler,
  notFoundHandler,
  requestLogger,
  securityHeaders,
  logger,
  RateLimitError,
  ApiResponse,
} from '@parkly/shared';

const PORT = process.env['GATEWAY_PORT'] || 4000;
const SERVICE_NAME = 'api-gateway';
process.env['SERVICE_NAME'] = SERVICE_NAME;

const app = express();

// --- Core Middleware ---
app.use(helmet({ contentSecurityPolicy: false }));
app.use(securityHeaders);
app.use(cors({ origin: process.env['ALLOWED_ORIGINS']?.split(',') || '*' }));
app.use(express.json({ limit: '64kb' }));
app.use(requestLogger);

// --- Rate Limiting (SECURITY-11) ---
const rateLimiter = rateLimit({
  windowMs: parseInt(process.env['RATE_LIMIT_WINDOW_MS'] || '60000'),
  max: parseInt(process.env['RATE_LIMIT_MAX'] || '100'),
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    const retryAfter = Math.ceil(parseInt(process.env['RATE_LIMIT_WINDOW_MS'] || '60000') / 1000);
    res.status(429).json({
      success: false,
      error: {
        code: 'RATE_LIMIT_EXCEEDED',
        message: 'Too many requests. Please try again later.',
        retryAfterSeconds: retryAfter,
      },
      meta: { requestId: req.requestId || '', timestamp: new Date().toISOString() },
    } as ApiResponse);
  },
});
app.use('/api', rateLimiter);

// --- Service URLs ---
const SERVICES = {
  auth: process.env['AUTH_URL'] || 'http://localhost:4001',
  booking: process.env['BOOKING_URL'] || 'http://localhost:4002',
  payment: process.env['PAYMENT_URL'] || 'http://localhost:4003',
  search: process.env['SEARCH_URL'] || 'http://localhost:4004',
  occupancy: process.env['OCCUPANCY_URL'] || 'http://localhost:4007',
  pricing: process.env['PRICING_URL'] || 'http://localhost:4008',
  host: process.env['HOST_URL'] || 'http://localhost:4010',
  admin: process.env['ADMIN_URL'] || 'http://localhost:4011',
};

function proxyTo(target: string) {
  return createProxyMiddleware({
    target,
    changeOrigin: true,
    on: {
      error: (err, _req, res) => {
        logger.error({ err, target }, 'Proxy error');
        (res as Response).status(503).json({
          success: false,
          error: { code: 'SERVICE_UNAVAILABLE', message: 'Downstream service unavailable' },
        } as ApiResponse);
      },
    },
  });
}

// --- Health ---
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: SERVICE_NAME, version: '1.0.0', timestamp: new Date().toISOString() });
});

// --- Public Routes (no auth) ---
app.use('/api/v1/auth', proxyTo(SERVICES.auth));

// --- Protected Routes (JWT required at gateway level) ---
app.use('/api/v1/search', authenticate, proxyTo(SERVICES.search));
app.use('/api/v1/bookings', authenticate, proxyTo(SERVICES.booking));
app.use('/api/v1/payments', authenticate, proxyTo(SERVICES.payment));
app.use('/api/v1/occupancy', authenticate, proxyTo(SERVICES.occupancy));
app.use('/api/v1/pricing', authenticate, proxyTo(SERVICES.pricing));
app.use('/api/v1/host', authenticate, proxyTo(SERVICES.host));
app.use('/api/v1/admin', authenticate, proxyTo(SERVICES.admin));

// --- Fallback ---
app.use(notFoundHandler);
app.use(errorHandler);

const server = app.listen(PORT, () => {
  logger.info({ port: PORT, service: SERVICE_NAME }, `${SERVICE_NAME} started`);
  logger.info('Routes registered:', Object.keys(SERVICES));
});

process.on('SIGTERM', () => {
  server.close(() => process.exit(0));
});

export default app;
