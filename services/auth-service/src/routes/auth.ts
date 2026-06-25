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
  ApiResponse,
  logger,
} from '@parkly/shared';

export const authRouter = Router();

// --- Validation Schemas ---
const phoneSchema = z
  .string()
  .regex(/^\+?[1-9]\d{9,14}$/, 'Invalid phone number format');

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

    const { phone } = result.data;
    await otpService.requestOtp(phone);

    const response: ApiResponse = {
      success: true,
      data: { message: 'OTP sent successfully', phone },
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

    const { phone, otp, name } = result.data;

    // Verify OTP
    await otpService.verifyOtp(phone, otp);

    // Find or create user
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
