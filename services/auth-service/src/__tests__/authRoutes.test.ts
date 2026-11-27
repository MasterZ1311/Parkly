process.env['NODE_ENV'] = 'test';
process.env['JWT_ACCESS_SECRET'] = 'test-jwt-access-secret-for-auth-service-at-least-32-chars';
process.env['JWT_REFRESH_SECRET'] = 'test-jwt-refresh-secret-for-auth-service-at-least-32-chars';

import request from 'supertest';
import jwt from 'jsonwebtoken';
import { app } from '../index';
import { userService, UserService } from '../services/userService';
import { vehicleService, VehicleService } from '../services/vehicleService';

jest.mock('@prisma/client', () => {
  return {
    PrismaClient: jest.fn().mockImplementation(() => ({
      $queryRaw: jest.fn().mockResolvedValue([{ 1: 1 }]),
      $disconnect: jest.fn().mockResolvedValue(undefined),
    })),
  };
});

describe('Auth Service Profile & Vehicle Routes', () => {
  const jwtSecret = process.env['JWT_ACCESS_SECRET']!;
  const testUserId = '00000000-0000-4000-8000-000000000003';
  const validToken = jwt.sign(
    { sub: testUserId, role: 'driver', phone: '+919876543211' },
    jwtSecret,
    { expiresIn: '1h' },
  );

  const mockUser = {
    id: testUserId,
    phone: '+919876543211',
    name: 'Arjun Kumar',
    email: 'arjun@parkly.in',
    role: 'driver' as const,
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const mockVehicle = {
    id: '00000000-0000-4000-8000-000000000201',
    userId: testUserId,
    licensePlate: 'TN01AB1234',
    vehicleType: 'sedan' as const,
    make: 'Honda',
    model: 'City',
    color: 'White',
    isDefault: true,
    createdAt: new Date().toISOString(),
  };

  beforeEach(() => {
    jest.restoreAllMocks();
  });

  describe('PATCH /auth/me', () => {
    it('requires authentication', async () => {
      const res = await request(app).patch('/auth/me').send({ name: 'New Name' });
      expect(res.status).toBe(401);
    });

    it('rejects empty update body', async () => {
      const res = await request(app)
        .patch('/auth/me')
        .set('Authorization', `Bearer ${validToken}`)
        .send({});
      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('rejects invalid email format', async () => {
      const res = await request(app)
        .patch('/auth/me')
        .set('Authorization', `Bearer ${validToken}`)
        .send({ email: 'not-an-email' });
      expect(res.status).toBe(400);
    });

    it('updates name and email for authenticated user', async () => {
      const spy = jest.spyOn(userService, 'updateUser').mockResolvedValue({
        ...mockUser,
        name: 'Arjun V',
        email: 'arjun.v@parkly.in',
      });

      const res = await request(app)
        .patch('/auth/me')
        .set('Authorization', `Bearer ${validToken}`)
        .send({ name: 'Arjun V', email: 'arjun.v@parkly.in' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.user.name).toBe('Arjun V');
      expect(spy).toHaveBeenCalledWith(testUserId, { name: 'Arjun V', email: 'arjun.v@parkly.in' });
    });
  });

  describe('GET/POST/PUT/DELETE /auth/vehicles', () => {
    it('requires authentication for GET /auth/vehicles', async () => {
      const res = await request(app).get('/auth/vehicles');
      expect(res.status).toBe(401);
    });

    it('lists vehicles for authenticated user', async () => {
      jest.spyOn(vehicleService, 'listVehicles').mockResolvedValue([mockVehicle]);

      const res = await request(app)
        .get('/auth/vehicles')
        .set('Authorization', `Bearer ${validToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.vehicles).toHaveLength(1);
      expect(res.body.data.vehicles[0].licensePlate).toBe('TN01AB1234');
    });

    it('rejects invalid Indian license plate on POST /auth/vehicles', async () => {
      const res = await request(app)
        .post('/auth/vehicles')
        .set('Authorization', `Bearer ${validToken}`)
        .send({ licensePlate: 'INVALID', vehicleType: 'sedan' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('normalizes plate and creates vehicle on POST /auth/vehicles', async () => {
      const spy = jest.spyOn(vehicleService, 'createVehicle').mockResolvedValue(mockVehicle);

      const res = await request(app)
        .post('/auth/vehicles')
        .set('Authorization', `Bearer ${validToken}`)
        .send({
          licensePlate: ' tn 01 ab 1234 ',
          vehicleType: 'sedan',
          make: 'Honda',
          model: 'City',
          isDefault: true,
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.vehicle.id).toBe(mockVehicle.id);
      expect(spy).toHaveBeenCalledWith(
        testUserId,
        expect.objectContaining({
          licensePlate: 'TN01AB1234',
          vehicleType: 'sedan',
          isDefault: true,
        }),
      );
    });

    it('rejects non-UUID vehicle ID on DELETE /auth/vehicles/:id', async () => {
      const res = await request(app)
        .delete('/auth/vehicles/not-a-uuid')
        .set('Authorization', `Bearer ${validToken}`);

      expect(res.status).toBe(400);
    });

    it('deletes vehicle for authenticated owner', async () => {
      const spy = jest.spyOn(vehicleService, 'deleteVehicle').mockResolvedValue({
        deleted: true,
        id: mockVehicle.id,
      });

      const res = await request(app)
        .delete(`/auth/vehicles/${mockVehicle.id}`)
        .set('Authorization', `Bearer ${validToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.deleted).toBe(true);
      expect(spy).toHaveBeenCalledWith(testUserId, mockVehicle.id);
    });
  });

  describe('UserService & VehicleService unit invariants', () => {
    it('UserService.updateUser throws ConflictError on Prisma P2002 email collision', async () => {
      const prismaMock = {
        user: {
          findUnique: jest.fn().mockResolvedValue({
            id: testUserId,
            deletedAt: null,
          }),
          update: jest.fn().mockRejectedValue({ code: 'P2002' }),
        },
      } as any;

      const svc = new UserService(prismaMock);
      await expect(svc.updateUser(testUserId, { email: 'taken@parkly.in' })).rejects.toThrow(
        'Email address is already in use',
      );
    });

    it('VehicleService.createVehicle sets first vehicle as default automatically', async () => {
      const txMock = {
        vehicle: {
          findUnique: jest.fn().mockResolvedValue(null),
          count: jest.fn().mockResolvedValue(0),
          updateMany: jest.fn(),
          create: jest.fn().mockImplementation(({ data }) =>
            Promise.resolve({ ...data, createdAt: new Date() }),
          ),
        },
      };
      const prismaMock = {
        $transaction: jest.fn().mockImplementation((fn) => fn(txMock)),
      } as any;

      const svc = new VehicleService(prismaMock);
      const created = await svc.createVehicle(testUserId, {
        licensePlate: 'TN09CD4567',
        vehicleType: 'compact',
      });

      expect(created.isDefault).toBe(true);
      expect(created.licensePlate).toBe('TN09CD4567');
    });

    it('VehicleService.deleteVehicle blocks removal when active booking exists', async () => {
      const txMock = {
        vehicle: {
          findFirst: jest.fn().mockResolvedValue({ ...mockVehicle, deletedAt: null }),
        },
        booking: {
          count: jest.fn().mockResolvedValue(1),
        },
      };
      const prismaMock = {
        $transaction: jest.fn().mockImplementation((fn) => fn(txMock)),
      } as any;

      const svc = new VehicleService(prismaMock);
      await expect(svc.deleteVehicle(testUserId, mockVehicle.id)).rejects.toThrow(
        'Cannot remove a vehicle with an active or upcoming reservation',
      );
    });

    it('VehicleService.deleteVehicle soft-deletes when historical bookings exist and promotes next default', async () => {
      const txMock = {
        vehicle: {
          findFirst: jest
            .fn()
            .mockResolvedValueOnce({ ...mockVehicle, deletedAt: null })
            .mockResolvedValueOnce({ id: '00000000-0000-4000-8000-000000000202' }),
          update: jest.fn().mockResolvedValue({}),
          delete: jest.fn(),
        },
        booking: {
          count: jest
            .fn()
            .mockResolvedValueOnce(0) // activeBookingCount
            .mockResolvedValueOnce(2), // totalBookingCount
        },
      };
      const prismaMock = {
        $transaction: jest.fn().mockImplementation((fn) => fn(txMock)),
      } as any;

      const svc = new VehicleService(prismaMock);
      const result = await svc.deleteVehicle(testUserId, mockVehicle.id);

      expect(result).toEqual({ deleted: true, id: mockVehicle.id });
      expect(txMock.vehicle.delete).not.toHaveBeenCalled();
      expect(txMock.vehicle.update).toHaveBeenCalledTimes(2);
    });
  });
});
