// ============================================================
// API Gateway — BFF (Backend for Frontend)
// JWT validation, rate limiting, proxy routing, service health dashboard.
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
  responseTimer,
  securityHeaders,
  logger,
  createHealthCheck,
  createHttpCheck,
  registerGracefulShutdown,
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
app.use(responseTimer);
app.use(cors({ origin: process.env['ALLOWED_ORIGINS']?.split(',') || '*' }));
// NOTE: Do NOT add a body parser (express.json) here. The gateway only proxies
// requests downstream; parsing the body would consume the request stream and
// http-proxy-middleware would forward an empty body, hanging POST/PUT requests.
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

function proxyTo(target: string, basePath: string) {
  return createProxyMiddleware({
    target,
    changeOrigin: true,
    // Express strips the mount path (e.g. /api/v1/auth) before the proxy runs,
    // leaving req.url as e.g. /otp/request. Downstream services mount their
    // routers at /auth, /search, etc., so we prepend that base path here.
    pathRewrite: (path: string) => `${basePath}${path}`,
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
const healthHandler = createHealthCheck(SERVICE_NAME, '1.0.0', [
  createHttpCheck('auth-service', `${SERVICES.auth}/health`),
  createHttpCheck('booking-service', `${SERVICES.booking}/health`),
  createHttpCheck('payment-service', `${SERVICES.payment}/health`),
  createHttpCheck('search-service', `${SERVICES.search}/health`),
  createHttpCheck('occupancy-service', `${SERVICES.occupancy}/health`),
  createHttpCheck('pricing-service', `${SERVICES.pricing}/health`),
  createHttpCheck('host-service', `${SERVICES.host}/health`),
  createHttpCheck('admin-service', `${SERVICES.admin}/health`),
]);
app.get('/health', healthHandler);

// --- Readiness probe (for load balancer / k8s) ---
app.get('/ready', async (_req: Request, res: Response) => {
  try {
    // Quick check: just verify auth service is reachable (critical path)
    const response = await fetch(`${SERVICES.auth}/health`, { signal: AbortSignal.timeout(1000) });
    if (response.ok) {
      res.status(200).json({ ready: true });
    } else {
      res.status(503).json({ ready: false, reason: 'auth-service unhealthy' });
    }
  } catch {
    res.status(503).json({ ready: false, reason: 'auth-service unreachable' });
  }
});

// --- Service Status Dashboard (for admin panel visibility) ---
app.get('/api/v1/status', async (_req: Request, res: Response) => {
  const serviceChecks = Object.entries(SERVICES).map(async ([name, url]) => {
    const start = Date.now();
    try {
      const response = await fetch(`${url}/health`, { signal: AbortSignal.timeout(2000) });
      const data = await response.json() as Record<string, unknown>;
      return {
        name,
        url,
        status: response.ok ? 'up' : 'degraded',
        latencyMs: Date.now() - start,
        details: data,
      };
    } catch {
      return { name, url, status: 'down', latencyMs: Date.now() - start, details: null };
    }
  });

  const results = await Promise.all(serviceChecks);
  const allUp = results.every((r) => r.status === 'up');
  const anyDown = results.some((r) => r.status === 'down');

  res.json({
    success: true,
    data: {
      platform: anyDown ? 'degraded' : allUp ? 'operational' : 'partial',
      services: results,
      timestamp: new Date().toISOString(),
    },
  } as ApiResponse);
});

// --- Public Routes (no auth) ---
app.use('/api/v1/auth', proxyTo(SERVICES.auth, '/auth'));

// --- Protected Routes (JWT required at gateway level) ---
app.use('/api/v1/search', authenticate, proxyTo(SERVICES.search, '/search'));
app.use('/api/v1/bookings', authenticate, proxyTo(SERVICES.booking, '/bookings'));
app.use('/api/v1/payments', authenticate, proxyTo(SERVICES.payment, '/payments'));
app.use('/api/v1/occupancy', authenticate, proxyTo(SERVICES.occupancy, '/occupancy'));
app.use('/api/v1/pricing', authenticate, proxyTo(SERVICES.pricing, '/pricing'));
app.use('/api/v1/host', authenticate, proxyTo(SERVICES.host, '/host'));
app.use('/api/v1/admin', authenticate, proxyTo(SERVICES.admin, '/admin'));

// --- Fallback ---
app.use(notFoundHandler);
app.use(errorHandler);

const server = app.listen(PORT, () => {
  logger.info({ port: PORT, service: SERVICE_NAME }, `${SERVICE_NAME} started`);
  logger.info('Routes registered:', Object.keys(SERVICES));
});

registerGracefulShutdown({ server, serviceName: SERVICE_NAME });

export default app;
