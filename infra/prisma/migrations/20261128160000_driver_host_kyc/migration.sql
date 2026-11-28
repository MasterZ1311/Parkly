-- Add Driver KYC, Vehicle RC verification fields, Host KYC fields, and ParkingSpace plot/ownership review metadata
ALTER TABLE "vehicles"
  ADD COLUMN IF NOT EXISTS "rc_number" TEXT,
  ADD COLUMN IF NOT EXISTS "rc_document_url" TEXT,
  ADD COLUMN IF NOT EXISTS "insurance_number" TEXT,
  ADD COLUMN IF NOT EXISTS "puc_valid_until" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "verification_status" "VerificationStatus" NOT NULL DEFAULT 'pending';

ALTER TABLE "hosts"
  ADD COLUMN IF NOT EXISTS "kyc_full_name" TEXT,
  ADD COLUMN IF NOT EXISTS "kyc_phone" TEXT,
  ADD COLUMN IF NOT EXISTS "gov_id_type" TEXT,
  ADD COLUMN IF NOT EXISTS "gov_id_number_masked" TEXT,
  ADD COLUMN IF NOT EXISTS "gov_id_document_url" TEXT,
  ADD COLUMN IF NOT EXISTS "ownership_proof_type" TEXT,
  ADD COLUMN IF NOT EXISTS "ownership_document_url" TEXT,
  ADD COLUMN IF NOT EXISTS "address_proof_url" TEXT,
  ADD COLUMN IF NOT EXISTS "plot_photo_urls" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN IF NOT EXISTS "upi_id" TEXT,
  ADD COLUMN IF NOT EXISTS "kyc_notes" TEXT,
  ADD COLUMN IF NOT EXISTS "review_notes" TEXT,
  ADD COLUMN IF NOT EXISTS "reviewed_by" TEXT,
  ADD COLUMN IF NOT EXISTS "submitted_at" TIMESTAMP(3);

ALTER TABLE "parking_spaces"
  ADD COLUMN IF NOT EXISTS "ownership_proof_url" TEXT,
  ADD COLUMN IF NOT EXISTS "review_notes" TEXT,
  ADD COLUMN IF NOT EXISTS "verified_at" TIMESTAMP(3);

CREATE TABLE IF NOT EXISTS "driver_kycs" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "full_name" TEXT NOT NULL,
  "date_of_birth" TEXT,
  "address" TEXT,
  "emergency_contact" TEXT,
  "driving_license_number" TEXT NOT NULL,
  "driving_license_expiry" TEXT,
  "driving_license_front_url" TEXT NOT NULL,
  "driving_license_back_url" TEXT,
  "gov_id_type" TEXT NOT NULL,
  "gov_id_number_masked" TEXT NOT NULL,
  "gov_id_document_url" TEXT NOT NULL,
  "vehicle_id" TEXT,
  "vehicle_plate" TEXT NOT NULL,
  "rc_number" TEXT NOT NULL,
  "rc_document_url" TEXT NOT NULL,
  "insurance_document_url" TEXT,
  "selfie_url" TEXT,
  "status" "VerificationStatus" NOT NULL DEFAULT 'pending',
  "review_notes" TEXT,
  "reviewed_by" TEXT,
  "reviewed_at" TIMESTAMP(3),
  "submitted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "driver_kycs_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "driver_kycs_user_id_key" ON "driver_kycs"("user_id");
CREATE INDEX IF NOT EXISTS "driver_kycs_status_idx" ON "driver_kycs"("status");
CREATE INDEX IF NOT EXISTS "driver_kycs_driving_license_number_idx" ON "driver_kycs"("driving_license_number");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'driver_kycs_user_id_fkey'
  ) THEN
    ALTER TABLE "driver_kycs"
      ADD CONSTRAINT "driver_kycs_user_id_fkey"
      FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
