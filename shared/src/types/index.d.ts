export interface Coordinates {
    lat: number;
    lng: number;
}
export type Currency = 'INR';
export type VehicleType = 'motorcycle' | 'compact' | 'sedan' | 'suv' | 'van' | 'truck';
export type SecurityLevel = 'none' | 'basic' | 'monitored' | 'staffed' | 'gated';
export type AccessibilityFeature = 'wheelchair_accessible' | 'step_free' | 'wide_bays' | 'accessible_payment';
export type UserRole = 'driver' | 'host' | 'admin';
export interface User {
    id: string;
    phone: string;
    name: string;
    email?: string;
    role: UserRole;
    isActive: boolean;
    createdAt: string;
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
    expiresAt: number;
    createdAt: string;
}
export interface JwtPayload {
    sub: string;
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
export type VerificationStatus = 'pending' | 'approved' | 'rejected';
export interface Host {
    id: string;
    userId: string;
    businessName?: string;
    panNumber?: string;
    bankAccountNumber?: string;
    ifscCode?: string;
    verificationStatus: VerificationStatus;
    verifiedAt?: string;
    totalEarnings: number;
    totalPayouts: number;
    createdAt: string;
    updatedAt: string;
}
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
    dayOfWeek: number;
    startTime: string;
    endTime: string;
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
    geohash: string;
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
export type BookingType = 'instant' | 'scheduled' | 'recurring';
export type RecurringFrequency = 'daily' | 'weekly';
export type BookingStatus = 'created' | 'confirmed' | 'active' | 'completed' | 'cancelled' | 'refunded';
export interface BookingRecurring {
    frequency: RecurringFrequency;
    endDate: string;
}
export interface Booking {
    id: string;
    userId: string;
    spaceId: string;
    vehicleId: string;
    hostId: string;
    type: BookingType;
    status: BookingStatus;
    startTime: string;
    endTime: string;
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
export type PaymentStatus = 'pending' | 'completed' | 'failed' | 'refunded';
export type PaymentProvider = 'mock' | 'razorpay' | 'cashfree';
export interface Payment {
    id: string;
    bookingId: string;
    userId: string;
    amount: number;
    currency: Currency;
    provider: PaymentProvider;
    providerPaymentId?: string;
    providerOrderId?: string;
    tokenRef?: string;
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
    amount: number;
    platformCommission: number;
    currency: Currency;
    status: 'pending' | 'processing' | 'completed' | 'failed';
    paymentIds: string[];
    processedAt?: string;
    createdAt: string;
}
export type OccupancySource = 'sensor' | 'manual' | 'simulator';
export interface OccupancyRecord {
    spaceId: string;
    timestamp: string;
    occupiedSlots: number;
    totalSlots: number;
    occupancyRate: number;
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
export interface AvailabilityPrediction {
    spaceId: string;
    arrivalTime: string;
    durationMinutes: number;
    probabilityPercent: number;
    estimatedVacancies: number;
    confidencePercent: number;
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
export type LocationInputType = 'text' | 'coordinates' | 'currentLocation';
export type LocationInput = {
    type: 'text';
    value: string;
} | {
    type: 'coordinates';
    lat: number;
    lng: number;
} | {
    type: 'currentLocation';
};
export interface FilterSet {
    priceRange?: {
        min: number;
        max: number;
    };
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
    distance: {
        value: number;
        unit: 'km' | 'm';
    };
    price: {
        value: number;
        currency: Currency;
        per: 'hour';
    };
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
export type NotificationType = 'booking_confirmed' | 'booking_cancelled' | 'booking_reminder' | 'payment_completed' | 'refund_issued' | 'otp' | 'payout_scheduled' | 'verification_approved' | 'verification_rejected';
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
export type DisputeStatus = 'open' | 'under_review' | 'resolved' | 'closed';
export type DisputeType = 'no_show' | 'unauthorized_use' | 'payment_dispute' | 'other';
export interface Dispute {
    id: string;
    bookingId: string;
    raisedBy: string;
    disputeType: DisputeType;
    description: string;
    status: DisputeStatus;
    resolution?: string;
    resolvedBy?: string;
    createdAt: string;
    updatedAt: string;
}
export interface Region {
    id: string;
    name: string;
    country: string;
    state: string;
    city: string;
    bounds: {
        north: number;
        south: number;
        east: number;
        west: number;
    };
    geohashPrefixes: string[];
    adjacentRegionIds: string[];
    isActive: boolean;
}
export interface PricingRule {
    id: string;
    spaceId?: string;
    name: string;
    timeRanges: {
        start: string;
        end: string;
        daysOfWeek: number[];
    }[];
    multiplier: number;
    isActive: boolean;
    createdAt: string;
}
export interface PricingResult {
    spaceId: string;
    baseRate: number;
    effectiveRate: number;
    currency: Currency;
    multiplier: number;
    appliedRules: string[];
    validUntil: string;
}
export type ParklyEventType = 'BookingCreated' | 'BookingConfirmed' | 'BookingCancelled' | 'BookingCompleted' | 'PaymentCompleted' | 'RefundIssued' | 'PayoutScheduled' | 'OccupancyChanged' | 'HostVerificationRequested' | 'HostVerificationCompleted';
export interface ParklyEvent<T = unknown> {
    type: ParklyEventType;
    version: '1.0';
    timestamp: string;
    source: string;
    data: T;
}
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
//# sourceMappingURL=index.d.ts.map