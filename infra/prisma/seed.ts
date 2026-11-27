// ============================================================
// Parkly — Database Seed Script
// Seeds: Chennai region, test users, sample parking spaces
// ============================================================

import { PrismaClient } from '@prisma/client';
import { encodeGeohash } from '@parkly/shared';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding Parkly database...');

  // ── Regions ───────────────────────────────────────────────
  const chennaiRegion = await prisma.region.upsert({
    where: { id: 'chennai-tn-in' },
    update: {},
    create: {
      id: 'chennai-tn-in',
      name: 'Chennai',
      country: 'IN',
      state: 'Tamil Nadu',
      city: 'Chennai',
      boundsNorth: 13.2000,
      boundsSouth: 12.8000,
      boundsEast: 80.4000,
      boundsWest: 80.0000,
      geohashPrefixes: ['tf', 'tg'],
      adjacentRegions: [],
      isActive: true,
    },
  });
  console.log('✅ Region created:', chennaiRegion.name);

  // ── Admin User ────────────────────────────────────────────
  const adminUser = await prisma.user.upsert({
    where: { phone: '+919999999999' },
    update: {},
    create: {
      phone: '+919999999999',
      name: 'Parkly Admin',
      email: 'admin@parkly.in',
      role: 'admin',
      isActive: true,
    },
  });
  console.log('✅ Admin user created:', adminUser.name);

  // ── Host User ─────────────────────────────────────────────
  const hostUser = await prisma.user.upsert({
    where: { phone: '+919876543210' },
    update: {},
    create: {
      phone: '+919876543210',
      name: 'Ravi Kumar',
      email: 'ravi@example.com',
      role: 'host',
      isActive: true,
    },
  });

  const host = await prisma.host.upsert({
    where: { userId: hostUser.id },
    update: {},
    create: {
      userId: hostUser.id,
      businessName: 'Kumar Parking Solutions',
      verificationStatus: 'approved',
      verifiedAt: new Date(),
    },
  });
  console.log('✅ Host created:', hostUser.name);

  // ── Driver User ───────────────────────────────────────────
  const driverUser = await prisma.user.upsert({
    where: { phone: '+919876543211' },
    update: {},
    create: {
      phone: '+919876543211',
      name: 'Arjun Kumar',
      role: 'driver',
      isActive: true,
    },
  });

  await prisma.vehicle.upsert({
    where: { licensePlate: 'TN01AB1234' },
    update: {},
    create: {
      userId: driverUser.id,
      licensePlate: 'TN01AB1234',
      vehicleType: 'sedan',
      make: 'Honda',
      model: 'City',
      color: 'White',
      isDefault: true,
    },
  });
  console.log('✅ Driver + vehicle created:', driverUser.name);

  // ── Parking Spaces ────────────────────────────────────────
  const spaces = [
    {
      id: 'sp-tng-001',
      name: 'T Nagar Parking Complex - Spot A',
      description: 'Secure covered parking with EV charging in the heart of T Nagar.',
      latitude: 13.0418,
      longitude: 80.2341,
      geohash: 'tge27',
      address: '23, Panagal Park Road, T Nagar',
      city: 'Chennai',
      state: 'Tamil Nadu',
      pincode: '600017',
      totalCapacity: 10,
      evCharging: true,
      covered: true,
      securityLevel: 'gated' as const,
      hourlyRate: 40,
      status: 'active' as const,
    },
    {
      id: 'sp-tng-002',
      name: 'T Nagar Parking Complex - Spot B',
      description: 'Open-air parking near T Nagar Bus Stand.',
      latitude: 13.0420,
      longitude: 80.2345,
      geohash: 'tge27',
      address: '25, Panagal Park Road, T Nagar',
      city: 'Chennai',
      state: 'Tamil Nadu',
      pincode: '600017',
      totalCapacity: 5,
      evCharging: false,
      covered: false,
      securityLevel: 'basic' as const,
      hourlyRate: 25,
      status: 'active' as const,
    },
    {
      id: 'sp-adyar-001',
      name: 'Adyar Smart Park',
      description: 'Smart parking with real-time availability in Adyar.',
      latitude: 13.0067,
      longitude: 80.2566,
      geohash: 'tge0e',
      address: '12, Gandhi Nagar, Adyar',
      city: 'Chennai',
      state: 'Tamil Nadu',
      pincode: '600020',
      totalCapacity: 15,
      evCharging: true,
      covered: false,
      securityLevel: 'monitored' as const,
      hourlyRate: 35,
      status: 'active' as const,
    },
    {
      id: 'sp-vel-001',
      name: 'Velachery EV Parking Hub',
      description: 'Dedicated EV-only parking hub near Velachery Metro.',
      latitude: 12.9791,
      longitude: 80.2204,
      geohash: 'tge08',
      address: '89, 100 Feet Road, Velachery',
      city: 'Chennai',
      state: 'Tamil Nadu',
      pincode: '600042',
      totalCapacity: 20,
      evCharging: true,
      covered: true,
      securityLevel: 'staffed' as const,
      hourlyRate: 50,
      status: 'active' as const,
    },
  ];

  for (const spaceData of spaces) {
    const space = await prisma.parkingSpace.upsert({
      where: { id: spaceData.id },
      update: {
        // Keep the spatial index consistent with encodeGeohash on re-seed.
        geohash: encodeGeohash(spaceData.latitude, spaceData.longitude, 6),
        latitude: spaceData.latitude,
        longitude: spaceData.longitude,
        status: spaceData.status,
      },
      create: {
        id: spaceData.id,
        hostId: host.id,
        name: spaceData.name,
        description: spaceData.description,
        latitude: spaceData.latitude,
        longitude: spaceData.longitude,
        geohash: encodeGeohash(spaceData.latitude, spaceData.longitude, 6),
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

    // Create default availability (24/7)
    for (let day = 0; day < 7; day++) {
      await prisma.availabilitySlot.upsert({
        where: {
          id: `${space.id}-day-${day}`,
        },
        update: {},
        create: {
          id: `${space.id}-day-${day}`,
          spaceId: space.id,
          dayOfWeek: day,
          startTime: '00:00',
          endTime: '23:59',
        },
      });
    }
    console.log(`✅ Space created: ${space.name}`);
  }

  // ── Global Pricing Rules ──────────────────────────────────
  await prisma.pricingRule.upsert({
    where: { id: 'rule-peak-hours' },
    update: {},
    create: {
      id: 'rule-peak-hours',
      name: 'Peak Hours (Morning + Evening)',
      multiplier: 1.5,
      isActive: true,
    },
  });

  await prisma.pricingRule.upsert({
    where: { id: 'rule-weekend' },
    update: {},
    create: {
      id: 'rule-weekend',
      name: 'Weekend Premium',
      multiplier: 1.25,
      isActive: true,
    },
  });

  console.log('✅ Pricing rules created');

  // ── Sample Pending Space for Admin Verification Queue ──────
  await prisma.parkingSpace.upsert({
    where: { id: 'sp-ann-pending-01' },
    update: {},
    create: {
      id: 'sp-ann-pending-01',
      hostId: host.id,
      name: 'Anna Nagar West Commercial Bay',
      description: 'Covered multi-bay parking near 2nd Avenue.',
      latitude: 13.0849,
      longitude: 80.2101,
      geohash: encodeGeohash(13.0849, 80.2101, 6),
      address: '42, 2nd Avenue, Anna Nagar',
      city: 'Chennai',
      state: 'Tamil Nadu',
      pincode: '600040',
      regionId: chennaiRegion.id,
      totalCapacity: 14,
      vehicleTypes: ['motorcycle', 'compact', 'sedan', 'suv'],
      evCharging: true,
      covered: true,
      securityLevel: 'monitored',
      accessibility: [],
      cctv: true,
      lighting: true,
      attendant: false,
      hourlyRate: 50,
      currency: 'INR',
      dynamicPricing: true,
      minBookingHours: 1,
      maxBookingHours: 24,
      photoUrls: [],
      status: 'pending_verification',
    },
  });

  // ── Sample Booking + Payment + Dispute ───────────────────
  const sampleStart = new Date(Date.now() - 2 * 3600 * 1000);
  const sampleEnd = new Date(Date.now() + 1 * 3600 * 1000);
  const driverVehicle = await prisma.vehicle.findUnique({ where: { licensePlate: 'TN01AB1234' } });

  if (driverVehicle) {
    const sampleBooking = await prisma.booking.upsert({
      where: { id: 'bk-seed-001' },
      update: {},
      create: {
        id: 'bk-seed-001',
        userId: driverUser.id,
        spaceId: 'sp-tng-001',
        vehicleId: driverVehicle.id,
        hostId: host.id,
        type: 'instant',
        status: 'confirmed',
        startTime: sampleStart,
        endTime: sampleEnd,
        durationMinutes: 180,
        totalAmount: 126,
        currency: 'INR',
      },
    });

    await prisma.payment.upsert({
      where: { bookingId: sampleBooking.id },
      update: {},
      create: {
        id: 'pay-seed-001',
        bookingId: sampleBooking.id,
        userId: driverUser.id,
        amount: 126,
        currency: 'INR',
        provider: 'mock',
        providerOrderId: 'MOCK_ORDER_SEED_001',
        providerPaymentId: 'MOCK_PAY_SEED_001',
        tokenRef: 'TOKEN_SEED_001',
        status: 'completed',
      },
    });

    await prisma.dispute.upsert({
      where: { bookingId: sampleBooking.id },
      update: {},
      create: {
        id: 'disp-seed-001',
        bookingId: sampleBooking.id,
        raisedBy: driverUser.id,
        disputeType: 'other',
        description: 'Overstay sensor check around Panagal Park exit lane (45m claimed).',
        status: 'open',
      },
    });
  }

  // ── Operational Alerts, Audit Logs & Default Settings ────
  await prisma.systemAlert.upsert({
    where: { id: 'alert-seed-001' },
    update: {},
    create: {
      id: 'alert-seed-001',
      severity: 'warning',
      title: 'Pending Host Verification Queue',
      detail: 'Anna Nagar West Commercial Bay is awaiting operator verification.',
      source: 'host-service',
      resolved: false,
    },
  });

  await prisma.auditLog.upsert({
    where: { id: 'audit-seed-001' },
    update: {},
    create: {
      id: 'audit-seed-001',
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
    ['city', 'Chennai'],
    ['platformFee', '15'],
    ['autoApprove', 'false'],
    ['maintenanceMode', 'false'],
  ];
  for (const [key, value] of defaultSettings) {
    await prisma.platformSetting.upsert({
      where: { key },
      update: {},
      create: { key, value, updatedBy: adminUser.id },
    });
  }

  console.log('\n🎉 Seeding complete! Database is ready for development.');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
