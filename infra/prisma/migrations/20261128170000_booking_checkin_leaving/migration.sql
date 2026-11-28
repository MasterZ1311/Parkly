-- AlterTable: Add host-driver check-in/check-out gate PIN, actual timestamps, leaving alert, and overstay fields
ALTER TABLE "bookings"
  ADD COLUMN IF NOT EXISTS "gate_code" TEXT,
  ADD COLUMN IF NOT EXISTS "checked_in_at" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "checked_out_at" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "leaving_notified_at" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "overstay_minutes" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "overstay_amount" DECIMAL(10,2) NOT NULL DEFAULT 0;
