process.env['NODE_ENV'] = 'test';
process.env['JWT_ACCESS_SECRET'] = 'test-jwt-access-secret-for-booking-security-at-least-32';
process.env['JWT_REFRESH_SECRET'] = 'test-jwt-refresh-secret-for-booking-security-at-least-32';

const mockTx: any = {
  $queryRaw: jest.fn(),
  vehicle: { findUnique: jest.fn() },
  booking: { count: jest.fn(), create: jest.fn(), findUnique: jest.fn(), update: jest.fn() },
};

const mockPrisma: any = {
  $transaction: jest.fn(async (cb: any) => cb(mockTx)),
  booking: { findUnique: jest.fn(), findMany: jest.fn(), count: jest.fn(), update: jest.fn() },
  pricingRule: { findFirst: jest.fn().mockResolvedValue(null) },
  $queryRaw: jest.fn().mockResolvedValue([{ 1: 1 }]),
};

jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn(() => mockPrisma),
}));

import { bookingService, generateQrToken, verifyQrSignature } from '../services/bookingService';

describe('Booking Security, Concurrency & Integrity Invariants', () => {
  const futureStart = () => new Date(Date.now() + 2 * 60 * 60 * 1000);
  const futureEnd = (start: Date, hours = 2) => new Date(start.getTime() + hours * 60 * 60 * 1000);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('prevents booking with another user vehicle (IDOR AuthorizationError)', async () => {
    const startTime = futureStart();
    const endTime = futureEnd(startTime);
    mockTx.$queryRaw.mockResolvedValue([
      { id: 'sp-tng-001', host_id: 'host-1', total_capacity: 10, hourly_rate: 40, dynamic_pricing: false, status: 'active' },
    ]);
    mockTx.vehicle.findUnique.mockResolvedValue({ id: 'veh-other', userId: 'other-user-id', deletedAt: null });

    await expect(
      bookingService.createBooking({
        userId: 'driver-1',
        spaceId: 'sp-tng-001',
        vehicleId: 'veh-other',
        hostId: 'host-1',
        type: 'instant',
        startTime,
        endTime,
        totalAmount: 84,
      }),
    ).rejects.toThrow('Cannot create booking with a vehicle owned by another user');
  });

  it('prevents overbooking when active overlapping count reaches total_capacity (ConflictError)', async () => {
    const startTime = futureStart();
    const endTime = futureEnd(startTime);
    mockTx.$queryRaw.mockResolvedValue([
      { id: 'sp-tng-001', host_id: 'host-1', total_capacity: 2, hourly_rate: 40, dynamic_pricing: false, status: 'active' },
    ]);
    mockTx.vehicle.findUnique.mockResolvedValue({ id: 'veh-1', userId: 'driver-1', deletedAt: null });
    mockTx.booking.count.mockResolvedValue(2);

    await expect(
      bookingService.createBooking({
        userId: 'driver-1',
        spaceId: 'sp-tng-001',
        vehicleId: 'veh-1',
        hostId: 'host-1',
        type: 'instant',
        startTime,
        endTime,
        totalAmount: 84,
      }),
    ).rejects.toThrow('No bays available for the selected time window');
  });

  it('computes authoritative server-side pricing ignoring tampered client totalAmount', async () => {
    const startTime = futureStart();
    const endTime = futureEnd(startTime, 2);
    mockTx.$queryRaw.mockResolvedValue([
      { id: 'sp-tng-001', host_id: 'host-1', total_capacity: 10, hourly_rate: 60, dynamic_pricing: false, status: 'active' },
    ]);
    mockTx.vehicle.findUnique.mockResolvedValue({ id: 'veh-1', userId: 'driver-1', deletedAt: null });
    mockTx.booking.count.mockResolvedValue(0);
    mockTx.booking.create.mockImplementation(async ({ data }: any) => ({
      ...data,
      createdAt: new Date(),
      updatedAt: new Date(),
      space: { id: 'sp-tng-001', name: 'T Nagar', address: 'T Nagar', latitude: 13.0418, longitude: 80.2341 },
      vehicle: { id: 'veh-1', licensePlate: 'TN01AB1234', vehicleType: 'sedan' },
    }));

    const result = await bookingService.createBooking({
      userId: 'driver-1',
      spaceId: 'sp-tng-001',
      vehicleId: 'veh-1',
      hostId: 'host-1',
      type: 'instant',
      startTime,
      endTime, // 2 hours * ₹60 = ₹120 + 5% (₹6) = ₹126
      totalAmount: 1, // Tampered client price!
    });

    expect(result.totalAmount).toBe(126);
    expect(result.qrToken).toContain('PARKLY.v1.');
    expect(verifyQrSignature(result.qrToken!, result.id, result.spaceId, result.vehicleId, result.endTime)).toBe(true);
  });

  it('rejects tampered QR token signatures', () => {
    const token = generateQrToken('bk-1', 'sp-1', 'veh-1', '2026-12-01T12:00:00.000Z');
    expect(verifyQrSignature(token, 'bk-1', 'sp-1', 'veh-1', '2026-12-01T12:00:00.000Z')).toBe(true);
    expect(verifyQrSignature(`${token}tampered`, 'bk-1', 'sp-1', 'veh-1', '2026-12-01T12:00:00.000Z')).toBe(false);
  });
});
