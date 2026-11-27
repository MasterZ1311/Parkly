process.env['NODE_ENV'] = 'test';
process.env['JWT_ACCESS_SECRET'] = 'test-jwt-access-secret-for-host-service-at-least-32-chars';
process.env['JWT_REFRESH_SECRET'] = 'test-jwt-refresh-secret-for-host-service-at-least-32-chars';

import { resolveRegionForListing } from '../index';
import { ValidationError } from '@parkly/shared';
import {
  RFC4122_UUID_REGEX,
  SEED_HOST_IDS,
  SEED_PRICING_RULE_IDS,
  SEED_REGIONS,
  SEED_SPACE_IDS,
  SEED_USER_IDS,
  SEED_VEHICLE_IDS,
  getSeedSlotId,
} from '../../../../infra/prisma/seed-fixtures';
import { assertDevSeedSafe, seedDatabase } from '../../../../infra/prisma/seed';

describe('ENG-D02 host-service Region resolution & seed integrity', () => {
  const origEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...origEnv };
    jest.restoreAllMocks();
  });

  describe('resolveRegionForListing', () => {
    it('prioritizes exact city/id match before prefix fallback', async () => {
      const findFirst = jest
        .fn()
        .mockResolvedValueOnce({ id: 'chennai-tn-in' });

      const regionId = await resolveRegionForListing({ region: { findFirst } as any }, '  Chennai  ');

      expect(regionId).toBe('chennai-tn-in');
      expect(findFirst).toHaveBeenCalledTimes(1);
      expect(findFirst).toHaveBeenCalledWith({
        where: {
          isActive: true,
          OR: [
            { city: { equals: 'Chennai', mode: 'insensitive' } },
            { id: 'chennai' },
          ],
        },
        orderBy: { id: 'asc' },
        select: { id: true },
      });
    });

    it('falls back to regional slug prefix only when exact city/id match returns null', async () => {
      const findFirst = jest
        .fn()
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ id: 'chennai-tn-in' });

      const regionId = await resolveRegionForListing({ region: { findFirst } as any }, 'Chennai');

      expect(regionId).toBe('chennai-tn-in');
      expect(findFirst).toHaveBeenCalledTimes(2);
      expect(findFirst).toHaveBeenNthCalledWith(2, {
        where: {
          isActive: true,
          id: { startsWith: 'chennai-', mode: 'insensitive' },
        },
        orderBy: { id: 'asc' },
        select: { id: true },
      });
    });

    it('accepts an explicit active regionId when provided', async () => {
      const findFirst = jest.fn().mockResolvedValue({ id: 'chennai-tn-in' });

      const regionId = await resolveRegionForListing(
        { region: { findFirst } as any },
        'Chennai',
        '  chennai-tn-in  ',
      );

      expect(regionId).toBe('chennai-tn-in');
      expect(findFirst).toHaveBeenCalledWith({
        where: { id: 'chennai-tn-in', isActive: true },
        select: { id: true },
      });
    });

    it('rejects unsupported or inactive regionId cleanly with ValidationError', async () => {
      const findFirst = jest.fn().mockResolvedValue(null);

      await expect(
        resolveRegionForListing({ region: { findFirst } as any }, 'Chennai', 'nonexistent-region'),
      ).rejects.toThrow(ValidationError);
    });

    it('rejects unknown city cleanly with ValidationError instead of inserting an orphaned slug', async () => {
      const findFirst = jest.fn().mockResolvedValue(null);

      await expect(
        resolveRegionForListing({ region: { findFirst } as any }, 'UnknownCity'),
      ).rejects.toThrow(ValidationError);
    });
  });

  describe('Deterministic RFC4122 Seed Fixtures & Safeguards', () => {
    it('uses valid RFC4122 UUIDs for all UUID entities and keeps canonical region ID', () => {
      expect(SEED_REGIONS.CHENNAI).toBe('chennai-tn-in');

      const uuidValues = [
        ...Object.values(SEED_USER_IDS),
        ...Object.values(SEED_HOST_IDS),
        ...Object.values(SEED_VEHICLE_IDS),
        ...Object.values(SEED_SPACE_IDS),
        ...Object.values(SEED_PRICING_RULE_IDS),
        ...[1, 2, 3, 4].flatMap((ord) =>
          [0, 1, 2, 3, 4, 5, 6].map((day) => getSeedSlotId(ord as 1 | 2 | 3 | 4, day)),
        ),
      ];

      expect(new Set(uuidValues).size).toBe(uuidValues.length);
      for (const id of uuidValues) {
        expect(id).toMatch(RFC4122_UUID_REGEX);
      }
    });

    it('executes repeatably twice on a clean DB with deterministic IDs and zero duplicate creation', async () => {
      const spaceStore = new Map<string, any>();
      const slotStore = new Map<string, any>();
      const ruleStore = new Map<string, any>();

      const makeMockDb = () => ({
        region: { upsert: jest.fn().mockResolvedValue({ id: SEED_REGIONS.CHENNAI }) },
        user: {
          upsert: jest.fn().mockImplementation(async ({ create }) => ({ id: create.id })),
        },
        host: { upsert: jest.fn().mockResolvedValue({ id: SEED_HOST_IDS.KUMAR_PARKING }) },
        vehicle: { upsert: jest.fn().mockResolvedValue({ id: SEED_VEHICLE_IDS.TN01AB1234 }) },
        parkingSpace: {
          findMany: jest.fn().mockResolvedValue([]),
          upsert: jest.fn().mockImplementation(async ({ where, create }) => {
            if (!spaceStore.has(where.id)) spaceStore.set(where.id, create);
            return spaceStore.get(where.id);
          }),
        },
        availabilitySlot: {
          upsert: jest.fn().mockImplementation(async ({ where, create }) => {
            if (!slotStore.has(where.id)) slotStore.set(where.id, create);
            return slotStore.get(where.id);
          }),
        },
        pricingRule: {
          findMany: jest.fn().mockResolvedValue([]),
          upsert: jest.fn().mockImplementation(async ({ where, create }) => {
            if (!ruleStore.has(where.id)) ruleStore.set(where.id, create);
            return ruleStore.get(where.id);
          }),
        },
      });

      const dbRun1 = makeMockDb();
      const dbRun2 = makeMockDb();

      await seedDatabase(dbRun1 as any);
      await seedDatabase(dbRun2 as any);

      expect(spaceStore.size).toBe(4);
      expect(slotStore.size).toBe(28);
      expect(ruleStore.size).toBe(2);
      expect(dbRun1.parkingSpace.upsert).toHaveBeenCalledTimes(4);
      expect(dbRun2.parkingSpace.upsert).toHaveBeenCalledTimes(4);
      expect(dbRun1.availabilitySlot.upsert).toHaveBeenCalledTimes(28);
      expect(dbRun2.availabilitySlot.upsert).toHaveBeenCalledTimes(28);
      expect(dbRun1.pricingRule.upsert).toHaveBeenCalledTimes(2);
      expect(dbRun2.pricingRule.upsert).toHaveBeenCalledTimes(2);
    });

    it('preserves existing legacy space and pricing-rule IDs without duplicating or rewriting them', async () => {
      const spaceUpsert = jest.fn().mockImplementation(async ({ create }) => ({ id: create.id, name: create.name }));
      const slotUpsert = jest.fn().mockResolvedValue({});
      const ruleUpsert = jest.fn().mockResolvedValue({});

      const mockPrisma: any = {
        region: { upsert: jest.fn().mockResolvedValue({ id: SEED_REGIONS.CHENNAI }) },
        user: {
          upsert: jest.fn().mockImplementation(async ({ create }) => ({ id: create.id })),
        },
        host: { upsert: jest.fn().mockResolvedValue({ id: SEED_HOST_IDS.KUMAR_PARKING }) },
        vehicle: { upsert: jest.fn().mockResolvedValue({ id: SEED_VEHICLE_IDS.TN01AB1234 }) },
        parkingSpace: {
          findMany: jest.fn().mockResolvedValue([{ id: 'sp-tng-001' }]),
          upsert: spaceUpsert,
        },
        availabilitySlot: { upsert: slotUpsert },
        pricingRule: {
          findMany: jest.fn().mockResolvedValue([{ id: 'rule-peak-hours' }]),
          upsert: ruleUpsert,
        },
      };

      const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
      await seedDatabase(mockPrisma);

      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('sp-tng-001'));
      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('rule-peak-hours'));
      expect(spaceUpsert).toHaveBeenCalledTimes(3);
      expect(slotUpsert).toHaveBeenCalledTimes(21);
      expect(ruleUpsert).toHaveBeenCalledTimes(1);
    });

    it('fails closed when NODE_ENV is production, staging, unset, or targets a remote DB host', () => {
      process.env['NODE_ENV'] = 'production';
      expect(() => assertDevSeedSafe()).toThrow(/Refusing to run development seed fixtures/);

      process.env['NODE_ENV'] = 'staging';
      expect(() => assertDevSeedSafe()).toThrow(/Refusing to run development seed fixtures/);

      delete process.env['NODE_ENV'];
      expect(() => assertDevSeedSafe()).toThrow(/Refusing to run development seed fixtures/);

      process.env['NODE_ENV'] = 'development';
      process.env['DATABASE_URL'] = 'postgresql://user:pass@prod-rds.ap-south-1.rds.amazonaws.com:5432/parkly';
      expect(() => assertDevSeedSafe()).toThrow(/non-local database host/);
    });
  });
});
