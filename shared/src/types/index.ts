// ============================================================
// Parkly — Core Domain Types
// ============================================================

// --- Common ---
export interface Coordinates {
  lat: number; // -90 to 90
  lng: number; // -180 to 180
}

export type Currency = 'INR';

export type VehicleType = 'motorcycle' | 'compact' | 'sedan' | 'suv' | 'van' | 'truck';
export type SecurityLevel = 'none' | 'basic' | 'monitored' | 'staffed' | 'gated';
export type AccessibilityFeature =
  | 'wheelchair_accessible'
  | 'step_free'
  | 'wide_bays'
  | 'accessible_payment';

// --- User & Auth ---
export type UserRole = 'driver' | 'host' | 'admin';

export interface User {
  id: string;
  phone: string;
  name: string;
  email?: string;
  role: UserRole;
  isActive: boolean;
  createdAt: string; // ISO 8601
  updatedAt: string;
}

export interface Vehicle {
  id: string;
  userId: string;
  licensePlate: string;
  vehicleType: VehicleType;
  make?: string;
  model?: string;
  color?: string;
  isDefault: boolean;
  createdAt: string;
}

export interface OtpRecord {
  phone: string;
  otp: string;
  attempts: number;
  expiresAt: number; // Unix timestamp (DynamoDB TTL)
  createdAt: string;
}

export interface JwtPayload {
  sub: string;     // user id
  phone: string;
  role: UserRole;
  iat?: number;
  exp?: number;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

// --- Host ---
export type VerificationStatus = 'pending' | 'approved' | 'rejected';

export interface Host {
  id: string;
  userId: string;
  businessName?: string;
  panNumber?: string;       // for KYC
  bankAccountNumber?: string; // masked
  ifscCode?: string;
  verificationStatus: VerificationStatus;
  verifiedAt?: string;
  totalEarnings: number;
  totalPayouts: number;
  createdAt: string;
  updatedAt: string;
}

// --- Parking Space ---
export type SpaceStatus = 'draft' | 'pending_verification' | 'active' | 'inactive' | 'suspended';

export interface ParkingSpaceAmenities {
  evCharging: boolean;
  covered: boolean;
  securityLevel: SecurityLevel;
  accessibility: AccessibilityFeature[];
  cctv: boolean;
  lighting: boolean;
  attendant: boolean;
}

export interface TimeSlot {
  dayOfWeek: number;   // 0=Sunday..6=Saturday
  startTime: string;   // HH:mm
  endTime: string;     // HH:mm
}

export interface PricingInfo {
  hourlyRate: number;
  currency: Currency;
  dynamicPricingEnabled: boolean;
  minBookingHours: number;
  maxBookingHours: number;
}

export interface ParkingSpace {
  id: string;
  hostId: string;
  name: string;
  description?: string;
  coordinates: Coordinates;
  geohash: string;           // pre-computed for geospatial index
  address: string;
  city: string;
  state: string;
  pincode: string;
  regionId: string;
  totalCapacity: number;
  vehicleTypes: VehicleType[];
  amenities: ParkingSpaceAmenities;
  pricing: PricingInfo;
  availabilitySchedule: TimeSlot[];
  photoUrls: string[];
  status: SpaceStatus;
  createdAt: string;
  updatedAt: string;
}

// --- Booking ---
export type BookingType = 'instant' | 'scheduled' | 'recurring';
export type RecurringFrequency = 'daily' | 'weekly';
export type BookingStatus =
  | 'created'
  | 'confirmed'
  | 'active'
  | 'completed'
  | 'cancelled'
  | 'refunded';

export interface BookingRecurring {
  frequency: RecurringFrequency;
  endDate: string; // ISO 8601
}

export interface Booking {
  id: string;
  userId: string;
  spaceId: string;
  vehicleId: string;
  hostId: string;
  type: BookingType;
  status: BookingStatus;
  startTime: string;   // ISO 8601
  endTime: string;     // ISO 8601
  durationMinutes: number;
  recurring?: BookingRecurring;
  totalAmount: number;
  currency: Currency;
  paymentId?: string;
  cancellationReason?: string;
  cancelledAt?: string;
  completedAt?: string;
  createdAt: string;
  updatedAt: string;
}

// --- Payment ---
export type PaymentStatus = 'pending' | 'completed' | 'failed' | 'refunded';
export type PaymentProvider = 'mock' | 'razorpay' | 'cashfree';

export interface Payment {
  id: string;
  bookingId: string;
  userId: string;
  amount: number;
  currency: Currency;
  provider: PaymentProvider;
  providerPaymentId?: string;    // from gateway
  providerOrderId?: string;      // for UPI
  tokenRef?: string;             // tokenized payment ref, never store raw data
  status: PaymentStatus;
  failureReason?: string;
  refundAmount?: number;
  refundId?: string;
  refundedAt?: string;
  payoutId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Payout {
  id: string;
  hostId: string;
  amount: number;           // after platform commission
  platformCommission: number;
  currency: Currency;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  paymentIds: string[];     // bookings included
  processedAt?: string;
  createdAt: string;
}

// --- Occupancy ---
export type OccupancySource = 'sensor' | 'manual' | 'simulator';

export interface OccupancyRecord {
  spaceId: string;           // PK in DynamoDB
  timestamp: string;         // SK in DynamoDB
  occupiedSlots: number;
  totalSlots: number;
  occupancyRate: number;     // 0-1
  source: OccupancySource;
  sensorId?: string;
}

export interface CurrentOccupancy {
  spaceId: string;
  occupiedSlots: number;
  totalSlots: number;
  occupancyRate: number;
  lastUpdated: string;
  source: OccupancySource;
}

// --- Prediction ---
export interface AvailabilityPrediction {
  spaceId: string;
  arrivalTime: string;
  durationMinutes: number;
  probabilityPercent: number;    // 0-100
  estimatedVacancies: number;    // >= 0, <= totalCapacity
  confidencePercent: number;     // 0-100
  insufficientData: boolean;
  alternatives: AlternativeSpace[];
}

export interface AlternativeSpace {
  id: string;
  name: string;
  coordinates: Coordinates;
  confidencePercent: number;
  distanceKm: number;
}

// --- Search ---
export type LocationInputType = 'text' | 'coordinates' | 'currentLocation';

export type LocationInput =
  | { type: 'text'; value: string }
  | { type: 'coordinates'; lat: number; lng: number }
  | { type: 'currentLocation' };

export interface FilterSet {
  priceRange?: { min: number; max: number };
  vehicleType?: VehicleType;
  evCharging?: boolean;
  coveredParking?: boolean;
  securityLevel?: SecurityLevel;
  accessibility?: AccessibilityFeature[];
}

export interface SearchQuery {
  location: LocationInput;
  arrivalTime: string;
  duration?: number;
  radius?: number;
  filters?: FilterSet;
  page?: number;
  pageSize?: number;
}

export interface SearchResponse {
  version: string;
  results: ParkingSpaceResult[];
  pagination: PaginationInfo;
  meta: SearchMeta;
}

export interface ParkingSpaceResult {
  id: string;
  name: string;
  address: string;
  coordinates: Coordinates;
  distance: { value: number; unit: 'km' | 'm' };
  price: { value: number; currency: Currency; per: 'hour' };
  availability: {
    probabilityPercent: number;
    estimatedVacancies: number;
    confidencePercent: number;
    insufficientData: boolean;
  };
  alternatives?: AlternativeSpace[];
  amenities: {
    evCharging: boolean;
    covered: boolean;
    securityLevel: SecurityLevel;
    accessibility: AccessibilityFeature[];
    vehicleTypes: VehicleType[];
  };
  rankScore?: number;
  photoUrls: string[];
}

export interface PaginationInfo {
  page: number;
  pageSize: number;
  totalResults: number;
  totalPages: number;
}

export interface SearchMeta {
  predictionStatus: 'available' | 'unavailable' | 'degraded';
  searchRadiusKm: number;
  appliedDefaults: string[];
}

// --- Notification ---
export type NotificationType =
  | 'booking_confirmed'
  | 'booking_cancelled'
  | 'booking_reminder'
  | 'payment_completed'
  | 'refund_issued'
  | 'otp'
  | 'payout_scheduled'
  | 'verification_approved'
  | 'verification_rejected';

export type NotificationChannel = 'in_app' | 'push' | 'sms';

export interface Notification {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  channels: NotificationChannel[];
  read: boolean;
  sentAt?: string;
  createdAt: string;
}

// --- Dispute ---
export type DisputeStatus = 'open' | 'under_review' | 'resolved' | 'closed';
export type DisputeType = 'no_show' | 'unauthorized_use' | 'payment_dispute' | 'other';

export interface Dispute {
  id: string;
  bookingId: string;
  raisedBy: string;        // userId
  disputeType: DisputeType;
  description: string;
  status: DisputeStatus;
  resolution?: string;
  resolvedBy?: string;     // adminId
  createdAt: string;
  updatedAt: string;
}

// --- Region ---
export interface Region {
  id: string;
  name: string;
  country: string;
  state: string;
  city: string;
  bounds: { north: number; south: number; east: number; west: number };
  geohashPrefixes: string[];
  adjacentRegionIds: string[];
  isActive: boolean;
}

// --- Pricing ---
export interface PricingRule {
  id: string;
  spaceId?: string;         // null = global rule
  name: string;
  timeRanges: { start: string; end: string; daysOfWeek: number[] }[];
  multiplier: number;       // e.g. 1.5 = 50% more
  isActive: boolean;
  createdAt: string;
}

export interface PricingResult {
  spaceId: string;
  baseRate: number;
  effectiveRate: number;
  currency: Currency;
  multiplier: number;
  appliedRules: string[];   // rule names
  validUntil: string;
}

// --- Events (EventBridge) ---
export type ParklyEventType =
  | 'BookingCreated'
  | 'BookingConfirmed'
  | 'BookingCancelled'
  | 'BookingCompleted'
  | 'PaymentCompleted'
  | 'RefundIssued'
  | 'PayoutScheduled'
  | 'OccupancyChanged'
  | 'HostVerificationRequested'
  | 'HostVerificationCompleted';

export interface ParklyEvent<T = unknown> {
  type: ParklyEventType;
  version: '1.0';
  timestamp: string;
  source: string;
  data: T;
}

// --- API Common ---
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    field?: string;
    details?: unknown;
  };
  meta?: {
    requestId: string;
    timestamp: string;
  };
}

export interface HealthCheck {
  status: 'ok' | 'degraded' | 'down';
  service: string;
  version: string;
  timestamp: string;
  checks?: Record<string, 'ok' | 'error'>;
}
