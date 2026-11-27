// ============================================================
// Parkly Mobile — Stateful Local Data Adapter
// Powers interactive Chennai search, pricing, AI concierge,
// OTP auth, vehicles, bookings/QR passes, UPI payments, & alerts.
// ============================================================

import AsyncStorage from '@react-native-async-storage/async-storage';
import { AxiosError, AxiosHeaders, AxiosResponse, InternalAxiosRequestConfig } from 'axios';

const MOCK_STORAGE_KEY = '@parkly/mobile_mock_state_v1';

interface SpaceItem {
  id: string;
  hostId: string;
  name: string;
  address: string;
  city: string;
  coordinates: { lat: number; lng: number };
  totalCapacity: number;
  hourlyRate: number;
  distanceKm: number;
  probabilityPercent: number;
  confidencePercent: number;
  evCharging: boolean;
  covered: boolean;
  securityLevel: string;
  entryInstructions: string;
  slotLabel: string;
}

interface VehicleItem {
  id: string;
  licensePlate: string;
  vehicleType: 'motorcycle' | 'compact' | 'sedan' | 'suv' | 'van' | 'truck';
  make?: string;
  isDefault?: boolean;
}

interface BookingItem {
  id: string;
  userId: string;
  spaceId: string;
  vehicleId: string;
  hostId: string;
  type: string;
  status: string;
  startTime: string;
  endTime: string;
  durationMinutes: number;
  totalAmount: number;
  currency: string;
  qrToken: string;
  slotNumber: string;
  space: {
    id: string;
    name: string;
    address: string;
    latitude: number;
    longitude: number;
  };
  vehicle: {
    id: string;
    licensePlate: string;
    vehicleType: string;
  };
}

interface NotificationItem {
  id: string;
  title: string;
  message: string;
  read: boolean;
  createdAt: string;
}

interface MobileMockState {
  user: {
    id: string;
    name: string;
    phone: string;
    email: string;
    role: 'driver' | 'host' | 'admin';
  };
  vehicles: VehicleItem[];
  bookings: BookingItem[];
  notifications: NotificationItem[];
}

const CHENNAI_SPACES: SpaceItem[] = [
  {
    id: 'sp-tng-001',
    hostId: 'host-chennai-001',
    name: 'Express Avenue & T Nagar Hub',
    address: '23, Panagal Park Road, T Nagar, Chennai 600017',
    city: 'Chennai',
    coordinates: { lat: 13.0418, lng: 80.2341 },
    totalCapacity: 24,
    hourlyRate: 50,
    distanceKm: 0.4,
    probabilityPercent: 88,
    confidencePercent: 95,
    evCharging: true,
    covered: true,
    securityLevel: 'gated',
    entryInstructions: 'Enter via Panagal Park North Gate. Attendant or barrier scanner validates your QR pass.',
    slotLabel: 'Bay A-04 (EV Ready)',
  },
  {
    id: 'sp-tng-002',
    hostId: 'host-chennai-001',
    name: 'Pondy Bazaar Smart Multi-Level',
    address: 'Pondy Bazaar near Pothys, T Nagar, Chennai 600017',
    city: 'Chennai',
    coordinates: { lat: 13.0405, lng: 80.2378 },
    totalCapacity: 32,
    hourlyRate: 40,
    distanceKm: 0.7,
    probabilityPercent: 76,
    confidencePercent: 92,
    evCharging: false,
    covered: true,
    securityLevel: 'staffed',
    entryInstructions: 'Approach Pondy Bazaar East Ramp Level 2; scan QR code at automated boom barrier.',
    slotLabel: 'Level 2 · Slot B-12',
  },
  {
    id: 'sp-tng-003',
    hostId: 'host-chennai-001',
    name: 'Panagal Park EV Charging Station',
    address: 'Usman Road Flyover Junction, T Nagar, Chennai 600017',
    city: 'Chennai',
    coordinates: { lat: 13.0389, lng: 80.2325 },
    totalCapacity: 14,
    hourlyRate: 55,
    distanceKm: 1.1,
    probabilityPercent: 64,
    confidencePercent: 89,
    evCharging: true,
    covered: false,
    securityLevel: 'monitored',
    entryInstructions: '22kW fast chargers on bays 1–6. Present QR pass to activate charger lock.',
    slotLabel: 'EV Charger #03',
  },
  {
    id: 'sp-ana-002',
    hostId: 'host-chennai-001',
    name: 'Anna Nagar Tower Covered Hub',
    address: '42, 2nd Avenue near Tower Park, Anna Nagar, Chennai 600102',
    city: 'Chennai',
    coordinates: { lat: 13.0849, lng: 80.2101 },
    totalCapacity: 28,
    hourlyRate: 60,
    distanceKm: 1.8,
    probabilityPercent: 82,
    confidencePercent: 94,
    evCharging: true,
    covered: true,
    securityLevel: 'gated',
    entryInstructions: 'Shaded basement bays adjacent to 2nd Avenue Metro Gate 2.',
    slotLabel: 'Basement B-08',
  },
  {
    id: 'sp-ady-003',
    hostId: 'host-chennai-001',
    name: 'Adyar LB Road Executive Bays',
    address: '15, Lattice Bridge Road, Adyar, Chennai 600020',
    city: 'Chennai',
    coordinates: { lat: 13.0067, lng: 80.2566 },
    totalCapacity: 16,
    hourlyRate: 35,
    distanceKm: 2.3,
    probabilityPercent: 91,
    confidencePercent: 96,
    evCharging: false,
    covered: true,
    securityLevel: 'staffed',
    entryInstructions: 'Enter from LB Road service lane; security kiosk handles QR verification.',
    slotLabel: 'Bay C-02',
  },
  {
    id: 'sp-vel-004',
    hostId: 'host-chennai-002',
    name: 'Velachery Phoenix Bypass EV Park',
    address: '142, Velachery Main Road, Chennai 600042',
    city: 'Chennai',
    coordinates: { lat: 12.9791, lng: 80.2204 },
    totalCapacity: 22,
    hourlyRate: 45,
    distanceKm: 3.1,
    probabilityPercent: 79,
    confidencePercent: 91,
    evCharging: true,
    covered: true,
    securityLevel: 'gated',
    entryInstructions: 'Direct access from Phoenix Mall bypass lane via Gate 3.',
    slotLabel: 'Bay D-11',
  },
  {
    id: 'sp-omr-005',
    hostId: 'host-chennai-002',
    name: 'OMR Tidel IT Corridor Lot',
    address: '88, Rajiv Gandhi Salai, Taramani, Chennai 600113',
    city: 'Chennai',
    coordinates: { lat: 12.9896, lng: 80.2494 },
    totalCapacity: 40,
    hourlyRate: 30,
    distanceKm: 3.6,
    probabilityPercent: 85,
    confidencePercent: 93,
    evCharging: true,
    covered: false,
    securityLevel: 'gated',
    entryInstructions: 'Scan QR pass at Taramani Tech Park North Boom Barrier.',
    slotLabel: 'Tech Lot E-19',
  },
  {
    id: 'sp-myl-006',
    hostId: 'host-chennai-003',
    name: 'Mylapore Luz Corner Plaza',
    address: '19, Luz Church Road, Mylapore, Chennai 600004',
    city: 'Chennai',
    coordinates: { lat: 13.0355, lng: 80.2644 },
    totalCapacity: 12,
    hourlyRate: 40,
    distanceKm: 1.5,
    probabilityPercent: 48,
    confidencePercent: 84,
    evCharging: false,
    covered: false,
    securityLevel: 'monitored',
    entryInstructions: 'Compact open-air guarded bay behind Luz Church Junction.',
    slotLabel: 'Bay M-05',
  },
];

function buildQrToken(bookingId: string): string {
  return `PARKLY.v1.${bookingId}.a9c4e20b71f39d08`;
}

function createInitialState(): MobileMockState {
  const now = Date.now();
  const h = 3600000;
  return {
    user: {
      id: 'usr-driver-001',
      name: 'Vikram Nair',
      phone: '+919840012345',
      email: 'vikram.nair@parkly.in',
      role: 'driver',
    },
    vehicles: [
      { id: 'veh-driver-001', licensePlate: 'TN01AB1234', vehicleType: 'sedan', make: 'Hyundai Creta', isDefault: true },
      { id: 'veh-driver-002', licensePlate: 'TN09CD5678', vehicleType: 'motorcycle', make: 'Ather 450X', isDefault: false },
    ],
    bookings: [
      {
        id: 'bk-live-1001',
        userId: 'usr-driver-001',
        spaceId: 'sp-tng-001',
        vehicleId: 'veh-driver-001',
        hostId: 'host-chennai-001',
        type: 'instant',
        status: 'confirmed',
        startTime: new Date(now - 0.25 * h).toISOString(),
        endTime: new Date(now + 1.75 * h).toISOString(),
        durationMinutes: 120,
        totalAmount: 105,
        currency: 'INR',
        qrToken: buildQrToken('bk-live-1001'),
        slotNumber: 'Bay A-04 (EV Ready)',
        space: {
          id: 'sp-tng-001',
          name: 'Express Avenue & T Nagar Hub',
          address: '23, Panagal Park Road, T Nagar, Chennai 600017',
          latitude: 13.0418,
          longitude: 80.2341,
        },
        vehicle: {
          id: 'veh-driver-001',
          licensePlate: 'TN01AB1234',
          vehicleType: 'sedan',
        },
      },
      {
        id: 'bk-past-0902',
        userId: 'usr-driver-001',
        spaceId: 'sp-ana-002',
        vehicleId: 'veh-driver-001',
        hostId: 'host-chennai-001',
        type: 'instant',
        status: 'completed',
        startTime: new Date(now - 36 * h).toISOString(),
        endTime: new Date(now - 33 * h).toISOString(),
        durationMinutes: 180,
        totalAmount: 189,
        currency: 'INR',
        qrToken: buildQrToken('bk-past-0902'),
        slotNumber: 'Basement B-08',
        space: {
          id: 'sp-ana-002',
          name: 'Anna Nagar Tower Covered Hub',
          address: '42, 2nd Avenue near Tower Park, Anna Nagar, Chennai 600102',
          latitude: 13.0849,
          longitude: 80.2101,
        },
        vehicle: {
          id: 'veh-driver-001',
          licensePlate: 'TN01AB1234',
          vehicleType: 'sedan',
        },
      },
    ],
    notifications: [
      {
        id: 'ntf-01',
        title: 'Gate Pass Active — Express Avenue Hub',
        message: 'Bay A-04 reserved for TN01AB1234. Present QR code at Panagal Park North Gate.',
        read: false,
        createdAt: new Date(now - 15 * 60000).toISOString(),
      },
      {
        id: 'ntf-02',
        title: 'Dynamic Off-Peak Savings Unlocked',
        message: 'OMR Tidel IT Corridor spots are currently ₹30/hr for EV & covered bays.',
        read: false,
        createdAt: new Date(now - 4 * h).toISOString(),
      },
      {
        id: 'ntf-03',
        title: 'Payment Receipt — ₹189 Paid via UPI',
        message: 'Completed 3h session at Anna Nagar Tower Covered Hub.',
        read: true,
        createdAt: new Date(now - 33 * h).toISOString(),
      },
    ],
  };
}

let memoryState: MobileMockState | null = null;
let hydrated = false;

async function getState(): Promise<MobileMockState> {
  if (!hydrated) {
    hydrated = true;
    try {
      const raw = await AsyncStorage.getItem(MOCK_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as MobileMockState;
        if (parsed && Array.isArray(parsed.bookings) && Array.isArray(parsed.vehicles)) {
          memoryState = parsed;
        }
      }
    } catch {
      // Ignore read error
    }
  }
  if (!memoryState) {
    memoryState = createInitialState();
    await persistState(memoryState);
  }
  return memoryState;
}

async function persistState(state: MobileMockState): Promise<void> {
  memoryState = state;
  try {
    await AsyncStorage.setItem(MOCK_STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Ignore write failure
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
  const clean = raw.replace(/^https?:\/\/[^/]+/i, '').replace(/^\/api\/v1/i, '');
  return (clean.split('?')[0] || '/').replace(/\/+$/, '') || '/';
}

function ok<T>(config: InternalAxiosRequestConfig, data: T, status = 200): AxiosResponse {
  return {
    data: { success: true, data },
    status,
    statusText: 'OK',
    headers: new AxiosHeaders(),
    config,
    request: {},
  };
}

function fail(config: InternalAxiosRequestConfig, status: number, code: string, message: string): never {
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

function formatSearchResult(s: SpaceItem) {
  return {
    id: s.id,
    hostId: s.hostId,
    name: s.name,
    address: s.address,
    coordinates: s.coordinates,
    distance: { value: s.distanceKm, unit: 'km' },
    price: { value: s.hourlyRate, currency: 'INR', per: 'hour' },
    availability: { probabilityPercent: s.probabilityPercent, confidencePercent: s.confidencePercent },
    amenities: {
      evCharging: s.evCharging,
      covered: s.covered,
      securityLevel: s.securityLevel,
    },
  };
}

export async function mobileMockAdapter(config: InternalAxiosRequestConfig): Promise<AxiosResponse> {
  await delay(90);

  const method = (config.method || 'get').toUpperCase();
  const path = getPath(config);
  const body = parseBody(config);
  const params = (config.params || {}) as Record<string, string | undefined>;
  const state = await getState();

  // Auth
  if (method === 'POST' && path === '/auth/otp/request') {
    return ok(config, { message: 'OTP sent successfully', devOtp: '482910' });
  }

  if (method === 'POST' && path === '/auth/otp/verify') {
    if (body.phone) state.user.phone = body.phone;
    if (body.name) state.user.name = body.name;
    await persistState(state);
    return ok(config, {
      user: state.user,
      tokens: {
        accessToken: 'parkly.driver.session.token',
        refreshToken: 'parkly.driver.refresh.token',
      },
    });
  }

  if (method === 'POST' && path === '/auth/refresh') {
    return ok(config, {
      tokens: {
        accessToken: 'parkly.driver.session.token',
        refreshToken: 'parkly.driver.refresh.token',
      },
    });
  }

  if (method === 'GET' && (path === '/auth/me' || path === '/auth/profile')) {
    return ok(config, { user: state.user });
  }

  if (method === 'PATCH' && path === '/auth/profile') {
    state.user = {
      ...state.user,
      ...(body.name ? { name: body.name } : {}),
      ...(body.email ? { email: body.email } : {}),
    };
    await persistState(state);
    return ok(config, { user: state.user });
  }

  // Vehicles
  if (method === 'GET' && path === '/auth/vehicles') {
    return ok(config, { vehicles: state.vehicles });
  }

  if (method === 'POST' && path === '/auth/vehicles') {
    const existing = state.vehicles.find((v) => v.licensePlate === body.licensePlate);
    if (existing) {
      return ok(config, { vehicle: existing }, 200);
    }
    const vehicle: VehicleItem = {
      id: `veh-${Date.now().toString(36)}`,
      licensePlate: String(body.licensePlate || 'TN01XY9999').toUpperCase(),
      vehicleType: body.vehicleType || 'sedan',
      ...(body.make ? { make: body.make } : {}),
      isDefault: state.vehicles.length === 0,
    };
    state.vehicles = [vehicle, ...state.vehicles];
    await persistState(state);
    return ok(config, { vehicle }, 201);
  }

  const delVehicleMatch = path.match(/^\/auth\/vehicles\/([^/]+)$/);
  if (method === 'DELETE' && delVehicleMatch) {
    state.vehicles = state.vehicles.filter((v) => v.id !== delVehicleMatch[1]);
    await persistState(state);
    return ok(config, { deleted: true });
  }

  // Search & Spaces
  if (method === 'POST' && path === '/search') {
    const q = String(body.location?.value || '').trim().toLowerCase();
    let matched = CHENNAI_SPACES;
    if (q && q !== 'chennai') {
      const normalized = q.includes('pothys') ? 'pondy' : q;
      const direct = CHENNAI_SPACES.filter(
        (s) =>
          s.name.toLowerCase().includes(normalized) ||
          s.address.toLowerCase().includes(normalized) ||
          s.id.toLowerCase().includes(normalized),
      );
      if (direct.length > 0) {
        const rest = CHENNAI_SPACES.filter((s) => !direct.includes(s));
        matched = [...direct, ...rest.slice(0, 2)];
      }
    }
    return ok(config, {
      results: matched.map(formatSearchResult),
      total: matched.length,
    });
  }

  const spaceMatch = path.match(/^\/search\/spaces\/([^/]+)$/);
  if (method === 'GET' && spaceMatch) {
    const s = CHENNAI_SPACES.find((item) => item.id === spaceMatch[1]) || CHENNAI_SPACES[0]!;
    return ok(config, {
      id: s.id,
      name: s.name,
      address: s.address,
      hostId: s.hostId,
      totalCapacity: s.totalCapacity,
      hourlyRate: s.hourlyRate,
      evCharging: s.evCharging,
      covered: s.covered,
      securityLevel: s.securityLevel,
      coordinates: s.coordinates,
      photoUrls: [],
    });
  }

  // Dynamic Pricing
  const priceMatch = path.match(/^\/pricing\/([^/]+)$/);
  if (method === 'GET' && priceMatch) {
    const s = CHENNAI_SPACES.find((item) => item.id === priceMatch[1]) || CHENNAI_SPACES[0]!;
    return ok(config, {
      spaceId: s.id,
      baseRate: s.hourlyRate,
      effectiveRate: s.hourlyRate,
      multiplier: 1.0,
    });
  }

  // Bookings
  if (method === 'GET' && path === '/bookings') {
    const statusFilter = params.status;
    const list = statusFilter ? state.bookings.filter((b) => b.status === statusFilter) : state.bookings;
    return ok(config, { bookings: list, total: list.length });
  }

  if (method === 'POST' && path === '/bookings') {
    const space = CHENNAI_SPACES.find((s) => s.id === body.spaceId) || CHENNAI_SPACES[0]!;
    const vehicle = state.vehicles.find((v) => v.id === body.vehicleId) || state.vehicles[0]!;
    const startMs = new Date(body.startTime || Date.now()).getTime();
    const endMs = new Date(body.endTime || startMs + 2 * 3600000).getTime();
    const durationMinutes = Math.max(15, Math.round((endMs - startMs) / 60000));
    const subtotal = space.hourlyRate * (durationMinutes / 60);
    const serverAmount = Math.round(subtotal * 1.05);
    const id = `bk-${Date.now().toString(36)}`;
    const qrToken = buildQrToken(id);

    const created: BookingItem = {
      id,
      userId: state.user.id,
      spaceId: space.id,
      vehicleId: vehicle.id,
      hostId: space.hostId,
      type: body.type || 'instant',
      status: 'confirmed',
      startTime: new Date(startMs).toISOString(),
      endTime: new Date(endMs).toISOString(),
      durationMinutes,
      totalAmount: serverAmount,
      currency: 'INR',
      qrToken,
      slotNumber: space.slotLabel,
      space: {
        id: space.id,
        name: space.name,
        address: space.address,
        latitude: space.coordinates.lat,
        longitude: space.coordinates.lng,
      },
      vehicle: {
        id: vehicle.id,
        licensePlate: vehicle.licensePlate,
        vehicleType: vehicle.vehicleType,
      },
    };

    state.bookings = [created, ...state.bookings];
    state.notifications = [
      {
        id: `ntf-${Date.now().toString(36)}`,
        title: `Booking Confirmed — ${space.name}`,
        message: `QR Gate Pass #${id.slice(-8).toUpperCase()} ready for ${vehicle.licensePlate} (₹${serverAmount}).`,
        read: false,
        createdAt: new Date().toISOString(),
      },
      ...state.notifications,
    ];
    await persistState(state);
    return ok(config, { booking: created }, 201);
  }

  if (method === 'GET' && path === '/bookings/verify-qr') {
    const found = state.bookings.find((b) => b.qrToken === params.qrToken) || state.bookings[0];
    return ok(config, { valid: Boolean(found), booking: found });
  }

  const extendMatch = path.match(/^\/bookings\/([^/]+)\/extend$/);
  if (method === 'PUT' && extendMatch) {
    const idx = state.bookings.findIndex((b) => b.id === extendMatch[1]);
    if (idx === -1) fail(config, 404, 'NOT_FOUND', 'Booking not found');
    const b = state.bookings[idx]!;
    const mins = Number(body.additionalMinutes || 60);
    const space = CHENNAI_SPACES.find((s) => s.id === b.spaceId) || CHENNAI_SPACES[0]!;
    const extraFee = Math.round((space.hourlyRate * (mins / 60)) * 1.05);
    const nextEnd = new Date(new Date(b.endTime).getTime() + mins * 60000).toISOString();
    const updated: BookingItem = {
      ...b,
      endTime: nextEnd,
      durationMinutes: b.durationMinutes + mins,
      totalAmount: b.totalAmount + extraFee,
    };
    state.bookings[idx] = updated;
    await persistState(state);
    return ok(config, updated);
  }

  const cancelMatch = path.match(/^\/bookings\/([^/]+)\/cancel$/);
  if (method === 'PUT' && cancelMatch) {
    const idx = state.bookings.findIndex((b) => b.id === cancelMatch[1]);
    if (idx === -1) fail(config, 404, 'NOT_FOUND', 'Booking not found');
    const updated: BookingItem = { ...state.bookings[idx]!, status: 'cancelled' };
    state.bookings[idx] = updated;
    await persistState(state);
    return ok(config, { booking: updated });
  }

  const getBookingMatch = path.match(/^\/bookings\/([^/]+)$/);
  if (method === 'GET' && getBookingMatch) {
    const found = state.bookings.find((b) => b.id === getBookingMatch[1]);
    if (!found) fail(config, 404, 'NOT_FOUND', 'Booking not found');
    return ok(config, { booking: found });
  }

  // Payments
  if (method === 'POST' && path === '/payments/initiate') {
    return ok(
      config,
      {
        payment: {
          id: `pay-${Date.now().toString(36)}`,
          bookingId: body.bookingId,
          amount: Number(body.amount || 100),
          providerOrderId: `order_${Date.now().toString(36)}`,
          status: 'pending',
        },
      },
      201,
    );
  }

  const payConfirmMatch = path.match(/^\/payments\/([^/]+)\/confirm$/);
  if (method === 'PUT' && payConfirmMatch) {
    return ok(config, {
      payment: {
        id: payConfirmMatch[1],
        status: 'completed',
      },
    });
  }

  // AI Concierge
  if (method === 'POST' && path === '/concierge') {
    await delay(220);
    const q = String(body.query || '').toLowerCase();
    const priceMatch = q.match(/(?:under|below|<|₹)\s*(\d+)/);
    const maxPrice = priceMatch ? Number(priceMatch[1]) : Infinity;
    const wantsEv = q.includes('ev') || q.includes('charg');
    const wantsCovered = q.includes('cover') || q.includes('shade');
    const wantsCheap = q.includes('cheap') || q.includes('budget') || q.includes('low');

    let candidates = [...CHENNAI_SPACES];
    if (q.includes('pothys') || q.includes('pondy') || q.includes('t nagar') || q.includes('tnagar')) {
      candidates = candidates.filter((s) => s.address.toLowerCase().includes('t nagar'));
    } else if (q.includes('anna')) {
      candidates = candidates.filter((s) => s.address.toLowerCase().includes('anna'));
    } else if (q.includes('omr') || q.includes('tidel') || q.includes('it')) {
      candidates = candidates.filter((s) => s.address.toLowerCase().includes('rajiv') || s.name.toLowerCase().includes('omr'));
    } else if (q.includes('adyar')) {
      candidates = candidates.filter((s) => s.address.toLowerCase().includes('adyar'));
    } else if (q.includes('velachery')) {
      candidates = candidates.filter((s) => s.address.toLowerCase().includes('velachery'));
    }

    if (wantsEv) {
      const evFiltered = candidates.filter((s) => s.evCharging);
      if (evFiltered.length > 0) candidates = evFiltered;
    }
    if (wantsCovered) {
      const covFiltered = candidates.filter((s) => s.covered);
      if (covFiltered.length > 0) candidates = covFiltered;
    }
    if (maxPrice < Infinity) {
      const priceFiltered = candidates.filter((s) => s.hourlyRate <= maxPrice);
      if (priceFiltered.length > 0) candidates = priceFiltered;
    }
    if (wantsCheap) {
      candidates.sort((a, b) => a.hourlyRate - b.hourlyRate);
    } else {
      candidates.sort((a, b) => b.probabilityPercent - a.probabilityPercent);
    }

    const best = candidates[0] || CHENNAI_SPACES[0]!;
    return ok(config, {
      action: 'RECOMMEND',
      recommendedSpace: {
        id: best.id,
        hostId: best.hostId,
        name: best.name,
        address: best.address,
        hourlyRate: best.hourlyRate,
        arrivalProbability: best.probabilityPercent,
        distanceMeters: Math.round(best.distanceKm * 1000),
      },
      turnByTurnDeepLink: `geo:${best.coordinates.lat},${best.coordinates.lng}?q=${encodeURIComponent(best.name)}`,
      entryInstructions: best.entryInstructions,
    });
  }

  // Notifications
  if (method === 'GET' && path === '/notifications') {
    return ok(config, { notifications: state.notifications });
  }

  const notifReadMatch = path.match(/^\/notifications\/([^/]+)\/read$/);
  if (method === 'PUT' && notifReadMatch) {
    state.notifications = state.notifications.map((n) =>
      n.id === notifReadMatch[1] ? { ...n, read: true } : n,
    );
    await persistState(state);
    return ok(config, { read: true });
  }

  if (method === 'POST' && path === '/notifications/devices') {
    return ok(config, { registered: true }, 201);
  }

  return ok(config, {});
}
