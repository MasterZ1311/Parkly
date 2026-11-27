process.env['NODE_ENV'] = 'test';
process.env['JWT_ACCESS_SECRET'] = 'test-jwt-access-secret-for-payment-security-32chars';
process.env['JWT_REFRESH_SECRET'] = 'test-jwt-refresh-secret-for-payment-security-32chars';

import http from 'node:http';
import jwt from 'jsonwebtoken';

const mockPrisma: any = {
  $queryRaw: jest.fn().mockResolvedValue([{ 1: 1 }]),
  booking: { findUnique: jest.fn(), update: jest.fn() },
  payment: { findUnique: jest.fn(), create: jest.fn(), update: jest.fn() },
  host: { update: jest.fn() },
  $transaction: jest.fn(async (cb: any) => cb(mockPrisma)),
};

jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn(() => mockPrisma),
}));

import { app } from '../index';

function signToken(sub: string, role: 'driver' | 'host' | 'admin' = 'driver') {
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

describe('Payment Service Ownership & Amount Verification', () => {
  const driverToken = signToken('driver-owner');
  const attackerToken = signToken('driver-attacker');

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('rejects initiating payment for another user booking (403)', async () => {
    mockPrisma.booking.findUnique.mockResolvedValue({
      id: 'bk-tng-001',
      userId: 'driver-owner',
      totalAmount: 126,
      status: 'created',
    });

    const res = await reqJson('POST', '/payments/initiate', { bookingId: 'bk-tng-001', amount: 126 }, attackerToken);
    expect(res.status).toBe(403);
  });

  it('rejects payment initiation when client amount does not match booking totalAmount (400)', async () => {
    mockPrisma.booking.findUnique.mockResolvedValue({
      id: 'bk-tng-001',
      userId: 'driver-owner',
      totalAmount: 126,
      status: 'created',
    });

    const res = await reqJson('POST', '/payments/initiate', { bookingId: 'bk-tng-001', amount: 10 }, driverToken);
    expect(res.status).toBe(400);
  });

  it('rejects confirming payment owned by another user (403)', async () => {
    mockPrisma.payment.findUnique.mockResolvedValue({
      id: 'pay-001',
      bookingId: 'bk-tng-001',
      userId: 'driver-owner',
      amount: 126,
      status: 'pending',
      providerOrderId: 'MOCK_ORDER_123',
      booking: { hostId: 'host-1', totalAmount: 126 },
    });

    const res = await reqJson(
      'PUT',
      '/payments/pay-001/confirm',
      { providerPaymentId: 'rzp_123', signature: 'sig_123' },
      attackerToken,
    );
    expect(res.status).toBe(403);
  });
});
