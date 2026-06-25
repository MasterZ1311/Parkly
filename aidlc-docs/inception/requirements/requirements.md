# Parkly — Requirements Document

## Intent Analysis Summary

- **User Request**: Build out the Parkly smart parking platform per the vision document and AWS Tools spec — create all folders, write code, and provide documentation of what details the user must supply to complete the project. Done in a single stretch.
- **Request Type**: New Project (Greenfield)
- **Scope Estimate**: System-wide (multiple microservices, 3 frontends, AWS infrastructure)
- **Complexity Estimate**: Complex
- **Implementation Phase**: Phase 1 — MVP (with full architecture scaffolded for scale)

---

## 1. Product Scope (MVP)

Parkly is a two-sided parking marketplace ("Airbnb for parking"). The MVP targets **Chennai** as the launch city with three product surfaces:

1. **Driver Mobile App** (React Native, cross-platform)
2. **Host Dashboard** (web)
3. **Admin Portal** (web)

The Government Dashboard is deferred to a later phase but the data model and analytics pipeline are scaffolded to support it.

---

## 2. Functional Requirements

### 2.1 Authentication & Users (FR-AUTH)
- **FR-AUTH-1**: Users authenticate via phone number + OTP (SMS-based).
- **FR-AUTH-2**: Support three roles: Driver, Host, Admin (RBAC).
- **FR-AUTH-3**: JWT-based session tokens, validated server-side on every request.
- **FR-AUTH-4**: Account lockout / progressive delay after repeated OTP failures.

### 2.2 Parking Search (FR-SEARCH)
- **FR-SEARCH-1**: Search parking by location/address (geocoded).
- **FR-SEARCH-2**: Filter by price, distance, vehicle type, covered/EV/accessibility.
- **FR-SEARCH-3**: Show availability prediction (probability + confidence) using rule-based + basic ML.
- **FR-SEARCH-4**: Results ranked by a recommendation score (distance, price, predicted availability).

### 2.3 Booking (FR-BOOK)
- **FR-BOOK-1**: Instant booking of currently available slots.
- **FR-BOOK-2**: Scheduled booking for future date/time.
- **FR-BOOK-3**: Recurring booking (daily, weekly).
- **FR-BOOK-4**: Booking lifecycle: created → confirmed → active → completed / cancelled.
- **FR-BOOK-5**: Cancellation with refund rules.
- **FR-BOOK-6**: Prevent double-booking of the same slot/time (concurrency control).

### 2.4 Payments (FR-PAY)
- **FR-PAY-1**: UPI payment integration (pluggable gateway abstraction).
- **FR-PAY-2**: Payment tokenization — never store raw payment data.
- **FR-PAY-3**: Automatic refunds on eligible cancellations.
- **FR-PAY-4**: Host payouts (commission deducted by platform).

### 2.5 Host Management (FR-HOST)
- **FR-HOST-1**: Hosts create/edit parking space listings (location, photos, price, vehicle types, amenities).
- **FR-HOST-2**: Availability calendar management.
- **FR-HOST-3**: Manual admin verification of host + property before listing goes live.
- **FR-HOST-4**: View bookings, revenue, payouts.

### 2.6 Occupancy Tracking (FR-OCC)
- **FR-OCC-1**: Occupancy Service ingests real-time occupancy events.
- **FR-OCC-2**: IoT sensor ingestion API (HTTP + event-based) for automated occupancy updates.
- **FR-OCC-3**: Sensor simulator + manual host fallback for environments without hardware.
- **FR-OCC-4**: Occupancy events published to EventBridge for downstream consumers (prediction, analytics).

### 2.7 Dynamic Pricing (FR-PRICE)
- **FR-PRICE-1**: Simple demand-based multiplier (peak hours, weekends).
- **FR-PRICE-2**: Hosts set base price; platform applies multiplier; host can opt out.

### 2.8 Notifications (FR-NOTIF)
- **FR-NOTIF-1**: In-app notifications.
- **FR-NOTIF-2**: Push notifications (mobile).
- **FR-NOTIF-3**: SMS notifications (booking confirmation, OTP, reminders).

### 2.9 Recommendation & Prediction (FR-AI)
- **FR-AI-1**: Rule-based recommendation engine (distance/price/availability weighting).
- **FR-AI-2**: Basic ML availability prediction from historical occupancy logs (time, day, patterns).
- **FR-AI-3**: Prediction output: probability, estimated vacancy, confidence score.

### 2.10 Admin (FR-ADMIN)
- **FR-ADMIN-1**: View users, bookings, transactions (basic monitoring).
- **FR-ADMIN-2**: Approve/reject host verification requests.
- **FR-ADMIN-3**: View system health/metrics.

### 2.11 Analytics (FR-ANALYTICS)
- **FR-ANALYTICS-1**: Event-driven data capture (bookings, payments, occupancy) via EventBridge.
- **FR-ANALYTICS-2**: Data lake (S3) + Glue ETL + Athena query layer scaffolded.
- **FR-ANALYTICS-3**: QuickSight dashboard placeholders.

---

## 3. Non-Functional Requirements

### 3.1 Architecture (NFR-ARCH)
- **NFR-ARCH-1**: Microservice-oriented, each service independently deployable.
- **NFR-ARCH-2**: API-first; all services expose documented REST APIs.
- **NFR-ARCH-3**: No city-specific hardcoding; city is configuration/data.
- **NFR-ARCH-4**: Business logic separated from infrastructure and UI.
- **NFR-ARCH-5**: Event-driven integration via EventBridge for loose coupling.

### 3.2 Security (NFR-SEC) — pragmatic application of Security Baseline
- **NFR-SEC-1**: Encryption at rest (KMS) and in transit (TLS 1.2+) for all data stores. [SECURITY-01]
- **NFR-SEC-2**: Access logging on API Gateway, ALB, CloudFront. [SECURITY-02]
- **NFR-SEC-3**: Structured app logging with correlation IDs; no secrets/PII in logs. [SECURITY-03]
- **NFR-SEC-4**: HTTP security headers on web apps. [SECURITY-04]
- **NFR-SEC-5**: Input validation on all API parameters; parameterized queries. [SECURITY-05]
- **NFR-SEC-6**: Least-privilege IAM. [SECURITY-06]
- **NFR-SEC-7**: Application-level authorization (RBAC + object ownership checks). [SECURITY-08]
- **NFR-SEC-8**: No hardcoded credentials; use Secrets Manager. [SECURITY-12]
- **NFR-SEC-9**: Rate limiting on public endpoints. [SECURITY-11]
- **NFR-SEC-10**: Global error handling, fail-closed. [SECURITY-15]
- **NFR-SEC-11**: Dependency pinning / lock files. [SECURITY-10]

### 3.3 Scalability (NFR-SCALE)
- **NFR-SCALE-1**: Scale from one city to multiple countries without redesign.
- **NFR-SCALE-2**: Stateless services behind load balancers; horizontal scaling.
- **NFR-SCALE-3**: DynamoDB for high-velocity data, RDS for transactional data.

### 3.4 Observability (NFR-OBS)
- **NFR-OBS-1**: Every service exposes `/health` and `/metrics` endpoints.
- **NFR-OBS-2**: Centralized logging (CloudWatch).

### 3.5 Quality (NFR-QUAL)
- **NFR-QUAL-1**: Unit tests for critical business logic (booking, pricing, prediction, payment).
- **NFR-QUAL-2**: Partial property-based testing for pure functions (pricing calc, scoring) and serialization round-trips.
- **NFR-QUAL-3**: Strong typing (TypeScript backend + frontend).

### 3.6 Compliance (NFR-COMP)
- **NFR-COMP-1**: Intermediate — secure storage/transmission, encryption, audit logs on sensitive operations.

---

## 4. Technology Decisions

| Layer | Choice |
|---|---|
| Backend services | Node.js + TypeScript (Express), containerized for ECS; Lambda for event handlers |
| Frontend (web) | React + TypeScript + Vite (Host Dashboard, Admin Portal) |
| Mobile | React Native + TypeScript (Driver App) |
| Transactional DB | Amazon RDS (PostgreSQL) |
| High-velocity DB | Amazon DynamoDB |
| Object storage | Amazon S3 |
| API entry | Amazon API Gateway |
| Compute | AWS Lambda + Amazon ECS (Fargate) |
| Auth | Amazon Cognito + custom JWT |
| Events | Amazon EventBridge |
| Notifications | Amazon SNS / SMS |
| AI/LLM | Amazon Bedrock (assistant) |
| ML | Amazon SageMaker (prediction model) — scaffolded |
| Analytics | Glue + Athena + QuickSight |
| CDN/Hosting | CloudFront + Amplify |
| IaC | AWS CDK (TypeScript) |
| CI/CD | GitHub Actions |
| Maps | Google Maps API |
| Payments | UPI gateway abstraction (e.g., Razorpay/Cashfree) |

---

## 5. Out of Scope (MVP)

- Government Dashboard UI (data model scaffolded only)
- Reviews & ratings (deferred)
- Full ML pipeline training automation (model scaffold + inference stub provided)
- Cards/wallet/net-banking payments (UPI only)
- EKS / multi-region deployment

---

## 6. Resolved Assumptions

1. **IoT occupancy (Q9)**: Implemented as a software ingestion service + simulator + manual fallback. Physical sensors integrate later via the documented ingestion API.
2. **Full AWS stack (Q7) on MVP (Q1)**: Architecture and IaC scaffold the full stack; service logic implements MVP-level features.
3. **Security (X answer)**: Security Baseline enabled, applied where applicable; non-applicable rules marked N/A; not used to block the single-stretch build.

---

## 7. Key Requirements Summary

The MVP delivers a runnable, well-architected Parkly platform: phone/OTP auth, parking search with prediction, instant/scheduled/recurring bookings, UPI payments with payout, host listing + manual verification, occupancy ingestion (IoT-ready), demand-based pricing, multi-channel notifications, rule-based + basic-ML intelligence, a basic admin portal, and an event-driven analytics pipeline — all scaffolded on AWS with CDK IaC and GitHub Actions CI/CD, ready to scale beyond one city.
