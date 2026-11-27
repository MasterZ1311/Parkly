# `ENG-D02` Agent C Audit Report: Docker, CI & Deployment Infrastructure

**Auditor**: Agent C (`infra-auditor`)  
**Repository**: `e:\Github\Parkly`  
**Branch**: `fix/stage-d-p0-restoration`  
**Audit Mode**: Strict read-only inspection (no source, Compose, Dockerfile, manifest, or CI edits; no `docker compose up/down` executed)  
**Date**: 2026-11-26  

---

## 1. Executive Summary & Finding Counts

A comprehensive verification was performed across [`docker-compose.yml`](../../docker-compose.yml), [`.env.example`](../../.env.example), [`.github/workflows/ci.yml`](../../.github/workflows/ci.yml), root/workspace manifests ([`package.json`](../../package.json), [`infra/prisma/package.json`](../../infra/prisma/package.json), [`services/auth-service/package.json`](../../services/auth-service/package.json), [`shared/package.json`](../../shared/package.json), [`packages/ai-agents/package.json`](../../packages/ai-agents/package.json), and all remaining service/app manifests), all **11** `services/*/Dockerfile` files, both web app Dockerfiles & Nginx configs ([`apps/host-dashboard/Dockerfile`](../../apps/host-dashboard/Dockerfile), [`apps/admin-portal/Dockerfile`](../../apps/admin-portal/Dockerfile)), and every service's runtime entrypoint (`services/*/src/index.ts`) and shared middleware (`shared/src/`).

While the `ENG-D02` changes fixed several earlier blockers (network attachment to `parkly-net`, `dynamodb-setup` polling & Compose `$$` escaping, `PREDICTION_URL`/`NOTIFICATION_URL` wiring, `shared/package.json` & `@parkly/ai-agents` Docker copies, removal of `2>/dev/null || true` on `prisma generate`, and `services/auth-service/package.json` schema/seed paths), **three P0 blockers** remain that break clean-checkout CI builds, CI database migration checks, and zero-`.env` Docker Compose startup.

| Severity | Count | Summary |
| :--- | :---: | :--- |
| **P0** | **3** | Clean CI `npm run build` workspace order failure (`@parkly/ai-agents`); CI `migrate diff --shadow-database-url "$DATABASE_URL"` colliding with `migrate deploy` on `parkly_test`; missing AWS credentials on DynamoDB services in Compose failing `auth-service` `/health` (`503`) and blocking `api-gateway` when `.env` is absent |
| **P1** | **5** | Missing `JWT_*` secrets + `NODE_ENV=production` on clean Compose boot; no automated Postgres migration/seed in Compose; `infra/prisma` omitted from root `workspaces` & `ts-node` absent from root `package.json`; cascading hard `503` `/health` coupling in `api-gateway` & `search-service`; missing `shared/node_modules` in service runtime images swapping `dotenv@16.6.1` -> `17.4.2` |
| **P2** | **7** | Missing root `.dockerignore`; unpruned `devDependencies` + `root` user in all 11 service runtime images; 7/8 service `tsconfig.json` files compiling `src/__tests__` into runtime `dist/`; UTF-8 BOM on 10/11 service Dockerfiles; unpinned `npm install` + hardcoded `VITE_API_URL` fallback in web Dockerfiles; Nginx static asset `location` dropping `server` security headers; `.env.example` non-mock `sns`/`fcm` defaults |
| **P3** | **4** | `dynamodb-local` `-inMemory` + `restart: unless-stopped` vs one-shot `dynamodb-setup`; IPv4-only `listen 8080` & unused `DYNAMO_ENDPOINT` on `api-gateway` / probe interval mismatch; CI `pg_isready` log noise & stale `(333 tests)` label; workspace version range skew & shallow `/health` endpoints in 6 DB/DynamoDB services |

---

## 2. Empirical Checks Executed (Read-Only)

| Check / Command | Result | Verified Observation |
| :--- | :---: | :--- |
| `docker compose config --quiet` | **PASS (`0`)** | Compose YAML interpolates and validates cleanly without a `.env` file. |
| `docker compose config` (inspected `dynamodb-setup`, networks, `depends_on`, env) | **PASS (`0`)** | All 16 services join `parkly-net`; `dynamodb-setup` `$$` escaping preserved correctly in canonical output. |
| `npx tsc -p services/<svc>/tsconfig.json --noEmit` (all 11 services) | **PASS (`0`)** | `11/11` services pass `tsc --noEmit` locally (`gw`, `auth`, `book`, `pay`, `srch`, `pred`, `occ`, `pric`, `noti`, `host`, `adm`). |
| `npx tsc -p apps/{host-dashboard,admin-portal}/tsconfig.json --noEmit` | **PASS (`0`)** | Both web frontends pass `tsc --noEmit` locally. |
| `@npmcli/map-workspaces` workspace execution order on [`package.json`](../../package.json) | **EXPOSED P0** | Runs `shared` (#1), then `services/*` (#2–#12) **before** `packages/ai-agents` (#15). |
| `npx ts-node -e "const s = require('./infra/prisma/seed'); console.log(Object.keys(s));"` | **PASS (`0`)** | Prints `[ 'seedDatabase' ]` without running seed; confirms `ts-node` currently resolves from root `node_modules` and loads `@parkly/shared` (with `shared/dist` prebuilt). |
| `@aws-sdk/client-dynamodb` `DescribeTableCommand` without `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` | **FAIL (~9s)** | Throws `CredentialsProviderError: Could not load credentials from any providers` after attempting IMDS fallback. |
| `package-lock.json` nested `node_modules` inspection | **EXPOSED P1** | `449` nested package entries exist; `shared/node_modules/dotenv` (`16.6.1`) is the sole nested non-dev dependency, while root `node_modules/dotenv` is `17.4.2`. |
| UTF-8 BOM & line-ending byte scan on all 13 Dockerfiles | **EXPOSED P2** | `10/11` service Dockerfiles begin with UTF-8 BOM `0xEF 0xBB 0xBF` (`auth-service` and both web Dockerfiles do not). |
| `git ls-files "**/dist/*"` | **PASS (`0`)** | Zero tracked `dist/` files; CI runners start with empty `dist/` directories. |

---

## 3. Verified Passing Infrastructure Areas

Before detailing defects, the following items in the audit scope were verified as properly aligned:

1. **Network Declaration (`parkly-net`)**: [`docker-compose.yml:434-436`](../../docker-compose.yml#L434-L436) declares `parkly-net` (`driver: bridge`) and attaches all **16** services (`postgres`, `dynamodb-local`, `dynamodb-setup`, all 11 microservices, `host-dashboard`, and `admin-portal`) to `parkly-net`.
2. **Service DNS Hostnames & Ports**:
   - [`docker-compose.yml:108-119`](../../docker-compose.yml#L108-L119) (`api-gateway`) sets `AUTH_URL`, `BOOKING_URL`, `PAYMENT_URL`, `SEARCH_URL`, `PREDICTION_URL`, `OCCUPANCY_URL`, `PRICING_URL`, `NOTIFICATION_URL`, `HOST_URL`, and `ADMIN_URL` using exact Compose service names and container ports (`4001`–`4005`, `4007`–`4011`), matching [`services/api-gateway/src/index.ts:120-131`](../../services/api-gateway/src/index.ts#L120-L131) and every service's `PORT` env variable (`AUTH_PORT`, ..., `ADMIN_PORT`).
   - [`docker-compose.yml:238`](../../docker-compose.yml#L238) (`search-service`) sets `PREDICTION_URL: http://prediction-service:4005`, matching [`services/search-service/src/index.ts:43`](../../services/search-service/src/index.ts#L43) and [`services/search-service/src/services/searchService.ts:126`](../../services/search-service/src/services/searchService.ts#L126).
   - [`.env.example:30-39`](../../.env.example#L30-L39) includes `PREDICTION_URL=http://localhost:4005` and `NOTIFICATION_URL=http://localhost:4009` for local host-run development.
3. **DynamoDB Polling, Table Schemas & Compose `$$` Escaping**:
   - [`docker-compose.yml:48-98`](../../docker-compose.yml#L48-L98) uses `entrypoint: ["/bin/sh", "-c"]`, polls `aws dynamodb list-tables --endpoint-url http://dynamodb-local:8000` with valid POSIX arithmetic/test and Compose escaping (`i=$$((i + 1))`, `if [ "$$i" -ge 30 ]`), and idempotently checks `describe-table` before `create-table` for `parkly-otp` (`phone` HASH + `expiresAt` TTL), `parkly-occupancy` (`spaceId` HASH, `timestamp` RANGE), and `parkly-notifications` (`pk` HASH, `sk` RANGE). These schemas match [`services/auth-service/src/services/otpService.ts:39-44`](../../services/auth-service/src/services/otpService.ts#L39-L44), [`services/occupancy-service/src/index.ts:58-66,106`](../../services/occupancy-service/src/index.ts#L58-L66), and [`services/notification-service/src/index.ts:144,197,224`](../../services/notification-service/src/index.ts#L144).
   - `auth-service` (`L169-170`), `occupancy-service` (`L289-290`), and `notification-service` (`L337-338`) gate on `dynamodb-setup: condition: service_completed_successfully`.
4. **Dockerfile Workspace Manifests, AI Agents & Prisma Generation Mechanics**:
   - All 11 `services/*/Dockerfile` files copy `shared/package.json` in both builder and runtime stages.
   - All 5 AI-enabled services (`admin-service`, `host-service`, `prediction-service`, `pricing-service`, `search-service`) copy `packages/ai-agents/package.json`, build `@parkly/ai-agents`, and copy `packages/ai-agents/package.json` + `dist` into runtime. The 6 non-AI services omit `packages/ai-agents` cleanly.
   - `--ignore-scripts` during `npm ci` avoids firing root [`package.json:15`](../../package.json#L15) `postinstall` (`prisma generate`) before `infra/prisma/` is copied. Although `--ignore-scripts` also skips `@prisma/engines` postinstall, `npx prisma generate --schema=./infra/prisma/schema.prisma` in all 7 Prisma service Dockerfiles calls `ensureBinariesExist()` via `@prisma/engines` (`node_modules/prisma/build/index.js`), downloading the Alpine Linux `linux-musl-openssl-3.0.x` engines and writing `/app/node_modules/.prisma/client` (resolved at runtime via `/app/node_modules/@prisma/client/default.js` -> `.prisma/client/default` when `COPY --from=builder /app/node_modules ./node_modules` runs).
   - [`services/auth-service/package.json:10-12`](../../services/auth-service/package.json#L10-L12) scripts now correctly point to `../../infra/prisma/schema.prisma` and `../../infra/prisma/seed.ts`.
5. **Healthcheck Probe Tooling & Paths**:
   - All 11 service images (`node:20-alpine`) and both web images (`nginxinc/nginx-unprivileged:alpine`) ship BusyBox `wget`.
   - Service `/health` endpoints match their Compose/Dockerfile ports (`4000`–`4005`, `4007`–`4011`); `api-gateway` mounts rate limiting only on `/api` ([`services/api-gateway/src/index.ts:116`](../../services/api-gateway/src/index.ts#L116)), not `/health`; and `apps/*/nginx.conf:8-12` implements `location = /health` returning `200 "OK\n"` on port `8080`.

---

## 4. Detailed Findings (`P0` / `P1` / `P2` / `P3`)

### P0 — Critical Blockers (Clean CI / Clean Compose Breakage)

#### `[P0-01]` Clean-Checkout CI `npm run build` Fails Because `services/*` Precedes `packages/*` (`@parkly/ai-agents`)
- **Locations**:
  - [`.github/workflows/ci.yml:29-33`](../../.github/workflows/ci.yml#L29-L33)
  - [`package.json:6-16`](../../package.json#L6-L16)
  - [`packages/ai-agents/package.json:6-10`](../../packages/ai-agents/package.json#L6-L10)
  - [`.gitignore:17`](../../.gitignore#L17)
  - [`services/admin-service/src/index.ts:27-35`](../../services/admin-service/src/index.ts#L27-L35), [`services/host-service/src/index.ts:33-41`](../../services/host-service/src/index.ts#L33-L41), [`services/prediction-service/src/index.ts:26-34`](../../services/prediction-service/src/index.ts#L26-L34), [`services/pricing-service/src/index.ts:24-28`](../../services/pricing-service/src/index.ts#L24-L28), [`services/search-service/src/routes/search.ts:11-17`](../../services/search-service/src/routes/search.ts#L11-L17)
- **Evidence**:
  1. In CI job `test`, step `"Run Autonomous Multi-Agent Tests"` runs `npm test -w packages/ai-agents` (`vitest run`, which compiles in memory without writing `dist/`), and the next step (`L33`) runs `npm run build` (`npm run build --workspaces --if-present`).
  2. `dist/` is gitignored (`git ls-files "**/dist/*"` returns empty).
  3. `@npmcli/map-workspaces` executes workspaces in the exact array order declared in [`package.json:6-13`](../../package.json#L6-L13):
     `1. @parkly/shared` -> `2. @parkly/admin-service` -> ... -> `12. @parkly/search-service` -> ... -> `15. @parkly/ai-agents` -> `16. parkly-cdk`.
  4. Five services import `@parkly/ai-agents` (whose `main`/`types` point to `dist/index.js` and `dist/index.d.ts`, with no `tsconfig` `paths` fallback in [`tsconfig.base.json`](../../tsconfig.base.json)).
- **Impact**: On any fresh CI runner (`ubuntu-latest`), `npm run build` hits `@parkly/admin-service` at position #2 before `@parkly/ai-agents` at position #15 has built `dist/index.d.ts`, failing with TypeScript `TS2307: Cannot find module '@parkly/ai-agents'`. Local `npm run build` only succeeded in prior validation because `packages/ai-agents/dist/` was already populated on disk.
- **Recommended Fix**: Place `"packages/*"` before `"services/*"` in [`package.json:6-13`](../../package.json#L6-L13) (or explicitly run `npm run build -w shared && npm run build -w packages/ai-agents` before `--workspaces` in `package.json:16` / `.github/workflows/ci.yml:33`).

---

#### `[P0-02]` CI `database-verification` Reuses `$DATABASE_URL` (`parkly_test`) as `--shadow-database-url` Before `prisma migrate deploy`
- **Locations**:
  - [`.github/workflows/ci.yml:95-108,127-140`](../../.github/workflows/ci.yml#L127-L140)
- **Evidence**:
  - `services.postgres` (`L96-101`) provisions a single database (`POSTGRES_DB: parkly_test`).
  - Step `"Verify No Migration Drift"` (`L127-130`) runs:
    `npx prisma migrate diff --from-migrations infra/prisma/migrations --to-schema-datamodel infra/prisma/schema.prisma --shadow-database-url "$DATABASE_URL" --exit-code`
    with `DATABASE_URL=postgresql://parkly:password@localhost:5432/parkly_test?schema=public`.
  - Step `"Apply Migrations Cleanly to Test Database"` (`L132-140`) immediately runs `npx prisma migrate deploy --schema=infra/prisma/schema.prisma` against that **same** `parkly_test` database.
- **Impact**: Prisma requires `--shadow-database-url` to point to a **separate, isolated disposable database**. Prisma's schema engine executes destructive schema resets (`DROP SCHEMA ... CASCADE; CREATE SCHEMA ...`) and replays migration SQL directly onto the shadow database without maintaining `_prisma_migrations`. Sharing `parkly_test` between `--shadow-database-url` and `prisma migrate deploy` violates shadow-DB isolation and risks `P3005: The database schema is not empty` on `migrate deploy` (this live CI flow was blocked/unexecuted in [`ENG-D02_DATABASE_REPORT.md:101-102`](../ENG-D02_DATABASE_REPORT.md#L101-L102)).
- **Recommended Fix**: Create a separate dedicated shadow database in the CI job (e.g., `psql ... -c "CREATE DATABASE parkly_shadow;"`) and pass `SHADOW_DATABASE_URL="postgresql://parkly:password@localhost:5432/parkly_shadow?schema=public"` exclusively to `--shadow-database-url`, leaving `parkly_test` pristine for `prisma migrate deploy`.

---

#### `[P0-03]` Missing AWS Credentials on DynamoDB Consumer Services in `docker-compose.yml` Breaks `auth-service` `/health` (`503`) and Blocks `api-gateway` When `.env` Is Absent
- **Locations**:
  - [`docker-compose.yml:10-13,54-57,123-125,160-170,282-290,331-338`](../../docker-compose.yml#L160-L170)
  - [`services/auth-service/src/index.ts:45-49`](../../services/auth-service/src/index.ts#L45-L49)
  - [`shared/src/health/index.ts:53-61,125-137`](../../shared/src/health/index.ts#L125-L137)
  - [`shared/src/aws/clients.ts:13-42`](../../shared/src/aws/clients.ts#L13-L42)
- **Evidence**:
  1. `docker-compose.yml:10-13` sets `env_file: [{ path: .env, required: false }]` so Compose starts on fresh clones without `.env`.
  2. `dynamodb-setup` (`L54-57`) sets `AWS_DEFAULT_REGION: us-east-1`, `AWS_ACCESS_KEY_ID: local`, `AWS_SECRET_ACCESS_KEY: local`.
  3. **`auth-service` (`L160-163`), `occupancy-service` (`L282-285`), and `notification-service` (`L331-333`) do NOT set `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, or `AWS_REGION` in `environment:`**.
  4. `auth-service` `/health` runs `createDynamoCheck(getDocClient, getConfig().dynamoTableOtp)` -> `DescribeTableCommand` via `getDynamoClient()`.
  5. Empirically tested with `@aws-sdk/client-dynamodb`: when `AWS_ACCESS_KEY_ID`/`AWS_SECRET_ACCESS_KEY` are unset, `DynamoDBClient.send()` falls through the default credential chain (IMDS probe ~9s) and rejects with `CredentialsProviderError: Could not load credentials from any providers`.
- **Impact**: On a fresh clone without `.env`, `auth-service` `/health` hits `createHealthCheck`'s 3s timeout / `unhealthy` check (`shared/src/health/index.ts:56-59,98`) and returns **HTTP 503**, never reaching `service_healthy`. Because `api-gateway` (`L124-125`) depends on `auth-service: condition: service_healthy`, **`api-gateway` never starts**. Likewise, `occupancy-service` and `notification-service` fail all DynamoDB operations with `CredentialsProviderError` (which `occupancy-service`'s background simulator silently swallows at [`services/occupancy-service/src/index.ts:134`](../../services/occupancy-service/src/index.ts#L134)).
- **Recommended Fix**: Add `${AWS_REGION:-us-east-1}`, `${AWS_ACCESS_KEY_ID:-local}`, and `${AWS_SECRET_ACCESS_KEY:-local}` defaults in `docker-compose.yml` for local DynamoDB/AWS consumers (consistent with `dynamodb-setup` and `POSTGRES_PASSWORD: password`).

---

### P1 — High-Severity Operational, Runtime & Dependency Risks

#### `[P1-01]` Clean Compose Boot Without `.env` Leaves `JWT_ACCESS_SECRET`/`JWT_REFRESH_SECRET` Unset and Runs 10 Services in `NODE_ENV=production`
- **Locations**:
  - [`docker-compose.yml:10-13,108-395`](../../docker-compose.yml#L10-L13)
  - All 11 `services/*/Dockerfile` (`ENV NODE_ENV=production`) vs [`docker-compose.yml:285`](../../docker-compose.yml#L285) (`occupancy-service` `NODE_ENV: development`)
  - [`shared/src/config/index.ts:121,126-131`](../../shared/src/config/index.ts#L126-L131)
  - [`shared/src/middleware/auth.ts:34-36`](../../shared/src/middleware/auth.ts#L34-L36)
  - [`services/auth-service/src/routes/auth.ts:69,76`](../../services/auth-service/src/routes/auth.ts#L69)
  - [`shared/src/utils/cors.ts:66`](../../shared/src/utils/cors.ts#L66)
- **Evidence**:
  - Because `env_file` uses `required: false` and Compose does not inject `JWT_ACCESS_SECRET` or `JWT_REFRESH_SECRET`, containers boot with both secrets `undefined`. `shared/src/config/index.ts:126-131` validates them via lazy getters (`requireEnv()`), so `/health` passes while every JWT signing/verification path throws `Missing required environment variable: JWT_ACCESS_SECRET` (HTTP 500).
  - Additionally, because every service Dockerfile sets `ENV NODE_ENV=production` and only `occupancy-service` overrides `NODE_ENV: development` in Compose, the other 10 services run in `production` mode when `.env` is absent — hiding `devOtp` in `/auth/otp/request` (`auth.ts:69,76`) and tightening CORS localhost matching (`cors.ts:66`).
- **Recommended Fix**: Either provide explicit local-dev Compose variable interpolation (e.g., `${JWT_ACCESS_SECRET:-dev-only-local-access-secret-change-me}` and `NODE_ENV: ${NODE_ENV:-development}`) or document/enforce `.env` generation in local Compose startup scripts rather than failing silently at request time.

#### `[P1-02]` `docker-compose.yml` Lacks Automated Prisma Migration or Seed Execution on Fresh PostgreSQL Volumes
- **Locations**:
  - [`docker-compose.yml:17-35,166-202,216-245,312-322,360-387`](../../docker-compose.yml#L17-L35)
  - [`shared/src/health/index.ts:110-120`](../../shared/src/health/index.ts#L110-L120)
  - [`services/payment-service/src/index.ts:459-461`](../../services/payment-service/src/index.ts#L459-L461), [`services/pricing-service/src/index.ts:194-196`](../../services/pricing-service/src/index.ts#L194-L196), [`services/host-service/src/index.ts:395-397`](../../services/host-service/src/index.ts#L395-L397), [`services/admin-service/src/index.ts:344-346`](../../services/admin-service/src/index.ts#L344-L346)
- **Evidence**:
  - `postgres` creates an empty `parkly` database with no `/docker-entrypoint-initdb.d/` SQL and no Compose `db-migrate` init service (analogous to `dynamodb-setup`).
  - `createPrismaCheck(prisma)` runs `SELECT 1` (passes with zero tables), and `payment`/`pricing`/`host`/`admin` `/health` handlers do not query PostgreSQL at all.
- **Impact**: On a fresh `docker compose up`, all 7 PostgreSQL services report `healthy` against an unmigrated empty database and fail every query with Prisma `P2021` (`The table ... does not exist`) until the user runs host-side `npm run migrate:deploy`.
- **Recommended Fix**: Add an idempotent one-shot `postgres-migrate` Compose service (`prisma migrate deploy --schema=infra/prisma/schema.prisma`, `condition: service_completed_successfully`) or document the mandatory manual migration step alongside `docker compose up`.

#### `[P1-03]` `infra/prisma` Excluded from Root `"workspaces"` and `ts-node` Absent from Root `package.json`
- **Locations**:
  - [`package.json:6-13,43,51-59`](../../package.json#L6-L13)
  - [`infra/prisma/package.json:10,20`](../../infra/prisma/package.json#L10)
  - [`infra/cdk/package.json:22`](../../infra/cdk/package.json#L22)
  - [`services/auth-service/package.json:12`](../../services/auth-service/package.json#L12)
  - [`.github/workflows/ci.yml:136-140`](../../.github/workflows/ci.yml#L136-L140)
- **Evidence**:
  - `package.json:6-13` omits `infra/prisma` from `"workspaces"`, so `npm ci` never installs `infra/prisma/package.json`'s dependencies (`infra/prisma/node_modules` does not exist).
  - Neither root `package.json` nor `services/auth-service/package.json` declares `ts-node`, yet `package.json:43` (`"seed": "ts-node infra/prisma/seed.ts"`), `services/auth-service/package.json:12`, and `.github/workflows/ci.yml:139-140` (`npx ts-node infra/prisma/seed.ts`) all depend on it.
  - Lockfile inspection proves `node_modules/ts-node` (`10.9.2`) is currently hoisted **only** because `infra/cdk/package.json:22` declares `"ts-node": "^10.9.2"` and `ts-node-dev` depends on `ts-node@^10.4.0`.
  - Additionally, while CI runs `npm run build -w shared` (`ci.yml:136`) before `seed.ts`, local scripts (`package.json:43`, `services/auth-service/package.json:12`) fail with `Cannot find module '@parkly/shared'` on clean checkouts if `shared` is unbuilt.
- **Recommended Fix**: Add `"ts-node": "^10.9.2"` to root `package.json` `devDependencies` (or add `"infra/prisma"` to `"workspaces"` and regenerate `package-lock.json`), and pre-build `@parkly/shared` in `"seed"` (`npm run build -w shared && ts-node infra/prisma/seed.ts`).

#### `[P1-04]` Cascading Hard-Failure Health Coupling in `api-gateway` and `search-service`
- **Locations**:
  - [`services/api-gateway/src/index.ts:155-181`](../../services/api-gateway/src/index.ts#L155-L181)
  - [`services/search-service/src/index.ts:41-45`](../../services/search-service/src/index.ts#L41-L45)
  - [`services/search-service/src/services/searchService.ts:114-146`](../../services/search-service/src/services/searchService.ts#L114-L146)
  - [`shared/src/health/index.ts:79-99`](../../shared/src/health/index.ts#L79-L99)
  - [`docker-compose.yml:123-150,241-252`](../../docker-compose.yml#L123-L150)
- **Evidence**:
  - `api-gateway` `/health` probes all 10 microservices via `createHttpCheck(...)`; `search-service` `/health` probes `prediction-service`. In `createHealthCheck`, any `unhealthy` dependency sets `overallStatus = 'down'` and returns **HTTP 503**.
  - Docker Compose (`L123-149`, `L241-252`) uses `/health` for both `depends_on: service_healthy` startup gating and runtime container `healthcheck`.
  - Meanwhile, `searchService.ts:114-146` explicitly catches prediction failures and degrades gracefully (`predictionStatus = 'unavailable'`), and `api-gateway` already provides `/ready` (`L170-181`, checking only `auth-service`).
- **Impact**: An outage or restart of any single optional/auxiliary service (e.g., `prediction-service` or `notification-service`) causes `search-service` and `api-gateway` to fail Docker/ALB health checks with HTTP 503, tearing down traffic across the whole API gateway.
- **Recommended Fix**: Decouple liveness/readiness (`/health` or Compose `healthcheck` probing `/ready` on `api-gateway` and local DB/self checks on `search-service`, marking non-critical dependencies `degraded` -> HTTP `200` rather than `unhealthy` -> `503`), and move full topology reporting to `/api/v1/status` or deep diagnostics.

#### `[P1-05]` Missing `shared/node_modules` in Service Runtime Dockerfiles Silently Swaps `dotenv@16.6.1` for `dotenv@17.4.2`
- **Locations**:
  - [`shared/package.json:21`](../../shared/package.json#L21) (`"dotenv": "^16.4.5"`)
  - [`shared/src/config/index.ts:6,13`](../../shared/src/config/index.ts#L6)
  - All 11 `services/*/package.json` (`"dotenv": "^17.4.2"`)
  - All 11 `services/*/Dockerfile` (runtime `COPY --from=builder /app/node_modules ./node_modules` without `/app/shared/node_modules`)
  - [`package-lock.json`](../../package-lock.json) (`shared/node_modules/dotenv` = `16.6.1` vs `node_modules/dotenv` = `17.4.2`)
- **Evidence**:
  - Lockfile analysis shows `shared/node_modules/dotenv` (`16.6.1`) is the only non-dev nested dependency in the entire workspace tree.
  - Because none of the 11 service Dockerfiles copy `/app/shared/node_modules` into the `runtime` stage, Node resolution in `/app/shared/dist/config/index.js` falls back to `/app/node_modules/dotenv` (`17.4.2`, a major version higher than `shared/package.json` declares).
- **Recommended Fix**: Align `dotenv` to a single version range across `shared/package.json` and `services/*/package.json` (and/or copy `shared/node_modules` when non-empty).

---

### P2 — Medium-Severity Build, Container Hygiene & Security Findings

#### `[P2-01]` Missing Root `.dockerignore` Sends Multi-GB Context to Docker Daemon on All 11 Service Builds
- **Location**: Repo root (no `.dockerignore` file; verified `Test-Path .dockerignore` = `False`) vs `context: .` on all 11 services in [`docker-compose.yml:104,156,183,207,231,258,278,303,327,351,375`](../../docker-compose.yml#L104).
- **Impact**: Every build transfers root `node_modules/`, `apps/mobile/node_modules/`, `services/*/node_modules/`, `.git/`, `infra/cdk/cdk.out/`, `brag-output/`, and local `.env` files into the Docker daemon context.
- **Recommended Fix**: Add root `.dockerignore` excluding `node_modules`, `**/node_modules`, `.git`, `**/dist`, `.env*`, `infra/cdk/cdk.out`, `coverage`, `.expo`, and `brag-output`.

#### `[P2-02]` All 11 Service Dockerfiles Ship Unpruned `devDependencies` into Runtime Images and Run as `root`
- **Locations**: All 11 `services/*/Dockerfile` (`npm ci ...` without `--omit=dev` or `npm prune --omit=dev`, followed by `COPY --from=builder /app/node_modules ./node_modules`; no `USER node` directive, unlike [`apps/host-dashboard/Dockerfile:38`](../../apps/host-dashboard/Dockerfile#L38) and [`apps/admin-portal/Dockerfile:38`](../../apps/admin-portal/Dockerfile#L38) which enforce `USER 101`).
- **Impact**: Every production container carries `typescript`, `prisma` CLI, `@prisma/engines` schema-engine binaries, `supertest`, `@types/*`, `concurrently`, and `rimraf`, and runs Node processes as UID `0` (`root`).
- **Recommended Fix**: Add a `prod-deps` stage (or run `npm prune --omit=dev --workspaces` + preserve `.prisma/client`, or copy pruned production modules) and set `USER node` in all 11 runtime stages.

#### `[P2-03]` 7 of 8 Service `tsconfig.json` Files Compile `src/__tests__/*.test.ts` into Production `dist/`
- **Locations**:
  - [`services/admin-service/tsconfig.json:8`](../../services/admin-service/tsconfig.json#L8), [`services/api-gateway/tsconfig.json:8`](../../services/api-gateway/tsconfig.json#L8), [`services/auth-service/tsconfig.json:8`](../../services/auth-service/tsconfig.json#L8), [`services/booking-service/tsconfig.json:8`](../../services/booking-service/tsconfig.json#L8), [`services/payment-service/tsconfig.json:8`](../../services/payment-service/tsconfig.json#L8), [`services/prediction-service/tsconfig.json:8`](../../services/prediction-service/tsconfig.json#L8), [`services/pricing-service/tsconfig.json:8`](../../services/pricing-service/tsconfig.json#L8)
  - Contrast with [`services/host-service/tsconfig.json:8`](../../services/host-service/tsconfig.json#L8) (`"exclude": ["node_modules", "dist", "src/__tests__"]`).
- **Impact**: Production runtime images receive compiled `dist/__tests__/*.test.js` + `.d.ts` + `.js.map` files, and `tsc` inside Docker implicitly relies on `--include-workspace-root` pulling root `devDependencies` (`supertest`, `@types/supertest`) and workspace `jest`/`@types/jest`.
- **Recommended Fix**: Exclude `"src/__tests__"` (and `"**/*.test.ts"`, `"**/*.spec.ts"`) across all service `tsconfig.json` files, matching `host-service` and `shared`.

#### `[P2-04]` 10 of 11 Service Dockerfiles Begin with a UTF-8 BOM (`0xEF 0xBB 0xBF`)
- **Locations**: `services/{api-gateway,booking-service,payment-service,search-service,prediction-service,occupancy-service,pricing-service,notification-service,host-service,admin-service}/Dockerfile` line `1` (`EF BB BF 46`). (Only `services/auth-service/Dockerfile` and the two web Dockerfiles are clean UTF-8 without BOM.)
- **Impact**: Legacy Docker builders (`DOCKER_BUILDKIT=0`) and Dockerfile linters (`hadolint`) fail with `unknown instruction: ﻿FROM`.
- **Recommended Fix**: Re-save those 10 Dockerfiles as UTF-8 without BOM.

#### `[P2-05]` Web Dockerfiles Use Unpinned `npm install`, Bypass Root `overrides`, and Hardcode `VITE_API_URL` Fallback
- **Locations**:
  - [`apps/host-dashboard/Dockerfile:8-17`](../../apps/host-dashboard/Dockerfile#L8-L17), [`apps/admin-portal/Dockerfile:8-17`](../../apps/admin-portal/Dockerfile#L8-L17)
  - [`apps/host-dashboard/.dockerignore:4`](../../apps/host-dashboard/.dockerignore#L4), [`apps/admin-portal/.dockerignore:4`](../../apps/admin-portal/.dockerignore#L4)
  - [`package.json:64-67`](../../package.json#L64-L67) (`overrides` for `@types/react` and `@types/react-dom`)
  - [`apps/host-dashboard/src/utils/apiClient.ts:8`](../../apps/host-dashboard/src/utils/apiClient.ts#L8), [`apps/admin-portal/src/utils/api.ts:11`](../../apps/admin-portal/src/utils/api.ts#L11)
- **Evidence**: Neither frontend has a `package-lock.json`, so Docker builds use unpinned `npm install` isolated from root `package-lock.json` and root `overrides`. Neither Dockerfile declares `ARG VITE_API_URL` / `ENV VITE_API_URL`, and `.dockerignore` excludes `.env*`, so Vite bakes `'http://localhost:4000/api/v1'` into static JS bundles (usable only when accessed from `localhost`).
- **Recommended Fix**: Support `ARG VITE_API_URL` / `ENV VITE_API_URL` in both web Dockerfiles and align builds with root lockfile/workspaces or app-level lockfiles.

#### `[P2-06]` `nginx.conf` in Both Web Apps Drops `server`-Level Security Headers on Static Assets
- **Locations**: [`apps/host-dashboard/nginx.conf:20-31`](../../apps/host-dashboard/nginx.conf#L20-L31), [`apps/admin-portal/nginx.conf:20-31`](../../apps/admin-portal/nginx.conf#L20-L31)
- **Evidence**: In Nginx, using `add_header` inside a `location` block suppresses all `add_header` directives inherited from the `server` block. `location = /index.html` (`L34-41`) repeats the security headers, whereas `location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2)$` (`L27-31`) defines only `Cache-Control` and `X-Content-Type-Options`, stripping `X-Frame-Options`, `X-XSS-Protection`, `Referrer-Policy`, and `Content-Security-Policy` from static assets.

#### `[P2-07]` `.env.example` Ships Non-Mock `SMS_PROVIDER=sns` and `PUSH_PROVIDER=fcm` with Placeholder Credentials
- **Locations**: [`.env.example:86,98-101`](../../.env.example#L86), [`services/notification-service/src/index.ts:52-75,286-296`](../../services/notification-service/src/index.ts#L52-L75), [`services/auth-service/src/services/otpService.ts:53-88`](../../services/auth-service/src/services/otpService.ts#L53-L88)
- **Evidence**: Despite the `# mock | sns | twilio` and `# mock | fcm` comments, `.env.example` defaults to `sns` and `fcm` with placeholder `FCM_PROJECT_ID=your-firebase-project-id` and `FCM_PRIVATE_KEY=-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n`. Copying `.env.example` to `.env` triggers `Failed to initialize Firebase Admin SDK` errors on every `notification-service` `/health` check (`L287` calls `getFirebaseApp()`), and causes `auth-service` to attempt real AWS SNS calls on OTP generation.

---

### P3 — Low-Severity Hygiene & Consistency Notes

1. **`[P3-01]` `dynamodb-local` `-inMemory` Volatility vs One-Shot `dynamodb-setup`** ([`docker-compose.yml:40-41,48-98`](../../docker-compose.yml#L40-L41)): `dynamodb-local` has `restart: unless-stopped` and `-inMemory` storage, whereas `dynamodb-setup` runs once. If `parkly-dynamodb` restarts independently, tables are lost until `dynamodb-setup` is manually re-run.
2. **`[P3-02]` Nginx IPv4-Only Listener, Unused Gateway Env, and Healthcheck Interval Skew**:
   - [`apps/host-dashboard/nginx.conf:2`](../../apps/host-dashboard/nginx.conf#L2) & [`apps/admin-portal/nginx.conf:2`](../../apps/admin-portal/nginx.conf#L2) declare `listen 8080;` (IPv4 only, omitting `listen [::]:8080;`) while Docker healthchecks probe `http://localhost:8080/health` (`docker-compose.yml:406,423`). Using `127.0.0.1` or adding `listen [::]:8080;` avoids IPv6 fallback probes.
   - [`docker-compose.yml:120`](../../docker-compose.yml#L120) sets `DYNAMO_ENDPOINT: http://dynamodb-local:8000` on `api-gateway`, which does not use DynamoDB.
   - All 11 `services/*/Dockerfile` set `HEALTHCHECK --interval=30s`, whereas `docker-compose.yml` overrides `interval: 15s`.
   - [`shared/src/middleware/requestLogger.ts:12-44`](../../shared/src/middleware/requestLogger.ts#L12-L44) logs every `/health` poll at `info` level across all 11 services.
3. **`[P3-03]` CI PostgreSQL Healthcheck & Stale Test Label**:
   - [`.github/workflows/ci.yml:105`](../../.github/workflows/ci.yml#L105): `--health-cmd pg_isready` omits `-U parkly -d parkly_test` (emits harmless `role "root" does not exist` noise in Postgres logs, unlike [`docker-compose.yml:30`](../../docker-compose.yml#L30)).
   - [`.github/workflows/ci.yml:29`](../../.github/workflows/ci.yml#L29): Step name still reads `(333 tests)`, whereas `packages/ai-agents` now reports `360` tests ([`ENG-D02_DATABASE_REPORT.md:93`](../ENG-D02_DATABASE_REPORT.md#L93)).
4. **`[P3-04]` Workspace Dependency Version Skew & Shallow `/health` Endpoints**:
   - [`package.json:52,55,58`](../../package.json#L52) and [`infra/prisma/package.json:16,19,21`](../../infra/prisma/package.json#L16) specify `prisma`/`@prisma/client` `^5.16.1` and `typescript` `^5.4.5`, while the 7 Prisma service manifests specify `^5.16.0` and `^5.3.3` (currently unified by `package-lock.json` at `5.22.0` for Prisma).
   - Six stateful services (`payment`, `occupancy`, `pricing`, `notification`, `host`, `admin`) implement shallow `200 OK` `/health` endpoints without `createPrismaCheck`/`createDynamoCheck`, unlike `auth-service`, `booking-service`, and `search-service`.
