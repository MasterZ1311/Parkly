-- Sync DPDPA soft-deletion / anonymization columns and add operational ops tables

ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "is_anonymized" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "anonymized_at" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "deleted_at" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "users_deleted_at_idx" ON "users"("deleted_at");

ALTER TABLE "vehicles"
  ADD COLUMN IF NOT EXISTS "deleted_at" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "vehicles_deleted_at_idx" ON "vehicles"("deleted_at");

ALTER TABLE "hosts"
  ADD COLUMN IF NOT EXISTS "is_anonymized" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "deleted_at" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "hosts_deleted_at_idx" ON "hosts"("deleted_at");

ALTER TABLE "bookings"
  ADD COLUMN IF NOT EXISTS "deleted_at" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "bookings_deleted_at_idx" ON "bookings"("deleted_at");

-- Operational Audit Logs
CREATE TABLE IF NOT EXISTS "audit_logs" (
    "id" TEXT NOT NULL,
    "actor_id" TEXT,
    "actor_name" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "target" TEXT NOT NULL,
    "ip_address" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "audit_logs_created_at_idx" ON "audit_logs"("created_at");
CREATE INDEX IF NOT EXISTS "audit_logs_action_idx" ON "audit_logs"("action");

-- Operational System Alerts
CREATE TABLE IF NOT EXISTS "system_alerts" (
    "id" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "detail" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'system',
    "resolved" BOOLEAN NOT NULL DEFAULT false,
    "resolved_by" TEXT,
    "resolved_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "system_alerts_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "system_alerts_resolved_created_at_idx" ON "system_alerts"("resolved", "created_at");

-- Operational Platform Settings
CREATE TABLE IF NOT EXISTS "platform_settings" (
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "updated_by" TEXT,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "platform_settings_pkey" PRIMARY KEY ("key")
);
