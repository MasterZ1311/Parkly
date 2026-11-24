# 🅿️ Parkly — Software Development Plan & Rebuild Roadmap

> **Document Version**: 1.0.0  
> **Status**: Approved Foundation  
> **Methodology**: Agile / 2-Week Sprints with Continuous Integration

---

## 1. Phased Product Roadmap

```
┌────────────────────────────────────────────────────────────────────────────┐
│ PHASE 1 — THE MVP LAUNCH (Months 1–3)                                     │
│ • Single city pilot: Chennai (T. Nagar, OMR, Anna Nagar)                   │
│ • Core Driver Mobile App (Expo RN), Host Dashboard (Vite), Admin Portal    │
│ • Phone + OTP auth, UPI mock/gateway, rule-based AI, ACID concurrency      │
└─────────────────────────────────────┬──────────────────────────────────────┘
                                      │
                                      ▼
┌────────────────────────────────────────────────────────────────────────────┐
│ PHASE 2 — AUTOMATION & COMMERCE (Months 4–6)                               │
│ • Production Razorpay / Cashfree UPI integration with instant split payouts│
│ • Live Google Maps navigation with turn-by-turn routing                    │
│ • Machine learning occupancy prediction model trained on historical data   │
│ • Corporate fleet parking & recurring monthly commuter subscriptions       │
└─────────────────────────────────────┬──────────────────────────────────────┘
                                      │
                                      ▼
┌────────────────────────────────────────────────────────────────────────────┐
│ PHASE 3 — IOT & HARDWARE INTEGRATIONS (Months 7–9)                         │
│ • Commercial lot ANPR (Automated Number Plate Recognition) barrier gates   │
│ • Ultrasonic ground occupancy sensors for municipal & private parking lots │
│ • EV charging station partnership bookings & automated slot reservations   │
└─────────────────────────────────────┬──────────────────────────────────────┘
                                      │
                                      ▼
┌────────────────────────────────────────────────────────────────────────────┐
│ PHASE 4 — NATIONAL EXPANSION & SMART CITIES (Months 10–12)                 │
│ • Expansion to Bengaluru, Hyderabad, Mumbai, and Delhi-NCR                 │
│ • Smart City Municipal Command Dashboard for traffic police & city planners│
│ • Apple CarPlay & Android Auto in-dash booking apps                        │
└────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Sprint-by-Sprint Plan for Building From Scratch

Starting from a completely clean repository, the system will be built systematically across 8 structured sprints:

```
Sprint 0 ──► Sprint 1 ──► Sprint 2 ──► Sprint 3 ──► Sprint 4 ──► Sprint 5 ──► Sprint 6 ──► Sprint 7
Foundation    Auth & DB     Search       Booking     Driver App   Host Web    Admin Web    Cloud & AI
```

### Sprint 0: Clean Slate Foundation, Tooling & Shared Core
* **Goal**: Establish the monorepo workspace, TypeScript configs, linting, Docker development environment, and core shared packages.
* **Deliverables**:
  1. Monorepo configuration (`npm workspaces` or `pnpm`).
  2. Root `package.json`, base `tsconfig.json`, `.editorconfig`, ESLint & Prettier.
  3. `docker-compose.yml` for local PostgreSQL 16 and DynamoDB Local.
  4. Scaffold `packages/shared` (`@parkly/shared`): domain types, standard error classes, mathematical utilities (Haversine, Geohash), Pino logger, and Zod validator schemas.
  5. Setup GitHub Actions CI pipeline running typecheck and linting on commit.

### Sprint 1: Data Model, Database Migrations & Auth/Identity Subsystem
* **Goal**: Implement the transactional database schema, seed test datasets, and build the end-to-end authentication system.
* **Deliverables**:
  1. Prisma schema definition covering all 12 core models and 11 enums (`users`, `vehicles`, `hosts`, `parking_spaces`, `bookings`, `payments`, etc.).
  2. PostgreSQL migrations and robust Chennai seed data script (`infra/prisma/seed.ts`).
  3. Setup DynamoDB local tables for OTP storage with TTL.
  4. Build `services/auth-service` (or `src/modules/auth`):
     - `POST /api/v1/auth/otp/request` (with mock & SMS dispatchers).
     - `POST /api/v1/auth/otp/verify` (JWT token issuance with 15-min access / 30-day refresh).
     - RBAC middleware (`driver`, `host`, `admin`).
  5. Comprehensive unit tests for token signing, OTP expiration, and brute-force lockout.

### Sprint 2: Parking Space Onboarding & Geospatial Search Engine
* **Goal**: Enable hosts to list parking inventory and allow drivers to search nearby spaces with spatial indexing.
* **Deliverables**:
  1. Build `services/host-service` (or `src/modules/host`):
     - Space CRUD APIs with address, geolocation (lat/lng), amenities, and photos.
     - Automated Geohash generation on space creation.
     - Weekly availability slot calendar management.
  2. Build `services/search-service` (or `src/modules/search`):
     - Geospatial bounding-box queries using Geohash prefixes.
     - Haversine distance calculation and radius filtering.
     - Vehicle type and amenity filters (EV, covered, security).
     - Multi-factor recommendation scoring (distance, price, capacity).

### Sprint 3: Booking Concurrency Engine & Payments Integration
* **Goal**: Implement high-reliability reservation management with atomic double-booking prevention and UPI payments.
* **Deliverables**:
  1. Build `services/booking-service` (or `src/modules/booking`):
     - Atomic slot concurrency lock in PostgreSQL (`SELECT ... FOR UPDATE`).
     - State machine lifecycle (`created` -> `confirmed` -> `active` -> `completed` / `cancelled`).
     - Automated 10-minute hold expiration worker.
  2. Build `services/payment-service` (or `src/modules/payment`):
     - Pluggable PaymentProvider interface (`mock` for local dev, `razorpay` / `cashfree` for prod).
     - Order initiation and webhook verification with HMAC signature checks.
     - Automatic refund dispatcher for eligible cancellations.
     - Host payout ledger tracking platform commission.

### Sprint 4: Driver Mobile App UI/UX & End-to-End Booking Flow
* **Goal**: Deliver a polished, modern cross-platform mobile app for iOS and Android.
* **Deliverables**:
  1. Initialize Expo React Native project with TypeScript and Expo Router v3.
  2. Implement frictionless Phone + OTP login with auto-focus keypad.
  3. Search screen with interactive map view (`react-native-maps` / Leaflet web fallback).
  4. Parking space detail screen showcasing photos, amenities, security badge, and dynamic price preview.
  5. Vehicle selector modal (compact, sedan, SUV, 2-wheeler).
  6. Instant checkout screen with UPI deep-link intent.
  7. Active booking ticket screen displaying QR code for gate check-in, parking timer countdown, and navigation button.

### Sprint 5: Host Web Dashboard & Earnings Portal
* **Goal**: Provide property owners with a responsive web portal to manage spaces, monitor bookings, and track bank payouts.
* **Deliverables**:
  1. Initialize React 18 + Vite web app with TailwindCSS.
  2. Host analytics overview: total earnings, upcoming bookings, and live occupancy ring gauges.
  3. Interactive Space Management: Add new listing wizard with address geocoding and photo upload.
  4. Weekly availability scheduler: set custom hours per day.
  5. Financial Ledger & Payouts tab: view detailed breakdown of earnings, platform commission, and bank transfers.

### Sprint 6: Admin Governance Portal, Verifications & Disputes
* **Goal**: Equip platform operators with tools to approve hosts, resolve disputes, and monitor city-wide metrics.
* **Deliverables**:
  1. Initialize Admin Portal (React + Vite).
  2. Host Verification Queue: review uploaded PAN, property tax receipts, and photos with one-click approve/reject/request-info actions.
  3. User & Vehicle Management: search, inspect, and suspend bad actors.
  4. Dispute Resolution Center: review driver/host conflict tickets, examine booking timestamps, and trigger automated refunds.
  5. Platform Health Dashboard: gross transaction volume, active bookings, and system error rates.

### Sprint 7: Real-Time Occupancy, AI Prediction & Cloud Production Deployment
* **Goal**: Connect real-time telematics, deploy predictive AI algorithms, and launch production AWS cloud infrastructure.
* **Deliverables**:
  1. Build `services/occupancy-service`: IoT sensor ingestion webhook, sensor simulator for demos, and manual host fallback.
  2. Build `services/pricing-service`: dynamic surge pricing formulas with time-of-day multipliers.
  3. Build `services/prediction-service`: arrival vacancy prediction with confidence scoring.
  4. Infrastructure as Code: AWS CDK TypeScript stacks for VPC, RDS PostgreSQL, DynamoDB, ECS Fargate / Lambda, EventBridge, and CloudFront.
  5. Production verification: zero-downtime deployment, health check alarms, and end-to-end integration tests.

---

## 3. Definition of Done (DoD) per Sprint

To maintain the highest quality engineering standards throughout the rebuild:
* **Strict Typing**: 0 TypeScript compilation errors in strict mode.
* **Test Coverage**: Critical business logic (concurrency locking, pricing math, distance calculations, JWT checks) must have minimum 90% unit test coverage.
* **Linting & Formatting**: Zero ESLint warnings; Prettier formatted.
* **API Documentation**: All endpoints documented with request/response examples and Zod schemas.
* **Local Runnability**: Any developer must be able to clone the repo and launch the entire local stack in under 2 minutes with `npm install` and `npm run dev`.
