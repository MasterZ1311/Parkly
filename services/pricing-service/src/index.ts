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
  optionalAuthenticate,
  errorHandler,
  notFoundHandler,
  requestLogger,
  responseTimer,
  securityHeaders,
  logger,
  ApiResponse,
  PricingResult,
  NotFoundError,
  getHardenedCorsOptions,
} from '@parkly/shared';
import {
  DynamicPricingAgent,
  IPricingEngineTool,
  PricingCalculationParams,
  PricingResult as AgentPricingResult,
  ExecutionContext,
  ok,
  err,
  AgentError,
  Result,
} from '@parkly/ai-agents';

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

class LivePricingEngineProvider implements IPricingEngineTool {
  async calculateSurge(
    params: PricingCalculationParams,
  ): Promise<Result<AgentPricingResult, AgentError>> {
    const { baseHourlyRate, currentOccupancyRate, hostPricingPreferences } = params;
    if (baseHourlyRate <= 0) {
      return err(AgentError.validation('baseHourlyRate must be greater than 0'));
    }
    const allowDynamic = hostPricingPreferences?.allowDynamic ?? true;
    const maxMultiplier = hostPricingPreferences?.maxMultiplier ?? 2.0;

    if (!allowDynamic) {
      return ok({
        spaceId: params.spaceId,
        calculatedHourlyRate: baseHourlyRate,
        appliedMultiplier: 1.0,
        surgeReason: 'DYNAMIC_DISABLED_BY_HOST',
        effectiveFrom: new Date().toISOString(),
        effectiveUntil: new Date(Date.now() + 900000).toISOString(),
      });
    }

    // Factor in active DB pricing rules + live occupancy rate + time-of-day demand
    let multiplier = getDemandMultiplier(new Date());
    let reason = multiplier > 1.0 ? 'PEAK_TIME_DEMAND' : 'BASELINE_DEMAND';

    if (currentOccupancyRate >= 0.9) {
      multiplier = Math.max(multiplier, 1.6);
      reason = 'PEAK_OCCUPANCY_SURGE';
    } else if (currentOccupancyRate >= 0.75) {
      multiplier = Math.max(multiplier, 1.25);
      reason = 'HIGH_OCCUPANCY_SURGE';
    }

    try {
      const rules = await prisma.pricingRule.findMany({
        where: { isActive: true, OR: [{ spaceId: params.spaceId }, { spaceId: null }] },
      });
      for (const rule of rules) {
        const ruleMult = Number(rule.multiplier);
        if (ruleMult > multiplier) {
          multiplier = ruleMult;
          reason = rule.name;
        }
      }
    } catch {
      // Non-blocking if DB rules query fails in isolated tests
    }

    const clamped = Math.min(Math.max(multiplier, 1.0), maxMultiplier);
    return ok({
      spaceId: params.spaceId,
      calculatedHourlyRate: Math.round(baseHourlyRate * clamped * 100) / 100,
      appliedMultiplier: clamped,
      surgeReason: reason,
      effectiveFrom: new Date().toISOString(),
      effectiveUntil: new Date(Date.now() + 900000).toISOString(),
    });
  }
}

const pricingRouter = Router();

// Autonomous Dynamic Pricing Agent backed by Prisma rules & occupancy
const dynamicPricingAgent = new DynamicPricingAgent({
  pricingEngineTool: new LivePricingEngineProvider(),
});

// POST /pricing/ai-quote — Real-time AI dynamic pricing with surge evaluation
pricingRouter.post('/ai-quote', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { spaceId, currentOccupancyRate, demandForecastTier } = req.body;
    if (!spaceId) throw new NotFoundError('spaceId is required');

    const space = await prisma.parkingSpace.findUnique({
      where: { id: spaceId },
    });
    if (!space) throw new NotFoundError('Parking space not found');

    const ctx = ExecutionContext.create({
      correlationId: (req.headers['x-correlation-id'] as string) || `pricing-${Date.now()}`,
      metadata: { service: 'pricing-service' },
    });

    const agentResult = await dynamicPricingAgent.execute({
      spaceId,
      baseHourlyRate: Number(space.hourlyRate),
      currentOccupancyRate: typeof currentOccupancyRate === 'number' ? currentOccupancyRate : 0.75,
      demandForecastTier: demandForecastTier || 'HIGH_DEMAND',
      hostPricingPreferences: {
        allowDynamic: space.dynamicPricing,
        maxMultiplier: 2.5,
      },
    }, ctx);

    if (!agentResult.success) {
      return next(new Error(agentResult.error.message));
    }

    res.json({
      success: true,
      data: {
        spaceId,
        baseHourlyRate: Number(space.hourlyRate),
        calculatedHourlyRate: agentResult.data.calculatedHourlyRate,
        appliedMultiplier: agentResult.data.appliedMultiplier,
        surgeReason: agentResult.data.surgeReason,
        effectiveFrom: agentResult.data.effectiveFrom,
        effectiveUntil: agentResult.data.effectiveUntil,
        currency: 'INR',
      },
    } as ApiResponse);
  } catch (err) {
    next(err);
  }
});

// GET /pricing/:spaceId?arrivalTime=ISO8601 (public discovery)
pricingRouter.get('/:spaceId', optionalAuthenticate, async (req: Request, res: Response, next: NextFunction) => {
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
app.use(responseTimer);
app.use(cors(getHardenedCorsOptions()));

app.use(express.json({ limit: '1mb' }));
app.use(requestLogger);

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: SERVICE_NAME, version: '1.0.0', timestamp: new Date().toISOString() });
});
app.use('/pricing', pricingRouter);
app.use(notFoundHandler);
app.use(errorHandler);

let server: any;
if (process.env['NODE_ENV'] !== 'test') {
  server = app.listen(PORT, () => {
    logger.info({ port: PORT, service: SERVICE_NAME }, `${SERVICE_NAME} started`);
  });

  process.on('SIGTERM', () => {
    if (server) {
      server.close(() => process.exit(0));
    }
  });
}

export { app, pricingService };
export default app;
