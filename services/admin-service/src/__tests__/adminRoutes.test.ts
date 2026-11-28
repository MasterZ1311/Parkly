process.env['NODE_ENV'] = 'test';
process.env['JWT_ACCESS_SECRET'] = 'test-jwt-access-secret-for-admin-service-at-least-32chars';
process.env['JWT_REFRESH_SECRET'] = 'test-jwt-refresh-secret-for-admin-service-at-least-32chars';

import http from 'node:http';
import jwt from 'jsonwebtoken';

const mockPrisma: any = {
  user: { findUnique: jest.fn(), findMany: jest.fn(), count: jest.fn(), update: jest.fn() },
  host: { upsert: jest.fn(), count: jest.fn(), update: jest.fn() },
  parkingSpace: { findUnique: jest.fn(), findMany: jest.fn(), count: jest.fn(), update: jest.fn() },
  booking: { findUnique: jest.fn(), findMany: jest.fn(), count: jest.fn(), aggregate: jest.fn() },
  dispute: { findUnique: jest.fn(), findMany: jest.fn(), count: jest.fn(), update: jest.fn() },
  systemAlert: { findUnique: jest.fn(), findMany: jest.fn(), count: jest.fn(), update: jest.fn(), delete: jest.fn() },
  auditLog: { create: jest.fn().mockResolvedValue({}), findMany: jest.fn() },
  platformSetting: { findMany: jest.fn(), upsert: jest.fn() },
  $transaction: jest.fn(async (arg: any) => (typeof arg === 'function' ? arg(mockPrisma) : Promise.all(arg))),
};

jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn(() => mockPrisma),
}));

import { app } from '../index';

function signToken(sub: string, role: 'driver' | 'host' | 'admin') {
  return jwt.sign({ sub, role, phone: '+919840000099' }, process.env['JWT_ACCESS_SECRET']!, { expiresIn: '1h' });
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

describe('Admin Service RBAC, Governance & Persisted Ops', () => {
  const adminToken = signToken('admin-1', 'admin');
  const driverToken = signToken('driver-1', 'driver');

  beforeEach(() => {
    jest.clearAllMocks();
    mockPrisma.auditLog.create.mockResolvedValue({});
  });

  it('rejects non-admin users across all admin routes (403)', async () => {
    const res = await reqJson('GET', '/admin/metrics', undefined, driverToken);
    expect(res.status).toBe(403);
  });

  it('prevents admin self-demotion (400)', async () => {
    const res = await reqJson('PUT', '/admin/users/admin-1/role', { role: 'driver' }, adminToken);
    expect(res.status).toBe(400);
  });

  it('resolves and persists system alerts with audit logging', async () => {
    mockPrisma.systemAlert.findUnique.mockResolvedValue({ id: 'alert-1', resolved: false });
    mockPrisma.systemAlert.update.mockResolvedValue({ id: 'alert-1', resolved: true, resolvedBy: 'admin-1' });

    const res = await reqJson('PUT', '/admin/alerts/alert-1/resolve', undefined, adminToken);
    expect(res.status).toBe(200);
    expect(res.body.data.alert.resolved).toBe(true);
    expect(mockPrisma.auditLog.create).toHaveBeenCalled();
  });

  it('upserts persisted platform settings', async () => {
    mockPrisma.platformSetting.upsert.mockResolvedValue({});
    mockPrisma.platformSetting.findMany.mockResolvedValue([{ key: 'platformFeePercent', value: '5' }]);

    const res = await reqJson('PUT', '/admin/settings', { settings: { platformFeePercent: '5' } }, adminToken);
    expect(res.status).toBe(200);
    expect(res.body.data.settings.platformFeePercent).toBe('5');
  });
});
