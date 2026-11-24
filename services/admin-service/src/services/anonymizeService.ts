// ============================================================
// DPDPA 2023 Compliant User Anonymization & Deletion Service
// ============================================================

import { PrismaClient, Prisma } from '@prisma/client';
import {
  ValidationError,
  NotFoundError,
  logger,
  publishEvent,
} from '@parkly/shared';

export interface AnonymizeUserResult {
  userId: string;
  isAnonymized: boolean;
  anonymizedAt: string;
  message: string;
}

export const ACTIVE_BOOKING_STATUSES = ['created', 'pending', 'confirmed', 'active'];

/**
 * Anonymize user personal data and soft delete accounts under DPDPA (Right to Erasure)
 * while preserving financial transaction and booking history for statutory tax/accounting compliance.
 */
export async function anonymizeUser(
  userId: string,
  prisma: PrismaClient,
): Promise<AnonymizeUserResult> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      bookings: {
        where: { deletedAt: null },
      },
      vehicles: true,
      host: true,
    },
  });

  if (!user) {
    throw new NotFoundError(`User not found: ${userId}`);
  }

  // Check if user has active ongoing bookings as driver
  const hasActiveDriverBookings = user.bookings.some((b) =>
    ACTIVE_BOOKING_STATUSES.includes(b.status as string),
  );

  // Check if user has active ongoing bookings as host
  let hasActiveHostBookings = false;
  if (user.host) {
    const hostBookings = await prisma.booking.findMany({
      where: {
        hostId: user.host.id,
        deletedAt: null,
      },
    });
    hasActiveHostBookings = hostBookings.some((b) =>
      ACTIVE_BOOKING_STATUSES.includes(b.status as string),
    );
  }

  if (hasActiveDriverBookings || hasActiveHostBookings) {
    throw new ValidationError('Cannot anonymize user with active bookings');
  }

  if (user.isAnonymized) {
    return {
      userId,
      isAnonymized: true,
      anonymizedAt: user.anonymizedAt ? user.anonymizedAt.toISOString() : new Date().toISOString(),
      message: 'User is already anonymized',
    };
  }

  const now = new Date();
  const anonymizedPhone = `ANON_${user.id}`;

  await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    // 1. Transactionally update User:
    // name = 'Anonymized User', phone = 'ANON_' + id, email = null, isActive = false, isAnonymized = true, anonymizedAt = now(), deletedAt = now()
    await tx.user.update({
      where: { id: userId },
      data: {
        name: 'Anonymized User',
        phone: anonymizedPhone,
        email: null,
        isActive: false,
        isAnonymized: true,
        anonymizedAt: now,
        deletedAt: now,
      },
    });

    // 2. Transactionally update Associated Vehicles:
    // licensePlate = 'ANON_' + id, deletedAt = now()
    for (const vehicle of user.vehicles) {
      await tx.vehicle.update({
        where: { id: vehicle.id },
        data: {
          licensePlate: `ANON_${vehicle.id}`,
          make: null,
          model: null,
          color: null,
          deletedAt: now,
        },
      });
    }

    // 3. If user is Host:
    // panNumber = null, bankAccountNumber = null, ifscCode = null, isAnonymized = true, deletedAt = now()
    if (user.host) {
      await tx.host.update({
        where: { id: user.host.id },
        data: {
          businessName: 'Anonymized Host',
          panNumber: null,
          bankAccountNumber: null,
          ifscCode: null,
          isAnonymized: true,
          deletedAt: now,
        },
      });

      // Deactivate any active parking spaces for this host
      await tx.parkingSpace.updateMany({
        where: { hostId: user.host.id },
        data: { status: 'inactive' },
      });
    }
  });

  // Preserve financial transaction and booking history for statutory tax/accounting compliance without PII
  // (Notice: bookings and payments remain in database linked to user.id, but all PII is redacted)

  // 4. Publish Event for Audit Log & notification purging
  try {
    await publishEvent({
      type: 'UserAnonymized' as any,
      version: '1.0',
      timestamp: now.toISOString(),
      source: 'parkly.admin-service',
      data: { userId, anonymizedAt: now.toISOString() },
    });
  } catch (eventErr: any) {
    logger.warn({ err: eventErr.message, userId }, 'Failed to publish UserAnonymized event');
  }

  logger.info({ userId }, 'User personal data anonymized successfully for DPDPA compliance');

  return {
    userId,
    isAnonymized: true,
    anonymizedAt: now.toISOString(),
    message: 'User personal data anonymized successfully',
  };
}
