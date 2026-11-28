// ============================================================
// Auth Service — Vehicle Service (Prisma/PostgreSQL)
// ============================================================

import { PrismaClient, Prisma } from '@prisma/client';
import {
  Vehicle,
  VehicleType,
  generateId,
  ConflictError,
  NotFoundError,
  ValidationError,
} from '@parkly/shared';

const defaultPrisma = new PrismaClient();

export interface CreateVehicleInput {
  licensePlate: string;
  vehicleType: VehicleType;
  make?: string;
  model?: string;
  color?: string;
  rcNumber?: string;
  rcDocumentUrl?: string;
  insuranceNumber?: string;
  pucValidUntil?: string;
  isDefault?: boolean;
}

export class VehicleService {
  constructor(private readonly prisma: PrismaClient = defaultPrisma) {}

  async listVehicles(userId: string): Promise<Vehicle[]> {
    const vehicles = await this.prisma.vehicle.findMany({
      where: { userId, deletedAt: null },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
    });
    return vehicles.map((v) => this.mapVehicle(v));
  }

  async createVehicle(userId: string, input: CreateVehicleInput): Promise<Vehicle> {
    const normalizedPlate = input.licensePlate.trim().toUpperCase().replace(/\s+/g, '');

    return this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const existing = await tx.vehicle.findUnique({
        where: { licensePlate: normalizedPlate },
      });

      if (existing && !existing.deletedAt) {
        if (existing.userId === userId) {
          throw new ConflictError('This vehicle is already saved in your garage', 'licensePlate');
        }
        throw new ConflictError('This license plate is already registered to another account', 'licensePlate');
      }

      const activeCount = await tx.vehicle.count({
        where: { userId, deletedAt: null },
      });
      const shouldBeDefault = input.isDefault ?? activeCount === 0;

      if (shouldBeDefault && activeCount > 0) {
        await tx.vehicle.updateMany({
          where: { userId, deletedAt: null, isDefault: true },
          data: { isDefault: false },
        });
      }

      if (existing && existing.deletedAt) {
        if (existing.userId === userId) {
          const restored = await tx.vehicle.update({
            where: { id: existing.id },
            data: {
              deletedAt: null,
              vehicleType: input.vehicleType,
              make: input.make?.trim() || null,
              model: input.model?.trim() || null,
              color: input.color?.trim() || null,
              rcNumber: input.rcNumber?.trim().toUpperCase() || null,
              rcDocumentUrl: input.rcDocumentUrl?.trim() || null,
              insuranceNumber: input.insuranceNumber?.trim().toUpperCase() || null,
              pucValidUntil: input.pucValidUntil ? new Date(input.pucValidUntil) : null,
              isDefault: shouldBeDefault,
            },
          });
          return this.mapVehicle(restored);
        }

        // Preserve historical booking FKs for the prior deleted owner while freeing the plate
        await tx.vehicle.update({
          where: { id: existing.id },
          data: { licensePlate: `DEL_${existing.id.slice(0, 8)}_${normalizedPlate}` },
        });
      }

      const created = await tx.vehicle.create({
        data: {
          id: generateId(),
          userId,
          licensePlate: normalizedPlate,
          vehicleType: input.vehicleType,
          make: input.make?.trim() || null,
          model: input.model?.trim() || null,
          color: input.color?.trim() || null,
          rcNumber: input.rcNumber?.trim().toUpperCase() || null,
          rcDocumentUrl: input.rcDocumentUrl?.trim() || null,
          insuranceNumber: input.insuranceNumber?.trim().toUpperCase() || null,
          pucValidUntil: input.pucValidUntil ? new Date(input.pucValidUntil) : null,
          isDefault: shouldBeDefault,
        },
      });
      return this.mapVehicle(created);
    });
  }

  async setDefaultVehicle(userId: string, vehicleId: string): Promise<Vehicle> {
    return this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const vehicle = await tx.vehicle.findFirst({
        where: { id: vehicleId, userId, deletedAt: null },
      });
      if (!vehicle) {
        throw new NotFoundError('Vehicle not found');
      }

      await tx.vehicle.updateMany({
        where: { userId, deletedAt: null, isDefault: true },
        data: { isDefault: false },
      });

      const updated = await tx.vehicle.update({
        where: { id: vehicleId },
        data: { isDefault: true },
      });
      return this.mapVehicle(updated);
    });
  }

  async deleteVehicle(userId: string, vehicleId: string): Promise<{ deleted: true; id: string }> {
    return this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const vehicle = await tx.vehicle.findFirst({
        where: { id: vehicleId, userId, deletedAt: null },
      });
      if (!vehicle) {
        throw new NotFoundError('Vehicle not found');
      }

      const activeBookingCount = await tx.booking.count({
        where: {
          vehicleId,
          status: { in: ['created', 'confirmed', 'active'] },
          deletedAt: null,
        },
      });
      if (activeBookingCount > 0) {
        throw new ValidationError('Cannot remove a vehicle with an active or upcoming reservation');
      }

      const totalBookingCount = await tx.booking.count({
        where: { vehicleId },
      });

      if (totalBookingCount > 0) {
        await tx.vehicle.update({
          where: { id: vehicleId },
          data: { deletedAt: new Date(), isDefault: false },
        });
      } else {
        await tx.vehicle.delete({
          where: { id: vehicleId },
        });
      }

      if (vehicle.isDefault) {
        const nextDefault = await tx.vehicle.findFirst({
          where: { userId, deletedAt: null },
          orderBy: { createdAt: 'desc' },
        });
        if (nextDefault) {
          await tx.vehicle.update({
            where: { id: nextDefault.id },
            data: { isDefault: true },
          });
        }
      }

      return { deleted: true as const, id: vehicleId };
    });
  }

  private mapVehicle(raw: {
    id: string;
    userId: string;
    licensePlate: string;
    vehicleType: string;
    make: string | null;
    model: string | null;
    color: string | null;
    rcNumber?: string | null;
    rcDocumentUrl?: string | null;
    insuranceNumber?: string | null;
    pucValidUntil?: Date | null;
    verificationStatus?: string;
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
      rcNumber: raw.rcNumber || undefined,
      rcDocumentUrl: raw.rcDocumentUrl || undefined,
      insuranceNumber: raw.insuranceNumber || undefined,
      pucValidUntil: raw.pucValidUntil ? raw.pucValidUntil.toISOString() : undefined,
      verificationStatus: (raw.verificationStatus as Vehicle['verificationStatus']) || 'pending',
      isDefault: raw.isDefault,
      createdAt: raw.createdAt.toISOString(),
    };
  }
}

export const vehicleService = new VehicleService();
