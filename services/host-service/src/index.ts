// ============================================================
// Host Service — Listing CRUD + S3 Photo Upload + Host Ops
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
  responseTimer,
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
  ConflictError,
  ApiResponse,
  ParkingSpace,
  getHardenedCorsOptions,
} from '@parkly/shared';
import {
  HostOnboardingAgent,
  VisualInspectionAgent,
  RealOCRProvider,
  RealGeocodingProvider,
  RealVisionProvider,
  MockZoningProvider,
  ExecutionContext,
} from '@parkly/ai-agents';

const PORT = process.env['HOST_PORT'] || 4010;
const SERVICE_NAME = 'host-service';
process.env['SERVICE_NAME'] = SERVICE_NAME;

const prisma = new PrismaClient();

// ============================================================
// Host Service Logic
// ============================================================

const baseListingSchema = z.object({
  name: z.string().trim().min(3).max(100),
  description: z.string().max(1000).optional(),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  address: z.string().trim().min(5).max(500),
  city: z.string().trim().min(1),
  state: z.string().trim().min(1),
  pincode: z.string().trim().length(6),
  regionId: z.string().trim().min(1).max(64).optional(),
  totalCapacity: z.number().int().min(1).max(1000),
  vehicleTypes: z.array(z.enum(['motorcycle', 'compact', 'sedan', 'suv', 'van', 'truck'])).min(1),
  spaceType: z.enum(['commercial', 'private_house', 'apartment_bay', 'gated_compound']).default('commercial'),
  entryInstructions: z.string().trim().max(500).optional(),
  evCharging: z.boolean().default(false),
  covered: z.boolean().default(false),
  securityLevel: z.enum(['none', 'basic', 'monitored', 'staffed', 'gated']).default('none'),
  accessibility: z.array(z.enum(['wheelchair_accessible', 'step_free', 'wide_bays', 'accessible_payment'])).default([]),
  hourlyRate: z.number().positive().max(10000),
  dynamicPricing: z.boolean().default(false),
  minBookingHours: z.number().int().min(1).default(1),
  maxBookingHours: z.number().int().min(1).max(72).default(24),
  photoUrls: z.array(z.string().trim().min(1).max(1000)).max(12).optional(),
  ownershipProofUrl: z.string().trim().max(1000).optional(),
  availabilitySchedule: z.array(z.object({
    dayOfWeek: z.number().int().min(0).max(6),
    startTime: z.string().regex(/^\d{2}:\d{2}$/),
    endTime: z.string().regex(/^\d{2}:\d{2}$/),
  })).optional(),
});

const hostKycSchema = z.object({
  kycFullName: z.string().trim().min(2, 'Owner full legal name is required').max(120),
  kycPhone: z.string().trim().min(7).max(25).optional(),
  businessName: z.string().trim().max(120).optional(),
  panNumber: z.string().trim().max(20).optional(),
  govIdType: z.enum(['aadhaar', 'pan', 'passport', 'voter_id']),
  govIdNumberMasked: z.string().trim().min(4, 'Government ID number is required').max(40),
  govIdDocumentUrl: z.string().trim().min(3, 'Government ID document is required').max(1000),
  ownershipProofType: z.enum([
    'property_tax',
    'electricity_bill',
    'sale_deed',
    'noc_society',
    'rental_agreement',
  ]),
  ownershipDocumentUrl: z.string().trim().min(3, 'Ownership or utility proof is required').max(1000),
  addressProofUrl: z.string().trim().max(1000).optional(),
  plotPhotoUrls: z
    .array(z.string().trim().min(1).max(1000))
    .min(1, 'Upload at least one picture of the parking plot/driveway')
    .max(10),
  bankAccountNumber: z.string().trim().max(60).optional(),
  ifscCode: z.string().trim().max(20).optional(),
  upiId: z.string().trim().max(80).optional(),
  kycNotes: z.string().trim().max(500).optional(),
});

const listingSchema = baseListingSchema.refine((val) => val.maxBookingHours >= val.minBookingHours, {
  message: 'maxBookingHours must be greater than or equal to minBookingHours',
  path: ['maxBookingHours'],
});

const updateListingSchema = baseListingSchema
  .extend({
    status: z.enum(['active', 'inactive']).optional(),
  })
  .partial()
  .refine(
    (val) =>
      val.minBookingHours === undefined ||
      val.maxBookingHours === undefined ||
      val.maxBookingHours >= val.minBookingHours,
    {
      message: 'maxBookingHours must be greater than or equal to minBookingHours',
      path: ['maxBookingHours'],
    },
  );

const payoutSchema = z.object({
  amount: z.number().positive().max(1000000),
});

export async function resolveRegionForListing(
  db: Pick<PrismaClient, 'region'>,
  city: string,
  requestedRegionId?: string,
): Promise<string> {
  const trimmedCity = city.trim();
  const trimmedRegionId = requestedRegionId?.trim();

  if (trimmedRegionId) {
    const explicitRegion = await db.region.findFirst({
      where: { id: trimmedRegionId, isActive: true },
      select: { id: true },
    });
    if (!explicitRegion) {
      throw new ValidationError(
        `Unsupported or inactive regionId "${trimmedRegionId}".`,
        'regionId',
      );
    }
    return explicitRegion.id;
  }

  const citySlug = trimmedCity.toLowerCase().replace(/\s+/g, '-');
  // Resolve exact city / slug match before prefix fallback so sub-region prefixes cannot shadow canonical region rows.
  const exactRegion = await db.region.findFirst({
    where: {
      isActive: true,
      OR: [
        { city: { equals: trimmedCity, mode: 'insensitive' } },
        { id: citySlug },
      ],
    },
    orderBy: { id: 'asc' },
    select: { id: true },
  });

  if (exactRegion) {
    return exactRegion.id;
  }

  const prefixRegion = await db.region.findFirst({
    where: {
      isActive: true,
      id: { startsWith: `${citySlug}-`, mode: 'insensitive' },
    },
    orderBy: { id: 'asc' },
    select: { id: true },
  });

  if (!prefixRegion) {
    throw new ValidationError(
      `Unsupported or inactive region for city "${trimmedCity}".`,
      'city',
    );
  }

  return prefixRegion.id;
}

async function writeHostAuditLog(
  actorId: string,
  action: string,
  target: string,
  metadata?: Record<string, unknown>,
  ipAddress?: string,
) {
  try {
    await prisma.auditLog.create({
      data: {
        actorId,
        actorName: `host:${actorId.slice(0, 8)}`,
        action,
        target,
        ipAddress: ipAddress || null,
        metadata: (metadata || {}) as any,
      },
    });
  } catch (err) {
    logger.warn({ err, action, target }, 'Failed to persist host audit log');
  }
}

async function verifySpaceAccess(spaceId: string, user: { sub: string; role: string }) {
  const space = await prisma.parkingSpace.findUnique({
    where: { id: spaceId },
    include: { host: true, availabilitySlots: true },
  });
  if (!space) {
    throw new NotFoundError('Listing not found');
  }
  if (space.host.userId !== user.sub && user.role !== 'admin') {
    throw new AuthorizationError('Not authorized to access this listing');
  }
  return space;
}

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
    const regionId = await resolveRegionForListing(prisma, data.city, data.regionId);
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
        regionId,
        totalCapacity: data.totalCapacity,
        vehicleTypes: data.vehicleTypes,
        spaceType: data.spaceType,
        entryInstructions: data.entryInstructions || null,
        evCharging: data.evCharging,
        covered: data.covered,
        securityLevel: data.securityLevel,
        accessibility: data.accessibility,
        hourlyRate: data.hourlyRate,
        dynamicPricing: data.dynamicPricing,
        minBookingHours: data.minBookingHours,
        maxBookingHours: data.maxBookingHours,
        photoUrls: data.photoUrls || [],
        ownershipProofUrl: data.ownershipProofUrl || null,
        status: 'pending_verification',
      },
    });

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

    await writeHostAuditLog(userId, 'HOST_LISTING_CREATED', space.id, {
      name: space.name,
      city: space.city,
      hourlyRate: Number(space.hourlyRate),
    });

    return mapSpace(space);
  },

  async getHostListings(userId: string): Promise<ParkingSpace[]> {
    const host = await prisma.host.findUnique({ where: { userId } });
    if (!host) return [];
    const spaces = await prisma.parkingSpace.findMany({
      where: { hostId: host.id, status: { not: 'suspended' } },
      include: { availabilitySlots: true },
      orderBy: { createdAt: 'desc' },
    });
    return spaces.map(mapSpace);
  },

  async updateListing(
    spaceId: string,
    user: { sub: string; role: string },
    data: z.infer<typeof updateListingSchema>,
  ): Promise<ParkingSpace> {
    const existing = await verifySpaceAccess(spaceId, user);
    const lat = data.latitude ?? Number(existing.latitude);
    const lng = data.longitude ?? Number(existing.longitude);
    const geohash = (data.latitude !== undefined || data.longitude !== undefined)
      ? encodeGeohash(lat, lng, 7)
      : existing.geohash;

    const resolvedRegionId = (data.city !== undefined || data.regionId !== undefined)
      ? await resolveRegionForListing(prisma, data.city ?? existing.city, data.regionId)
      : undefined;

    if (data.status !== undefined && !['active', 'inactive'].includes(existing.status)) {
      throw new ValidationError('Only verified active or paused spaces can toggle availability', 'status');
    }

    const updated = await prisma.parkingSpace.update({
      where: { id: spaceId },
      data: {
        ...(data.name !== undefined ? { name: data.name } : {}),
        ...(data.description !== undefined ? { description: data.description } : {}),
        ...(data.latitude !== undefined ? { latitude: data.latitude } : {}),
        ...(data.longitude !== undefined ? { longitude: data.longitude } : {}),
        geohash,
        ...(data.address !== undefined ? { address: data.address } : {}),
        ...(data.city !== undefined ? { city: data.city } : {}),
        ...(resolvedRegionId !== undefined ? { regionId: resolvedRegionId } : {}),
        ...(data.state !== undefined ? { state: data.state } : {}),
        ...(data.pincode !== undefined ? { pincode: data.pincode } : {}),
        ...(data.totalCapacity !== undefined ? { totalCapacity: data.totalCapacity } : {}),
        ...(data.vehicleTypes !== undefined ? { vehicleTypes: data.vehicleTypes } : {}),
        ...(data.spaceType !== undefined ? { spaceType: data.spaceType } : {}),
        ...(data.entryInstructions !== undefined ? { entryInstructions: data.entryInstructions || null } : {}),
        ...(data.status !== undefined ? { status: data.status } : {}),
        ...(data.evCharging !== undefined ? { evCharging: data.evCharging } : {}),
        ...(data.covered !== undefined ? { covered: data.covered } : {}),
        ...(data.securityLevel !== undefined ? { securityLevel: data.securityLevel } : {}),
        ...(data.accessibility !== undefined ? { accessibility: data.accessibility } : {}),
        ...(data.hourlyRate !== undefined ? { hourlyRate: data.hourlyRate } : {}),
        ...(data.dynamicPricing !== undefined ? { dynamicPricing: data.dynamicPricing } : {}),
        ...(data.minBookingHours !== undefined ? { minBookingHours: data.minBookingHours } : {}),
        ...(data.maxBookingHours !== undefined ? { maxBookingHours: data.maxBookingHours } : {}),
        ...(data.photoUrls !== undefined ? { photoUrls: data.photoUrls } : {}),
        ...(data.ownershipProofUrl !== undefined ? { ownershipProofUrl: data.ownershipProofUrl || null } : {}),
      },
      include: { availabilitySlots: true },
    });

    await writeHostAuditLog(user.sub, 'HOST_LISTING_UPDATED', spaceId, {
      fields: Object.keys(data),
    });

    return mapSpace(updated);
  },

  async deleteListing(spaceId: string, user: { sub: string; role: string }) {
    await verifySpaceAccess(spaceId, user);
    const activeCount = await prisma.booking.count({
      where: {
        spaceId,
        status: { in: ['created', 'confirmed', 'active'] },
        endTime: { gt: new Date() },
      },
    });
    if (activeCount > 0) {
      throw new ConflictError(`Cannot delete listing with ${activeCount} active or upcoming bookings`);
    }

    await prisma.parkingSpace.update({
      where: { id: spaceId },
      data: { status: 'suspended' },
    });

    await writeHostAuditLog(user.sub, 'HOST_LISTING_DELETED', spaceId);
    return { id: spaceId, deleted: true };
  },

  async getHostBookings(userId: string, status?: string) {
    const host = await prisma.host.findUnique({ where: { userId } });
    if (!host) return [];
    const where: any = { space: { hostId: host.id } };
    if (status && status !== 'all') {
      where.status = status;
    }
    return prisma.booking.findMany({
      where,
      include: {
        space: { select: { id: true, name: true, address: true, city: true, spaceType: true, entryInstructions: true, hourlyRate: true } },
        vehicle: { select: { id: true, licensePlate: true, vehicleType: true } },
        user: { select: { id: true, name: true, phone: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  },

  async getHostRevenue(userId: string) {
    const host = await prisma.host.findUnique({ where: { userId } });
    if (!host) {
      return {
        totalEarnings: 0,
        totalPayouts: 0,
        availableBalance: 0,
        grossRevenue: 0,
        platformFees: 0,
        netRevenue: 0,
        monthlyBreakdown: [],
        recentPayouts: [],
      };
    }

    const [bookings, payouts] = await Promise.all([
      prisma.booking.findMany({
        where: {
          space: { hostId: host.id },
          status: { in: ['confirmed', 'active', 'completed'] },
        },
        orderBy: { startTime: 'desc' },
        take: 250,
      }),
      prisma.payout.findMany({
        where: { hostId: host.id },
        orderBy: { createdAt: 'desc' },
        take: 25,
      }),
    ]);

    const grossRevenue = bookings.reduce((sum, b) => sum + Number(b.totalAmount), 0);
    const platformFees = Number((grossRevenue * 0.1).toFixed(2));
    const netRevenue = Number((grossRevenue - platformFees).toFixed(2));
    const totalEarnings = Math.max(Number(host.totalEarnings), netRevenue);
    const totalPayouts = Number(host.totalPayouts);
    const availableBalance = Math.max(0, Number((totalEarnings - totalPayouts).toFixed(2)));

    const monthlyMap = new Map<string, { month: string; gross: number; fees: number; net: number; bookings: number }>();
    for (const b of bookings) {
      const monthKey = new Date(b.startTime).toISOString().slice(0, 7);
      const entry = monthlyMap.get(monthKey) || { month: monthKey, gross: 0, fees: 0, net: 0, bookings: 0 };
      const amt = Number(b.totalAmount);
      const fee = Number((amt * 0.1).toFixed(2));
      entry.gross = Number((entry.gross + amt).toFixed(2));
      entry.fees = Number((entry.fees + fee).toFixed(2));
      entry.net = Number((entry.net + amt - fee).toFixed(2));
      entry.bookings += 1;
      monthlyMap.set(monthKey, entry);
    }

    return {
      totalEarnings,
      totalPayouts,
      availableBalance,
      grossRevenue: Number(grossRevenue.toFixed(2)),
      platformFees,
      netRevenue,
      monthlyBreakdown: Array.from(monthlyMap.values()).sort((a, b) => b.month.localeCompare(a.month)),
      recentPayouts: payouts,
    };
  },

  async requestPayout(userId: string, amount: number) {
    const host = await prisma.host.findUnique({ where: { userId } });
    if (!host) throw new NotFoundError('Host profile not found');

    const payout = await prisma.$transaction(async (tx) => {
      const freshHost = await tx.host.findUnique({ where: { id: host.id } });
      if (!freshHost) throw new NotFoundError('Host profile not found');
      const available = Number(freshHost.totalEarnings) - Number(freshHost.totalPayouts);
      if (amount > available) {
        throw new ValidationError(`Requested amount ₹${amount} exceeds available balance ₹${Math.max(0, available).toFixed(2)}`);
      }

      const created = await tx.payout.create({
        data: {
          id: generateId(),
          hostId: host.id,
          amount,
          platformCommission: 0,
          currency: 'INR',
          status: 'processing',
          paymentIds: [],
        },
      });

      await tx.host.update({
        where: { id: host.id },
        data: { totalPayouts: { increment: amount } },
      });

      return created;
    });

    await writeHostAuditLog(userId, 'HOST_PAYOUT_REQUESTED', payout.id, { amount });
    return payout;
  },

  async getPresignedUploadUrl(spaceId: string, filename: string, user?: { sub: string; role: string }): Promise<string> {
    if (user) {
      await verifySpaceAccess(spaceId, user);
    }
    const config = getConfig();
    const safeFilename = filename.replace(/[^a-zA-Z0-9._-]/g, '_');
    const key = `spaces/${spaceId}/${generateId()}-${safeFilename}`;
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
    spaceType: (raw['spaceType'] as ParkingSpace['spaceType']) || 'commercial',
    entryInstructions: (raw['entryInstructions'] as string | undefined) || undefined,
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
    ownershipProofUrl: (raw['ownershipProofUrl'] as string | undefined) || undefined,
    reviewNotes: (raw['reviewNotes'] as string | undefined) || undefined,
    verifiedAt: raw['verifiedAt'] ? (raw['verifiedAt'] as Date).toISOString() : undefined,
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

const handleGetListings = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const listings = await hostService.getHostListings(req.user!.sub);
    res.json({ success: true, data: listings } as ApiResponse);
  } catch (err) {
    next(err);
  }
};

const handleCreateListing = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = listingSchema.safeParse(req.body);
    if (!result.success) throw new ValidationError(result.error.errors[0]?.message || 'Invalid input');
    const listing = await hostService.createListing(req.user!.sub, result.data);
    res.status(201).json({ success: true, data: listing } as ApiResponse);
  } catch (err) {
    next(err);
  }
};

const handleGetListingById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const space = await verifySpaceAccess(req.params['id']!, req.user!);
    res.json({ success: true, data: mapSpace(space as any) } as ApiResponse);
  } catch (err) {
    next(err);
  }
};

const handleUpdateListing = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = updateListingSchema.safeParse(req.body);
    if (!parsed.success) throw new ValidationError(parsed.error.errors[0]?.message || 'Invalid input');
    const updated = await hostService.updateListing(req.params['id']!, req.user!, parsed.data);
    res.json({ success: true, data: updated } as ApiResponse);
  } catch (err) {
    next(err);
  }
};

const handleDeleteListing = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await hostService.deleteListing(req.params['id']!, req.user!);
    res.json({ success: true, data: result } as ApiResponse);
  } catch (err) {
    next(err);
  }
};

const handleUploadUrl = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { filename } = req.body;
    if (!filename || typeof filename !== 'string') throw new ValidationError('filename is required');
    const url = await hostService.getPresignedUploadUrl(req.params['id']!, filename, req.user!);
    res.json({ success: true, data: { uploadUrl: url } } as ApiResponse);
  } catch (err) {
    next(err);
  }
};

// GET /host/listings & /host/spaces
hostRouter.get('/listings', handleGetListings);
hostRouter.get('/spaces', handleGetListings);

// POST /host/listings & /host/spaces
hostRouter.post('/listings', requireRole('host', 'admin'), handleCreateListing);
hostRouter.post('/spaces', requireRole('host', 'admin'), handleCreateListing);

// GET /host/listings/:id & /host/spaces/:id
hostRouter.get('/listings/:id', handleGetListingById);
hostRouter.get('/spaces/:id', handleGetListingById);

// PATCH /host/listings/:id & /host/spaces/:id
hostRouter.patch('/listings/:id', requireRole('host', 'admin'), handleUpdateListing);
hostRouter.patch('/spaces/:id', requireRole('host', 'admin'), handleUpdateListing);

// DELETE /host/listings/:id & /host/spaces/:id
hostRouter.delete('/listings/:id', requireRole('host', 'admin'), handleDeleteListing);
hostRouter.delete('/spaces/:id', requireRole('host', 'admin'), handleDeleteListing);

// POST /host/listings/:id/upload-url — get S3 presigned upload URL
hostRouter.post('/listings/:id/upload-url', requireRole('host', 'admin'), handleUploadUrl);
hostRouter.post('/spaces/:id/upload-url', requireRole('host', 'admin'), handleUploadUrl);

// GET /host/bookings — bookings across the authenticated host's spaces
hostRouter.get('/bookings', requireRole('host', 'admin'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const status = req.query['status'] as string | undefined;
    const bookings = await hostService.getHostBookings(req.user!.sub, status);
    res.json({ success: true, data: { bookings, total: bookings.length } } as ApiResponse);
  } catch (err) {
    next(err);
  }
});

// GET /host/revenue — host earnings & payout breakdown
hostRouter.get('/revenue', requireRole('host', 'admin'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const revenue = await hostService.getHostRevenue(req.user!.sub);
    res.json({ success: true, data: revenue } as ApiResponse);
  } catch (err) {
    next(err);
  }
});

// GET /host/payouts — list payout history
hostRouter.get('/payouts', requireRole('host', 'admin'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const revenue = await hostService.getHostRevenue(req.user!.sub);
    res.json({
      success: true,
      data: {
        payouts: revenue.recentPayouts,
        availableBalance: revenue.availableBalance,
        totalEarnings: revenue.totalEarnings,
        totalPayouts: revenue.totalPayouts,
      },
    } as ApiResponse);
  } catch (err) {
    next(err);
  }
});

// POST /host/payouts — request payout transfer
hostRouter.post('/payouts', requireRole('host', 'admin'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = payoutSchema.safeParse(req.body);
    if (!parsed.success) throw new ValidationError(parsed.error.errors[0]?.message || 'Valid payout amount is required');
    const payout = await hostService.requestPayout(req.user!.sub, parsed.data.amount);
    res.status(201).json({ success: true, data: { payout } } as ApiResponse);
  } catch (err) {
    next(err);
  }
});

// Autonomous AI Agents (Real OCR, Geocoding & Vision Providers)
const hostOnboardingAgent = new HostOnboardingAgent({
  ocrTool: new RealOCRProvider({
    endpointUrl: process.env['OCR_ENDPOINT_URL'],
    apiKey: process.env['OCR_API_KEY'],
    fallbackToMock: true,
  }),
  geocodingTool: new RealGeocodingProvider(),
  zoningTool: new MockZoningProvider(),
});

const visualInspectionAgent = new VisualInspectionAgent({
  visionTool: new RealVisionProvider({
    endpointUrl: process.env['VISION_ENDPOINT_URL'],
    apiKey: process.env['VISION_API_KEY'],
  }),
});

// POST /host/listings/:id/ai-verify — Autonomous multi-agent onboarding verification
const handleAiVerify = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const spaceId = req.params['id']!;
    const space = await verifySpaceAccess(spaceId, req.user!);

    const documentUrls = Array.isArray(req.body.documentUrls) && req.body.documentUrls.length > 0
      ? (req.body.documentUrls as string[])
      : ['https://s3.amazonaws.com/parkly/docs/electricity-bill.pdf'];
    const photoUrls = (space.photoUrls && space.photoUrls.length > 0)
      ? space.photoUrls
      : (Array.isArray(req.body.photoUrls) && req.body.photoUrls.length > 0
          ? (req.body.photoUrls as string[])
          : ['https://s3.amazonaws.com/parkly/spaces/sample-space.jpg']);

    const ctx = ExecutionContext.create({
      correlationId: (req.headers['x-correlation-id'] as string) || generateId(),
      initiatorUserId: req.user!.sub,
      metadata: { tenantId: space.regionId || 'chennai-main' },
    });

    const onboardingResult = await hostOnboardingAgent.execute({
      userId: req.user!.sub,
      rawAddress: `${space.address}, ${space.city}, ${space.state} ${space.pincode}`,
      documentUrls,
      declaredSlots: space.totalCapacity,
      vehicleTypes: (space.vehicleTypes && space.vehicleTypes.length > 0
        ? space.vehicleTypes
        : ['sedan', 'suv']) as string[],
    }, ctx);

    const visualResult = await visualInspectionAgent.execute({
      spaceId: space.id,
      photoUrls,
    }, ctx);

    const isApproved = onboardingResult.success && visualResult.success &&
      onboardingResult.data.kycStatus === 'VERIFIED_AUTO' &&
      visualResult.data.inspectionResult === 'APPROVED';

    const newStatus = isApproved ? 'active' : 'pending_verification';

    await prisma.parkingSpace.update({
      where: { id: spaceId },
      data: { status: newStatus, photoUrls },
    });

    if (isApproved && space.host) {
      await prisma.host.update({
        where: { id: space.hostId },
        data: { verificationStatus: 'approved', verifiedAt: new Date() },
      });

      await publishEvent({
        type: 'HostVerificationCompleted',
        version: '1.0',
        timestamp: new Date().toISOString(),
        source: 'parkly.host-service',
        data: { spaceId: space.id, hostId: space.hostId, status: 'approved' },
      });
    }

    await writeHostAuditLog(req.user!.sub, 'HOST_LISTING_AI_VERIFIED', spaceId, {
      status: newStatus,
      aiApproval: isApproved,
    }, req.ip);

    res.json({
      success: true,
      data: {
        spaceId,
        status: newStatus,
        aiApproval: isApproved,
        onboarding: onboardingResult.success ? onboardingResult.data : onboardingResult.error,
        visualInspection: visualResult.success ? visualResult.data : visualResult.error,
      },
    } as ApiResponse);
  } catch (err) {
    next(err);
  }
};

hostRouter.post('/listings/:id/ai-verify', requireRole('host', 'admin'), handleAiVerify);
hostRouter.post('/spaces/:id/ai-verify', requireRole('host', 'admin'), handleAiVerify);

// GET /host/kyc — read Host KYC & plot document submission
hostRouter.get('/kyc', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const host = await prisma.host.findUnique({ where: { userId: req.user!.sub } });
    res.json({
      success: true,
      data: { kyc: host },
    } as ApiResponse);
  } catch (err) {
    next(err);
  }
});

// PUT / POST /host/kyc — submit Host identity, ownership proof & parking plot photos for team verification
const handleSubmitHostKyc = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = hostKycSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ValidationError(
        parsed.error.errors[0]?.message || 'Invalid Host KYC payload',
        parsed.error.errors[0]?.path.join('.'),
      );
    }

    const d = parsed.data;
    const host = await hostService.getOrCreateHost(req.user!.sub);
    const updated = await prisma.host.update({
      where: { id: host.id },
      data: {
        kycFullName: d.kycFullName,
        kycPhone: d.kycPhone || null,
        ...(d.businessName ? { businessName: d.businessName } : {}),
        ...(d.panNumber ? { panNumber: d.panNumber.toUpperCase() } : {}),
        govIdType: d.govIdType,
        govIdNumberMasked: d.govIdNumberMasked,
        govIdDocumentUrl: d.govIdDocumentUrl,
        ownershipProofType: d.ownershipProofType,
        ownershipDocumentUrl: d.ownershipDocumentUrl,
        addressProofUrl: d.addressProofUrl || null,
        plotPhotoUrls: d.plotPhotoUrls,
        ...(d.bankAccountNumber ? { bankAccountNumber: d.bankAccountNumber } : {}),
        ...(d.ifscCode ? { ifscCode: d.ifscCode.toUpperCase() } : {}),
        upiId: d.upiId || null,
        kycNotes: d.kycNotes || null,
        verificationStatus: 'pending',
        reviewNotes: null,
        reviewedBy: null,
        submittedAt: new Date(),
      },
    });

    await writeHostAuditLog(req.user!.sub, 'HOST_KYC_SUBMITTED', updated.id, {
      ownershipProofType: d.ownershipProofType,
      plotPhotos: d.plotPhotoUrls.length,
    }, req.ip);

    res.json({
      success: true,
      data: { kyc: updated },
    } as ApiResponse);
  } catch (err) {
    next(err);
  }
};

hostRouter.put('/kyc', handleSubmitHostKyc);
hostRouter.post('/kyc', handleSubmitHostKyc);

// ============================================================
// App
// ============================================================

const app = express();
app.use(helmet({ contentSecurityPolicy: false }));
app.use(securityHeaders);
app.use(responseTimer);
app.use(cors(getHardenedCorsOptions()));

app.use(express.json({ limit: '2mb' }));
app.use(requestLogger);

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: SERVICE_NAME, version: '1.0.0', timestamp: new Date().toISOString() });
});
app.use('/host', hostRouter);
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

export { app, hostService };
export default app;
