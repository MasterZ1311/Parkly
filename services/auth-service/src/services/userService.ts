// ============================================================
// Auth Service — User Service (Prisma/PostgreSQL)
// ============================================================

import { PrismaClient, Prisma } from '@prisma/client';
import {
  User,
  UserRole,
  Vehicle,
  generateId,
  ConflictError,
  NotFoundError,
} from '@parkly/shared';
import { vehicleService, type CreateVehicleInput } from './vehicleService';

const defaultPrisma = new PrismaClient();

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
