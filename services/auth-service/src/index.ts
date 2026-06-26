// ============================================================
// Auth Service — Entry Point
// ============================================================

import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { PrismaClient } from '@prisma/client';
import { authRouter } from './routes/auth';
import {
  errorHandler,
  notFoundHandler,
  requestLogger,
  responseTimer,
  securityHeaders,
  createHealthCheck,
  createPrismaCheck,
  createDynamoCheck,
  getDocClient,
  getConfig,
  registerGracefulShutdown,
  logger,
} from '@parkly/shared';

const PORT = process.env['AUTH_PORT'] || 4001;
const SERVICE_NAME = 'auth-service';

process.env['SERVICE_NAME'] = SERVICE_NAME;

const prisma = new PrismaClient();
const app = express();

// --- Middleware ---
app.use(helmet({ contentSecurityPolicy: false })); // shared CSP via securityHeaders
app.use(securityHeaders);
app.use(responseTimer);
app.use(cors({ origin: process.env['ALLOWED_ORIGINS']?.split(',') || '*' }));
app.use(express.json({ limit: '1mb' }));
app.use(requestLogger);

// --- Health (Deep) ---
const healthHandler = createHealthCheck(SERVICE_NAME, '1.0.0', [
  createPrismaCheck(prisma),
  createDynamoCheck(getDocClient, getConfig().dynamoTableOtp),
]);
app.get('/health', healthHandler);

app.use('/auth', authRouter);

// --- Error Handling ---
app.use(notFoundHandler);
app.use(errorHandler);

// --- Start ---
const server = app.listen(PORT, () => {
  logger.info({ port: PORT, service: SERVICE_NAME }, `${SERVICE_NAME} started`);
});

registerGracefulShutdown({
  server,
  serviceName: SERVICE_NAME,
  onShutdown: async () => {
    await prisma.$disconnect();
  },
});

export default app;
