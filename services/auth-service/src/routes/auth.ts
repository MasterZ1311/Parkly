// ============================================================
// Auth Service — Routes
// POST   /auth/otp/request
// POST   /auth/otp/verify
// POST   /auth/refresh
// POST   /auth/logout
// GET    /auth/me
// PATCH  /auth/me
// GET    /auth/vehicles
// POST   /auth/vehicles
// PUT    /auth/vehicles/:id/default
// DELETE /auth/vehicles/:id
// ============================================================

import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { otpService } from '../services/otpService';
import { jwtService } from '../services/jwtService';
import { userService } from '../services/userService';
import { vehicleService } from '../services/vehicleService';
import {
  authenticate,
  ValidationError,
  ApiResponse,
  logger,
  normalizePhoneNumber,
} from '@parkly/shared';

export const authRouter = Router();

// --- Validation Schemas ---
const phoneSchema = z
  .string()
  .min(7, 'Invalid phone number format')
  .max(25, 'Invalid phone number format')
  .refine(
    (val) => {
      const normalized = normalizePhoneNumber(val);
      return /^\+[1-9]\d{9,14}$/.test(normalized);
    },
    { message: 'Invalid phone number format' },
  );

const otpRequestSchema = z.object({
  phone: phoneSchema,
});

const otpVerifySchema = z.object({
  phone: phoneSchema,
  otp: z.string().length(6, 'OTP must be 6 digits').regex(/^\d+$/, 'OTP must be numeric'),
  name: z.string().min(1).max(100).optional(),
});

const refreshSchema = z.object({
  refreshToken: z.string().min(1),
});

const updateMeSchema = z
  .object({
    name: z.string().trim().min(1, 'Name cannot be empty').max(100, 'Name must be 100 characters or less').optional(),
    email: z
      .union([
        z.string().trim().email('Invalid email format').max(255),
        z.literal(''),
        z.null(),
      ])
      .optional(),
  })
  .refine((data) => data.name !== undefined || data.email !== undefined, {
    message: 'Provide name or email to update',
  });

const INDIAN_PLATE_REGEX = /^[A-Z]{2}[0-9]{2}[A-Z]{1,2}[0-9]{4}$/;

const createVehicleSchema = z.object({
  licensePlate: z
    .string()
    .trim()
    .transform((s) => s.toUpperCase().replace(/\s+/g, ''))
    .refine((s) => INDIAN_PLATE_REGEX.test(s), {
      message: 'Invalid Indian license plate format (e.g. TN01AB1234)',
    }),
  vehicleType: z.enum(['motorcycle', 'compact', 'sedan', 'suv', 'van', 'truck']),
  make: z.string().trim().max(50).optional(),
  model: z.string().trim().max(50).optional(),
  color: z.string().trim().max(30).optional(),
  isDefault: z.boolean().optional(),
});

const vehicleIdParamSchema = z.string().uuid('Invalid vehicle ID');

// --- POST /auth/otp/request ---
authRouter.post('/otp/request', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = otpRequestSchema.safeParse(req.body);
    if (!result.success) {
      throw new ValidationError(
        result.error.errors[0]?.message || 'Invalid input',
        result.error.errors[0]?.path.join('.'),
      );
    }

    const { phone: rawPhone } = result.data;
    const phone = normalizePhoneNumber(rawPhone);
    const otp = await otpService.requestOtp(phone);

    // Dev convenience: when not running in production, return the OTP in the
    // response so testers can sign in on web without real SMS delivery.
    const isProd = process.env['NODE_ENV'] === 'production';

    const response: ApiResponse = {
      success: true,
      data: {
        message: 'OTP sent successfully',
        phone,
        ...(isProd ? {} : { devOtp: otp }),
      },
      meta: { requestId: req.requestId || '', timestamp: new Date().toISOString() },
    };

    res.status(200).json(response);
  } catch (err) {
    next(err);
  }
});

// --- POST /auth/otp/verify ---
authRouter.post('/otp/verify', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = otpVerifySchema.safeParse(req.body);
    if (!result.success) {
      throw new ValidationError(
        result.error.errors[0]?.message || 'Invalid input',
        result.error.errors[0]?.path.join('.'),
      );
    }

    const { phone: rawPhone, otp, name } = result.data;

    // Verify OTP and get normalized phone
    const phone = await otpService.verifyOtp(rawPhone, otp);

    // Find or create user with normalized phone
    const { user, isNew } = await userService.findOrCreate(phone, name);

    if (!user.isActive) {
      throw new ValidationError('Account is inactive. Please contact support.');
    }

    // Issue tokens
    const tokens = jwtService.issueTokens(user.id, user.phone, user.role);

    logger.info(
      { userId: user.id, isNew, role: user.role },
      'User authenticated successfully',
    );

    const response: ApiResponse = {
      success: true,
      data: {
        user: {
          id: user.id,
          name: user.name,
          phone: user.phone,
          role: user.role,
          isNew,
        },
        tokens,
      },
      meta: { requestId: req.requestId || '', timestamp: new Date().toISOString() },
    };

    res.status(200).json(response);
  } catch (err) {
    next(err);
  }
});

// --- POST /auth/refresh ---
authRouter.post('/refresh', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = refreshSchema.safeParse(req.body);
    if (!result.success) {
      throw new ValidationError('refreshToken is required');
    }

    const { sub: userId } = jwtService.verifyRefreshToken(result.data.refreshToken);

    const user = await userService.findById(userId);
    if (!user || !user.isActive) {
      throw new ValidationError('User not found or inactive');
    }

    const tokens = jwtService.issueTokens(user.id, user.phone, user.role);

    res.status(200).json({
      success: true,
      data: { tokens },
      meta: { requestId: req.requestId || '', timestamp: new Date().toISOString() },
    } as ApiResponse);
  } catch (err) {
    next(err);
  }
});

// --- POST /auth/logout ---
authRouter.post('/logout', authenticate, (req: Request, res: Response) => {
  // In production: add token to a blocklist (DynamoDB or Redis)
  // For MVP: client discards tokens
  logger.info({ userId: req.user?.sub }, 'User logged out');
  res.status(200).json({
    success: true,
    data: { message: 'Logged out successfully' },
    meta: { requestId: req.requestId || '', timestamp: new Date().toISOString() },
  } as ApiResponse);
});

// --- GET /auth/me ---
authRouter.get('/me', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = await userService.findById(req.user!.sub);
    if (!user) throw new ValidationError('User not found');

    res.status(200).json({
      success: true,
      data: { user },
      meta: { requestId: req.requestId || '', timestamp: new Date().toISOString() },
    } as ApiResponse);
  } catch (err) {
    next(err);
  }
});

// --- PATCH /auth/me ---
authRouter.patch('/me', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = updateMeSchema.safeParse(req.body);
    if (!result.success) {
      throw new ValidationError(
        result.error.errors[0]?.message || 'Invalid profile update input',
        result.error.errors[0]?.path.join('.'),
      );
    }

    const user = await userService.updateUser(req.user!.sub, result.data);

    res.status(200).json({
      success: true,
      data: { user },
      meta: { requestId: req.requestId || '', timestamp: new Date().toISOString() },
    } as ApiResponse);
  } catch (err) {
    next(err);
  }
});

// --- GET /auth/vehicles ---
authRouter.get('/vehicles', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const vehicles = await vehicleService.listVehicles(req.user!.sub);
    res.status(200).json({
      success: true,
      data: { vehicles },
      meta: { requestId: req.requestId || '', timestamp: new Date().toISOString() },
    } as ApiResponse);
  } catch (err) {
    next(err);
  }
});

// --- POST /auth/vehicles ---
authRouter.post('/vehicles', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = createVehicleSchema.safeParse(req.body);
    if (!result.success) {
      throw new ValidationError(
        result.error.errors[0]?.message || 'Invalid vehicle payload',
        result.error.errors[0]?.path.join('.'),
      );
    }

    const vehicle = await vehicleService.createVehicle(req.user!.sub, result.data);
    res.status(201).json({
      success: true,
      data: { vehicle },
      meta: { requestId: req.requestId || '', timestamp: new Date().toISOString() },
    } as ApiResponse);
  } catch (err) {
    next(err);
  }
});

// --- PUT /auth/vehicles/:id/default ---
authRouter.put('/vehicles/:id/default', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const idCheck = vehicleIdParamSchema.safeParse(req.params['id']);
    if (!idCheck.success) {
      throw new ValidationError('Invalid vehicle ID', 'id');
    }

    const vehicle = await vehicleService.setDefaultVehicle(req.user!.sub, idCheck.data);
    res.status(200).json({
      success: true,
      data: { vehicle },
      meta: { requestId: req.requestId || '', timestamp: new Date().toISOString() },
    } as ApiResponse);
  } catch (err) {
    next(err);
  }
});

// --- DELETE /auth/vehicles/:id ---
authRouter.delete('/vehicles/:id', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const idCheck = vehicleIdParamSchema.safeParse(req.params['id']);
    if (!idCheck.success) {
      throw new ValidationError('Invalid vehicle ID', 'id');
    }

    const deleted = await vehicleService.deleteVehicle(req.user!.sub, idCheck.data);
    res.status(200).json({
      success: true,
      data: deleted,
      meta: { requestId: req.requestId || '', timestamp: new Date().toISOString() },
    } as ApiResponse);
  } catch (err) {
    next(err);
  }
});
