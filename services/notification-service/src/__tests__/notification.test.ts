process.env['NODE_ENV'] = 'test';
process.env['JWT_ACCESS_SECRET'] = 'test-jwt-access-secret-for-notif-service-at-least-32-chars';
process.env['JWT_REFRESH_SECRET'] = 'test-jwt-refresh-secret-for-notif-service-at-least-32-chars';
process.env['INTERNAL_SERVICE_KEY'] = 'parkly-internal-test-secret';
process.env['SMS_PROVIDER'] = 'mock';

import http from 'node:http';
import jwt from 'jsonwebtoken';
import { app } from '../index';

async function reqJson(method: string, path: string, body?: unknown, headers: Record<string, string> = {}) {
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const addr = server.address() as { port: number };
  try {
    const res = await fetch(`http://127.0.0.1:${addr.port}${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...headers,
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    const json: any = await res.json().catch(() => null);
    return { status: res.status, body: json };
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
}

describe('Notification Service Security & Device Registration', () => {
  const secret = process.env['JWT_ACCESS_SECRET']!;
  const driverToken = jwt.sign({ sub: 'drv-1', role: 'driver', phone: '+919840000001' }, secret);
  const adminToken = jwt.sign({ sub: 'adm-1', role: 'admin', phone: '+919840000099' }, secret);

  it('rejects unauthenticated or regular driver calls to internal POST /notifications/send (401/403)', async () => {
    const noAuth = await reqJson('POST', '/notifications/send', {
      userId: 'drv-1',
      type: 'booking_confirmed',
      channel: 'in_app',
      title: 'Test',
      body: 'Hello',
    });
    expect(noAuth.status).toBe(401);

    const driverAttempt = await reqJson(
      'POST',
      '/notifications/send',
      {
        userId: 'drv-1',
        type: 'booking_confirmed',
        channel: 'in_app',
        title: 'Spoofed',
        body: 'Free credits!',
      },
      { Authorization: `Bearer ${driverToken}` },
    );
    expect(driverAttempt.status).toBe(403);
  });

  it('permits internal service key or admin JWT to send notifications', async () => {
    const internalAttempt = await reqJson(
      'POST',
      '/notifications/send',
      {
        userId: 'drv-1',
        type: 'booking_confirmed',
        channel: 'sms',
        title: 'Confirmed',
        body: 'Booking confirmed',
        phone: '+919840000001',
      },
      { 'x-internal-service-key': 'parkly-internal-test-secret' },
    );
    expect(internalAttempt.status).toBe(201);

    const adminAttempt = await reqJson(
      'POST',
      '/notifications/send',
      {
        userId: 'drv-1',
        type: 'booking_confirmed',
        channel: 'sms',
        title: 'Confirmed',
        body: 'Admin announcement',
        phone: '+919840000001',
      },
      { Authorization: `Bearer ${adminToken}` },
    );
    expect(adminAttempt.status).toBe(201);
  });

  it('rejects malformed notification payloads with 400', async () => {
    const res = await reqJson(
      'POST',
      '/notifications/send',
      { userId: 'drv-1' },
      { 'x-internal-service-key': 'parkly-internal-test-secret' },
    );
    expect(res.status).toBe(400);
  });

  it('allows authenticated users to register push device tokens', async () => {
    const res = await reqJson(
      'POST',
      '/notifications/devices',
      { token: 'ExponentPushToken[test123]', platform: 'expo' },
      { Authorization: `Bearer ${driverToken}` },
    );
    expect(res.status).toBe(201);
    expect(res.body.data.registered).toBe(true);
  });
});
