-- Add SpaceType enum and entry_instructions for private/residential parking listings
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'SpaceType') THEN
    CREATE TYPE "SpaceType" AS ENUM ('commercial', 'private_house', 'apartment_bay', 'gated_compound');
  END IF;
END $$;

ALTER TABLE "parking_spaces"
  ADD COLUMN IF NOT EXISTS "space_type" "SpaceType" NOT NULL DEFAULT 'commercial',
  ADD COLUMN IF NOT EXISTS "entry_instructions" TEXT;

CREATE INDEX IF NOT EXISTS "parking_spaces_space_type_idx" ON "parking_spaces"("space_type");
