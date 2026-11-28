// ============================================================
// Auth Service — User Service (Prisma/PostgreSQL)
// ============================================================

import { PrismaClient, Prisma } from '@prisma/client';
import {
  User,
  UserRole,
  Vehicle,
  DriverKyc,
  GovIdType,
  generateId,
  ConflictError,
  NotFoundError,
} from '@parkly/shared';
import { vehicleService, type CreateVehicleInput } from './vehicleService';

const defaultPrisma = new PrismaClient();

export interface UpsertDriverKycInput {
  fullName: string;
  dateOfBirth?: string;
  address?: string;
  emergencyContact?: string;
  drivingLicenseNumber: string;
  drivingLicenseExpiry?: string;
  drivingLicenseFrontUrl: string;
  drivingLicenseBackUrl?: string;
  govIdType: GovIdType;
  govIdNumberMasked: string;
  govIdDocumentUrl: string;
  vehiclePlate: string;
  rcNumber: string;
  rcDocumentUrl: string;
  insuranceDocumentUrl?: string;
  selfieUrl?: string;
}

export class UserService {
  constructor(private readonly prisma: PrismaClient = defaultPrisma) {}

  /**
   * Find a user by phone number.
   */
  async findByPhone(phone: string): Promise<User | null> {
    const user = await this.prisma.user.findUnique({ where: { phone } });
    return user && !user.deletedAt ? this.mapUser(user) : null;
  }

  /**
   * Find a user by ID.
   */
  async findById(id: string): Promise<User | null> {
    const user = await this.prisma.user.findUnique({ where: { id } });
    return user && !user.deletedAt ? this.mapUser(user) : null;
  }

  /**
   * Create a new user (driver by default).
   */
  async createUser(phone: string, name: string, role: UserRole = 'driver'): Promise<User> {
    const user = await this.prisma.user.create({
      data: {
        id: generateId(),
        phone,
        name,
        role,
        isActive: true,
      },
    });
    return this.mapUser(user);
  }

  /**
   * Find or create a user by phone (used during OTP verification).
   */
  async findOrCreate(phone: string, name?: string): Promise<{ user: User; isNew: boolean }> {
    const existing = await this.findByPhone(phone);
    if (existing) return { user: existing, isNew: false };

    const user = await this.createUser(phone, name || 'Parkly User');
    return { user, isNew: true };
  }

  /**
   * Update user profile (and optional host bank settlement fields).
   */
  async updateUser(
    id: string,
    data: { name?: string; email?: string | null; bankAccount?: string; ifscCode?: string },
  ): Promise<User> {
    const existing = await this.prisma.user.findUnique({ where: { id } });
    if (!existing || existing.deletedAt) {
      throw new NotFoundError('User not found');
    }

    const updateData: Prisma.UserUpdateInput = {};
    if (data.name !== undefined) {
      updateData.name = data.name.trim();
    }
    if (data.email !== undefined) {
      const normalizedEmail = data.email ? data.email.trim().toLowerCase() : null;
      updateData.email = normalizedEmail || null;
    }

    try {
      const user = await this.prisma.user.update({
        where: { id },
        data: updateData,
      });

      if ((data.bankAccount || data.ifscCode) && user.role === 'host') {
        await this.prisma.host.updateMany({
          where: { userId: id },
          data: {
            ...(data.bankAccount ? { bankAccountNumber: data.bankAccount.trim() } : {}),
            ...(data.ifscCode ? { ifscCode: data.ifscCode.trim().toUpperCase() } : {}),
          },
        });
      }

      return this.mapUser(user);
    } catch (err: unknown) {
      const prismaCode = (err as { code?: string })?.code;
      if (prismaCode === 'P2002') {
        throw new ConflictError('Email address is already in use', 'email');
      }
      throw err;
    }
  }

  async listVehicles(userId: string): Promise<Vehicle[]> {
    return vehicleService.listVehicles(userId);
  }

  async upsertVehicle(userId: string, input: CreateVehicleInput): Promise<Vehicle> {
    return vehicleService.createVehicle(userId, input);
  }

  async setDefaultVehicle(userId: string, vehicleId: string): Promise<Vehicle> {
    return vehicleService.setDefaultVehicle(userId, vehicleId);
  }

  async deleteVehicle(userId: string, vehicleId: string): Promise<{ deleted: true; id: string }> {
    return vehicleService.deleteVehicle(userId, vehicleId);
  }

  /**
   * Upgrade a driver account to host so private homeowners can list vacant parking spaces.
   */
  async becomeHost(
    userId: string,
    input?: { businessName?: string; bankAccount?: string; ifscCode?: string },
  ): Promise<User> {
    const existing = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!existing || existing.deletedAt) {
      throw new NotFoundError('User not found');
    }

    const nextRole: UserRole = existing.role === 'admin' ? 'admin' : 'host';
    const user = await this.prisma.$transaction(async (tx) => {
      const updatedUser = existing.role === nextRole
        ? existing
        : await tx.user.update({
            where: { id: userId },
            data: { role: nextRole },
          });

      const hostName = input?.businessName?.trim() || `${updatedUser.name} · Private Parking`;
      await tx.host.upsert({
        where: { userId },
        update: {
          ...(input?.businessName?.trim() ? { businessName: input.businessName.trim() } : {}),
          ...(input?.bankAccount?.trim() ? { bankAccountNumber: input.bankAccount.trim() } : {}),
          ...(input?.ifscCode?.trim() ? { ifscCode: input.ifscCode.trim().toUpperCase() } : {}),
        },
        create: {
          id: generateId(),
          userId,
          businessName: hostName,
          ...(input?.bankAccount?.trim() ? { bankAccountNumber: input.bankAccount.trim() } : {}),
          ...(input?.ifscCode?.trim() ? { ifscCode: input.ifscCode.trim().toUpperCase() } : {}),
          verificationStatus: 'pending',
          totalEarnings: 0,
          totalPayouts: 0,
        },
      });

      return updatedUser;
    });

    return this.mapUser(user);
  }

  /**
   * Fetch stored Driver KYC & RC verification submission for the authenticated user.
   */
  async getDriverKyc(userId: string): Promise<DriverKyc | null> {
    const kyc = await this.prisma.driverKyc.findUnique({ where: { userId } });
    return kyc ? this.mapDriverKyc(kyc) : null;
  }

  /**
   * Store Driver KYC (Driving Licence, Vehicle Reg, RC Book, Govt ID) for team verification.
   */
  async upsertDriverKyc(userId: string, input: UpsertDriverKycInput): Promise<DriverKyc> {
    const existingUser = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!existingUser || existingUser.deletedAt) {
      throw new NotFoundError('User not found');
    }

    const normalizedPlate = input.vehiclePlate.trim().toUpperCase().replace(/\s+/g, '');
    const normalizedDl = input.drivingLicenseNumber.trim().toUpperCase().replace(/\s+/g, '');
    const normalizedRc = input.rcNumber.trim().toUpperCase().replace(/\s+/g, '');

    const saved = await this.prisma.$transaction(async (tx) => {
      const matchedVehicle = await tx.vehicle.findFirst({
        where: { userId, licensePlate: normalizedPlate, deletedAt: null },
      });

      if (matchedVehicle) {
        await tx.vehicle.update({
          where: { id: matchedVehicle.id },
          data: {
            rcNumber: normalizedRc,
            rcDocumentUrl: input.rcDocumentUrl.trim(),
            verificationStatus: 'pending',
          },
        });
      }

      return tx.driverKyc.upsert({
        where: { userId },
        update: {
          fullName: input.fullName.trim(),
          dateOfBirth: input.dateOfBirth?.trim() || null,
          address: input.address?.trim() || null,
          emergencyContact: input.emergencyContact?.trim() || null,
          drivingLicenseNumber: normalizedDl,
          drivingLicenseExpiry: input.drivingLicenseExpiry?.trim() || null,
          drivingLicenseFrontUrl: input.drivingLicenseFrontUrl.trim(),
          drivingLicenseBackUrl: input.drivingLicenseBackUrl?.trim() || null,
          govIdType: input.govIdType,
          govIdNumberMasked: input.govIdNumberMasked.trim(),
          govIdDocumentUrl: input.govIdDocumentUrl.trim(),
          vehicleId: matchedVehicle?.id || null,
          vehiclePlate: normalizedPlate,
          rcNumber: normalizedRc,
          rcDocumentUrl: input.rcDocumentUrl.trim(),
          insuranceDocumentUrl: input.insuranceDocumentUrl?.trim() || null,
          selfieUrl: input.selfieUrl?.trim() || null,
          status: 'pending',
          reviewNotes: null,
          reviewedBy: null,
          reviewedAt: null,
          submittedAt: new Date(),
        },
        create: {
          id: generateId(),
          userId,
          fullName: input.fullName.trim(),
          dateOfBirth: input.dateOfBirth?.trim() || null,
          address: input.address?.trim() || null,
          emergencyContact: input.emergencyContact?.trim() || null,
          drivingLicenseNumber: normalizedDl,
          drivingLicenseExpiry: input.drivingLicenseExpiry?.trim() || null,
          drivingLicenseFrontUrl: input.drivingLicenseFrontUrl.trim(),
          drivingLicenseBackUrl: input.drivingLicenseBackUrl?.trim() || null,
          govIdType: input.govIdType,
          govIdNumberMasked: input.govIdNumberMasked.trim(),
          govIdDocumentUrl: input.govIdDocumentUrl.trim(),
          vehicleId: matchedVehicle?.id || null,
          vehiclePlate: normalizedPlate,
          rcNumber: normalizedRc,
          rcDocumentUrl: input.rcDocumentUrl.trim(),
          insuranceDocumentUrl: input.insuranceDocumentUrl?.trim() || null,
          selfieUrl: input.selfieUrl?.trim() || null,
          status: 'pending',
        },
      });
    });

    return this.mapDriverKyc(saved);
  }

  private mapDriverKyc(raw: {
    id: string;
    userId: string;
    fullName: string;
    dateOfBirth: string | null;
    address: string | null;
    emergencyContact: string | null;
    drivingLicenseNumber: string;
    drivingLicenseExpiry: string | null;
    drivingLicenseFrontUrl: string;
    drivingLicenseBackUrl: string | null;
    govIdType: string;
    govIdNumberMasked: string;
    govIdDocumentUrl: string;
    vehicleId: string | null;
    vehiclePlate: string;
    rcNumber: string;
    rcDocumentUrl: string;
    insuranceDocumentUrl: string | null;
    selfieUrl: string | null;
    status: string;
    reviewNotes: string | null;
    reviewedBy: string | null;
    reviewedAt: Date | null;
    submittedAt: Date;
    updatedAt: Date;
  }): DriverKyc {
    return {
      id: raw.id,
      userId: raw.userId,
      fullName: raw.fullName,
      dateOfBirth: raw.dateOfBirth || undefined,
      address: raw.address || undefined,
      emergencyContact: raw.emergencyContact || undefined,
      drivingLicenseNumber: raw.drivingLicenseNumber,
      drivingLicenseExpiry: raw.drivingLicenseExpiry || undefined,
      drivingLicenseFrontUrl: raw.drivingLicenseFrontUrl,
      drivingLicenseBackUrl: raw.drivingLicenseBackUrl || undefined,
      govIdType: raw.govIdType as GovIdType,
      govIdNumberMasked: raw.govIdNumberMasked,
      govIdDocumentUrl: raw.govIdDocumentUrl,
      vehicleId: raw.vehicleId || undefined,
      vehiclePlate: raw.vehiclePlate,
      rcNumber: raw.rcNumber,
      rcDocumentUrl: raw.rcDocumentUrl,
      insuranceDocumentUrl: raw.insuranceDocumentUrl || undefined,
      selfieUrl: raw.selfieUrl || undefined,
      status: raw.status as DriverKyc['status'],
      reviewNotes: raw.reviewNotes || undefined,
      reviewedBy: raw.reviewedBy || undefined,
      reviewedAt: raw.reviewedAt ? raw.reviewedAt.toISOString() : undefined,
      submittedAt: raw.submittedAt.toISOString(),
      updatedAt: raw.updatedAt.toISOString(),
    };
  }

  private mapUser(raw: {
    id: string;
    phone: string;
    name: string;
    email: string | null;
    role: string;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
  }): User {
    return {
      id: raw.id,
      phone: raw.phone,
      name: raw.name,
      email: raw.email || undefined,
      role: raw.role as UserRole,
      isActive: raw.isActive,
      createdAt: raw.createdAt.toISOString(),
      updatedAt: raw.updatedAt.toISOString(),
    };
  }
}

export const userService = new UserService();
export type { CreateVehicleInput };
