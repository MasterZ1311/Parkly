// ============================================================
// Parkly — Deterministic RFC4122 Development Seed Fixtures
// Clearly namespaced dev-only identifiers so repeatable seeds,
// API Zod UUID checks, and integration fixtures stay consistent.
// ============================================================

export const DEV_FIXTURE_PREFIX = '00000000-0000-4000-8000-';

export const SEED_REGIONS = {
  CHENNAI: 'chennai-tn-in',
} as const;

export const SEED_USER_IDS = {
  ADMIN: `${DEV_FIXTURE_PREFIX}000000000001`,
  HOST: `${DEV_FIXTURE_PREFIX}000000000002`,
  DRIVER: `${DEV_FIXTURE_PREFIX}000000000003`,
} as const;

export const SEED_HOST_IDS = {
  KUMAR_PARKING: `${DEV_FIXTURE_PREFIX}000000000101`,
} as const;

export const SEED_VEHICLE_IDS = {
  TN01AB1234: `${DEV_FIXTURE_PREFIX}000000000201`,
} as const;

export const SEED_SPACE_IDS = {
  TNAGAR_SPOT_A: `${DEV_FIXTURE_PREFIX}000000001001`,
  TNAGAR_SPOT_B: `${DEV_FIXTURE_PREFIX}000000001002`,
  ADYAR_SMART_PARK: `${DEV_FIXTURE_PREFIX}000000001003`,
  VELACHERY_EV_HUB: `${DEV_FIXTURE_PREFIX}000000001004`,
} as const;

export const LEGACY_DEV_SPACE_ID_MAP: Record<string, string> = {
  'sp-tng-001': SEED_SPACE_IDS.TNAGAR_SPOT_A,
  'sp-tng-002': SEED_SPACE_IDS.TNAGAR_SPOT_B,
  'sp-adyar-001': SEED_SPACE_IDS.ADYAR_SMART_PARK,
  'sp-vel-001': SEED_SPACE_IDS.VELACHERY_EV_HUB,
};

export const SEED_PRICING_RULE_IDS = {
  PEAK_HOURS: `${DEV_FIXTURE_PREFIX}000000003001`,
  WEEKEND_PREMIUM: `${DEV_FIXTURE_PREFIX}000000003002`,
} as const;

export function getSeedSlotId(spaceOrdinal: 1 | 2 | 3 | 4, dayOfWeek: number): string {
  if (!Number.isInteger(dayOfWeek) || dayOfWeek < 0 || dayOfWeek > 6) {
    throw new RangeError(`dayOfWeek must be an integer 0..6, received ${dayOfWeek}`);
  }
  return `${DEV_FIXTURE_PREFIX}000000002${spaceOrdinal}0${dayOfWeek}`;
}

export const RFC4122_UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
