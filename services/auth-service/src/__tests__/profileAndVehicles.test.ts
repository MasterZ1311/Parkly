process.env['NODE_ENV'] = 'test';
process.env['JWT_ACCESS_SECRET'] = 'test-jwt-access-secret-for-auth-vehicles-32chars';
process.env['JWT_REFRESH_SECRET'] = 'test-jwt-refresh-secret-for-auth-vehicles-32chars';

import http from 'node:http';
import jwt from 'jsonwebtoken';
import { app } from '../index';
import { userService } from '../services/userService';

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

describe('Auth Service Profile & Vehicle Routes', () => {
  const secret = process.env['JWT_ACCESS_SECRET']!;
  const token = jwt.sign({ sub: 'usr-1', role: 'driver', phone: '+919840000001' }, secret);

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('rejects invalid Indian license plate format (400)', async () => {
    const res = await reqJson('POST', '/auth/vehicles', { licensePlate: 'INVALID', vehicleType: 'sedan' }, token);
    expect(res.status).toBe(400);
  });

  it('registers valid vehicle and returns vehicle record (201)', async () => {
    jest.spyOn(userService, 'upsertVehicle').mockResolvedValue({
      id: 'veh-uuid-1',
      userId: 'usr-1',
      licensePlate: 'TN01AB1234',
      vehicleType: 'sedan',
      isDefault: true,
      createdAt: new Date().toISOString(),
    });

    const res = await reqJson('POST', '/auth/vehicles', { licensePlate: 'tn 01 ab 1234', vehicleType: 'sedan' }, token);
    expect(res.status).toBe(201);
    expect(res.body.data.vehicle.licensePlate).toBe('TN01AB1234');
  });

  it('returns 409 when plate belongs to another user', async () => {
    jest.spyOn(userService, 'upsertVehicle').mockRejectedValue(new Error('VEHICLE_OWNED_BY_OTHER_USER'));
    const res = await reqJson('POST', '/auth/vehicles', { licensePlate: 'TN01AB1234', vehicleType: 'sedan' }, token);
    expect(res.status).toBe(409);
  });

  it('updates authenticated user profile cleanly', async () => {
    jest.spyOn(userService, 'updateUser').mockResolvedValue({
      id: 'usr-1',
      name: 'Karthik R.',
      phone: '+919840000001',
      email: 'karthik@example.com',
      role: 'driver',
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    const res = await reqJson('PATCH', '/auth/profile', { name: 'Karthik R.', email: 'karthik@example.com' }, token);
    expect(res.status).toBe(200);
    expect(res.body.data.user.name).toBe('Karthik R.');
  });
});
