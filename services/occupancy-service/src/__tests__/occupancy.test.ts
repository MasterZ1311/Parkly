process.env['NODE_ENV'] = 'test';
process.env['JWT_ACCESS_SECRET'] = 'test-jwt-access-secret-for-occupancy-service-32chars';
process.env['JWT_REFRESH_SECRET'] = 'test-jwt-refresh-secret-for-occupancy-service-32chars';

import http from 'node:http';
import jwt from 'jsonwebtoken';
import { app, occupancyService } from '../index';

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

describe('Occupancy Service Security & Routing', () => {
  const secret = process.env['JWT_ACCESS_SECRET']!;
  const driverToken = jwt.sign({ sub: 'drv-1', role: 'driver', phone: '+919840000001' }, secret);
  const hostToken = jwt.sign({ sub: 'hst-1', role: 'host', phone: '+919840000002' }, secret);
  const adminToken = jwt.sign({ sub: 'adm-1', role: 'admin', phone: '+919840000099' }, secret);

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('rejects driver tokens on /occupancy/ingest (403) and /occupancy/simulate (403)', async () => {
    const ingestRes = await reqJson(
      'POST',
      '/occupancy/ingest',
      { spaceId: 'sp-1', occupiedSlots: 4, totalSlots: 10, source: 'sensor' },
      driverToken,
    );
    expect(ingestRes.status).toBe(403);

    const simRes = await reqJson('POST', '/occupancy/simulate', {}, driverToken);
    expect(simRes.status).toBe(403);
  });

  it('allows host tokens on POST /occupancy/ingest and rejects invalid capacity', async () => {
    jest.spyOn(occupancyService, 'ingest').mockResolvedValue({
      spaceId: 'sp-1',
      occupiedSlots: 5,
      totalSlots: 10,
      occupancyRate: 0.5,
      lastUpdated: new Date().toISOString(),
      source: 'sensor',
    });

    const okRes = await reqJson(
      'POST',
      '/occupancy/ingest',
      { spaceId: 'sp-1', occupiedSlots: 5, totalSlots: 10, source: 'sensor' },
      hostToken,
    );
    expect(okRes.status).toBe(201);
    expect(okRes.body.data.occupancyRate).toBe(0.5);
  });

  it('serves GET /occupancy/current/:spaceId when authenticated', async () => {
    jest.spyOn(occupancyService, 'getCurrentOccupancy').mockResolvedValue({
      spaceId: 'sp-tng-001',
      occupiedSlots: 7,
      totalSlots: 10,
      occupancyRate: 0.7,
      lastUpdated: new Date().toISOString(),
      source: 'sensor',
    });

    const res = await reqJson('GET', '/occupancy/current/sp-tng-001', undefined, adminToken);
    expect(res.status).toBe(200);
    expect(res.body.data.spaceId).toBe('sp-tng-001');
    expect(res.body.data.occupiedSlots).toBe(7);
  });
});
