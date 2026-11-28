// ============================================================
// Booking Service — Routes
// ============================================================

import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { bookingService } from '../services/bookingService';
import { authenticate, requireRole, ValidationError, ApiResponse, BookingStatus } from '@parkly/shared';


export const bookingRouter = Router();

// All booking routes require authentication
bookingRouter.use(authenticate);

const idSchema = z.string().min(3).max(64).regex(/^[a-zA-Z0-9_-]+$/, 'Invalid ID format');

const createBookingSchema = z.object({
  spaceId: idSchema,
  vehicleId: idSchema,
  hostId: idSchema.optional(),
  type: z.enum(['instant', 'scheduled', 'recurring']),
  startTime: z.string().datetime(),
  endTime: z.string().datetime(),
  totalAmount: z.number().positive().optional(),
  recurringFrequency: z.enum(['daily', 'weekly']).optional(),
  recurringEndDate: z.string().datetime().optional(),
});

const extendBookingSchema = z
  .object({
    hours: z.number().int().min(1, 'Minimum extension is 1 hour').max(24, 'Maximum extension is 24 hours').optional(),
    additionalMinutes: z
      .number()
      .int()
      .min(15, 'Minimum extension is 15 minutes')
      .max(1440, 'Maximum extension is 24 hours')
      .optional(),
  })
  .refine(
    (data) => !(data.hours !== undefined && data.additionalMinutes !== undefined),
    { message: 'Provide either hours or additionalMinutes, not both' },
  );

// GET /bookings/verify-qr?token=... — Gate pass verification (host/admin)
bookingRouter.get('/verify-qr', requireRole('host', 'admin'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const token = String(req.query['token'] || req.query['qrToken'] || '');
    if (!token) throw new ValidationError('token query parameter is required');
    const result = await bookingService.verifyQrPass(token);
    res.json({ success: true, data: result } as ApiResponse);
  } catch (err) {
    next(err);
  }
});

// POST /bookings — Create a booking
bookingRouter.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = createBookingSchema.safeParse(req.body);
    if (!result.success) {
      throw new ValidationError(result.error.errors[0]?.message || 'Invalid input');
    }

    const data = result.data;
    const booking = await bookingService.createBooking({
      userId: req.user!.sub,
      spaceId: data.spaceId,
      vehicleId: data.vehicleId,
      hostId: data.hostId,
      type: data.type,
      startTime: new Date(data.startTime),
      endTime: new Date(data.endTime),
      totalAmount: data.totalAmount,
      recurringFrequency: data.recurringFrequency,
      recurringEndDate: data.recurringEndDate ? new Date(data.recurringEndDate) : undefined,
    });

    res.status(201).json({ success: true, data: booking } as ApiResponse);
  } catch (err) {
    next(err);
  }
});

// GET /bookings — List user bookings
bookingRouter.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { status, page, pageSize } = req.query;
    const result = await bookingService.listUserBookings(
      req.user!.sub,
      status as BookingStatus | undefined,
      Number(page) || 1,
      Math.min(Number(pageSize) || 20, 100),
    );

    res.json({ success: true, data: result } as ApiResponse);
  } catch (err) {
    next(err);
  }
});

// GET /bookings/:id — Get a booking
bookingRouter.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const booking = await bookingService.getBooking(req.params['id']!, req.user!.sub, req.user!.role);
    res.json({ success: true, data: booking } as ApiResponse);
  } catch (err) {
    next(err);
  }
});

// PUT /bookings/:id/extend — Extend an active or confirmed booking
bookingRouter.put('/:id/extend', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = extendBookingSchema.safeParse(req.body ?? {});
    if (!result.success) {
      throw new ValidationError(result.error.errors[0]?.message || 'Invalid extension request');
    }

    const additionalMinutes =
      result.data.additionalMinutes ?? (result.data.hours ?? 1) * 60;

    const booking = await bookingService.extendBooking(
      req.params['id']!,
      req.user!.sub,
      additionalMinutes,
    );
    res.json({ success: true, data: booking } as ApiResponse);
  } catch (err) {
    next(err);
  }
});

// PUT /bookings/:id/cancel — Cancel a booking
bookingRouter.put('/:id/cancel', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const booking = await bookingService.cancelBooking(
      req.params['id']!,
      req.user!.sub,
      req.body.reason,
    );
    res.json({ success: true, data: booking } as ApiResponse);
  } catch (err) {
    next(err);
  }
});

// PUT /bookings/:id/complete — Complete (admin/system)
bookingRouter.put('/:id/complete', requireRole('admin'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const booking = await bookingService.completeBooking(req.params['id']!);
    res.json({ success: true, data: booking } as ApiResponse);
  } catch (err) {
    next(err);
  }
});
