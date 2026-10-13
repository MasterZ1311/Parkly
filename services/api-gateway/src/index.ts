// ============================================================
// API Gateway — BFF (Backend for Frontend)
// JWT validation, rate limiting, proxy routing, service health dashboard.
// ============================================================

import 'dotenv/config';
import express, { Request, Response } from 'express';
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
// NOTE: Do NOT add a body parser (express.json) globally here. The gateway proxies
// raw request streams downstream; pre-parsing consumes the stream and hangs http-proxy-middleware.
app.use(requestLogger);

// --- Rate Limiting: 100 requests per 15 minutes per IP ---
const rateLimiter = rateLimit({
  windowMs: parseInt(process.env['RATE_LIMIT_WINDOW_MS'] || '900000', 10), // 15 minutes
  max: parseInt(process.env['RATE_LIMIT_MAX'] || '100', 10),
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    const retryAfter = Math.ceil(parseInt(process.env['RATE_LIMIT_WINDOW_MS'] || '900000', 10) / 1000);
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
  prediction: process.env['PREDICTION_URL'] || 'http://localhost:4005',
  occupancy: process.env['OCCUPANCY_URL'] || 'http://localhost:4007',
  pricing: process.env['PRICING_URL'] || 'http://localhost:4008',
  notification: process.env['NOTIFICATION_URL'] || 'http://localhost:4009',
  host: process.env['HOST_URL'] || 'http://localhost:4010',
  admin: process.env['ADMIN_URL'] || 'http://localhost:4011',
};

function proxyTo(target: string, basePath: string) {
  return createProxyMiddleware({
    target,
    changeOrigin: true,
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

// --- Health Check Aggregator ---
const healthHandler = createHealthCheck(SERVICE_NAME, '1.0.0', [
  createHttpCheck('auth-service', `${SERVICES.auth}/health`),
  createHttpCheck('booking-service', `${SERVICES.booking}/health`),
  createHttpCheck('payment-service', `${SERVICES.payment}/health`),
  createHttpCheck('search-service', `${SERVICES.search}/health`),
  createHttpCheck('prediction-service', `${SERVICES.prediction}/health`),
  createHttpCheck('occupancy-service', `${SERVICES.occupancy}/health`),
  createHttpCheck('pricing-service', `${SERVICES.pricing}/health`),
  createHttpCheck('notification-service', `${SERVICES.notification}/health`),
  createHttpCheck('host-service', `${SERVICES.host}/health`),
  createHttpCheck('admin-service', `${SERVICES.admin}/health`),
]);
app.get('/health', healthHandler);

// --- Readiness Probe ---
app.get('/ready', async (_req: Request, res: Response) => {
  try {
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

// --- Service Status Dashboard ---
app.get('/api/v1/status', async (_req: Request, res: Response) => {
  const serviceChecks = Object.entries(SERVICES).map(async ([name, url]) => {
    const start = Date.now();
    try {
      const response = await fetch(`${url}/health`, { signal: AbortSignal.timeout(2000) });
      const data = (await response.json()) as Record<string, unknown>;
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

// --- Public Routes (no auth required) ---
app.use('/api/v1/auth', proxyTo(SERVICES.auth, '/auth'));
app.use('/auth', proxyTo(SERVICES.auth, '/auth'));

app.use('/api/v1/search', proxyTo(SERVICES.search, '/search'));
app.use('/search', proxyTo(SERVICES.search, '/search'));

app.use('/api/v1/pricing', proxyTo(SERVICES.pricing, '/pricing'));
app.use('/pricing', proxyTo(SERVICES.pricing, '/pricing'));

app.use('/api/v1/predict', proxyTo(SERVICES.prediction, '/predict'));
app.use('/predict', proxyTo(SERVICES.prediction, '/predict'));

app.use('/api/v1/concierge', proxyTo(SERVICES.prediction, '/concierge'));
app.use('/concierge', proxyTo(SERVICES.prediction, '/concierge'));

// --- Protected Routes (JWT required at gateway level) ---
app.use('/api/v1/bookings', authenticate, proxyTo(SERVICES.booking, '/bookings'));
app.use('/bookings', authenticate, proxyTo(SERVICES.booking, '/bookings'));

app.use('/api/v1/payments', authenticate, proxyTo(SERVICES.payment, '/payments'));
app.use('/payments', authenticate, proxyTo(SERVICES.payment, '/payments'));

app.use('/api/v1/occupancy', authenticate, proxyTo(SERVICES.occupancy, '/occupancy'));
app.use('/occupancy', authenticate, proxyTo(SERVICES.occupancy, '/occupancy'));

app.use('/api/v1/notifications', authenticate, proxyTo(SERVICES.notification, '/notifications'));
app.use('/notifications', authenticate, proxyTo(SERVICES.notification, '/notifications'));

app.use('/api/v1/host', authenticate, proxyTo(SERVICES.host, '/host'));
app.use('/host', authenticate, proxyTo(SERVICES.host, '/host'));

app.use('/api/v1/admin', authenticate, proxyTo(SERVICES.admin, '/admin'));
app.use('/admin', authenticate, proxyTo(SERVICES.admin, '/admin'));

// --- Fallback Handlers ---
app.use(notFoundHandler);
app.use(errorHandler);

const server = app.listen(PORT, () => {
  logger.info({ port: PORT, service: SERVICE_NAME }, `${SERVICE_NAME} started`);
  logger.info('Routes registered:', Object.keys(SERVICES));
});

registerGracefulShutdown({ server, serviceName: SERVICE_NAME });

export default app;
