# 🅿️ Parkly — System Architecture & Infrastructure Design

> **Document Version**: 1.0.0  
> **Status**: Approved Foundation  
> **Scope**: Cloud Native, Event-Driven, Distributed Architecture

---

## 1. Architectural Philosophy

Parkly is engineered as an **API-first, event-driven, cloud-native system**. It balances rapid initial development velocity with massive horizontal scalability:

1. **Domain-Driven Design (DDD)**: Systems are partitioned strictly along business domain boundaries (Auth, Search, Booking, Payment, Host, Occupancy, Pricing, Notification, Admin).
2. **Loosely Coupled via EventBridge**: Microservices / domain modules communicate state transitions asynchronously via an event bus, preventing cascading failures.
3. **Dual-Database Strategy**: 
   - **Relational ACID Store (PostgreSQL)** for strict transactional integrity (users, payments, bookings, financial payouts).
   - **High-Velocity NoSQL / Key-Value Store (DynamoDB / Redis)** for ephemeral time-series (live sensor occupancy, fast-expiring OTPs, notification inboxes).
4. **Zero City-Specific Hardcoding**: Geographic configuration, bounding boxes, currencies, and tax rules are stored as data and config parameters, allowing instant expansion from Chennai to any global metro.

---

## 2. High-Level Architecture Topology

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│                                CLIENT SURFACES                                   │
│  📱 Driver App (Expo RN)   🖥️ Host Dashboard (React)   🔧 Admin Portal (React)   │
└────────────────────────────────────────┬─────────────────────────────────────────┘
                                         │ HTTPS / TLS 1.3
                    ┌────────────────────▼────────────────────┐
                    │       Amazon CloudFront / Amplify       │
                    │   Global Edge CDN & Web App Hosting     │
                    └────────────────────┬────────────────────┘
                                         │
                    ┌────────────────────▼────────────────────┐
                    │      AWS API Gateway / ALB (Port 4000)   │
                    │  • TLS Termination & WAF Inspection     │
                    │  • Global Rate Limiting & DoS Defense   │
                    │  • JWT Access Token Verification        │
                    │  • Reverse Proxy & Microservice Routing │
                    └──────────┬──────────┬──────────┬────────┘
                               │          │          │
         ┌─────────────────────┘          │          └─────────────────────┐
         ▼                                ▼                                ▼
┌──────────────────┐            ┌──────────────────┐            ┌──────────────────┐
│   CORE DOMAIN    │            │   SEARCH & AI    │            │  MARKETPLACE &   │
│    SERVICES      │            │     SERVICES     │            │    OPERATIONS    │
├──────────────────┤            ├──────────────────┤            ├──────────────────┤
│ • Auth Service   │            │ • Search Service │            │ • Host Service   │
│   (OTP / JWT)    │            │   (Spatial Qs)   │            │   (Spaces/Slots) │
│ • Booking Service│            │ • Prediction Svc │            │ • Admin Service  │
│   (State/Locks)  │            │   (ML Inference) │            │   (KYC/Disputes) │
│ • Payment Service│            │ • Pricing Engine │            │ • Notification   │
│   (UPI/Payouts)  │            │   (Surge/Demand) │            │   (SMS/Push)     │
│ • Occupancy Svc  │            │                  │            │                  │
│   (IoT/Sensors)  │            │                  │            │                  │
└────────┬─────────┘            └────────┬─────────┘            └────────┬─────────┘
         │                               │                               │
         └───────────────────────┬───────┴───────────────────────────────┘
                                 │
     ┌───────────────────────────┴───────────────────────────┐
     │                                                       │
     ▼                                                       ▼
┌───────────────────────────────────────┐   ┌───────────────────────────────────────┐
│        TRANSACTIONAL DATA STORE       │   │        HIGH-VELOCITY / TTL STORE      │
│         Amazon RDS (PostgreSQL 16)    │   │           Amazon DynamoDB             │
├───────────────────────────────────────┤   ├───────────────────────────────────────┤
│ • Users, Vehicles, Hosts              │   │ • OTP Verification (TTL Auto-Purge)   │
│ • Parking Spaces, Slots, Amenities    │   │ • Real-time Occupancy Time-Series     │
│ • Bookings, Payments, Payouts         │   │ • Notification Feed by User ID GSI    │
│ • Disputes, Pricing Rules, Regions    │   │ • Geospatial Cache Layers             │
└───────────────────────────────────────┘   └───────────────────────────────────────┘
                                 │
                                 ▼ Asynchronous Integration
┌──────────────────────────────────────────────────────────────────────────────────┐
│                        Amazon EventBridge (Central Event Bus)                     │
│  • BookingCreated  • PaymentConfirmed  • OccupancyChanged  • HostVerified         │
└────────┬───────────────────────┬───────────────────────────┬─────────────────────┘
         │                       │                           │
         ▼                       ▼                           ▼
┌──────────────────┐    ┌──────────────────┐    ┌──────────────────────────────────┐
│   Amazon SNS     │    │   AWS Lambda     │    │       ANALYTICS DATA LAKE        │
│ • SMS OTP via DLT│    │ • Async Worker   │    │ Amazon S3 + AWS Glue + Athena    │
│ • Driver Alerts  │    │ • Payout Batcher │    │ • Long-term occupancy analytics  │
│ • Push (FCM/APNS)│    │ • Anomaly Detect │    │ • Municipal demand heatmaps      │
└──────────────────┘    └──────────────────┘    └──────────────────────────────────┘
```

---

## 3. Microservices vs. Modular Monolith: The Strategy

When rebuilding Parkly from scratch, we establish clear software boundaries. We adopt a **Modular Monolith First, Microservices-Ready** approach or an orchestrated microservices architecture:

| Aspect | Modular Monolith (Initial Development) | Distributed Microservices (Production Scale) |
|---|---|---|
| **Deployment** | Single container / Lambda deployment, ultra-fast CI/CD | 11 independently containerized ECS Fargate tasks |
| **Local DX** | Single `npm run dev`, instant startup, no Docker strain | Multi-container Docker Compose with localized mocks |
| **Code Structure** | Isolated domain modules in `src/modules/*` sharing a database schema | Distinct folders/repos per microservice with independent deployment manifests |
| **Data Access** | In-process domain calls with database transactions | HTTP/gRPC internal calls and EventBridge event choreography |
| **Recommended Path** | **Phase 1 MVP**: Clean Monorepo with strictly isolated domain packages (`@parkly/core`, `@parkly/api`), transitioning seamlessly to ECS microservices for Phase 2/3. |

---

## 4. Asynchronous Event-Driven Nervous System

Synchronous HTTP calls between microservices create tight coupling, latency buildup, and cascading outages. Parkly enforces asynchronous communication via **Amazon EventBridge**:

### Key Domain Events Catalog
1. `Booking.Created`:
   - Emitted by: **Booking Service**
   - Consumers: **Payment Service** (initiates payment intent), **Notification Service** (sends provisional SMS).
2. `Payment.Completed`:
   - Emitted by: **Payment Service**
   - Consumers: **Booking Service** (transitions status from `created` to `confirmed`), **Occupancy Service** (reserves slot), **Notification Service** (sends receipt & navigation link).
3. `Occupancy.Changed`:
   - Emitted by: **Occupancy Service** (via IoT sensor or QR scan check-in/out)
   - Consumers: **Pricing Service** (recalculates real-time demand multiplier), **Prediction Service** (updates historical occupancy training logs in S3).
4. `Host.Verified`:
   - Emitted by: **Admin Service**
   - Consumers: **Host Service** (activates public search visibility of host spaces), **Notification Service** (notifies host to set live calendar).

---

## 5. Security, Compliance & Data Protection

Parkly adheres to the rigorous **AWS Cloud Security Best Practices** and Indian DPDP (Digital Personal Data Protection) Act standards:

```
┌────────────────────────────────────────────────────────────────────────┐
│                        SECURITY IN DEPTH MATRIX                        │
├────────────────────────────┬───────────────────────────────────────────┤
│ 1. Data at Rest Encryption │ AES-256 via AWS KMS customer managed keys │
│ 2. Data in Transit         │ TLS 1.3 enforced; strict HSTS headers     │
│ 3. Authentication          │ Passwordless Phone + OTP (SHA-256 hashes) │
│ 4. Authorization           │ JWT with RS256 signing; 15-min access TTL │
│ 5. Secrets Management      │ Zero env secrets in git; AWS Secrets Mgr  │
│ 6. Database Access         │ Parameterized Prisma queries; no raw SQL  │
│ 7. Payment Tokenization    │ Zero raw cards/UPI IDs stored; token refs │
│ 8. Network Isolation       │ RDS & Lambdas isolated in private subnets │
└────────────────────────────┴───────────────────────────────────────────┘
```

### Rate Limiting & DoS Mitigation
* API Gateway enforces token bucket rate limiting (100 req/min per IP on public search; 5 req/min on OTP request endpoints).
* Automatic IP lockout after 5 consecutive failed OTP verification attempts.

---

## 6. Observability, Logging & SRE Blueprint

* **Structured Logging**: Pino structured JSON logging across all backend modules with auto-injected `correlationId` passed in HTTP headers (`x-correlation-id`).
* **Distributed Tracing**: AWS X-Ray instrumentation tracking requests from API Gateway through microservices down to database queries.
* **Health Check Probes**: Every service exposes standardized `/health/live` and `/health/ready` endpoints reporting CPU, memory, and database connection pool saturation.
* **Alerting**: CloudWatch Metric Alarms triggering PagerDuty/SNS alerts on:
  - 5xx error rate > 1% over 5 minutes.
  - Payment initiation failure rate > 0.5%.
  - Database connection pool utilization > 80%.
