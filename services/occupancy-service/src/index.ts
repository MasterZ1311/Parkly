// ============================================================
// Occupancy Service — IoT Ingestion + DynamoDB
// ============================================================

import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { PutCommand, GetCommand } from '@aws-sdk/lib-dynamodb';
import {
  authenticate,
  requireRole,
  errorHandler,
  notFoundHandler,
  requestLogger,
  securityHeaders,
  logger,
  getConfig,
  getDocClient,
  publishEvent,
  generateId,
  ValidationError,
  ApiResponse,
  OccupancyRecord,
  CurrentOccupancy,
} from '@parkly/shared';

const PORT = process.env['OCCUPANCY_PORT'] || 4007;
const SERVICE_NAME = 'occupancy-service';
process.env['SERVICE_NAME'] = SERVICE_NAME;

// ============================================================
// Occupancy Service Logic
// ============================================================

const ingestSchema = z.object({
  spaceId: z.string().min(1),
  occupiedSlots: z.number().int().min(0),
  totalSlots: z.number().int().min(1),
  source: z.enum(['sensor', 'manual', 'simulator']),
  sensorId: z.string().optional(),
});

const occupancyService = {
  async ingest(data: z.infer<typeof ingestSchema>): Promise<CurrentOccupancy> {
    if (data.occupiedSlots > data.totalSlots) {
      throw new ValidationError('occupiedSlots cannot exceed totalSlots');
    }

    const config = getConfig();
    const timestamp = new Date().toISOString();
    const occupancyRate = data.occupiedSlots / data.totalSlots;

    // Store in DynamoDB (current occupancy + history)
    const record: OccupancyRecord = {
      spaceId: data.spaceId,
      timestamp,
      occupiedSlots: data.occupiedSlots,
      totalSlots: data.totalSlots,
      occupancyRate,
      source: data.source,
      sensorId: data.sensorId,
    };

    await getDocClient().send(
      new PutCommand({
        TableName: config.dynamoTableOccupancy,
        Item: record,
      }),
    );

    const current: CurrentOccupancy = {
      spaceId: data.spaceId,
      occupiedSlots: data.occupiedSlots,
      totalSlots: data.totalSlots,
      occupancyRate,
      lastUpdated: timestamp,
      source: data.source,
    };

    // Publish event for prediction + analytics
    await publishEvent({
      type: 'OccupancyChanged',
      version: '1.0',
      timestamp,
      source: 'parkly.occupancy-service',
      data: current,
    }).catch(() => {
      // Non-blocking: don't fail ingestion if EventBridge is down
    });

    logger.info({ spaceId: data.spaceId, occupancyRate, source: data.source }, 'Occupancy ingested');
    return current;
  },

  async getCurrentOccupancy(spaceId: string): Promise<CurrentOccupancy | null> {
    // Get the latest record (DynamoDB query by PK, sort by SK desc)
    const result = await getDocClient().send(
      new GetCommand({
        TableName: getConfig().dynamoTableOccupancy,
        Key: { spaceId },
      }),
    );

    return result.Item ? (result.Item as CurrentOccupancy) : null;
  },
};

// ============================================================
// Sensor Simulator (for dev/demo)
// ============================================================

async function runSimulator(): Promise<void> {
  const sampleSpaces = ['space-demo-1', 'space-demo-2', 'space-demo-3'];
  const interval = setInterval(async () => {
    for (const spaceId of sampleSpaces) {
      const totalSlots = 20;
      const occupiedSlots = Math.floor(Math.random() * (totalSlots + 1));
      await occupancyService.ingest({
        spaceId,
        occupiedSlots,
        totalSlots,
        source: 'simulator',
        sensorId: `sim-${spaceId}`,
      }).catch(() => {});
    }
  }, 30000); // every 30 seconds

  // Clean up on shutdown
  process.on('SIGTERM', () => clearInterval(interval));
}

// ============================================================
// Routes
// ============================================================

const occupancyRouter = Router();

// POST /occupancy/ingest — accepts sensor, manual, simulator events
occupancyRouter.post('/ingest', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = ingestSchema.safeParse(req.body);
    if (!result.success) throw new ValidationError(result.error.errors[0]?.message || 'Invalid input');
    const occupancy = await occupancyService.ingest(result.data);
    res.status(201).json({ success: true, data: occupancy } as ApiResponse);
  } catch (err) {
    next(err);
  }
});

// GET /occupancy/:spaceId — current occupancy
occupancyRouter.get('/:spaceId', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const occupancy = await occupancyService.getCurrentOccupancy(req.params['spaceId']!);
    res.json({ success: true, data: occupancy } as ApiResponse);
  } catch (err) {
    next(err);
  }
});

// POST /occupancy/simulate — trigger simulator manually
occupancyRouter.post('/simulate', requireRole('admin'), (_req: Request, res: Response) => {
  runSimulator().catch(() => {});
  res.json({ success: true, data: { message: 'Simulator started' } } as ApiResponse);
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
app.use('/occupancy', occupancyRouter);
app.use(notFoundHandler);
app.use(errorHandler);

const server = app.listen(PORT, () => {
  logger.info({ port: PORT, service: SERVICE_NAME }, `${SERVICE_NAME} started`);
  // Auto-start simulator in dev
  if (process.env['NODE_ENV'] === 'development') {
    runSimulator().catch(() => {});
    logger.info('Occupancy simulator started');
  }
});

process.on('SIGTERM', () => {
  server.close(() => process.exit(0));
});

export default app;
