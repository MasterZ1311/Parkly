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

const createBookingSchema = z.object({
  spaceId: z.string().uuid(),
  vehicleId: z.string().uuid(),
  hostId: z.string().uuid(),
  type: z.enum(['instant', 'scheduled', 'recurring']),
  startTime: z.string().datetime(),
  endTime: z.string().datetime(),
  totalAmount: z.number().positive(),
  recurringFrequency: z.enum(['daily', 'weekly']).optional(),
  recurringEndDate: z.string().datetime().optional(),
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
    const booking = await bookingService.getBooking(req.params['id']!, req.user!.sub);
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
