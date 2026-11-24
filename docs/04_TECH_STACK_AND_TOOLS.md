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
│ Mobile Driver App   │ React Native 0.74+, Expo SDK 51+, TypeScript     │
│ Host Web Dashboard  │ React 18+, Vite, TypeScript, TailwindCSS/CSS     │
│ Admin Portal        │ React 18+, Vite, TypeScript, Recharts, Lucide    │
│ Backend Runtime     │ Node.js 20 LTS (Active), TypeScript 5.4+         │
│ Backend Framework   │ Fastify / Express (High throughput, strict type) │
│ Database & ORM      │ PostgreSQL 16, Prisma ORM 5+, DynamoDB Local     │
│ Caching & Ephemeral │ Redis 7 / DynamoDB TTL (OTP, locks, occupancy)   │
│ Cloud Infrastructure│ AWS Cloud Native (provisioned via AWS CDK TS)    │
│ Messaging & Events  │ Amazon EventBridge, Amazon SNS, SQS              │
│ Validation & Schema │ Zod (Runtime validation & static type inference) │
│ Testing Suites      │ Jest, Supertest, Fast-Check (Property-Based)     │
│ Monorepo Tooling    │ npm workspaces / Turborepo, Docker Compose       │
└─────────────────────┴──────────────────────────────────────────────────┘
```

---

## 2. Frontend Applications

### 2.1 Driver Mobile App (`apps/mobile`)
* **Framework**: React Native with **Expo (Managed Workflow)**.
* **State Management**: **Zustand** (lightweight, predictable, no boilerplate) + **TanStack Query (React Query)** for server state caching and optimistic updates.
* **Navigation**: **Expo Router v3** (file-based navigation with deep linking).
* **Maps & Geolocation**: `@react-native-community/geolocation` + `react-native-maps` (Google Maps / OpenStreetMap fallback).
* **UI Components**: NativeWind (Tailwind styling for React Native) or bespoke modular design system with responsive primitives.
* **Authentication**: Passwordless Phone + OTP with auto-read SMS permissions on Android.

### 2.2 Host Web Dashboard (`apps/host-dashboard`)
* **Framework**: React 18 with **Vite** (sub-second HMR and optimized production bundles).
* **Styling**: TailwindCSS with custom design tokens for glassmorphism, fluid typography, and dark mode.
* **Data Visualization**: **Recharts** for real-time earnings, daily revenue trends, and occupancy percentages.
* **Forms & Validation**: React Hook Form + Zod resolvers.
* **State & API**: Zustand + Axios / Fetch client with automatic JWT bearer interceptors and token refresh loops.

### 2.3 Admin Portal (`apps/admin-portal`)
* **Framework**: React 18 + Vite.
* **Key Capabilities**: 
  - Real-time host KYC review and property approval workflow.
  - Interactive platform heatmaps of active vs pending parking bays.
  - User and vehicle suspension controls.
  - Dispute resolution console with refund issuance triggers.

---

## 3. Backend & Core APIs (`services/*` / `packages/*`)

### 3.1 Runtime & Framework Standards
* **Node.js 20 LTS**: Leveraging native `fetch`, improved V8 performance, and ESM modules.
* **Fastify / Express**: Fastify chosen for core high-throughput APIs (Search, Occupancy) delivering up to 30,000 req/sec with built-in schema compilation.
* **Zod**: All request bodies, query strings, and headers validated with strict Zod schemas before touching service logic.
* **TypeScript Strict Mode**: `noImplicitAny: true`, `strictNullChecks: true`, zero untyped `any` code in core business modules.

### 3.2 Shared Foundation (`packages/shared` or `@parkly/shared`)
A single, canonical shared TypeScript library to prevent code duplication across services:
* **`@parkly/shared/types`**: Unified domain types (User, Host, Space, Booking, Payment, Occupancy, etc.).
* **`@parkly/shared/errors`**: Standardized error classes (`NotFoundError`, `ValidationError`, `ConcurrencyConflictError`, `UnauthorizedError`).
* **`@parkly/shared/logger`**: Pre-configured Pino logger writing structured JSON with correlation IDs.
* **`@parkly/shared/utils`**: Mathematical helpers for Geohash encoding/decoding, Haversine distance calculations, and pricing formulas.
* **`@parkly/shared/middleware`**: Common JWT verification, RBAC guards, and security header middlewares.

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
* **Unit Testing**: Jest for business logic, pricing formulas, and concurrency locks.
* **Integration Testing**: Supertest against Fastify/Express routes verifying schema validation and database constraints.
* **Property-Based Testing (PBT)**: **Fast-Check** verifying mathematical invariants (e.g., dynamic price is never less than host base rate, recommendation scores always fall between 0.0 and 1.0, geohash spatial containment).
* **CI/CD Pipeline**: GitHub Actions running lint, typecheck, test suites, and AWS CDK synth on every pull request.
