// ============================================================
// Host Service — Listing CRUD + S3 Photo Upload
// ============================================================

import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { PrismaClient } from '@prisma/client';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import {
  authenticate,
  requireRole,
  errorHandler,
  notFoundHandler,
  requestLogger,
  securityHeaders,
  logger,
  getConfig,
  getS3Client,
  encodeGeohash,
  generateId,
  publishEvent,
  ValidationError,
  NotFoundError,
  AuthorizationError,
  ApiResponse,
  ParkingSpace,
} from '@parkly/shared';

const PORT = process.env['HOST_PORT'] || 4010;
const SERVICE_NAME = 'host-service';
process.env['SERVICE_NAME'] = SERVICE_NAME;

const prisma = new PrismaClient();

// ============================================================
// Host Service Logic
// ============================================================

const listingSchema = z.object({
  name: z.string().min(3).max(100),
  description: z.string().max(1000).optional(),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  address: z.string().min(5).max(500),
  city: z.string().min(1),
  state: z.string().min(1),
  pincode: z.string().length(6),
  totalCapacity: z.number().int().min(1).max(1000),
  vehicleTypes: z.array(z.enum(['motorcycle', 'compact', 'sedan', 'suv', 'van', 'truck'])).min(1),
  evCharging: z.boolean().default(false),
  covered: z.boolean().default(false),
  securityLevel: z.enum(['none', 'basic', 'monitored', 'staffed', 'gated']).default('none'),
  accessibility: z.array(z.enum(['wheelchair_accessible', 'step_free', 'wide_bays', 'accessible_payment'])).default([]),
  hourlyRate: z.number().positive().max(10000),
  dynamicPricing: z.boolean().default(false),
  minBookingHours: z.number().int().min(1).default(1),
  maxBookingHours: z.number().int().max(72).default(24),
  availabilitySchedule: z.array(z.object({
    dayOfWeek: z.number().int().min(0).max(6),
    startTime: z.string().regex(/^\d{2}:\d{2}$/),
    endTime: z.string().regex(/^\d{2}:\d{2}$/),
  })).optional(),
});

const hostService = {
  async getOrCreateHost(userId: string): Promise<{ id: string }> {
    let host = await prisma.host.findUnique({ where: { userId } });
    if (!host) {
      host = await prisma.host.create({
        data: { id: generateId(), userId, verificationStatus: 'pending', totalEarnings: 0, totalPayouts: 0 },
      });
    }
    return host;
  },

  async createListing(userId: string, data: z.infer<typeof listingSchema>): Promise<ParkingSpace> {
    const host = await this.getOrCreateHost(userId);
    const geohash = encodeGeohash(data.latitude, data.longitude, 7);

    const space = await prisma.parkingSpace.create({
      data: {
        id: generateId(),
        hostId: host.id,
        name: data.name,
        description: data.description || null,
        latitude: data.latitude,
        longitude: data.longitude,
        geohash,
        address: data.address,
        city: data.city,
        state: data.state,
        pincode: data.pincode,
        regionId: data.city.toLowerCase().replace(/\s+/g, '-'),
        totalCapacity: data.totalCapacity,
        vehicleTypes: data.vehicleTypes,
        evCharging: data.evCharging,
        covered: data.covered,
        securityLevel: data.securityLevel,
        accessibility: data.accessibility,
        hourlyRate: data.hourlyRate,
        dynamicPricing: data.dynamicPricing,
        minBookingHours: data.minBookingHours,
        maxBookingHours: data.maxBookingHours,
        photoUrls: [],
        status: 'draft',
      },
    });

    // Create availability slots
    if (data.availabilitySchedule?.length) {
      await prisma.availabilitySlot.createMany({
        data: data.availabilitySchedule.map(slot => ({
          id: generateId(),
          spaceId: space.id,
          dayOfWeek: slot.dayOfWeek,
          startTime: slot.startTime,
          endTime: slot.endTime,
        })),
      });
    }

    await publishEvent({
      type: 'HostVerificationRequested',
      version: '1.0',
      timestamp: new Date().toISOString(),
      source: 'parkly.host-service',
      data: { spaceId: space.id, hostId: host.id },
    });

    return mapSpace(space);
  },

  async getHostListings(userId: string): Promise<ParkingSpace[]> {
    const host = await prisma.host.findUnique({ where: { userId } });
    if (!host) return [];
    const spaces = await prisma.parkingSpace.findMany({ where: { hostId: host.id } });
    return spaces.map(mapSpace);
  },

  async getPresignedUploadUrl(spaceId: string, filename: string): Promise<string> {
    const config = getConfig();
    const key = `spaces/${spaceId}/${generateId()}-${filename}`;
    const command = new PutObjectCommand({
      Bucket: config.s3BucketUploads,
      Key: key,
      ContentType: 'image/jpeg',
    });
    return getSignedUrl(getS3Client(), command, { expiresIn: 300 });
  },
};

function mapSpace(raw: Record<string, unknown>): ParkingSpace {
  return {
    id: raw['id'] as string,
    hostId: raw['hostId'] as string,
    name: raw['name'] as string,
    description: raw['description'] as string | undefined,
    coordinates: { lat: Number(raw['latitude']), lng: Number(raw['longitude']) },
    geohash: raw['geohash'] as string,
    address: raw['address'] as string,
    city: raw['city'] as string,
    state: raw['state'] as string,
    pincode: raw['pincode'] as string,
    regionId: raw['regionId'] as string,
    totalCapacity: raw['totalCapacity'] as number,
    vehicleTypes: raw['vehicleTypes'] as ParkingSpace['vehicleTypes'],
    amenities: {
      evCharging: raw['evCharging'] as boolean,
      covered: raw['covered'] as boolean,
      securityLevel: raw['securityLevel'] as ParkingSpace['amenities']['securityLevel'],
      accessibility: raw['accessibility'] as ParkingSpace['amenities']['accessibility'],
      cctv: raw['cctv'] as boolean,
      lighting: raw['lighting'] as boolean,
      attendant: raw['attendant'] as boolean,
    },
    pricing: {
      hourlyRate: Number(raw['hourlyRate']),
      currency: 'INR',
      dynamicPricingEnabled: raw['dynamicPricing'] as boolean,
      minBookingHours: raw['minBookingHours'] as number,
      maxBookingHours: raw['maxBookingHours'] as number,
    },
    availabilitySchedule: [],
    photoUrls: raw['photoUrls'] as string[],
    status: raw['status'] as ParkingSpace['status'],
    createdAt: (raw['createdAt'] as Date).toISOString(),
    updatedAt: (raw['updatedAt'] as Date).toISOString(),
  };
}

// ============================================================
// Routes
// ============================================================

const hostRouter = Router();
hostRouter.use(authenticate);

// GET /host/listings
hostRouter.get('/listings', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const listings = await hostService.getHostListings(req.user!.sub);
    res.json({ success: true, data: listings } as ApiResponse);
  } catch (err) {
    next(err);
  }
});

// POST /host/listings
hostRouter.post('/listings', requireRole('host', 'admin'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = listingSchema.safeParse(req.body);
    if (!result.success) throw new ValidationError(result.error.errors[0]?.message || 'Invalid input');
    const listing = await hostService.createListing(req.user!.sub, result.data);
    res.status(201).json({ success: true, data: listing } as ApiResponse);
  } catch (err) {
    next(err);
  }
});

// GET /host/listings/:id/upload-url — get S3 presigned upload URL
hostRouter.post('/listings/:id/upload-url', requireRole('host', 'admin'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { filename } = req.body;
    if (!filename || typeof filename !== 'string') throw new ValidationError('filename is required');
    const url = await hostService.getPresignedUploadUrl(req.params['id']!, filename);
    res.json({ success: true, data: { uploadUrl: url } } as ApiResponse);
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
app.use(express.json({ limit: '2mb' }));
app.use(requestLogger);

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: SERVICE_NAME, version: '1.0.0', timestamp: new Date().toISOString() });
});
app.use('/host', hostRouter);
app.use(notFoundHandler);
app.use(errorHandler);

const server = app.listen(PORT, () => {
  logger.info({ port: PORT, service: SERVICE_NAME }, `${SERVICE_NAME} started`);
});

process.on('SIGTERM', () => {
  server.close(() => process.exit(0));
});

export default app;
