# 🅿️ Parkly — Technology Stack & Tooling Specifications

> **Document Version**: 1.0.0  
> **Status**: Approved Foundation  
> **Language Standards**: TypeScript End-to-End (100% Strict Type Checking)

---

## 1. Unified Technology Matrix

```
┌────────────────────────────────────────────────────────────────────────┐
│                        PARKLY TECHNOLOGY STACK                         │
├─────────────────────┬──────────────────────────────────────────────────┤
│ Mobile Driver App   │ React Native 0.79.1, Expo SDK 54, React 19.0.0  │
│ Host Web Dashboard  │ React 18+, Vite, TypeScript, Recharts, CSS Vars  │
│ Admin Portal        │ React 18+, Vite, TypeScript, Recharts            │
│ Backend Runtime     │ Node.js 20 LTS (Active), TypeScript 5.4+         │
│ Backend Framework   │ Express (11 Domain Microservices + API Gateway)  │
│ Database & ORM      │ PostgreSQL 16, Prisma ORM 5+, DynamoDB Local     │
│ Caching & Ephemeral │ Redis / DynamoDB TTL (OTP, rate-limits, live telemetry) │
│ Cloud Infrastructure│ AWS Cloud Native (provisioned via AWS CDK TS)    │
│ Messaging & Events  │ Amazon EventBridge, Amazon SNS, SQS              │
│ Validation & Schema │ Zod (Runtime validation & static type inference) │
│ Testing Suites      │ Vitest, Supertest (360 tests in packages/ai-agents) │
│ Monorepo Tooling    │ npm workspaces, Docker Compose, GitHub Actions   │
└─────────────────────┴──────────────────────────────────────────────────┘
```

---

## 2. Frontend Applications

### 2.1 Driver Mobile App (`apps/mobile`)
* **Framework**: React Native `0.79.1` with **Expo SDK 54** and **React 19.0.0**.
* **State Management**: **Zustand** (`auth.store`, `driver.store`, `search.store`, `host.store`, `kyc.store`) + local offline cache utilities (`AsyncStorage` / `SecureStore`) for zero-crash fallback mode.
* **Navigation**: **Expo Router v6** (`apps/mobile/app/` file-based tabs & stack routing), including **Driver KYC** (`profile/driver-kyc`), **Private Residential Space Listing** (`host/spaces`), and **Host KYC & Plot Proof** (`host/kyc`).
* **Media & Gate Tools**: `expo-image-picker` for camera/gallery KYC & plot photo capture, custom SVG QR pass (`QrPassSvg`) + backup 4-digit Gate PIN, live check-in / leaving-soon / check-out session controls, and `expo-notifications` local checkout reminders.
* **Maps & Geolocation**: `expo-location`, `maplibre-gl` (web map stage) & `react-native-maps` / custom styled fallback.
* **UI Components**: Crisp light Harbor Navy & Crimson mobile design system defined in `apps/mobile/src/constants/theme.ts`.
* **Authentication**: Passwordless Phone + 6-digit OTP verification with local dev quick-fill.

### 2.2 Host Web Dashboard (`apps/host-dashboard`)
* **Framework**: React 18 with **Vite** (port `3001`).
* **Styling**: Custom CSS variables implementing Parkly Navy (`#0A1425`) and Crimson (`#EF010C`) tokens (`apps/host-dashboard/src/index.css`).
* **Key Capabilities**: Commercial & Private Residential space creation (`spaceType`, `entryInstructions`, plot photos), **Gate Arrival & Exit Verification (QR Pass or 4-Digit Gate PIN)**, inline **Check In / Confirm Exit & Check Out** with overstay display, live **"Leaving Soon"** notices, and **Recharts** revenue/occupancy trends.
* **State & API**: Zustand + Axios client with JWT interceptors (`apps/host-dashboard/src/utils/apiClient.ts`).

### 2.3 Admin Portal (`apps/admin-portal`)
* **Framework**: React 18 + Vite (port `3002`).
* **Key Capabilities**: 
  - **3-Tab Review Team Verification Console** (`Verifications.tsx`): Review & approve/reject **Driver KYC** (DL, Vehicle Reg, RC Book, Govt ID), **Host KYC** (Owner ID, ownership deed, plot photos), and **Private/Commercial Parking Plots**.
  - Interactive platform KPI overview and audit streams (`Overview.tsx` & `AuditLogs.tsx`).
  - City-wide mobility & CO₂ abatement analytics (`CityAnalytics.tsx`).
  - User management and dispute mediation console.

---

## 3. Backend & Core APIs (`services/*` / `packages/*` / `shared/`)

### 3.1 Runtime & Framework Standards
* **Node.js 20 LTS**: Clean TypeScript backend services compiled with strict typing.
* **Express**: Domain microservices behind `api-gateway` (`:4000`), complete with Helmet, CORS, distributed Redis/in-memory rate-limiting, and aggregated `/health` / `/ready` / `/api/v1/status` checks.
* **Zod**: All request bodies, agent inputs/outputs, and configs validated strictly at runtime.
* **TypeScript Strict Mode**: Workspace build checks across `services/*`, `packages/*`, and `shared/`.

### 3.2 Shared Foundation (`shared/` → `@parkly/shared`)
A canonical shared TypeScript workspace preventing duplication across services:
* **Theme Palette**: Brand hex tokens (`parklyPalette`).
* **Errors & Responses**: Standardized `ApiResponse<T>` envelope and HTTP error classes.
* **Logging & Middleware**: Structured Pino logger, JWT authentication, RBAC guards, security headers, health checks, and graceful shutdown helpers.
* **Geospatial Utilities**: Geohash precision encoding/decoding and distance math.

---

## 4. Databases & Storage

### 4.1 Amazon RDS PostgreSQL 16
* Primary ACID transactional relational database.
* Managed via **Prisma ORM** for type-safe schema definitions, automated migrations, and connection pooling.
* Key extensions: `pgcrypto` for UUID generation, `postgis` (or pre-indexed Geohash fields) for sub-millisecond bounding box spatial queries.

### 4.2 Amazon DynamoDB
* NoSQL database optimized for single-digit millisecond latency at any scale.
* Tables:
  1. `parkly-otp-verifications`: Stores phone OTP hashes with `ttl` epoch timestamp for automatic AWS zero-cost purge.
  2. `parkly-occupancy-timeseries`: High-velocity IoT/sensor occupancy readings indexed by `spaceId` and `timestamp`.
  3. `parkly-notifications`: In-app notification feeds partitioned by `userId` with a Sort Key on `createdAt`.

### 4.3 Amazon S3
* Object storage bucket with pre-signed upload URLs for host parking space photographs and identity documents.
* S3 Data Lake bucket partitioned by date (`year/month/day`) receiving raw EventBridge event archives for Athena SQL queries.

---

## 5. Third-Party Integrations & APIs

| Integration | Provider | Role & Implementation Details |
|---|---|---|
| **Payment Gateway** | Razorpay / Cashfree | Pluggable interface for UPI Intent, UPI QR, and netbanking. Webhook listener verifying HMAC SHA-256 signatures. |
| **SMS & OTP** | AWS SNS / Twilio | SMS OTP dispatching with Indian DLT (Distributed Ledger Technology) compliant sender IDs and template registration. |
| **Maps & Places** | Google Maps / Mapbox | Address geocoding, reverse geocoding, autocomplete place search, and route navigation. |
| **Push Notifications** | Firebase Cloud Messaging (FCM) & Apple Push (APNS) | Real-time push notifications for booking confirmations, slot departure reminders, and host earnings alerts. |
| **Generative AI & ML**| Amazon Bedrock & SageMaker | Bedrock for smart multilingual host assistants; SageMaker for historical vacancy prediction models. |

---

## 6. DevOps, Local Development & Testing

### 6.1 Local Development Environment
* **Docker Compose**: Spins up local PostgreSQL 16 and DynamoDB Local with pre-seeded Chennai development datasets in one command (`npm run dev:infra`).
* **Localhost Mocking**: Built-in mock providers for SMS (`mock`), Payments (`mock`), and IoT Sensors (`simulator`) so developers can build offline without incurring AWS or API costs.

### 6.2 Testing Strategy
* **Multi-Agent & Unit Testing**: **Vitest** executing 360+ deterministic tests across unit specs, distributed sagas, circuit breakers, real providers, and the 4-tier E2E suite in `packages/ai-agents`.
* **API Verification**: Express route and health-check integration tests via Supertest.
* **CI/CD Pipeline**: GitHub Actions (`.github/workflows/ci.yml`) running tests, workspace builds, web portal builds, Prisma schema drift checks, and AWS CDK synthesis.
