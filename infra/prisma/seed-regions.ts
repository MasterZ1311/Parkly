// ============================================================
// Parkly — Reference Region Bootstrap (Production-Safe)
// Idempotently ensures active canonical geographic regions
// exist before host listings reference ParkingSpace.regionId.
// ============================================================

import { PrismaClient } from '@prisma/client';
import { SEED_REGIONS } from './seed-fixtures';

export async function seedRegions(client?: PrismaClient): Promise<{ id: string }> {
  const prisma = client ?? new PrismaClient();
  const shouldDisconnect = !client;

  try {
    const chennaiRegion = await prisma.region.upsert({
      where: { id: SEED_REGIONS.CHENNAI },
      update: {
        name: 'Chennai',
        country: 'IN',
        state: 'Tamil Nadu',
        city: 'Chennai',
        isActive: true,
      },
      create: {
        id: SEED_REGIONS.CHENNAI,
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
      select: { id: true },
    });
    return chennaiRegion;
  } finally {
    if (shouldDisconnect) {
      await prisma.$disconnect();
    }
  }
}

if (require.main === module) {
  seedRegions()
    .then((region) => {
      console.log(`✅ Reference region ready: ${region.id}`);
    })
    .catch((err) => {
      console.error('❌ Region bootstrap failed:', err);
      process.exit(1);
    });
}
