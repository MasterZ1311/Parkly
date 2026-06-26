// ============================================================
// Search Service — Entry Point
// ============================================================

import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { PrismaClient } from '@prisma/client';
import { searchRouter } from './routes/search';
import {
  errorHandler,
  notFoundHandler,
  requestLogger,
  responseTimer,
  securityHeaders,
  createHealthCheck,
  createPrismaCheck,
  createHttpCheck,
  registerGracefulShutdown,
  logger,
} from '@parkly/shared';

const PORT = process.env['SEARCH_PORT'] || 4004;
const SERVICE_NAME = 'search-service';
process.env['SERVICE_NAME'] = SERVICE_NAME;

const prisma = new PrismaClient();
const app = express();

app.use(helmet({ contentSecurityPolicy: false }));
app.use(securityHeaders);
app.use(responseTimer);
app.use(cors({ origin: process.env['ALLOWED_ORIGINS']?.split(',') || '*' }));
app.use(express.json({ limit: '64kb' })); // Max payload 64KB per spec
app.use(requestLogger);

// --- Health (Deep) ---
const healthHandler = createHealthCheck(SERVICE_NAME, '1.0.0', [
  createPrismaCheck(prisma),
  createHttpCheck('prediction-service', `${process.env['PREDICTION_URL'] || 'http://localhost:4005'}/health`),
]);
app.get('/health', healthHandler);

app.use('/search', searchRouter);

app.use(notFoundHandler);
app.use(errorHandler);

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
