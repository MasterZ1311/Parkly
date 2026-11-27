# `ENG-D02` Agent D — Security & Operational Safety Audit

**Auditor Role**: Agent D (`safety-auditor` — Security & Operational Safety Auditor)  
**Repository / Branch**: `e:\Github\Parkly` (`fix/stage-d-p0-restoration`)  
**Audit Date**: 2026-11-26  
**Audit Mode**: Strict read-only inspection (no source, schema, migration, seed, Compose, or existing `ENG-D02` report files were modified; no Docker volumes or live databases were touched).

---

## 1. Executive Summary & Finding Counts

The `ENG-D02` database reconciliation preserves baseline migration history ([`20260625230621_public/migration.sql`](../../infra/prisma/migrations/20260625230621_public/migration.sql) has zero diff vs `HEAD`), avoids silent orphan deletion or silent ID rewriting in [`20261126140000_eng_d02_reconcile_integrity/migration.sql`](../../infra/prisma/migrations/20261126140000_eng_d02_reconcile_integrity/migration.sql), skips duplicating legacy string fixtures in [`seed.ts`](../../infra/prisma/seed.ts), and keeps Step 2 of [`reconcile_legacy_dev_data.sql`](../../infra/prisma/scripts/reconcile_legacy_dev_data.sql) commented out behind explicit operator opt-in.

However, several **high-severity operational safety, recovery, and environment isolation gaps** remain before live execution against `parkly_postgres_data` or production-adjacent environments:

| Severity | Count | Summary |
| :--- | :---: | :--- |
| **P0 (Critical)** | **0** | No automatic silent data deletion, silent ID rewriting, or committed production secrets observed in `ENG-D02` artifacts. |
| **P1 (High)** | **3** | Broken Prisma rollback command (`--rolled-back` on applied migration) + ephemeral `/tmp` dump path; fail-open `seed.ts` production guard & unpinned `local-seed` scripts; Compose `NODE_ENV=production` + lazy JWT + live `.env` cloud/payment passthrough. |
| **P2 (Medium)** | **5** | `Payment.payoutId` `ON DELETE SET NULL` financial ledger risk; pre-existing `CASCADE` on `Host.user`/`Vehicle.user` & `SET NULL` on `PricingRule.space`; `anonymizeService.ts` TOCTOU/payout/dispute gaps; missing `.dockerignore` & root service containers; `parkly_postgres_data` `down -v` & wildcard port exposure. |
| **P3 (Low)** | **4** | `reconcile_legacy_dev_data.sql` slot collision guard & DynamoDB drift; `seed.ts` mutable attribute overwrites & non-transactional writes; migration semantic cross-host check & constraint idempotency; `resolveRegionForListing` prefix sort & deployment guide drift. |

---

## 2. Scope Inspected

- **Prisma & SQL**: [`infra/prisma/schema.prisma`](../../infra/prisma/schema.prisma), [`infra/prisma/migrations/20260625230621_public/migration.sql`](../../infra/prisma/migrations/20260625230621_public/migration.sql), [`infra/prisma/migrations/20261126140000_eng_d02_reconcile_integrity/migration.sql`](../../infra/prisma/migrations/20261126140000_eng_d02_reconcile_integrity/migration.sql), [`infra/prisma/scripts/reconcile_legacy_dev_data.sql`](../../infra/prisma/scripts/reconcile_legacy_dev_data.sql), [`infra/prisma/seed.ts`](../../infra/prisma/seed.ts), [`infra/prisma/seed-fixtures.ts`](../../infra/prisma/seed-fixtures.ts), [`infra/prisma/package.json`](../../infra/prisma/package.json), [`scripts/local-seed.ps1`](../../scripts/local-seed.ps1), [`scripts/local-seed.sh`](../../scripts/local-seed.sh).
- **Container & Environment**: [`docker-compose.yml`](../../docker-compose.yml), [`.env.example`](../../.env.example), [`.gitignore`](../../.gitignore), all 11 `services/*/Dockerfile`, [`apps/host-dashboard/Dockerfile`](../../apps/host-dashboard/Dockerfile), [`apps/admin-portal/Dockerfile`](../../apps/admin-portal/Dockerfile), [`shared/src/config/index.ts`](../../shared/src/config/index.ts), [`shared/src/utils/cors.ts`](../../shared/src/utils/cors.ts), [`shared/src/aws/clients.ts`](../../shared/src/aws/clients.ts).
- **Services & Reports**: [`services/admin-service/src/services/anonymizeService.ts`](../../services/admin-service/src/services/anonymizeService.ts), [`services/admin-service/src/index.ts`](../../services/admin-service/src/index.ts), [`services/host-service/src/index.ts`](../../services/host-service/src/index.ts), [`services/auth-service/src/routes/auth.ts`](../../services/auth-service/src/routes/auth.ts), [`services/auth-service/src/services/otpService.ts`](../../services/auth-service/src/services/otpService.ts), [`docs/engineering/ENG-D02_DATABASE_REPORT.md`](../ENG-D02_DATABASE_REPORT.md), [`docs/engineering/ENG-D02_PREFLIGHT.md`](../ENG-D02_PREFLIGHT.md), [`PRODUCTION_CREDENTIALS_AND_DEPLOYMENT_GUIDE.md`](../../PRODUCTION_CREDENTIALS_AND_DEPLOYMENT_GUIDE.md).

---

## 3. Detailed Findings

### P1 — High Severity

#### `D-P1-01`: Documented Rollback Procedure Uses Invalid Prisma Command for Applied Migrations and Container-Ephemeral `pg_dump` Path
- **Locations**:
  - [`docs/engineering/ENG-D02_DATABASE_REPORT.md:114`](../ENG-D02_DATABASE_REPORT.md#L114)
  - [`docs/engineering/ENG-D02_DATABASE_REPORT.md:119-146`](../ENG-D02_DATABASE_REPORT.md#L119-L146)
  - [`docker-compose.yml:27-28`](../../docker-compose.yml#L27-L28)
  - [`infra/prisma/migrations/20261126140000_eng_d02_reconcile_integrity/migration.sql:16-95`](../../infra/prisma/migrations/20261126140000_eng_d02_reconcile_integrity/migration.sql#L16-L95)
  - [`services/admin-service/src/services/anonymizeService.ts:80-132`](../../services/admin-service/src/services/anonymizeService.ts#L80-L132)
  - [`services/admin-service/src/index.ts:69-71`](../../services/admin-service/src/index.ts#L69-L71)
- **Verified Evidence**:
  1. **SQL statement correspondence**: Testing the rollback SQL in [`ENG-D02_DATABASE_REPORT.md:122-142`](../ENG-D02_DATABASE_REPORT.md#L122-L142) against every DDL statement in [`20261126140000_eng_d02_reconcile_integrity/migration.sql`](../../infra/prisma/migrations/20261126140000_eng_d02_reconcile_integrity/migration.sql) confirms exact name and dependency ordering for all 3 FKs (`payments_payout_id_fkey`, `bookings_host_id_fkey`, `parking_spaces_region_id_fkey`), all 7 indexes (`payments_payout_id_idx`, `parking_spaces_region_id_idx`, `bookings_host_id_idx`, `bookings_deleted_at_idx`, `hosts_deleted_at_idx`, `vehicles_deleted_at_idx`, `users_deleted_at_idx`), and all 7 DPDPA columns (`bookings.deleted_at`, `hosts.deleted_at`, `hosts.is_anonymized`, `vehicles.deleted_at`, `users.deleted_at`, `users.anonymized_at`, `users.is_anonymized`).
  2. **`prisma migrate resolve --rolled-back` fails on deployed migrations**: [`ENG-D02_DATABASE_REPORT.md:120,143-146`](../ENG-D02_DATABASE_REPORT.md#L120) states *"if reverting after deploying the forward migration... Then record rollback cleanly in Prisma history: `npx prisma migrate resolve --rolled-back 20261126140000_eng_d02_reconcile_integrity`."* Inspection of the installed Prisma schema engine (`node_modules/@prisma/engines/schema-engine-windows.exe`, `mark_migration_rolled_back.rs`) confirms Prisma refuses `--rolled-back` when the migration row has already succeeded (`finished_at IS NOT NULL`) with: ``cannot be rolled back because it is not in a failed state.``. `--rolled-back` only resolves failed (`finished_at IS NULL`) migrations.
  3. **Ephemeral container backup path**: [`ENG-D02_DATABASE_REPORT.md:114`](../ENG-D02_DATABASE_REPORT.md#L114) runs `docker exec parkly-postgres pg_dump -U parkly -d parkly --format=custom --file=/tmp/pre_eng_d02.dump`. Because [`docker-compose.yml:27-28`](../../docker-compose.yml#L27-L28) mounts only `/var/lib/postgresql/data` to `postgres_data`, `/tmp/pre_eng_d02.dump` resides inside the container's writable layer and is silently lost if `parkly-postgres` is recreated (`docker compose down` or `--force-recreate`).
  4. **Unwarned DPDPA metadata destruction & app breakage**: Dropping the DPDPA columns (`ENG-D02_DATABASE_REPORT.md:136-139`) after any `anonymizeUser()` run destroys compliance flags/timestamps (`is_anonymized`, `anonymized_at`, `deleted_at`) while leaving redacted `ANON_<uuid>` rows in place, removes pre-existing columns if a partial DB already possessed them prior to `20261126140000`, and immediately breaks `admin-service` ([`admin-service/src/index.ts:69-71`](../../services/admin-service/src/index.ts#L69-L71), [`anonymizeService.ts:34,56,68`](../../services/admin-service/src/services/anonymizeService.ts#L34)) unless application code and Prisma Client are reverted concurrently. Step 1's conditional `users.is_active -> isActive` rename (`migration.sql:16-27`) is also omitted from rollback notes (rightly not renamed back to `is_active`, as `schema.prisma:21` requires `isActive`, but undocumented).
- **Recommended Fix**: Update `ENG-D02_DATABASE_REPORT.md` to stream `pg_dump` directly to the host (`docker exec parkly-postgres pg_dump -U parkly -d parkly --format=custom > pre_eng_d02.dump`), clarify that reverting an *already applied* migration requires restoring the `pg_dump` backup (not `--rolled-back`, which only recovers failed migrations), and add an explicit warning against running `DROP COLUMN` after live DPDPA anonymization traffic.

---

#### `D-P1-02`: `seed.ts` Production Guard Fails Open When `NODE_ENV` Is Unset/Staging, Silently Loads `.env`, and `local-seed` Scripts Do Not Pin Local `DATABASE_URL`
- **Locations**:
  - [`infra/prisma/seed.ts:15,131-139,175-213`](../../infra/prisma/seed.ts#L131-L139)
  - [`shared/src/index.ts:6`](../../shared/src/index.ts#L6) & [`shared/src/config/index.ts:13`](../../shared/src/config/index.ts#L13)
  - [`services/auth-service/src/routes/auth.ts:53-137`](../../services/auth-service/src/routes/auth.ts#L53-L137)
  - [`scripts/local-seed.ps1:26-36`](../../scripts/local-seed.ps1#L26-L36) & [`scripts/local-seed.sh:20-23`](../../scripts/local-seed.sh#L20-L23)
- **Verified Evidence**:
  1. **Fail-open `NODE_ENV` guard**: [`infra/prisma/seed.ts:132-139`](../../infra/prisma/seed.ts#L132-L139) throws only when `process.env['NODE_ENV'] === 'production' && process.env['ALLOW_PRODUCTION_SEED'] !== 'true'`. If an operator or CI/bastion shell exports `DATABASE_URL` pointing to production/staging RDS while `NODE_ENV` is unset (`undefined`) or `'staging'`/`'prod'`, `seed.ts` runs unblocked.
  2. **Privilege / fixture injection on hit**: Executing `seed.ts` against a live DB creates/upserts an active `admin` user (`phone: '+919999999999'`, `email: 'admin@parkly.in'`, `role: 'admin'`, `seed.ts:175-186`)—which in Parkly's phone+OTP auth flow (`auth.ts:53-137`) constitutes a known admin login identity—alongside an `approved` host (`+919876543210`, `seed.ts:190-213`), 4 `active` parking spaces (`seed.ts:253-323`), and 2 `active` global pricing rules (`seed.ts:332-369`). Even with `NODE_ENV=production`, `ALLOW_PRODUCTION_SEED=true` bypasses the guard and inserts those same dev/admin fixtures rather than separating minimal reference data (`Region`) from dev fixtures.
  3. **Implicit `.env` loading via `@parkly/shared`**: Importing `{ encodeGeohash } from '@parkly/shared'` (`seed.ts:15`) triggers `dotenv.config({ path: path.resolve(__dirname, '../../../.env') })` (`shared/src/config/index.ts:13`), which can pull a remote `DATABASE_URL` from root `.env` if not already set in the shell.
  4. **Unpinned `local-seed` scripts**: [`scripts/local-seed.ps1:33,36`](../../scripts/local-seed.ps1#L33) and [`scripts/local-seed.sh:20,23`](../../scripts/local-seed.sh#L20) start local Docker Postgres and then run `prisma migrate deploy` and `seed.ts` without setting `DATABASE_URL=postgresql://parkly:password@localhost:5432/parkly` or `NODE_ENV=development` (even though `local-seed.ps1:41` prints that localhost URL). If a shell `DATABASE_URL` or root `.env` targets a remote DB, `local-seed` migrates and seeds the remote DB. Furthermore, `local-seed.ps1:28-30` logs `Proceeding with migration...` and still runs `migrate deploy` + `seed.ts` if `pg_isready` fails all 15 retries.
- **Recommended Fix**: Enforce a fail-closed guard in `seed.ts` requiring BOTH `NODE_ENV` in `['development', 'test']` (or explicit `ALLOW_DEV_SEED=true`) AND a local/test `DATABASE_URL` host check (`localhost`, `127.0.0.1`, `postgres`, or CI test DB); separate `Region` reference seeding from `[DEV FIXTURE]` user/admin creation; pin `DATABASE_URL` and `NODE_ENV=development` inside `scripts/local-seed.*` and abort if `pg_isready` fails.

---

#### `D-P1-03`: Compose `env_file required: false` Combined with `NODE_ENV=production` Dockerfiles, Lazy JWT Checks, and Unfiltered `.env` Cloud/Payment Passthrough
- **Locations**:
  - [`docker-compose.yml:10-13,101-395`](../../docker-compose.yml#L10-L13) (`occupancy-service` at [`line 285`](../../docker-compose.yml#L285))
  - `services/*/Dockerfile` (e.g., [`services/auth-service/Dockerfile:27`](../../services/auth-service/Dockerfile#L27), [`services/api-gateway/Dockerfile:17`](../../services/api-gateway/Dockerfile#L17))
  - [`shared/src/config/index.ts:125-131`](../../shared/src/config/index.ts#L125-L131)
  - [`services/auth-service/src/routes/auth.ts:69-76`](../../services/auth-service/src/routes/auth.ts#L69-L76), [`services/auth-service/src/services/otpService.ts:82-84`](../../services/auth-service/src/services/otpService.ts#L82-L84), [`shared/src/utils/cors.ts:66`](../../shared/src/utils/cors.ts#L66)
  - [`.env.example:42-43,53-54,86,98-101`](../../.env.example#L42-L43)
- **Verified Evidence**:
  1. **Silent healthy-looking misconfiguration without `.env`**: Every `services/*/Dockerfile` sets `ENV NODE_ENV=production`, while [`docker-compose.yml`](../../docker-compose.yml) sets `NODE_ENV: development` only on `occupancy-service` (`line 285`). When `.env` is absent (permitted by `env_file: [{ path: .env, required: false }]` at `lines 10-13`), `JWT_ACCESS_SECRET` and `JWT_REFRESH_SECRET` remain unset. Because [`shared/src/config/index.ts:125-131`](../../shared/src/config/index.ts#L125-L131) evaluates JWT secrets lazily on property access and no service entrypoint calls `getJwtConfig()` on boot, all 11 containers pass `/health` checks (`service_healthy`) and appear healthy, then throw HTTP `500` (`Missing required environment variable: JWT_ACCESS_SECRET`) on the first authenticated route or `/auth/otp/verify` request—while running under `NODE_ENV=production` (`auth.ts:69-76` hides `devOtp`; `cors.ts:66` blocks arbitrary localhost dev origins).
  2. **Live cloud/payment credential passthrough when `.env` contains real keys**: `docker-compose.yml` overrides `DATABASE_URL` and `DYNAMO_ENDPOINT` for Postgres/DynamoDB containers, but `x-common-env` (`lines 10-13`) passes through `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `S3_BUCKET_UPLOADS`, `EVENT_BUS_NAME`, `PAYMENT_PROVIDER`, `PAYMENT_API_KEY`, `PAYMENT_API_SECRET`, `SMS_PROVIDER`, and `PUSH_PROVIDER` from `.env`. A developer with staging/production keys in root `.env` can trigger real AWS SNS/S3/EventBridge or Razorpay API calls from local Compose containers.
  3. **Placeholder secrets & broken default `.env.example` copy**: [`shared/src/config/index.ts:125-131`](../../shared/src/config/index.ts#L125-L131) does not reject placeholder values like `change-me-in-production-min-32-chars` ([`.env.example:42-43`](../../.env.example#L42-L43)) in `NODE_ENV=production`. Additionally, [`.env.example:86,98`](../../.env.example#L86) sets `SMS_PROVIDER=sns` and `PUSH_PROVIDER=fcm` alongside dummy credentials (`lines 53-54,99-101`), causing `POST /auth/otp/request` to fail in Compose (`NODE_ENV=production` triggers `otpService.ts:82-84` throw on SNS error) when `.env` is copied directly from `.env.example`.
- **Recommended Fix**: Explicitly set `NODE_ENV: development`, `SMS_PROVIDER: mock`, `PAYMENT_PROVIDER: mock`, `PUSH_PROVIDER: mock` (or Compose dev-only overrides) in `docker-compose.yml`; validate `getJwtConfig()` at startup in JWT-signing/verifying services and reject placeholder secrets in `NODE_ENV=production`.

---

### P2 — Medium Severity

#### `D-P2-01`: `Payment.payoutId` Uses `ON DELETE SET NULL` on Financial Settlement Records
- **Locations**:
  - [`infra/prisma/schema.prisma:239,256,279`](../../infra/prisma/schema.prisma#L256)
  - [`infra/prisma/migrations/20261126140000_eng_d02_reconcile_integrity/migration.sql:92-95`](../../infra/prisma/migrations/20261126140000_eng_d02_reconcile_integrity/migration.sql#L92-L95)
- **Verified Evidence**:
  - `Booking.hostId -> Host.id` (`migration.sql:87-90`) and `ParkingSpace.regionId -> Region.id` (`migration.sql:82-85`) correctly use `ON DELETE RESTRICT`, matching existing `RESTRICT` rules on `Booking.user/space/vehicle`, `Payment.booking`, `Payout.host`, and `Dispute.booking/user` ([`20260625230621_public/migration.sql:293,299-311,317-320`](../../infra/prisma/migrations/20260625230621_public/migration.sql#L293)).
  - However, `Payment.payoutId -> Payout.id` (`migration.sql:92-95`, `schema.prisma:256`) uses `ON DELETE SET NULL`. Because `Payout` is a financial settlement ledger table (with no `deleted_at` soft-delete column), deleting a `Payout` row silently sets `payments.payout_id = NULL`, detaching settled payments from their disbursement record (making them indistinguishable from unsettled `completed` payments and creating double-payout risk) while leaving `Payout.paymentIds` (`String[]`, `schema.prisma:279`) out of sync. Also note `Payment.userId` (`schema.prisma:239`) and `Dispute.resolvedBy` (`schema.prisma:320`) lack FKs to `users.id`.
- **Recommended Fix**: Switch `payments_payout_id_fkey` to `ON DELETE RESTRICT` in a follow-up Stage E ledger migration (`ENG-E03`), and ensure `Payout` records are immutable/soft-reversed via adjustment entries rather than deleted.

---

#### `D-P2-02`: Pre-Existing `ON DELETE CASCADE` on `Vehicle.user`/`Host.user` and `ON DELETE SET NULL` on `PricingRule.space`
- **Locations**:
  - [`infra/prisma/schema.prisma:56,89,300,306`](../../infra/prisma/schema.prisma#L56)
  - [`infra/prisma/migrations/20260625230621_public/migration.sql:287,290,314`](../../infra/prisma/migrations/20260625230621_public/migration.sql#L287)
- **Verified Evidence**:
  1. `Vehicle.user` and `Host.user` specify `onDelete: Cascade` (`schema.prisma:56,89`). If a `User` has any `Booking`, `ParkingSpace`, `Payout`, or `Dispute`, PostgreSQL blocks `DELETE FROM "users"` via `RESTRICT` on those child tables; however, if no bookings/spaces/payouts exist, deleting a `User` silently hard-deletes `Host` (KYC/verification history) and `Vehicle` rows rather than enforcing soft-delete/anonymization via `RESTRICT`.
  2. `PricingRule.space` specifies `ON DELETE SET NULL` (`20260625230621_public:314`), whereas [`schema.prisma:300`](../../infra/prisma/schema.prisma#L300) defines `spaceId = null` as a **global** pricing rule (`// null = global`). Hard-deleting an unbooked `ParkingSpace` converts its space-specific pricing rules into global rules.
- **Recommended Fix**: Align `Vehicle.user` and `Host.user` to `ON DELETE RESTRICT` and `PricingRule.space` to `ON DELETE CASCADE` (or soft-delete) in Stage E/F schema hardening.

---

#### `D-P2-03`: `anonymizeService.ts` TOCTOU Race, Unchecked Active Payouts/Disputes, and Stale-JWT Host Listing Creation
- **Locations**:
  - [`services/admin-service/src/services/anonymizeService.ts:20,30-132`](../../services/admin-service/src/services/anonymizeService.ts#L30-L132)
  - [`services/host-service/src/index.ts:127-143`](../../services/host-service/src/index.ts#L127-L143)
- **Verified Evidence**:
  1. `anonymizeUser` checks `ACTIVE_BOOKING_STATUSES` (`anonymizeService.ts:30-66`) **outside** `prisma.$transaction` (`line 80`), permitting a race condition if a concurrent booking is created before the transaction commits.
  2. `anonymizeUser` checks only active bookings—not `open`/`under_review` `Dispute`s or `pending`/`processing` `Payout`s—before clearing `panNumber`, `bankAccountNumber`, `ifscCode`, `phone`, and `email` (`lines 86-124`). (Also note `ACTIVE_BOOKING_STATUSES` at `line 20` includes `'pending'`, which does not exist in `BookingStatus` at `schema.prisma:226-233`.)
  3. [`services/host-service/src/index.ts:127-143`](../../services/host-service/src/index.ts#L127-L143) (`getOrCreateHost` / `createListing`) does not verify `user.isActive` or `host.isAnonymized`/`deletedAt`, so an anonymized host holding a non-expired access JWT (up to 15 min TTL) can still create a new `ParkingSpace` under the anonymized `Host` record.
- **Recommended Fix**: Move active-booking, open-dispute, and pending-payout checks inside `prisma.$transaction`, and enforce active/non-anonymized user/host status checks on mutating endpoints in `ENG-D03`/`ENG-G04`.

---

#### `D-P2-04`: Missing `.dockerignore` and Root Container Execution Across All 11 Backend Dockerfiles
- **Locations**:
  - Repo root (`e:\Github\Parkly\.dockerignore` absent)
  - [`apps/host-dashboard/Dockerfile:14,17,38`](../../apps/host-dashboard/Dockerfile#L14) & [`apps/admin-portal/Dockerfile:14,17,38`](../../apps/admin-portal/Dockerfile#L14)
  - `services/*/Dockerfile` (e.g., [`services/auth-service/Dockerfile:29-40`](../../services/auth-service/Dockerfile#L29-L40), [`services/admin-service/Dockerfile:23-36`](../../services/admin-service/Dockerfile#L23-L36))
- **Verified Evidence**:
  1. Both web Dockerfiles execute `COPY . .` (`apps/*/Dockerfile:14`) before `npm run build` (`line 17`). With no `.dockerignore`, any `.env` or `.env.local` in the app context gets copied into the builder and can bake `VITE_*` values into `/app/dist`, while root-context service builds transmit `.git/`, `.env`, `node_modules/`, and `cdk.out/` to the Docker daemon.
  2. Unlike the web Dockerfiles (`USER 101` at `line 38`), all 11 `services/*/Dockerfile` runtime stages omit a non-root `USER` (running Node services as `root`) and copy unpruned `/app/node_modules` containing `devDependencies` (`prisma`, `typescript`, `jest`, `ts-node`).
- **Recommended Fix**: Add a root `.dockerignore` (excluding `.git`, `.env*`, `node_modules`, `**/dist`, `cdk.out`, `brag-output`), prune devDependencies in service runtime stages, and set `USER node` in all 11 service Dockerfiles.

---

#### `D-P2-05`: `parkly_postgres_data` Volume Lacks `down -v` / Baseline Protection and Binds Weak Credentials on `0.0.0.0`
- **Locations**:
  - [`docker-compose.yml:22-28,43,431-432`](../../docker-compose.yml#L22-L28)
  - [`docs/engineering/ENG-D02_DATABASE_REPORT.md:98,100,111-118`](../ENG-D02_DATABASE_REPORT.md#L98)
- **Verified Evidence**:
  1. `postgres_data` ([`docker-compose.yml:431-432`](../../docker-compose.yml#L431-L432)) is preserved across normal `docker compose up/down`, but is not marked `external: true`, so running `docker compose down -v` permanently deletes the existing `parkly_postgres_data` volume (observed ~5 months old per `ENG-D02_DATABASE_REPORT.md:98`).
  2. [`ENG-D02_DATABASE_REPORT.md:116-117`](../ENG-D02_DATABASE_REPORT.md#L116-L117) advises inspecting `_prisma_migrations` before running `migrate deploy`, but omits explicit baselining instructions (`npx prisma migrate resolve --applied 20260625230621_public`) if `parkly_postgres_data` was originally created via `0001_init.sql` without `_prisma_migrations` (though `migrate deploy` fails safely on `type "UserRole" already exists` without altering data).
  3. [`docker-compose.yml:22-26`](../../docker-compose.yml#L22-L26) binds `POSTGRES_USER: parkly` / `POSTGRES_PASSWORD: password` on `"5432:5432"` (`0.0.0.0` all interfaces rather than `127.0.0.1:5432:5432`), exposing the dev database on LAN/external interfaces (same for DynamoDB `8000:8000` at `line 43` and service ports).
- **Recommended Fix**: Bind local Compose ports to `127.0.0.1:<port>:<port>`, document `prisma migrate resolve --applied 20260625230621_public` for legacy `0001_init.sql` volumes, and consider `external: true` (or pre-created volume docs) if protecting persistent local dev data from accidental `down -v`.

---

### P3 — Low Severity / Informational

#### `D-P3-01`: `reconcile_legacy_dev_data.sql` Slot Collision Guard & Non-Transactional External DynamoDB Drift
- **Locations**: [`infra/prisma/scripts/reconcile_legacy_dev_data.sql:56-125`](../../infra/prisma/scripts/reconcile_legacy_dev_data.sql#L56-L125) (specifically [`lines 104-113`](../../infra/prisma/scripts/reconcile_legacy_dev_data.sql#L104-L113)), [`docker-compose.yml:84`](../../docker-compose.yml#L84).
- **Verified Evidence**: Step 2's `UPDATE "availability_slots"` (`lines 105-113`) omits the `AND NOT EXISTS (...)` target collision guard used on `parking_spaces` (`lines 88-102`) and `pricing_rules` (`lines 116-122`) and builds UUIDs via `'...210' || "day_of_week"::TEXT` (valid only when `day_of_week` is single-digit `0..6` and unique per `(space_id, day_of_week)`; duplicates or pre-existing UUID slots abort cleanly via PK `23505` inside `BEGIN...COMMIT`). Step 2 also lacks an inline DB/environment safety check if uncommented and does not reconcile external DynamoDB `parkly-occupancy` records keyed by legacy `spaceId` (`sp-tng-001`, etc.).

#### `D-P3-02`: `seed.ts` Overwrites Mutable Fields on Existing Deterministic Entities & Lacks Transaction Atomicity
- **Locations**: [`infra/prisma/seed.ts:148-156,262-270,305-312,355-361`](../../infra/prisma/seed.ts#L148-L156).
- **Verified Evidence**: Unlike `user`, `host`, and `vehicle` upserts (`update: {}`), `region`, `parkingSpace`, `availabilitySlot`, and `pricingRule` upserts overwrite `isActive: true`, `status: 'active'`, slot hours, and multipliers on re-seed. Additionally, `seed.ts` does not execute inside `prisma.$transaction(...)`, so a `@unique` email collision on `admin@parkly.in` or `ravi@example.com` (`schema.prisma:19`) leaves partial fixture rows behind.

#### `D-P3-03`: `20261126140000_eng_d02_reconcile_integrity` Semantic Cross-Host Check, Constraint Idempotency & Table Locks
- **Locations**: [`infra/prisma/migrations/20261126140000_eng_d02_reconcile_integrity/migration.sql:61-63,82-95`](../../infra/prisma/migrations/20261126140000_eng_d02_reconcile_integrity/migration.sql#L61-L63).
- **Verified Evidence**: The pre-FK orphan guard (`lines 61-63`) confirms `bookings.host_id` exists in `hosts` (preventing FK error `23503`), though not whether `bookings.host_id = parking_spaces.host_id`. Also, `ADD CONSTRAINT` (`lines 82-95`) has no `pg_constraint` existence guard (unlike `IF NOT EXISTS` in `lines 30-52`, failing cleanly if partially pre-applied), and non-concurrent `CREATE INDEX` / `ADD CONSTRAINT` acquire standard Postgres table locks during migration apply.

#### `D-P3-04`: `resolveRegionForListing` Prefix-Sort Edge Case & Deployment Guide Operational Drift
- **Locations**: [`services/host-service/src/index.ts:103-114`](../../services/host-service/src/index.ts#L103-L114), [`PRODUCTION_CREDENTIALS_AND_DEPLOYMENT_GUIDE.md:179-180,282`](../../PRODUCTION_CREDENTIALS_AND_DEPLOYMENT_GUIDE.md#L179-L180), [`.env.example:49`](../../.env.example#L49).
- **Verified Evidence**: `resolveRegionForListing` safely fails closed (`ValidationError`) on missing/inactive regions, though combining exact `city` and `startsWith: '${citySlug}-'` in one `OR` sorted by `id ASC` (`host-service/src/index.ts:106-112`) can pick a prefix match over an exact city match if two active regions share a prefix. In `PRODUCTION_CREDENTIALS_AND_DEPLOYMENT_GUIDE.md`, `lines 179-180` document static IAM user keys in `.env` despite ECS Task Role fallback ([`shared/src/aws/clients.ts:27`](../../shared/src/aws/clients.ts#L27)) and Secrets Manager ([`infra/cdk/lib/parkly-stack.ts:53-70`](../../infra/cdk/lib/parkly-stack.ts#L53-L70)), and `line 282` lists `prisma migrate dev` in resume steps; [`.env.example:49`](../../.env.example#L49) includes unused `DB_SSL=false`.

---

## 4. Verification Matrix Against Audit Criteria

| Audit Pillar | Status | Verified Result |
| :--- | :---: | :--- |
| **Production DB Safeguards** | **Conditional Pass (P1)** | `20261126140000` migration and `reconcile_legacy_dev_data.sql` Step 2 are safe; `seed.ts` fails open if `NODE_ENV` is unset/staging and `local-seed` scripts do not pin local `DATABASE_URL`. |
| **Rollback SQL Correctness** | **Partial / Fix Needed (P1)** | Rollback DDL statements match `20261126140000` object names cleanly, **but** `prisma migrate resolve --rolled-back` fails on applied migrations, `/tmp/pre_eng_d02.dump` is container-ephemeral, and DPDPA `DROP COLUMN` needs live-traffic warning. |
| **FK Deletion Rules** | **Pass on `ENG-D02` FKs; Follow-up Needed (P2)** | `Booking.hostId` and `ParkingSpace.regionId` enforce `ON DELETE RESTRICT`; `Payment.payoutId` uses `ON DELETE SET NULL` (double-payout audit risk), and pre-existing `Host.user`/`Vehicle.user` (`CASCADE`) and `PricingRule.space` (`SET NULL`) remain. |
| **Secret & Env Handling** | **Needs Hardening (P1/P2)** | No live secrets committed in `.env.example` or `docker-compose.yml`; however, `NODE_ENV=production` Dockerfiles + `required: false` + lazy JWT + unpinned `.env` cloud/payment vars and missing `.dockerignore` create runtime/leakage hazards. |
| **Data Preservation & `parkly_postgres_data`** | **Pass on Migration/Seed; Ops Hardening Needed (P2)** | `20260625230621_public` untouched; zero silent deletion or ID rewriting in migration/seed/reconciliation SQL; `parkly_postgres_data` needs host-persisted backup command and `down -v` / legacy `_prisma_migrations` baseline awareness. |
