# `ENG-D02` Agent B Audit — Seed, Data Integrity & Legacy Compatibility

**Auditor**: Agent B (`seed-auditor`)  
**Repository**: `e:\Github\Parkly` (branch: `fix/stage-d-p0-restoration`)  
**Mode**: Strict read-only inspection (no source, migration, seed, SQL, or test files modified; no live database executed)  
**Date**: 2026-11-26

---

## 1. Executive Verdict & Finding Counts

The `ENG-D02` seed and legacy-reconciliation changes cleanly replace non-UUID dev fixtures (`sp-tng-001`, `*-day-*`, `rule-peak-hours`, etc.) with 39 deterministic RFC4122 v4 UUIDs in [`infra/prisma/seed-fixtures.ts`](../../../infra/prisma/seed-fixtures.ts) and [`infra/prisma/seed.ts`](../../../infra/prisma/seed.ts), preserve `'chennai-tn-in'`, enforce a `NODE_ENV=production` guard, avoid duplicating or silently rewriting legacy fixtures, and isolate legacy conversion into an opt-in transaction in [`infra/prisma/scripts/reconcile_legacy_dev_data.sql`](../../../infra/prisma/scripts/reconcile_legacy_dev_data.sql).

### Classification Summary (In-Scope `ENG-D02` Deliverables)

| Severity | Count | Summary |
| :--- | :---: | :--- |
| **P0 (Critical)** | **0** | No critical defects inside `seed.ts`, `seed-fixtures.ts`, `reconcile_legacy_dev_data.sql`, or `regionResolution.test.ts`. *(See Section 8 for out-of-scope `ENG-D05` mobile runtime string-ID blockers.)* |
| **P1 (High)** | **0** | No silent data loss, broken FK seeding order, or production-seed guard bypasses found. |
| **P2 (Medium)** | **4** | `availability_slots` rewrite in `reconcile_legacy_dev_data.sql` lacks collision & `day_of_week` guards; `regionResolution.test.ts` doesn't actually test double-run repeatability or `NODE_ENV=production` guard; `npm run seed` / `scripts/local-seed.*` require pre-built `shared/dist`; cross-boundary `apps/mobile` (`ENG-D05`) & `search-service` concierge mock (`ENG-F04`) still emit non-UUID IDs. |
| **P3 (Low)** | **4** | Edge cases on anonymized/email-colliding dev users in `seed.ts`; Step 1/Step 2 diagnostics (`b.host_id <> ps.host_id`, non-UUID checks outside `parking_spaces`, `payments.payout_id` manual fix, legacy `User`/`Host`/`Vehicle` UUID retention); regex/runtime guard & test assertion looseness; global `PricingRule` vs `pricing-service` behavior & `LEGACY_PRICING_RULE_MAP` scoping. |

---

## 2. Deterministic UUID & Region Verification (`seed-fixtures.ts` & `schema.prisma`)

### Observed Verification Checks (Read-Only Node / TypeScript / Jest)

1. **All 39 Deterministic UUIDs Verified RFC4122 v4 & Zod-Compatible**:
   - Prefix: `DEV_FIXTURE_PREFIX = '00000000-0000-4000-8000-'` ([`infra/prisma/seed-fixtures.ts:7`](../../../infra/prisma/seed-fixtures.ts#L7)) sets RFC4122 version nibble `4` and variant nibble `8` (`[89ab]`).
   - Verified via standalone read-only Node execution against `seed-fixtures.ts` (`39/39` unique, `0` failures) against:
     - `RFC4122_UUID_REGEX` (`/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i` at [`seed-fixtures.ts:53-54`](../../../infra/prisma/seed-fixtures.ts#L53-L54))
     - Strict v4 pattern (`/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i`)
     - `zod@3.23.8` `z.string().uuid()` (matching [`services/booking-service/src/routes/booking.ts:17-19`](../../../services/booking-service/src/routes/booking.ts#L17-L19) and [`services/payment-service/src/index.ts:388`](../../../services/payment-service/src/index.ts#L388))
   - Complete entity inventory verified:
     - `SEED_USER_IDS`: `ADMIN` (`...0001`), `HOST` (`...0002`), `DRIVER` (`...0003`) ([`seed-fixtures.ts:13-17`](../../../infra/prisma/seed-fixtures.ts#L13-L17))
     - `SEED_HOST_IDS`: `KUMAR_PARKING` (`...0101`) ([`seed-fixtures.ts:19-21`](../../../infra/prisma/seed-fixtures.ts#L19-L21))
     - `SEED_VEHICLE_IDS`: `TN01AB1234` (`...0201`) ([`seed-fixtures.ts:23-25`](../../../infra/prisma/seed-fixtures.ts#L23-L25))
     - `SEED_SPACE_IDS`: `TNAGAR_SPOT_A` (`...1001`), `TNAGAR_SPOT_B` (`...1002`), `ADYAR_SMART_PARK` (`...1003`), `VELACHERY_EV_HUB` (`...1004`) ([`seed-fixtures.ts:27-32`](../../../infra/prisma/seed-fixtures.ts#L27-L32))
     - `getSeedSlotId(1..4, 0..6)`: `28` deterministic slot UUIDs `...2100`–`...2106`, `...2200`–`...2206`, `...2300`–`...2306`, `...2400`–`...2406` ([`seed-fixtures.ts:46-51`](../../../infra/prisma/seed-fixtures.ts#L46-L51))
     - `SEED_PRICING_RULE_IDS`: `PEAK_HOURS` (`...3001`), `WEEKEND_PREMIUM` (`...3002`) ([`seed-fixtures.ts:41-44`](../../../infra/prisma/seed-fixtures.ts#L41-L44))
2. **Canonical Region ID Preserved**:
   - `SEED_REGIONS.CHENNAI` remains `'chennai-tn-in'` ([`seed-fixtures.ts:9-11`](../../../infra/prisma/seed-fixtures.ts#L9-L11)), matching `Region.id String @id` ([`infra/prisma/schema.prisma:346`](../../../infra/prisma/schema.prisma#L346)) and `host-service` `listingSchema` (`regionId: z.string().min(1).max(64).optional()` at [`services/host-service/src/index.ts:62`](../../../services/host-service/src/index.ts#L62)).
3. **Static Typecheck of Seed Modules**:
   - Executed `node ./node_modules/typescript/bin/tsc --noEmit --target ES2022 --module CommonJS --moduleResolution node --esModuleInterop --strict --skipLibCheck infra/prisma/seed.ts infra/prisma/seed-fixtures.ts` -> exit `0` (0 errors).

---

## 3. FK Relationships, Ordinals, Idempotency & Legacy Behavior (`seed.ts`)

### Verified Foreign-Key Creation Order & Wiring

| Step | Entity | Upsert Key (`where`) | FK Target Verified | Source Citation |
| :---: | :--- | :--- | :--- | :--- |
| 1 | `Region` | `id: 'chennai-tn-in'` | Root lookup table (`regions.id`) | [`seed.ts:148-171`](../../../infra/prisma/seed.ts#L148-L171) |
| 2 | `User` (Admin) | `phone: '+919999999999'` | Root user (`users.id`) | [`seed.ts:175-186`](../../../infra/prisma/seed.ts#L175-L186) |
| 3 | `User` (Host) | `phone: '+919876543210'` | Root user (`users.id`) | [`seed.ts:190-201`](../../../infra/prisma/seed.ts#L190-L201) |
| 4 | `Host` | `userId: hostUser.id` | `hosts.user_id -> users.id` (`schema.prisma:89`) | [`seed.ts:203-213`](../../../infra/prisma/seed.ts#L203-L213) |
| 5 | `User` (Driver) | `phone: '+919876543211'` | Root user (`users.id`) | [`seed.ts:217-227`](../../../infra/prisma/seed.ts#L217-L227) |
| 6 | `Vehicle` | `licensePlate: 'TN01AB1234'` | `vehicles.user_id -> users.id` (`schema.prisma:56`) | [`seed.ts:229-242`](../../../infra/prisma/seed.ts#L229-L242) |
| 7 | `ParkingSpace` (x4) | `id: spaceData.id` | `hostId: host.id` (`schema.prisma:137`), `regionId: chennaiRegion.id` (`schema.prisma:138`) | [`seed.ts:262-301`](../../../infra/prisma/seed.ts#L262-L301) |
| 8 | `AvailabilitySlot` (x28) | `id: getSeedSlotId(ordinal, day)` | `spaceId: space.id` (`schema.prisma:174`) | [`seed.ts:303-321`](../../../infra/prisma/seed.ts#L303-L321) |
| 9 | `PricingRule` (x2) | `id: rule.id` | `spaceId` omitted (`null` = global, `schema.prisma:300`) | [`seed.ts:355-368`](../../../infra/prisma/seed.ts#L355-L368) |

### Verified Ordinals, Repeatability & Legacy Non-Duplication

- **Availability-slot ordinals**: `DEV_SPACES` assigns unique ordinals `1 | 2 | 3 | 4` ([`seed.ts:54,73,92,111`](../../../infra/prisma/seed.ts#L54)) mapped consistently to legacy IDs (`sp-tng-001` -> `1`/`1001`, `sp-tng-002` -> `2`/`1002`, `sp-adyar-001` -> `3`/`1003`, `sp-vel-001` -> `4`/`1004`). For each non-skipped space, `day` iterates `0..6` ([`seed.ts:303`](../../../infra/prisma/seed.ts#L303)), creating 7 slots per space (`28` total).
- **Spatial index alignment**: [`seed.ts:261`](../../../infra/prisma/seed.ts#L261) dynamically computes precision-6 geohashes via `encodeGeohash(...)`. Verified against `shared/dist`: `(13.0418, 80.2341) -> 'tf341y'`, `(13.0420, 80.2345) -> 'tf341y'`, `(13.0067, 80.2566) -> 'tf31fr'`, `(12.9791, 80.2204) -> 'tf31c6'`, all matching `chennaiRegion.geohashPrefixes: ['tf', 'tg']` ([`seed.ts:167`](../../../infra/prisma/seed.ts#L167)) and repairing stale hardcoded `'tge27'`/`'tge0e'`/`'tge08'` prefixes from the pre-`ENG-D02` seed.
- **Repeatability on clean/re-seeded DB**:
  - `User`, `Host`, `Vehicle` upserts use `update: {}`, preserving existing IDs (important when a legacy DB created `User`/`Host`/`Vehicle` with `@default(uuid())`) and user mutations.
  - `Region` updates metadata/active flag (`name`, `country`, `state`, `city`, `isActive: true`); `ParkingSpace` updates `geohash`, `latitude`, `longitude`, `regionId`, `status`; `AvailabilitySlot` updates `spaceId`, `dayOfWeek`, `startTime`, `endTime`; `PricingRule` updates `name`, `multiplier`, `isActive`.
- **Legacy ID non-duplication & non-rewriting**:
  - [`seed.ts:246-259`](../../../infra/prisma/seed.ts#L246-L259) checks `LEGACY_DEV_SPACE_ID_MAP` keys (`sp-tng-001`, `sp-tng-002`, `sp-adyar-001`, `sp-vel-001`). When a legacy row exists, `seed.ts` logs a warning pointing to `infra/prisma/scripts/reconcile_legacy_dev_data.sql` and executes `continue`, skipping both the `parkingSpace.upsert` and all 7 `availabilitySlot.upsert` calls.
  - [`seed.ts:326-353`](../../../infra/prisma/seed.ts#L326-L353) checks `LEGACY_PRICING_RULE_MAP` keys (`rule-peak-hours`, `rule-weekend`) and skips duplicating them with a warning.

---

## 4. `NODE_ENV=production` Guard & Dev-Fixture Labeling

- **Safety guard verified**: [`infra/prisma/seed.ts:132-139`](../../../infra/prisma/seed.ts#L132-L139) checks `process.env['NODE_ENV'] === 'production' && process.env['ALLOW_PRODUCTION_SEED'] !== 'true'` **before** `new PrismaClient()` is constructed ([`seed.ts:141`](../../../infra/prisma/seed.ts#L141)), throwing immediately without opening a database connection.
- **Dev-fixture labeling verified**:
  - File headers ([`seed.ts:2`](../../../infra/prisma/seed.ts#L2), [`seed-fixtures.ts:2-4`](../../../infra/prisma/seed-fixtures.ts#L2-L4))
  - UUID namespace `00000000-0000-4000-8000-...` ([`seed-fixtures.ts:7`](../../../infra/prisma/seed-fixtures.ts#L7))
  - User names `'Parkly Admin (Dev)'`, `'Ravi Kumar (Dev Host)'`, `'Arjun Kumar (Dev Driver)'` ([`seed.ts:181,196,223`](../../../infra/prisma/seed.ts#L181))
  - Host `businessName`: `'Kumar Parking Solutions [DEV FIXTURE]'` ([`seed.ts:209`](../../../infra/prisma/seed.ts#L209))
  - All 4 space descriptions prefixed with `'[DEV FIXTURE]'` ([`seed.ts:58,77,96,115`](../../../infra/prisma/seed.ts#L58))

---

## 5. Thorough Audit of `reconcile_legacy_dev_data.sql`

### Step 1 (`lines 15-49`) — Read-Only Inspection
- All 5 queries (`1a`–`1e`) are strictly read-only `SELECT` statements.
- `1a` ([`reconcile_legacy_dev_data.sql:15-26`](../../../infra/prisma/scripts/reconcile_legacy_dev_data.sql#L15-L26)) inspects legacy space IDs and any `parking_spaces.id` failing RFC4122 regex (`!~*`), counting child `bookings`, `availability_slots`, and `pricing_rules`.
- `1b`–`1d` ([`lines 28-43`](../../../infra/prisma/scripts/reconcile_legacy_dev_data.sql#L28-L43)) match the exact 3 orphan conditions checked by [`20261126140000_eng_d02_reconcile_integrity/migration.sql:61-72`](../../../infra/prisma/migrations/20261126140000_eng_d02_reconcile_integrity/migration.sql#L61-L72) (`parking_spaces.region_id`, `bookings.host_id`, `payments.payout_id`).
- `1e` ([`lines 45-48`](../../../infra/prisma/scripts/reconcile_legacy_dev_data.sql#L45-L48)) lists legacy pricing rules (`rule-peak-hours`, `rule-weekend`).

### Step 2 (`lines 56-125`) — Explicit Opt-In Transaction & `ON UPDATE CASCADE`
- Safely wrapped in a commented-out `/* BEGIN; ... COMMIT; */` block ([`lines 56-125`](../../../infra/prisma/scripts/reconcile_legacy_dev_data.sql#L56-L125)) with `pg_dump` backup instructions ([`line 53`](../../../infra/prisma/scripts/reconcile_legacy_dev_data.sql#L53)).
- **Region upsert + slug mapping (`lines 59-76`)**: Inserts `'chennai-tn-in'` across all 12 `regions` columns matching [`20260625230621_public/migration.sql:221-236`](../../../infra/prisma/migrations/20260625230621_public/migration.sql#L221-L236) with `ON CONFLICT ("id") DO NOTHING`, then maps `parking_spaces.region_id = 'chennai'` -> `'chennai-tn-in'`.
- **Booking `host_id` backfill (`lines 78-84`)**: Joins `bookings` to `parking_spaces` and updates `b.host_id = ps.host_id` only when `b.host_id` does not exist in `hosts` AND `ps.host_id` exists in `hosts` — cleanly guarding against NULL or invalid `parking_spaces.host_id`.
- **FK `ON UPDATE CASCADE` behavior (`lines 86-102`)**:
  - Verified in both [`20260625230621_public/migration.sql:296,302,314`](../../../infra/prisma/migrations/20260625230621_public/migration.sql#L296) and [`20261126140000_eng_d02_reconcile_integrity/migration.sql:85,90,95`](../../../infra/prisma/migrations/20261126140000_eng_d02_reconcile_integrity/migration.sql#L85) (and historical `0001_init.sql`):
    - `bookings.space_id -> parking_spaces(id)`: `ON DELETE RESTRICT ON UPDATE CASCADE`
    - `availability_slots.space_id -> parking_spaces(id)`: `ON DELETE CASCADE ON UPDATE CASCADE`
    - `pricing_rules.space_id -> parking_spaces(id)`: `ON DELETE SET NULL ON UPDATE CASCADE`
    - `bookings.host_id -> hosts(id)`: `ON DELETE RESTRICT ON UPDATE CASCADE`
    - `parking_spaces.region_id -> regions(id)`: `ON DELETE RESTRICT ON UPDATE CASCADE`
  - Updating `parking_spaces.id` in [`lines 88-102`](../../../infra/prisma/scripts/reconcile_legacy_dev_data.sql#L88-L102) cascades cleanly to `bookings.space_id`, `availability_slots.space_id`, and `pricing_rules.space_id`, and guards each `UPDATE` with `AND NOT EXISTS (SELECT 1 FROM "parking_spaces" WHERE "id" = ...)` so mixed legacy+UUID rows do not collide on `parking_spaces_pkey`.
  - Same `NOT EXISTS` collision guard is present on `pricing_rules` ([`lines 116-122`](../../../infra/prisma/scripts/reconcile_legacy_dev_data.sql#L116-L122)), **but missing on `availability_slots` (`lines 105-113`)** (see Finding `P2-1`).

---

## 6. Classified Findings (`P0`–`P3`)

### P2 Findings (Medium)

#### `P2-1` — Missing Collision & Range Guards on `availability_slots` Conversion in `reconcile_legacy_dev_data.sql`
- **Location**: [`infra/prisma/scripts/reconcile_legacy_dev_data.sql:104-113`](../../../infra/prisma/scripts/reconcile_legacy_dev_data.sql#L104-L113)
- **Evidence**:
  ```sql
  UPDATE "availability_slots"
  SET "id" = CASE "space_id"
    WHEN '00000000-0000-4000-8000-000000001001' THEN '00000000-0000-4000-8000-00000000210' || "day_of_week"::TEXT
    ...
    ELSE "id"
  END
  WHERE "id" LIKE '%-day-%';
  ```
- **Risk / Edge Case**:
  1. Unlike the `parking_spaces` (`lines 88-102`) and `pricing_rules` (`lines 116-122`) updates, this statement has **no `NOT EXISTS` guard** checking whether target UUID `00000000-0000-4000-8000-000000002{1..4}0{0..6}` already exists (e.g., mixed legacy+UUID DB or duplicate `day_of_week` rows on a space, as `availability_slots` has no `UNIQUE(space_id, day_of_week)` constraint in [`schema.prisma:167-177`](../../../infra/prisma/schema.prisma#L167-L177)). A collision aborts the entire Step 2 transaction with PostgreSQL `23505` (`availability_slots_pkey`).
  2. `day_of_week` is an unconstrained `INTEGER` (`schema.prisma:170`); if any `%-day-%` row on a seeded space had `day_of_week` outside `0..6` (e.g., `-1` or `10`), concatenating `day_of_week::TEXT` produces a malformed non-UUID string (37–38 chars).
  3. `WHERE "id" LIKE '%-day-%'` without `space_id IN (...)` and with `ELSE "id"` rewrites `"id" = "id"` on unrelated spaces' slots.
- **Recommended Fix**: Restrict `WHERE` to `"space_id" IN (...) AND "day_of_week" BETWEEN 0 AND 6`, compute the target ID in a CTE/subquery, and add `AND NOT EXISTS (SELECT 1 FROM "availability_slots" existing WHERE existing."id" = <target_id>)`.

#### `P2-2` — Unit Test Gaps in `regionResolution.test.ts` (Repeatability & Production Guard Untested)
- **Location**: [`services/host-service/src/__tests__/regionResolution.test.ts:95-127`](../../../services/host-service/src/__tests__/regionResolution.test.ts#L95-L127)
- **Evidence**:
  - `npm test -w services/host-service` passes (`6/6` tests), confirming `resolveRegionForListing()` and the UUID array check execute cleanly.
  - However, the test titled `'executes repeatably on clean DB and preserves legacy rows without duplicating them'` (`line 95`) calls `await seedDatabase(mockPrisma)` **only once** (`line 120`) and mocks `parkingSpace.findMany` as `[{ id: 'sp-tng-001' }]` (`line 109`). It never invokes `seedDatabase` twice or tests a clean DB (`findMany` returning `[]`).
  - No test in `regionResolution.test.ts` exercises the `NODE_ENV === 'production'` refusal or `ALLOW_PRODUCTION_SEED=true` override ([`seed.ts:132-139`](../../../infra/prisma/seed.ts#L132-L139)), nor legacy pricing rule skipping (`'rule-peak-hours'`, `'rule-weekend'` at [`seed.ts:326-353`](../../../infra/prisma/seed.ts#L326-L353)).
- **Recommended Fix**: Add unit tests in `regionResolution.test.ts` (or a dedicated Prisma test) covering: (a) clean DB double-invocation (`28` slot upserts per run, `4` space upserts, `2` rule upserts), (b) legacy `pricingRule` skip warnings, and (c) `NODE_ENV=production` throw vs `ALLOW_PRODUCTION_SEED=true` pass.

#### `P2-3` — Seed Scripts Require Pre-Built `@parkly/shared` (`shared/dist`) on Clean Checkouts
- **Location**: [`infra/prisma/seed.ts:15`](../../../infra/prisma/seed.ts#L15), [`package.json:43`](../../../package.json#L43), [`infra/prisma/package.json:10,13`](../../../infra/prisma/package.json#L10), [`scripts/local-seed.ps1:36`](../../../scripts/local-seed.ps1#L36), [`scripts/local-seed.sh:23`](../../../scripts/local-seed.sh#L23)
- **Evidence**:
  - `seed.ts:15` imports `encodeGeohash` from `'@parkly/shared'`.
  - [`shared/package.json:5`](../../../shared/package.json#L5) points `"main"` to `dist/index.js`, and `dist/` is gitignored ([`.gitignore:17`](../../../.gitignore#L17); `git ls-files shared/dist` is empty).
  - [`ci.yml:136`](../../../.github/workflows/ci.yml#L136) explicitly builds `shared` (`npm run build -w shared`) before running `npx ts-node infra/prisma/seed.ts`, whereas `npm run seed`, `scripts/local-seed.ps1`, and `scripts/local-seed.sh` invoke `ts-node` directly without building `@parkly/shared` first. On a fresh clone after `npm ci`, running `npm run seed` or `./scripts/local-seed.sh` before `npm run build` fails with `Cannot find module '@parkly/shared'`.
- **Recommended Fix**: Run `npm run build -w shared` inside `scripts/local-seed.{ps1,sh}` (and document or chain `preseed` in root `package.json`).

#### `P2-4` — Cross-Boundary Runtime String Fixtures in `apps/mobile` (`ENG-D05`) & `search-service` Concierge (`ENG-F04`)
- **Locations**: See full inventory in Section 7 below (`apps/mobile/app/...` and `services/search-service/src/routes/search.ts:85-89` + `packages/ai-agents/src/...`).
- **Evidence**:
  - `apps/mobile` offline/fallback paths still emit `'sp-tng-001'`, `'sp-tng-002'`, `'sp-tng-003'`, `'sp-ana-002'`, `'sp-ady-003'`, `'sp-vel-004'`, `'host-chennai-001'`, `` `veh-${cleanedPlate}` ``, `'usr-demo-001'`, and `'bk-demo-*'`.
  - [`services/search-service/src/routes/search.ts:85-89`](../../../services/search-service/src/routes/search.ts#L85-L89) wires `POST /search/concierge` to `DriverConciergeAgent` + `MockSearchServiceProvider` ([`packages/ai-agents/src/tools/mock-providers/mock-search.provider.ts:12-46`](../../../packages/ai-agents/src/tools/mock-providers/mock-search.provider.ts#L12-L46)), which returns `CHENNAI_LOCATIONS` string IDs (`'spc_tnagar_burkit_01'`, `'spc_tnagar_backup_bay_02'`, `'spc_omr_tidel_01'`) rather than the seeded PostgreSQL UUIDs (`00000000-...-1001..1004`).
  - Any booking attempt using these fallback/mock IDs hits `z.string().uuid()` (`HTTP 400`) in [`services/booking-service/src/routes/booking.ts:17-19`](../../../services/booking-service/src/routes/booking.ts#L17-L19).
- **Scope Boundary**: `apps/mobile` remediation is explicitly deferred to **`ENG-D05`** ([`docs/engineering/08_MIGRATION_ROADMAP.md:32`](../../../docs/engineering/08_MIGRATION_ROADMAP.md#L32), [`ENG-D02_DATABASE_REPORT.md:153`](../ENG-D02_DATABASE_REPORT.md#L153)), and replacing `packages/ai-agents` mock providers with live DB adapters is scoped to **`ENG-F04`** ([`08_MIGRATION_ROADMAP.md:65`](../../../docs/engineering/08_MIGRATION_ROADMAP.md#L65)).

---

### P3 Findings (Low)

#### `P3-1` — `seed.ts` User/Vehicle Upserts Collide on `id` if Dev Fixtures Were Previously Anonymized or Email Reassigned
- **Location**: [`infra/prisma/seed.ts:175-242`](../../../infra/prisma/seed.ts#L175-L242) vs [`services/admin-service/src/services/anonymizeService.ts:87-108`](../../../services/admin-service/src/services/anonymizeService.ts#L87-L108)
- **Evidence**:
  - `anonymizeUser()` rewrites `user.phone` to `'ANON_' + user.id`, sets `email: null`, and rewrites `vehicle.licensePlate` to `'ANON_' + vehicle.id` while preserving the original primary key `id`.
  - If a seeded dev user/vehicle (`SEED_USER_IDS.*`, `SEED_VEHICLE_IDS.TN01AB1234`) is anonymized in a local DB and `seed.ts` is re-run, `where: { phone: ... }` / `where: { licensePlate: ... }` misses the anonymized row and attempts `create: { id: SEED_*_ID }`, failing with `P2002` (`users_pkey` / `vehicles_pkey`). Separately, if another user row holds `'admin@parkly.in'` or `'ravi@example.com'` under a different phone, `create` hits `users_email_key`.

#### `P3-2` — `reconcile_legacy_dev_data.sql` Diagnostic Coverage & Remaining Legacy Edge Cases
- **Location**: [`infra/prisma/scripts/reconcile_legacy_dev_data.sql:25-48,73-84`](../../../infra/prisma/scripts/reconcile_legacy_dev_data.sql#L25-L48)
- **Evidence**:
  1. Query `1c` ([`lines 33-37`](../../../infra/prisma/scripts/reconcile_legacy_dev_data.sql#L33-L37)) inspects only dangling `bookings.host_id` (`NOT EXISTS (SELECT 1 FROM "hosts" h WHERE h."id" = b."host_id")`). It does not flag bookings where `b."host_id"` exists in `"hosts"` yet differs from `ps."host_id"` (`b."host_id" IS DISTINCT FROM ps."host_id"`).
  2. Step 1 applies non-UUID regex checks (`!~*`) only to `parking_spaces.id` (`1a`, [`line 26`](../../../infra/prisma/scripts/reconcile_legacy_dev_data.sql#L26)), not directly to `availability_slots.id` or `pricing_rules.id` (`1e` checks only `'rule-peak-hours'` and `'rule-weekend'`).
  3. Step 2 maps only exact lowercase `region_id = 'chennai'` ([`line 75`](../../../infra/prisma/scripts/reconcile_legacy_dev_data.sql#L75)) and intentionally leaves `payments.payout_id` orphans (from `1d`) and legacy random `User`/`Host`/`Vehicle` UUIDs untouched. Operators seeing rows in `1b` (non-`'chennai'` unknown slugs) or `1d` must reconcile those rows manually before `20261126140000_eng_d02_reconcile_integrity` succeeds.

#### `P3-3` — `RFC4122_UUID_REGEX` Permits v1–v5 & `getSeedSlotId` Lacks Runtime `spaceOrdinal` Check
- **Location**: [`infra/prisma/seed-fixtures.ts:46-54`](../../../infra/prisma/seed-fixtures.ts#L46-L54), [`services/host-service/src/__tests__/regionResolution.test.ts:90-92,112-125`](../../../services/host-service/src/__tests__/regionResolution.test.ts#L90-L92)
- **Evidence**:
  - `RFC4122_UUID_REGEX` uses `[1-5]` rather than strict `4`, though all 39 generated fixture UUIDs strictly use version `4`.
  - `getSeedSlotId(spaceOrdinal, dayOfWeek)` validates `dayOfWeek` (`0..6`) at runtime (`RangeError`), relying on TypeScript's `1 | 2 | 3 | 4` union for `spaceOrdinal`.
  - `regionResolution.test.ts:95-127` does not assert `availabilitySlot.upsert` call count (`21` when `sp-tng-001` is skipped; `28` on clean DB), slot UUIDs, or FK wiring (`host.userId`, `vehicle.userId`, `space.hostId`, `space.regionId`, `slot.spaceId`), and [`services/host-service/tsconfig.json:8`](../../../services/host-service/tsconfig.json#L8) excludes `src/__tests__` from `tsc` compilation.

#### `P3-4` — Minor Seed / Service Alignment Notes (`PricingRule` Scope, Geohash Precision, Production Guard Scope)
- **Location**: [`infra/prisma/seed.ts:27-30,132-135,261,355-368`](../../../infra/prisma/seed.ts#L27-L30)
- **Evidence**:
  - [`seed.ts:355-368`](../../../infra/prisma/seed.ts#L355-L368) seeds global `PricingRule` records (`spaceId: null`), whereas [`services/pricing-service/src/index.ts:65-68`](../../../services/pricing-service/src/index.ts#L65-L68) loads only `include: { pricingRules: { where: { isActive: true } } }` on the `ParkingSpace` relation (ignoring `spaceId IS NULL` global rules — pre-existing behavior carried over from the original seed).
  - [`seed.ts:261`](../../../infra/prisma/seed.ts#L261) encodes precision-6 geohashes while [`services/host-service/src/index.ts:140`](../../../services/host-service/src/index.ts#L140) encodes precision-7; both are compatible with [`services/search-service/src/services/searchService.ts:89-96`](../../../services/search-service/src/services/searchService.ts#L89-L96) (`4`/`5`-char prefix matching).
  - [`seed.ts:132-135`](../../../infra/prisma/seed.ts#L132-L135) guards `NODE_ENV === 'production'`, so invoking `seed.ts` with `NODE_ENV` unset or `'staging'` against a non-local `DATABASE_URL` is not blocked by `seed.ts` alone.
  - `LEGACY_DEV_SPACE_ID_MAP` is exported from [`seed-fixtures.ts:34-39`](../../../infra/prisma/seed-fixtures.ts#L34-L39), while `LEGACY_PRICING_RULE_MAP` is private in [`seed.ts:27-30`](../../../infra/prisma/seed.ts#L27-L30); `seed.ts` only reads `Object.keys(...)` on both maps.

---

## 7. Remaining String Fixture Inventory (`apps/mobile` & `packages/ai-agents`)

### `apps/mobile` (`ENG-D05` Scope Boundary)

| File & Line | String Fixture(s) Observed | Scope / Impact |
| :--- | :--- | :--- |
| [`apps/mobile/app/(auth)/otp.tsx:53`](../../../apps/mobile/app/%28auth%29/otp.tsx#L53) | `'usr-demo-001'` | Offline demo login fallback (`ENG-D05`). |
| [`apps/mobile/app/(tabs)/bookings.tsx:65-66,74-75`](../../../apps/mobile/app/%28tabs%29/bookings.tsx#L65-L75) | `'bk-demo-001'`, `'sp-tng-001'`, `'bk-demo-002'`, `'sp-tng-002'` | Offline demo bookings list (`ENG-D05`). |
| [`apps/mobile/app/(tabs)/concierge.tsx:123,126,160-161,195,197`](../../../apps/mobile/app/%28tabs%29/concierge.tsx#L123-L197) | `'sp-tng-001'`, `'host-chennai-001'` | Fallback `spaceId`/`hostId` passed to `/booking/create` (`ENG-D05`; rejected by `z.string().uuid()`). |
| [`apps/mobile/app/(tabs)/home.tsx:102,111,120`](../../../apps/mobile/app/%28tabs%29/home.tsx#L102-L120) | `'sp-tng-001'`, `'sp-tng-002'`, `'sp-tng-003'` | Offline demo spaces; `'sp-tng-003'` never existed in `seed.ts` (`ENG-D05`). |
| [`apps/mobile/app/(tabs)/map.tsx:12-15`](../../../apps/mobile/app/%28tabs%29/map.tsx#L12-L15) | `'sp-tng-001'`, `'sp-ana-002'`, `'sp-ady-003'`, `'sp-vel-004'` | Fallback markers; last 3 never matched old `seed.ts` IDs (`ENG-D05`). |
| [`apps/mobile/app/booking/[id].tsx:85,102,110`](../../../apps/mobile/app/booking/%5Bid%5D.tsx#L85-L110) | `'sp-tng-001'`, `'veh-'` | Offline booking detail & synthetic plate prefix stripping (`ENG-D05`). |
| [`apps/mobile/app/booking/create.tsx:62-63,70,100,104`](../../../apps/mobile/app/booking/create.tsx#L62-L104) | `` `veh-${cleanedPlate}` ``, `'host-chennai-001'`, `` `bk-${Date.now()}` ``, `` `bk-demo-...` ``, `'sp-tng-001'` | Live `POST /bookings` payload sends synthetic `veh-*` & fallback `'host-chennai-001'` -> `HTTP 400` (`ENG-D05`). |
| [`apps/mobile/app/space/[id].tsx:89-91,94,109`](../../../apps/mobile/app/space/%5Bid%5D.tsx#L89-L109) | `'sp-tng-001'`, `'host-chennai-001'` | Offline space detail & fallback `hostId` (`ENG-D05`). |
| [`apps/mobile/README.md:36`](../../../apps/mobile/README.md#L36) | `'#bk-demo-001'` | Documentation of offline demo mode. |

### `packages/ai-agents` (`ENG-F04` / Unit & E2E Mock Fixture Boundary)

| File & Line | String Fixture(s) Observed | Scope / Impact |
| :--- | :--- | :--- |
| [`packages/ai-agents/src/fixtures/chennai-locations.fixture.ts:21,37,51,67,83`](../../../packages/ai-agents/src/fixtures/chennai-locations.fixture.ts#L21-L83) | `'spc_tnagar_burkit_01'`, `'poi_tnagar_pothys'`, `'spc_annanagar_round_01'`, `'spc_omr_tidel_01'`, `'spc_tnagar_backup_bay_02'` | Used by `MockSearchServiceProvider` (wired into live `POST /search/concierge` at [`search.ts:85-89`](../../../services/search-service/src/routes/search.ts#L85-L89)) & `DriverConciergeAgent` (`driver-concierge.agent.ts:82-103`) -> `ENG-F04`. |
| [`packages/ai-agents/src/fixtures/mock-telemetry.fixture.ts:3,10,17-20,29-32`](../../../packages/ai-agents/src/fixtures/mock-telemetry.fixture.ts#L3-L32) | `'spc_annanagar_round_01'`, `'spc_tnagar_burkit_01'`, `'disp_tnagar_overstay_01'`, `'bk_tnagar_8821'`, `'usr_driver_chennai_09'`, `'usr_host_chennai_01'`, `'disp_anna_damage_02'`, `'bk_anna_9934'`, `'usr_driver_chennai_14'`, `'usr_host_chennai_02'` | Mock telemetry fixtures for agent unit/E2E tests. |
| [`packages/ai-agents/src/agents/dispute-mediation/dispute-mediation.agent.ts:62,72,78`](../../../packages/ai-agents/src/agents/dispute-mediation/dispute-mediation.agent.ts#L62-L78) | `'spc_tnagar_burkit_01'`, `'driver_01'`, `'host_01'` | Hardcoded mock tool IDs inside dispute agent (`ENG-F04`). |
| [`packages/ai-agents/src/saga/workflows/host-onboarding.saga.ts:41`](../../../packages/ai-agents/src/saga/workflows/host-onboarding.saga.ts#L41) | `` `spc_${input.userId}_01` `` | Synthetic space ID in saga workflow (`ENG-F04`). |
| [`packages/ai-agents/src/tools/mock-providers/mock-booking.provider.ts:32`](../../../packages/ai-agents/src/tools/mock-providers/mock-booking.provider.ts#L32) | `` `bk_${randomUUID().substring(0, 8)}` `` | Mock booking ID format (`ENG-F04`). |
| [`packages/ai-agents/tests/unit/tools/real-providers.test.ts:334,358`](../../../packages/ai-agents/tests/unit/tools/real-providers.test.ts#L334-L358) | `'sp-tng-001'`, `'bk_123'` | Self-contained SMS/push notification unit test strings (no DB dependency). |
| [`packages/ai-agents/tests/unit/core/adversarial-m1.spec.ts:316,326`](../../../packages/ai-agents/tests/unit/core/adversarial-m1.spec.ts#L316-L326), [`context.spec.ts:30,120`](../../../packages/ai-agents/tests/unit/core/context.spec.ts#L30-L120), [`tests/e2e/...`](../../../packages/ai-agents/tests/e2e/helpers/e2e-harness.ts#L237-L250), [`tests/integration/multi-agent-sagas.spec.ts:63,76,94`](../../../packages/ai-agents/tests/integration/multi-agent-sagas.spec.ts#L63-L94) | `'sp-101'`, `'user-chennai-99'`, `'chennai-tnagar'`, `'usr_driver_chennai_*'`, `'usr_host_chennai_*'`, `'host_usr_chennai_host_99'`, `cityId: 'chennai'` | Isolated test-harness / logger / telemetry strings (non-DB). |

*(Note: `apps/host-dashboard` and `apps/admin-portal` also retain mock fallback IDs `'sp-001'`, `'usr-001'`, `'b_sample_01'`, etc., explicitly scoped to **`ENG-D06`** per [`08_MIGRATION_ROADMAP.md:33`](../../../docs/engineering/08_MIGRATION_ROADMAP.md#L33).)*

---

## 8. Commands & Checks Executed During This Audit

| Check | Result | Notes |
| :--- | :---: | :--- |
| `npm test -w services/host-service` | **PASS (`6/6`)** | Executed Jest against mocked Prisma (`regionResolution.test.ts`; no live DB touched). |
| Read-only Node UUID/Zod verification of `infra/prisma/seed-fixtures.ts` | **PASS (`39/39`)** | Verified uniqueness (`39`), `RFC4122_UUID_REGEX`, strict v4 regex, `zod@3.23.8` `.uuid()`, and `SEED_REGIONS.CHENNAI === 'chennai-tn-in'`. |
| Read-only Node `encodeGeohash` verification (`shared/dist`) | **PASS** | Verified 4 seeded coords resolve to `'tf341y'`, `'tf341y'`, `'tf31fr'`, `'tf31c6'`. |
| `node ./node_modules/typescript/bin/tsc --noEmit ... infra/prisma/seed.ts infra/prisma/seed-fixtures.ts` | **PASS (`0`)** | Verified strict TS compilation of seed files with 0 errors. |
| Live DB seed execution / `reconcile_legacy_dev_data.sql` execution | **Not Executed** | Intentionally prohibited by read-only audit scope; live Postgres verification remains gated on running Docker/Postgres. |
