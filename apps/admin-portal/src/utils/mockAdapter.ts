// ============================================================
// Admin Portal — Stateful Local Data Adapter
// Powers Overview metrics, Verification queue, Dispute Mediation,
// User governance (RBAC/DPDPA), City Carbon Analytics, Alerts,
// Audit Stream, and persistent System Settings.
// ============================================================

import { AxiosError, AxiosHeaders, AxiosResponse, InternalAxiosRequestConfig } from 'axios';

const STORAGE_KEY = 'parkly_admin_store_v1';

interface AdminState {
  profile: {
    id: string;
    name: string;
    email: string;
    phone: string;
    role: 'admin';
    verified: boolean;
  };
  users: Array<{
    id: string;
    phone: string;
    name: string | null;
    email: string | null;
    role: 'driver' | 'host' | 'admin';
    isActive: boolean;
    isAnonymized: boolean;
    createdAt: string;
  }>;
  bookings: Array<{
    id: string;
    spaceId: string;
    userId: string;
    startTime: string;
    endTime: string;
    totalAmount: number;
    status: string;
    type: string;
    createdAt: string;
    user: { id: string; name: string | null; phone: string };
    space: { id: string; name: string; city: string };
    vehicle: { id: string; licensePlate: string; vehicleType: string };
  }>;
  verifications: Array<{
    id: string;
    name: string;
    address: string;
    totalCapacity: number;
    hourlyRate: number;
    status: string;
    host: { id: string; user: { name: string | null; phone: string } };
  }>;
  disputes: Array<{
    id: string;
    bookingId: string;
    disputeType: string;
    description: string;
    status: 'open' | 'under_review' | 'resolved' | 'closed';
    resolution?: string | null;
    createdAt: string;
    booking: {
      id: string;
      totalAmount: number;
      space: { name: string };
      vehicle: { licensePlate: string };
    };
    user: { name: string | null; phone: string };
  }>;
  alerts: Array<{
    id: string;
    severity: 'critical' | 'warning' | 'info';
    title: string;
    detail: string;
    source: string;
    resolved: boolean;
    createdAt: string;
  }>;
  auditLogs: Array<{
    id: string;
    actorId: string;
    actorName: string;
    action: string;
    target: string;
    ipAddress: string;
    createdAt: string;
  }>;
  settings: Record<string, string>;
  approvedSpaceCountBonus: number;
}

function createInitialAdminState(): AdminState {
  const now = Date.now();
  const h = 3600000;
  return {
    profile: {
      id: 'usr-admin-001',
      name: 'Priya Natarajan',
      email: 'priya.natarajan@parkly.in',
      phone: '+919840000001',
      role: 'admin',
      verified: true,
    },
    users: [
      { id: 'usr-admin-001', phone: '+919840000001', name: 'Priya Natarajan', email: 'priya.natarajan@parkly.in', role: 'admin', isActive: true, isAnonymized: false, createdAt: new Date(now - 90 * 24 * h).toISOString() },
      { id: 'usr-host-001', phone: '+919840123456', name: 'Karthik Subramanian', email: 'karthik.s@parkly.in', role: 'host', isActive: true, isAnonymized: false, createdAt: new Date(now - 64 * 24 * h).toISOString() },
      { id: 'usr-host-002', phone: '+919840778899', name: 'Lakshmi Narayanan', email: 'lakshmi.n@parkly.in', role: 'host', isActive: true, isAnonymized: false, createdAt: new Date(now - 52 * 24 * h).toISOString() },
      { id: 'usr-host-003', phone: '+919840889900', name: 'Aravindhan Raj', email: 'aravind.raj@parkly.in', role: 'host', isActive: true, isAnonymized: false, createdAt: new Date(now - 40 * 24 * h).toISOString() },
      { id: 'usr-drv-001', phone: '+919840012345', name: 'Vikram Nair', email: 'vikram.nair@parkly.in', role: 'driver', isActive: true, isAnonymized: false, createdAt: new Date(now - 35 * 24 * h).toISOString() },
      { id: 'usr-drv-002', phone: '+919840112233', name: 'Ananya Krishnan', email: 'ananya.k@parkly.in', role: 'driver', isActive: true, isAnonymized: false, createdAt: new Date(now - 28 * 24 * h).toISOString() },
      { id: 'usr-drv-003', phone: '+919840223344', name: 'Rohan Sundaram', email: 'rohan.s@parkly.in', role: 'driver', isActive: true, isAnonymized: false, createdAt: new Date(now - 21 * 24 * h).toISOString() },
      { id: 'usr-drv-004', phone: '+919840334455', name: 'Meenakshi Iyer', email: 'meenakshi@parkly.in', role: 'driver', isActive: true, isAnonymized: false, createdAt: new Date(now - 15 * 24 * h).toISOString() },
      { id: 'usr-drv-005', phone: '+919840445566', name: 'Suresh Venkataraman', email: 'suresh.v@parkly.in', role: 'driver', isActive: false, isAnonymized: false, createdAt: new Date(now - 10 * 24 * h).toISOString() },
    ],
    bookings: [
      {
        id: 'bk-adm-9001',
        spaceId: 'sp-tng-001',
        userId: 'usr-drv-001',
        startTime: new Date(now - 1 * h).toISOString(),
        endTime: new Date(now + 2 * h).toISOString(),
        totalAmount: 158,
        status: 'active',
        type: 'instant',
        createdAt: new Date(now - 1 * h).toISOString(),
        user: { id: 'usr-drv-001', name: 'Vikram Nair', phone: '+919840012345' },
        space: { id: 'sp-tng-001', name: 'T Nagar Panagal Park Plaza', city: 'Chennai' },
        vehicle: { id: 'veh-01', licensePlate: 'TN01AB1234', vehicleType: 'sedan' },
      },
      {
        id: 'bk-adm-9002',
        spaceId: 'sp-ana-002',
        userId: 'usr-drv-002',
        startTime: new Date(now + 1 * h).toISOString(),
        endTime: new Date(now + 4 * h).toISOString(),
        totalAmount: 189,
        status: 'confirmed',
        type: 'instant',
        createdAt: new Date(now - 0.5 * h).toISOString(),
        user: { id: 'usr-drv-002', name: 'Ananya Krishnan', phone: '+919840112233' },
        space: { id: 'sp-ana-002', name: 'Anna Nagar Tower Covered Hub', city: 'Chennai' },
        vehicle: { id: 'veh-02', licensePlate: 'TN01CD4512', vehicleType: 'sedan' },
      },
      {
        id: 'bk-adm-9003',
        spaceId: 'sp-ady-003',
        userId: 'usr-drv-003',
        startTime: new Date(now - 24 * h).toISOString(),
        endTime: new Date(now - 21 * h).toISOString(),
        totalAmount: 126,
        status: 'completed',
        type: 'instant',
        createdAt: new Date(now - 25 * h).toISOString(),
        user: { id: 'usr-drv-003', name: 'Rohan Sundaram', phone: '+919840223344' },
        space: { id: 'sp-ady-003', name: 'Adyar LB Road Executive Bays', city: 'Chennai' },
        vehicle: { id: 'veh-03', licensePlate: 'TN09EF8821', vehicleType: 'suv' },
      },
      {
        id: 'bk-adm-9004',
        spaceId: 'sp-tng-001',
        userId: 'usr-drv-004',
        startTime: new Date(now - 48 * h).toISOString(),
        endTime: new Date(now - 44 * h).toISOString(),
        totalAmount: 210,
        status: 'completed',
        type: 'scheduled',
        createdAt: new Date(now - 49 * h).toISOString(),
        user: { id: 'usr-drv-004', name: 'Meenakshi Iyer', phone: '+919840334455' },
        space: { id: 'sp-tng-001', name: 'T Nagar Panagal Park Plaza', city: 'Chennai' },
        vehicle: { id: 'veh-04', licensePlate: 'TN10AB3309', vehicleType: 'compact' },
      },
      {
        id: 'bk-adm-9005',
        spaceId: 'sp-ana-002',
        userId: 'usr-drv-002',
        startTime: new Date(now - 72 * h).toISOString(),
        endTime: new Date(now - 70 * h).toISOString(),
        totalAmount: 126,
        status: 'completed',
        type: 'instant',
        createdAt: new Date(now - 73 * h).toISOString(),
        user: { id: 'usr-drv-002', name: 'Ananya Krishnan', phone: '+919840112233' },
        space: { id: 'sp-ana-002', name: 'Anna Nagar Tower Covered Hub', city: 'Chennai' },
        vehicle: { id: 'veh-02', licensePlate: 'TN01CD4512', vehicleType: 'sedan' },
      },
      {
        id: 'bk-adm-9006',
        spaceId: 'sp-vel-005',
        userId: 'usr-drv-005',
        startTime: new Date(now - 96 * h).toISOString(),
        endTime: new Date(now - 94 * h).toISOString(),
        totalAmount: 105,
        status: 'refunded',
        type: 'instant',
        createdAt: new Date(now - 97 * h).toISOString(),
        user: { id: 'usr-drv-005', name: 'Suresh Venkataraman', phone: '+919840445566' },
        space: { id: 'sp-vel-005', name: 'Velachery Grand Mall EV Annex', city: 'Chennai' },
        vehicle: { id: 'veh-05', licensePlate: 'TN07KL9102', vehicleType: 'sedan' },
      },
    ],
    verifications: [
      {
        id: 'sp-omr-004',
        name: 'OMR Tidel EV Superhub',
        address: '88, Rajiv Gandhi Salai, Taramani, Chennai 600113',
        totalCapacity: 30,
        hourlyRate: 45,
        status: 'pending_verification',
        host: { id: 'hst-001', user: { name: 'Karthik Subramanian', phone: '+919840123456' } },
      },
      {
        id: 'sp-vel-005',
        name: 'Velachery Phoenix Bypass Bays',
        address: '142, Velachery Main Road, Chennai 600042',
        totalCapacity: 22,
        hourlyRate: 50,
        status: 'pending_verification',
        host: { id: 'hst-002', user: { name: 'Lakshmi Narayanan', phone: '+919840778899' } },
      },
      {
        id: 'sp-myl-006',
        name: 'Mylapore Luz Corner Lot',
        address: '19, Luz Church Road, Mylapore, Chennai 600004',
        totalCapacity: 14,
        hourlyRate: 40,
        status: 'pending_verification',
        host: { id: 'hst-003', user: { name: 'Aravindhan Raj', phone: '+919840889900' } },
      },
    ],
    disputes: [
      {
        id: 'dsp-ch-001',
        bookingId: 'bk-adm-9001',
        disputeType: 'unauthorized_use',
        description: 'Ultrasonic bay sensor remained occupied 42 minutes past scheduled checkout; driver cites exit lane boom gate queue.',
        status: 'open',
        resolution: null,
        createdAt: new Date(now - 3 * h).toISOString(),
        booking: {
          id: 'bk-adm-9001',
          totalAmount: 158,
          space: { name: 'T Nagar Panagal Park Plaza' },
          vehicle: { licensePlate: 'TN01AB1234' },
        },
        user: { name: 'Vikram Nair', phone: '+919840012345' },
      },
      {
        id: 'dsp-ch-002',
        bookingId: 'bk-adm-9002',
        disputeType: 'blocked_bay',
        description: 'Driver arrived on time at Anna Nagar Tower Hub but designated bay B-07 had an unauthorized two-wheeler parked.',
        status: 'under_review',
        resolution: null,
        createdAt: new Date(now - 7 * h).toISOString(),
        booking: {
          id: 'bk-adm-9002',
          totalAmount: 189,
          space: { name: 'Anna Nagar Tower Covered Hub' },
          vehicle: { licensePlate: 'TN01CD4512' },
        },
        user: { name: 'Ananya Krishnan', phone: '+919840112233' },
      },
      {
        id: 'dsp-ch-003',
        bookingId: 'bk-adm-9003',
        disputeType: 'qr_scan_timeout',
        description: 'Entry QR timed out due to basement cellular deadzone; guard logged manual entry.',
        status: 'resolved',
        resolution: 'Adjudicated via Gate Attendant log match. Zero overcharge applied; host compensated full ₹126.',
        createdAt: new Date(now - 30 * h).toISOString(),
        booking: {
          id: 'bk-adm-9003',
          totalAmount: 126,
          space: { name: 'Adyar LB Road Executive Bays' },
          vehicle: { licensePlate: 'TN09EF8821' },
        },
        user: { name: 'Rohan Sundaram', phone: '+919840223344' },
      },
    ],
    alerts: [
      {
        id: 'al-001',
        severity: 'warning',
        title: 'Surge Demand Spike — T Nagar Corridor',
        detail: 'Evening occupancy reached 94% across Panagal Park & Pondy Bazaar hubs. Dynamic multiplier raised to 1.35x.',
        source: 'pricing-service',
        resolved: false,
        createdAt: new Date(now - 0.8 * h).toISOString(),
      },
      {
        id: 'al-002',
        severity: 'critical',
        title: 'LoRaWAN Gate Controller Heartbeat Delay',
        detail: 'Sensor gateway GW-OMR-04 missed 2 consecutive 30s heartbeats; automated failover to QR gate verification active.',
        source: 'occupancy-service',
        resolved: false,
        createdAt: new Date(now - 2.2 * h).toISOString(),
      },
      {
        id: 'al-003',
        severity: 'info',
        title: 'Scheduled Razorpay Settlement Batch Completed',
        detail: '42 host payout transfers totaling ₹1,42,800 reconciled cleanly with zero UTR discrepancies.',
        source: 'payment-service',
        resolved: true,
        createdAt: new Date(now - 10 * h).toISOString(),
      },
    ],
    auditLogs: [
      {
        id: 'log-101',
        actorId: 'usr-admin-001',
        actorName: 'Priya Natarajan',
        action: 'SPACE_APPROVED',
        target: 'Adyar LB Road Executive Bays (sp-ady-003)',
        ipAddress: '10.12.4.18',
        createdAt: new Date(now - 4 * h).toISOString(),
      },
      {
        id: 'log-102',
        actorId: 'ai-pricing',
        actorName: 'DynamicPricingAgent',
        action: 'SURGE_MULTIPLIER_UPDATED',
        target: 'Zone T-Nagar -> 1.35x peak',
        ipAddress: '10.12.8.40',
        createdAt: new Date(now - 1.5 * h).toISOString(),
      },
      {
        id: 'log-103',
        actorId: 'ai-mediation',
        actorName: 'DisputeMediationAgent',
        action: 'DISPUTE_ADJUDICATED',
        target: 'Dispute #dsp-ch-003 (Adyar Hub)',
        ipAddress: '10.12.8.42',
        createdAt: new Date(now - 28 * h).toISOString(),
      },
    ],
    settings: {
      platformName: 'Parkly',
      supportEmail: 'support@parkly.in',
      defaultCity: 'Chennai',
      platformFeePercent: '5',
      autoApproveVerifiedHosts: 'true',
      maintenanceMode: 'false',
    },
    approvedSpaceCountBonus: 0,
  };
}

function loadState(): AdminState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as AdminState;
      if (parsed && Array.isArray(parsed.users) && Array.isArray(parsed.verifications)) {
        return parsed;
      }
    }
  } catch {
    // Ignore storage read failure
  }
  const initial = createInitialAdminState();
  saveState(initial);
  return initial;
}

function saveState(state: AdminState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Ignore quota failure
  }
}

function appendAudit(state: AdminState, action: string, target: string): void {
  state.auditLogs.unshift({
    id: `log-${Date.now().toString(36)}`,
    actorId: state.profile.id,
    actorName: state.profile.name,
    action,
    target,
    ipAddress: '10.12.4.18',
    createdAt: new Date().toISOString(),
  });
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

const ZONE_METRICS: Record<string, { label: string; hrs: number; mins: number; co2: number; unsatisfied: number }> = {
  't-nagar': { label: 'T Nagar (Panagal Park / Pondy Bazaar)', hrs: 3420, mins: 48600, co2: 1412, unsatisfied: 46 },
  'anna-nagar': { label: 'Anna Nagar (2nd Avenue / Tower Park)', hrs: 2890, mins: 39400, co2: 1185, unsatisfied: 31 },
  omr: { label: 'OMR IT Corridor (Tidel Park / Sholinganallur)', hrs: 3150, mins: 41200, co2: 1290, unsatisfied: 27 },
  adyar: { label: 'Adyar (LB Road / Besant Nagar Junction)', hrs: 1940, mins: 26800, co2: 810, unsatisfied: 14 },
};

export async function adminMockAdapter(config: InternalAxiosRequestConfig): Promise<AxiosResponse> {
  await delay(120);

  const method = (config.method || 'get').toUpperCase();
  const path = getPath(config);
  const body = parseBody(config);
  const params = (config.params || {}) as Record<string, string | undefined>;
  const state = loadState();

  // Auth
  if (method === 'POST' && path === '/auth/otp/request') {
    return okResponse(config, { message: 'OTP sent successfully', devOtp: '482910' });
  }

  if (method === 'POST' && path === '/auth/otp/verify') {
    if (body.phone) state.profile.phone = body.phone;
    if (body.name) state.profile.name = body.name;
    saveState(state);
    return okResponse(config, {
      user: state.profile,
      tokens: {
        accessToken: 'parkly.admin.session.token',
        refreshToken: 'parkly.admin.refresh.token',
      },
    });
  }

  if (method === 'POST' && path === '/auth/refresh') {
    return okResponse(config, {
      tokens: {
        accessToken: 'parkly.admin.session.token',
        refreshToken: 'parkly.admin.refresh.token',
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
    };
    saveState(state);
    return okResponse(config, { user: state.profile });
  }

  // Metrics & Revenue
  if (method === 'GET' && path === '/admin/metrics') {
    const totalRevenue = state.bookings.reduce((s, b) => s + Number(b.totalAmount || 0), 0) + 148200;
    return okResponse(config, {
      totalUsers: state.users.length + 1412,
      activeSpaces: 42 + state.approvedSpaceCountBonus,
      totalBookings: state.bookings.length + 1834,
      completedBookings: state.bookings.filter((b) => b.status === 'completed').length + 1620,
      pendingVerifications: state.verifications.length,
      activeHosts: state.users.filter((u) => u.role === 'host').length + 25,
      openDisputes: state.disputes.filter((d) => d.status === 'open' || d.status === 'under_review').length,
      unresolvedAlerts: state.alerts.filter((a) => !a.resolved).length,
      totalRevenue,
      platformFeeRevenue: Math.round(totalRevenue * 0.05),
    });
  }

  if (method === 'GET' && path === '/admin/revenue') {
    const totalRevenue = state.bookings.reduce((s, b) => s + Number(b.totalAmount || 0), 0) + 148200;
    return okResponse(config, {
      totalRevenue,
      platformFeeRevenue: Math.round(totalRevenue * 0.05),
      netHostPayouts: Math.round(totalRevenue * 0.95),
    });
  }

  // Users CRUD & DPDPA
  if (method === 'GET' && path === '/admin/users') {
    const roleFilter = params.role?.toLowerCase();
    const filtered = roleFilter ? state.users.filter((u) => u.role === roleFilter) : state.users;
    return okResponse(config, { users: filtered, total: filtered.length });
  }

  const userRoleMatch = path.match(/^\/admin\/users\/([^/]+)\/role$/);
  if ((method === 'PUT' || method === 'PATCH') && userRoleMatch) {
    const user = state.users.find((u) => u.id === userRoleMatch[1]);
    if (!user) errorResponse(config, 404, 'NOT_FOUND', 'User not found');
    user.role = body.role;
    appendAudit(state, 'ROLE_UPDATED', `${user.name || user.phone} -> ${body.role.toUpperCase()}`);
    saveState(state);
    return okResponse(config, { user });
  }

  const userSuspendMatch = path.match(/^\/admin\/users\/([^/]+)\/suspend$/);
  if ((method === 'PUT' || method === 'POST') && userSuspendMatch) {
    const user = state.users.find((u) => u.id === userSuspendMatch[1]);
    if (!user) errorResponse(config, 404, 'NOT_FOUND', 'User not found');
    user.isActive = false;
    appendAudit(state, 'USER_SUSPENDED', `${user.name || user.phone} (${body.reason || 'Policy review'})`);
    saveState(state);
    return okResponse(config, { user });
  }

  const userUnsuspendMatch = path.match(/^\/admin\/users\/([^/]+)\/unsuspend$/);
  if ((method === 'PUT' || method === 'POST') && userUnsuspendMatch) {
    const user = state.users.find((u) => u.id === userUnsuspendMatch[1]);
    if (!user) errorResponse(config, 404, 'NOT_FOUND', 'User not found');
    user.isActive = true;
    appendAudit(state, 'USER_UNSUSPENDED', user.name || user.phone);
    saveState(state);
    return okResponse(config, { user });
  }

  const userAnonymizeMatch = path.match(/^\/admin\/users\/([^/]+)\/anonymize$/);
  if (method === 'POST' && userAnonymizeMatch) {
    const user = state.users.find((u) => u.id === userAnonymizeMatch[1]);
    if (!user) errorResponse(config, 404, 'NOT_FOUND', 'User not found');
    const prevLabel = user.name || user.phone;
    user.name = 'Anonymized User';
    user.email = null;
    user.phone = `+91XXXXXX${user.phone.slice(-4)}`;
    user.isActive = false;
    user.isAnonymized = true;
    appendAudit(state, 'DPDPA_USER_ANONYMIZED', `${prevLabel} (${user.id})`);
    saveState(state);
    return okResponse(config, { anonymized: true, userId: user.id });
  }

  // Bookings
  if (method === 'GET' && path === '/admin/bookings') {
    const statusFilter = params.status?.toLowerCase();
    const filtered = statusFilter ? state.bookings.filter((b) => b.status === statusFilter) : state.bookings;
    return okResponse(config, { bookings: filtered, total: filtered.length });
  }

  // Verifications
  if (method === 'GET' && path === '/admin/verifications') {
    return okResponse(config, { spaces: state.verifications });
  }

  const verifyApproveMatch = path.match(/^\/admin\/verifications\/([^/]+)\/approve$/);
  if (method === 'POST' && verifyApproveMatch) {
    const space = state.verifications.find((v) => v.id === verifyApproveMatch[1]);
    state.verifications = state.verifications.filter((v) => v.id !== verifyApproveMatch[1]);
    state.approvedSpaceCountBonus += 1;
    appendAudit(state, 'SPACE_APPROVED', `${space?.name || verifyApproveMatch[1]} (${verifyApproveMatch[1]})`);
    saveState(state);
    return okResponse(config, { approved: true, spaceId: verifyApproveMatch[1] });
  }

  const verifyRejectMatch = path.match(/^\/admin\/verifications\/([^/]+)\/reject$/);
  if (method === 'POST' && verifyRejectMatch) {
    const space = state.verifications.find((v) => v.id === verifyRejectMatch[1]);
    state.verifications = state.verifications.filter((v) => v.id !== verifyRejectMatch[1]);
    appendAudit(state, 'SPACE_REJECTED', `${space?.name || verifyRejectMatch[1]} (${body.reason || 'Needs resurvey'})`);
    saveState(state);
    return okResponse(config, { rejected: true, spaceId: verifyRejectMatch[1] });
  }

  // Disputes & AI Mediation
  if (method === 'GET' && path === '/admin/disputes') {
    const statusFilter = params.status;
    const filtered = statusFilter ? state.disputes.filter((d) => d.status === statusFilter) : state.disputes;
    return okResponse(config, { disputes: filtered });
  }

  const disputeMediateMatch = path.match(/^\/admin\/disputes\/([^/]+)\/mediate$/);
  if (method === 'POST' && disputeMediateMatch) {
    await delay(280);
    const dispute = state.disputes.find((d) => d.id === disputeMediateMatch[1]);
    if (!dispute) errorResponse(config, 404, 'NOT_FOUND', 'Dispute not found');
    const isBlocked = dispute.disputeType === 'blocked_bay' || body.incidentType === 'NO_SHOW';
    const resolutionText = isBlocked
      ? `Adjudication: FULL_DRIVER_REFUND_AND_PENALTY_WAIVER — Reassigned driver immediately; host penalized ₹50 SLA credit & ₹${dispute.booking.totalAmount} refunded.`
      : `Adjudication: SPLIT_GRACE_ADJUSTMENT — Exit ANPR log confirmed 9-minute queue delay; overstay fee capped at ₹25 and host credited ₹${dispute.booking.totalAmount}.`;
    dispute.status = 'resolved';
    dispute.resolution = resolutionText;
    appendAudit(state, 'AI_DISPUTE_MEDIATED', `${dispute.id} (${dispute.booking.space.name})`);
    saveState(state);
    return okResponse(config, {
      disputeId: dispute.id,
      adjudication: isBlocked ? 'FULL_REFUND' : 'PARTIAL_ADJUSTMENT',
      resolution: resolutionText,
      status: 'resolved',
    });
  }

  // City Mobility & Carbon Analytics
  if (method === 'GET' && path === '/admin/analytics/city') {
    const zoneList = (params.zones || 't-nagar,anna-nagar,omr,adyar').split(',').filter(Boolean);
    const periodFactor = params.period === '2026-W34' ? 0.89 : params.period === '2026-W35' ? 0.94 : 1.0;
    const matched = zoneList.map((z) => ZONE_METRICS[z]).filter(Boolean) as Array<typeof ZONE_METRICS[string]>;
    const activeSet = matched.length > 0 ? matched : Object.values(ZONE_METRICS);

    const totalOffStreetHoursProvided = Math.round(activeSet.reduce((s, m) => s + m.hrs, 0) * periodFactor);
    const estimatedCurbsideCruisingReducedMinutes = Math.round(activeSet.reduce((s, m) => s + m.mins, 0) * periodFactor);
    const estimatedCO2AbatedKg = Math.round(activeSet.reduce((s, m) => s + m.co2, 0) * periodFactor);
    const unmetDemandChokePoints = activeSet.map((m) => ({
      intersection: m.label,
      unsatisfiedSearches: Math.round(m.unsatisfied * periodFactor),
    }));

    return okResponse(config, {
      cityId: params.cityId || 'chennai',
      period: params.period || '2026-W36',
      reportGeneratedAt: new Date().toISOString(),
      metrics: {
        totalOffStreetHoursProvided,
        estimatedCurbsideCruisingReducedMinutes,
        estimatedCO2AbatedKg,
        unmetDemandChokePoints,
      },
      recommendation: `Onboard +2 commercial host hubs in ${activeSet[0]?.label || 'T Nagar'} before Friday 17:00 peak to absorb ${unmetDemandChokePoints[0]?.unsatisfiedSearches ?? 40}+ unsatisfied evening searches and avoid curbside spillover on arterial lanes.`,
    });
  }

  // Alerts
  if (method === 'GET' && path === '/admin/alerts') {
    return okResponse(config, { alerts: state.alerts });
  }

  const alertResolveMatch = path.match(/^\/admin\/alerts\/([^/]+)\/resolve$/);
  if ((method === 'PUT' || method === 'POST') && alertResolveMatch) {
    const alert = state.alerts.find((a) => a.id === alertResolveMatch[1]);
    if (alert) {
      alert.resolved = true;
      appendAudit(state, 'ALERT_RESOLVED', alert.title);
      saveState(state);
    }
    return okResponse(config, { resolved: true, alert });
  }

  const alertDeleteMatch = path.match(/^\/admin\/alerts\/([^/]+)$/);
  if (method === 'DELETE' && alertDeleteMatch) {
    const alert = state.alerts.find((a) => a.id === alertDeleteMatch[1]);
    state.alerts = state.alerts.filter((a) => a.id !== alertDeleteMatch[1]);
    if (alert) appendAudit(state, 'ALERT_DISMISSED', alert.title);
    saveState(state);
    return okResponse(config, { deleted: true });
  }

  // Audit Logs & Settings
  if (method === 'GET' && path === '/admin/audit-logs') {
    return okResponse(config, { logs: state.auditLogs });
  }

  if (method === 'GET' && path === '/admin/settings') {
    return okResponse(config, { settings: state.settings });
  }

  if (method === 'PUT' && path === '/admin/settings') {
    const incoming = body.settings || body || {};
    for (const [k, v] of Object.entries(incoming)) {
      state.settings[k] = String(v);
    }
    appendAudit(state, 'SYSTEM_SETTINGS_UPDATED', `City=${state.settings.defaultCity}, Fee=${state.settings.platformFeePercent}%`);
    saveState(state);
    return okResponse(config, { settings: state.settings });
  }

  return okResponse(config, {});
}
