import type { AuthUser } from '../store/auth.store';
import type { SpaceType } from '../api/client';
import type { VehicleClass } from '../components/VehicleIllustration';

export interface DemoSpaceItem {
  id: string;
  hostId: string;
  name: string;
  spaceType: SpaceType;
  entryInstructions?: string;
  address: string;
  coordinates: { lat: number; lng: number };
  distance: { value: number; unit: string };
  price: { value: number; currency: string; per: string };
  availability: { probabilityPercent: number; confidencePercent: number };
  amenities: { evCharging: boolean; covered: boolean; securityLevel: string };
  totalCapacity: number;
}

export function getSpaceTypeMeta(spaceType?: SpaceType | string): {
  label: string;
  shortLabel: string;
  isPrivate: boolean;
} {
  switch (spaceType) {
    case 'private_house':
      return { label: 'Private House / Driveway', shortLabel: 'Private Home', isPrivate: true };
    case 'apartment_bay':
      return { label: 'Apartment Visitor Bay', shortLabel: 'Apartment Bay', isPrivate: true };
    case 'gated_compound':
      return { label: 'Gated Private Compound', shortLabel: 'Gated Private', isPrivate: true };
    default:
      return { label: 'Official Commercial Lot', shortLabel: 'Official Lot', isPrivate: false };
  }
}

export interface DemoVehicle {
  id: string;
  userId: string;
  licensePlate: string;
  vehicleType: VehicleClass;
  make?: string;
  model?: string;
  color?: string;
  isDefault: boolean;
  createdAt: string;
}

export interface DemoBooking {
  id: string;
  spaceId: string;
  hostId: string;
  vehicleId: string;
  spaceName: string;
  spaceAddress: string;
  vehiclePlate: string;
  vehicleType: VehicleClass;
  status: string;
  startTime: string;
  endTime: string;
  durationMinutes: number;
  totalAmount: number;
  hourlyRate: number;
  type: string;
  slotNumber: string;
  gateCode?: string;
  checkedInAt?: string;
  checkedOutAt?: string;
  leavingNotifiedAt?: string;
  overstayMinutes?: number;
  overstayAmount?: number;
}

export const DEMO_USER: AuthUser = {
  id: '00000000-0000-4000-8000-000000000003',
  name: 'Arjun Kumar (Demo)',
  phone: '+919876543211',
  email: 'arjun.demo@parkly.in',
  role: 'driver',
};

export const DEMO_HOST_ID = '00000000-0000-4000-8000-000000000101';

export const DEMO_SPACES: DemoSpaceItem[] = [
  {
    id: '00000000-0000-4000-8000-000000001001',
    hostId: DEMO_HOST_ID,
    name: 'T Nagar Parking Complex - Spot A',
    spaceType: 'commercial',
    entryInstructions: 'Scan QR pass at Panagal Park Road boom barrier.',
    address: '23, Panagal Park Road, T Nagar, Chennai 600017',
    coordinates: { lat: 13.0418, lng: 80.2341 },
    distance: { value: 0.4, unit: 'km' },
    price: { value: 40, currency: 'INR', per: 'hour' },
    availability: { probabilityPercent: 88, confidencePercent: 95 },
    amenities: { evCharging: true, covered: true, securityLevel: 'gated' },
    totalCapacity: 24,
  },
  {
    id: '00000000-0000-4000-8000-000000001005',
    hostId: DEMO_HOST_ID,
    name: '14B Thirumalai House Driveway',
    spaceType: 'private_house',
    entryInstructions: 'Private residential porch. Ring gate bell or call homeowner on arrival.',
    address: '14B, Thirumalai Pillai Road, T Nagar, Chennai 600017',
    coordinates: { lat: 13.0452, lng: 80.2372 },
    distance: { value: 0.5, unit: 'km' },
    price: { value: 25, currency: 'INR', per: 'hour' },
    availability: { probabilityPercent: 94, confidencePercent: 92 },
    amenities: { evCharging: false, covered: true, securityLevel: 'gated' },
    totalCapacity: 1,
  },
  {
    id: '00000000-0000-4000-8000-000000001002',
    hostId: DEMO_HOST_ID,
    name: 'Pondy Bazaar Smart Multi-Level',
    spaceType: 'commercial',
    address: '25, Panagal Park Road, T Nagar, Chennai 600017',
    coordinates: { lat: 13.042, lng: 80.2345 },
    distance: { value: 0.8, unit: 'km' },
    price: { value: 35, currency: 'INR', per: 'hour' },
    availability: { probabilityPercent: 72, confidencePercent: 90 },
    amenities: { evCharging: false, covered: true, securityLevel: 'staffed' },
    totalCapacity: 18,
  },
  {
    id: '00000000-0000-4000-8000-000000001006',
    hostId: DEMO_HOST_ID,
    name: '22, 4th Main Villa Carport',
    spaceType: 'private_house',
    entryInstructions: 'Shaded independent house carport with 15A EV wall socket inside gate.',
    address: '22, 4th Main Road, Anna Nagar, Chennai 600040',
    coordinates: { lat: 13.0849, lng: 80.2101 },
    distance: { value: 1.2, unit: 'km' },
    price: { value: 30, currency: 'INR', per: 'hour' },
    availability: { probabilityPercent: 90, confidencePercent: 91 },
    amenities: { evCharging: true, covered: true, securityLevel: 'gated' },
    totalCapacity: 2,
  },
  {
    id: '00000000-0000-4000-8000-000000001003',
    hostId: DEMO_HOST_ID,
    name: 'Adyar Smart Park',
    spaceType: 'commercial',
    address: '12, Gandhi Nagar, Adyar, Chennai 600020',
    coordinates: { lat: 13.0067, lng: 80.2566 },
    distance: { value: 1.5, unit: 'km' },
    price: { value: 35, currency: 'INR', per: 'hour' },
    availability: { probabilityPercent: 65, confidencePercent: 86 },
    amenities: { evCharging: true, covered: false, securityLevel: 'monitored' },
    totalCapacity: 15,
  },
  {
    id: '00000000-0000-4000-8000-000000001007',
    hostId: DEMO_HOST_ID,
    name: 'Besant Ave Villa Stilt Bay',
    spaceType: 'apartment_bay',
    entryInstructions: 'Show Parkly pass to watchman at Gate 1 and park in Bay G-02.',
    address: '8, Besant Avenue, Adyar, Chennai 600020',
    coordinates: { lat: 13.0038, lng: 80.2598 },
    distance: { value: 1.8, unit: 'km' },
    price: { value: 25, currency: 'INR', per: 'hour' },
    availability: { probabilityPercent: 86, confidencePercent: 89 },
    amenities: { evCharging: false, covered: true, securityLevel: 'staffed' },
    totalCapacity: 1,
  },
  {
    id: '00000000-0000-4000-8000-000000001004',
    hostId: DEMO_HOST_ID,
    name: 'Velachery EV Parking Hub',
    spaceType: 'commercial',
    address: '89, 100 Feet Road, Velachery, Chennai 600042',
    coordinates: { lat: 12.9791, lng: 80.2204 },
    distance: { value: 2.3, unit: 'km' },
    price: { value: 50, currency: 'INR', per: 'hour' },
    availability: { probabilityPercent: 45, confidencePercent: 82 },
    amenities: { evCharging: true, covered: true, securityLevel: 'staffed' },
    totalCapacity: 20,
  },
];

export const DEMO_VEHICLES: DemoVehicle[] = [
  {
    id: '00000000-0000-4000-8000-000000000201',
    userId: DEMO_USER.id,
    licensePlate: 'TN01AB1234',
    vehicleType: 'sedan',
    make: 'Honda',
    model: 'City',
    color: 'Pearl White',
    isDefault: true,
    createdAt: '2026-11-01T10:00:00.000Z',
  },
  {
    id: '00000000-0000-4000-8000-000000000202',
    userId: DEMO_USER.id,
    licensePlate: 'TN09CD5678',
    vehicleType: 'motorcycle',
    make: 'TVS',
    model: 'iQube EV',
    color: 'Harbor Blue',
    isDefault: false,
    createdAt: '2026-11-05T10:00:00.000Z',
  },
];

export function createDemoBookings(): DemoBooking[] {
  const now = Date.now();
  return [
    {
      id: '11111111-1111-4111-8111-000000000001',
      spaceId: DEMO_SPACES[0].id,
      hostId: DEMO_HOST_ID,
      vehicleId: DEMO_VEHICLES[0].id,
      spaceName: DEMO_SPACES[0].name,
      spaceAddress: DEMO_SPACES[0].address,
      vehiclePlate: 'TN01AB1234',
      vehicleType: 'sedan',
      status: 'confirmed',
      startTime: new Date(now).toISOString(),
      endTime: new Date(now + 2 * 3600000).toISOString(),
      durationMinutes: 120,
      totalAmount: 84,
      hourlyRate: 40,
      type: 'instant',
      slotNumber: 'Bay A-04',
    },
    {
      id: '11111111-1111-4111-8111-000000000002',
      spaceId: DEMO_SPACES[1].id,
      hostId: DEMO_HOST_ID,
      vehicleId: DEMO_VEHICLES[0].id,
      spaceName: DEMO_SPACES[1].name,
      spaceAddress: DEMO_SPACES[1].address,
      vehiclePlate: 'TN01AB1234',
      vehicleType: 'sedan',
      status: 'completed',
      startTime: new Date(now - 86400000).toISOString(),
      endTime: new Date(now - 86400000 + 3600000).toISOString(),
      durationMinutes: 60,
      totalAmount: 37,
      hourlyRate: 35,
      type: 'instant',
      slotNumber: 'Bay B-12',
    },
  ];
}

export interface DemoNotificationItem {
  id: string;
  type: 'booking' | 'payment' | 'gate' | 'reminder';
  title: string;
  body: string;
  read: boolean;
  createdAt: string;
  data?: Record<string, string>;
}

export function createDemoNotifications(): DemoNotificationItem[] {
  const now = Date.now();
  return [
    {
      id: 'notif-demo-001',
      type: 'gate',
      title: 'Gate Pass Ready · T Nagar Complex',
      body: 'Present QR pass #00000001 for TN01AB1234 at Panagal Park Road entry barrier.',
      read: false,
      createdAt: new Date(now - 8 * 60_000).toISOString(),
      data: { bookingId: '11111111-1111-4111-8111-000000000001' },
    },
    {
      id: 'notif-demo-002',
      type: 'payment',
      title: 'UPI Capture Confirmed · ₹84',
      body: 'Razorpay UPI receipt settled for Bay A-04 (2 hours).',
      read: false,
      createdAt: new Date(now - 25 * 60_000).toISOString(),
      data: { bookingId: '11111111-1111-4111-8111-000000000001' },
    },
    {
      id: 'notif-demo-003',
      type: 'reminder',
      title: 'Pondy Bazaar Session Completed',
      body: 'Exited Bay B-12 smoothly. Tax receipt ₹37 saved to Past Bookings.',
      read: true,
      createdAt: new Date(now - 82_800_000).toISOString(),
      data: { bookingId: '11111111-1111-4111-8111-000000000002' },
    },
  ];
}

export const DEMO_NOTIFICATIONS: DemoNotificationItem[] = createDemoNotifications();
