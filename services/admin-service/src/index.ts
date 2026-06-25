// ============================================================
// Admin Service — Monitoring, Verifications, User Management
// ============================================================

import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { Router, Request, Response, NextFunction } from 'express';
import { PrismaClient, UserRole, BookingStatus } from '@prisma/client';

import {
  authenticate,
  requireRole,
  errorHandler,
  notFoundHandler,
  requestLogger,
  securityHeaders,
  logger,
  publishEvent,
  NotFoundError,
  ApiResponse,
} from '@parkly/shared';

const PORT = process.env['ADMIN_PORT'] || 4011;
const SERVICE_NAME = 'admin-service';
process.env['SERVICE_NAME'] = SERVICE_NAME;

const prisma = new PrismaClient();

// ============================================================
// Admin Routes
// ============================================================

const adminRouter = Router();
adminRouter.use(authenticate);
adminRouter.use(requireRole('admin'));

// GET /admin/users — list all users
adminRouter.get('/users', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { page = 1, pageSize = 50, role } = req.query;
    const where = role ? { role: role as UserRole } : {};
    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (Number(page) - 1) * Number(pageSize),
        take: Number(pageSize),
        select: { id: true, phone: true, name: true, email: true, role: true, isActive: true, createdAt: true },
      }),
      prisma.user.count({ where }),
    ]);

    res.json({ success: true, data: { users, total, page: Number(page) } } as ApiResponse);
  } catch (err) {
    next(err);
  }
});

// GET /admin/bookings — all bookings
adminRouter.get('/bookings', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { page = 1, pageSize = 50, status } = req.query;
    const where = status ? { status: status as BookingStatus } : {};
    const [bookings, total] = await Promise.all([
      prisma.booking.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (Number(page) - 1) * Number(pageSize),
        take: Number(pageSize),
      }),
      prisma.booking.count({ where }),
    ]);

    res.json({ success: true, data: { bookings, total } } as ApiResponse);
  } catch (err) {
    next(err);
  }
});

// GET /admin/verifications — pending host verifications
adminRouter.get('/verifications', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const spaces = await prisma.parkingSpace.findMany({
      where: { status: 'pending_verification' },
      include: { host: { include: { user: { select: { name: true, phone: true } } } } },
    });
    res.json({ success: true, data: { spaces } } as ApiResponse);
  } catch (err) {
    next(err);
  }
});

// POST /admin/verifications/:spaceId/approve
adminRouter.post('/verifications/:spaceId/approve', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const space = await prisma.parkingSpace.findUnique({ where: { id: req.params['spaceId'] } });
    if (!space) throw new NotFoundError('Space not found');

    await prisma.parkingSpace.update({
      where: { id: space.id },
      data: { status: 'active' },
    });
    await prisma.host.update({
      where: { id: space.hostId },
      data: { verificationStatus: 'approved', verifiedAt: new Date() },
    });

    await publishEvent({
      type: 'HostVerificationCompleted',
      version: '1.0',
      timestamp: new Date().toISOString(),
      source: 'parkly.admin-service',
      data: { spaceId: space.id, hostId: space.hostId, status: 'approved' },
    });

    logger.info({ spaceId: space.id, adminId: req.user!.sub }, 'Space approved by admin');
    res.json({ success: true, data: { message: 'Space approved and activated' } } as ApiResponse);
  } catch (err) {
    next(err);
  }
});

// POST /admin/verifications/:spaceId/reject
adminRouter.post('/verifications/:spaceId/reject', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const space = await prisma.parkingSpace.findUnique({ where: { id: req.params['spaceId'] } });
    if (!space) throw new NotFoundError('Space not found');

    await prisma.parkingSpace.update({
      where: { id: space.id },
      data: { status: 'draft' },
    });
    await prisma.host.update({
      where: { id: space.hostId },
      data: { verificationStatus: 'rejected' },
    });

    await publishEvent({
      type: 'HostVerificationCompleted',
      version: '1.0',
      timestamp: new Date().toISOString(),
      source: 'parkly.admin-service',
      data: { spaceId: space.id, hostId: space.hostId, status: 'rejected', reason: req.body.reason },
    });

    res.json({ success: true, data: { message: 'Space rejected' } } as ApiResponse);
  } catch (err) {
    next(err);
  }
});

// GET /admin/metrics — basic platform metrics
adminRouter.get('/metrics', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const [
      totalUsers, activeSpaces, totalBookings, completedBookings, pendingVerifications,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.parkingSpace.count({ where: { status: 'active' } }),
      prisma.booking.count(),
      prisma.booking.count({ where: { status: 'completed' } }),
      prisma.parkingSpace.count({ where: { status: 'pending_verification' } }),
    ]);

    res.json({
      success: true,
      data: {
        totalUsers, activeSpaces, totalBookings, completedBookings, pendingVerifications,
        timestamp: new Date().toISOString(),
      },
    } as ApiResponse);
  } catch (err) {
    next(err);
  }
});

// ============================================================
// App
// ============================================================

const app = express();
app.use(helmet({ contentSecurityPolicy: false }));
app.use(securityHeaders);
app.use(cors({ origin: process.env['ALLOWED_ORIGINS']?.split(',') || '*' }));
app.use(express.json({ limit: '1mb' }));
app.use(requestLogger);

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: SERVICE_NAME, version: '1.0.0', timestamp: new Date().toISOString() });
});
app.use('/admin', adminRouter);
app.use(notFoundHandler);
app.use(errorHandler);

const server = app.listen(PORT, () => {
  logger.info({ port: PORT, service: SERVICE_NAME }, `${SERVICE_NAME} started`);
});

process.on('SIGTERM', () => {
  server.close(() => process.exit(0));
});

export default app;
