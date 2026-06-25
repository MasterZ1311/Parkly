// ============================================================
// Pricing Service — Dynamic Demand-Based Pricing
// ============================================================

import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { Router, Request, Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';
import {
  authenticate,
  errorHandler,
  notFoundHandler,
  requestLogger,
  securityHeaders,
  logger,
  ApiResponse,
  PricingResult,
  NotFoundError,
} from '@parkly/shared';

const PORT = process.env['PRICING_PORT'] || 4008;
const SERVICE_NAME = 'pricing-service';
process.env['SERVICE_NAME'] = SERVICE_NAME;

const prisma = new PrismaClient();

// ============================================================
// Demand Multiplier Lookup Table
// Pure function — fully testable.
// ============================================================

export function getDemandMultiplier(arrivalTime: Date): number {
  const hour = arrivalTime.getHours();
  const dayOfWeek = arrivalTime.getDay(); // 0=Sun..6=Sat
  const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

  // Peak hours: morning rush (8-10), evening rush (17-20)
  const isPeakHour =
    (hour >= 8 && hour <= 10) || (hour >= 17 && hour <= 20);

  // Night hours: 22-6
  const isNight = hour >= 22 || hour <= 6;

  if (isWeekend && !isNight) return 1.3;
  if (isPeakHour) return 1.5;
  if (isNight) return 0.8;
  return 1.0; // standard rate
}

// ============================================================
// Pricing Service Logic
// ============================================================

const pricingService = {
  async calculatePrice(spaceId: string, arrivalTime: Date): Promise<PricingResult> {
    const space = await prisma.parkingSpace.findUnique({
      where: { id: spaceId },
      include: { pricingRules: { where: { isActive: true } } },
    });

    if (!space) throw new NotFoundError('Parking space not found');

    const baseRate = Number(space.hourlyRate);
    const appliedRules: string[] = [];
    let multiplier = 1.0;

    if (space.dynamicPricing) {
      const demandMultiplier = getDemandMultiplier(arrivalTime);
      if (demandMultiplier !== 1.0) {
        multiplier = demandMultiplier;
        appliedRules.push(`demand_multiplier_${demandMultiplier}`);
      }

      // Apply any custom pricing rules
      for (const rule of space.pricingRules) {
        if (Number(rule.multiplier) !== 1.0) {
          multiplier = Math.max(multiplier, Number(rule.multiplier));
          appliedRules.push(rule.name);
        }
      }
    }

    const effectiveRate = Math.round(baseRate * multiplier * 100) / 100;

    return {
      spaceId,
      baseRate,
      effectiveRate,
      currency: 'INR',
      multiplier,
      appliedRules,
      validUntil: new Date(Date.now() + 15 * 60 * 1000).toISOString(), // valid for 15 min
    };
  },
};

// ============================================================
// Routes
// ============================================================

const pricingRouter = Router();
pricingRouter.use(authenticate);

// GET /pricing/:spaceId?arrivalTime=ISO8601
pricingRouter.get('/:spaceId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const arrivalTime = req.query['arrivalTime']
      ? new Date(req.query['arrivalTime'] as string)
      : new Date();

    const result = await pricingService.calculatePrice(req.params['spaceId']!, arrivalTime);
    res.json({ success: true, data: result } as ApiResponse);
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
app.use('/pricing', pricingRouter);
app.use(notFoundHandler);
app.use(errorHandler);

let server: any;
if (process.env.NODE_ENV !== 'test') {
  server = app.listen(PORT, () => {
    logger.info({ port: PORT, service: SERVICE_NAME }, `${SERVICE_NAME} started`);
  });

  process.on('SIGTERM', () => {
    if (server) {
      server.close(() => process.exit(0));
    }
  });
}

export default app;
