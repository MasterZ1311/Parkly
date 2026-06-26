// ============================================================
// Booking Service — Entry Point
// ============================================================

import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { PrismaClient } from '@prisma/client';
import { bookingRouter } from './routes/booking';
import {
  errorHandler,
  notFoundHandler,
  requestLogger,
  responseTimer,
  securityHeaders,
  createHealthCheck,
  createPrismaCheck,
  registerGracefulShutdown,
  logger,
} from '@parkly/shared';

const PORT = process.env['BOOKING_PORT'] || 4002;
const SERVICE_NAME = 'booking-service';
process.env['SERVICE_NAME'] = SERVICE_NAME;

const prisma = new PrismaClient();
const app = express();

app.use(helmet({ contentSecurityPolicy: false }));
app.use(securityHeaders);
app.use(responseTimer);
app.use(cors({ origin: process.env['ALLOWED_ORIGINS']?.split(',') || '*' }));
app.use(express.json({ limit: '1mb' }));
app.use(requestLogger);

// --- Health (Deep) ---
const healthHandler = createHealthCheck(SERVICE_NAME, '1.0.0', [
  createPrismaCheck(prisma),
]);
app.get('/health', healthHandler);

app.use('/bookings', bookingRouter);

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
