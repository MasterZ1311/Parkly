// ============================================================
// Search Service — Routes
// POST /search — Main search endpoint
// ============================================================

import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { searchService } from '../services/searchService';
import { authenticate, ValidationError, ApiResponse } from '@parkly/shared';

export const searchRouter = Router();

// All search routes require authentication
searchRouter.use(authenticate);

const locationInputSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('text'), value: z.string().min(1).max(200) }),
  z.object({
    type: z.literal('coordinates'),
    lat: z.number().min(-90).max(90),
    lng: z.number().min(-180).max(180),
  }),
  z.object({ type: z.literal('currentLocation') }),
]);

const searchSchema = z.object({
  location: locationInputSchema,
  arrivalTime: z.string().datetime({ message: 'arrivalTime must be ISO 8601 datetime' }),
  duration: z.number().int().min(15).max(4320).optional(),
  radius: z.number().min(0.5).max(50).optional(),
  filters: z
    .object({
      priceRange: z.object({ min: z.number().min(0), max: z.number().max(999999) }).optional(),
      vehicleType: z.enum(['motorcycle', 'compact', 'sedan', 'suv', 'van', 'truck']).optional(),
      evCharging: z.boolean().optional(),
      coveredParking: z.boolean().optional(),
      securityLevel: z.enum(['none', 'basic', 'monitored', 'staffed', 'gated']).optional(),
      accessibility: z
        .array(z.enum(['wheelchair_accessible', 'step_free', 'wide_bays', 'accessible_payment']))
        .optional(),
    })
    .optional(),
  page: z.number().int().min(1).optional(),
  pageSize: z.number().int().min(5).max(100).optional(),
});

// POST /search
searchRouter.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = searchSchema.safeParse(req.body);
    if (!result.success) {
      const firstError = result.error.errors[0];
      throw new ValidationError(
        firstError?.message || 'Invalid search query',
        firstError?.path.join('.'),
      );
    }

    const searchResult = await searchService.search(result.data);

    res.status(200).json({
      success: true,
      data: searchResult,
      meta: {
        requestId: req.requestId || '',
        timestamp: new Date().toISOString(),
      },
    } as ApiResponse);
  } catch (err) {
    next(err);
  }
});
