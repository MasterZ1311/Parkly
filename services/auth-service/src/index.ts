// ============================================================
// Auth Service — Entry Point
// ============================================================

import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { authRouter } from './routes/auth';
import { errorHandler, notFoundHandler, requestLogger, securityHeaders } from '@parkly/shared';
import { logger } from '@parkly/shared';

const PORT = process.env['AUTH_PORT'] || 4001;
const SERVICE_NAME = 'auth-service';

process.env['SERVICE_NAME'] = SERVICE_NAME;

const app = express();

// --- Middleware ---
app.use(helmet({ contentSecurityPolicy: false })); // shared CSP via securityHeaders
app.use(securityHeaders);
app.use(cors({ origin: process.env['ALLOWED_ORIGINS']?.split(',') || '*' }));
app.use(express.json({ limit: '1mb' }));
app.use(requestLogger);

// --- Routes ---
app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: SERVICE_NAME,
    version: '1.0.0',
    timestamp: new Date().toISOString(),
  });
});

app.use('/auth', authRouter);

// --- Error Handling ---
app.use(notFoundHandler);
app.use(errorHandler);

// --- Start ---
const server = app.listen(PORT, () => {
  logger.info({ port: PORT, service: SERVICE_NAME }, `${SERVICE_NAME} started`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  server.close(() => {
    logger.info('Server closed');
    process.exit(0);
  });
});

export default app;
