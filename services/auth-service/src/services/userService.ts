// ============================================================
// Auth Service — User Service (Prisma/PostgreSQL)
// ============================================================

import { PrismaClient } from '@prisma/client';
import { User, UserRole, Vehicle, VehicleType, generateId } from '@parkly/shared';

export const prisma = new PrismaClient();

export interface CreateVehicleInput {
  licensePlate: string;
  vehicleType: VehicleType;
  make?: string;
  model?: string;
  color?: string;
  isDefault?: boolean;
}

export class UserService {
  /**
   * Find a user by phone number.
   */
  async findByPhone(phone: string): Promise<User | null> {
    const user = await prisma.user.findUnique({ where: { phone } });
    return user ? this.mapUser(user) : null;
  }

  /**
   * Find a user by ID.
   */
  async findById(id: string): Promise<User | null> {
    const user = await prisma.user.findUnique({ where: { id } });
    return user ? this.mapUser(user) : null;
  }

  /**
   * Create a new user (driver by default).
   */
  async createUser(phone: string, name: string, role: UserRole = 'driver'): Promise<User> {
    const user = await prisma.user.create({
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
   * Update user profile (and optional host bank info).
   */
  async updateUser(
    id: string,
    data: Partial<Pick<User, 'name' | 'email'>> & { bankAccount?: string; ifscCode?: string },
  ): Promise<User> {
    const { bankAccount, ifscCode, ...userFields } = data;
    const user = await prisma.user.update({
      where: { id },
      data: userFields,
    });

    if ((bankAccount || ifscCode) && user.role === 'host') {
      await prisma.host.updateMany({
        where: { userId: id },
        data: {
          ...(bankAccount ? { bankAccountNumber: bankAccount } : {}),
          ...(ifscCode ? { ifscCode } : {}),
        },
      });
    }

    return this.mapUser(user);
  }

  /**
   * List active (non-deleted) vehicles owned by a user.
   */
  async listVehicles(userId: string): Promise<Vehicle[]> {
    const rows = await prisma.vehicle.findMany({
      where: { userId, deletedAt: null },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
    });
    return rows.map((v) => this.mapVehicle(v));
  }

  /**
   * Register or re-bind a vehicle for the authenticated user.
   */
  async upsertVehicle(userId: string, input: CreateVehicleInput): Promise<Vehicle> {
    const normalizedPlate = input.licensePlate.trim().toUpperCase().replace(/\s+/g, '');
    const existing = await prisma.vehicle.findUnique({ where: { licensePlate: normalizedPlate } });

    if (existing && existing.userId !== userId && !existing.deletedAt) {
      throw new Error('VEHICLE_OWNED_BY_OTHER_USER');
    }

    if (input.isDefault) {
      await prisma.vehicle.updateMany({
        where: { userId, deletedAt: null },
        data: { isDefault: false },
      });
    }

    const row = existing
      ? await prisma.vehicle.update({
          where: { id: existing.id },
          data: {
            userId,
            vehicleType: input.vehicleType,
            make: input.make ?? existing.make,
            model: input.model ?? existing.model,
            color: input.color ?? existing.color,
            isDefault: input.isDefault ?? existing.isDefault,
            deletedAt: null,
          },
        })
      : await prisma.vehicle.create({
          data: {
            id: generateId(),
            userId,
            licensePlate: normalizedPlate,
            vehicleType: input.vehicleType,
            make: input.make || null,
            model: input.model || null,
            color: input.color || null,
            isDefault: input.isDefault ?? true,
          },
        });

    return this.mapVehicle(row);
  }

  /**
   * Soft-delete a vehicle owned by the user.
   */
  async deleteVehicle(userId: string, vehicleId: string): Promise<boolean> {
    const existing = await prisma.vehicle.findUnique({ where: { id: vehicleId } });
    if (!existing || existing.userId !== userId || existing.deletedAt) {
      return false;
    }
    await prisma.vehicle.update({
      where: { id: vehicleId },
      data: { deletedAt: new Date(), isDefault: false },
    });
    return true;
  }

  private mapVehicle(raw: {
    id: string;
    userId: string;
    licensePlate: string;
    vehicleType: string;
    make: string | null;
    model: string | null;
    color: string | null;
    isDefault: boolean;
    createdAt: Date;
  }): Vehicle {
    return {
      id: raw.id,
      userId: raw.userId,
      licensePlate: raw.licensePlate,
      vehicleType: raw.vehicleType as VehicleType,
      make: raw.make || undefined,
      model: raw.model || undefined,
      color: raw.color || undefined,
      isDefault: raw.isDefault,
      createdAt: raw.createdAt.toISOString(),
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
