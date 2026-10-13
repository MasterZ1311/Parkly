// ============================================================
// Prediction Service — Predictive Vacancy & Driver Concierge
// Uses OccupancyPredictorAgent and DriverConciergeAgent
// ============================================================

import 'dotenv/config';
import express, { Router, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { z } from 'zod';
import {
  authenticate,
  errorHandler,
  notFoundHandler,
  requestLogger,
  responseTimer,
  securityHeaders,
  logger,
  ApiResponse,
  AvailabilityPrediction,
  ValidationError,
  generateId,
  registerGracefulShutdown,
} from '@parkly/shared';
import {
  OccupancyPredictorAgent,
  DriverConciergeAgent,
  MockOccupancyQueryProvider,
  MockSearchServiceProvider,
  MockBookingServiceProvider,
  MockTrafficMonitorProvider,
  ExecutionContext,
} from '@parkly/ai-agents';

const PORT = process.env['PREDICTION_PORT'] || 4005;
const SERVICE_NAME = 'prediction-service';
process.env['SERVICE_NAME'] = SERVICE_NAME;

// ============================================================
// Initialize Autonomous Agents
// ============================================================

const occupancyPredictorAgent = new OccupancyPredictorAgent({
  occupancyTool: new MockOccupancyQueryProvider(),
});

const driverConciergeAgent = new DriverConciergeAgent({
  searchTool: new MockSearchServiceProvider(),
  bookingTool: new MockBookingServiceProvider(),
  trafficTool: new MockTrafficMonitorProvider(),
});

// ============================================================
// Legacy Rule-Based Fallback Calculation
// ============================================================

interface TimePattern {
  hours: number[];
  daysOfWeek: number[];
  multiplier: number;
}

const PEAK_PATTERNS: TimePattern[] = [
  { hours: [8, 9, 10, 17, 18, 19, 20], daysOfWeek: [1, 2, 3, 4, 5], multiplier: 1.4 },
  { hours: [11, 12, 13, 14], daysOfWeek: [0, 6], multiplier: 1.3 },
  { hours: [21, 22, 23], daysOfWeek: [5, 6], multiplier: 1.5 },
];

function getRulePrediction(
  arrivalTime: Date,
  durationMinutes: number
): { probabilityPercent: number; confidencePercent: number } {
  const hour = arrivalTime.getHours();
  const dayOfWeek = arrivalTime.getDay();

  let demandMultiplier = 1.0;
  for (const pattern of PEAK_PATTERNS) {
    if (pattern.hours.includes(hour) && pattern.daysOfWeek.includes(dayOfWeek)) {
      demandMultiplier = Math.max(demandMultiplier, pattern.multiplier);
    }
  }

  const durationPenalty = Math.min(durationMinutes / 4320, 0.3);
  const baseAvailability = 1.0 / demandMultiplier;
  const probability = Math.round(Math.max(0, Math.min(100, (baseAvailability - durationPenalty) * 100)));
  const confidence = 55;

  return { probabilityPercent: probability, confidencePercent: confidence };
}

// ============================================================
// Schemas
// ============================================================

const singlePredictionSchema = z.object({
  spaceId: z.string().min(1, 'spaceId is required'),
  targetArrivalTime: z.string().optional(),
  targetDurationMinutes: z.number().int().positive().optional().default(60),
  userCurrentLocation: z
    .object({
      latitude: z.number().min(-90).max(90),
      longitude: z.number().min(-180).max(180),
    })
    .optional(),
});

const conciergeQuerySchema = z.object({
  driverId: z.string().min(1).optional(),
  query: z.string().min(1, 'query is required'),
  currentLocation: z
    .object({
      latitude: z.number().min(-90).max(90),
      longitude: z.number().min(-180).max(180),
    })
    .default({ latitude: 13.0418, longitude: 80.2341 }), // Default to Chennai center (T Nagar)
});

// ============================================================
// Routes
// ============================================================

const router = Router();

// 1. POST /predict/occupancy — Run OccupancyPredictorAgent
router.post('/occupancy', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const parseResult = singlePredictionSchema.safeParse(req.body);
    if (!parseResult.success) {
      throw new ValidationError(parseResult.error.errors[0]?.message || 'Invalid input');
    }

    const { spaceId, targetArrivalTime, targetDurationMinutes, userCurrentLocation } = parseResult.data;
    const arrivalTime = targetArrivalTime || new Date().toISOString();

    const ctx = ExecutionContext.create({
      correlationId: (req.headers['x-correlation-id'] as string) || generateId(),
      initiatorUserId: req.user?.sub || 'anonymous-user',
      metadata: { service: SERVICE_NAME },
    });

    const result = await occupancyPredictorAgent.execute(
      {
        spaceId,
        targetArrivalTime: arrivalTime,
        targetDurationMinutes,
        userCurrentLocation,
      },
      ctx
    );

    if (!result.success) {
      // Return gracefully with fallback heuristic if agent execution fails
      const fallback = getRulePrediction(new Date(arrivalTime), targetDurationMinutes);
      res.json({
        success: true,
        data: {
          spaceId,
          arrivalProbability: fallback.probabilityPercent / 100,
          confidenceScore: fallback.confidencePercent / 100,
          estimatedAvailableSlots: Math.max(1, Math.round(fallback.probabilityPercent / 20)),
          demandTier: 'MODERATE',
          contextualFactors: ['RuleBasedFallbackActivated'],
          fallback: true,
        },
      } as ApiResponse);
      return;
    }

    res.json({
      success: true,
      data: result.data,
    } as ApiResponse);
  } catch (err) {
    next(err);
  }
});

// 2. GET /predict/occupancy/:spaceId — Single space prediction lookup
router.get('/occupancy/:spaceId', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const spaceId = req.params['spaceId']!;
    const duration = parseInt(req.query['duration'] as string, 10) || 60;
    const arrivalTime = (req.query['arrivalTime'] as string) || new Date().toISOString();

    let userCurrentLocation: { latitude: number; longitude: number } | undefined;
    if (req.query['lat'] && req.query['lng']) {
      userCurrentLocation = {
        latitude: parseFloat(req.query['lat'] as string),
        longitude: parseFloat(req.query['lng'] as string),
      };
    }

    const ctx = ExecutionContext.create({
      correlationId: (req.headers['x-correlation-id'] as string) || generateId(),
      initiatorUserId: req.user?.sub || 'anonymous-user',
      metadata: { service: SERVICE_NAME },
    });

    const result = await occupancyPredictorAgent.execute(
      {
        spaceId,
        targetArrivalTime: arrivalTime,
        targetDurationMinutes: duration,
        userCurrentLocation,
      },
      ctx
    );

    if (!result.success) {
      const fallback = getRulePrediction(new Date(arrivalTime), duration);
      res.json({
        success: true,
        data: {
          spaceId,
          arrivalProbability: fallback.probabilityPercent / 100,
          confidenceScore: fallback.confidencePercent / 100,
          estimatedAvailableSlots: Math.max(1, Math.round(fallback.probabilityPercent / 20)),
          demandTier: 'MODERATE',
          contextualFactors: ['RuleBasedFallbackActivated'],
          fallback: true,
        },
      } as ApiResponse);
      return;
    }

    res.json({
      success: true,
      data: result.data,
    } as ApiResponse);
  } catch (err) {
    next(err);
  }
});

// 3. GET /predict (or /) — Batch prediction endpoint (called by Search Service)
router.get('/', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { spaceIds, arrivalTime, duration } = req.query;

    if (!spaceIds || !arrivalTime) {
      throw new ValidationError('spaceIds and arrivalTime are required');
    }

    const ids = (spaceIds as string).split(',').map((s) => s.trim()).filter(Boolean);
    const arrival = new Date(arrivalTime as string);
    const dur = parseInt(duration as string, 10) || 60;

    const predictions: Record<
      string,
      Omit<AvailabilityPrediction, 'spaceId' | 'arrivalTime' | 'durationMinutes'>
    > = {};

    for (const spaceId of ids) {
      const { probabilityPercent, confidencePercent } = getRulePrediction(arrival, dur);
      predictions[spaceId] = {
        probabilityPercent,
        estimatedVacancies: Math.max(0, Math.round(probabilityPercent / 10)),
        confidencePercent,
        insufficientData: confidencePercent === 0,
        alternatives: [],
      };
    }

    res.json({
      success: true,
      data: { predictions },
    } as ApiResponse);
  } catch (err) {
    next(err);
  }
});

// 4. POST /predict/concierge (and POST /concierge) — Driver Concierge Natural Language Assistant
router.post('/concierge', authenticate, async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const parseResult = conciergeQuerySchema.safeParse(req.body);
    if (!parseResult.success) {
      throw new ValidationError(parseResult.error.errors[0]?.message || 'Invalid concierge query input');
    }

    const { driverId, query, currentLocation } = parseResult.data;
    const effectiveDriverId = driverId || req.user?.sub || 'driver-chennai-001';

    const ctx = ExecutionContext.create({
      correlationId: (req.headers['x-correlation-id'] as string) || generateId(),
      initiatorUserId: effectiveDriverId,
      metadata: { service: SERVICE_NAME, channel: 'mobile-concierge' },
    });

    const result = await driverConciergeAgent.execute(
      {
        driverId: effectiveDriverId,
        query,
        currentLocation,
      },
      ctx
    );

    if (!result.success) {
      res.status(400).json({
        success: false,
        error: {
          code: result.error.code,
          message: result.error.message,
        },
      } as ApiResponse);
      return;
    }

    res.json({
      success: true,
      data: result.data,
    } as ApiResponse);
  } catch (err) {
    next(err);
  }
});

// ============================================================
// App Configuration & Server
// ============================================================

const app = express();
app.use(helmet({ contentSecurityPolicy: false }));
app.use(securityHeaders);
app.use(responseTimer);
app.use(cors({ origin: process.env['ALLOWED_ORIGINS']?.split(',') || '*' }));
app.use(express.json({ limit: '2mb' }));
app.use(requestLogger);

// Health check endpoint
app.get('/health', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    service: SERVICE_NAME,
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    agents: {
      occupancyPredictor: 'READY',
      driverConcierge: 'READY',
    },
  });
});

// Mount routes on root and /predict
app.use('/predict', router);
app.use('/', router);

app.use(notFoundHandler);
app.use(errorHandler);

const server = app.listen(PORT, () => {
  logger.info({ port: PORT, service: SERVICE_NAME }, `${SERVICE_NAME} started`);
});

registerGracefulShutdown({ server, serviceName: SERVICE_NAME });

export default app;
