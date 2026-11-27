# `ENG-D02` Preflight Audit & Safe Migration Strategy

**Branch**: `fix/stage-d-p0-restoration`
**Starting Checkpoint**: Completed `ENG-D01` working tree (preserved untouched)
**Date**: 2026-11-26

---

## 1. Environment & Existing Database Determination

| Probe | Observed State | Implication for `ENG-D02` |
| :--- | :--- | :--- |
| Git working tree | All `ENG-D01` edits present & preserved (`shared/`, `packages/ai-agents/`, `apps/mobile/`, `docs/engineering/`). | No source, schema, migration, seed, or Compose files modified yet. |
| Docker Desktop (`docker info` / `wsl --list`) | `docker-desktop` WSL distro **Stopped**; `//./pipe/dockerDesktopLinuxEngine` unavailable; `docker compose version` = `v2.40.3-desktop.1`. | Cannot inspect existing `docker volume ls` or run disposable Postgres until Docker Desktop is started. |
| Local PostgreSQL (`Get-Service *postgres*`, port `5432`) | **None running** on Windows host. | No live DB accessible during preflight; existing volume contents remain unknown. |
| Root `.env` | Absent (`Test-Path .env` = `False`); [`.env.example`](../../.env.example) present. | `docker compose config` currently fails until `.env` exists or `required: false` / bootstrap handling is configured. |
| `npx prisma validate` (with synthetic `DATABASE_URL`) | **PASS (`0`)**. | Syntax of [`schema.prisma`](../../infra/prisma/schema.prisma) is valid. |
| `npx prisma migrate diff --from-migrations ...` (no `--shadow-database-url`) | **FAIL (`1`)**. | Prisma 5 requires `--shadow-database-url` to diff a migrations directory ([`.github/workflows/ci.yml#L130`](../../.github/workflows/ci.yml#L130)). |

> [!IMPORTANT]
> Because any existing `postgres_data` Docker volume cannot be inspected while Docker Desktop is stopped, **we must NOT assume the target database is empty** and must **NOT** rewrite [`20260625230621_public/migration.sql`](../../infra/prisma/migrations/20260625230621_public/migration.sql) in place. The migration strategy below uses **forward-only corrective SQL** paired with clean migration hygiene.

---

## 2. Current Schema & Migration History Audit

Tracked files under [`infra/prisma/`](../../infra/prisma/):
- [`schema.prisma`](../../infra/prisma/schema.prisma) (`352` lines, PostgreSQL)
- [`migrations/migration_lock.toml`](../../infra/prisma/migrations/migration_lock.toml) (`provider = "postgresql"`)
- [`migrations/0001_init.sql`](../../infra/prisma/migrations/0001_init.sql) (`263` lines — loose SQL file, **ignored by Prisma Migrate**)
- [`migrations/20260625230621_public/migration.sql`](../../infra/prisma/migrations/20260625230621_public/migration.sql) (`320` lines — the sole Prisma-tracked migration directory)
- [`seed.ts`](../../infra/prisma/seed.ts) (`272` lines)
- [`package.json`](../../infra/prisma/package.json) (`@parkly/prisma` — **not listed** in root [`package.json`](../../package.json) `"workspaces"`)

### Discrepancy Matrix (`0001_init.sql` vs `20260625230621_public` vs `schema.prisma`)

| Category | Detailed Finding | Affected Artifact(s) | Runtime Impact |
| :--- | :--- | :--- | :--- |
| **Loose Duplicate Migration** | `0001_init.sql` sits in `infra/prisma/migrations/` root outside any timestamped folder. Duplicate DDL with `20260625230621_public/migration.sql`. | `0001_init.sql` | Confuses operators/manual `psql`; ignored by Prisma Migrate. |
| **Column Naming Drift** | `0001_init.sql:47` defines `"is_active"` on `"users"`, whereas `schema.prisma:21` declares `isActive` (without `@map`) and `20260625230621_public:41` creates `"isActive"`. Both SQL files + schema also use camelCase `"vehicleTypes"` on `parking_spaces`. | `0001_init.sql`, `schema.prisma` | DB built from `0001_init.sql` fails every `prisma.user.*` query with missing column `"isActive"`. |
| **Missing DPDPA Columns & Indexes** | **All 4 models** have columns & indexes in `schema.prisma` missing from **both** SQL migrations:<br>- `users`: `is_anonymized` (`BOOLEAN NOT NULL DEFAULT false`), `anonymized_at` (`TIMESTAMP(3)`), `deleted_at` (`TIMESTAMP(3)`), index `users_deleted_at_idx`<br>- `vehicles`: `deleted_at` (`TIMESTAMP(3)`), index `vehicles_deleted_at_idx`<br>- `hosts`: `is_anonymized` (`BOOLEAN NOT NULL DEFAULT false`), `deleted_at` (`TIMESTAMP(3)`), index `hosts_deleted_at_idx`<br>- `bookings`: `deleted_at` (`TIMESTAMP(3)`), index `bookings_deleted_at_idx` | `schema.prisma` vs `20260625230621_public` | `GET /admin/users`, `anonymizeUser()`, and `prisma migrate diff` fail immediately against any DB migrated from repo SQL. |
| **Missing Foreign Keys & Indexes** | - `bookings.host_id` (`schema.prisma:182`): unconstrained `TEXT`, no relation to `hosts.id`, no index.<br>- `parking_spaces.region_id` (`schema.prisma:116`): unconstrained `TEXT`, no relation to `regions.id`, no index.<br>- `payments.payout_id` (`schema.prisma:246`): unconstrained nullable `TEXT` (no relation to `payouts.id` / index). | `schema.prisma`, `20260625230621_public` | Orphaned `hostId` / `regionId` / `payoutId` values possible; Host-booking relational joins unavailable in Prisma. |
| **Decimal Precision Gap** | `Host.totalEarnings` (`schema.prisma:82`) & `Host.totalPayouts` (`schema.prisma:83`) omit `@db.Decimal(10, 2)`, generating `DECIMAL(65,30)` in SQL while `hourly_rate`, `total_amount`, `payments.amount`, and `payouts.amount` use `DECIMAL(10, 2)`. | `schema.prisma:82-83`, `20260625230621_public:73-74` | Excess precision drift (safe monetary `BIGINT` paise redesign belongs in Stage E; aligning `@db.Decimal(10, 2)` or preserving existing precision safely). |
| **Enum Inconsistencies** | - DB `"BookingStatus"`: `created, confirmed, active, completed, cancelled, refunded`.<br>- `anonymizeService.ts:20` references `'pending'`.<br>- `apps/admin-portal` references booking status `'disputed'` (disputes live in `"disputes"` table) and user role `'government'` (not in `UserRole`: `driver, host, admin`).<br>- `ENG-D04` requires booking lifecycle states `held, confirmed, active, completed, expired, cancelled, no_show, overstay`. | `schema.prisma`, `anonymizeService.ts`, `apps/admin-portal` | Sending `'disputed'` or `'government'` to backend filters causes HTTP `500` Prisma validation errors. |
| **`.gitignore` Migration Rule** | [`.gitignore#L42`](../../.gitignore#L42) specifies `prisma/migrations/`, ignoring new subdirectories under `infra/prisma/migrations/`. | `.gitignore` | New forward migrations risk being untracked by Git. |
| **Cascade / Restrict Hazards** | `Vehicle.user` and `Host.user` use `onDelete: Cascade`, while `Booking.vehicle` and `ParkingSpace.host` use `onDelete: Restrict`; financial/audit rows (`Booking`, `Payment`, `Payout`, `Dispute`) use `Restrict` (`pricingRules.space` uses `SetNull`). | `schema.prisma:56,89,200-202,250,276,298,316-317` | Hard-deleting a `User` fails if bookings/spaces exist; if no bookings/spaces exist it wipes `Host`/`Vehicle` via cascade rather than soft-deleting. Should **never** add cascade to financial/audit records. |

---

## 3. Seed Identifier & Relational Service Audit

### A. Non-UUID Seed Identifiers Blocking Zod UUID Validation

| Entity | Current Seed ID (`seed.ts`) | Target / API Expectation | Dependent Consumers |
| :--- | :--- | :--- | :--- |
| `Region` | `'chennai-tn-in'` | Schema `Region.id` is `String @id` (no `@default(uuid())`); no API validates `regionId` as `.uuid()`. **Proposal**: Keep canonical region slug `'chennai-tn-in'` (or confirm if UUID preferred). | `host-service` (`data.city.toLowerCase().replace(...)`), `seed.ts` |
| `User` (admin, host, driver) | Prisma `@default(uuid())` (random per DB reset) | Deterministic RFC4122 UUID constants (`dev` fixtures) so repeated runs & integration tests share stable IDs. | `auth-service`, `booking-service`, `admin-service` |
| `Host` | Prisma `@default(uuid())` | Deterministic RFC4122 UUID constant linked to `hostUser`. | `host-service`, `booking-service` (`z.string().uuid()`), `mobile` |
| `Vehicle` | Prisma `@default(uuid())` | Deterministic RFC4122 UUID constant linked to `driverUser`. | `booking-service` (`z.string().uuid()`) |
| `ParkingSpace` (4 seeded) | `'sp-tng-001'`, `'sp-tng-002'`, `'sp-adyar-001'`, `'sp-vel-001'` | **`booking-service` requires `spaceId: z.string().uuid()`** -> rejects all 4 seeded spaces with HTTP `400`! | `apps/mobile` (`concierge.tsx`, `home.tsx`, `map.tsx`, `bookings.tsx`, `create.tsx`, `space/[id].tsx`, `[id].tsx`), `packages/ai-agents/tests/unit/tools/real-providers.test.ts` (log string & metadata) |
| `AvailabilitySlot` (28 seeded) | `'${space.id}-day-${day}'` | Must use deterministic RFC4122 UUIDs matching updated `spaceId` UUIDs and schema `@default(uuid())`. | `search-service`, `host-service` |
| `PricingRule` (2 global) | `'rule-peak-hours'`, `'rule-weekend'` | Schema `@default(uuid())`; standardize to deterministic RFC4122 UUIDs (`upserted` cleanly). | `pricing-service` |

### B. Affected Application Queries Requiring Coordination
1. **`services/host-service/src/index.ts:107`**: Sets `regionId: data.city.toLowerCase().replace(/\s+/g, '-')` (`'chennai'`), whereas `seed.ts:19` seeds `'chennai-tn-in'`. **Enforcing `parking_spaces.region_id -> regions.id` FK will break `POST /host/listings` unless `host-service` resolves the matching `Region` record by `city` (and/or falls back only to a valid existing/active region ID)!**
2. **Legacy Dev Seed Migration Hazard**: If an existing local dev DB already contains `'sp-tng-001'`, etc., changing `seed.ts` IDs to UUIDs without handling existing rows would either violate `region_id` FK or leave duplicate spaces at identical coordinates/names. Re-seed logic must handle clean migration/upsert without duplicating dev fixtures.
3. **Portal/Mobile Fixtures (`ENG-D05` / `ENG-D06` coordination)**: Mobile fallback screens (`sp-tng-001`, `host-chennai-001`) and `admin-portal` mocks (`sp-001`, `usr-005`, `b_sample_03`) are out of `ENG-D02` UI refactor scope (`ENG-D05`/`ENG-D06`), except keeping documented deterministic UUID mapping ready so mobile/UI teams align seamlessly.

---

## 4. Docker Compose, CI, & Container Infrastructure Audit

| Component | Confirmed Defect | Proposed Remediation in `ENG-D02` |
| :--- | :--- | :--- |
| **`docker-compose.yml` Networks** | `postgres`, `dynamodb-local`, and `dynamodb-setup` omit `networks: [parkly-net]`, isolating them from all 11 microservices on `parkly-net`. | Attach `postgres`, `dynamodb-local`, and `dynamodb-setup` to `parkly-net`. |
| **`docker-compose.yml` Health & Depends** | `dynamodb-local` lacks a `healthcheck`; `auth-service`, `occupancy-service`, `notification-service` depend only on `dynamodb-local` (`service_started`), racing against `dynamodb-setup`. `api-gateway` depends only on `auth-service` and `booking-service` and omits `PREDICTION_URL` (`http://prediction-service:4005`) and `NOTIFICATION_URL` (`http://notification-service:4009`). `search-service` omits `depends_on: prediction-service`. | Add `dynamodb-local` healthcheck, gate DynamoDB consumers on `dynamodb-setup: service_completed_successfully`, add `PREDICTION_URL` & `NOTIFICATION_URL` to `api-gateway` + `.env.example`, align gateway & search `depends_on`. |
| **`docker-compose.yml` `.env` Hard Requirement** | `env_file: .env` fails `docker compose config` on fresh clones without `.env`. | Use `env_file: [{ path: .env, required: false }]` (supported in Compose v2.20+; installed is `v2.40.3`) with safe defaults OR documented `.env` copy step. |
| **Service Dockerfiles (`services/*/Dockerfile`)** | All 11 service Dockerfiles omit `shared/package.json` in runtime stage; 5 AI services (`admin`, `host`, `prediction`, `pricing`, `search`) omit `packages/ai-agents` build & dist artifacts; `auth-service/Dockerfile:41,43` copy non-existent `shared/node_modules` & `services/auth-service/node_modules`; 10 Dockerfiles swallow `prisma generate` errors via `2>/dev/null || true`. | Fix Dockerfile builder/runtime copy steps cleanly for `@parkly/shared`, `@parkly/ai-agents`, and explicit `prisma generate` failure surfacing. |
| **Auth Service Scripts (`services/auth-service/package.json`)** | `migrate`, `migrate:deploy`, `seed` omit `--schema=../../infra/prisma/schema.prisma` and point to non-existent `src/seed.ts`. | Point scripts cleanly to `../../infra/prisma/schema.prisma` and `../../infra/prisma/seed.ts`. |
| **CI Migration Diff (`.github/workflows/ci.yml:130`)** | `prisma migrate diff --from-migrations ...` lacks `--shadow-database-url "$DATABASE_URL"` (verified failing in Prisma 5.16.1). | Add `--shadow-database-url "$DATABASE_URL"` and run repeatable `seed.ts` verification in CI. |

---

## 5. Proposed Safe Migration Strategy (`Section B` — For Review & Approval)

To ensure **zero data loss** on any pre-existing PostgreSQL instance while producing a **clean, repeatable from-scratch build** on disposable databases:

### Step B1 — Historical Migration Preservation & Hygiene (Non-Destructive)
1. **Preserve [`20260625230621_public/migration.sql`](../../infra/prisma/migrations/20260625230621_public/migration.sql) verbatim** — never rewrite an already-committed timestamped Prisma migration that may exist in `_prisma_migrations`.
2. **Quarantine / remove loose `0001_init.sql`**: Because Prisma Migrate does not execute loose files outside `<timestamp>_<name>/migration.sql` and `0001_init.sql` contains conflicting `"is_active"` naming, remove `0001_init.sql` from `infra/prisma/migrations/` (after confirming its legitimate schema objects are already covered by `20260625230621_public`).
3. **Fix [`.gitignore#L42`](../../.gitignore#L42)**: Narrow or remove the `prisma/migrations/` ignore rule so future migrations are version-controlled by Git.

### Step B2 — Forward-Only Corrective Migration (`20261126000000_eng_d02_reconcile_integrity/migration.sql`)
Write a **forward-only, idempotent/safe migration** applied cleanly after `20260625230621_public`:
1. **Normalize `"users"."isActive"` edge case if a DB ran `0001_init.sql` outside Prisma** *(optional pre-check/guard only if `"is_active"` exists without `"isActive"`)*.
2. **Add missing DPDPA columns & soft-delete indexes** (`IF NOT EXISTS` safe against partially patched DBs):
   - `"users"`: `"is_anonymized"`, `"anonymized_at"`, `"deleted_at"` + `users_deleted_at_idx`
   - `"vehicles"`: `"deleted_at"` + `vehicles_deleted_at_idx`
   - `"hosts"`: `"is_anonymized"`, `"deleted_at"` + `hosts_deleted_at_idx`
   - `"bookings"`: `"deleted_at"` + `bookings_deleted_at_idx`
3. **Prepare `BookingStatus` enum cleanly for `ENG-D04` (`ADD VALUE IF NOT EXISTS`)** *(non-destructive)*:
   - Keep existing `created, confirmed, active, completed, cancelled, refunded` and add `'held'`, `'expired'`, `'no_show'`, `'overstay'` if approved now (or defer to `ENG-D04` — recommend adding in `ENG-D02` so schema & enums are settled once).
   - Keep `UserRole` unchanged (`driver, host, admin`); `'government'` and `'disputed'` belong to portal cleanup in `ENG-D06`, not DB enums.
4. **Add Foreign Keys & Missing Indexes (Requires Safe Backfill / Orphan Handling on Existing Data!)**:
   - **Pre-FK Integrity Verification / Remediation before `ADD CONSTRAINT`**:
     - `bookings.host_id -> hosts.id` (`ON DELETE RESTRICT ON UPDATE CASCADE` + `bookings_host_id_idx`): For any existing `Booking` whose `host_id` does not match `hosts.id`, backfill safely from `parking_spaces.host_id` (`UPDATE bookings b SET host_id = ps.host_id FROM parking_spaces ps WHERE b.space_id = ps.id AND NOT EXISTS (SELECT 1 FROM hosts h WHERE h.id = b.host_id)`). If true orphans still exist after lookup, fail migration cleanly with a clear error rather than deleting financial booking records!
     - `parking_spaces.region_id -> regions.id` (`ON DELETE RESTRICT ON UPDATE CASCADE` + `parking_spaces_region_id_idx`): For any existing `ParkingSpace` whose `region_id` equals `'chennai'` (from `host-service`'s old city slug), normalize `'chennai'` -> `'chennai-tn-in'` when `'chennai-tn-in'` exists (and ensure `'chennai-tn-in'` region exists if spaces already exist for Chennai!), and update `services/host-service/src/index.ts:107` to resolve `Region` from DB by city before insert.
     - Optional `payments.payout_id -> payouts.id` (`ON DELETE SET NULL ON UPDATE CASCADE` + `payments_payout_id_idx`): nullify invalid dangling `payout_id` only? **Better**: verify none exist or add FK cleanly after validation; keep `Payment.bookingId` `RESTRICT`.
5. **Items Flagged for Explicit Decision Before Applying**:
   - **Decision Point 1 (`Host.totalEarnings` / `Host.totalPayouts` `DECIMAL(65,30)` -> `DECIMAL(10, 2)`)**: Narrowing a PostgreSQL column from `DECIMAL(65,30)` to `DECIMAL(10,2)` alters an existing table column type (potentially truncating >8-digit balances or rounding fractional decimals). Recommend either leaving precision unchanged in `ENG-D02` until Stage E integer-`paise` `BIGINT` migration, OR altering cleanly only if confirmed safe (`<= 99,999,999.99`).
   - **Decision Point 2 (`BookingStatus` additive values now vs `ENG-D04`)**: Safe `ALTER TYPE ... ADD VALUE IF NOT EXISTS 'held' / 'expired' / 'no_show' / 'overstay'` in `ENG-D02` avoids double-migrating enums in `ENG-D04` (note PostgreSQL cannot drop enum values easily without type recreation, and `ADD VALUE` works cleanly inside/outside Prisma migration files when executed standalone).
   - **Decision Point 3 (Legacy Seed `'sp-tng-001'` Rewrite on Existing DBs)**: Should `seed.ts` use deterministic dev UUIDs (`00000000-0000-4000-8000-...`) while **skipping/migrating** legacy `'sp-tng-001'` rows safely (only migrating unreferenced/dev fixtures or preserving FK-referenced rows cleanly)?
   - **Decision Point 4 (`Region.id` format)**: Keep canonical slug `'chennai-tn-in'` (matches `schema.prisma:338` `String @id` & city lookup) or convert to UUID? Recommendation: **Keep `'chennai-tn-in'` slug** (`Region.id` is not `.uuid()`-validated anywhere, and `host-service` resolves regions by city/slug).

---

## 6. Rollback Plan Outline (To Be Finalized & Tested in Live `ENG-D02`)
1. Before running any SQL against an existing DB, capture logical backup (`pg_dump --format=custom --file=backup_pre_eng_d02.dump`).
2. Forward migration `20261126000000_eng_d02_reconcile_integrity` only adds columns, indexes, FKs, and additive enum values — zero destructive `DROP TABLE` / `DROP COLUMN` operations.
3. Reverse SQL script (drop added FK constraints -> drop added indexes -> drop added nullable/defaulted DPDPA columns if required, mark rolled back via `prisma migrate resolve --rolled-back`). *(Postgres enum value additions are strictly additive and safe to leave in place.)*
