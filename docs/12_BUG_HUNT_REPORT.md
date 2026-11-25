# 🐞 Parkly — Full-Stack Bug Hunt & Root-Cause Documentation

> **Audit Scope**: End-to-End UI (`apps/mobile`, `apps/host-dashboard`, `apps/admin-portal`) → API Gateway (`services/api-gateway`) → 11 Microservices (`services/*`) → Shared Libraries & Multi-Agent Core (`shared/`, `packages/ai-agents`) → Database, Containers, IaC & CI (`infra/prisma`, `infra/cdk`, `docker-compose.yml`, `.github/workflows/ci.yml`).  
> **Methodology**: Parallel read-only bug-hunt swarm (`Reproduction & Scope`, `Code Path & Failure Seams`, `Config & Regression Drift`, `Proof & Observability`) backed by local test, typecheck, lint, Prisma, and Android Emulator execution.  
> **Workflow Constraint**: Diagnosis-only documentation pass. Uncommitted edits in [`apps/mobile/app/(tabs)/bookings.tsx`](../apps/mobile/app/%28tabs%29/bookings.tsx) and [`apps/mobile/app/booking/create.tsx`](../apps/mobile/app/booking/create.tsx) pre-dated this bug hunt and are documented under [BUG-09](#bug-09--mobile-infinite-spinner-hardcoded-ip-arrivaltime-400--demo-id-collisions).

---

## Executive Health Matrix

| Layer / Check | Observed Result | Root Blockers |
| :--- | :---: | :--- |
| **Root `npm run lint --workspaces --if-present`** | **FAIL (Exit 1)** | `eslint` not installed; zero ESLint configs exist across 8 lintable packages ([BUG-11](#bug-11--workspace-npm-run-lint-fails-everywhere-missing-eslint)). |
| **AI-Agents `npm run typecheck -w packages/ai-agents`** | **FAIL (47 TS Errors)** | `tsconfig.test.json` violates `noUnusedLocals`/`noUncheckedIndexedAccess` + 2 real type mismatches ([BUG-12](#bug-12--packagesai-agents-47-ts-test-errors--flaky-timeout-race)). |
| **App/Service/CDK `tsc --noEmit`** | **PASS** | All 11 services, `shared`, `host-dashboard`, `admin-portal`, `infra/cdk`, and `apps/mobile` passed `tsc --noEmit`. |
| **Prisma `npx prisma validate`** | **FAIL (`P1012`)** | Fails without `DATABASE_URL` exported; `prisma migrate diff` fails without `--shadow-database-url`; schema drifted from migrations ([BUG-04](#bug-04--prisma-schema-vs-migrations-drift--broken-ci-migration-diff)). |
| **Jest (`shared` & 7 services)** | **PASS w/ Warnings** | `api-gateway` & `booking-service` leak open handles; `admin-service` logs `JWT_ACCESS_SECRET` EventBridge failure; 4 services have 0 tests ([BUG-08](#bug-08--monolithic-getconfig-jwt-coupling--unguarded-publishevent-500s), [BUG-13](#bug-13--jest-open-handle-leaks-wrong-service-logs--no-op-otel), [BUG-14](#bug-14--zero-tests-in-4-services--all-3-uis-plus-broken-auth-service-scripts)). |
| **Vitest (`packages/ai-agents`)** | **24 files · 360 tests** | Passes standalone, can flake on `adversarial.spec.ts:247` under parallel `forks` load due to `timer.unref()` ([BUG-12](#bug-12--packagesai-agents-47-ts-test-errors--flaky-timeout-race)). |
| **Mobile `expo export` (`apps/mobile`)** | **PASS (Stalls >170s)** | Bundles 3 platforms (`android`/`ios`/`web`) while traversing recursive `"parkly": "file:../.."` junction ([BUG-15](#bug-15--mobile-recursive-junction-dependency-splits--workspace-exclusion)). |
| **Live End-to-End UI → Backend Flows** | **BROKEN** | Auth response parsing, route mismatches, missing endpoints, UUID vs seed ID mismatches, and unguarded EventBridge publishes ([BUG-01](#bug-01--live-booking-contract-uuid-mismatch--state-transition-deadlock), [BUG-02](#bug-02--gateway-vs-downstream-auth-middleware--route-mismatches), [BUG-03](#bug-03--web-portals-auth-failure-crashes-prisma-500s--ai-schema-mismatches)). |

---

## Severity Index

| ID | Priority | Category | Title | Confidence |
| :--- | :---: | :--- | :--- | :---: |
| [BUG-01](#bug-01--live-booking-contract-uuid-mismatch--state-transition-deadlock) | **P0** | Cross-Stack Seam | Live booking creation fails UUID/FK validation, misparses API response, skips payment confirm, and deadlocks state machine | High |
| [BUG-02](#bug-02--gateway-vs-downstream-auth-middleware--route-mismatches) | **P0** | API Gateway / Auth | Gateway public routes require JWT downstream (`401`); `/occupancy/simulate` lacks `authenticate` (`401`); `/notifications/devices` missing (`404`) | High |
| [BUG-03](#bug-03--web-portals-auth-failure-crashes-prisma-500s--ai-schema-mismatches) | **P0** | Web UIs (`host`/`admin`) | Auth response mismatch + missing `/login`, `b.driverId` TypeError crash, Prisma enum 500s, missing endpoints, AI schema & CSS gaps | High |
| [BUG-04](#bug-04--prisma-schema-vs-migrations-drift--broken-ci-migration-diff) | **P0** | Database / CI | DPDPA columns missing from migrations (`is_anonymized`, `anonymized_at`, `deleted_at`) + CI `prisma migrate diff` missing `--shadow-database-url` | High |
| [BUG-05](#bug-05--docker-compose-network-isolation--broken-service-dockerfiles) | **P0** | Containers | DB containers omitted from `parkly-net`; gateway missing `PREDICTION_URL`/`NOTIFICATION_URL`; Dockerfiles miss `shared/package.json`, `ai-agents`, `@opentelemetry/api` | High |
| [BUG-06](#bug-06--aws-cdk-deploys-placeholder-node-image--colliding-resources) | **P0** | Infrastructure (`infra/cdk`) | `ParklyStack` deploys raw `node:20-alpine` w/o app/secrets/services, no RDS ingress, unprefixed DynamoDB/EventBus names, dead `DatabaseStack` | High |
| [BUG-07](#bug-07--stale--corrupted-js-artifacts-committed-inside-sharedsrc) | **P1** | Shared Library | Tracked `.js`/`.d.ts` files inside `shared/src/` shadow `.ts` in Jest and return corrupted geohash neighbors (`tge2undefined`) | High |
| [BUG-08](#bug-08--monolithic-getconfig-jwt-coupling--unguarded-publishevent-500s) | **P1** | Config / Resilience | Monolithic `getConfig()` forces `JWT_*` secrets for EventBridge/AWS calls; unguarded `await publishEvent()` causes HTTP 500 after DB writes | High |
| [BUG-09](#bug-09--mobile-infinite-spinner-hardcoded-ip-arrivaltime-400--demo-id-collisions) | **P1** | Mobile App (`apps/mobile`) | `BookingDetailScreen` infinite spinner online; Tailscale IP default; `arrivalTime` 400; `Decimal` parsing & partial demo-ID workaround | High |
| [BUG-10](#bug-10--payment-webhook-auth-bypass--ai-provider-failure-masking) | **P1** | Security / AI Reliability | Non-Razorpay webhook capture without HMAC verification; `RealNotificationProvider` returns `delivered: true` when failed; `SagaOrchestrator` swallows compensation failures | High |
| [BUG-11](#bug-11--workspace-npm-run-lint-fails-everywhere-missing-eslint) | **P2** | Build & Tooling | `npm run lint --workspaces --if-present` fails in all 8 declaring packages (`'eslint' is not recognized`) | High |
| [BUG-12](#bug-12--packagesai-agents-47-ts-test-errors--flaky-timeout-race) | **P2** | AI Agents Tests / CI | 47 TS strict errors in `tsconfig.test.json` hidden by CI + `BaseAgent` `timer.unref()` race under parallel Vitest | High |
| [BUG-13](#bug-13--jest-open-handle-leaks-wrong-service-logs--no-op-otel) | **P2** | Testing & Observability | Jest open handles (`pino-pretty` worker & un-cleared `createHealthCheck` 3s timers), `SERVICE_NAME` import-order bug, stripped `req.path`, no-op OTel | High |
| [BUG-14](#bug-14--zero-tests-in-4-services--all-3-uis-plus-broken-auth-service-scripts) | **P2** | Test Coverage / Scripts | Zero tests in `host`, `notification`, `occupancy`, `search`, and all 3 UIs masked by `--passWithNoTests`; broken `auth-service` scripts | High |
| [BUG-15](#bug-15--mobile-recursive-junction-dependency-splits--workspace-exclusion) | **P3** | Monorepo Dependencies | `"parkly": "file:../.."` creates recursive NTFS junction; React 18/19 & `@types/react` / `dotenv` splits across workspaces | High |

---

## Detailed Root-Cause Documentation

### BUG-01 — Live Booking Contract, UUID Mismatch & State-Transition Deadlock

- **Severity**: P0 (Critical) · **Confidence**: High
- **Affected Layers**: Mobile (`apps/mobile`) → Prisma Seed (`infra/prisma/seed.ts`) → Booking Service (`services/booking-service`) → Payment Service (`services/payment-service`)
- **Symptoms**:
  - Live bookings from mobile always fail HTTP `400 VALIDATION_ERROR` and fall back into the local offline demo catch block.
  - `PUT /bookings/:id/complete` is unreachable for every confirmed booking (`422 Only active bookings can be completed`).
  - Issuing a refund updates `Payment.status` to `'refunded'` while leaving `Booking.status` as `'confirmed'`.
- **Supporting Evidence**:
  1. [`services/booking-service/src/routes/booking.ts:16-19`](../services/booking-service/src/routes/booking.ts#L16-L19) validates `spaceId`, `vehicleId`, and `hostId` with `z.string().uuid()`, and [`infra/prisma/schema.prisma:202`](../infra/prisma/schema.prisma#L202) enforces FK `bookings.vehicle_id -> vehicles.id`.
  2. [`infra/prisma/seed.ts:104-174`](../infra/prisma/seed.ts#L104-L174) seeds non-UUID IDs (`'sp-tng-001'`, `'sp-tng-002'`, `'sp-adyar-001'`, `'sp-vel-001'`).
  3. [`apps/mobile/app/booking/create.tsx:60-68`](../apps/mobile/app/booking/create.tsx#L60-L68) sends `vehicleId: \`veh-${cleanedPlate}\`` and `hostId: hostId || 'host-chennai-001'` (also hardcoded in [`apps/mobile/app/space/[id].tsx:109`](../apps/mobile/app/space/%5Bid%5D.tsx#L109) and [`apps/mobile/app/(tabs)/concierge.tsx:126,161,197`](../apps/mobile/app/%28tabs%29/concierge.tsx#L126)); no vehicle creation API exists across any service.
  4. Even with valid UUIDs, [`services/booking-service/src/routes/booking.ts:50`](../services/booking-service/src/routes/booking.ts#L50) returns `{ success: true, data: booking }`, while [`create.tsx:70,75`](../apps/mobile/app/booking/create.tsx#L70-L75) reads `bookingResp?.data?.booking?.id` (`undefined`), synthesizing `bk-${Date.now()}` which fails [`services/payment-service/src/index.ts:388`](../services/payment-service/src/index.ts#L388) (`bookingId: z.string().uuid()`). Moreover, `create.tsx:92-97` only calls `paymentApi.initiate()`, skipping `paymentApi.confirm()` (`PUT /payments/:id/confirm`), yet caches `status: 'confirmed'`.
  5. [`services/booking-service/src/services/bookingService.ts:56-71`](../services/booking-service/src/services/bookingService.ts#L56-L71) rejects overlapping bookings with `findFirst` without `SELECT FOR UPDATE` or checking `ParkingSpace.totalCapacity` (blocking multi-slot lots after 1 booking). Lines [`159-165`](../services/booking-service/src/services/bookingService.ts#L159-L165) require `booking.status === 'active'` to complete, but zero production routes/handlers transition `'confirmed'` → `'active'`.
  6. [`services/payment-service/src/index.ts:290-318`](../services/payment-service/src/index.ts#L290-L318) (`refundPayment`) never updates `Booking.status` to `'refunded'`, stranding bookings as `'confirmed'` despite `BookingStatus.refunded` in [`infra/prisma/schema.prisma:227`](../infra/prisma/schema.prisma#L227).
- **Missing Evidence**: Live PostgreSQL FK rejection trace after bypassing Zod UUID checks.
- **Smallest Proof Step**: Send `POST /bookings` with seeded `spaceId: 'sp-tng-001'`, `vehicleId: 'veh-TN01AB1234'`, `hostId: 'host-chennai-001'` → HTTP `400` (`Invalid uuid`).
- **Recommended Fix Path**: Use real UUIDs in `seed.ts`, expose a `/vehicles` lookup/create endpoint on `auth-service` or `booking-service`, return `hostId` from `search-service`, fix `create.tsx` response parsing + checkout confirmation, add check-in (`confirmed` → `active`) and capacity-aware transactional allocation, and sync `Booking.status = 'refunded'` in `refundPayment`.

---

### BUG-02 — Gateway vs Downstream Auth Middleware & Route Mismatches

- **Severity**: P0 (Critical) · **Confidence**: High
- **Affected Layers**: `services/api-gateway`, `services/search-service`, `services/pricing-service`, `services/prediction-service`, `services/occupancy-service`, `services/notification-service`, `apps/mobile`
- **Symptoms**:
  - Public unauthenticated discovery/pricing/concierge calls pass through `api-gateway` and get rejected with `401 Unauthorized` downstream (forcing unauthenticated mobile users arriving at [`apps/mobile/app/index.tsx:8-9`](../apps/mobile/app/index.tsx#L8-L9) straight into offline fallbacks).
  - Admin occupancy simulation `POST /api/v1/occupancy/simulate` always fails `401 Not authenticated`.
  - Mobile post-OTP push token registration always fails `404`.
- **Supporting Evidence**:
  - [`services/api-gateway/src/index.ts:216-231`](../services/api-gateway/src/index.ts#L216-L231) labels `/api/v1/search`, `/pricing`, and `/concierge` as `// --- Public Routes (no auth required) ---`, contradicting [`services/search-service/src/routes/search.ts:24`](../services/search-service/src/routes/search.ts#L24) (`searchRouter.use(authenticate)`), [`services/pricing-service/src/index.ts:111`](../services/pricing-service/src/index.ts#L111) (`pricingRouter.use(authenticate)`), and [`services/prediction-service/src/index.ts:275`](../services/prediction-service/src/index.ts#L275) (`router.post('/concierge', authenticate, ...)`).
  - [`services/occupancy-service/src/index.ts:171`](../services/occupancy-service/src/index.ts#L171) attaches `requireRole('admin')` to `POST /occupancy/simulate` without `authenticate`; because `api-gateway` does not inject user headers, `req.user` is `undefined`, so [`shared/src/middleware/auth.ts:56-59`](../shared/src/middleware/auth.ts#L56-L59) always throws `401`.
  - [`apps/mobile/src/store/auth.store.ts:70`](../apps/mobile/src/store/auth.store.ts#L70) → [`apps/mobile/src/api/client.ts:118`](../apps/mobile/src/api/client.ts#L118) calls `POST /notifications/devices`, absent from [`services/notification-service/src/index.ts:240-272`](../services/notification-service/src/index.ts#L240-L272).
- **Missing Evidence**: Live multi-service HTTP capture through `api-gateway`.
- **Smallest Proof Step**: `curl -X POST http://localhost:4000/api/v1/search` without `Authorization` → `401` from `search-service`; `POST /occupancy/simulate` with an `admin` JWT on `occupancy-service` → `401 Not authenticated`.
- **Recommended Fix Path**: Align auth model across gateway and services (`search`/`pricing` public or authenticated after real login, remove bypass at `apps/mobile/app/index.tsx` if JWT required), add `authenticate` before `requireRole('admin')` on `POST /occupancy/simulate`, and implement `POST /notifications/devices`.

---

### BUG-03 — Web Portals Auth Failure, Crashes, Prisma 500s & AI Schema Mismatches

- **Severity**: P0 (Critical) · **Confidence**: High
- **Affected Layers**: `apps/host-dashboard`, `apps/admin-portal`, `services/auth-service`, `services/host-service`, `services/admin-service`, `services/occupancy-service`, `services/booking-service`
- **Symptoms**:
  - Login writes `'undefined'` into `localStorage`, logout/401 renders `404 NotFound`, `BookingsAdmin` crashes on real DB records, admin enum filters trigger Prisma 500s, multiple Host/Admin API calls hit 404, modals render unstyled, and AI insights stay frozen on hardcoded mocks.
- **Supporting Evidence**:
  1. **Broken Auth & Routing**: Both [`apps/host-dashboard/src/utils/authStore.ts:35-39`](../apps/host-dashboard/src/utils/authStore.ts#L35-L39) and `apps/admin-portal/src/utils/authStore.ts:35-39` read `{ token, user } = response.data`, whereas [`services/auth-service/src/routes/auth.ts:118-131`](../services/auth-service/src/routes/auth.ts#L118-L131) returns `{ success: true, data: { user, tokens: { accessToken, refreshToken } } }`. Both `utils/api.ts` instances call missing `GET/PATCH /auth/profile` (`auth-service` only exposes `GET /auth/me`), both `App.tsx` files instantiate `utils/api.ts` while hooks import separate `utils/apiClient.ts`, and all `/login` redirects hit `<NotFound />`.
  2. **Crash & Action Bugs**: [`apps/admin-portal/src/pages/BookingsAdmin.tsx:25-32`](../apps/admin-portal/src/pages/BookingsAdmin.tsx#L25-L32) accesses `b.driverId.toLowerCase()` when Prisma `Booking` rows (`services/admin-service/src/index.ts:143`) expose `userId` (`driverId === undefined` → `TypeError`). `UsersPage.tsx:141-145` wires **Unsuspend** to `handleSuspend(u)`. `host-dashboard/src/pages/Listings.tsx:185` displays `'draft'` spaces as `'✅ Active'`.
  3. **Prisma Enum 500s & 404 Endpoints**: `BookingsAdmin.tsx:65` sends `status=disputed` (absent from `BookingStatus` enum in `schema.prisma:221-228`); `UsersPage.tsx:14,42,82` sends `role=government` (absent from `UserRole` enum in `schema.prisma:37-41`). `host-dashboard/src/utils/apiClient.ts:68,71-73` calls non-existent `/occupancy/current/${spaceId}`, `/admin/revenue`, `/host/payouts`; `useHostData.ts:129-132` expects `Array.isArray(response.data?.data)` when `GET /bookings` returns `{ bookings, total }`. `admin-portal/src/utils/apiClient.ts:46-78` calls non-existent `PUT /admin/users/:id/role|suspend`, `GET /admin/disputes|alerts|audit-logs`.
  4. **AI Schema Mismatches**:
     - `admin-portal/src/pages/Verifications.tsx:97-110` reads `data?.action`, `data?.hostCompensationInr`, `data?.explanation` instead of `DisputeMediationOutput` (`adjudication`, `hostCompensationAmount`, `platformAuditLog`).
     - `admin-portal/src/pages/CityAnalytics.tsx:54-62` reads top-level `totalOffStreetHoursSupplied`/`cruisingMinutesReduced`/`co2AbatedKg` instead of `data.metrics.{totalOffStreetHoursProvided, estimatedCurbsideCruisingReducedMinutes, estimatedCO2AbatedKg}`.
     - `host-dashboard/src/pages/Listings.tsx:308,314` reads `clearanceMeters`, `blurredPlates`, `blurredFaces` instead of `estimatedWidthMeters`, `licensePlatesBlurred`, `facesBlurred`.
  5. **Missing CSS**: Neither `apps/host-dashboard/src/index.css` nor `apps/admin-portal/src/index.css` defines `.modal-backdrop`, `.modal`, `.modal-header`, `.modal-title`, `.modal-body`, `.modal-footer`, `.form-select`, `.btn-secondary`, `--surface`, `--surface-light`, `--primary`, or `--text`.
- **Missing Evidence**: Live browser DOM capture of each portal connected to backend services.
- **Smallest Proof Step**: Query `GET /api/v1/admin/users?role=government` (Prisma 500), render `BookingsAdmin` with `[{ id: 'b1', userId: 'u1', spaceId: 's1', totalAmount: 100, status: 'confirmed' }]` (`TypeError`), or grep `modal-backdrop` across `apps/*/src/index.css` (0 matches).
- **Recommended Fix Path**: Consolidate each portal to a single Axios client, add `/login` routes, align `authStore` & page schemas/routes with `auth`/`host`/`admin`/`booking`/`occupancy` services, and add modal/select/NotFound CSS tokens.

---

### BUG-04 — Prisma Schema vs Migrations Drift & Broken CI Migration Diff

- **Severity**: P0 (Critical) · **Confidence**: High
- **Affected Layers**: `infra/prisma/schema.prisma`, `infra/prisma/migrations/`, `services/admin-service`, `.github/workflows/ci.yml`
- **Symptoms**:
  - Running `npx prisma validate --schema=infra/prisma/schema.prisma` locally fails with `P1012: Environment variable not found: DATABASE_URL`.
  - Running CI's drift command `npx prisma migrate diff --from-migrations infra/prisma/migrations --to-schema-datamodel infra/prisma/schema.prisma --exit-code` fails immediately with `Error: You must pass the --shadow-database-url if you want to diff a migrations directory.`
  - Databases initialized from `infra/prisma/migrations/` lack DPDPA columns required at runtime by `admin-service`.
- **Supporting Evidence**:
  - Direct run of `prisma migrate diff` in this audit failed before DB connection due to missing `--shadow-database-url`.
  - [`infra/prisma/schema.prisma:21-24,53,84-85,196`](../infra/prisma/schema.prisma#L15-L95) defines `User.{isAnonymized, anonymizedAt, deletedAt}`, `Vehicle.deletedAt`, `Host.{isAnonymized, deletedAt}`, and `Booking.deletedAt`, which are queried/updated by `services/admin-service/src/index.ts:69-71` and `services/admin-service/src/services/anonymizeService.ts:34,56,80-124`.
  - Neither `infra/prisma/migrations/0001_init.sql` (loose SQL file using `"is_active"`) nor `infra/prisma/migrations/20260625230621_public/migration.sql` (uses `"isActive"` and repeats full `CREATE TYPE`/`CREATE TABLE` DDL) contains any `is_anonymized`, `anonymized_at`, or `deleted_at` columns.
- **Missing Evidence**: Live PostgreSQL output of `npx prisma migrate deploy` showing duplicate table/type errors between `0001_init.sql` and `20260625230621_public`.
- **Smallest Proof Step**:
  ```powershell
  $env:DATABASE_URL="postgresql://parkly:password@localhost:5432/parkly_test?schema=public"
  npx prisma migrate diff --from-migrations infra/prisma/migrations --to-schema-datamodel infra/prisma/schema.prisma --exit-code
  ```
- **Recommended Fix Path**: Reconcile `infra/prisma/migrations/` with an explicit migration adding DPDPA columns/indexes (removing or baselining duplicate DDL), and update `.github/workflows/ci.yml:130` to supply `--shadow-database-url`.

---

### BUG-05 — Docker Compose Network Isolation & Broken Service Dockerfiles

- **Severity**: P0 (Critical) · **Confidence**: High
- **Affected Layers**: [`docker-compose.yml`](../docker-compose.yml), [`.env.example`](../.env.example), `services/*/Dockerfile`, [`shared/package.json`](../shared/package.json)
- **Symptoms**:
  - Microservice containers started via `docker compose up` cannot resolve `postgres` or `dynamodb-local` DNS names.
  - `api-gateway` container proxies `/predict`, `/concierge`, and `/notifications` to container-local `localhost` (`503`).
  - Service Docker builds/runtimes fail to resolve `@parkly/shared`, `@parkly/ai-agents`, and `@opentelemetry/api`.
- **Supporting Evidence**:
  - [`docker-compose.yml:12-74`](../docker-compose.yml#L12-L74) leaves `postgres`, `dynamodb-local`, and `dynamodb-setup` without `networks:`, whereas lines [`77-305`](../docker-compose.yml#L260-L312) attach all 11 services and both web portals exclusively to `parkly-net`.
  - [`docker-compose.yml:84-95`](../docker-compose.yml#L84-L95) & `.env.example` omit `PREDICTION_URL` (`http://prediction-service:4005`) and `NOTIFICATION_URL` (`http://notification-service:4009`) consumed by [`services/api-gateway/src/index.ts:125,128`](../services/api-gateway/src/index.ts#L120-L131).
  - All 11 `services/*/Dockerfile` runtime stages omit `shared/package.json` (`"main": "dist/index.js"`); 5 AI-consuming Dockerfiles (`admin`, `host`, `prediction`, `pricing`, `search`) omit `packages/ai-agents`; `services/auth-service/Dockerfile:115` copies a conditional nested `node_modules` folder; [`shared/src/tracing/index.ts:6`](../shared/src/tracing/index.ts#L6) statically imports `@opentelemetry/api` which is missing from [`shared/package.json`](../shared/package.json) (only hoisted via `notification-service` → `firebase-admin`).
- **Missing Evidence**: Live `docker build` / `docker compose up` execution log (Docker daemon not started in this audit).
- **Smallest Proof Step**: Inspect `docker-compose.yml:12-95` and `services/prediction-service/Dockerfile` or run `docker build -f services/prediction-service/Dockerfile .`.
- **Recommended Fix Path**: Add `networks: [parkly-net]` to infra services, add `PREDICTION_URL`/`NOTIFICATION_URL` to Compose & `.env.example`, declare `@opentelemetry/api` in `shared/package.json`, and copy `shared/package.json` + built `packages/ai-agents` in service Dockerfiles.

---

### BUG-06 — AWS CDK Deploys Placeholder `node:20-alpine` Image & Colliding Resources

- **Severity**: P0 (Critical) · **Confidence**: High
- **Affected Layers**: [`infra/cdk/lib/parkly-stack.ts`](../infra/cdk/lib/parkly-stack.ts), `infra/cdk/bin/parkly.ts`, `infra/cdk/lib/database-stack.ts`
- **Symptoms**:
  - Synthesized CloudFormation (`ParklyStack`) deploys a raw `node:20-alpine` container on ECS Fargate with no application bundle, no ECS ingress into RDS, and unprefixed DynamoDB/EventBridge names that collide between `env=dev` and `env=prod`.
- **Supporting Evidence**:
  - [`infra/cdk/lib/parkly-stack.ts:176-196`](../infra/cdk/lib/parkly-stack.ts#L175-L196): `GatewayFargateService` uses `ecs.ContainerImage.fromRegistry('node:20-alpine')` (line 183) with only `NODE_ENV` & `GATEWAY_PORT`, so `/health` fails immediately.
  - [`infra/cdk/lib/parkly-stack.ts:73-95`](../infra/cdk/lib/parkly-stack.ts#L72-L95): `DbSg` (`${prefix}-rds-sg`) adds no ingress rule allowing `fargateService.service` on TCP 5432.
  - [`infra/cdk/lib/parkly-stack.ts:98-123,160-162`](../infra/cdk/lib/parkly-stack.ts#L97-L168): Hardcodes `'parkly-otp'`, `'parkly-occupancy'`, `'parkly-notifications'`, and `'parkly-event-bus'` without `${prefix}`, omits the `userId-createdAt-index` GSI present in `database-stack.ts:91-96`, and leaves `DatabaseStack` unused by `bin/parkly.ts`.
- **Missing Evidence**: Live `cdk deploy` run against AWS.
- **Smallest Proof Step**: `npm run synth -w infra/cdk -- -c env=dev` and inspect `GatewayFargateService` / `DbSg` / DynamoDB `TableName` in `infra/cdk/cdk.out/ParklyStack.template.json`.
- **Recommended Fix Path**: Wire real container/ECR asset images + ECS service definitions + secrets/service URLs, grant `database.connections.allowDefaultPortFrom(fargateService.service)`, prefix DynamoDB/EventBus names per `env`, and consolidate `DatabaseStack`.

---

### BUG-07 — Stale & Corrupted `.js` Artifacts Committed Inside `shared/src/`

- **Severity**: P1 (High) · **Confidence**: High
- **Affected Layers**: `shared/src/**` (tracked compiled JS/DTS/Map files shadowing `.ts` files)
- **Symptoms**:
  - Direct Node/Jest `require('./shared/src/utils')` resolves `index.js` before `index.ts` (ts-jest default `moduleFileExtensions`), returning **corrupted geohash neighbors** (`'tge2undefined'`, `'tge2undefinee'`, `'tge2undefine9'`) and missing `normalizePhoneNumber`, `cors`, `tracing`, `health`, `responseTimer`, and `.env` path loading.
- **Supporting Evidence**:
  - Verified directly via Node in this session:
    - `require('./shared/src/utils').getGeohashNeighbors('tge27')` → `['tge27', 'tge2undefined', 'tge2undefinee', 'tge2k', 'tge2h', 'tge25', 'tge24', 'tge26', 'tge2undefine9']` (`typeof normalizePhoneNumber === 'undefined'`).
    - `require('./shared/dist/utils').getGeohashNeighbors('tge27')` → `['tge27', 'tge2e', 'tge2s', 'tge2k', 'tge2h', 'tge25', 'tge24', 'tge26', 'tge2d']` (`typeof normalizePhoneNumber === 'function'`).
  - Stale `.js`/`.d.ts`/`.js.map` files tracked in `shared/src/` omit 7 exports from `shared/src/index.ts`, lack `dotenv.config(...)` and 11 keys in `shared/src/config/index.js`, and omit `pinoTraceMixin` in `shared/src/logger/index.js`.
- **Missing Evidence**: None for `shared` unit test shadowing; external consumers resolving `package.json` `"main": "dist/index.js"` are unaffected unless importing `shared/src/*` directly.
- **Smallest Proof Step**:
  ```powershell
  node -e "const s=require('./shared/src/utils'); console.log(s.getGeohashNeighbors('tge27'), typeof s.normalizePhoneNumber)"
  ```
- **Recommended Fix Path**: Remove all committed compiled `.js`, `.d.ts`, and `.map` artifacts under `shared/src/` from git so only `.ts` sources live in `src/` and compiled outputs live in `shared/dist/`.

---

### BUG-08 — Monolithic `getConfig()` JWT Coupling & Unguarded `publishEvent()` 500s

- **Severity**: P1 (High) · **Confidence**: High
- **Affected Layers**: [`shared/src/config/index.ts`](../shared/src/config/index.ts), `shared/src/aws/clients.ts`, `services/payment-service`, `services/host-service`, `services/admin-service`
- **Symptoms**:
  - `@parkly/admin-service` unit tests log: `WARN: Failed to publish UserAnonymized event — err: "Missing required environment variable: JWT_ACCESS_SECRET"`.
  - Any service invoking `getConfig()` or AWS SDK clients (`publishEvent`, DynamoDB, S3, SNS) fails if either `JWT_ACCESS_SECRET` or `JWT_REFRESH_SECRET` is unset.
  - `payment-service`, `host-service`, and `admin-service` await `publishEvent()` without `try/catch`, failing HTTP requests with 500 after mutating PostgreSQL (leaving `Payment.status = 'completed'` while `Booking.status` remains `'created'` in `confirmPayment`).
- **Supporting Evidence**:
  - [`shared/src/config/index.ts:101-114`](../shared/src/config/index.ts#L101-L114): `getConfig()` unconditionally calls `requireEnv('JWT_ACCESS_SECRET')` and `requireEnv('JWT_REFRESH_SECRET')` on first call (`shared/src/aws/clients.ts:13,88-90`).
  - [`services/payment-service/src/index.ts:268-285,309,345`](../services/payment-service/src/index.ts#L268-L355), `services/host-service/src/index.ts:136,310`, and `services/admin-service/src/index.ts:186,216` execute unguarded `await publishEvent(...)`. Contrast `bookingService.ts:176-186` & `anonymizeService.ts:138-148`, which wrap EventBridge calls safely.
- **Missing Evidence**: Live HTTP 500 trace from `confirmPayment` with EventBridge unreachable.
- **Smallest Proof Step**: `npm test -w services/admin-service` without `JWT_ACCESS_SECRET` set → emits `Missing required environment variable: JWT_ACCESS_SECRET`.
- **Recommended Fix Path**: Validate env vars lazily per capability (`getJwtConfig()`, `getAwsConfig()`, etc.), and make `publishEvent` non-fatal (or transactional outbox) with `try/catch` warning logs across `payment`, `host`, and `admin` services.

---

### BUG-09 — Mobile Infinite Spinner, Hardcoded IP, `arrivalTime` 400 & Demo ID Collisions

- **Severity**: P1 (High) · **Confidence**: High
- **Affected Layers**: `apps/mobile` (`src/api/client.ts`, `app/booking/[id].tsx`, `app/booking/create.tsx`, `app/(tabs)/home.tsx`, `bookings.tsx`, `concierge.tsx`, `profile.tsx`, `space/[id].tsx`, `(auth)/otp.tsx`)
- **Symptoms**:
  - **`BookingDetailScreen` infinite spinner**: Opening booking details when `GET /bookings/:id` succeeds leaves `<ActivityIndicator />` spinning forever because `loading` stays `true`; real bookings also display hardcoded placeholder space/plate/slot text.
  - **5-second stalls per screen**: Unset `EXPO_PUBLIC_API_URL` falls back to `'http://100.116.89.14:4000/api/v1'` (`timeout: 5000`), dropping packets and hanging 5s on every request.
  - **Search 400**: `home.tsx` and `concierge.tsx` send `arrivalTime: new Date().toISOString()`, rejected by `search-service` (`arrivalTime < server now` after transit).
  - **React duplicate-key toast blocking tabs & partial local diff**: Creating >1 demo booking previously hardcoded `'bk-demo-001'`, throwing React LogBox `Encountered two children with the same key, '.$bk-demo-001'` over the tab bar (`Bookings` / `Profile`). Current uncommitted edits in `create.tsx` & `bookings.tsx` mitigate the UI toast via `bk-demo-${Date.now().slice(-3)}` and `${item.id}-${index}`, but 3-digit IDs retain a 1/1000 collision risk and `[id].tsx:72` still resolves wrong duplicates on `.find()`.
  - **Field/display bugs**: `space/[id].tsx:53` tests `typeof data.hourlyRate === 'number'` (always false for Prisma `Decimal` strings → defaults to `₹40`), and line `189` renders blank for `'high'`/`'medium'` demo security levels; `concierge.tsx:129,241` prints `km` values with `m away`; `profile.tsx:80-85` hardcodes `0` / `₹0` / `0h`; `(auth)/otp.tsx:60-66` resend has no `try/catch`; `(auth)/_layout.tsx:8` registers missing `register` route; `bookings.tsx` does not reload via `useFocusEffect` when switching back to an already-mounted tab.
- **Supporting Evidence**: [`apps/mobile/app/booking/[id].tsx:53-64,196-203`](../apps/mobile/app/booking/%5Bid%5D.tsx#L53-L105) (`return;` on line 63 skips `setLoading(false)`); [`apps/mobile/src/api/client.ts:9,13`](../apps/mobile/src/api/client.ts); `apps/mobile/app/(tabs)/home.tsx:77` vs `services/search-service/src/services/searchService.ts:59-61`; `apps/mobile/app/space/[id].tsx:53,189`.
- **Missing Evidence**: Live screenshot of `BookingDetailScreen` against a live `200` response from `booking-service`.
- **Smallest Proof Step**: Inspect `apps/mobile/app/booking/[id].tsx:55-64` or check `git diff apps/mobile/`.
- **Recommended Fix Path**: Add `finally { setLoading(false); }` in `BookingDetailScreen` and `include: { space, vehicle }` in `bookingService.getBooking`; default mobile API URL to Android emulator/localhost host (`10.0.2.2:4000` / `localhost:4000`); add client buffer to `arrivalTime`; parse `Number(data.hourlyRate)`; generate collision-free UUID/demo IDs and use `useFocusEffect` on `Bookings`.

---

### BUG-10 — Payment Webhook Auth Bypass & AI Provider Failure Masking

- **Severity**: P1 (High) · **Confidence**: High
- **Affected Layers**: [`services/payment-service/src/index.ts`](../services/payment-service/src/index.ts), `services/payment-service/src/__tests__/webhook.test.ts`, `packages/ai-agents/src/tools/real-providers/*`, `packages/ai-agents/src/saga/saga-orchestrator.ts`
- **Symptoms**:
  - `POST /payments/webhook` allows unauthenticated payment captures whenever `PAYMENT_PROVIDER !== 'razorpay'` and `x-razorpay-signature` is omitted (`webhook.test.ts` never tests the HTTP route, instead defining its own local `verifyHmac`).
  - `RealNotificationProvider` returns `ok({ delivered: true })` even when Expo/SendGrid delivery fails and logs `FAILED`.
  - `SagaOrchestrator` swallows exceptions inside compensation steps without logging or recording `COMPENSATION_FAILED`.
- **Supporting Evidence**:
  - [`services/payment-service/src/index.ts:464-531`](../services/payment-service/src/index.ts#L464-L531) skips signature enforcement if `config.paymentProvider !== 'razorpay'` at lines 497-513; `services/payment-service/src/__tests__/webhook.test.ts:35-70` tests a local helper function rather than the Express route.
  - `packages/ai-agents/src/tools/real-providers/real-notification.provider.ts:85-89,110-114,136` resolves `ok({ delivered: true })` despite `channelStatus === 'FAILED'`; `vitest.config.ts` does not wire `tests/e2e/helpers/setup-offline.ts`, and `real-providers.test.ts:350-368` makes live `fetch` calls to `exp.host` without asserting `status === 'DELIVERED'`.
  - `packages/ai-agents/src/saga/saga-orchestrator.ts:116-118` uses empty/silent `catch` around `compStep.compensate()`.
- **Missing Evidence**: Live Express webhook exploit test with `PAYMENT_PROVIDER=mock` and live Vitest run with `setup-offline.ts` preloaded.
- **Smallest Proof Step**: Compare `payment-service/src/index.ts:497-513` vs `webhook.test.ts:35-70` and inspect `real-notification.provider.ts:110-136`.
- **Recommended Fix Path**: Enforce webhook signature/shared secret validation in all non-local modes and add `supertest` coverage for `POST /payments/webhook`; return structured failures from `RealNotificationProvider` when delivery fails and record `COMPENSATION_FAILED` in `SagaOrchestrator`.

---

### BUG-11 — Workspace `npm run lint` Fails Everywhere (Missing ESLint)

- **Severity**: P2 (Medium) · **Confidence**: High
- **Affected Layers**: Root [`package.json`](../package.json), `@parkly/shared`, `auth/booking/host/payment/search-service`, `apps/host-dashboard`, `apps/admin-portal`
- **Symptoms**:
  - `npm run lint --workspaces --if-present` fails in all 8 workspaces declaring `"lint"` with `'eslint' is not recognized as an internal or external command`.
- **Supporting Evidence**: Observed directly in `task-1679` / `task-1670`. `eslint` is absent from all `package.json` manifests and `package-lock.json`; zero `.eslintrc*` / `eslint.config.*` files exist in git.
- **Smallest Proof Step**: `npm run lint -w shared` → Exit `1`.
- **Recommended Fix Path**: Install `eslint` + `@typescript-eslint/*` (+ React plugins for web/mobile) and add a shared `eslint.config.mjs` (or `.eslintrc.cjs`).

---

### BUG-12 — `packages/ai-agents`: 47 TS Test Errors & Flaky Timeout Race

- **Severity**: P2 (Medium) · **Confidence**: High
- **Affected Layers**: `packages/ai-agents` (`tsconfig.test.json`, `src/core/agent.interface.ts`, `tests/**`), [`.github/workflows/ci.yml`](../.github/workflows/ci.yml)
- **Symptoms**:
  - `npm run typecheck -w packages/ai-agents` (`tsc -p tsconfig.test.json --noEmit`) fails with **47 TypeScript errors** across 7 test files (`tests/e2e/tier{1,2,3}*.spec.ts`, `tests/integration/e2e-harness-challenge.spec.ts`, `multi-agent-sagas.spec.ts`, `tests/unit/core/adversarial*.spec.ts`, `saga-orchestrator.spec.ts`, `real-providers.test.ts`).
  - `packages/ai-agents` Vitest suite passes standalone (`360/360`) but flaked `1/360` under parallel `forks` load at `adversarial.spec.ts:247` (`expected true to be false`).
- **Supporting Evidence**:
  - Direct run in `task-1636`: `10` `TS6133` unused locals, `20` `TS2532` (`Object is possibly 'undefined'`), `15` `TS18048`, and `2` genuine contract errors (`TS2345`: partial `VisionInspectionResult` mock in `tier3-pairwise.e2e.spec.ts:179`, invalid `globalThis.fetch({ url })` call in `e2e-harness-challenge.spec.ts:119`). `.github/workflows/ci.yml:29-33` skips `npm run typecheck` and still prints stale `(333 tests)`.
  - [`packages/ai-agents/src/core/agent.interface.ts:144-146`](../packages/ai-agents/src/core/agent.interface.ts#L144-L146) calls `timer.unref()` on its `timeoutMs` guard while `MockWorkerAgent` holds a ref'd timer longer than `timeoutMs`, enabling ref'd callbacks to preempt unref'd timeouts under CPU saturation.
- **Smallest Proof Step**: `npm run typecheck -w packages/ai-agents` → Exit `2` (47 errors).
- **Recommended Fix Path**: Fix the 47 test typecheck errors, add `npm run typecheck` to `.github/workflows/ci.yml`, and remove `timer.unref()` (clear timeout in `finally` instead, which `BaseAgent` already needs).

---

### BUG-13 — Jest Open Handle Leaks, Wrong Service Logs & No-Op OTel

- **Severity**: P2 (Medium) · **Confidence**: High
- **Affected Layers**: [`shared/src/health/index.ts`](../shared/src/health/index.ts), [`shared/src/logger/index.ts`](../shared/src/logger/index.ts), `shared/src/middleware/requestLogger.ts`, `shared/src/tracing/index.ts`, `services/api-gateway`, `services/booking-service`
- **Symptoms**:
  - `api-gateway` and `booking-service` Jest suites print `Jest did not exit one second after the test run has completed`.
  - Logs across all services emit `"service": "parkly"` instead of the actual service name, `requestLogger` logs router-stripped `path: "/"`, and OpenTelemetry tracing is a silent no-op.
- **Supporting Evidence**:
  - Sub-Agent 4 reproduced directly with `npx jest --detectOpenHandles --runInBand`: `api-gateway` leaks `pino-pretty` `thread-stream` `Worker` (`shared/src/logger/index.ts:11-21` enables pretty transport whenever `NODE_ENV !== 'production'`, which `unref()`s asynchronously after `gateway.test.ts`'s ~42ms suite finishes); `booking-service` leaks 2× 3,000ms `setTimeout` timers from `Promise.race` in [`shared/src/health/index.ts:49-58`](../shared/src/health/index.ts#L49-L58).
  - [`shared/src/logger/index.ts:25-27`](../shared/src/logger/index.ts#L25-L27) evaluates `process.env['SERVICE_NAME'] || 'parkly'` at module load before services assign `SERVICE_NAME`. `api-gateway/src/index.ts:264` swaps Pino's `(obj, msg)` args.
  - `Select-String -Path "services/*/src/**/*.ts" -Pattern "traceContextMiddleware|initTracing"` returned `Count: 0`; `tracing/index.ts` registers no `TracerProvider`/exporter.
- **Smallest Proof Step**: `Push-Location services/booking-service; npx jest --detectOpenHandles --runInBand` (shows `2 open handles ... Timeout` and `"service": "parkly"`, `"path": "/"`).
- **Recommended Fix Path**: Clear `createHealthCheck` timeout handles after `Promise.race` settles; disable `pino-pretty` transport when `NODE_ENV === 'test'`; pass service name cleanly to child logger/factory; log `req.originalUrl`; wire OTel provider if exporting spans.

---

### BUG-14 — Zero Tests in 4 Services & All 3 UIs, Plus Broken `auth-service` Scripts

- **Severity**: P2 (Medium) · **Confidence**: High
- **Affected Layers**: `services/{host,notification,occupancy,search,auth}-service`, `services/pricing-service`, `apps/{mobile,host-dashboard,admin-portal}`, `services/api-gateway/tsconfig.json`
- **Supporting Evidence**:
  - `host-service`, `notification-service`, `occupancy-service`, and `search-service` define `"test": "jest --passWithNoTests"` with zero test files (`notification-service` and `occupancy-service` lack `jest` in `devDependencies`).
  - `apps/mobile`, `apps/host-dashboard`, and `apps/admin-portal` define zero test suites (`0` UI tests).
  - `booking-service/src/__tests__/booking.test.ts:97-163` mocks out `bookingService` completely; `pricing-service/src/__tests__/pricing.test.ts` tests only `getDemandMultiplier`, skipping routes and `calculatePrice`.
  - `services/auth-service/package.json:166-168` defines `"migrate": "prisma migrate dev"` without `--schema=../../infra/prisma/schema.prisma` and `"seed": "ts-node src/seed.ts"` (`src/seed.ts` does not exist).
  - `services/{api-gateway,booking-service}/tsconfig.json` compiles `src/__tests__` into `dist/` without `testPathIgnorePatterns`.
- **Smallest Proof Step**: `npm test -w services/host-service` → `No tests found, exiting with code 0`.
- **Recommended Fix Path**: Add unit/integration suites for the 4 untested services + real `bookingService`/`calculatePrice` tests + UI smoke tests, remove `--passWithNoTests` once tests exist, exclude `__tests__` from production `tsconfig.json`, and fix `auth-service` Prisma scripts.

---

### BUG-15 — Mobile Recursive Junction, Dependency Splits & Workspace Exclusion

- **Severity**: P3 (Low / Structural Hygiene) · **Confidence**: High
- **Affected Layers**: `apps/mobile/package.json`, root `package.json`, `shared/package.json`, `services/*/package.json`
- **Supporting Evidence**:
  - [`apps/mobile/package.json:27`](../apps/mobile/package.json#L27) lists unused `"parkly": "file:../.."`, verified via `Get-Item apps\mobile\node_modules\parkly` (`LinkType: Junction`, `Target: {E:\Github\Parkly}`) — creates recursive filesystem traversal cycles (slowing `expo export` / file scans).
  - Root `package.json:6-13,64-67` excludes `apps/mobile` from `workspaces` because root overrides pin `@types/react: 18.3.31` for React 18 web dashboards while `apps/mobile` runs `react: ^19.0.0`, `react-native: 0.79.1`, `@types/react: ~19.1.10`, and `.npmrc` `legacy-peer-deps=true` (while `expo@54.0.35` `bundledNativeModules.json` expects `react: 19.1.0` & `react-native: 0.81.5`).
  - `shared/package.json:20` pins `dotenv@^16.4.5` while all 11 services use `^17.4.2`.
- **Smallest Proof Step**: `Get-Item apps\mobile\node_modules\parkly | Select-Object LinkType, Target`.
- **Recommended Fix Path**: Remove unused `"parkly": "file:../.."` from `apps/mobile/package.json` and refresh `apps/mobile/package-lock.json`; align `dotenv` versions and document React 18/19 isolation or align Expo SDK versions cleanly.

---

## Prioritized Remediation Plan

### 1. Prove Now (Remaining Runtime Checks With Local DB / Docker Started)
1. Start Postgres (`docker compose up -d postgres`) and run `npx prisma migrate diff --from-migrations infra/prisma/migrations --to-schema-datamodel infra/prisma/schema.prisma --shadow-database-url <url> --exit-code` to record exact migration DDL diff output.
2. Run `docker build -f services/prediction-service/Dockerfile .` and `docker compose config` to capture container build/network errors cleanly.
3. Capture live `api-gateway` + `booking-service` + React web portal HTTP/console traces before & after auth/UUID alignment.

### 2. Fix Next (P0 → P1 Highest-Leverage Sequence)
1. **Clean up `shared/` foundation (`BUG-07`, `BUG-08`, `BUG-13`)**: Delete committed `shared/src/**/*.{js,d.ts,map}`, split `getConfig()` into lazy per-concern loaders (so EventBridge/AWS works without `JWT_*`), wrap all `publishEvent()` calls in `try/catch`, add `@opentelemetry/api` to `shared/package.json`, clear `createHealthCheck` timers, disable `pino-pretty` in `NODE_ENV=test`, and bind logger service name cleanly.
2. **Repair Gateway, Service Auth & Live Booking Flow (`BUG-01`, `BUG-02`, `BUG-09`, `BUG-10`)**: Align `/search`, `/pricing`, `/concierge` auth strategy, add `authenticate` on `POST /occupancy/simulate`, add `POST /notifications/devices` and `/vehicles` lookup/create, use UUIDs in `seed.ts`, fix `create.tsx` (`data` envelope + `paymentApi.confirm()` + unique IDs), add `finally { setLoading(false); }` to `booking/[id].tsx`, add `arrivalTime` future buffer, enforce webhook auth, and make `RealNotificationProvider` + `SagaOrchestrator` propagate failures honestly.
3. **Repair Web Portals (`BUG-03`)**: Unify Axios clients, add `/login` routes, fix `authStore` payload parsing (`data.data.tokens.accessToken`), fix `BookingsAdmin` (`userId` vs `driverId`), align enum filters (`UserRole`, `BookingStatus`), add missing Host/Admin endpoints or align routes (`GET /occupancy/:spaceId`), align AI modal/analytics field paths, and add missing modal/select CSS classes.
4. **Fix Prisma Migrations, Docker Compose/Dockerfiles & CDK (`BUG-04`, `BUG-05`, `BUG-06`)**: Add DPDPA migration SQL and remove duplicate DDL, attach infra containers to `parkly-net`, add `PREDICTION_URL`/`NOTIFICATION_URL` to Compose/gateway env, include `shared/package.json` & built `ai-agents` in Dockerfiles, and wire real built container images + RDS ingress + env-prefixed tables/bus in `ParklyStack`.

### 3. Follow Up Later (P2 → P3 Quality Gates & Hygiene)
1. **Fix `packages/ai-agents` Typecheck & Test Flake (`BUG-12`)**: Resolve all 47 TS errors in `tsconfig.test.json`, clear timeouts without `timer.unref()`, and enforce `npm run typecheck` in `.github/workflows/ci.yml`.
2. **Add Missing Lint & Test Suites (`BUG-11`, `BUG-14`)**: Install ESLint + root config so all 8 `lint` scripts succeed, add Jest/Vitest/Playwright tests for `host`, `notification`, `occupancy`, `search`, `mobile`, `host-dashboard`, and `admin-portal`, remove `--passWithNoTests`, and fix `auth-service` scripts.
3. **Remove Mobile Junction Loop (`BUG-15`)**: Remove unused `"parkly": "file:../.."` from `apps/mobile/package.json` and align `dotenv` / Expo dependency versions cleanly.
