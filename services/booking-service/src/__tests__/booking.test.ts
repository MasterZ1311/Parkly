process.env['NODE_ENV'] = 'test';
process.env['JWT_ACCESS_SECRET'] = 'test-jwt-access-secret-for-booking-service-at-least-32-chars';
process.env['JWT_REFRESH_SECRET'] = 'test-jwt-refresh-secret-for-booking-service-at-least-32-chars';

import request from 'supertest';
import jwt from 'jsonwebtoken';
import { app } from '../index';
import { bookingService, BookingService } from '../services/bookingService';

// Mock PrismaClient to prevent live DB connections in unit/integration tests
jest.mock('@prisma/client', () => {
  return {
    PrismaClient: jest.fn().mockImplementation(() => ({
      $queryRaw: jest.fn().mockResolvedValue([{ 1: 1 }]),
      $disconnect: jest.fn().mockResolvedValue(undefined),
    })),
  };
});

describe('Booking Service Integration Tests', () => {
  const jwtSecret = process.env['JWT_ACCESS_SECRET']!;
  const testUserId = 'a0000000-0000-0000-0000-000000000001';
  const validToken = jwt.sign(
    { sub: testUserId, role: 'driver', phone: '+919876543210' },
    jwtSecret,
    { expiresIn: '1h' },
  );

  const mockBooking = {
    id: 'b0000000-0000-0000-0000-000000000001',
    userId: testUserId,
    spaceId: 's0000000-0000-0000-0000-000000000001',
    vehicleId: 'v0000000-0000-0000-0000-000000000001',
    hostId: 'h0000000-0000-0000-0000-000000000001',
    type: 'scheduled',
    status: 'created',
    startTime: new Date('2026-12-01T10:00:00Z').toISOString(),
    endTime: new Date('2026-12-01T12:00:00Z').toISOString(),
    totalAmount: 120,
    checkInCode: '1234',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /health', () => {
    it('returns 200 with service health status and dependencies', async () => {
      const res = await request(app).get('/health');
      expect([200, 503]).toContain(res.status);
      expect(res.body).toHaveProperty('service', 'booking-service');
      expect(res.body).toHaveProperty('version');
      expect(res.body).toHaveProperty('status');
      expect(Array.isArray(res.body.dependencies)).toBe(true);
    });
  });

  describe('CORS and Security Headers', () => {
    it('allows CORS preflight from whitelisted origin', async () => {
      const res = await request(app)
        .options('/bookings')
        .set('Origin', 'http://localhost:3000')
        .set('Access-Control-Request-Method', 'POST')
        .set('Access-Control-Request-Headers', 'Content-Type,Authorization');

      expect([200, 204]).toContain(res.status);
      expect(res.headers['access-control-allow-origin']).toBe('http://localhost:3000');
      expect(res.headers['access-control-allow-credentials']).toBe('true');
    });

    it('attaches X-Response-Time and security headers', async () => {
      const res = await request(app).get('/health');
      expect(res.headers['x-response-time']).toBeDefined();
      expect(res.headers['x-content-type-options']).toBe('nosniff');
    });
  });

  describe('Authentication Enforcement', () => {
    it('returns 401 when Authorization header is missing', async () => {
      const res = await request(app).get('/bookings');
      expect(res.status).toBe(401);
      expect(res.body).toHaveProperty('error');
    });

    it('returns 401 when token is invalid or expired', async () => {
      const res = await request(app)
        .get('/bookings')
        .set('Authorization', 'Bearer invalid-token');
      expect(res.status).toBe(401);
    });
  });

  describe('Booking Endpoints', () => {
    it('lists user bookings with valid token', async () => {
      jest.spyOn(bookingService, 'listUserBookings').mockResolvedValue({
        bookings: [mockBooking as any],
        total: 1,
      });

      const res = await request(app)
        .get('/bookings')
        .set('Authorization', `Bearer ${validToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.bookings).toHaveLength(1);
      expect(res.body.data.bookings[0].id).toBe(mockBooking.id);
    });

    it('rejects POST /bookings with invalid payload (missing fields)', async () => {
      const res = await request(app)
        .post('/bookings')
        .set('Authorization', `Bearer ${validToken}`)
        .send({ spaceId: 'not-a-uuid' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('creates a booking successfully with valid payload', async () => {
      jest.spyOn(bookingService, 'createBooking').mockResolvedValue(mockBooking as any);

      const res = await request(app)
        .post('/bookings')
        .set('Authorization', `Bearer ${validToken}`)
        .send({
          spaceId: '11111111-1111-4111-8111-111111111111',
          vehicleId: '22222222-2222-4222-8222-222222222222',
          hostId: '33333333-3333-4333-8333-333333333333',
          type: 'scheduled',
          startTime: '2026-12-01T10:00:00.000Z',
          endTime: '2026-12-01T12:00:00.000Z',
          totalAmount: 120,
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBe(mockBooking.id);
      expect(bookingService.createBooking).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: testUserId,
          spaceId: '11111111-1111-4111-8111-111111111111',
          totalAmount: 120,
        }),
      );
    });

    it('gets a booking by id', async () => {
      jest.spyOn(bookingService, 'getBooking').mockResolvedValue(mockBooking as any);

      const res = await request(app)
        .get(`/bookings/${mockBooking.id}`)
        .set('Authorization', `Bearer ${validToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBe(mockBooking.id);
    });

    it('cancels a booking successfully', async () => {
      jest.spyOn(bookingService, 'cancelBooking').mockResolvedValue({
        ...mockBooking,
        status: 'cancelled',
      } as any);

      const res = await request(app)
        .put(`/bookings/${mockBooking.id}/cancel`)
        .set('Authorization', `Bearer ${validToken}`)
        .send({ reason: 'Trip plans changed' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('cancelled');
    });

    it('extends an active/confirmed booking via PUT /bookings/:id/extend', async () => {
      const extendedEndTime = new Date('2026-12-01T13:00:00Z').toISOString();
      const spy = jest.spyOn(bookingService, 'extendBooking').mockResolvedValue({
        ...mockBooking,
        status: 'confirmed',
        endTime: extendedEndTime,
        durationMinutes: 180,
        totalAmount: 162,
      } as any);

      const res = await request(app)
        .put(`/bookings/${mockBooking.id}/extend`)
        .set('Authorization', `Bearer ${validToken}`)
        .send({ hours: 1 });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.endTime).toBe(extendedEndTime);
      expect(res.body.data.totalAmount).toBe(162);
      expect(spy).toHaveBeenCalledWith(mockBooking.id, testUserId, 60);
    });

    it('rejects PUT /bookings/:id/extend with invalid hours', async () => {
      const res = await request(app)
        .put(`/bookings/${mockBooking.id}/extend`)
        .set('Authorization', `Bearer ${validToken}`)
        .send({ hours: 0 });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });
  });

  describe('BookingService.extendBooking unit invariants', () => {
    it('rejects extending a cancelled booking', async () => {
      const txMock = {
        booking: {
          findUnique: jest.fn().mockResolvedValue({
            id: mockBooking.id,
            userId: testUserId,
            spaceId: mockBooking.spaceId,
            status: 'cancelled',
            deletedAt: null,
            startTime: new Date('2026-12-01T10:00:00Z'),
            endTime: new Date('2026-12-01T12:00:00Z'),
            durationMinutes: 120,
            totalAmount: 120,
          }),
        },
      };
      const svc = new BookingService({
        $transaction: jest.fn().mockImplementation((fn) => fn(txMock)),
      } as any);

      await expect(svc.extendBooking(mockBooking.id, testUserId, 60)).rejects.toThrow(
        'Cannot extend a booking in cancelled status',
      );
    });

    it('throws ConflictError when extension overlaps next driver reservation', async () => {
      const txMock = {
        booking: {
          findUnique: jest.fn().mockResolvedValue({
            id: mockBooking.id,
            userId: testUserId,
            spaceId: mockBooking.spaceId,
            status: 'confirmed',
            deletedAt: null,
            startTime: new Date('2026-12-01T10:00:00Z'),
            endTime: new Date('2026-12-01T12:00:00Z'),
            durationMinutes: 120,
            totalAmount: 120,
            space: { hourlyRate: 40 },
          }),
          findFirst: jest.fn().mockResolvedValue({ id: 'other-booking' }),
        },
      };
      const svc = new BookingService({
        $transaction: jest.fn().mockImplementation((fn) => fn(txMock)),
      } as any);

      await expect(svc.extendBooking(mockBooking.id, testUserId, 60)).rejects.toThrow(
        'Cannot extend: the next slot is already reserved by another driver.',
      );
    });

    it('extends confirmed booking endTime, durationMinutes, and totalAmount accurately', async () => {
      const now = new Date();
      const startTime = new Date('2026-12-01T10:00:00Z');
      const endTime = new Date('2026-12-01T12:00:00Z');
      const txMock = {
        booking: {
          findUnique: jest.fn().mockResolvedValue({
            id: mockBooking.id,
            userId: testUserId,
            spaceId: mockBooking.spaceId,
            vehicleId: mockBooking.vehicleId,
            hostId: mockBooking.hostId,
            type: 'scheduled',
            status: 'confirmed',
            deletedAt: null,
            startTime,
            endTime,
            durationMinutes: 120,
            totalAmount: 84,
            createdAt: now,
            updatedAt: now,
            space: { id: mockBooking.spaceId, name: 'Spot A', address: 'T Nagar', hourlyRate: 40 },
            vehicle: { id: mockBooking.vehicleId, licensePlate: 'TN01AB1234', vehicleType: 'sedan' },
          }),
          findFirst: jest.fn().mockResolvedValue(null),
          update: jest.fn().mockImplementation(({ data }) =>
            Promise.resolve({
              id: mockBooking.id,
              userId: testUserId,
              spaceId: mockBooking.spaceId,
              vehicleId: mockBooking.vehicleId,
              hostId: mockBooking.hostId,
              type: 'scheduled',
              status: 'confirmed',
              startTime,
              endTime: data.endTime,
              durationMinutes: data.durationMinutes,
              totalAmount: data.totalAmount,
              createdAt: now,
              updatedAt: now,
              space: { id: mockBooking.spaceId, name: 'Spot A', address: 'T Nagar', hourlyRate: 40 },
              vehicle: { id: mockBooking.vehicleId, licensePlate: 'TN01AB1234', vehicleType: 'sedan' },
            }),
          ),
        },
      };
      const svc = new BookingService({
        $transaction: jest.fn().mockImplementation((fn) => fn(txMock)),
      } as any);

      const extended = await svc.extendBooking(mockBooking.id, testUserId, 60);
      expect(extended.durationMinutes).toBe(180);
      expect(extended.endTime).toBe('2026-12-01T13:00:00.000Z');
      // 40 + round(40*0.05) = 42 added to 84 => 126
      expect(extended.totalAmount).toBe(126);
    });
  });
});
