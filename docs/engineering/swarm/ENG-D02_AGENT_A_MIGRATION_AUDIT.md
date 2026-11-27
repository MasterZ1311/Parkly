# ENG-D02 Migration & Prisma Integrity Audit (Agent A)

**Auditor**: Agent A (`migration-auditor`)  
**Repository**: `e:\Github\Parkly` (branch: `fix/stage-d-p0-restoration`)  
**Scope**: Read-only audit of Prisma schema, migration files, `.gitignore`, cumulative DDL correspondence, `20261126140000_eng_d02_reconcile_integrity` safety on fresh vs. legacy PostgreSQL databases, and query/schema alignment across `host-service`, `admin-service`, `booking-service`, and `payment-service`.  
**Summary Counts**: **P0: 0** (with **2 release/verification gates** documented below) | **P1: 5** | **P2: 6** | **P3: 5**

---

## 1. Executive Summary & Verification Matrix

### Overall Verdict
The `ENG-D02` schema and forward-only migration work is **structurally sound and cumulative-DDL equivalent** to [`infra/prisma/schema.prisma`](../../infra/prisma/schema.prisma). No data-destructive migration patterns (`DROP TABLE`, `DROP COLUMN`, silent orphan deletes/rewrites, or cascading deletes onto financial/audit tables) were found in [`infra/prisma/migrations/20261126140000_eng_d02_reconcile_integrity/migration.sql`](../../infra/prisma/migrations/20261126140000_eng_d02_reconcile_integrity/migration.sql), and [`infra/prisma/migrations/20260625230621_public/migration.sql`](../../infra/prisma/migrations/20260625230621_public/migration.sql) remains untouched verbatim.

However, **two pre-merge/pre-deploy gates** remain open outside static verification, and **five P1 service/data-bootstrap alignment issues** exist across the four inspected services—most notably unvalidated `hostId` / `bookingId` / enum inputs hitting newly enforced PostgreSQL constraints or Prisma validation (triggering HTTP `500`s) and the absence of production `Region` seeding outside dev-gated [`infra/prisma/seed.ts`](../../infra/prisma/seed.ts).

### Verification Evidence Executed (Read-Only)

| Check | Command / Method | Exit | Observed Outcome |
| :--- | :--- | :---: | :--- |
| Git status & history integrity | `git diff HEAD -- infra/prisma/migrations/20260625230621_public/migration.sql infra/prisma/migrations/migration_lock.toml` | `0` | Empty diff (`20260625230621_public/migration.sql` `11,057` bytes / `320` lines LF, `migration_lock.toml` `128` bytes untouched). |
| `0001_init.sql` removal & diff | `git diff --cached -- infra/prisma/migrations/0001_init.sql` + AST/DDL compare vs `20260625230621_public/migration.sql` | `0` | Staged as deleted (`D`). Identical `11` enums, `16` indexes, `12` FKs, and `11` tables **except** `users.is_active` (`0001_init.sql:52`) vs `users.isActive` (`20260625230621_public/migration.sql:41`). |
| `.gitignore` tracking verification | `git check-ignore -v infra/prisma/migrations/20261126140000_eng_d02_reconcile_integrity/migration.sql ...` | `0` | `infra/prisma/migrations/*` is **not ignored**; only root `/prisma/migrations/` is matched (`.gitignore:43`). |
| `prisma validate` (no env) | `npx prisma validate --schema=infra/prisma/schema.prisma` | `1` | Fails with `P1012` (`Environment variable not found: DATABASE_URL` at `infra/prisma/schema.prisma:11`). |
| `prisma validate` (synthetic env) | `$env:DATABASE_URL="postgresql://dummy:dummy@localhost:5432/dummy?schema=public"; npx prisma validate --schema=infra/prisma/schema.prisma` | `0` | `The schema at infra\prisma\schema.prisma is valid` (`Prisma CLI 5.22.0`). |
| `prisma migrate diff` (from empty) | `npx prisma migrate diff --from-empty --to-schema-datamodel infra/prisma/schema.prisma --script` | `0` | Generated `358` DDL lines (`11` enums, `11` tables, `23` indexes, `15` FKs). |
| `prisma migrate diff` (no shadow URL) | `npx prisma migrate diff --from-migrations infra/prisma/migrations --to-schema-datamodel infra/prisma/schema.prisma --exit-code` | `1` | `Error: You must pass the --shadow-database-url if you want to diff a migrations directory.` (Confirms `.github/workflows/ci.yml:130` fix.) |
| Cumulative DDL equivalence check | Programmatic comparison of `20260625230621_public` + `20261126140000_eng_d02_reconcile_integrity` vs `--from-empty` script | `0` | `Enums equal: True (11)`, `Tables equal: True (11)`, `Indexes equal: True (23, diff: set())`, `FKs equal: True (15, diff: set())`. |
| Generated client parity | `git diff --no-index --ignore-all-space infra/prisma/schema.prisma node_modules/.prisma/client/schema.prisma` | `1` | Only blank line formatting (`schema.prisma:218`); all models, fields, indexes, and relations match. |
| Service TypeScript checks | `npx tsc --noEmit -p services/{host,admin,booking,payment}-service/tsconfig.json` | `0` | All `4` services passed with `0` errors. |
| Service unit tests (mocked Prisma) | `npm test -w services/{host,admin,booking,payment}-service` | `0` | `host`: `6/6` passed; `admin`: `5/5` passed; `booking`: `10/10` passed; `payment`: `7/7` passed. *(All use mocked `PrismaClient` / spies.)* |
| Live DB migration / shadow diff | `prisma migrate deploy`, `prisma migrate diff --shadow-database-url`, `parkly_postgres_data` probe | **Blocked** | **Not executed**: read-only audit rules forbid executing migrations against any DB, and no live PostgreSQL instance is running. |

---

## 2. Migration & Schema Verification Details (Scopes 1–4)

### 2.1 Historical Preservation, `0001_init.sql` Removal, Ordering & `.gitignore`
- [`infra/prisma/migrations/migration_lock.toml:1-3`](../../infra/prisma/migrations/migration_lock.toml#L1-L3): Remains `provider = "postgresql"`, unchanged against `HEAD`.
- [`infra/prisma/migrations/20260625230621_public/migration.sql:1-320`](../../infra/prisma/migrations/20260625230621_public/migration.sql#L1-L320): Untouched verbatim against `HEAD` (`11,057` bytes, LF line endings).
- `infra/prisma/migrations/0001_init.sql`: Staged for deletion (`D`). Programmatic DDL parsing against `HEAD:infra/prisma/migrations/0001_init.sql` confirmed every enum, table, column, default, primary key, index (differs only by whitespace in `bookings_start_time_end_time_idx`), and foreign key is covered by `20260625230621_public/migration.sql`, with the sole functional difference being `users.is_active` (`0001_init.sql:52`) vs. `users.isActive` (`20260625230621_public/migration.sql:41`).
- **Migration Ordering**: `infra/prisma/migrations/` contains only two timestamped folders (`20260625230621_public` followed by `20261126140000_eng_d02_reconcile_integrity`). Lexicographical ordering is valid.
- [`.gitignore:42-43`](../../.gitignore#L42-L43): Changed from unanchored `prisma/migrations/` to root-anchored `/prisma/migrations/` with an explicit tracking comment. `git check-ignore -v` confirms migration files under `infra/prisma/migrations/` are no longer ignored.

### 2.2 Cumulative DDL & Prisma Schema Correspondence
Comparing `npx prisma migrate diff --from-empty --to-schema-datamodel infra/prisma/schema.prisma --script` against the cumulative DDL of `20260625230621_public/migration.sql` + `20261126140000_eng_d02_reconcile_integrity/migration.sql` establishes exact semantic correspondence:
1. **11 Enums**: `UserRole`, `VehicleType`, `VerificationStatus`, `SpaceStatus`, `SecurityLevel`, `BookingType`, `BookingStatus`, `PaymentStatus`, `PayoutStatus`, `DisputeType`, `DisputeStatus` match identically.
2. **11 Tables & DPDPA Columns**:
   - `users`: `20260625230621_public:35-46` + conditional `is_active -> isActive` rename (`20261126140000:16-27`) + `is_anonymized`, `anonymized_at`, `deleted_at` (`20261126140000:30-33`).
   - `vehicles`: `20260625230621_public:49-61` + `deleted_at` (`20261126140000:35-36`).
   - `hosts`: `20260625230621_public:64-79` + `is_anonymized`, `deleted_at` (`20261126140000:38-40`).
   - `bookings`: `20260625230621_public:129-152` + `deleted_at` (`20261126140000:42-43`).
   - All remaining tables (`parking_spaces`, `availability_slots`, `payments`, `payouts`, `pricing_rules`, `disputes`, `regions`) match column-for-column.
   - *(Note: PostgreSQL physical column ordinal positions on `users`, `vehicles`, `hosts`, `bookings` will append new DPDPA columns at the end of existing tables rather than before `created_at`, which Prisma Migrate ignores.)*
3. **23 Indexes**: All `16` initial indexes (`20260625230621_public:239-284`) plus `7` added indexes (`users_deleted_at_idx`, `vehicles_deleted_at_idx`, `hosts_deleted_at_idx`, `bookings_deleted_at_idx`, `bookings_host_id_idx`, `parking_spaces_region_id_idx`, `payments_payout_id_idx` in `20261126140000:46-52`) match `schema.prisma` names and column lists identically.
4. **15 Foreign Keys & Delete Rules**: All `12` initial FKs (`20260625230621_public:287-320`) plus `3` added FKs (`20261126140000:82-95`):
   - `parking_spaces_region_id_fkey` (`parking_spaces.region_id -> regions.id`, `ON DELETE RESTRICT ON UPDATE CASCADE`)
   - `bookings_host_id_fkey` (`bookings.host_id -> hosts.id`, `ON DELETE RESTRICT ON UPDATE CASCADE`)
   - `payments_payout_id_fkey` (`payments.payout_id -> payouts.id`, `ON DELETE SET NULL ON UPDATE CASCADE`)
   - Zero cascade-delete actions exist on `Booking`, `Payment`, `Payout`, or `Dispute`.

### 2.3 Preserved Scope Boundaries & Fresh vs. Legacy DB Behavior
- **`Host.totalEarnings` / `Host.totalPayouts`**: Preserved as `Decimal @default(0)` (`DECIMAL(65,30)`) in [`infra/prisma/schema.prisma:82-83`](../../infra/prisma/schema.prisma#L82-L83) and [`20260625230621_public/migration.sql:73-74`](../../infra/prisma/migrations/20260625230621_public/migration.sql#L73-L74). No narrowing or balance truncation risk introduced.
- **Deferred `BookingStatus` values**: `held`, `expired`, `no_show`, `overstay` remain excluded from [`infra/prisma/schema.prisma:226-233`](../../infra/prisma/schema.prisma#L226-L233) and [`20260625230621_public/migration.sql:20`](../../infra/prisma/migrations/20260625230621_public/migration.sql#L20) (deferred to `ENG-D04`).
- **`Region.id = 'chennai-tn-in'`**: [`infra/prisma/schema.prisma:346`](../../infra/prisma/schema.prisma#L346) retains `id String @id` (no `@default(uuid())`).
- **Fresh DB execution path**: `20260625230621_public` creates `"users"."isActive"`, then `20261126140000` skips the `is_active -> isActive` rename, adds the 7 columns and 7 indexes, verifies `0` orphans across empty tables, and adds all 3 FKs cleanly.
- **Legacy DB execution path**:
  - Conditional `is_active -> isActive` rename (`20261126140000:16-27`) checks `information_schema.columns` in `current_schema()` so both `is_active` exists and `isActive` does not exist before renaming.
  - Orphan pre-check (`20261126140000:55-79`) aborts the entire migration transaction cleanly with diagnostic counts (`bookings.host_id=%`, `parking_spaces.region_id=%`, `payments.payout_id=%`) and references [`infra/prisma/scripts/reconcile_legacy_dev_data.sql`](../../infra/prisma/scripts/reconcile_legacy_dev_data.sql) without silently mutating or deleting rows.

---

## 3. Classified Findings (`P0` / `P1` / `P2` / `P3`)

### P0 — Critical Defects & Open Release Gates
**Code/Migration P0 Defects: `0`**  
No P0 defects were found in `schema.prisma`, `20260625230621_public/migration.sql`, `20261126140000_eng_d02_reconcile_integrity/migration.sql`, or `.gitignore`.

**Operational Release Gates (Must Complete Before Merge / Production Deploy):**
1. **Uncommitted Migration & Script Files in Working Tree (`git status`)**: `infra/prisma/migrations/20261126140000_eng_d02_reconcile_integrity/migration.sql`, `infra/prisma/scripts/reconcile_legacy_dev_data.sql`, and `infra/prisma/seed-fixtures.ts` are currently untracked (`??`), while `0001_init.sql` deletion is staged (`D`) and `infra/prisma/schema.prisma`/`.gitignore` edits are unstaged (`M`). Pushing without staging all untracked migration artifacts would break CI migration verification.
2. **Unexecuted Live PostgreSQL Checks ([`ENG-D02_DATABASE_REPORT.md:96-105`](../ENG-D02_DATABASE_REPORT.md#L96-L105))**: Live `prisma migrate deploy`, `prisma migrate diff --from-migrations ... --shadow-database-url ... --exit-code` ([`.github/workflows/ci.yml:130`](../../.github/workflows/ci.yml#L130)), repeatable `seed.ts` runs, and read-only inspection of the pre-existing `parkly_postgres_data` Docker volume remain blocked/unverified until Docker PostgreSQL is running.

---

### P1 — High Severity (5 Findings)

#### `[P1-1]` `bookingService.createBooking` Trusts Caller `hostId` Without Verification & Exposes Unhandled `P2003` (`500`)
- **Locations**: [`services/booking-service/src/services/bookingService.ts:53-91`](../../services/booking-service/src/services/bookingService.ts#L53-L91), [`services/booking-service/src/routes/booking.ts:16-48`](../../services/booking-service/src/routes/booking.ts#L16-L48), [`shared/src/middleware/errorHandler.ts:20-57`](../../shared/src/middleware/errorHandler.ts#L20-L57)
- **Evidence & Impact**:
  - `createBooking` accepts `input.hostId` directly from the request payload (`booking.ts:19,41`) and inserts into `bookings` (`bookingService.ts:73-90`) without querying `ParkingSpace`, `Host`, `Vehicle`, or `User` first.
  - Now that `20261126140000_eng_d02_reconcile_integrity/migration.sql:87-90` enforces `bookings_host_id_fkey`, any nonexistent `hostId` (or `spaceId`/`vehicleId`/`userId`) throws Prisma `P2003` (SQLSTATE `23503`). Because `errorHandler.ts:20-57` only handles `ParklyError` subclasses, Prisma FK errors fall through as **HTTP `500 INTERNAL_ERROR`**.
  - Worse, if a caller supplies a valid UUID of Host B while booking a space owned by Host A, PostgreSQL accepts both FKs and persists mismatched `Booking.hostId != ParkingSpace.hostId`, corrupting host-booking ownership and breaking [`anonymizeService.ts:53-62`](../../services/admin-service/src/services/anonymizeService.ts#L53-L62) (`where: { hostId: user.host.id }`).
- **Recommendation**: Inside `createBooking`'s transaction (coordinated with `ENG-D04`), fetch `ParkingSpace` (`status === 'active'`), derive/assert `hostId === space.hostId`, verify `Vehicle` ownership (`vehicle.userId === input.userId && !vehicle.deletedAt`) and `User`/`Host` active non-deleted status, and map missing entities to `NotFoundError` / `ValidationError`.

#### `[P1-2]` `payment-service` Lacks Pre-Validation (`P2003`/`P2002` -> `500`) and Mutates `Payment` + `Booking` Non-Transactionally
- **Locations**: [`services/payment-service/src/index.ts:236-288`](../../services/payment-service/src/index.ts#L236-L288), [`services/payment-service/src/index.ts:324-355`](../../services/payment-service/src/index.ts#L324-L355), [`infra/prisma/schema.prisma:238,255`](../../infra/prisma/schema.prisma#L238), [`shared/src/middleware/errorHandler.ts:20-57`](../../shared/src/middleware/errorHandler.ts#L20-L57)
- **Evidence & Impact**:
  - `initiatePayment` (`index.ts:236-255`) invokes `provider.createOrder()` **before** verifying that `bookingId` exists, belongs to `userId`, is in `'created'` status, or lacks an existing `Payment` row (`payments_booking_id_key` is `@unique` at `schema.prisma:238`). Nonexistent `bookingId` or duplicate initiation hits Prisma `P2003`/`P2002` after creating a live gateway order and returns **HTTP `500`**.
  - `confirmPayment` (`index.ts:268-285`) updates `prisma.payment`, publishes `PaymentCompleted` (`line 273`), and only then updates `prisma.booking` (`line 282`) **without `prisma.$transaction`**. `handleWebhookCapture` (`index.ts:335-343`) also updates `payment` and `booking` in separate statements. A failure between updates leaves `Payment.status = 'completed'` while `Booking.status` stays `'created'`.
- **Recommendation**: Validate `Booking` state/ownership and existing payment before calling `provider.createOrder()`, wrap `payment.update` + `booking.update` inside `prisma.$transaction`, and emit `PaymentCompleted` after transaction commit.

#### `[P1-3]` `payment-service.refundPayment` Does Not Sync `Booking.status = 'refunded'` and Lacks Payload/Null Guards
- **Locations**: [`services/payment-service/src/index.ts:290-318`](../../services/payment-service/src/index.ts#L290-L318), [`services/payment-service/src/index.ts:432-439`](../../services/payment-service/src/index.ts#L432-L439), [`infra/prisma/schema.prisma:232`](../../infra/prisma/schema.prisma#L232)
- **Evidence & Impact**:
  - `refundPayment` (`index.ts:299-317`) sets `Payment.status = 'refunded'` but never updates `Booking.status = 'refunded'` (leaving `BookingStatus.refunded` in `schema.prisma:232` unused by any service).
  - Route `PUT /payments/:id/refund` (`index.ts:434`) passes unvalidated `req.body.amount` (allowing non-numeric/negative/`> payment.amount` values) and `refundPayment` passes `payment.providerPaymentId!` (`line 297`) without checking for `null`.
- **Recommendation**: Validate refund amount with Zod, require non-null `providerPaymentId`, and atomically update `Booking.status = 'refunded'` inside `$transaction` (scoped for `ENG-D04`).

#### `[P1-4]` Unvalidated Enum Query Casts (`UserRole`, `BookingStatus`) Throw Prisma `500`s in `admin-service` and `booking-service`
- **Locations**: [`services/admin-service/src/index.ts:55,141`](../../services/admin-service/src/index.ts#L55), [`services/booking-service/src/routes/booking.ts:62`](../../services/booking-service/src/routes/booking.ts#L62), [`apps/admin-portal/src/hooks/useAdminData.ts:96,133`](../../apps/admin-portal/src/hooks/useAdminData.ts#L96)
- **Evidence & Impact**:
  - `GET /admin/users` (`admin-service/src/index.ts:55`: `role as UserRole`), `GET /admin/bookings` (`admin-service/src/index.ts:141`: `status as BookingStatus`), and `GET /bookings` (`booking.ts:62`: `status as BookingStatus | undefined`) pass unvalidated query strings straight into Prisma `where` filters.
  - Sending `'government'` or `'disputed'` (both present in `apps/admin-portal`) or `'pending'` causes Prisma to throw `PrismaClientValidationError`, which `errorHandler` turns into HTTP `500`.
- **Recommendation**: Validate optional `role` and `status` query params with Zod (`z.nativeEnum(...)` or explicit enum arrays) and return `400 ValidationError` on unsupported values.

#### `[P1-5]` Production Reference-Data Gap: `regions` Has Zero Rows Unless Dev-Gated `seed.ts` Runs
- **Locations**: [`infra/prisma/seed.ts:132-171`](../../infra/prisma/seed.ts#L132-L171), [`infra/prisma/schema.prisma:138,345-362`](../../infra/prisma/schema.prisma#L138), [`services/host-service/src/index.ts:80-124`](../../services/host-service/src/index.ts#L80-L124)
- **Evidence & Impact**:
  - `20260625230621_public` and `20261126140000_eng_d02_reconcile_integrity` create the `"regions"` table and enforce `parking_spaces_region_id_fkey` (`ON DELETE RESTRICT`), but neither migration inserts any region rows.
  - Meanwhile, [`infra/prisma/seed.ts:132-139`](../../infra/prisma/seed.ts#L132-L139) refuses execution when `NODE_ENV === 'production'` without `ALLOW_PRODUCTION_SEED=true`—and setting `ALLOW_PRODUCTION_SEED=true` also inserts dev admin/host/driver users, vehicle, and `[DEV FIXTURE]` spaces (`lines 175-323`).
  - Therefore, any fresh production database deployed via `npx prisma migrate deploy` starts with an empty `"regions"` table, causing **100% of `POST /host/listings` requests** to fail `resolveRegionForListing` (`host-service/src/index.ts:116-120`) with `ValidationError`.
- **Recommendation**: Separate production-safe reference data (`regions`, global baseline `pricing_rules` if desired) into a dedicated idempotent bootstrap script or forward migration so `regions` is populated without dev user/space fixtures.

---

### P2 — Medium Severity (6 Findings)

#### `[P2-1]` `anonymizeService.ACTIVE_BOOKING_STATUSES` Contains Non-Existent `BookingStatus` Value `'pending'`
- **Location**: [`services/admin-service/src/services/anonymizeService.ts:20,47,60`](../../services/admin-service/src/services/anonymizeService.ts#L20) vs. [`infra/prisma/schema.prisma:226-233`](../../infra/prisma/schema.prisma#L226-L233)
- **Evidence & Impact**: `ACTIVE_BOOKING_STATUSES = ['created', 'pending', 'confirmed', 'active']` includes `'pending'`, which is not a member of `enum BookingStatus` (`created, confirmed, active, completed, cancelled, refunded`). Because lines `47` and `60` filter in JS (`includes(b.status as string)`), it does not throw at runtime today, but refactoring the filter into Prisma `where: { status: { in: ACTIVE_BOOKING_STATUSES } }` would immediately fail with `PrismaClientValidationError`.
- **Recommendation**: Replace `'pending'` with valid `BookingStatus` members via typed `BookingStatus[]` (and align with `held`/`overstay` when `ENG-D04` extends the enum).

#### `[P2-2]` TOCTOU Race Window in `anonymizeUser` Active-Booking Eligibility Checks
- **Location**: [`services/admin-service/src/services/anonymizeService.ts:30-132`](../../services/admin-service/src/services/anonymizeService.ts#L30-L132)
- **Evidence & Impact**: Both active-booking checks (`prisma.user.findUnique` at `lines 30-39` and `prisma.booking.findMany` at `lines 53-58`) execute **before** opening `prisma.$transaction` at `line 80`. A concurrent booking created between `line 64` and `line 80` will succeed while the user/host is anonymized in the subsequent transaction.
- **Recommendation**: Move the active-booking `findFirst`/`count` checks inside `prisma.$transaction` (or lock the `User` row / use `Serializable` isolation).

#### `[P2-3]` Soft-Delete (`deletedAt`) Filtering Is Inconsistent Across Runtime Services
- **Locations**: [`services/booking-service/src/services/bookingService.ts:56,103,118,136,160`](../../services/booking-service/src/services/bookingService.ts#L56), [`services/host-service/src/index.ts:128,196`](../../services/host-service/src/index.ts#L128), [`services/auth-service/src/routes/auth.ts:179-188`](../../services/auth-service/src/routes/auth.ts#L179-L188), [`services/admin-service/src/index.ts:236`](../../services/admin-service/src/index.ts#L236)
- **Evidence & Impact**: `anonymizeUser` sets `deletedAt` on `User`, `Vehicle`, and `Host` (`anonymizeService.ts:92,106,122`) and `anonymizeService` filters `deletedAt: null` on `Booking` (`lines 34,56`). However:
  - `bookingService.ts` never checks `deletedAt: null` on `Booking` (conflict check `line 56`, `getBooking` `line 103`, `listUserBookings` `line 118`).
  - `host-service/src/index.ts` `getOrCreateHost` (`line 128`) and `getHostListings` (`line 196`) do not exclude soft-deleted `Host` records (so a pre-existing unexpired JWT belonging to an anonymized user can still query or create listings).
  - `GET /auth/me` (`auth-service/src/routes/auth.ts:179-188`) returns anonymized/inactive users because it omits `user.isActive` / `deletedAt` checks (unlike `auth.ts:106,150`).
  - `GET /admin/metrics` (`admin-service/src/index.ts:236`) counts anonymized users in `totalUsers`.
- **Recommendation**: Enforce `deletedAt: null` (and `isActive` checks where applicable) consistently across active-user/host/booking queries while keeping admin compliance views explicit.

#### `[P2-4]` `host-service` `listingSchema` Whitespace/Range Gaps & `resolveRegionForListing` Multi-Row `OR` Ordering Risk
- **Location**: [`services/host-service/src/index.ts:59,62,72,103-124`](../../services/host-service/src/index.ts#L59)
- **Evidence & Impact**:
  - `listingSchema` validates `city: z.string().min(1)` (`line 59`) and `regionId: z.string().min(1).max(64).optional()` (`line 62`) without `.trim()`. If `regionId` is explicitly supplied, `city: "   "` passes validation and gets persisted; `maxBookingHours` (`line 72`) has `.max(72)` without `.min(1)` or `maxBookingHours >= minBookingHours`.
  - `resolveRegionForListing` (`lines 103-114`) combines exact `city`, exact `id`, and `startsWith: '${citySlug}-'` in one `OR` clause ordered by `id: 'asc'`. If a sub-region or adjacent slug such as `'chennai-airport'` exists alongside `'chennai-tn-in'` (`city: 'Chennai'`), `orderBy: { id: 'asc' }` selects `'chennai-airport'` instead of the exact `city` match.
- **Recommendation**: Add `.trim().min(1)` and booking-hour refinement to `listingSchema`, and resolve exact `city` / `id` matches before falling back to `startsWith` prefix matching.

#### `[P2-5]` Response Mappers Drop/Hardcode Schema Fields (`payoutId`, `currency`, `provider`, `recurring`) & Residual Denormalized Columns
- **Locations**: [`services/payment-service/src/index.ts:359-378`](../../services/payment-service/src/index.ts#L359-L378), [`services/booking-service/src/services/bookingService.ts:189-209`](../../services/booking-service/src/services/bookingService.ts#L189-L209), [`infra/prisma/schema.prisma:195,251,279`](../../infra/prisma/schema.prisma#L195)
- **Evidence & Impact**:
  - `mapPayment` (`payment-service/src/index.ts:359-378`) omits `payoutId` despite `schema.prisma:251` and `shared/src/types/index.ts:194` defining `payoutId?: string`, and hardcodes `currency: 'INR'` (`line 365`) and `provider: raw['provider'] as 'mock'` (`line 366`).
  - `mapBooking` (`bookingService.ts:189-209`) omits `paymentId` (`schema.prisma:195`) and `recurring` (`recurringFrequency`/`recurringEndDate`), and hardcodes `currency: 'INR'` (`line 202`).
  - `Booking.paymentId` (`schema.prisma:195`) and `Payout.paymentIds` (`schema.prisma:279`) remain unconstrained denormalized scalar/array columns alongside the canonical `Payment.bookingId` and `Payment.payoutId` FKs (and no service currently writes `Payout` or `Payment.payoutId`).
- **Recommendation**: Map `payoutId`, `paymentId`, `recurring`, and persisted `currency`/`provider` accurately in mappers, and schedule removal/reconciliation of `Payout.paymentIds` and `Booking.paymentId` in Stage E ledger work.

#### `[P2-6]` Legacy `0001_init.sql` Baseline Requirement & Un-Guarded Section 5 FK Statements in `20261126140000`
- **Locations**: [`infra/prisma/migrations/20261126140000_eng_d02_reconcile_integrity/migration.sql:16-27,82-95`](../../infra/prisma/migrations/20261126140000_eng_d02_reconcile_integrity/migration.sql#L16-L27), [`docs/engineering/ENG-D02_DATABASE_REPORT.md:109-117`](../ENG-D02_DATABASE_REPORT.md#L109-L117)
- **Evidence & Impact**:
  - While `20261126140000` safely handles `users.is_active -> isActive`, any legacy database originally created by executing `0001_init.sql` outside Prisma Migrate has no `20260625230621_public` row in `_prisma_migrations`. Running `npx prisma migrate deploy` directly will fail (`P3005` or `type "UserRole" already exists`) unless an operator first baselines `npx prisma migrate resolve --applied 20260625230621_public --schema=infra/prisma/schema.prisma`. Neither the migration header nor `ENG-D02_DATABASE_REPORT.md:109-117` documents this baseline step.
  - Additionally, Sections 1–3 of `20261126140000` use idempotent guards (`IF EXISTS`, `IF NOT EXISTS`), whereas Section 5 (`lines 82-95`) runs unconditional `ALTER TABLE ... ADD CONSTRAINT`, which would fail (safely rolling back) on a manually hotfixed DB where one of those 3 FK names already existed.
- **Recommendation**: Document the `prisma migrate resolve --applied 20260625230621_public` baseline instruction for `0001_init.sql` databases in the operator runbook/report.

---

### P3 — Low Severity / Hygiene (5 Findings)

1. **`[P3-1]` Missing Index on `payments.provider_order_id`** ([`infra/prisma/schema.prisma:244`](../../infra/prisma/schema.prisma#L244), [`services/payment-service/src/index.ts:325`](../../services/payment-service/src/index.ts#L325)): `handleWebhookCapture` looks up `prisma.payment.findFirst({ where: { providerOrderId: orderId } })`, scanning `payments` sequentially because `provider_order_id` is unindexed (and non-unique).
2. **`[P3-2]` Geohash Precision & `mapSpace` Field Hardcoding in `host-service`** ([`services/host-service/src/index.ts:140,240,245`](../../services/host-service/src/index.ts#L140), [`infra/prisma/seed.ts:261`](../../infra/prisma/seed.ts#L261), [`services/search-service/src/services/searchService.ts:30,84`](../../services/search-service/src/services/searchService.ts#L30)): `host-service` encodes 7-char geohashes while `seed.ts` and `searchService.ts` standardize on 6-char geohashes (`startsWith` 4/5-char prefilter still matches both); `mapSpace` hardcodes `currency: 'INR'` and `availabilitySchedule: []` (`getHostListings` omits `include: { availabilitySlots: true }`).
3. **`[P3-3]` Residual Root Rule `/prisma/migrations/` in `.gitignore`** ([`.gitignore:42-43`](../../.gitignore#L42-L43)): No root `/prisma/` directory exists; harmless, and `infra/prisma/migrations/` is confirmed tracked.
4. **`[P3-4]` `@parkly/prisma` Workspace Exclusion & Caret Version Ranges** ([`package.json:6-13,52,55`](../../package.json#L6-L13), [`infra/prisma/package.json:2,16,19`](../../infra/prisma/package.json#L2), `services/*/package.json`): `@parkly/prisma` is not listed in root `workspaces`, and packages specify `^5.16.0` / `^5.16.1` (all currently hoisted to `5.22.0` via `package-lock.json`).
5. **`[P3-5]` `prisma validate` Requires `DATABASE_URL` Env Var** ([`infra/prisma/schema.prisma:11`](../../infra/prisma/schema.prisma#L11)): Fails with `P1012` when `DATABASE_URL` is unset locally; CI ([`.github/workflows/ci.yml:124-125`](../../.github/workflows/ci.yml#L124-L125)) already injects `DATABASE_URL`.

---

## 4. Service-by-Service Alignment Summary (Scope 5)

| Service File | Aligned Operations | Confirmed Gaps / Citations |
| :--- | :--- | :--- |
| [`services/host-service/src/index.ts`](../../services/host-service/src/index.ts) | `resolveRegionForListing` (`lines 80-124`) queries `Region` (`id`, `city`, `isActive`) and fails closed with `ValidationError` before `parking_spaces_region_id_fkey` (`23503`). `createListing` & `ai-verify` align with `ParkingSpace`, `AvailabilitySlot`, `Host`, and enums. | `P1-5` (empty `regions` in prod), `P2-3` (no `Host.deletedAt` filter), `P2-4` (`city`/`regionId` trim & multi-region `OR` sort), `P3-2` (geohash 7 vs 6 & `mapSpace`). |
| [`services/admin-service/src/services/anonymizeService.ts`](../../services/admin-service/src/services/anonymizeService.ts) & [`index.ts`](../../services/admin-service/src/index.ts) | `anonymizeUser` writes `isActive: false`, `isAnonymized`, `anonymizedAt`, `deletedAt` on `User`/`Vehicle`/`Host`, preserves `Host.totalEarnings`/`totalPayouts`, queries `Booking` using `bookings_host_id_idx` + `bookings_deleted_at_idx`, and unblocks `GET /admin/users` (`index.ts:62-73`). | `P1-4` (unvalidated `role`/`status` casts in `index.ts:55,141`), `P2-1` (`'pending'` in `ACTIVE_BOOKING_STATUSES`), `P2-2` (TOCTOU outside `$transaction`), `P2-3` (`GET /admin/metrics` counts soft-deleted users). |
| [`services/booking-service/src/services/bookingService.ts`](../../services/booking-service/src/services/bookingService.ts) & [`routes/booking.ts`](../../services/booking-service/src/routes/booking.ts) | Core CRUD columns (`userId`, `spaceId`, `vehicleId`, `hostId`, `type`, `status`, timestamps, `totalAmount`) match `Booking` model; `BookingStatus` values used in `create`/`cancel`/`complete` exist in schema. | `P1-1` (unverified `hostId` / `P2003` -> `500` & cross-host spoofing), `P1-4` (unvalidated `status` query in `routes/booking.ts:62`), `P2-3` (missing `deletedAt: null`), `P2-5` (`mapBooking` drops `paymentId`/`recurring`, hardcodes `currency`). |
| [`services/payment-service/src/index.ts`](../../services/payment-service/src/index.ts) | `Payment` creation/confirmation/refund/webhook columns match `Payment` model; `confirmPayment` & `handleWebhookCapture` update `Booking.status = 'confirmed'` and `Booking.paymentId`. | `P1-2` (missing booking pre-check & non-transactional updates), `P1-3` (`refundPayment` doesn't set `Booking.status = 'refunded'` / unvalidated amount), `P2-5` (`mapPayment` omits `payoutId`), `P3-1` (unindexed `providerOrderId`). |
