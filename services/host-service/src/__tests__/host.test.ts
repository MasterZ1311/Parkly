process.env['NODE_ENV'] = 'test';
process.env['JWT_ACCESS_SECRET'] = 'test-jwt-access-secret-for-host-service-at-least-32-chars';
process.env['JWT_REFRESH_SECRET'] = 'test-jwt-refresh-secret-for-host-service-at-least-32-chars';

import http from 'node:http';
import jwt from 'jsonwebtoken';

const mockPrisma: any = {
  $queryRaw: jest.fn().mockResolvedValue([{ 1: 1 }]),
  host: { findUnique: jest.fn(), create: jest.fn(), update: jest.fn() },
  parkingSpace: { findUnique: jest.fn(), findMany: jest.fn(), create: jest.fn(), update: jest.fn() },
  availabilitySlot: { createMany: jest.fn() },
  booking: { count: jest.fn(), findMany: jest.fn() },
  payout: { findMany: jest.fn(), create: jest.fn() },
  auditLog: { create: jest.fn().mockResolvedValue({}) },
  $transaction: jest.fn(async (cb: any) => cb(mockPrisma)),
};

jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn(() => mockPrisma),
}));

import { app } from '../index';

function signToken(sub: string, role: 'driver' | 'host' | 'admin') {
  return jwt.sign({ sub, role, phone: '+919840000001' }, process.env['JWT_ACCESS_SECRET']!, { expiresIn: '1h' });
}

async function reqJson(method: string, path: string, body?: unknown, token?: string) {
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const addr = server.address() as { port: number };
  try {
    const res = await fetch(`http://127.0.0.1:${addr.port}${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    const json: any = await res.json().catch(() => null);
    return { status: res.status, body: json };
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
}

describe('Host Service Authorization & CRUD', () => {
  const hostAUserId = 'usr-host-a';
  const hostBUserId = 'usr-host-b';
  const driverToken = signToken('usr-driver-1', 'driver');
  const hostAToken = signToken(hostAUserId, 'host');
  const hostBToken = signToken(hostBUserId, 'host');

  beforeEach(() => {
    jest.clearAllMocks();
    mockPrisma.auditLog.create.mockResolvedValue({});
  });

  it('rejects unauthenticated requests to /host/listings', async () => {
    const res = await reqJson('GET', '/host/listings');
    expect(res.status).toBe(401);
  });

  it('rejects driver role from creating host listings (403)', async () => {
    const res = await reqJson('POST', '/host/listings', { name: 'Bad' }, driverToken);
    expect(res.status).toBe(403);
  });

  it('blocks IDOR access when another host fetches or verifies another host listing', async () => {
    mockPrisma.parkingSpace.findUnique.mockResolvedValue({
      id: 'sp-owned-by-a',
      hostId: 'host-a',
      name: 'Host A Space',
      address: '10 Anna Salai',
      city: 'Chennai',
      state: 'Tamil Nadu',
      pincode: '600002',
      regionId: 'chennai',
      latitude: 13.06,
      longitude: 80.25,
      geohash: 'tf34up',
      totalCapacity: 10,
      vehicleTypes: ['sedan'],
      evCharging: false,
      covered: true,
      securityLevel: 'gated',
      accessibility: [],
      cctv: false,
      lighting: true,
      attendant: false,
      hourlyRate: 50,
      dynamicPricing: false,
      minBookingHours: 1,
      maxBookingHours: 24,
      photoUrls: [],
      status: 'active',
      createdAt: new Date(),
      updatedAt: new Date(),
      host: { id: 'host-a', userId: hostAUserId },
    });

    const getRes = await reqJson('GET', '/host/listings/sp-owned-by-a', undefined, hostBToken);
    expect(getRes.status).toBe(403);

    const verifyRes = await reqJson('POST', '/host/listings/sp-owned-by-a/ai-verify', {}, hostBToken);
    expect(verifyRes.status).toBe(403);

    const okGet = await reqJson('GET', '/host/listings/sp-owned-by-a', undefined, hostAToken);
    expect(okGet.status).toBe(200);
    expect(okGet.body.data.id).toBe('sp-owned-by-a');
  });

  it('prevents deleting a listing with active/upcoming bookings (409)', async () => {
    mockPrisma.parkingSpace.findUnique.mockResolvedValue({
      id: 'sp-busy',
      hostId: 'host-a',
      host: { id: 'host-a', userId: hostAUserId },
    });
    mockPrisma.booking.count.mockResolvedValue(2);

    const res = await reqJson('DELETE', '/host/listings/sp-busy', undefined, hostAToken);
    expect(res.status).toBe(409);
  });

  it('rejects payout exceeding available host balance', async () => {
    mockPrisma.host.findUnique.mockResolvedValue({
      id: 'host-a',
      userId: hostAUserId,
      totalEarnings: 500,
      totalPayouts: 400,
    });

    const res = await reqJson('POST', '/host/payouts', { amount: 250 }, hostAToken);
    expect(res.status).toBe(400);
  });
});
