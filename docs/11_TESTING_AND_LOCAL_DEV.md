# 🧪 Parkly — Local Development, Testing & Verification Guide

> **Audience**: Backend, Frontend, Mobile, and QA Engineers  
> **Test Runner**: Vitest (`packages/ai-agents`) + TypeScript Strict (`npm run build`)  
> **Infrastructure**: Docker Compose (PostgreSQL 16 + DynamoDB Local)

---

## 1. Local Full-Stack Setup (5 Steps)

### Prerequisites
- **Node.js `>= 20.0.0`** & **`npm >= 10.0.0`**
- **Docker Desktop** (for PostgreSQL 16 & DynamoDB Local)
- **Android Studio + Emulator** (optional, for native Expo mobile testing)

### Boot Infrastructure & Seed Data

```bash
# 1. Install all monorepo workspace dependencies & generate Prisma Client
npm install

# 2. Copy root environment config
cp .env.example .env

# 3. Start PostgreSQL 16 & DynamoDB Local, run migrations, and seed Chennai data
# Windows (PowerShell):
.\scripts\local-seed.ps1

# macOS / Linux:
./scripts/local-seed.sh
```

> **Note**: Both seed scripts initialize DynamoDB tables (`parkly-otp`, `parkly-occupancy`, `parkly-notifications`), deploy [`infra/prisma/schema.prisma`](../infra/prisma/schema.prisma), and run [`infra/prisma/seed.ts`](../infra/prisma/seed.ts).

---

## 2. Service Port & Gateway Map

All API traffic flows through the **API Gateway** ([`services/api-gateway/src/index.ts`](../services/api-gateway/src/index.ts)) on port **`4000`**:

| Component / Service | Default Port | Gateway Prefix | Access Model |
| :--- | :---: | :--- | :--- |
| **`api-gateway`** | `4000` | `/health`, `/ready`, `/api/v1/status` | Public health & reverse proxy (100 req / 15m/IP) |
| **`auth-service`** | `4001` | `/api/v1/auth` | Public (OTP request/verify + JWT issue) |
| **`booking-service`** | `4002` | `/api/v1/bookings` | Protected (JWT required) |
| **`payment-service`** | `4003` | `/api/v1/payments` | Protected (`webhook` public w/ HMAC verify) |
| **`search-service`** | `4004` | `/api/v1/search` | Public |
| **`prediction-service`** | `4005` | `/api/v1/predict`, `/api/v1/concierge` | Public |
| **`occupancy-service`** | `4007` | `/api/v1/occupancy` | Protected |
| **`pricing-service`** | `4008` | `/api/v1/pricing` | Public / Gateway routed |
| **`notification-service`** | `4009` | `/api/v1/notifications` | Protected |
| **`host-service`** | `4010` | `/api/v1/host` | Protected (`host` / `admin`) |
| **`admin-service`** | `4011` | `/api/v1/admin` | Protected (`admin`) |
| **`host-dashboard`** | `3001` | — | React 18 + Vite Web App |
| **`admin-portal`** | `3002` | — | React 18 + Vite Web App |

### Running Workspaces

```bash
# Run all 11 backend microservices concurrently
npm run dev

# Or run only core services (Gateway, Auth, Booking, Search)
npm run dev:core

# Web portals (separate terminals)
npm run dev:host-dashboard    # http://localhost:3001
npm run dev:admin-portal      # http://localhost:3002
```

---

## 3. Automated Testing & Verification Pyramid

### Zero-Network Multi-Agent Test Suite (`packages/ai-agents`)

`packages/ai-agents` runs completely offline against deterministic Chennai fixtures and 13 pluggable mock tool providers using **Vitest**:

```bash
# Run the complete multi-agent suite (24 test files · 360 tests)
npm test -w packages/ai-agents

# Or via root alias
npm run test:ai
```

#### Test Coverage Structure
- **`tests/unit/`**: Individual tests for `BaseAgent`, `Result` monad, `ExecutionContext`, `CircuitBreaker`, `InMemoryEventBus`, `SagaOrchestrator`, `Geohash`, `real-providers`, and all 7 specialized worker agents + `ParklyOrchestratorAgent`.
- **`tests/integration/`**: Multi-agent saga integration workflows.
- **`tests/e2e/` (4-Tier Opaque-Box Pyramid)**:
  - `tier1-features.e2e.spec.ts` — Happy-path coverage across all 13 agent/bus/saga features (65 tests).
  - `tier2-boundary.e2e.spec.ts` — Boundary clamps, schema validation errors, and failure modes (65 tests).
  - `tier3-pairwise.e2e.spec.ts` — Cross-agent combinations & circuit-breaker fallbacks (15 tests).
  - `tier4-scenarios.e2e.spec.ts` — End-to-end Chennai urban mobility scenarios: Diwali shopping surge in T. Nagar, Anna Nagar Metro commute, OMR overnight EV parking, overstay arbitration, dispute freezes, gate blockages, blurry tax-receipt KYC, and GCC weekly CO₂ reports (8 scenarios).

### Safety Invariants Enforced by Tests

| Domain Agent / Module | Enforced Safety Guard |
| :--- | :--- |
| **`HostOnboardingAgent`** | OCR confidence `< 0.85` or non-residential zoning flags `MANUAL_REVIEW_REQUIRED` (no auto-publish). |
| **`VisualInspectionAgent`** | Gate clearance `< 2.2m` or entrance obstruction returns `ACTION_REQUIRED`; plates/faces auto-redacted. |
| **`OccupancyPredictorAgent`** | Query latency `> 150ms` activates deterministic `(1 / demandMultiplier)` fallback heuristic. |
| **`DynamicPricingAgent`** | Hourly tariff strictly clamped to `[baseHourlyRate, maxMultiplier * baseHourlyRate]`. |
| **`DriverConciergeAgent`** | Blocked gate triggers automatic relocation to vetted backup bay within `<= 200m` at `₹0` surcharge. |
| **`DisputeMediationAgent`** | Compensation claims `> ₹1,000` freeze auto-payout and escalate to `ESCALATED_MANUAL`. |
| **`CityAnalyticsAgent`** | Exact abatement arithmetic: `CO₂ kg = cruisingMinutes * 0.0229`. |
| **`CircuitBreaker`** | `3` consecutive tool failures trip circuit to `OPEN` with `>= 1,000ms` cooldown and fallback routing. |

---

## 4. Monorepo Typecheck, Build & Cloud Verification

```bash
# Typecheck all workspaces
npm run typecheck

# Compile all workspaces & run service/app tests
npm run build
npm test -w services/auth-service
npm test -w services/booking-service
npm test -w services/host-service
npm test -w services/admin-service

# Mobile TypeScript & Jest verification (apps/mobile)
npx tsc -p apps/mobile/tsconfig.json --noEmit
cd apps/mobile && npx jest --runInBand

# Build web portals
npm run build -w apps/host-dashboard
npm run build -w apps/admin-portal

# Synthesize AWS CDK CloudFormation templates
npm run cdk:synth -w infra/cdk
```

> CI enforces all of these checks automatically via [`.github/workflows/ci.yml`](../.github/workflows/ci.yml).
