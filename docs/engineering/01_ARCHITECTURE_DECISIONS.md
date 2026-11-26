# 01 — Architecture Decisions & 11-Service Audit (Stage B)

> **Repository Baseline**: `e:\Github\Parkly` (`main` @ commit `738e176`)  
> **Scope**: Mandatory pre-migration audit of the 11 existing services and formal Architecture Decision Records (`ADR-001` through `ADR-008`) governing the move from prototype to production-oriented modular architecture.

---

## 1. Comprehensive Audit of the Existing 11 Microservices

Per **Decision A**, existing services are audited before any consolidation or removal.

### 1.1 Service Dependency, Data Store & Ownership Matrix

| Service & Port | Key Runtime Dependencies | Data Stores Touched | `@parkly/ai-agents` Usage (Mode) | Owned Route Prefixes (via Gateway `:4000`) | Target `parkly-core-api` Module(s) |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **`api-gateway`** (`:4000`) | `@parkly/shared`, `http-proxy-middleware`, `express-rate-limit`, `ioredis`, `rate-limit-redis` | Optional Redis (`rate-limit`) | None | `/health`, `/ready`, `/api/v1/status`, edge proxy for `/api/v1/*` & unversioned paths | Retained as Edge/BFF Proxy (gradually routes migrated prefixes to `parkly-core-api`) |
| **`auth-service`** (`:4001`) | `@parkly/shared`, `@prisma/client`, AWS DynamoDB + SNS | PostgreSQL (`users`), DynamoDB (`parkly-otp`), AWS SNS | None | `/auth/otp/request`, `/auth/otp/verify`, `/auth/refresh`, `/auth/logout`, `/auth/me` *(missing `/vehicles`, `/auth/profile`)* | `auth`, `users`, `vehicles` |
| **`booking-service`** (`:4002`) | `@parkly/shared`, `@prisma/client` | PostgreSQL (`bookings`), EventBridge (outbound) | None | `/bookings` (`POST`, `GET`, `GET /:id`, `PUT /:id/cancel`, `PUT /:id/complete`) | `bookings`, `gate-access` *(check-in/out)* |
| **`payment-service`** (`:4003`) | `@parkly/shared`, `@prisma/client`, `https` (Razorpay) | PostgreSQL (`payments`, **mutates `bookings`**), EventBridge | None | `/payments/initiate`, `/payments/:id/confirm`, `/payments/:id/refund`, `/payments/webhook` | `payments` |
| **`search-service`** (`:4004`) | `@parkly/shared`, `@parkly/ai-agents`, `@prisma/client`, `axios` | PostgreSQL (`parking_spaces`), HTTP -> `prediction-service` | `DriverConciergeAgent` (**Mock tools**) | `/search` (`POST`, `GET /spaces/:id`, `GET /:id`, **`POST /concierge`**) | `search` |
| **`prediction-service`** (`:4005`) | `@parkly/shared`, `@parkly/ai-agents` | In-memory rules only | `OccupancyPredictorAgent`, `DriverConciergeAgent` (**Mock tools**) | `/predict/occupancy`, `/predict`, **`/predict/concierge` & `/concierge`** | `search` / adapter -> stays isolated if ML model separates later |
| **`occupancy-service`** (`:4007`) | `@parkly/shared`, AWS DynamoDB | DynamoDB (`parkly-occupancy`), EventBridge | None | `/occupancy/ingest`, `/occupancy/:spaceId`, `/occupancy/simulate` | `gate-access` / `parking-spaces` (live bay counters) |
| **`pricing-service`** (`:4008`) | `@parkly/shared`, `@parkly/ai-agents`, `@prisma/client` | PostgreSQL (`parking_spaces`, `pricing_rules`) | `DynamicPricingAgent` (**Mock tool**) | `/pricing/:spaceId`, `/pricing/ai-quote` | `bookings` / `parking-spaces` |
| **`notification-service`** (`:4009`) | `@parkly/shared`, AWS DynamoDB + SNS, `firebase-admin` | DynamoDB (`parkly-notifications`), AWS SNS + FCM | None | `/notifications`, `/notifications/:id/read`, `/notifications/send` *(missing `/devices`)* | `notifications` |
| **`host-service`** (`:4010`) | `@parkly/shared`, `@parkly/ai-agents`, `@prisma/client`, AWS S3 + Presigner | PostgreSQL (`hosts`, `parking_spaces`, `availability_slots`), S3, EventBridge | `HostOnboardingAgent`, `VisualInspectionAgent` (**Mock tools**) | `/host/listings`, `/host/listings/:id/upload-url`, `/host/listings/:id/ai-verify` | `hosts`, `parking-spaces` |
| **`admin-service`** (`:4011`) | `@parkly/shared`, `@parkly/ai-agents`, `@prisma/client` | PostgreSQL (`users`, `vehicles`, `hosts`, `parking_spaces`, `bookings`), EventBridge | `DisputeMediationAgent`, `CityAnalyticsAgent` (**Mock tools**) | `/admin/users`, `/admin/users/:id` (`GET`/`DELETE`/`anonymize`), `/admin/bookings`, `/admin/verifications/*`, `/admin/metrics`, `/admin/disputes/:id/mediate`, `/admin/analytics/city` | `admin`, `compliance` |

### 1.2 Shared Contracts & Observed Duplication

1. **Shared Database Trap**: **7 of 11** services (`auth`, `booking`, `payment`, `search`, `pricing`, `host`, `admin`) instantiate separate `new PrismaClient()` pools against the **exact same PostgreSQL database**, while cross-service writes happen directly (e.g., `payment-service` mutates `prisma.booking.update(...)` outside `booking-service`'s codebase and locks).
2. **Shared Package Coupling (`@parkly/shared`)**: All 11 services depend on [`shared/src/types/index.ts`](../../shared/src/types/index.ts) (`ApiResponse`, `JwtPayload`, `ParklyEvent`, domain DTOs), middleware (`authenticate`, `requireRole`, `errorHandler`, `requestLogger`, `responseTimer`), Pino logger, and [`getConfig()`](../../shared/src/config/index.ts).
3. **Duplicated Functionality**:
   - **Express Server Bootstrap**: Repeated 11x across services (`helmet`, `securityHeaders`, `responseTimer`, `cors`, `express.json`, `requestLogger`, `/health`, `notFoundHandler`, `errorHandler`, `SIGTERM`).
   - **Duplicated Concierge Agent Hosting**: `DriverConciergeAgent` is wired identically in both `search-service` (`POST /search/concierge`) and `prediction-service` (`POST /predict/concierge` & `POST /concierge`).
   - **Client Axios Duplication**: Both `apps/host-dashboard` and `apps/admin-portal` define duplicate `src/utils/api.ts` and `src/utils/apiClient.ts` files pointing to conflicting route paths.
   - **Geohash Duplication**: Re-implemented in both `shared/src/utils/index.ts` and `packages/ai-agents/src/tools/utils/geohash.ts`.
4. **Compatibility Requirements During Migration**:
   - All external clients (`apps/mobile`, `apps/host-dashboard`, `apps/admin-portal`) target `http://<host>:4000/api/v1/*` (and unversioned paths proxied by `api-gateway`).
   - Legacy route shapes (`{ success: true, data: ... }`) must be preserved or cleanly adapted via `api-gateway` proxy targets (`AUTH_URL`, `BOOKING_URL`, etc.) pointing progressively at `parkly-core-api` as each module migrates and passes contract tests.

---

## 2. Architecture Decision Records (ADRs)

### ADR-001: Adopt a Bounded Modular Monolith (`services/parkly-core-api/`) via Strangler Migration

- **Context**: Running 11 Express services over one shared PostgreSQL DB introduces multi-service deployment breakage (`BUG-05`, `BUG-06`), split auth enforcement (`BUG-02`), duplicate routes (`NEW-09`), and cross-service table mutations without transactional safety (`BUG-01`, `BUG-08`), while delivering zero database isolation.
- **Decision**: Consolidate transactional backend capabilities into a **Bounded Modular Monolith** at `services/parkly-core-api/` structured into 12 strict domain modules:
  `auth`, `users`, `vehicles`, `parking-spaces`, `hosts`, `search`, `bookings`, `payments`, `gate-access`, `notifications`, `admin`, `compliance`.
- **Internal Module Structure Law**:
  Every module inside `services/parkly-core-api/src/modules/<module>/` **must** contain:
  - `routes/` (HTTP transport & adapters only)
  - `application/` (use-case orchestration & transaction boundaries)
  - `domain/` (pure business rules, invariants, state machines)
  - `repositories/` (Prisma/PostGIS persistence boundary; modules never import another module's private tables directly — cross-module reads/writes go through public module service interfaces)
  - `schemas/` (Zod request/response contracts)
  - `__tests__/` (module unit & integration tests)
- **Migration Guardrail**: Existing 11 services are **NOT deleted upfront**. They remain runnable while P0 restoration (`Stage D`) and concurrency/payment fixes (`Stage E`) are verified; then `Stage F` migrates modules domain-by-domain behind `api-gateway` compatibility adapters.

### ADR-002: PostgreSQL as Single Source of Truth & Deferred External Infrastructure

- **Context**: Prematurely introducing Redis Cluster, Uber H3 caches, AWS IoT Core, or redesigned DynamoDB schemas before core SQL correctness and transactions work adds operational risk without measured bottleneck justification.
- **Decision**:
  - Keep **PostgreSQL 16** as the single transactional source of truth for identity, inventory (`parking_spaces`, `parking_bays`), reservations (`bookings`), payments/ledger, disputes, idempotency records (`idempotency_keys`), and outbox events (`outbox_events`).
  - Prepare schema foundations in Stage E/G for **PostGIS spatial queries**, **physical bay allocation**, **`btree_gist` booking exclusivity**, and **outbox event delivery**.
  - **Defer** Redis Cluster, H3 hexagonal caching, DynamoDB table redesigns, AWS IoT Core, and physical ANPR hardware until spatial/throughput benchmarks on PostGIS demonstrate a concrete bottleneck. Keep DynamoDB strictly scoped to its current narrow operational tables (`parkly-otp`, `parkly-occupancy`, `parkly-notifications`) unless replaced cleanly after measurement.

### ADR-003: Unified Authentication, RBAC & Fail-Closed Object Ownership

- **Context**: `api-gateway` and downstream services disagree on which routes require JWTs (`BUG-02`), OTPs are stored in plaintext without atomic retry limits (`NEW-04`), web portals parse the wrong auth envelope (`BUG-03`), and critical mutation endpoints omit resource ownership checks (`NEW-01`).
- **Decision**:
  - Standardize login response envelope across auth backend, mobile, Host Dashboard, and Admin Portal: `{ success: true, data: { user, tokens: { accessToken, refreshToken, expiresIn } } }`.
  - Store **salted SHA-256 OTP hashes** in `parkly-otp` with atomic conditional attempt counters (`ConditionExpression`).
  - Clarify public vs. authenticated boundaries consistently across Gateway and downstream modules:
    - **Public**: `/auth/otp/request`, `/auth/otp/verify`, `/auth/refresh`, `POST /payments/webhook` (HMAC-verified, never JWT), read-only discovery (`POST /search`, `GET /search/spaces/:id`, `GET /pricing/:spaceId`).
    - **Authenticated + Role/Ownership Guarded**: `/concierge`, `/bookings`, `/vehicles`, `/payments`, `/notifications` (user endpoints vs admin/internal `/send`), `/host` (`space.host.userId === req.user.sub`), `/admin` (`role === 'admin'`).
  - Fix `requireOwnership` in [`shared/src/middleware/auth.ts`](../../shared/src/middleware/auth.ts#L71-L88) to **fail closed (`403`)** when ownership cannot be resolved instead of calling `next()`.

### ADR-004: Server-Enforced Booking Lifecycle & Database Concurrency Protection

- **Context**: `BookingService` checks conflicts via `findFirst` without locking or checking `totalCapacity`, blocking multi-bay lots after 1 booking yet permitting race-condition double-bookings. No route transitions `confirmed -> active`, and expired unpaid holds are never reclaimed (`BUG-01`).
- **Decision**:
  - Model explicit **`parking_bays`** child rows per `ParkingSpace` (`1..totalCapacity`) so a 20-bay lot supports up to 20 concurrent overlapping bookings across distinct bays.
  - Enforce exclusivity inside PostgreSQL using **`btree_gist`** (`EXCLUDE USING gist (bay_id WITH =, tstzrange(start_time, end_time, '[)') WITH &&) WHERE (status IN ('held', 'confirmed', 'active'))`) alongside parent lot lock / atomic allocation and `Idempotency-Key` deduplication.
  - Enforce the full state machine server-side:
    - Allowed transitions:
      - `held -> confirmed` (server payment confirmation/webhook only)
      - `held -> expired` (background expiration worker after hold TTL)
      - `held -> cancelled` (driver cancel before capture)
      - `confirmed -> active` (authorized gate check-in)
      - `confirmed -> cancelled` (pre-check-in cancel + synchronized refund rule)
      - `confirmed -> no_show` (arrival window + grace elapsed without check-in)
      - `active -> completed` (authorized gate check-out + duration/overstay settlement)
      - `active -> overstay` (end time + grace exceeded prior to checkout; settles into `completed`)
      - `completed -> refunded` (verified post-completion refund/dispute)
    - Reject all client requests attempting arbitrary status strings (`BUG-03`: disallow `'disputed'` as a `BookingStatus`; disputes live in the `Dispute` model).

### ADR-005: Payment Integrity, Minor-Unit Accounting & Split Settlement Readiness

- **Context**: Client mobile requests currently skip `paymentApi.confirm()`, supply client-computed totals, charge conflicting fee percentages (`5%` mobile vs `15%` env vs `20%` Host UI), use `1:1` `@unique` `Payment.bookingId` blocking extensions/overstays, leave refunds desynchronized from bookings, and accept unverified webhooks in non-`razorpay` mode (`BUG-01`, `BUG-10`, `NEW-05`).
- **Decision**:
  - Preserve `PaymentProvider` interface with **`MockPaymentProvider`** strictly scoped to local dev/test (`payment_provider = 'mock'`), cleanly separated from production **`RazorpayPaymentProvider` / `CashfreePaymentProvider`** boundaries.
  - Recompute all tariffs, platform fees, GST/commissions, and extension/overstay adjustments **strictly server-side** using **integer paise arithmetic** (`BIGINT` minor units). Zero trust of client-supplied payment amounts or frontend payment-success claims.
  - Evolve `Payment` to support `1 Booking : N PaymentIntents` (initial hold, extension, overstay surcharge, refund) with server-generated payment orders, idempotency keys, mandatory HMAC-SHA256 webhook verification in all non-test environments, a background reconciliation job, and atomic refund-to-booking synchronization.
  - **India Regulatory Research Gate**: Before implementing real host split payouts, verify RBI Payment Aggregator / Payment Gateway guidelines and Razorpay Route / Cashfree Easy Split marketplace settlement rules (nodal escrow, TCS/TDS withholding, GST invoicing).

### ADR-006: Offline-First Cryptographically Signed QR Gate Passes

- **Context**: [`create.tsx:125`](../../apps/mobile/app/booking/create.tsx#L125) and [`[id].tsx:217`](../../apps/mobile/app/booking/%5Bid%5D.tsx#L217) call public `https://api.qrserver.com/v1/create-qr-code/` with plaintext `PARKLY:<id>:<plate>`, failing in zero-signal basement garages and leaking reservation data externally (`NEW-07`).
- **Decision**:
  - Generate QR codes **locally on-device** using a React Native QR SVG component carrying a compact **Ed25519-signed token** (`bookingId`, `spaceId`, `bayId`, `plate`, `validFrom`, `validTo`, `nonce`).
  - Provide server signing at confirmation (`gate-access` module) plus public-key offline verification contracts for host/attendant scanning (`confirmed -> active`, `active -> completed`).
  - Defer physical ANPR camera software and AWS IoT Core MQTT brokers to post-foundation phases.

### ADR-007: Preserve AI Contracts & Enforce Simulation Transparency

- **Context**: `packages/ai-agents` passes `360` behavioral assertions (with a `timer.unref()` concurrency flake in CI load runs, `BUG-12`), while backend services and web modals wire `Mock*Provider`s silently and fake `APPROVED`/`RESOLVED` outcomes even on HTTP failure (`NEW-10`).
- **Decision**:
  - Retain all `@parkly/ai-agents` Zod schemas, `BaseAgent`, `Result`, `CircuitBreaker`, `SagaOrchestrator` contracts, and safety invariants (clearance `<2.2m`, dispute escalation `> ₹1,000`, pricing bounds).
  - Explicitly fix `BaseAgent` timeout cleanup and `tsconfig.test.json` strict type errors (`BUG-12`).
  - Explicitly annotate every backend AI response with **`providerMode: 'mock' | 'heuristic' | 'live'`** (and keep provider interfaces cleanly swappable), and eliminate silent catch-block mock approvals in Host/Admin UIs so simulated behaviors are never misrepresented as real ML/OCR/vision inference.

### ADR-008: Privacy (DPDP-Aware), Observability & CI Quality Gates

- **Context**: OpenTelemetry tracing is an uninitialized no-op, loggers print `"service": "parkly"` and router-stripped `"path": "/"`, `eslint` fails everywhere, CI skips `typecheck` and breaks on `cdk-synth` and `prisma migrate diff`, and host/notification/occupancy/search/UI apps have zero tests (`BUG-04`, `BUG-11`–`BUG-14`, `NEW-03`).
- **Decision**:
  - Treat current DPDP anonymization (`anonymizeUser`) as **technical DPDP readiness only** — never claim full legal compliance without formal legal review of data retention, explicit consent versioning, anonymized statutory 7-year GST ledger retention, and breach audit trails (`Stage G` security doc).
  - Replace the no-op logger/tracing patterns with lazy capability config (`getJwtConfig`, `getAwsConfig`, `getPaymentConfig`), dynamic service-name binding, `req.originalUrl` logging, health-check timeout cleanup, and real OpenTelemetry/metrics wiring.
  - Enforce zero-bypass CI gates covering **Build + Typecheck (`tsconfig.test.json` included) + ESLint + Unit + PostgreSQL Integration + E2E + `prisma migrate diff --shadow-database-url` + offline CDK Synth**.
