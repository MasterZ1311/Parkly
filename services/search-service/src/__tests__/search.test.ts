process.env['NODE_ENV'] = 'test';
process.env['JWT_ACCESS_SECRET'] = 'test-jwt-access-secret-for-search-service-at-least-32-chars';
process.env['JWT_REFRESH_SECRET'] = 'test-jwt-refresh-secret-for-search-service-at-least-32-chars';

import http from 'node:http';
import jwt from 'jsonwebtoken';

const mockPrisma: any = {
  $queryRaw: jest.fn().mockResolvedValue([{ 1: 1 }]),
  $disconnect: jest.fn().mockResolvedValue(undefined),
  parkingSpace: {
    findMany: jest.fn().mockResolvedValue([]),
    findUnique: jest.fn(),
  },
};

jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn(() => mockPrisma),
}));

import { app } from '../index';
import { searchService } from '../services/searchService';

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

describe('Search Service Public Discovery & Protected Concierge', () => {
  const token = jwt.sign(
    { sub: 'drv-1', role: 'driver', phone: '+919840000001' },
    process.env['JWT_ACCESS_SECRET']!,
  );

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('permits public unauthenticated discovery via POST /search and includes hostId', async () => {
    const spy = jest.spyOn(searchService, 'search').mockResolvedValue({
      version: '1.0',
      results: [
        {
          id: 'sp-tng-001',
          hostId: 'host-chennai-001',
          name: 'T Nagar Hub',
          address: 'Panagal Park Rd',
          coordinates: { lat: 13.0418, lng: 80.2341 },
          distance: { value: 0.4, unit: 'km' },
          availability: {
            probabilityPercent: 85,
            estimatedVacancies: 6,
            confidencePercent: 90,
            insufficientData: false,
          },
          price: { value: 40, currency: 'INR', per: 'hour' },
          amenities: {
            evCharging: true,
            covered: true,
            securityLevel: 'gated',
            accessibility: [],
            vehicleTypes: ['sedan'],
          },
          photoUrls: [],
        },
      ],
      pagination: {
        page: 1,
        pageSize: 20,
        totalResults: 1,
        totalPages: 1,
      },
      meta: {
        predictionStatus: 'available',
        searchRadiusKm: 5,
        appliedDefaults: [],
      },
    });

    const res = await reqJson('POST', '/search', {
      location: { type: 'coordinates', lat: 13.0418, lng: 80.2341 },
      arrivalTime: new Date(Date.now() + 3600_000).toISOString(),
    });

    expect(res.status).toBe(200);
    expect(res.body.data.results[0].hostId).toBe('host-chennai-001');
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('requires authentication on POST /search/concierge (401 without token)', async () => {
    const unauth = await reqJson('POST', '/search/concierge', { query: 'Parking in T Nagar' });
    expect(unauth.status).toBe(401);

    mockPrisma.parkingSpace.findMany.mockResolvedValue([
      {
        id: 'sp-tng-001',
        hostId: 'host-chennai-001',
        name: 'T Nagar Smart Park',
        address: 'Panagal Park Rd, T Nagar',
        city: 'Chennai',
        latitude: 13.0418,
        longitude: 80.2341,
        hourlyRate: 40,
        evCharging: true,
        covered: true,
        status: 'active',
      },
    ]);

    const authed = await reqJson(
      'POST',
      '/search/concierge',
      { query: 'EV covered parking near T Nagar under ₹60' },
      token,
    );
    expect(authed.status).toBe(200);
    expect(authed.body.data.recommendedSpace.id).toBe('sp-tng-001');
  });
});
