# Parkly — AWS Services Connection Map

> Detailed diagram showing how every AWS service connects to Parkly microservices and data flows.

---

## High-Level AWS Architecture Overview

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                            CLIENTS & FRONTENDS                               │
│  📱 Driver App (Expo RN)  │  🖥️ Host Dashboard (React)  │  🔧 Admin (React)  │
└────────────────────────────────────────┬─────────────────────────────────────┘
                                         │ HTTPS
                    ┌────────────────────▼────────────────────┐
                    │   CloudFront / Amplify                  │
                    │   (CDN + Static Hosting)                │
                    └────────────────────┬────────────────────┘
                                         │
                    ┌────────────────────▼────────────────────┐
                    │   API Gateway (Port 4000)               │
                    │   • Rate Limiting                       │
                    │   • JWT Validation                      │
                    │   • Route Optimization                  │
                    └──┬────┬────┬────┬────┬────┬────┬────┬──┘
                       │    │    │    │    │    │    │    │
     ┌─────────────────┴────┴────┴────┴────┴────┴────┴────┴─────────────────┐
     │                  11 MICROSERVICES (Container Layer)                    │
     │  :4001        :4002        :4003        :4004        :4005            │
     │  Auth      Booking       Payment       Search      Prediction         │
     │  Service   Service       Service       Service     Service            │
     │    │          │            │            │            │               │
     │  :4007        :4008        :4009        :4010        :4011            │
     │  Occupancy   Pricing    Notification   Host        Admin             │
     │  Service     Service     Service      Service       Service           │
     │    │          │            │            │            │               │
     └────┼──────────┼────────────┼────────────┼────────────┼────────────────┘
          │          │            │            │            │
          └──────────┴────────────┴────────────┴────────────┘
                     │ All Services Read/Write
                     │
     ┌───────────────▼──────────────────────────────────────┐
     │         🗄️ DATA LAYER (PostgreSQL & DynamoDB)        │
     │                                                       │
     │  PostgreSQL (RDS 16)        │    DynamoDB (NoSQL)    │
     │  ┌─────────────────────┐    │  ┌───────────────────┐ │
     │  │ • Users            │    │  │ • OTP Table       │ │
     │  │ • Hosts            │    │  │   (TTL expire)    │ │
     │  │ • Spaces           │    │  │ • Occupancy       │ │
     │  │ • Slots            │    │  │   (time-series)   │ │
     │  │ • Bookings         │    │  │ • Notifications   │ │
     │  │ • Payments         │    │  │   (userId GSI)    │ │
     │  │ • Transactions     │    │  └───────────────────┘ │
     │  │ • Pricing Rules    │    │                        │
     │  │ • Payouts          │    │                        │
     │  └─────────────────────┘    │                        │
     └───────────────┬─────────────┼──────────────────────┘
                     │             │
                     │             └────────────┐
                     │                          │
     ┌───────────────▼─────────────┐  ┌────────▼────────────┐
     │  🔐 KMS (Encryption at Rest)│  │  📊 CloudWatch      │
     │  ┌──────────────────────┐   │  │  • Logs             │
     │  │ Encrypts:            │   │  │  • Metrics          │
     │  │ • RDS storage        │   │  │  • Alarms           │
     │  │ • DynamoDB tables    │   │  │  • Dashboards       │
     │  │ • S3 buckets         │   │  │                     │
     │  └──────────────────────┘   │  └─────────────────────┘
     └────────────────────────────┘
          │
          ▼ Events & Async Integration
┌─────────────────────────────────────────────────────────┐
│         🚀 EventBridge (Event Bus)                      │
│  Decouples services via events:                         │
│  • BookingCreated → Notification Service               │
│  • PaymentCompleted → Analytics                        │
│  • OccupancyChanged → Prediction / Analytics           │
│  • RefundIssued → Payout Service                       │
└─────────────┬─────────────────────────────────┬────────┘
              │                                 │
         ┌────▼─────┐                    ┌──────▼──────────────┐
         │    📨     │                    │    📈 Analytics      │
         │   SNS     │                    │                      │
         │  Topics   │                    │  ┌───────────────┐  │
         │           │                    │  │ S3 Datalake   │  │
         │ • SMS OTP │                    │  │ • Bookings    │  │
         │ • Alerts  │                    │  │ • Payments    │  │
         └───────────┘                    │  │ • Occupancy   │  │
                                          │  └─────┬─────────┘  │
                                          │        │            │
                                          │  ┌─────▼─────────┐  │
                                          │  │  Glue (ETL)   │  │
                                          │  │  • Data Curation
                                          │  │  • Schema Inf │  │
                                          │  └─────┬─────────┘  │
                                          │        │            │
                                          │  ┌─────▼─────────┐  │
                                          │  │ Athena (SQL)  │  │
                                          │  │ • Ad-hoc Query
                                          │  └─────┬─────────┘  │
                                          │        │            │
                                          │  ┌─────▼──────────┐ │
                                          │  │QuickSight (BI) │ │
                                          │  │ • Dashboards   │ │
                                          │  │ • Reports      │ │
                                          │  └────────────────┘ │
                                          └────────────────────┘
                                          
┌─────────────────────────────────────────────────────────┐
│     🤖 AI & ML (Current & Future)                       │
│                                                         │
│  Bedrock (Ready)        │    SageMaker (Scaffolded)    │
│  • Chat Completion      │    • Train prediction model  │
│  • Embeddings           │    • Real-time inference     │
│  • Image generation     │    • Batch transform         │
└─────────────────────────────────────────────────────────┘
```

---

## Detailed Service-by-Service Connections

### 1. VPC (Virtual Private Cloud)
**Role:** Network isolation and security boundary for all AWS resources.

**Connected to:**
- **RDS PostgreSQL** — sits in Private Isolated subnet; only accessible from app subnets
- **DynamoDB** — accessed via VPC endpoints (no internet traversal needed)
- **Security Groups** — RDS security group allows traffic only from app subnets
- **NAT Gateways** — 1 in dev, 2 in prod for egress to Internet (API calls, GitHub, NTP)
- **Availability Zones** — services spread across 2 (dev) or 3 (prod) for high availability

**Subnet Architecture:**
```
Public Subnets (2 AZs)
  └─ API Gateway (edge-optimized)
  └─ NAT Gateways
  └─ CloudFront (edge locations)

Private Subnets with Egress (2 AZs)
  └─ ECS Fargate tasks (microservices)
  └─ Lambda functions
  └─ Outbound internet access via NAT

Private Isolated Subnets (2 AZs)
  └─ RDS PostgreSQL (no inbound from internet)
  └─ DynamoDB via VPC endpoints only
```

---

### 2. RDS PostgreSQL 16
**Role:** Transactional source-of-truth for structured data.

**Connected to:**
- **All 11 microservices** — read/write via Prisma ORM
  - `booking-service` — CRUD bookings, slots, availability
  - `auth-service` — user records, verification states
  - `payment-service` — payment records, refunds, payouts
  - `search-service` — spaces, filters, queries
  - `pricing-service` — pricing rules, multipliers
  - `host-service` — host profiles, space listings
  - `occupancy-service` — occupancy history
  - `admin-service` — user management, verification queue
  - `prediction-service` — historical patterns (for training)
  - `notification-service` — notification preferences
  - `api-gateway` — user context, rate limit counters
  
- **KMS** — storage encrypted with AWS-managed key
- **CloudWatch** — slow query logs, performance metrics
- **Secrets Manager** — connection credentials (auto-rotated in prod)
- **Prisma** — schema versioning, migrations, seeding

**Data Flow:**
```
Service (HTTP) → Prisma ORM → RDS PostgreSQL
                              ↓ (select/insert/update)
                              12 models, 11 enums
                              ↓
                         CloudWatch Logs
                         (slow queries, connections)
```

**Security:**
- Multi-AZ failover in production
- Storage encrypted at rest (KMS)
- Deletion protection enabled in prod
- Only accessible from app subnet via security group
- Automated backups (daily in prod)

---

### 3. DynamoDB (3 Tables)
**Role:** High-velocity, TTL-managed, and real-time data.

#### Table 1: `parkly-otp`
**Connected to:**
- **auth-service** — writes OTP, reads for verify/lockout
- **TTL** — auto-expires records after `expiresAt` timestamp
- **CloudWatch** — throttling alarms

**Data Flow:**
```
User requests OTP → auth-service → DynamoDB (parkly-otp)
                                   ├─ stores: phone, code, expiresAt, attempts
                                   └─ TTL expires after 10 minutes
```

#### Table 2: `parkly-occupancy`
**Connected to:**
- **occupancy-service** — ingests sensor/simulator/manual updates
- **search-service** — reads for current occupancy display
- **prediction-service** — reads historical patterns
- **analytics pipeline** (S3 Datalake via EventBridge)
- **Partition key:** `spaceId`; **Sort key:** `timestamp` (time-series)

**Data Flow:**
```
IoT Sensor / Manual Update → occupancy-service → DynamoDB (parkly-occupancy)
                                                 ├─ writes: {spaceId, timestamp, occupancyLevel, capacity}
                                                 ├─ published to EventBridge
                                                 └─ consumed by prediction & analytics
Search queries → search-service → reads current occupancy
```

#### Table 3: `parkly-notifications`
**Connected to:**
- **notification-service** — writes in-app notifications
- **api-gateway / clients** — reads for `/notifications` endpoint
- **GSI:** `userId-createdAt-index` for fast user notification queries

**Data Flow:**
```
Event (BookingCreated) → EventBridge → notification-service → DynamoDB (parkly-notifications)
                                                              ├─ writes: {pk: userId, sk: notificationId, ...}
                                                              ├─ pushes to mobile via FCM (future)
                                                              └─ API returns in-app feed
```

**Security:**
- All tables encrypted with AWS-managed encryption
- Pay-per-request billing (no capacity planning)
- Point-in-time recovery enabled (production)
- DynamoDB Streams configured for real-time triggers (future)

---

### 4. S3 (2 Buckets)
**Role:** Persistent object storage and data lake.

#### Bucket 1: `parkly-dev-uploads`
**Connected to:**
- **host-service** — signed URLs for space photo uploads
- **api-gateway** — presigned POST for direct upload from mobile
- **CloudFront** — serves photo URLs to clients (CDN cache)
- **Lifecycle rules** — `temp/` prefix expires after 7 days

**Data Flow:**
```
Host uploads space photo → api-gateway (presigned URL) → S3 (parkly-uploads/spaceId/)
                                                        ├─ versioning disabled (cost)
                                                        └─ CloudFront caches at edge
                                        ↓ (read)
Client requests photo → CloudFront → S3 (cache miss) → browser
```

#### Bucket 2: `parkly-dev-datalake`
**Connected to:**
- **EventBridge** → **Glue ETL jobs** — consume booking/payment/occupancy events
- **Glue** — partitions data into `s3://parkly-datalake/bookings/year=2026/month=06/day=25/`
- **Athena** — queries the partitioned Parquet files
- **QuickSight** — reads Athena queries for dashboards
- **Versioning enabled** — audit trail of data changes

**Data Flow:**
```
Service emits event → EventBridge → Glue Job (triggers)
                                    ├─ transforms JSON → Parquet
                                    ├─ partitions by date/spaceId/city
                                    └─ writes to S3 datalake
                                    
City Admin queries → QuickSight → Athena → S3 (datalake)
                                  └─ SELECT * FROM bookings WHERE city='Chennai'
```

**Security:**
- All buckets: SSL enforced, public access blocked, no anonymous reads
- Encryption: S3-managed (cost-effective for MVP)
- CORS configured for web app uploads
- Object lifecycle policies reduce storage costs

---

### 5. Secrets Manager
**Role:** Secure credential storage (no hardcoding).

**Connected to:**
- **RDS PostgreSQL** — stores and auto-rotates DB password
  - Services read secret ARN from environment, fetch at startup
  - 30-day rotation (automatic)
  
- **Environment variables** — services read `DB_SECRET_ARN` and fetch secret

**Data Flow:**
```
CDK Deployment → Secrets Manager (auto-generates RDS password)
                 ├─ stored: encrypted at rest, audit-logged
                 └─ ARN provided to services via env var

Service startup → queries Secrets Manager API → fetches password → connects to RDS
                 (credentials never in .env files)
```

**Stored Secrets in Production:**
- `parkly-prod/rds/postgres` — PostgreSQL credentials
- `parkly-prod/jwt` — JWT signing secrets
- `parkly-prod/payment` — Razorpay/Cashfree API keys
- `parkly-prod/sms` — SMS gateway credentials (if not SNS)
- `parkly-prod/google-maps` — Maps API key

---

### 6. KMS (Key Management Service)
**Role:** Encryption key management at rest.

**Connected to:**
- **RDS PostgreSQL** — database storage encrypted with KMS key
- **DynamoDB** — table encryption uses AWS-managed key (can upgrade to customer-managed)
- **S3 buckets** — object encryption (currently S3-managed, upgradable to KMS)
- **Secrets Manager** — all secrets encrypted with KMS

**Data Flow:**
```
Data written to RDS/DynamoDB/S3 → encrypted with KMS key → stored on disk
                                   ↓ (on decrypt)
Application requests data → KMS decrypts → application gets plaintext
                            (audit: CloudTrail logs all decrypt calls)
```

**Compliance:**
- Least-privilege IAM allows services to decrypt only their own data keys
- CloudTrail audits all KMS operations

---

### 7. EventBridge (Event Bus)
**Role:** Async, decoupled service-to-service communication.

**Connected to:**
- **All 11 microservices** — emit domain events (event producers/consumers)
- **SNS** — email/SMS notifications from events
- **Glue** — ETL jobs trigger on booking/payment events
- **S3 datalake** — raw event JSON archived
- **Lambda** — event handlers (future: refund automation, dispute escalation)

**Event Flow Diagram:**
```
Service A (Producer)               Service B (Consumer)
  │                                    │
  ├─ BookingCreated          ◄────────┤ subscribes to BookingCreated
  ├─ PaymentCompleted        ◄────────┤ subscribes to PaymentCompleted
  ├─ OccupancyChanged        ◄────────┤ subscribes to OccupancyChanged
  └─ RefundIssued            ◄────────┤ subscribes to RefundIssued
     │
     ▼ (putEvents API)
  EventBridge (parkly-event-bus)
     │
     ├─ Rule: BookingCreated → notification-service (Lambda/HTTP)
     ├─ Rule: PaymentCompleted → analytics (Glue)
     ├─ Rule: OccupancyChanged → prediction (Glue/SageMaker)
     └─ Rule: * (all events) → S3 datalake archive
```

**Event Examples:**
```json
{
  "source": "booking-service",
  "detail-type": "BookingCreated",
  "detail": {
    "bookingId": "bk_abc123",
    "spaceId": "sp_xyz789",
    "userId": "usr_driver42",
    "arrivalTime": "2026-06-26T10:30:00Z",
    "durationMinutes": 120
  }
}
```

**Subscribers per Event:**

| Event | Subscribers | Action |
|-------|-------------|--------|
| `BookingCreated` | notification-service | Send SMS/push/in-app |
| `BookingCreated` | Glue ETL | Log to datalake |
| `PaymentCompleted` | notification-service | Confirm payment SMS |
| `PaymentCompleted` | payment-service | Initiate host payout |
| `PaymentCompleted` | analytics | Record transaction |
| `OccupancyChanged` | prediction-service | Update ML features |
| `OccupancyChanged` | analytics | Real-time dashboard |
| `RefundIssued` | notification-service | Notify driver |
| `RefundIssued` | payment-service | Log to audit trail |

---

### 8. SNS (Simple Notification Service)
**Role:** SMS and email delivery (OTP, alerts, confirmations).

**Connected to:**
- **EventBridge** — receives events, publishes to SNS topics
- **auth-service** — publishes OTP SMS via SNS
- **notification-service** — publishes booking/payment SMS
- **CloudWatch** — alarm notifications

**Data Flow:**
```
auth-service requests OTP SMS → SNS Topic (parkly-sms)
                                ├─ subscriber: AWS SMS provider
                                ├─ phone: +91 98765 43210
                                └─ message: "Your OTP is 123456"
                                   ↓
                        SMS delivered to driver's phone
                        (cost: ~₹1–2 per SMS in India)
```

**SMS Topics:**
- `parkly-dev-sms` — OTP codes, booking confirmations, alerts

---

### 9. CloudWatch
**Role:** Observability, logging, monitoring, and alerting.

**Connected to:**
- **All 11 microservices** — ship structured logs via stdout → CloudWatch Logs
- **RDS PostgreSQL** — slow query logs, connection metrics
- **DynamoDB** — read/write throttling, latency metrics
- **API Gateway** — request/response metrics, errors
- **Lambda/ECS** — execution logs, duration, errors
- **S3 buckets** — access logs, lifecycle events
- **SNS** — delivery metrics, failed sends

**Data Flow:**
```
Service (stderr/stdout)
  ├─ "{"timestamp": "2026-06-26T10:30:00Z", "level": "ERROR", "msg": "Booking failed"}"
  ▼ (CloudWatch agent)
CloudWatch Logs (/aws/ecs/parkly-booking-service)
  ├─ Log Streams: [task-1, task-2, task-3]
  ├─ Metric Filters: extract error count, response time
  └─ Dashboards: show errors per service, latency p99
  
Alarm triggers → SNS topic → ops team Slack/email
```

**Key Metrics Tracked:**
- API latency (p50, p95, p99)
- Error rates (5xx, 4xx)
- Service availability (health checks)
- Database connection pool exhaustion
- DynamoDB throttling
- S3 upload/download speeds
- Event delivery lag (EventBridge)

---

### 10. API Gateway (App-Level)
**Role:** Central entry point, rate limiting, JWT validation, reverse proxy.

**Connected to:**
- **All 11 microservices** — routes HTTP requests to backend services
- **CloudWatch** — logs all API traffic, latency, errors
- **Secrets Manager** — fetches JWT signing keys for validation
- **WAF** (future) — SQL injection, DDoS protection

**Data Flow:**
```
Client (mobile/web)
  ├─ GET /api/v1/search?lat=13.0&lng=80.3
  ▼ (HTTPS)
API Gateway (:4000)
  ├─ rate limit check (100 req/min per user)
  ├─ JWT validation (from Authorization header)
  ├─ extract claims (userId, role)
  ├─ forward to search-service (:4004) with user context
  ▼
search-service processes → database queries → response
  ▼ (back to gateway)
API Gateway → compress → add security headers → send to client
```

**Rate Limiting Strategy:**
```
- 100 requests/minute per user (auth)
- 10 requests/minute per IP (public endpoints)
- Burst allowance: +20% (120 req in 1 sec spike)
```

---

### 11. Lambda & ECS Fargate (Compute)
**Role:** Run the 11 microservices and event handlers.

#### ECS Fargate (Main services)
**Connected to:**
- **All 11 microservices** — containerized Node.js + Express apps
  - Deployed via ECR (Elastic Container Registry)
  - Fargate launch type (serverless containers)
  - Service discovery via ECS service registry
  
- **Application Load Balancer (ALB)** — routes traffic from API Gateway to services
- **CloudWatch** — container logs, metrics
- **RDS PostgreSQL** — database connections
- **DynamoDB** — session/cache access
- **S3** — upload/download
- **EventBridge** — event publishing
- **Secrets Manager** — fetch credentials at startup

**Deployment:**
```
Dockerfile → ECR (registry) → ECS Task Definition
            ├─ image: 123456789.dkr.ecr.us-east-1.amazonaws.com/parkly-auth:latest
            ├─ memory: 512 MB
            ├─ cpu: 256 (1/4 vCPU)
            └─ 2–10 replicas (auto-scale on CPU/memory)
```

#### Lambda (Event handlers + async jobs)
**Connected to:**
- **EventBridge** — triggered by booking/payment/occupancy events
- **DynamoDB Streams** (future) — real-time data triggers
- **SNS** — email/SMS delivery handlers
- **S3** — image resizing, thumbnail generation
- **Bedrock** — AI inference for chat/recommendations

**Example Lambda Function:**
```
Event: BookingCancelled from EventBridge
  → Lambda (refund-handler)
  → queries payment-service API
  → initiates refund to payment gateway
  → logs to CloudWatch
  → publishes RefundCompleted event back to EventBridge
```

---

### 12. CloudFront (CDN)
**Role:** Global content delivery for web apps and media.

**Connected to:**
- **S3 (uploads bucket)** — caches space photos at edge
  - Origin: `parkly-uploads.s3.us-east-1.amazonaws.com`
  - TTL: 30 days for images
  
- **S3 (datalake)** — caches analytics reports
  - Origin: `parkly-datalake.s3.us-east-1.amazonaws.com`
  - TTL: 1 hour (admin dashboards need fresh data)
  
- **API Gateway** — origin for dynamic API calls (doesn't cache JSON by default)

**Data Flow:**
```
Client requests /uploads/sp_123/photo.jpg
  ├─ first hit: CloudFront edge → S3 origin → download (50 KB)
  ├─ cache for 30 days at edge
  └─ subsequent hits: served from edge (< 100 ms)
```

---

### 13. Cognito (Identity Management) — *Planned*
**Role:** Managed authentication and user pools (current: custom JWT).

**Will connect to:**
- **Mobile app** — sign-in UI, token refresh
- **Web apps** — SSO, multi-factor auth
- **API Gateway** — authorize requests via Cognito JWT
- **IAM roles** — grant temporary AWS credentials to users (future: S3 direct upload)

**Roadmap Integration:**
```
Auth Flow v2 (production):
  1. Mobile app → Cognito sign-in
  2. Cognito returns ID token + access token
  3. API Gateway validates token (Cognito authorizer)
  4. Services receive user claims
```

---

### 14. Bedrock (Generative AI) — *Ready to use*
**Role:** AI-powered recommendations and assistant.

**Connected to:**
- **recommendation-service** — generate personalized parking suggestions
- **search-service** — re-rank results using Claude embeddings
- **chat endpoint** (future) — support chatbot for drivers
- **Model:** Claude 3 or latest

**Data Flow:**
```
Driver: "Find me cheap parking near the airport"
  → recommendation-service
  → calls Bedrock Claude API
  → generates personalized suggestions
  → returns ranked spaces
```

**Cost:** ~$0.001 per API call (token-based pricing)

---

### 15. SageMaker (Machine Learning) — *Scaffolded*
**Role:** Train and deploy ML prediction models for occupancy forecasting.

**Will connect to:**
- **prediction-service** — replace rule-based engine with ML inference endpoint
- **S3 datalake** — training data (historical occupancy + bookings)
- **Occupancy-service** — consume predictions
- **CloudWatch** — monitor model performance, data drift

**Training Pipeline (future):**
```
1. Glue ETL extracts occupancy data → S3 training set
2. SageMaker training job (Spot instances) trains LSTM/XGBoost model
3. Model artifact → S3 model registry
4. SageMaker endpoint deployed (auto-scaling)
5. prediction-service calls SageMaker endpoint
6. predictions returned (p99 latency: <50 ms)
```

**Current State:** Rule-based engine with clean interface for easy ML swap-out.

---

### 16. Glue (ETL) — *Active*
**Role:** Extract, transform, and load event data into data lake.

**Connected to:**
- **EventBridge** — triggers Glue job on booking/payment events
- **S3 datalake** — writes Parquet files, partitioned by date/city/event-type
- **DynamoDB** — (future) crawl tables for schema discovery
- **Athena** — catalog metadata for SQL queries

**Workflow:**
```
1. Booking event → EventBridge rule triggers Glue job
2. Glue crawls S3 (detects Parquet schema)
3. Glue transforms raw JSON
   ├─ flatten nested fields
   ├─ convert timestamps to ISO-8601
   ├─ partition by date/city
   └─ deduplicate by booking_id
4. Write to S3: s3://parkly-datalake/bookings/year=2026/month=06/day=26/
5. Athena Glue catalog updated
```

---

### 17. Athena (SQL Query Engine) — *Active*
**Role:** Serverless ad-hoc SQL queries on data lake.

**Connected to:**
- **S3 datalake** — data source (Parquet files)
- **Glue Catalog** — table metadata
- **QuickSight** — dashboards query Athena
- **Admin users** — manual exploration via Athena console

**Query Examples:**
```sql
-- Revenue by city
SELECT city, SUM(booking_amount) as total_revenue 
FROM bookings 
WHERE year = 2026 AND month = 6
GROUP BY city;

-- Peak hours
SELECT hour(arrival_time) as hour, COUNT(*) as bookings
FROM bookings
WHERE city = 'Chennai'
GROUP BY hour(arrival_time)
ORDER BY bookings DESC;
```

**Cost:** ~$6.25 per TB scanned (cheaper with Parquet compression)

---

### 18. QuickSight (Business Intelligence) — *Ready to use*
**Role:** Create dashboards for admin/host/analytics teams.

**Connected to:**
- **Athena** — query engine (or RDS direct)
- **S3 datalake** — dashboards on Parquet data
- **Admin Portal** — embed dashboards via iframe

**Example Dashboards:**
```
City Admin Dashboard:
  ├─ Real-time occupancy heatmap (by zone)
  ├─ Revenue trends (line chart)
  ├─ Peak-hour analysis (bar chart)
  ├─ Top 10 hosts by earnings (table)
  └─ Demand forecast (next 7 days)

Host Dashboard:
  ├─ My space occupancy (ring gauge)
  ├─ Monthly revenue (area chart)
  ├─ Bookings pipeline (status breakdown)
  └─ Payout schedule (calendar)
```

---

### 19. Amplify (Frontend Hosting) — *Configured*
**Role:** CI/CD and hosting for web apps (React).

**Connected to:**
- **GitHub** — automatic deploy on push to `main`
- **CloudFront** — CDN for static assets
- **API Gateway** — backend API endpoint (CORS configured)
- **Cognito** (future) — auth integration

**Deployment:**
```
Push to main → GitHub webhook → Amplify
  ├─ npm run build
  ├─ npm run test
  ├─ build/ artifact → S3
  └─ invalidate CloudFront cache
  → live in ~2 minutes
```

---

## Summary: AWS Service Dependency Graph

```
┌─────────────────────────────────────────────────────┐
│ User (Driver/Host/Admin)                            │
└────────────────┬────────────────────────────────────┘
                 │ HTTPS
         ┌───────▼────────┐
         │  CloudFront    │ (CDN caches)
         └───────┬────────┘
                 │
   ┌─────────────▼──────────────┐
   │   API Gateway (Port 4000)  │ ◄─ Secrets Manager (JWT keys)
   │   - Rate limit             │ ◄─ CloudWatch (logs)
   │   - JWT auth               │
   └────────┬────────────────────┘
            │ HTTP (internal)
   ┌────────▼────────────────────────────────────────┐
   │  ECS Fargate (11 services) ◄─ ECR (images)      │
   │  ├─ auth-service           ◄─ RDS (user data)   │
   │  ├─ booking-service        ◄─ DynamoDB (cache)  │
   │  ├─ payment-service        ◄─ Secrets Mgr (keys)│
   │  ├─ search-service         ◄─ CloudWatch (logs) │
   │  ├─ prediction-service     ◄─ S3 (training)     │
   │  ├─ occupancy-service      ◄─ DynamoDB (ts)     │
   │  ├─ pricing-service        ◄─ S3 (datalake)     │
   │  ├─ notification-service   ◄─ SNS (SMS)         │
   │  ├─ host-service           ◄─ Bedrock (AI)      │
   │  ├─ admin-service          ◄─ SageMaker (ML)    │
   │  └─ api-gateway            ◄─ EventBridge (events)
   └────────┬────────────────────────────────────────┘
            │
   ┌────────▼────────────────────────────────────────┐
   │  EventBridge (event bus)  ◄─ CloudWatch (metrics)│
   │  - event routing                                │
   │  - fan-out to SNS/Lambda/Glue                   │
   └────────┬────────────────────────────────────────┘
            │
    ┌───────┼───────────────────────────────────────┐
    │       │                                       │
   ▼        ▼                                       ▼
  SNS       Glue                               Lambda
  (SMS)  (ETL)                              (event handlers)
          │
          ▼
        S3 (datalake)
          │
    ┌─────┼──────────┐
    │     │          │
    ▼     ▼          ▼
 Athena Crawler  QuickSight
 (SQL)  (schema) (dashboards)
```

---

## Network Security Model

```
┌─────────────────────────────────────────────────────────┐
│ Internet (Client)                                       │
└────────────────┬────────────────────────────────────────┘
                 │ HTTPS only
         ┌───────▼────────┐
         │  CloudFront    │ (AWS edge)
         │  AWS WAF (future)
         └───────┬────────┘
                 │
         ┌───────▼──────────────────┐
         │  Public Subnet (NAT)     │
         │  - API Gateway           │
         │  - ALB                   │
         └────────┬─────────────────┘
                  │ (port 4000–4011)
         ┌────────▼──────────────────┐
         │ Private Subnet + Egress   │
         │ - ECS Fargate Services    │
         │ - can reach: RDS, DDB,    │
         │   S3, Internet (via NAT)  │
         └────────┬─────────────────┘
                  │
         ┌────────▼──────────────────┐
         │ Private Isolated Subnet   │
         │ - RDS PostgreSQL          │
         │ - DynamoDB (via endpoint) │
         │ - no inbound from outside │
         │ - no outbound to internet │
         └────────────────────────────┘
```

---

## Encryption & Compliance

| Layer | Encryption | Authority | Audit |
|-------|-----------|-----------|-------|
| In Transit | TLS 1.2+ (HTTPS) | AWS Certificate Manager | CloudTrail |
| At Rest (RDS) | KMS-managed | AWS Key Management | CloudTrail |
| At Rest (DynamoDB) | AWS-managed | AWS Encryption | CloudTrail |
| At Rest (S3) | S3-managed (MVP) → KMS (prod) | AWS Key Management | S3 Access Logs |
| Secrets | Secrets Manager (KMS) | AWS Key Management | CloudTrail |
| Audit Logs | CloudTrail | AWS | S3 (immutable) |

