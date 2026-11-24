// ============================================================
// Tests — DPDPA User Anonymization & Soft Deletion Service
// ============================================================

import { anonymizeUser } from '../services/anonymizeService';
import { ValidationError, NotFoundError } from '@parkly/shared';

describe('DPDPA anonymizeUser service', () => {
  const mockUserId = 'usr-test-1234-uuid';
  const mockVehicleId1 = 'veh-test-5678-uuid';
  const mockVehicleId2 = 'veh-test-9999-uuid';
  const mockHostId = 'host-test-4321-uuid';

  it('throws NotFoundError if user does not exist', async () => {
    const mockPrisma: any = {
      user: {
        findUnique: jest.fn().mockResolvedValue(null),
      },
    };

    await expect(anonymizeUser('non-existent-user', mockPrisma)).rejects.toThrow(
      NotFoundError,
    );
  });

  it('rejects with 400 (ValidationError) if user has active ongoing bookings as driver', async () => {
    const mockPrisma: any = {
      user: {
        findUnique: jest.fn().mockResolvedValue({
          id: mockUserId,
          name: 'Suresh Kumar',
          phone: '+919876543210',
          email: 'suresh@example.com',
          isAnonymized: false,
          bookings: [
            { id: 'b1', status: 'confirmed', deletedAt: null },
          ],
          vehicles: [],
          host: null,
        }),
      },
    };

    await expect(anonymizeUser(mockUserId, mockPrisma)).rejects.toThrow(
      new ValidationError('Cannot anonymize user with active bookings'),
    );
  });

  it('rejects with 400 (ValidationError) if host has active ongoing bookings on their parking spaces', async () => {
    const mockPrisma: any = {
      user: {
        findUnique: jest.fn().mockResolvedValue({
          id: mockUserId,
          name: 'Host User',
          phone: '+919876543210',
          email: 'host@example.com',
          isAnonymized: false,
          bookings: [], // no driver bookings
          vehicles: [],
          host: { id: mockHostId },
        }),
      },
      booking: {
        findMany: jest.fn().mockResolvedValue([
          { id: 'b2', status: 'active', deletedAt: null },
        ]),
      },
    };

    await expect(anonymizeUser(mockUserId, mockPrisma)).rejects.toThrow(
      new ValidationError('Cannot anonymize user with active bookings'),
    );
  });

  it('transactionally anonymizes User, Vehicles, and Host while preserving financial records', async () => {
    const updateMockUser = jest.fn();
    const updateMockVehicle = jest.fn();
    const updateMockHost = jest.fn();
    const updateManyMockSpace = jest.fn();

    const mockPrisma: any = {
      user: {
        findUnique: jest.fn().mockResolvedValue({
          id: mockUserId,
          name: 'Deepak Raj',
          phone: '+919123456789',
          email: 'deepak@example.com',
          role: 'host',
          isActive: true,
          isAnonymized: false,
          bookings: [
            // Only completed and cancelled bookings
            { id: 'b-completed', status: 'completed', deletedAt: null },
            { id: 'b-cancelled', status: 'cancelled', deletedAt: null },
          ],
          vehicles: [
            { id: mockVehicleId1, licensePlate: 'TN09AB1234' },
            { id: mockVehicleId2, licensePlate: 'TN09CD5678' },
          ],
          host: {
            id: mockHostId,
            panNumber: 'ABCDE1234F',
            bankAccountNumber: '98765432101234',
            ifscCode: 'HDFC0001234',
            businessName: 'Deepak Prime Parking',
          },
        }),
      },
      booking: {
        findMany: jest.fn().mockResolvedValue([
          // No active bookings for host
          { id: 'hb-completed', status: 'completed', deletedAt: null },
        ]),
      },
      $transaction: jest.fn().mockImplementation(async (callback) => {
        const tx = {
          user: { update: updateMockUser },
          vehicle: { update: updateMockVehicle },
          host: { update: updateMockHost },
          parkingSpace: { updateMany: updateManyMockSpace },
        };
        return callback(tx);
      }),
    };

    const result = await anonymizeUser(mockUserId, mockPrisma);

    expect(result.userId).toBe(mockUserId);
    expect(result.isAnonymized).toBe(true);
    expect(result.message).toBe('User personal data anonymized successfully');

    // 1. Verify User update
    expect(updateMockUser).toHaveBeenCalledTimes(1);
    const userUpdateArg = updateMockUser.mock.calls[0][0];
    expect(userUpdateArg.where).toEqual({ id: mockUserId });
    expect(userUpdateArg.data.name).toBe('Anonymized User');
    expect(userUpdateArg.data.phone).toBe(`ANON_${mockUserId}`);
    expect(userUpdateArg.data.email).toBeNull();
    expect(userUpdateArg.data.isActive).toBe(false);
    expect(userUpdateArg.data.isAnonymized).toBe(true);
    expect(userUpdateArg.data.anonymizedAt).toBeInstanceOf(Date);
    expect(userUpdateArg.data.deletedAt).toBeInstanceOf(Date);

    // 2. Verify Vehicle updates
    expect(updateMockVehicle).toHaveBeenCalledTimes(2);
    expect(updateMockVehicle).toHaveBeenNthCalledWith(1, {
      where: { id: mockVehicleId1 },
      data: {
        licensePlate: `ANON_${mockVehicleId1}`,
        make: null,
        model: null,
        color: null,
        deletedAt: expect.any(Date),
      },
    });
    expect(updateMockVehicle).toHaveBeenNthCalledWith(2, {
      where: { id: mockVehicleId2 },
      data: {
        licensePlate: `ANON_${mockVehicleId2}`,
        make: null,
        model: null,
        color: null,
        deletedAt: expect.any(Date),
      },
    });

    // 3. Verify Host update
    expect(updateMockHost).toHaveBeenCalledTimes(1);
    expect(updateMockHost).toHaveBeenCalledWith({
      where: { id: mockHostId },
      data: {
        businessName: 'Anonymized Host',
        panNumber: null,
        bankAccountNumber: null,
        ifscCode: null,
        isAnonymized: true,
        deletedAt: expect.any(Date),
      },
    });

    // 4. Verify parking spaces deactivated
    expect(updateManyMockSpace).toHaveBeenCalledWith({
      where: { hostId: mockHostId },
      data: { status: 'inactive' },
    });
  });

  it('returns gracefully if user is already anonymized (idempotency)', async () => {
    const pastDate = new Date('2026-01-01T00:00:00Z');
    const mockPrisma: any = {
      user: {
        findUnique: jest.fn().mockResolvedValue({
          id: mockUserId,
          name: 'Anonymized User',
          phone: `ANON_${mockUserId}`,
          email: null,
          isAnonymized: true,
          anonymizedAt: pastDate,
          deletedAt: pastDate,
          bookings: [],
          vehicles: [],
          host: null,
        }),
      },
    };

    const result = await anonymizeUser(mockUserId, mockPrisma);
    expect(result.userId).toBe(mockUserId);
    expect(result.isAnonymized).toBe(true);
    expect(result.message).toBe('User is already anonymized');
    expect(result.anonymizedAt).toBe(pastDate.toISOString());
  });
});
