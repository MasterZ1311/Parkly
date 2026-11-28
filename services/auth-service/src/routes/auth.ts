// ============================================================
// Auth Service — Routes
// POST   /auth/otp/request
// POST   /auth/otp/verify
// POST   /auth/refresh
// POST   /auth/logout
// GET    /auth/me
// PATCH  /auth/me
// GET    /auth/profile
// PATCH  /auth/profile
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
import {
  authenticate,
  ValidationError,
  ConflictError,
  NotFoundError,
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

const updateProfileSchema = z
  .object({
    name: z.string().trim().min(1, 'Name cannot be empty').max(100, 'Name must be 100 characters or less').optional(),
    email: z
      .union([
        z.string().trim().email('Invalid email format').max(255),
        z.literal(''),
        z.null(),
      ])
      .optional(),
    bankAccount: z.string().trim().max(60).optional(),
    ifscCode: z.string().trim().max(20).optional(),
  })
  .refine(
    (data) =>
      data.name !== undefined ||
      data.email !== undefined ||
      data.bankAccount !== undefined ||
      data.ifscCode !== undefined,
    { message: 'Provide name, email, or bank details to update' },
  );

const INDIAN_PLATE_REGEX = /^[A-Z]{2}[0-9]{1,2}[A-Z]{1,3}[0-9]{4}$/;

const createVehicleSchema = z.object({
  licensePlate: z
    .string()
    .trim()
    .transform((s) => s.toUpperCase().replace(/\s+/g, ''))
    .refine((s) => INDIAN_PLATE_REGEX.test(s), {
      message: 'Invalid Indian license plate format (e.g. TN01AB1234)',
    }),
  vehicleType: z.enum(['motorcycle', 'compact', 'sedan', 'suv', 'van', 'truck']).default('sedan'),
  make: z.string().trim().max(50).optional(),
  model: z.string().trim().max(50).optional(),
  color: z.string().trim().max(30).optional(),
  rcNumber: z.string().trim().max(30).optional(),
  rcDocumentUrl: z.string().trim().max(1000).optional(),
  insuranceNumber: z.string().trim().max(50).optional(),
  pucValidUntil: z.string().trim().max(40).optional(),
  isDefault: z.boolean().optional(),
});

const driverKycSchema = z.object({
  fullName: z.string().trim().min(2, 'Full legal name is required').max(120),
  dateOfBirth: z.string().trim().max(20).optional(),
  address: z.string().trim().max(300).optional(),
  emergencyContact: z.string().trim().max(25).optional(),
  drivingLicenseNumber: z
    .string()
    .trim()
    .min(6, 'Valid Driving Licence number is required')
    .max(30),
  drivingLicenseExpiry: z.string().trim().max(20).optional(),
  drivingLicenseFrontUrl: z.string().trim().min(3, 'Driving Licence front image is required').max(1000),
  drivingLicenseBackUrl: z.string().trim().max(1000).optional(),
  govIdType: z.enum(['aadhaar', 'pan', 'passport', 'voter_id']),
  govIdNumberMasked: z.string().trim().min(4, 'Government ID number is required').max(40),
  govIdDocumentUrl: z.string().trim().min(3, 'Government ID document photo is required').max(1000),
  vehiclePlate: z
    .string()
    .trim()
    .transform((s) => s.toUpperCase().replace(/\s+/g, ''))
    .refine((s) => INDIAN_PLATE_REGEX.test(s), {
      message: 'Invalid Indian license plate format (e.g. TN01AB1234)',
    }),
  rcNumber: z.string().trim().min(4, 'RC Book number is required').max(30),
  rcDocumentUrl: z.string().trim().min(3, 'RC Book photo/scan is required').max(1000),
  insuranceDocumentUrl: z.string().trim().max(1000).optional(),
  selfieUrl: z.string().trim().max(1000).optional(),
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
    const returnDevOtp = getConfig().returnDevOtp;

    const response: ApiResponse = {
      success: true,
      data: {
        message: 'OTP sent successfully',
        phone,
        ...(returnDevOtp ? { devOtp: otp } : {}),
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
          email: user.email,
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
  logger.info({ userId: req.user?.sub }, 'User logged out');
  res.status(200).json({
    success: true,
    data: { message: 'Logged out successfully' },
    meta: { requestId: req.requestId || '', timestamp: new Date().toISOString() },
  } as ApiResponse);
});

const handleGetProfile = async (req: Request, res: Response, next: NextFunction) => {
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
};

const handleUpdateProfile = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = updateProfileSchema.safeParse(req.body);
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
};

// --- GET / PATCH /auth/me and /auth/profile ---
authRouter.get('/me', authenticate, handleGetProfile);
authRouter.patch('/me', authenticate, handleUpdateProfile);
authRouter.get('/profile', authenticate, handleGetProfile);
authRouter.patch('/profile', authenticate, handleUpdateProfile);

// --- GET /auth/vehicles ---
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

    const vehicle = await userService.upsertVehicle(req.user!.sub, result.data);
    res.status(201).json({
      success: true,
      data: { vehicle },
      meta: { requestId: req.requestId || '', timestamp: new Date().toISOString() },
    } as ApiResponse);
  } catch (err: unknown) {
    if ((err as { message?: string })?.message === 'VEHICLE_OWNED_BY_OTHER_USER') {
      next(new ConflictError('This license plate is already registered to another account', 'licensePlate'));
      return;
    }
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

    const vehicle = await userService.setDefaultVehicle(req.user!.sub, idCheck.data);
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

    const deleted = await userService.deleteVehicle(req.user!.sub, idCheck.data);
    res.status(200).json({
      success: true,
      data: deleted,
      meta: { requestId: req.requestId || '', timestamp: new Date().toISOString() },
    } as ApiResponse);
  } catch (err) {
    next(err);
  }
});

const becomeHostSchema = z.object({
  businessName: z.string().trim().max(120).optional(),
  bankAccount: z.string().trim().max(60).optional(),
  ifscCode: z.string().trim().max(20).optional(),
});

// --- POST /auth/become-host ---
authRouter.post('/become-host', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = becomeHostSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      throw new ValidationError(
        parsed.error.errors[0]?.message || 'Invalid host onboarding input',
        parsed.error.errors[0]?.path.join('.'),
      );
    }

    const user = await userService.becomeHost(req.user!.sub, parsed.data);
    const tokens = jwtService.issueTokens(user.id, user.phone, user.role);

    logger.info({ userId: user.id, role: user.role }, 'User enabled host mode for private/commercial listings');

    res.status(200).json({
      success: true,
      data: { user, tokens },
      meta: { requestId: req.requestId || '', timestamp: new Date().toISOString() },
    } as ApiResponse);
  } catch (err) {
    next(err);
  }
});

// --- GET /auth/driver-kyc ---
authRouter.get('/driver-kyc', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const kyc = await userService.getDriverKyc(req.user!.sub);
    res.status(200).json({
      success: true,
      data: { kyc },
      meta: { requestId: req.requestId || '', timestamp: new Date().toISOString() },
    } as ApiResponse);
  } catch (err) {
    next(err);
  }
});

const handleSubmitDriverKyc = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = driverKycSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ValidationError(
        parsed.error.errors[0]?.message || 'Invalid driver KYC payload',
        parsed.error.errors[0]?.path.join('.'),
      );
    }

    const kyc = await userService.upsertDriverKyc(req.user!.sub, parsed.data);
    logger.info({ userId: req.user!.sub, kycId: kyc.id, plate: kyc.vehiclePlate }, 'Driver KYC submitted for team review');

    res.status(200).json({
      success: true,
      data: { kyc },
      meta: { requestId: req.requestId || '', timestamp: new Date().toISOString() },
    } as ApiResponse);
  } catch (err) {
    next(err);
  }
};

authRouter.put('/driver-kyc', authenticate, handleSubmitDriverKyc);
authRouter.post('/driver-kyc', authenticate, handleSubmitDriverKyc);
