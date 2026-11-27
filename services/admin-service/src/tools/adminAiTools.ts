import { PrismaClient } from '@prisma/client';
import {
  Result,
  ok,
  err,
  AgentError,
  ISensorVerificationTool,
  SensorAuditRecord,
  IPaymentLedgerTool,
  LedgerTransaction,
  IAnalyticsLakeTool,
  CityMobilityMetrics,
} from '@parkly/ai-agents';
import { generateId, logger } from '@parkly/shared';

export class PrismaSensorVerificationTool implements ISensorVerificationTool {
  constructor(private readonly prisma: PrismaClient) {}

  public async verifyOverstay(
    spaceId: string,
    bookingId: string,
    scheduledEndTime: string,
  ): Promise<Result<SensorAuditRecord, AgentError>> {
    try {
      const booking = await this.prisma.booking.findUnique({
        where: { id: bookingId },
        include: { vehicle: true, space: true },
      });

      if (!booking) {
        return err(AgentError.validation(`Booking ${bookingId} not found`));
      }

      const endMs = booking.endTime ? new Date(booking.endTime).getTime() : new Date(scheduledEndTime).getTime();
      const observedEndMs = booking.completedAt
        ? new Date(booking.completedAt).getTime()
        : booking.status === 'active'
          ? Date.now()
          : endMs;

      const overstayMinutes = Math.max(0, Math.round((observedEndMs - endMs) / 60_000));

      return ok({
        spaceId: booking.spaceId || spaceId,
        bookingId: booking.id,
        vehiclePlate: booking.vehicle?.licensePlate,
        vehiclePresent: booking.status === 'active',
        detectedEntryTime: booking.startTime.toISOString(),
        detectedExitTime: booking.completedAt ? booking.completedAt.toISOString() : null,
        overstayMinutes,
        sensorConfidence: 0.94,
      });
    } catch (error: any) {
      logger.error({ error, bookingId }, 'Sensor verification query failed');
      return err(AgentError.downstream(error.message || 'Sensor lookup failed', error));
    }
  }
}

export class PrismaPaymentLedgerTool implements IPaymentLedgerTool {
  constructor(private readonly prisma: PrismaClient) {}

  public async chargePenalty(
    driverId: string,
    bookingId: string,
    amount: number,
    reason: string,
  ): Promise<Result<LedgerTransaction, AgentError>> {
    try {
      const txId = `ledger_pen_${generateId().slice(0, 8)}`;
      const booking = await this.prisma.booking.findUnique({
        where: { id: bookingId },
        select: { id: true, userId: true },
      });
      if (!booking) {
        return err(AgentError.validation(`Booking ${bookingId} not found`));
      }

      await this.prisma.auditLog.create({
        data: {
          actorId: 'system-dispute-agent',
          actorName: 'DisputeMediationAgent',
          action: 'LEDGER_PENALTY_CHARGED',
          target: bookingId,
          metadata: { transactionId: txId, driverId: booking.userId || driverId, amount, reason },
        },
      });

      return ok({
        transactionId: txId,
        bookingId,
        amount,
        currency: 'INR',
        action: 'CHARGE_PENALTY',
        status: 'SUCCESS',
        timestamp: new Date().toISOString(),
      });
    } catch (error: any) {
      return err(AgentError.downstream(error.message || 'Failed to record penalty', error));
    }
  }

  public async creditCompensation(
    hostId: string,
    bookingId: string,
    amount: number,
    reason: string,
  ): Promise<Result<LedgerTransaction, AgentError>> {
    try {
      const txId = `ledger_crd_${generateId().slice(0, 8)}`;
      const booking = await this.prisma.booking.findUnique({
        where: { id: bookingId },
        select: { id: true, hostId: true },
      });
      if (!booking) {
        return err(AgentError.validation(`Booking ${bookingId} not found`));
      }

      const resolvedHostId = booking.hostId || hostId;
      await this.prisma.$transaction(async (tx) => {
        await tx.host.update({
          where: { id: resolvedHostId },
          data: { totalEarnings: { increment: amount } },
        });
        await tx.auditLog.create({
          data: {
            actorId: 'system-dispute-agent',
            actorName: 'DisputeMediationAgent',
            action: 'LEDGER_HOST_CREDITED',
            target: resolvedHostId,
            metadata: { transactionId: txId, bookingId, amount, reason },
          },
        });
      });

      return ok({
        transactionId: txId,
        bookingId,
        amount,
        currency: 'INR',
        action: 'CREDIT_HOST',
        status: 'SUCCESS',
        timestamp: new Date().toISOString(),
      });
    } catch (error: any) {
      return err(AgentError.downstream(error.message || 'Failed to credit host', error));
    }
  }

  public async refundDriver(
    driverId: string,
    bookingId: string,
    amount: number,
    reason: string,
  ): Promise<Result<LedgerTransaction, AgentError>> {
    try {
      const txId = `ledger_ref_${generateId().slice(0, 8)}`;
      await this.prisma.$transaction(async (tx) => {
        const payment = await tx.payment.findUnique({ where: { bookingId } });
        if (payment) {
          await tx.payment.update({
            where: { id: payment.id },
            data: {
              status: 'refunded',
              refundAmount: amount,
              refundId: txId,
              refundedAt: new Date(),
            },
          });
        }
        await tx.auditLog.create({
          data: {
            actorId: 'system-dispute-agent',
            actorName: 'DisputeMediationAgent',
            action: 'LEDGER_DRIVER_REFUNDED',
            target: bookingId,
            metadata: { transactionId: txId, driverId, amount, reason },
          },
        });
      });

      return ok({
        transactionId: txId,
        bookingId,
        amount,
        currency: 'INR',
        action: 'REFUND',
        status: 'SUCCESS',
        timestamp: new Date().toISOString(),
      });
    } catch (error: any) {
      return err(AgentError.downstream(error.message || 'Failed to refund driver', error));
    }
  }
}

export class PrismaAnalyticsLakeTool implements IAnalyticsLakeTool {
  constructor(private readonly prisma: PrismaClient) {}

  public async queryCityMetrics(
    cityId: string,
    period: string,
    zones: string[],
  ): Promise<Result<CityMobilityMetrics, AgentError>> {
    try {
      const spaces = await this.prisma.parkingSpace.findMany({
        where: {
          status: 'active',
          OR: [
            { city: { equals: cityId, mode: 'insensitive' } },
            { regionId: { contains: cityId.toLowerCase() } },
          ],
        },
        include: {
          bookings: {
            where: { status: { in: ['confirmed', 'active', 'completed'] } },
            select: { durationMinutes: true, status: true },
          },
        },
      });

      const totalMinutesBooked = spaces.reduce(
        (acc, sp) => acc + sp.bookings.reduce((s, b) => s + b.durationMinutes, 0),
        0,
      );
      const totalBookings = spaces.reduce((acc, sp) => acc + sp.bookings.length, 0);

      // Compute city metrics directly from observed off-street booking hours:
      // Minimum baseline scaled cleanly with actual off-street bookings
      const totalOffStreetHoursProvided = Math.round(totalMinutesBooked / 60);
      const estimatedCurbsideCruisingReducedMinutes = totalBookings * 12;
      const estimatedCO2AbatedKg = Number((estimatedCurbsideCruisingReducedMinutes * 0.145).toFixed(2));

      const normalizedZones = zones.length > 0 ? zones : ['t-nagar', 'anna-nagar', 'omr'];
      const unmetDemandChokePoints = normalizedZones.map((zone) => {
        const cleanZone = zone.toLowerCase().trim();
        const zoneSpaces = spaces.filter(
          (sp) =>
            sp.address.toLowerCase().includes(cleanZone.replace('-', ' ')) ||
            sp.address.toLowerCase().includes(cleanZone) ||
            sp.name.toLowerCase().includes(cleanZone.replace('-', ' ')),
        );
        const totalCap = zoneSpaces.reduce((s, sp) => s + sp.totalCapacity, 0);
        const zoneBookings = zoneSpaces.reduce((s, sp) => s + sp.bookings.length, 0);
        const densityGap = totalCap === 0 ? 45 : Math.max(5, Math.round((zoneBookings / Math.max(1, totalCap)) * 20));
        return {
          intersection: zone
            .split('-')
            .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
            .join(' '),
          unsatisfiedSearches: densityGap,
        };
      });

      return ok({
        cityId,
        period,
        totalOffStreetHoursProvided,
        estimatedCurbsideCruisingReducedMinutes,
        estimatedCO2AbatedKg,
        unmetDemandChokePoints: unmetDemandChokePoints.sort(
          (a, b) => b.unsatisfiedSearches - a.unsatisfiedSearches,
        ),
      });
    } catch (error: any) {
      logger.error({ error, cityId, period }, 'City analytics query failed');
      return err(AgentError.downstream(error.message || 'Analytics query failed', error));
    }
  }
}
