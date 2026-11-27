-- =========================================================================
-- Parkly — Explicit Legacy Development Data Inspection & Opt-In Conversion
--
-- IMPORTANT (ENG-D02 Condition #5):
--   This script is NEVER executed automatically by Prisma Migrate or seed.ts.
--   Run Step 1 (read-only audit) FIRST against a backup snapshot before
--   running Step 2 on a legacy local/dev database that contains old string
--   IDs (sp-tng-001, 'chennai' region_id, etc.) or orphaned host_ids.
-- =========================================================================

-- =========================================================================
-- STEP 1: READ-ONLY DEPENDENCY & ORPHAN INSPECTION
-- =========================================================================

-- 1a. Check legacy string ParkingSpace fixtures & downstream child counts
SELECT
  ps."id",
  ps."name",
  ps."region_id",
  ps."host_id",
  (SELECT COUNT(*) FROM "bookings" b WHERE b."space_id" = ps."id") AS booking_count,
  (SELECT COUNT(*) FROM "availability_slots" a WHERE a."space_id" = ps."id") AS slot_count,
  (SELECT COUNT(*) FROM "pricing_rules" pr WHERE pr."space_id" = ps."id") AS rule_count
FROM "parking_spaces" ps
WHERE ps."id" IN ('sp-tng-001', 'sp-tng-002', 'sp-adyar-001', 'sp-vel-001')
   OR ps."id" !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$';

-- 1b. Check spaces whose region_id does not exist in "regions"
SELECT ps."id", ps."name", ps."city", ps."region_id"
FROM "parking_spaces" ps
WHERE NOT EXISTS (SELECT 1 FROM "regions" r WHERE r."id" = ps."region_id");

-- 1c. Check bookings whose host_id does not exist in "hosts", or differs from parking_spaces.host_id
SELECT
  b."id",
  b."space_id",
  b."host_id",
  ps."host_id" AS space_host_id,
  (SELECT COUNT(*) FROM "hosts" h WHERE h."id" = b."host_id") > 0 AS host_exists
FROM "bookings" b
LEFT JOIN "parking_spaces" ps ON ps."id" = b."space_id"
WHERE NOT EXISTS (SELECT 1 FROM "hosts" h WHERE h."id" = b."host_id")
   OR (ps."host_id" IS NOT NULL AND b."host_id" IS DISTINCT FROM ps."host_id");

-- 1d. Check payments whose non-null payout_id does not exist in "payouts"
SELECT p."id", p."booking_id", p."payout_id"
FROM "payments" p
WHERE p."payout_id" IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM "payouts" py WHERE py."id" = p."payout_id");

-- 1e. Check legacy PricingRule IDs
SELECT pr."id", pr."name", pr."space_id"
FROM "pricing_rules" pr
WHERE pr."id" IN ('rule-peak-hours', 'rule-weekend');

-- 1f. Check non-UUID availability_slots or pricing_rules rows
SELECT 'availability_slots' AS table_name, "id", "space_id"
FROM "availability_slots"
WHERE "id" !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
UNION ALL
SELECT 'pricing_rules' AS table_name, "id", "space_id"
FROM "pricing_rules"
WHERE "id" !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$';


-- =========================================================================
-- STEP 2: EXPLICIT TRANSACTIONAL CONVERSION (RUN ONLY AFTER BACKUP & REVIEW)
-- Capture backup first: pg_dump --format=custom --file=pre_legacy_convert.dump "$DATABASE_URL"
-- Uncomment BEGIN .. COMMIT block intentionally when converting a legacy dev DB.
-- =========================================================================
/*
BEGIN;

-- Ensure canonical Chennai region exists before updating region_id references
INSERT INTO "regions" (
  "id", "name", "country", "state", "city",
  "bounds_north", "bounds_south", "bounds_east", "bounds_west",
  "geohash_prefixes", "adjacent_regions", "is_active"
)
VALUES (
  'chennai-tn-in', 'Chennai', 'IN', 'Tamil Nadu', 'Chennai',
  13.2000, 12.8000, 80.4000, 80.0000,
  ARRAY['tf', 'tg'], ARRAY[]::TEXT[], true
)
ON CONFLICT ("id") DO NOTHING;

-- Map old city-slug region_id ('chennai') created by prior host-service behavior
UPDATE "parking_spaces"
SET "region_id" = 'chennai-tn-in'
WHERE "region_id" = 'chennai'
  AND EXISTS (SELECT 1 FROM "regions" r WHERE r."id" = 'chennai-tn-in');

-- Backfill booking.host_id from authoritative parking_spaces.host_id when host_id was legacy/invalid
UPDATE "bookings" b
SET "host_id" = ps."host_id"
FROM "parking_spaces" ps
WHERE b."space_id" = ps."id"
  AND NOT EXISTS (SELECT 1 FROM "hosts" h WHERE h."id" = b."host_id")
  AND EXISTS (SELECT 1 FROM "hosts" h WHERE h."id" = ps."host_id");

-- Convert legacy seeded ParkingSpace IDs cleanly using ON UPDATE CASCADE on FKs
-- (Only runs if legacy ID exists and target deterministic UUID does not already exist)
UPDATE "parking_spaces" SET "id" = '00000000-0000-4000-8000-000000001001'
WHERE "id" = 'sp-tng-001'
  AND NOT EXISTS (SELECT 1 FROM "parking_spaces" WHERE "id" = '00000000-0000-4000-8000-000000001001');

UPDATE "parking_spaces" SET "id" = '00000000-0000-4000-8000-000000001002'
WHERE "id" = 'sp-tng-002'
  AND NOT EXISTS (SELECT 1 FROM "parking_spaces" WHERE "id" = '00000000-0000-4000-8000-000000001002');

UPDATE "parking_spaces" SET "id" = '00000000-0000-4000-8000-000000001003'
WHERE "id" = 'sp-adyar-001'
  AND NOT EXISTS (SELECT 1 FROM "parking_spaces" WHERE "id" = '00000000-0000-4000-8000-000000001003');

UPDATE "parking_spaces" SET "id" = '00000000-0000-4000-8000-000000001004'
WHERE "id" = 'sp-vel-001'
  AND NOT EXISTS (SELECT 1 FROM "parking_spaces" WHERE "id" = '00000000-0000-4000-8000-000000001004');

-- Convert legacy AvailabilitySlot IDs (`*-day-<0..6>`) to deterministic UUIDs
-- Guarded to seeded spaces, valid day_of_week 0..6, and non-colliding primary keys.
WITH candidate_slots AS (
  SELECT
    "id",
    CASE "space_id"
      WHEN '00000000-0000-4000-8000-000000001001' THEN '00000000-0000-4000-8000-00000000210' || "day_of_week"::TEXT
      WHEN '00000000-0000-4000-8000-000000001002' THEN '00000000-0000-4000-8000-00000000220' || "day_of_week"::TEXT
      WHEN '00000000-0000-4000-8000-000000001003' THEN '00000000-0000-4000-8000-00000000230' || "day_of_week"::TEXT
      WHEN '00000000-0000-4000-8000-000000001004' THEN '00000000-0000-4000-8000-00000000240' || "day_of_week"::TEXT
    END AS "target_id"
  FROM "availability_slots"
  WHERE "space_id" IN (
    '00000000-0000-4000-8000-000000001001',
    '00000000-0000-4000-8000-000000001002',
    '00000000-0000-4000-8000-000000001003',
    '00000000-0000-4000-8000-000000001004'
  )
    AND "day_of_week" BETWEEN 0 AND 6
    AND "id" LIKE '%-day-%'
)
UPDATE "availability_slots" AS slot
SET "id" = c."target_id"
FROM candidate_slots AS c
WHERE slot."id" = c."id"
  AND c."target_id" IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM "availability_slots" existing WHERE existing."id" = c."target_id"
  );

-- Convert legacy PricingRule IDs
UPDATE "pricing_rules" SET "id" = '00000000-0000-4000-8000-000000003001'
WHERE "id" = 'rule-peak-hours'
  AND NOT EXISTS (SELECT 1 FROM "pricing_rules" WHERE "id" = '00000000-0000-4000-8000-000000003001');

UPDATE "pricing_rules" SET "id" = '00000000-0000-4000-8000-000000003002'
WHERE "id" = 'rule-weekend'
  AND NOT EXISTS (SELECT 1 FROM "pricing_rules" WHERE "id" = '00000000-0000-4000-8000-000000003002');

COMMIT;
*/
