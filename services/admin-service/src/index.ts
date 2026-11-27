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
  responseTimer,
  securityHeaders,
  logger,
  publishEvent,
  NotFoundError,
  ValidationError,
  generateId,
  ApiResponse,
  getHardenedCorsOptions,
} from '@parkly/shared';
import { anonymizeUser } from './services/anonymizeService';
import {
  DisputeMediationAgent,
  CityAnalyticsAgent,
  RealNotificationProvider,
  ExecutionContext,
} from '@parkly/ai-agents';
import {
  PrismaSensorVerificationTool,
  PrismaPaymentLedgerTool,
  PrismaAnalyticsLakeTool,
} from './tools/adminAiTools';

const PORT = process.env['ADMIN_PORT'] || 4011;
const SERVICE_NAME = 'admin-service';
process.env['SERVICE_NAME'] = SERVICE_NAME;

const prisma = new PrismaClient();

const VALID_ROLES: UserRole[] = ['driver', 'host', 'admin'];

async function writeAdminAuditLog(
  req: Request,
  action: string,
  target: string,
  metadata?: Record<string, unknown>,
) {
  try {
    await prisma.auditLog.create({
      data: {
        actorId: req.user?.sub || 'admin',
        actorName: req.user?.role ? `admin:${req.user.sub.slice(0, 8)}` : 'Admin',
        action,
        target,
        ipAddress: req.ip || null,
        metadata: (metadata || {}) as any,
      },
    });
  } catch (err) {
    logger.warn({ err, action, target }, 'Failed to write admin audit log');
  }
}

// ============================================================
// Admin Routes
// ============================================================

const adminRouter = Router();
adminRouter.use(authenticate);
adminRouter.use(requireRole('admin'));

// GET /admin/users — list all users
adminRouter.get('/users', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { page = 1, pageSize = 50, role, search } = req.query;
    const where: any = {};
    if (role && role !== 'all') {
      where.role = role as UserRole;
    }
    if (search && typeof search === 'string' && search.trim()) {
      const q = search.trim();
      where.OR = [
        { name: { contains: q, mode: 'insensitive' } },
        { phone: { contains: q } },
        { email: { contains: q, mode: 'insensitive' } },
      ];
    }

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (Math.max(1, Number(page)) - 1) * Number(pageSize),
        take: Math.min(100, Number(pageSize)),
        select: {
          id: true,
          phone: true,
          name: true,
          email: true,
          role: true,
          isActive: true,
          isAnonymized: true,
          anonymizedAt: true,
          deletedAt: true,
          createdAt: true,
        },
      }),
      prisma.user.count({ where }),
    ]);

    res.json({ success: true, data: { users, total, page: Number(page) } } as ApiResponse);
  } catch (err) {
    next(err);
  }
});

// GET /admin/users/:id — fetch single user
adminRouter.get('/users/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.params['id'] },
      include: {
        vehicles: true,
        host: true,
      },
    });
    if (!user) {
      throw new NotFoundError('User not found');
    }
    res.json({
      success: true,
      data: { user },
      meta: { requestId: req.requestId || '', timestamp: new Date().toISOString() },
    } as ApiResponse);
  } catch (err) {
    next(err);
  }
});

// PUT/PATCH /admin/users/:id/role — update user role
const handleUpdateRole = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.params['id']!;
    const role = req.body.role as UserRole;
    if (!VALID_ROLES.includes(role)) {
      throw new ValidationError(`Invalid role. Must be one of: ${VALID_ROLES.join(', ')}`);
    }
    if (userId === req.user!.sub && role !== 'admin') {
      throw new ValidationError('Admins cannot demote their own active account');
    }

    const existing = await prisma.user.findUnique({ where: { id: userId } });
    if (!existing) throw new NotFoundError('User not found');

    const user = await prisma.user.update({
      where: { id: userId },
      data: { role },
      select: { id: true, name: true, phone: true, email: true, role: true, isActive: true },
    });

    if (role === 'host') {
      await prisma.host.upsert({
        where: { userId },
        update: {},
        create: { id: generateId(), userId, verificationStatus: 'pending', totalEarnings: 0, totalPayouts: 0 },
      });
    }

    await writeAdminAuditLog(req, 'ADMIN_USER_ROLE_UPDATED', userId, { fromRole: existing.role, toRole: role });
    res.json({ success: true, data: { user } } as ApiResponse);
  } catch (err) {
    next(err);
  }
};
adminRouter.put('/users/:id/role', handleUpdateRole);
adminRouter.patch('/users/:id/role', handleUpdateRole);

// PUT/POST /admin/users/:id/suspend
const handleSuspendUser = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.params['id']!;
    if (userId === req.user!.sub) {
      throw new ValidationError('Cannot suspend your own active admin account');
    }
    const existing = await prisma.user.findUnique({ where: { id: userId } });
    if (!existing) throw new NotFoundError('User not found');

    const user = await prisma.user.update({
      where: { id: userId },
      data: { isActive: false },
      select: { id: true, name: true, phone: true, role: true, isActive: true },
    });

    await writeAdminAuditLog(req, 'ADMIN_USER_SUSPENDED', userId, { reason: req.body.reason || 'Policy violation' });
    res.json({ success: true, data: { user } } as ApiResponse);
  } catch (err) {
    next(err);
  }
};
adminRouter.put('/users/:id/suspend', handleSuspendUser);
adminRouter.post('/users/:id/suspend', handleSuspendUser);

// PUT/POST /admin/users/:id/unsuspend
const handleUnsuspendUser = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.params['id']!;
    const existing = await prisma.user.findUnique({ where: { id: userId } });
    if (!existing) throw new NotFoundError('User not found');

    const user = await prisma.user.update({
      where: { id: userId },
      data: { isActive: true },
      select: { id: true, name: true, phone: true, role: true, isActive: true },
    });

    await writeAdminAuditLog(req, 'ADMIN_USER_UNSUSPENDED', userId);
    res.json({ success: true, data: { user } } as ApiResponse);
  } catch (err) {
    next(err);
  }
};
adminRouter.put('/users/:id/unsuspend', handleUnsuspendUser);
adminRouter.post('/users/:id/unsuspend', handleUnsuspendUser);

// DELETE /admin/users/:id — DPDPA compliant user anonymization & soft deletion
adminRouter.delete('/users/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.params['id']!;
    const result = await anonymizeUser(userId, prisma);
    await writeAdminAuditLog(req, 'ADMIN_USER_ANONYMIZED', userId);
    res.status(200).json({
      success: true,
      data: result,
      meta: { requestId: req.requestId || '', timestamp: new Date().toISOString() },
    } as ApiResponse);
  } catch (err) {
    next(err);
  }
});

// POST /admin/users/:id/anonymize — Alternative endpoint for DPDPA user anonymization
adminRouter.post('/users/:id/anonymize', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.params['id']!;
    const result = await anonymizeUser(userId, prisma);
    await writeAdminAuditLog(req, 'ADMIN_USER_ANONYMIZED', userId);
    res.status(200).json({
      success: true,
      data: result,
      meta: { requestId: req.requestId || '', timestamp: new Date().toISOString() },
    } as ApiResponse);
  } catch (err) {
    next(err);
  }
});

// GET /admin/bookings — all bookings with relations
adminRouter.get('/bookings', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { page = 1, pageSize = 50, status, search } = req.query;
    const where: any = {};
    if (status && status !== 'all') {
      where.status = status as BookingStatus;
    }
    if (search && typeof search === 'string' && search.trim()) {
      const q = search.trim();
      where.OR = [
        { id: { contains: q, mode: 'insensitive' } },
        { user: { name: { contains: q, mode: 'insensitive' } } },
        { space: { name: { contains: q, mode: 'insensitive' } } },
        { vehicle: { licensePlate: { contains: q, mode: 'insensitive' } } },
      ];
    }
    const [bookings, total] = await Promise.all([
      prisma.booking.findMany({
        where,
        include: {
          user: { select: { id: true, name: true, phone: true, email: true } },
          space: { select: { id: true, name: true, address: true, city: true } },
          vehicle: { select: { id: true, licensePlate: true, vehicleType: true } },
          payment: { select: { id: true, status: true, amount: true, provider: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (Math.max(1, Number(page)) - 1) * Number(pageSize),
        take: Math.min(100, Number(pageSize)),
      }),
      prisma.booking.count({ where }),
    ]);

    res.json({ success: true, data: { bookings, total, page: Number(page) } } as ApiResponse);
  } catch (err) {
    next(err);
  }
});

// GET /admin/bookings/:id — single booking detail
adminRouter.get('/bookings/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const booking = await prisma.booking.findUnique({
      where: { id: req.params['id'] },
      include: {
        user: { select: { id: true, name: true, phone: true, email: true } },
        space: true,
        vehicle: true,
        payment: true,
        dispute: true,
      },
    });
    if (!booking) throw new NotFoundError('Booking not found');
    res.json({ success: true, data: { booking } } as ApiResponse);
  } catch (err) {
    next(err);
  }
});

// GET /admin/verifications — pending host verifications
adminRouter.get('/verifications', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const spaces = await prisma.parkingSpace.findMany({
      where: { status: 'pending_verification' },
      include: { host: { include: { user: { select: { name: true, phone: true } } } } },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ success: true, data: { spaces } } as ApiResponse);
  } catch (err) {
    next(err);
  }
});

const handleApproveVerification = async (req: Request, res: Response, next: NextFunction) => {
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

    await writeAdminAuditLog(req, 'ADMIN_VERIFICATION_APPROVED', space.id, { hostId: space.hostId });
    logger.info({ spaceId: space.id, adminId: req.user!.sub }, 'Space approved by admin');
    res.json({ success: true, data: { message: 'Space approved and activated' } } as ApiResponse);
  } catch (err) {
    next(err);
  }
};

const handleRejectVerification = async (req: Request, res: Response, next: NextFunction) => {
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

    await writeAdminAuditLog(req, 'ADMIN_VERIFICATION_REJECTED', space.id, {
      hostId: space.hostId,
      reason: req.body.reason || 'Documentation insufficient',
    });
    res.json({ success: true, data: { message: 'Space rejected' } } as ApiResponse);
  } catch (err) {
    next(err);
  }
};

adminRouter.post('/verifications/:spaceId/approve', handleApproveVerification);
adminRouter.post('/verifications/:hostId/:spaceId/approve', handleApproveVerification);
adminRouter.post('/verifications/:spaceId/reject', handleRejectVerification);
adminRouter.post('/verifications/:hostId/:spaceId/reject', handleRejectVerification);

// GET /admin/metrics & /admin/stats — platform metrics
const handleGetMetrics = async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const [
      totalUsers,
      activeSpaces,
      totalBookings,
      completedBookings,
      pendingVerifications,
      activeHosts,
      openDisputes,
      unresolvedAlerts,
      revenueAgg,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.parkingSpace.count({ where: { status: 'active' } }),
      prisma.booking.count(),
      prisma.booking.count({ where: { status: 'completed' } }),
      prisma.parkingSpace.count({ where: { status: 'pending_verification' } }),
      prisma.host.count({ where: { verificationStatus: 'approved' } }),
      prisma.dispute.count({ where: { status: { in: ['open', 'under_review'] } } }),
      prisma.systemAlert.count({ where: { resolved: false } }),
      prisma.booking.aggregate({
        where: { status: { in: ['confirmed', 'active', 'completed'] } },
        _sum: { totalAmount: true },
      }),
    ]);

    const totalRevenue = Number(revenueAgg._sum.totalAmount || 0);

    res.json({
      success: true,
      data: {
        totalUsers,
        activeSpaces,
        totalBookings,
        completedBookings,
        pendingVerifications,
        activeHosts,
        openDisputes,
        unresolvedAlerts,
        totalRevenue: Number(totalRevenue.toFixed(2)),
        platformFeeRevenue: Number((totalRevenue * 0.1).toFixed(2)),
        timestamp: new Date().toISOString(),
      },
    } as ApiResponse);
  } catch (err) {
    next(err);
  }
};
adminRouter.get('/metrics', handleGetMetrics);
adminRouter.get('/stats', handleGetMetrics);

// GET /admin/revenue — platform revenue summary
adminRouter.get('/revenue', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const bookings = await prisma.booking.findMany({
      where: { status: { in: ['confirmed', 'active', 'completed'] } },
      select: { totalAmount: true, startTime: true },
      take: 500,
    });
    const grossRevenue = bookings.reduce((s, b) => s + Number(b.totalAmount), 0);
    const platformFees = Number((grossRevenue * 0.1).toFixed(2));
    res.json({
      success: true,
      data: {
        grossRevenue: Number(grossRevenue.toFixed(2)),
        platformFees,
        hostPayoutPool: Number((grossRevenue - platformFees).toFixed(2)),
      },
    } as ApiResponse);
  } catch (err) {
    next(err);
  }
});

// Autonomous AI Agents backed by real Prisma & Notification tools
const disputeMediationAgent = new DisputeMediationAgent({
  sensorTool: new PrismaSensorVerificationTool(prisma),
  ledgerTool: new PrismaPaymentLedgerTool(prisma),
  notificationTool: new RealNotificationProvider({ enableConsoleAudit: true }),
});

const cityAnalyticsAgent = new CityAnalyticsAgent({
  analyticsLakeTool: new PrismaAnalyticsLakeTool(prisma),
});

// GET /admin/disputes — list disputes
adminRouter.get('/disputes', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const status = req.query['status'] as string | undefined;
    const disputes = await prisma.dispute.findMany({
      where: status && status !== 'all' ? { status: status as any } : undefined,
      include: {
        booking: {
          include: {
            space: { select: { id: true, name: true, city: true } },
            vehicle: { select: { id: true, licensePlate: true } },
          },
        },
        user: { select: { id: true, name: true, phone: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ success: true, data: { disputes } } as ApiResponse);
  } catch (err) {
    next(err);
  }
});

// POST /admin/disputes/:id/mediate — Autonomous dispute mediation
adminRouter.post('/disputes/:id/mediate', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const disputeId = req.params['id']!;
    const { bookingId, incidentType, evidence } = req.body;

    const existingDispute = await prisma.dispute.findUnique({ where: { id: disputeId } }).catch(() => null);
    const targetBookingId = existingDispute?.bookingId || bookingId;
    if (!targetBookingId || typeof targetBookingId !== 'string') {
      throw new ValidationError('bookingId is required for dispute mediation');
    }

    const ctx = ExecutionContext.create({
      correlationId: (req.headers['x-correlation-id'] as string) || `dispute-${Date.now()}`,
      initiatorUserId: req.user!.sub,
      metadata: { role: 'admin' },
    });

    const agentResult = await disputeMediationAgent.execute({
      disputeId,
      bookingId: targetBookingId,
      incidentType: incidentType || (existingDispute?.disputeType === 'unauthorized_use' ? 'OVERSTAY' : 'NO_SHOW'),
      reportedBy: req.user!.sub,
      evidence: evidence || {},
    }, ctx);

    if (!agentResult.success) {
      if (agentResult.error.code === 'VALIDATION_ERROR') {
        throw new ValidationError(agentResult.error.message);
      }
      return next(new Error(agentResult.error.message));
    }

    if (existingDispute) {
      await prisma.dispute.update({
        where: { id: existingDispute.id },
        data: {
          status: agentResult.data.adjudication === 'ESCALATED_MANUAL' ? 'under_review' : 'resolved',
          resolution: agentResult.data.platformAuditLog,
          resolvedBy: req.user!.sub,
        },
      });
    }

    await writeAdminAuditLog(req, 'ADMIN_DISPUTE_MEDIATED', disputeId, {
      bookingId: targetBookingId,
      adjudication: agentResult.data.adjudication,
      compensation: agentResult.data.hostCompensationAmount,
    });

    res.json({
      success: true,
      data: agentResult.data,
    } as ApiResponse);
  } catch (err) {
    next(err);
  }
});

// GET /admin/analytics/city — Autonomous city-scale mobility & carbon metrics
adminRouter.get('/analytics/city', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const cityId = (req.query['cityId'] as string) || 'chennai';
    const period = (req.query['period'] as string) || '2026-W36';
    const zones = req.query['zones'] ? (req.query['zones'] as string).split(',') : ['t-nagar', 'anna-nagar', 'omr'];

    const ctx = ExecutionContext.create({
      correlationId: (req.headers['x-correlation-id'] as string) || `analytics-${Date.now()}`,
      initiatorUserId: req.user!.sub,
      metadata: { role: 'admin' },
    });

    const agentResult = await cityAnalyticsAgent.execute({
      cityId,
      period,
      zones,
    }, ctx);

    if (!agentResult.success) {
      return next(new Error(agentResult.error.message));
    }

    res.json({
      success: true,
      data: agentResult.data,
    } as ApiResponse);
  } catch (err) {
    next(err);
  }
});

// GET /admin/alerts — system alerts
adminRouter.get('/alerts', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const alerts = await prisma.systemAlert.findMany({
      orderBy: [{ resolved: 'asc' }, { createdAt: 'desc' }],
      take: 100,
    });
    res.json({ success: true, data: { alerts } } as ApiResponse);
  } catch (err) {
    next(err);
  }
});

// PUT|POST /admin/alerts/:id/resolve — resolve alert
const handleResolveAlert = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params['id']!;
    const existing = await prisma.systemAlert.findUnique({ where: { id } });
    if (!existing) throw new NotFoundError('Alert not found');

    const alert = await prisma.systemAlert.update({
      where: { id },
      data: { resolved: true, resolvedBy: req.user!.sub, resolvedAt: new Date() },
    });
    await writeAdminAuditLog(req, 'ADMIN_ALERT_RESOLVED', id);
    res.json({ success: true, data: { alert } } as ApiResponse);
  } catch (err) {
    next(err);
  }
};
adminRouter.put('/alerts/:id/resolve', handleResolveAlert);
adminRouter.post('/alerts/:id/resolve', handleResolveAlert);

// DELETE /admin/alerts/:id — dismiss alert
adminRouter.delete('/alerts/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params['id']!;
    const existing = await prisma.systemAlert.findUnique({ where: { id } });
    if (!existing) throw new NotFoundError('Alert not found');
    await prisma.systemAlert.delete({ where: { id } });
    await writeAdminAuditLog(req, 'ADMIN_ALERT_DISMISSED', id);
    res.json({ success: true, data: { deleted: true, id } } as ApiResponse);
  } catch (err) {
    next(err);
  }
});

// GET /admin/audit-logs — immutable audit trail
adminRouter.get('/audit-logs', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const action = req.query['action'] as string | undefined;
    const logs = await prisma.auditLog.findMany({
      where: action ? { action } : undefined,
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    res.json({ success: true, data: { logs } } as ApiResponse);
  } catch (err) {
    next(err);
  }
});

// GET /admin/settings — persisted platform settings
adminRouter.get('/settings', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const rows = await prisma.platformSetting.findMany({ orderBy: { key: 'asc' } });
    const settings: Record<string, string> = {};
    for (const r of rows) settings[r.key] = r.value;
    res.json({ success: true, data: { settings, items: rows } } as ApiResponse);
  } catch (err) {
    next(err);
  }
});

// PUT /admin/settings — update platform settings
adminRouter.put('/settings', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const updates = req.body.settings || req.body;
    if (!updates || typeof updates !== 'object' || Array.isArray(updates)) {
      throw new ValidationError('Settings object is required');
    }
    const entries = Object.entries(updates).filter(([, v]) => v !== undefined);
    await prisma.$transaction(
      entries.map(([key, value]) =>
        prisma.platformSetting.upsert({
          where: { key },
          update: { value: String(value), updatedBy: req.user!.sub },
          create: { key, value: String(value), updatedBy: req.user!.sub },
        }),
      ),
    );
    await writeAdminAuditLog(req, 'ADMIN_SETTINGS_UPDATED', 'platform_settings', { keys: entries.map(([k]) => k) });
    const rows = await prisma.platformSetting.findMany({ orderBy: { key: 'asc' } });
    const settings: Record<string, string> = {};
    for (const r of rows) settings[r.key] = r.value;
    res.json({ success: true, data: { settings, items: rows } } as ApiResponse);
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
app.use(responseTimer);
app.use(cors(getHardenedCorsOptions()));

app.use(express.json({ limit: '1mb' }));
app.use(requestLogger);

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: SERVICE_NAME, version: '1.0.0', timestamp: new Date().toISOString() });
});
app.use('/admin', adminRouter);
app.use(notFoundHandler);
app.use(errorHandler);

let server: any;
if (process.env['NODE_ENV'] !== 'test') {
  server = app.listen(PORT, () => {
    logger.info({ port: PORT, service: SERVICE_NAME }, `${SERVICE_NAME} started`);
  });
}

process.on('SIGTERM', () => {
  if (server) {
    server.close(() => process.exit(0));
  }
});

export { app, anonymizeUser };
export default app;
