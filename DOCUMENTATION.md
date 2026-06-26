# Parkly — Technical Documentation

> AI-powered smart-city parking marketplace. "Airbnb for parking."
> Built by ZEUS Technologies. MVP launch city: Chennai, Tamil Nadu 🇮🇳

This document explains **how Parkly was built**, **what's included**, its **features**, the **AWS services** behind it, and the **working principles** that drive the platform.

---

## 1. How Parkly Was Made

### 1.1 An AI-Driven Development Lifecycle (AI-DLC)

Parkly was not hand-typed file-by-file. It was produced through a structured, **AI-assisted development lifecycle (AI-DLC)** that moves an idea from vision → requirements → design → code in disciplined, reviewable stages. Every decision is captured as a versioned artifact under `aidlc-docs/`, giving the project a full paper trail.

The lifecycle has three phases:

| Phase | Purpose | What it produced for Parkly |
|-------|---------|------------------------------|
| **Inception** | Decide *what* to build and *why* | Requirements, application design, 18 units of work |
| **Construction** | Decide *how* to build it, then build | Infrastructure design, all service code, 40 passing tests |
| **Operations** | Deploy & run (future) | Placeholder for deployment/monitoring |

### 1.2 The stages that actually ran

From `aidlc-docs/aidlc-state.md`:

- **Workspace Detection** — confirmed greenfield (no existing code).
- **Requirements Analysis** — produced `requirements.md` (functional + non-functional + tech decisions).
- **User Stories** — *skipped*; the vision doc plus clarifying answers gave enough clarity for a single-stretch build.
- **Workflow Planning** — chose which downstream stages to execute.
- **Application Design** — produced the service map and domain model.
- **Units Generation** — decomposed the system into **18 units of work**.
- **Infrastructure Design** — AWS CDK stacks.
- **Code Generation** — all 18 units scaffolded; builds clean.
- **Build & Test** — **40 tests passing across 9 suites**.

### 1.3 Engineering principles enforced throughout

Captured in the steering files (`.kiro/steering/`):

- Microservice-oriented; each service independently deployable.
- API-first design; every service documented and health-checked.
- Strong typing everywhere (TypeScript front to back).
- Composition over inheritance; configuration over hardcoding.
- **No city-specific hardcoding** — the city is data, not code, so Parkly scales from one city to many countries without redesign.
- Business logic separated from UI and infrastructure.
- Security baseline applied pragmatically (see §5).

### 1.4 Verification

The build was validated, not assumed:

- `npm run build` — all services + 2 web frontends + CDK compile cleanly.
- `npm test` — **40 passed, 0 failed**.
- `cdk synth` — CDK stacks compile to CloudFormation without deploying.

---

## 2. What's Included (Repository Map)

```
parkly/
├── apps/
│   ├── mobile/              # Driver app — Expo / React Native
│   ├── host-dashboard/      # Host web app — Vite + React (:3001)
│   └── admin-portal/        # Admin web app — Vite + React (:3002)
├── services/                # 11 backend microservices
│   ├── api-gateway/         # :4000  Central entry, rate limit, JWT, proxy
│   ├── auth-service/        # :4001  OTP + JWT + RBAC
│   ├── booking-service/     # :4002  Booking lifecycle + concurrency
│   ├── payment-service/     # :4003  UPI abstraction, refunds, payouts
│   ├── search-service/      # :4004  Geospatial search + ranking
│   ├── prediction-service/  # :4005  Availability prediction
│   ├── occupancy-service/   # :4007  Real-time occupancy ingestion
│   ├── pricing-service/     # :4008  Dynamic demand-based pricing
│   ├── notification-service/# :4009  In-app / push / SMS
│   ├── host-service/        # :4010  Listings, calendar, verification
│   └── admin-service/       # :4011  Monitoring, verification, metrics
├── shared/                  # @parkly/shared — types, middleware, AWS clients
├── infra/
│   ├── prisma/              # PostgreSQL schema (12 models, 11 enums) + seed
│   └── cdk/                 # AWS CDK infrastructure (IaC)
├── aidlc-docs/              # Full development lifecycle paper trail
├── docker-compose.yml       # One-command local stack
└── package.json             # npm workspaces monorepo root
```

### 2.1 Shared package (`@parkly/shared`)

A single typed foundation reused by every service — this is what keeps 11 services consistent:

- **Types** — complete domain type system (User, Booking, Space, Payment, AvailabilityPrediction, …).
- **Config** — typed config loaded from env vars with validation (configuration over hardcoding).
- **Errors** — typed `ParklyError` hierarchy + global handler (fail-closed).
- **Logger** — structured Pino logging with correlation IDs, no secrets/PII.
- **Utils** — geohash, Haversine distance, OTP generation.
- **AWS clients** — factory wrappers for DynamoDB, S3, SNS, EventBridge.
- **Middleware** — JWT authentication + RBAC, request logging, security headers, 404/error handling.

### 2.2 Data layer

- **PostgreSQL (via Prisma)** — transactional data: users, hosts, spaces, slots, bookings, payments, transactions, payouts. Schema: 12 models, 11 enums. Seeded with the Chennai region and 4 real parking spaces + test users.
- **DynamoDB** — high-velocity / TTL data: OTP records (auto-expiring), real-time occupancy time-series, notifications (with a `userId-createdAt` GSI).

---

## 3. Features

### Driver Mobile App
- Phone + OTP authentication (no passwords).
- Search parking by area/location with filter chips.
- Map view with live parking markers.
- Space detail: amenities, duration picker, transparent price summary.
- Booking flow: vehicle input → payment (UPI-ready) → success.
- Booking history (upcoming / past) with status colors.
- Profile with role-based menus.

### Host Dashboard (web)
- Revenue and bookings charts (Recharts).
- Per-listing live occupancy ring gauges.
- Booking management table.
- Add-new-space modal.
- Payout history with breakdown.

### Admin Portal (web)
- Platform-wide stats overview + activity feed.
- Host verification workflow (expand → approve / reject / request info).
- User management with suspend actions.
- Platform-wide bookings view.

### Platform capabilities (backend)
- **Auth** — phone/OTP, JWT (15-min access + 30-day refresh), RBAC for Driver/Host/Admin, OTP lockout.
- **Booking** — instant, scheduled, and recurring bookings; full lifecycle (created → confirmed → active → completed/cancelled); double-booking prevention via DB transactions; refund rules.
- **Payments** — pluggable UPI gateway abstraction (mock → Razorpay/Cashfree), tokenized references only (never raw payment data), automatic refunds, host payouts with platform commission.
- **Search** — geocode query → radius query → filters (price, distance, vehicle type, covered/EV/accessibility) → ranking by recommendation score.
- **Prediction** — availability probability + confidence + estimated vacancies (see §6).
- **Occupancy** — IoT-ready ingestion API + sensor simulator + manual host fallback; events published for downstream consumers.
- **Dynamic pricing** — demand-based multiplier (peak hours, weekends, occupancy); hosts can opt out.
- **Notifications** — in-app, push-ready, and SMS (via SNS).
- **Admin** — monitoring, host verification, metrics.
- **Analytics** — event-driven capture into an S3 data lake (Glue/Athena/QuickSight scaffolded).

---

## 4. AWS Services and Their Roles

Parkly is cloud-native, provisioned with **AWS CDK (TypeScript)** in `infra/cdk/lib/parkly-stack.ts`. The stack is environment-aware (`dev` vs `prod`) and built for India + global expansion (`us-east-1` primary, `ap-south-1` future).

| AWS Service | Role in Parkly | Notes |
|-------------|----------------|-------|
| **VPC** | Network isolation | Public / Private-with-egress / Isolated subnets; 2 AZs dev, 3 AZs prod; NAT gateways |
| **RDS PostgreSQL 16** | Transactional database | Storage encrypted, Multi-AZ in prod, automated backups, deletion protection in prod, in isolated subnets |
| **DynamoDB** | High-velocity NoSQL | 3 tables — OTP (TTL auto-expiry), occupancy time-series, notifications (+GSI); pay-per-request; AWS-managed encryption |
| **S3** | Object storage + data lake | Uploads bucket (space photos, lifecycle rules, CORS) and versioned datalake bucket; SSL enforced, public access blocked |
| **EventBridge** | Async event bus | Loose coupling — services emit `BookingCreated`, `PaymentCompleted`, `OccupancyChanged`, etc. for downstream consumers |
| **SNS** | SMS / notifications | OTP and booking SMS delivery |
| **Secrets Manager** | Credential storage | Auto-generated RDS password; no hardcoded credentials |
| **API Gateway** | API entry point | Routing, rate limiting (app-level gateway in MVP) |
| **Cognito** | Managed identity | Planned alongside custom JWT |
| **Lambda + ECS (Fargate)** | Compute | Lambda for event handlers, Fargate for containerized services |
| **Bedrock** | Generative AI assistant | Scaffolded for the AI assistant layer |
| **SageMaker** | ML prediction | Scaffolded; the rule-based engine is a drop-in-replaceable stub |
| **Glue + Athena + QuickSight** | Analytics pipeline | Data lake ETL, ad-hoc query, and dashboard layer |
| **CloudFront + Amplify** | CDN / web hosting | Frontend delivery |
| **CloudWatch** | Observability | Centralized logging and metrics |
| **KMS** | Encryption at rest | Backing encryption for data stores |

> **Local development** mirrors this with `docker-compose.yml`: PostgreSQL 16, DynamoDB Local (with table setup), all 11 services, and both web apps — so the full stack runs without an AWS account.

---

## 5. Security

Parkly applies a pragmatic **Security Baseline** (see `aidlc-docs/construction/security-compliance.md`):

- **Encryption** at rest (KMS / AWS-managed) and in transit (TLS 1.2+).
- **Auth** — phone/OTP, no passwords; short-lived JWT access tokens + refresh tokens; RBAC + object-ownership checks on user data.
- **No secrets in code** — Secrets Manager in production, env vars locally; `.env` is gitignored.
- **Input validation** on all API parameters; parameterized queries (Prisma).
- **Rate limiting** on public endpoints (API gateway).
- **Security headers** (CSP, X-Frame-Options, etc.) on web apps.
- **Global, fail-closed error handling**; structured logs with correlation IDs and no secrets/PII.
- **Least-privilege IAM** and dependency pinning via lock files.

---

## 6. Working Principles (How the Intelligence Works)

### 6.1 Availability prediction (`prediction-service`)

The MVP uses a **transparent, rule-based engine** designed as a **drop-in replacement target for SageMaker**:

- It models demand from **time-of-day** and **day-of-week** patterns (weekday rush 8–10 & 17–20, weekend lunch, weekend nights), each with a demand multiplier.
- Base availability = `1 / demandMultiplier`, reduced by a **duration penalty** (longer stays are harder to fit).
- Output is bounded **0–100%** probability, plus a **confidence score**, **estimated vacancies**, and **alternatives**.
- Because the interface is fixed (`AvailabilityPrediction`), the rule engine can be swapped for a trained ML model without touching callers.

### 6.2 Dynamic pricing (`pricing-service`)

A **pure function**: `finalPrice = basePrice × demandMultiplier(timeOfDay, dayOfWeek, occupancy)`. Hosts set the base price and may opt out of multipliers. Being a pure function, it's covered by property-based tests (price is always ≥ base, multiplier stays within bounds).

### 6.3 Recommendation ranking (`recommendation-service`)

A **weighted scoring function** over `distance`, `price`, and `predictedAvailability`. Search results are sorted by this score. Property-based tests verify the score stays within bounds and the output is correctly ordered.

### 6.4 Occupancy ingestion (`occupancy-service`)

Designed **IoT-ready without requiring hardware**:
- HTTP + event-based ingestion API for sensors.
- A **sensor simulator** generates realistic occupancy for demos.
- **Manual host fallback** for spaces without sensors.
- Occupancy changes are written to DynamoDB, logged to S3, and published to EventBridge for prediction and analytics.

### 6.5 Event-driven integration

Services stay loosely coupled by emitting domain events to **EventBridge** rather than calling each other directly. A booking emits `BookingCreated`; payment, notification, and analytics react independently. This is what lets each service deploy and scale on its own.

---

## 7. Running Parkly

### Local (quick start)
```bash
cp .env.example .env      # fill in values
npm install
npm run dev:infra         # PostgreSQL + DynamoDB Local
npm run migrate           # Prisma migrations
npm run seed              # Chennai data
npm run dev:core          # gateway + auth + booking + search
# or: npm run dev         # all 11 services
npm run dev:host-dashboard   # http://localhost:3001
npm run dev:admin-portal     # http://localhost:3002
cd apps/mobile && npx expo start
```

### Full stack via Docker
```bash
npm run docker:up    # everything
npm run docker:logs
npm run docker:down
```

### Deploy to AWS
```bash
cd infra/cdk
npm install
cdk deploy --context env=dev   # or env=prod
```

### Test
```bash
npm test          # all suites (40 tests)
npm test -w shared
```

---

## 8. What's Needed to Go Live

| Item | Current | Action |
|------|---------|--------|
| Google Maps API key | placeholder | Add key → live map view |
| UPI gateway | `PAYMENT_PROVIDER=mock` | Add Razorpay/Cashfree keys |
| SMS OTP | `SMS_PROVIDER=mock` | Switch to `sns` |
| Push notifications | code ready | Add FCM/APNS config |
| AWS infra | CDK ready | `cdk deploy` |
| Prod DB migrations | schema ready | `npm run migrate:deploy` |

---

## 9. Technology Stack Summary

- **Backend**: Node.js 20 + TypeScript + Express (containerized for ECS; Lambda for events)
- **Mobile**: Expo + React Native + Zustand
- **Web**: Vite + React 18 + Recharts
- **Database**: PostgreSQL 16 (Prisma) + DynamoDB
- **AWS**: RDS, DynamoDB, S3, EventBridge, SNS, Secrets Manager, API Gateway, Cognito, Lambda, ECS/Fargate, Bedrock, SageMaker, Glue/Athena/QuickSight, CloudFront/Amplify, CloudWatch, KMS, CDK
- **Auth**: OTP via SMS + JWT (no passwords)
- **DevOps**: Docker Compose (local) + AWS CDK (cloud) + GitHub Actions (CI/CD)
- **Quality**: Jest unit + property-based tests; strong typing end to end

---

*Built by ZEUS Technologies · Chennai, Tamil Nadu 🇮🇳*
