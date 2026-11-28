// ============================================================
// Host Dashboard — Stateful Local Data Adapter
// Powers interactive host listings, AI verification, bookings,
// live occupancy telemetry, and revenue/payout flows.
// ============================================================

import { AxiosError, AxiosHeaders, AxiosResponse, InternalAxiosRequestConfig } from 'axios';

const STORAGE_KEY = 'parkly_host_store_v1';

interface HostSpaceRecord {
  id: string;
  name: string;
  address: string;
  city: string;
  state: string;
  pincode: string;
  coordinates: { lat: number; lng: number };
  totalCapacity: number;
  hourlyRate: number;
  pricing: { hourlyRate: number };
  status: string;
  amenities: { evCharging: boolean; covered: boolean; securityLevel: string };
  photoUrls: string[];
  occupancyPercent: number;
}

interface HostBookingRecord {
  id: string;
  spaceId: string;
  space: { id: string; name: string };
  user: { id: string; name: string; phone: string };
  vehicle: { id: string; licensePlate: string; vehicleType: string };
  startTime: string;
  endTime: string;
  totalAmount: number;
  status: string;
}

interface HostPayoutRecord {
  id: string;
  amount: number;
  status: string;
  createdAt: string;
  processedAt: string | null;
}

interface HostState {
  profile: {
    id: string;
    name: string;
    email: string;
    phone: string;
    role: 'host';
    verified: boolean;
    bankAccount: string;
  };
  listings: HostSpaceRecord[];
  bookings: HostBookingRecord[];
  payouts: HostPayoutRecord[];
  availableBalance: number;
}

function createInitialState(): HostState {
  const now = Date.now();
  const h = 3600000;
  return {
    profile: {
      id: 'usr-host-001',
      name: 'Karthik Subramanian',
      email: 'karthik.s@parkly.in',
      phone: '+919840123456',
      role: 'host',
      verified: true,
      bankAccount: 'HDFC •••• 4821',
    },
    listings: [
      {
        id: 'sp-tng-001',
        name: 'T Nagar Panagal Park Plaza',
        address: '23, Panagal Park Road, T Nagar',
        city: 'Chennai',
        state: 'Tamil Nadu',
        pincode: '600017',
        coordinates: { lat: 13.0418, lng: 80.2341 },
        totalCapacity: 18,
        hourlyRate: 50,
        pricing: { hourlyRate: 50 },
        status: 'active',
        amenities: { evCharging: true, covered: true, securityLevel: 'gated' },
        photoUrls: [],
        occupancyPercent: 83,
      },
      {
        id: 'sp-ana-002',
        name: 'Anna Nagar Tower Covered Hub',
        address: '42, 2nd Avenue, Anna Nagar East',
        city: 'Chennai',
        state: 'Tamil Nadu',
        pincode: '600102',
        coordinates: { lat: 13.0849, lng: 80.2101 },
        totalCapacity: 24,
        hourlyRate: 60,
        pricing: { hourlyRate: 60 },
        status: 'active',
        amenities: { evCharging: true, covered: true, securityLevel: 'staffed' },
        photoUrls: [],
        occupancyPercent: 75,
      },
      {
        id: 'sp-ady-003',
        name: 'Adyar LB Road Executive Bays',
        address: '15, Lattice Bridge Road, Adyar',
        city: 'Chennai',
        state: 'Tamil Nadu',
        pincode: '600020',
        coordinates: { lat: 13.0067, lng: 80.2566 },
        totalCapacity: 12,
        hourlyRate: 40,
        pricing: { hourlyRate: 40 },
        status: 'active',
        amenities: { evCharging: false, covered: true, securityLevel: 'monitored' },
        photoUrls: [],
        occupancyPercent: 67,
      },
      {
        id: 'sp-omr-004',
        name: 'OMR Tidel EV Superhub',
        address: '88, Rajiv Gandhi Salai, Taramani',
        city: 'Chennai',
        state: 'Tamil Nadu',
        pincode: '600113',
        coordinates: { lat: 12.9896, lng: 80.2494 },
        totalCapacity: 30,
        hourlyRate: 45,
        pricing: { hourlyRate: 45 },
        status: 'pending_verification',
        amenities: { evCharging: true, covered: false, securityLevel: 'gated' },
        photoUrls: [],
        occupancyPercent: 42,
      },
    ],
    bookings: [
      {
        id: 'bk-9a41f001',
        spaceId: 'sp-tng-001',
        space: { id: 'sp-tng-001', name: 'T Nagar Panagal Park Plaza' },
        user: { id: 'usr-d-01', name: 'Ananya Krishnan', phone: '+919840112233' },
        vehicle: { id: 'veh-01', licensePlate: 'TN01CD4512', vehicleType: 'sedan' },
        startTime: new Date(now - 0.5 * h).toISOString(),
        endTime: new Date(now + 1.5 * h).toISOString(),
        totalAmount: 105,
        status: 'active',
      },
      {
        id: 'bk-9a41f002',
        spaceId: 'sp-ana-002',
        space: { id: 'sp-ana-002', name: 'Anna Nagar Tower Covered Hub' },
        user: { id: 'usr-d-02', name: 'Rohan Sundaram', phone: '+919840223344' },
        vehicle: { id: 'veh-02', licensePlate: 'TN09EF8821', vehicleType: 'suv' },
        startTime: new Date(now + 1 * h).toISOString(),
        endTime: new Date(now + 4 * h).toISOString(),
        totalAmount: 189,
        status: 'confirmed',
      },
      {
        id: 'bk-9a41f003',
        spaceId: 'sp-tng-001',
        space: { id: 'sp-tng-001', name: 'T Nagar Panagal Park Plaza' },
        user: { id: 'usr-d-03', name: 'Meenakshi Iyer', phone: '+919840334455' },
        vehicle: { id: 'veh-03', licensePlate: 'TN10AB3309', vehicleType: 'compact' },
        startTime: new Date(now - 6 * h).toISOString(),
        endTime: new Date(now - 3 * h).toISOString(),
        totalAmount: 158,
        status: 'completed',
      },
      {
        id: 'bk-9a41f004',
        spaceId: 'sp-ady-003',
        space: { id: 'sp-ady-003', name: 'Adyar LB Road Executive Bays' },
        user: { id: 'usr-d-04', name: 'Vikram Nair', phone: '+919840012345' },
        vehicle: { id: 'veh-04', licensePlate: 'TN01AB1234', vehicleType: 'sedan' },
        startTime: new Date(now - 24 * h).toISOString(),
        endTime: new Date(now - 20 * h).toISOString(),
        totalAmount: 168,
        status: 'completed',
      },
      {
        id: 'bk-9a41f005',
        spaceId: 'sp-ana-002',
        space: { id: 'sp-ana-002', name: 'Anna Nagar Tower Covered Hub' },
        user: { id: 'usr-d-05', name: 'Siddharth Rao', phone: '+919840556677' },
        vehicle: { id: 'veh-05', licensePlate: 'TN07KL9102', vehicleType: 'sedan' },
        startTime: new Date(now - 48 * h).toISOString(),
        endTime: new Date(now - 46 * h).toISOString(),
        totalAmount: 126,
        status: 'completed',
      },
      {
        id: 'bk-9a41f006',
        spaceId: 'sp-tng-001',
        space: { id: 'sp-tng-001', name: 'T Nagar Panagal Park Plaza' },
        user: { id: 'usr-d-06', name: 'Deepika Raghavan', phone: '+919840667788' },
        vehicle: { id: 'veh-06', licensePlate: 'TN02MN4410', vehicleType: 'motorcycle' },
        startTime: new Date(now - 72 * h).toISOString(),
        endTime: new Date(now - 70 * h).toISOString(),
        totalAmount: 105,
        status: 'cancelled',
      },
    ],
    payouts: [
      {
        id: 'pay-host-8801',
        amount: 24500,
        status: 'completed',
        createdAt: new Date(now - 14 * 24 * h).toISOString(),
        processedAt: new Date(now - 13 * 24 * h).toISOString(),
      },
      {
        id: 'pay-host-8802',
        amount: 19800,
        status: 'completed',
        createdAt: new Date(now - 30 * 24 * h).toISOString(),
        processedAt: new Date(now - 29 * 24 * h).toISOString(),
      },
    ],
    availableBalance: 18450,
  };
}

function loadState(): HostState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as HostState;
      if (parsed && Array.isArray(parsed.listings)) {
        return parsed;
      }
    }
  } catch {
    // Ignore parse error and fall back to fresh dataset
  }
  const initial = createInitialState();
  saveState(initial);
  return initial;
}

function saveState(state: HostState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Ignore storage quota errors
  }
}

function parseBody(config: InternalAxiosRequestConfig): any {
  if (!config.data) return {};
  if (typeof config.data === 'string') {
    try {
      return JSON.parse(config.data);
    } catch {
      return {};
    }
  }
  return config.data;
}

function getPath(config: InternalAxiosRequestConfig): string {
  const raw = config.url || '/';
  const withoutOrigin = raw.replace(/^https?:\/\/[^/]+/i, '').replace(/^\/api\/v1/i, '');
  return (withoutOrigin.split('?')[0] || '/').replace(/\/+$/, '') || '/';
}

function okResponse<T>(config: InternalAxiosRequestConfig, data: T, status = 200): AxiosResponse {
  return {
    data: { success: true, data },
    status,
    statusText: 'OK',
    headers: new AxiosHeaders(),
    config,
    request: {},
  };
}

function errorResponse(config: InternalAxiosRequestConfig, status: number, code: string, message: string): never {
  throw new AxiosError(
    message,
    code,
    config,
    {},
    {
      data: { success: false, error: { code, message } },
      status,
      statusText: message,
      headers: new AxiosHeaders(),
      config,
    },
  );
}

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function hostMockAdapter(config: InternalAxiosRequestConfig): Promise<AxiosResponse> {
  await delay(120);

  const method = (config.method || 'get').toUpperCase();
  const path = getPath(config);
  const body = parseBody(config);
  const params = (config.params || {}) as Record<string, string | undefined>;
  const state = loadState();

  // Auth routes
  if (method === 'POST' && path === '/auth/otp/request') {
    return okResponse(config, {
      message: 'OTP sent successfully',
      devOtp: '482910',
    });
  }

  if (method === 'POST' && path === '/auth/otp/verify') {
    if (body.phone) state.profile.phone = body.phone;
    if (body.name) state.profile.name = body.name;
    saveState(state);
    return okResponse(config, {
      user: state.profile,
      tokens: {
        accessToken: 'parkly.host.session.token',
        refreshToken: 'parkly.host.refresh.token',
      },
    });
  }

  if (method === 'POST' && path === '/auth/refresh') {
    return okResponse(config, {
      tokens: {
        accessToken: 'parkly.host.session.token',
        refreshToken: 'parkly.host.refresh.token',
      },
    });
  }

  if (method === 'POST' && path === '/auth/logout') {
    return okResponse(config, { loggedOut: true });
  }

  if (method === 'GET' && (path === '/auth/profile' || path === '/auth/me')) {
    return okResponse(config, { user: state.profile });
  }

  if (method === 'PATCH' && path === '/auth/profile') {
    state.profile = {
      ...state.profile,
      ...(body.name ? { name: body.name } : {}),
      ...(body.email ? { email: body.email } : {}),
      ...(body.bankAccount ? { bankAccount: body.bankAccount } : {}),
    };
    saveState(state);
    return okResponse(config, { user: state.profile });
  }

  // Listings CRUD
  if (method === 'GET' && (path === '/host/listings' || path === '/host/spaces')) {
    return okResponse(config, state.listings);
  }

  if (method === 'POST' && (path === '/host/listings' || path === '/host/spaces')) {
    const newListing: HostSpaceRecord = {
      id: `sp-ch-${Date.now().toString(36)}`,
      name: body.name || 'New Chennai Parking Bay',
      address: body.address || 'Anna Salai, Chennai',
      city: body.city || 'Chennai',
      state: body.state || 'Tamil Nadu',
      pincode: body.pincode || '600002',
      coordinates: {
        lat: Number(body.latitude) || 13.0604,
        lng: Number(body.longitude) || 80.2496,
      },
      totalCapacity: Math.max(1, Number(body.totalCapacity) || 10),
      hourlyRate: Math.max(10, Number(body.hourlyRate) || 40),
      pricing: { hourlyRate: Math.max(10, Number(body.hourlyRate) || 40) },
      status: 'pending_verification',
      amenities: {
        evCharging: Boolean(body.evCharging),
        covered: Boolean(body.covered),
        securityLevel: body.covered ? 'gated' : 'monitored',
      },
      photoUrls: [],
      occupancyPercent: 25,
    };
    state.listings = [newListing, ...state.listings];
    saveState(state);
    return okResponse(config, newListing, 201);
  }

  const listingPatchMatch = path.match(/^\/host\/(?:listings|spaces)\/([^/]+)$/);
  if (method === 'PATCH' && listingPatchMatch) {
    const id = listingPatchMatch[1];
    const idx = state.listings.findIndex((l) => l.id === id);
    if (idx === -1) errorResponse(config, 404, 'NOT_FOUND', 'Listing not found');
    const current = state.listings[idx]!;
    const updated: HostSpaceRecord = {
      ...current,
      name: body.name ?? current.name,
      address: body.address ?? current.address,
      city: body.city ?? current.city,
      state: body.state ?? current.state,
      pincode: body.pincode ?? current.pincode,
      totalCapacity: body.totalCapacity ? Number(body.totalCapacity) : current.totalCapacity,
      hourlyRate: body.hourlyRate ? Number(body.hourlyRate) : current.hourlyRate,
      pricing: { hourlyRate: body.hourlyRate ? Number(body.hourlyRate) : current.hourlyRate },
      amenities: {
        evCharging: body.evCharging !== undefined ? Boolean(body.evCharging) : current.amenities.evCharging,
        covered: body.covered !== undefined ? Boolean(body.covered) : current.amenities.covered,
        securityLevel: current.amenities.securityLevel,
      },
    };
    state.listings[idx] = updated;
    saveState(state);
    return okResponse(config, updated);
  }

  if (method === 'DELETE' && listingPatchMatch) {
    const id = listingPatchMatch[1];
    state.listings = state.listings.filter((l) => l.id !== id);
    saveState(state);
    return okResponse(config, { deleted: true, id });
  }

  const aiVerifyMatch = path.match(/^\/host\/(?:listings|spaces)\/([^/]+)\/ai-verify$/);
  if (method === 'POST' && aiVerifyMatch) {
    await delay(260);
    const id = aiVerifyMatch[1]!;
    const idx = state.listings.findIndex((l) => l.id === id);
    const listing = idx >= 0 ? state.listings[idx]! : state.listings[0];
    if (idx >= 0) {
      state.listings[idx] = { ...listing!, status: 'active' };
      saveState(state);
    }
    return okResponse(config, {
      spaceId: id,
      status: 'active',
      aiApproval: true,
      onboarding: {
        kycStatus: 'VERIFIED',
        confidenceScore: 0.96,
        extractedIdentity: {
          ownerName: state.profile.name,
          panNumber: 'ABCPK4821M',
          propertyTaxId: 'CHN-CORP-2026-8841',
        },
        geocoding: {
          geohash: 'tf34dc7',
          normalizedAddress: `${listing?.address || 'T Nagar'}, ${listing?.city || 'Chennai'} ${listing?.pincode || '600017'}`,
        },
        zoningCompliance: true,
      },
      visualInspection: {
        inspectionResult: 'PASSED',
        detectedAttributes: {
          clearanceMeters: 3.1,
          evChargerDetected: listing?.amenities.evCharging ?? true,
          cctvDetected: true,
          surfaceType: 'paved_concrete',
        },
        privacyActions: {
          blurredPlates: 3,
          blurredFaces: 1,
        },
        generatedDescription: 'Well-lit covered multi-bay facility with CCTV coverage and clear entry signage.',
      },
    });
  }

  // Live Occupancy
  const occMatch = path.match(/^\/occupancy\/current\/([^/]+)$/);
  if (method === 'GET' && occMatch) {
    const space = state.listings.find((l) => l.id === occMatch[1]);
    const pct = space?.occupancyPercent ?? 68;
    const cap = space?.totalCapacity ?? 12;
    const occupied = Math.round((cap * pct) / 100);
    return okResponse(config, {
      spaceId: occMatch[1],
      occupancyPercentage: pct,
      totalCapacity: cap,
      occupiedSpots: occupied,
      availableSpots: Math.max(0, cap - occupied),
    });
  }

  // Host Bookings
  if (method === 'GET' && path === '/host/bookings') {
    const statusFilter = params.status;
    const filtered =
      statusFilter && statusFilter !== 'all'
        ? state.bookings.filter((b) => b.status === statusFilter)
        : state.bookings;
    return okResponse(config, { bookings: filtered, total: filtered.length });
  }

  // Revenue & Payouts
  if (method === 'GET' && path === '/host/revenue') {
    const paidOut = state.payouts
      .filter((p) => p.status !== 'failed')
      .reduce((s, p) => s + p.amount, 0);
    const totalEarnings = paidOut + state.availableBalance;
    const platformFees = Math.round(totalEarnings * 0.1);
    return okResponse(config, {
      totalEarnings,
      totalPayouts: paidOut,
      availableBalance: state.availableBalance,
      grossRevenue: totalEarnings + platformFees,
      platformFees,
      netRevenue: totalEarnings,
      monthlyBreakdown: [
        { month: 'Jun', gross: 9800, fees: 980, net: 8820, bookings: 42 },
        { month: 'Jul', gross: 11400, fees: 1140, net: 10260, bookings: 51 },
        { month: 'Aug', gross: 12900, fees: 1290, net: 11610, bookings: 59 },
        { month: 'Sep', gross: 14200, fees: 1420, net: 12780, bookings: 66 },
        { month: 'Oct', gross: 16100, fees: 1610, net: 14490, bookings: 74 },
        { month: 'Nov', gross: 17400, fees: 1740, net: 15660, bookings: 81 },
      ],
      recentPayouts: state.payouts,
    });
  }

  if (method === 'GET' && path === '/host/payouts') {
    return okResponse(config, { payouts: state.payouts });
  }

  if (method === 'POST' && path === '/host/payouts') {
    const amount = Number(body.amount || 0);
    if (amount <= 0 || amount > state.availableBalance) {
      errorResponse(config, 400, 'INVALID_PAYOUT', 'Requested amount exceeds available host balance');
    }
    const newPayout: HostPayoutRecord = {
      id: `pay-host-${Date.now().toString(36)}`,
      amount,
      status: 'processing',
      createdAt: new Date().toISOString(),
      processedAt: null,
    };
    state.payouts = [newPayout, ...state.payouts];
    state.availableBalance = Math.max(0, state.availableBalance - amount);
    saveState(state);
    return okResponse(config, { payout: newPayout }, 201);
  }

  return okResponse(config, {});
}
