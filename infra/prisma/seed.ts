// ============================================================
// Parkly — Database Seed Script (Development Fixtures Only)
// Seeds: Chennai region, deterministic UUID test users/host/
// vehicle, sample parking spaces, availability slots, rules,
// and operational console defaults (alerts, audit, settings).
//
// Safety:
//   - Refuses to run when NODE_ENV === 'production' unless
//     ALLOW_UNSAFE_DEV_SEED=true is explicitly set.
//   - Idempotent & repeatable (upserts by canonical keys/UUIDs).
//   - Never auto-rewrites or duplicates legacy string fixtures
//     (sp-tng-001, etc.); logs explicit conversion instructions.
// ============================================================

import { PrismaClient } from '@prisma/client';
import { encodeGeohash } from '@parkly/shared';
import { seedRegions } from './seed-regions';
import {
  LEGACY_DEV_SPACE_ID_MAP,
  SEED_HOST_IDS,
  SEED_PRICING_RULE_IDS,
  SEED_SPACE_IDS,
  SEED_USER_IDS,
  SEED_VEHICLE_IDS,
  getSeedSlotId,
} from './seed-fixtures';

const LEGACY_PRICING_RULE_MAP: Record<string, string> = {
  'rule-peak-hours': SEED_PRICING_RULE_IDS.PEAK_HOURS,
  'rule-weekend': SEED_PRICING_RULE_IDS.WEEKEND_PREMIUM,
};

interface SeedSpaceSpec {
  ordinal: 1 | 2 | 3 | 4;
  id: string;
  legacyId: string;
  name: string;
  description: string;
  latitude: number;
  longitude: number;
  address: string;
  city: string;
  state: string;
  pincode: string;
  totalCapacity: number;
  evCharging: boolean;
  covered: boolean;
  securityLevel: 'none' | 'basic' | 'monitored' | 'staffed' | 'gated';
  hourlyRate: number;
  status: 'active';
}

const DEV_SPACES: SeedSpaceSpec[] = [
  {
    ordinal: 1,
    id: SEED_SPACE_IDS.TNAGAR_SPOT_A,
    legacyId: 'sp-tng-001',
    name: 'T Nagar Parking Complex - Spot A',
    description: '[DEV FIXTURE] Secure covered parking with EV charging in T Nagar.',
    latitude: 13.0418,
    longitude: 80.2341,
    address: '23, Panagal Park Road, T Nagar',
    city: 'Chennai',
    state: 'Tamil Nadu',
    pincode: '600017',
    totalCapacity: 10,
    evCharging: true,
    covered: true,
    securityLevel: 'gated',
    hourlyRate: 40,
    status: 'active',
  },
  {
    ordinal: 2,
    id: SEED_SPACE_IDS.TNAGAR_SPOT_B,
    legacyId: 'sp-tng-002',
    name: 'T Nagar Parking Complex - Spot B',
    description: '[DEV FIXTURE] Open-air parking near T Nagar Bus Stand.',
    latitude: 13.0420,
    longitude: 80.2345,
    address: '25, Panagal Park Road, T Nagar',
    city: 'Chennai',
    state: 'Tamil Nadu',
    pincode: '600017',
    totalCapacity: 5,
    evCharging: false,
    covered: false,
    securityLevel: 'basic',
    hourlyRate: 25,
    status: 'active',
  },
  {
    ordinal: 3,
    id: SEED_SPACE_IDS.ADYAR_SMART_PARK,
    legacyId: 'sp-adyar-001',
    name: 'Adyar Smart Park',
    description: '[DEV FIXTURE] Smart parking with real-time availability in Adyar.',
    latitude: 13.0067,
    longitude: 80.2566,
    address: '12, Gandhi Nagar, Adyar',
    city: 'Chennai',
    state: 'Tamil Nadu',
    pincode: '600020',
    totalCapacity: 15,
    evCharging: true,
    covered: false,
    securityLevel: 'monitored',
    hourlyRate: 35,
    status: 'active',
  },
  {
    ordinal: 4,
    id: SEED_SPACE_IDS.VELACHERY_EV_HUB,
    legacyId: 'sp-vel-001',
    name: 'Velachery EV Parking Hub',
    description: '[DEV FIXTURE] Dedicated EV parking hub near Velachery Metro.',
    latitude: 12.9791,
    longitude: 80.2204,
    address: '89, 100 Feet Road, Velachery',
    city: 'Chennai',
    state: 'Tamil Nadu',
    pincode: '600042',
    totalCapacity: 20,
    evCharging: true,
    covered: true,
    securityLevel: 'staffed',
    hourlyRate: 50,
    status: 'active',
  },
];

const LOCAL_DB_HOSTS = new Set(['localhost', '127.0.0.1', '::1', 'postgres']);

export function assertDevSeedSafe(): void {
  const nodeEnv = process.env['NODE_ENV'];
  const allowedEnv = nodeEnv === 'development' || nodeEnv === 'test';
  if (!allowedEnv && process.env['ALLOW_UNSAFE_DEV_SEED'] !== 'true') {
    throw new Error(
      `Refusing to run development seed fixtures outside NODE_ENV=development|test (current: "${nodeEnv ?? 'unset'}"). Use infra/prisma/seed-regions.ts for reference regions.`,
    );
  }

  const dbUrl = process.env['DATABASE_URL'];
  if (dbUrl && process.env['ALLOW_REMOTE_DEV_SEED'] !== 'true') {
    let parsedHost = '';
    try {
      parsedHost = new URL(dbUrl).hostname.toLowerCase();
    } catch {
      parsedHost = '';
    }
    if (parsedHost && !LOCAL_DB_HOSTS.has(parsedHost)) {
      throw new Error(
        `Refusing to run development seed fixtures against non-local database host "${parsedHost}".`,
      );
    }
  }
}

export async function seedDatabase(client?: PrismaClient): Promise<void> {
  assertDevSeedSafe();

  const prisma = client ?? new PrismaClient();
  const shouldDisconnect = !client;

  try {
    console.log('🌱 Seeding Parkly development fixtures...');

    // ── Reference Regions (shared with production seed-regions.ts) ────
    const chennaiRegion = await seedRegions(prisma);
    console.log('✅ Region ready:', chennaiRegion.id);

    // ── Admin User ────────────────────────────────────────────
    const adminUser = await prisma.user.upsert({
      where: { phone: '+919840000001' },
      update: {},
      create: {
        id: SEED_USER_IDS.ADMIN,
        phone: '+919840000001',
        name: 'Parkly Admin',
        email: 'admin@parkly.in',
        role: 'admin',
        isActive: true,
      },
    });
    console.log('✅ Admin user ready:', adminUser.id);

    // ── Host User & Host Profile ──────────────────────────────
    const hostUser = await prisma.user.upsert({
      where: { phone: '+919876543210' },
      update: {},
      create: {
        id: SEED_USER_IDS.HOST,
        phone: '+919876543210',
        name: 'Ravi Kumar (Host)',
        email: 'ravi.host@parkly.in',
        role: 'host',
        isActive: true,
      },
    });

    const host = await prisma.host.upsert({
      where: { userId: hostUser.id },
      update: {},
      create: {
        id: SEED_HOST_IDS.KUMAR_PARKING,
        userId: hostUser.id,
        businessName: 'Kumar Smart Parking',
        panNumber: 'ABCDE1234F',
        verificationStatus: 'approved',
        verifiedAt: new Date('2026-11-01T00:00:00.000Z'),
        totalEarnings: 0,
        totalPayouts: 0,
      },
    });
    console.log('✅ Host ready:', host.id);

    // ── Driver User & Vehicle ─────────────────────────────────
    const driverUser = await prisma.user.upsert({
      where: { phone: '+919876543211' },
      update: {},
      create: {
        id: SEED_USER_IDS.DRIVER,
        phone: '+919876543211',
        name: 'Arjun Nair (Driver)',
        email: 'arjun.driver@parkly.in',
        role: 'driver',
        isActive: true,
      },
    });

    const vehicle = await prisma.vehicle.upsert({
      where: { licensePlate: 'TN01AB1234' },
      update: {},
      create: {
        id: SEED_VEHICLE_IDS.TN01AB1234,
        userId: driverUser.id,
        licensePlate: 'TN01AB1234',
        vehicleType: 'sedan',
        make: 'Honda',
        model: 'City',
        color: 'White',
        isDefault: true,
      },
    });
    console.log('✅ Driver + vehicle ready:', driverUser.id, vehicle.id);

    // ── Check Existing Legacy Dev Fixtures (Condition #5) ─────
    const legacySpaceRows = await prisma.parkingSpace.findMany({
      where: { id: { in: Object.keys(LEGACY_DEV_SPACE_ID_MAP) } },
      select: { id: true },
    });
    const existingLegacySpaceIds = new Set(legacySpaceRows.map((row) => row.id));

    // ── Parking Spaces & Availability Slots ───────────────────
    for (const spaceData of DEV_SPACES) {
      if (existingLegacySpaceIds.has(spaceData.legacyId)) {
        console.warn(
          `⚠️ Legacy dev space "${spaceData.legacyId}" already exists; skipping auto-creation of "${spaceData.id}" to avoid duplicating fixtures. Use infra/prisma/scripts/reconcile_legacy_dev_data.sql after backup if converting legacy IDs.`,
        );
        continue;
      }

      const geohash = encodeGeohash(spaceData.latitude, spaceData.longitude, 6);
      const space = await prisma.parkingSpace.upsert({
        where: { id: spaceData.id },
        update: {
          geohash,
          latitude: spaceData.latitude,
          longitude: spaceData.longitude,
          regionId: chennaiRegion.id,
          status: spaceData.status,
        },
        create: {
          id: spaceData.id,
          hostId: host.id,
          name: spaceData.name,
          description: spaceData.description,
          latitude: spaceData.latitude,
          longitude: spaceData.longitude,
          geohash,
          address: spaceData.address,
          city: spaceData.city,
          state: spaceData.state,
          pincode: spaceData.pincode,
          regionId: chennaiRegion.id,
          totalCapacity: spaceData.totalCapacity,
          vehicleTypes: ['motorcycle', 'compact', 'sedan', 'suv'],
          evCharging: spaceData.evCharging,
          covered: spaceData.covered,
          securityLevel: spaceData.securityLevel,
          accessibility: [],
          cctv: true,
          lighting: true,
          attendant: false,
          hourlyRate: spaceData.hourlyRate,
          currency: 'INR',
          dynamicPricing: true,
          minBookingHours: 1,
          maxBookingHours: 12,
          photoUrls: [],
          status: spaceData.status,
        },
      });

      for (let day = 0; day < 7; day++) {
        const slotId = getSeedSlotId(spaceData.ordinal, day);
        await prisma.availabilitySlot.upsert({
          where: { id: slotId },
          update: {
            spaceId: space.id,
            dayOfWeek: day,
            startTime: '00:00',
            endTime: '23:59',
          },
          create: {
            id: slotId,
            spaceId: space.id,
            dayOfWeek: day,
            startTime: '00:00',
            endTime: '23:59',
          },
        });
      }
      console.log(`✅ Space ready (${space.id}): ${space.name}`);
    }

    // ── Global Pricing Rules ──────────────────────────────────
    const legacyRuleRows = await prisma.pricingRule.findMany({
      where: { id: { in: Object.keys(LEGACY_PRICING_RULE_MAP) } },
      select: { id: true },
    });
    const existingLegacyRuleIds = new Set(legacyRuleRows.map((row) => row.id));

    const globalRules = [
      {
        id: SEED_PRICING_RULE_IDS.PEAK_HOURS,
        legacyId: 'rule-peak-hours',
        name: 'Peak Hours (Morning + Evening)',
        multiplier: 1.5,
      },
      {
        id: SEED_PRICING_RULE_IDS.WEEKEND_PREMIUM,
        legacyId: 'rule-weekend',
        name: 'Weekend Premium',
        multiplier: 1.25,
      },
    ];

    for (const rule of globalRules) {
      if (existingLegacyRuleIds.has(rule.legacyId)) {
        console.warn(
          `⚠️ Legacy pricing rule "${rule.legacyId}" already exists; skipping creation of "${rule.id}".`,
        );
        continue;
      }

      await prisma.pricingRule.upsert({
        where: { id: rule.id },
        update: {
          name: rule.name,
          multiplier: rule.multiplier,
          isActive: true,
        },
        create: {
          id: rule.id,
          name: rule.name,
          multiplier: rule.multiplier,
          isActive: true,
        },
      });
    }

    console.log('✅ Pricing rules ready');

    // ── Operational Alerts, Audit Logs & Default Settings ────
    if (
      typeof (prisma as any).systemAlert?.upsert === 'function' &&
      typeof (prisma as any).auditLog?.upsert === 'function' &&
      typeof (prisma as any).platformSetting?.upsert === 'function'
    ) {
      await prisma.systemAlert.upsert({
        where: { id: '00000000-0000-4000-8000-000000004001' },
        update: {},
        create: {
          id: '00000000-0000-4000-8000-000000004001',
          severity: 'info',
          title: 'Chennai Grid Synchronized',
          detail: 'Development parking fixtures initialized for Chennai metro corridor.',
          source: 'seed-script',
          resolved: false,
        },
      });

      await prisma.auditLog.upsert({
        where: { id: '00000000-0000-4000-8000-000000004002' },
        update: {},
        create: {
          id: '00000000-0000-4000-8000-000000004002',
          actorId: adminUser.id,
          actorName: adminUser.email || adminUser.phone,
          action: 'SYSTEM_SEED_INITIALIZED',
          target: 'chennai-tn-in',
          ipAddress: '127.0.0.1',
        },
      });

      const defaultSettings: Array<[string, string]> = [
        ['platformName', 'Parkly'],
        ['supportEmail', 'support@parkly.in'],
        ['defaultCity', 'Chennai'],
        ['platformFeePercent', '5'],
        ['autoApproveVerifiedHosts', 'false'],
        ['maintenanceMode', 'false'],
      ];
      for (const [key, value] of defaultSettings) {
        await prisma.platformSetting.upsert({
          where: { key },
          update: {},
          create: { key, value, updatedBy: adminUser.id },
        });
      }
      console.log('✅ Operational settings & audit defaults ready');
    }

    console.log('\n🎉 Seeding complete! Development database fixtures are ready.');
  } finally {
    if (shouldDisconnect) {
      await prisma.$disconnect();
    }
  }
}

if (require.main === module) {
  seedDatabase().catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  });
}
