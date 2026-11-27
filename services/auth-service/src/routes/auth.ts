// ============================================================
// Auth Service — Routes
// POST /auth/otp/request
// POST /auth/otp/verify
// POST /auth/refresh
// POST /auth/logout
// GET  /auth/me
// ============================================================

import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { otpService } from '../services/otpService';
import { jwtService } from '../services/jwtService';
import { userService } from '../services/userService';
import {
  authenticate,
  ValidationError,
  NotFoundError,
  ConflictError,
  ApiResponse,
  logger,
  normalizePhoneNumber,
  getConfig,
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

    // Dev convenience: only return devOtp when explicitly allowed outside production.
    const includeDevOtp = getConfig().returnDevOtp;

    const response: ApiResponse = {
      success: true,
      data: {
        message: 'OTP sent successfully',
        phone,
        ...(includeDevOtp ? { devOtp: otp } : {}),
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
    if (!user) throw new NotFoundError('User not found');

    res.status(200).json({
      success: true,
      data: { user },
      meta: { requestId: req.requestId || '', timestamp: new Date().toISOString() },
    } as ApiResponse);
  } catch (err) {
    next(err);
  }
});

// --- GET /auth/profile ---
authRouter.get('/profile', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = await userService.findById(req.user!.sub);
    if (!user) throw new NotFoundError('User not found');

    res.status(200).json({
      success: true,
      data: { user },
      meta: { requestId: req.requestId || '', timestamp: new Date().toISOString() },
    } as ApiResponse);
  } catch (err) {
    next(err);
  }
});

const updateProfileSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  email: z.string().email().optional(),
  bankAccount: z.string().max(60).optional(),
  ifscCode: z.string().max(20).optional(),
});

// --- PATCH /auth/profile ---
authRouter.patch('/profile', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = updateProfileSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.errors[0]?.message || 'Invalid profile update');
    }
    const user = await userService.updateUser(req.user!.sub, parsed.data);
    res.status(200).json({
      success: true,
      data: { user },
      meta: { requestId: req.requestId || '', timestamp: new Date().toISOString() },
    } as ApiResponse);
  } catch (err) {
    next(err);
  }
});

// --- Vehicle Management ---
const vehicleSchema = z.object({
  licensePlate: z
    .string()
    .transform((s) => s.trim().toUpperCase().replace(/\s+/g, ''))
    .refine((s) => /^[A-Z]{2}[0-9]{1,2}[A-Z]{1,3}[0-9]{4}$/.test(s), {
      message: 'License plate must follow Indian registration format (e.g. TN01AB1234)',
    }),
  vehicleType: z.enum(['motorcycle', 'compact', 'sedan', 'suv', 'van', 'truck']).default('sedan'),
  make: z.string().max(50).optional(),
  model: z.string().max(50).optional(),
  color: z.string().max(30).optional(),
  isDefault: z.boolean().optional(),
});

// GET /auth/vehicles
authRouter.get('/vehicles', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const vehicles = await userService.listVehicles(req.user!.sub);
    res.status(200).json({
      success: true,
      data: { vehicles },
      meta: { requestId: req.requestId || '', timestamp: new Date().toISOString() },
    } as ApiResponse);
  } catch (err) {
    next(err);
  }
});

// POST /auth/vehicles
authRouter.post('/vehicles', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = vehicleSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.errors[0]?.message || 'Invalid vehicle payload');
    }
    const vehicle = await userService.upsertVehicle(req.user!.sub, parsed.data);
    res.status(201).json({
      success: true,
      data: { vehicle },
      meta: { requestId: req.requestId || '', timestamp: new Date().toISOString() },
    } as ApiResponse);
  } catch (err: any) {
    if (err?.message === 'VEHICLE_OWNED_BY_OTHER_USER') {
      next(new ConflictError('This license plate is already registered to another account'));
      return;
    }
    next(err);
  }
});

// DELETE /auth/vehicles/:id
authRouter.delete('/vehicles/:id', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const deleted = await userService.deleteVehicle(req.user!.sub, req.params['id']!);
    if (!deleted) throw new NotFoundError('Vehicle not found');
    res.status(200).json({
      success: true,
      data: { message: 'Vehicle removed' },
      meta: { requestId: req.requestId || '', timestamp: new Date().toISOString() },
    } as ApiResponse);
  } catch (err) {
    next(err);
  }
});
