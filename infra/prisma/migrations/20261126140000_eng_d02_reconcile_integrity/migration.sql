-- =========================================================================
-- ENG-D02: Forward-Only Database Reconciliation & Relational Integrity
--
-- Strategy:
--   1. Preserves 20260625230621_public history verbatim.
--   2. Safely normalizes "users"."is_active" -> "isActive" only if an older
--      database was bootstrapped from loose 0001_init.sql.
--   3. Reconciles missing DPDPA 2023 columns & soft-delete indexes.
--   4. Aborts with explicit diagnostics if orphaned FK rows exist before
--      applying foreign-key constraints (never silently rewrites/deletes data).
--   5. Enforces foreign keys & indexes for bookings.host_id,
--      parking_spaces.region_id, and payments.payout_id.
-- =========================================================================

-- 1. Normalize "users"."isActive" column casing only if legacy "is_active" exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = current_schema() AND table_name = 'users' AND column_name = 'is_active'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = current_schema() AND table_name = 'users' AND column_name = 'isActive'
  ) THEN
    ALTER TABLE "users" RENAME COLUMN "is_active" TO "isActive";
  END IF;
END $$;

-- 2. Add missing DPDPA compliance & soft-delete columns (idempotent on partial DBs)
ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "is_anonymized" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "anonymized_at" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "deleted_at" TIMESTAMP(3);

ALTER TABLE "vehicles"
  ADD COLUMN IF NOT EXISTS "deleted_at" TIMESTAMP(3);

ALTER TABLE "hosts"
  ADD COLUMN IF NOT EXISTS "is_anonymized" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "deleted_at" TIMESTAMP(3);

ALTER TABLE "bookings"
  ADD COLUMN IF NOT EXISTS "deleted_at" TIMESTAMP(3);

-- 3. Add missing soft-delete & foreign-key indexes
CREATE INDEX IF NOT EXISTS "users_deleted_at_idx" ON "users"("deleted_at");
CREATE INDEX IF NOT EXISTS "vehicles_deleted_at_idx" ON "vehicles"("deleted_at");
CREATE INDEX IF NOT EXISTS "hosts_deleted_at_idx" ON "hosts"("deleted_at");
CREATE INDEX IF NOT EXISTS "bookings_deleted_at_idx" ON "bookings"("deleted_at");
CREATE INDEX IF NOT EXISTS "bookings_host_id_idx" ON "bookings"("host_id");
CREATE INDEX IF NOT EXISTS "parking_spaces_region_id_idx" ON "parking_spaces"("region_id");
CREATE INDEX IF NOT EXISTS "payments_payout_id_idx" ON "payments"("payout_id");

-- 4. Inspect referential integrity BEFORE adding FK constraints (abort cleanly on orphans)
DO $$
DECLARE
  v_orphan_booking_hosts BIGINT;
  v_orphan_space_regions BIGINT;
  v_orphan_payment_payouts BIGINT;
BEGIN
  SELECT COUNT(*) INTO v_orphan_booking_hosts
  FROM "bookings" b
  WHERE NOT EXISTS (SELECT 1 FROM "hosts" h WHERE h."id" = b."host_id");

  SELECT COUNT(*) INTO v_orphan_space_regions
  FROM "parking_spaces" ps
  WHERE NOT EXISTS (SELECT 1 FROM "regions" r WHERE r."id" = ps."region_id");

  SELECT COUNT(*) INTO v_orphan_payment_payouts
  FROM "payments" p
  WHERE p."payout_id" IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM "payouts" py WHERE py."id" = p."payout_id");

  IF v_orphan_booking_hosts > 0 OR v_orphan_space_regions > 0 OR v_orphan_payment_payouts > 0 THEN
    RAISE EXCEPTION
      'ENG-D02 migration aborted to protect existing data: orphan counts -> bookings.host_id=%, parking_spaces.region_id=%, payments.payout_id=%. Inspect orphans and run explicit legacy reconciliation (infra/prisma/scripts/reconcile_legacy_dev_data.sql) before re-running prisma migrate deploy.',
      v_orphan_booking_hosts, v_orphan_space_regions, v_orphan_payment_payouts;
  END IF;
END $$;

-- 5. Enforce missing foreign keys without cascade deletion on financial/booking history
ALTER TABLE "parking_spaces"
  ADD CONSTRAINT "parking_spaces_region_id_fkey"
  FOREIGN KEY ("region_id") REFERENCES "regions"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "bookings"
  ADD CONSTRAINT "bookings_host_id_fkey"
  FOREIGN KEY ("host_id") REFERENCES "hosts"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "payments"
  ADD CONSTRAINT "payments_payout_id_fkey"
  FOREIGN KEY ("payout_id") REFERENCES "payouts"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
