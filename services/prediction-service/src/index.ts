// ============================================================
// Prediction Service — Rule-based + ML Stub
// Provides availability probability, confidence, and alternatives.
// ============================================================

import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { Router, Request, Response, NextFunction } from 'express';
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
  registerGracefulShutdown,
} from '@parkly/shared';

const PORT = process.env['PREDICTION_PORT'] || 4005;
const SERVICE_NAME = 'prediction-service';
process.env['SERVICE_NAME'] = SERVICE_NAME;

// ============================================================
// Rule-Based Prediction Engine
// Uses time-of-day + day-of-week patterns.
// Pluggable: can be replaced with SageMaker inference.
// ============================================================

interface TimePattern {
  hours: number[];      // peak hours
  daysOfWeek: number[]; // 0=Sun..6=Sat
  multiplier: number;   // demand multiplier
}

const PEAK_PATTERNS: TimePattern[] = [
  { hours: [8, 9, 10, 17, 18, 19, 20], daysOfWeek: [1, 2, 3, 4, 5], multiplier: 1.4 },  // weekday rush
  { hours: [11, 12, 13, 14], daysOfWeek: [0, 6], multiplier: 1.3 },                        // weekend lunch
  { hours: [21, 22, 23], daysOfWeek: [5, 6], multiplier: 1.5 },                            // weekend night
];

function getRulePrediction(
  arrivalTime: Date,
  durationMinutes: number,
): { probabilityPercent: number; confidencePercent: number } {
  const hour = arrivalTime.getHours();
  const dayOfWeek = arrivalTime.getDay();

  let demandMultiplier = 1.0;
  for (const pattern of PEAK_PATTERNS) {
    if (pattern.hours.includes(hour) && pattern.daysOfWeek.includes(dayOfWeek)) {
      demandMultiplier = Math.max(demandMultiplier, pattern.multiplier);
    }
  }

  // Longer duration = harder to find continuous availability
  const durationPenalty = Math.min(durationMinutes / 4320, 0.3);

  const baseAvailability = 1.0 / demandMultiplier;
  const probability = Math.round(Math.max(0, Math.min(100, (baseAvailability - durationPenalty) * 100)));
  const confidence = 55; // Rule-based: moderate confidence

  return { probabilityPercent: probability, confidencePercent: confidence };
}

const predictionService = {
  async predict(
    spaceIds: string[],
    arrivalTime: Date,
    durationMinutes: number,
  ): Promise<Record<string, Omit<AvailabilityPrediction, 'spaceId' | 'arrivalTime' | 'durationMinutes'>>> {
    const result: Record<string, Omit<AvailabilityPrediction, 'spaceId' | 'arrivalTime' | 'durationMinutes'>> = {};

    for (const spaceId of spaceIds) {
      const { probabilityPercent, confidencePercent } = getRulePrediction(arrivalTime, durationMinutes);

      result[spaceId] = {
        probabilityPercent,
        // Estimated vacancies: rough calculation based on probability
        estimatedVacancies: Math.max(0, Math.round(probabilityPercent / 10)),
        confidencePercent,
        insufficientData: confidencePercent === 0,
        alternatives: [],
      };
    }

    return result;
  },
};

// ============================================================
// Routes
// ============================================================

const predictionRouter = Router();
predictionRouter.use(authenticate);

// GET /predict?spaceIds=...&arrivalTime=...&duration=...
predictionRouter.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { spaceIds, arrivalTime, duration } = req.query;

    if (!spaceIds || !arrivalTime) {
      throw new Error('spaceIds and arrivalTime are required');
    }

    const ids = (spaceIds as string).split(',').filter(Boolean);
    const arrival = new Date(arrivalTime as string);
    const dur = parseInt(duration as string, 10) || 60;

    const predictions = await predictionService.predict(ids, arrival, dur);

    res.json({ success: true, data: { predictions } } as ApiResponse);
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
app.use(cors({ origin: process.env['ALLOWED_ORIGINS']?.split(',') || '*' }));
app.use(express.json({ limit: '1mb' }));
app.use(requestLogger);

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: SERVICE_NAME, version: '1.0.0', timestamp: new Date().toISOString() });
});
app.use('/', predictionRouter);
app.use(notFoundHandler);
app.use(errorHandler);

const server = app.listen(PORT, () => {
  logger.info({ port: PORT, service: SERVICE_NAME }, `${SERVICE_NAME} started`);
});

registerGracefulShutdown({ server, serviceName: SERVICE_NAME });

export default app;
