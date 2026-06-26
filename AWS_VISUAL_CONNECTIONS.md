# Parkly — AWS Services Visual Connection Diagrams

---

## 1. End-to-End User Request Journey

### Driver searches for parking:

```
STEP 1: Mobile App (Driver)
┌──────────────────────────────────┐
│ GET /api/v1/search               │
│ ?lat=13.0352&lng=80.2673&radius=2│
│ Authorization: Bearer JWT_TOKEN  │
└────────────┬─────────────────────┘
             │ HTTPS encrypted
             ▼
┌──────────────────────────────────────────────────────────┐
│ STEP 2: CloudFront → API Gateway (Port 4000)             │
├──────────────────────────────────────────────────────────┤
│ • Rate limit check: 100 req/min per user               │
│ • JWT signature validation (Secrets Manager key)       │
│ • Extract userId & role from token                    │
│ • Log request to CloudWatch                           │
│ • Forward to search-service (:4004)                   │
└────────────┬───────────────────────────────────────────┘
             │ HTTP (internal AWS network)
             ▼
┌──────────────────────────────────────────────────────────┐
│ STEP 3: search-service (:4004, ECS Fargate)              │
├──────────────────────────────────────────────────────────┤
│ • Geohash the location (13.0352, 80.2673)              │
│ • Query RDS PostgreSQL for spaces within 2km          │
│   └─ SELECT * FROM spaces WHERE                       │
│      ST_Distance(geom, point) < 2000                  │
│ • Filter by availability (RDS + DynamoDB occupancy)   │
│ • Call prediction-service for each space              │
│ • Call recommendation-service for scoring             │
└────────────┬───────────────────────────────────────────┘
             │
  ┌──────────┼──────────┐
  ▼          ▼          ▼
RDS         DDB       Bedrock
(spaces)  (occupancy) (embeddings)
  │          │          │
  └──────────┼──────────┘
             │ response
             ▼
┌──────────────────────────────────────────────────────────┐
│ STEP 4: search-service constructs response              │
├──────────────────────────────────────────────────────────┤
│ [                                                        │
│   {                                                      │
│     "spaceId": "sp_123",                               │
│     "distance": 0.8,  # km                             │
│     "price": 50,      # dynamic price                  │
│     "availability": { "probability": 0.85 },  # AI     │
│     "score": 92.4     # ranking                        │
│   },                                                    │
│   ... (sorted by score)                                │
│ ]                                                       │
└────────────┬───────────────────────────────────────────┘
             │ JSON response
             ▼
┌──────────────────────────────────────────────────────────┐
│ STEP 5: API Gateway → CloudFront → Client               │
├──────────────────────────────────────────────────────────┤
│ • Compress response (gzip)                             │
│ • Add security headers (CSP, X-Frame-Options)         │
│ • Cache control headers (if cacheable)                │
│ • Log response to CloudWatch                          │
│ • Send HTTPS to client                               │
└────────────┬───────────────────────────────────────────┘
             │
             ▼
        🏁 Driver sees ranked parking results on map!
```

---

### Driver books a parking space:

```
STEP 1: Mobile App (Driver)
┌──────────────────────────────────────────────────┐
│ POST /api/v1/bookings                            │
│ {                                                │
│   "spaceId": "sp_123",                          │
│   "vehicle": "DL01AB1234",                      │
│   "arrivalTime": "2026-06-26T14:30:00Z",       │
│   "durationMinutes": 120,                       │
│   "paymentToken": "tok_razorpay_abc123"        │
│ }                                               │
└────────────┬──────────────────────────────────┘
             │ JWT auth
             ▼
┌──────────────────────────────────────────────────┐
│ API Gateway                                      │
│ • Validate JWT                                  │
│ • Rate limit (100/min)                         │
│ • Forward to booking-service (:4002)           │
└────────────┬──────────────────────────────────┘
             │
             ▼
┌──────────────────────────────────────────────────┐
│ booking-service (:4002, ECS)                     │
├──────────────────────────────────────────────────┤
│ 1. Validate slot availability (RDS transaction) │
│ 2. Lock slot (optimistic concurrency control)   │
│ 3. Deduct pricing from occupancy + multiplier   │
│ 4. Create booking record in RDS                │
│ 5. Call payment-service (:4003)                │
└────────────┬──────────────────────────────────┘
             │
             ▼
┌──────────────────────────────────────────────────┐
│ payment-service (:4003, ECS)                     │
├──────────────────────────────────────────────────┤
│ • Tokenize payment (fetch token from request)   │
│ • Call Razorpay API (mock for MVP)             │
│ • Record PaymentInitiated in RDS               │
│ • Emit PaymentInitiated event to EventBridge   │
└────────────┬──────────────────────────────────┘
             │ event
             ▼
┌──────────────────────────────────────────────────┐
│ EventBridge (event bus)                          │
├──────────────────────────────────────────────────┤
│ Event: PaymentInitiated                         │
│ {                                                │
│   "source": "payment-service",                  │
│   "detail": { "bookingId": "bk_xyz" }          │
│ }                                               │
│                                                  │
│ Rules:                                          │
│ • notification-service → SMS "Payment pending" │
│ • Glue job → S3 datalake                       │
│ • Lambda → process refunds (future)            │
└────────────┬──────────────────────────────────┘
             │
    ┌────────┼─────────┐
    ▼        ▼         ▼
  SNS      Glue     Lambda
 (SMS)    (ETL)    (handlers)
    │        │         │
    │        │         ▼
    │        │      S3 datalake
    │        │      Athena query
    │        │      QuickSight dash
    │        │
    ▼        
Payment-service confirms PaymentCompleted
    │
    ├─ Update RDS (booking.status = 'CONFIRMED')
    ├─ Emit BookingConfirmed → EventBridge
    ├─ notification-service sends booking SMS/push
    └─ host-service gets new booking alert
         ├─ updates Host Dashboard (real-time via WebSocket)
         └─ occupancy status changes for the space
    
    ▼
🏁 Driver gets booking confirmation!
   + SMS with details
   + Notification in app
   + Host sees new booking

```

---

## 2. Data Storage & Real-Time Updates Flow

```
┌────────────────────────────────────────────────────────────┐
│ occupancy-service receives sensor update (IoT / manual)    │
│ POST /api/v1/occupancy/ingest                             │
│ { spaceId: "sp_123", occupied: 8, capacity: 10 }         │
└────────────┬───────────────────────────────────────────────┘
             │
             ▼
┌────────────────────────────────────────────────────────────┐
│ occupancy-service (:4007, ECS Fargate)                     │
├────────────────────────────────────────────────────────────┤
│ • Validate space exists (query RDS)                      │
│ • Calculate occupancy% = occupied / capacity             │
│ • Write to DynamoDB (parkly-occupancy table)             │
│   └─ pk: spaceId, sk: timestamp                          │
│   └─ ttl: 90 days (auto-purge old records)               │
│ • Emit OccupancyChanged to EventBridge                   │
│ • Log to CloudWatch                                      │
└────────┬───────────────────────────────────────────────────┘
         │
    ┌────┴────────────────┐
    │                     │
    ▼ (real-time)    ▼ (async)
DynamoDB        EventBridge
(occupancy)     (publish)
    │                │
    │           ┌────┼────┐
    │           │    │    │
    │       SNS  Glue Lambda
    │       SMS  ETL  handlers
    │       to   to   to
    │      host  S3   Athena
    │
    ├─ search-service queries DynamoDB
    │  └─ /GET /occupancy/sp_123 → 80% occupied
    │
    └─ CloudWatch
       └─ emit metric "occupancy.updated"
          └─ dashboard shows real-time gauge
```

---

## 3. Analytics & Insights Pipeline

```
Operational Services (real-time data generation)
│
├─ booking-service: BookingCreated, BookingCancelled
├─ payment-service: PaymentCompleted, RefundIssued
├─ occupancy-service: OccupancyChanged
├─ auth-service: UserSignedUp
└─ host-service: SpaceCreated, SpaceVerified
    │
    │ putEvents → EventBridge
    │
    ▼
┌─────────────────────────────────────────────────┐
│ EventBridge (parkly-event-bus)                  │
│ Rule: * (all events) → S3 (raw archive)        │
│ Rule: booking.* → Glue Job                     │
│ Rule: payment.* → Glue Job                     │
│ Rule: occupancy.* → Glue Job                   │
└────────┬────────────────────────────────────────┘
         │
    ┌────┴────┬─────────┬─────────┐
    ▼         ▼         ▼         ▼
  S3      S3      Glue    Glue    Glue
 (raw)  (raw)    Job 1   Job 2   Job 3
        (archive) (book)  (pay)   (occ)
                  │       │       │
                  └───────┼───────┘
                          │
                   ┌──────▼──────┐
                   │ S3 Datalake │
                   │ (Parquet)   │
                   │             │
                   │ Partitions: │
                   │ year/       │
                   │ month/      │
                   │ day/        │
                   │ event_type  │
                   └──────┬──────┘
                          │
                   ┌──────▼──────┐
                   │ Glue Catalog│
                   │ (Metadata)  │
                   └──────┬──────┘
                          │
         ┌────────────────┼────────────────┐
         ▼                ▼                ▼
      Athena          QuickSight      Manual
      (SQL)           (Dashboard)     Exploration
      queries         analytics       (CLI)
         │                │
         └────────────┬───┘
                      │
        ▼─────────────────────────────────────────────┐
        │ Business Intelligence Outputs               │
        ├─────────────────────────────────────────────┤
        │ • Revenue by city, space, host             │
        │ • Peak hours (demand heatmap)              │
        │ • Booking success rate                     │
        │ • Payment failures & refunds               │
        │ • Host earnings & payouts                  │
        │ • Occupancy trends (per space)             │
        │ • Churn analysis (users, hosts)            │
        └─────────────────────────────────────────────┘
```

---

## 4. Security & Secrets Flow

```
┌────────────────────────────────────────────┐
│ CDK Deployment (first time)                │
│ aws cdk deploy --context env=prod          │
└────────────┬───────────────────────────────┘
             │
             ▼
┌────────────────────────────────────────────────────────┐
│ Secrets Manager (auto-generates)                       │
├────────────────────────────────────────────────────────┤
│ Secret: parkly-prod/rds/postgres                       │
│ {                                                      │
│   "username": "parkly",                               │
│   "password": "xY9mK@L!pqR$vW2z"  (auto-gen)         │
│ }                                                      │
│                                                        │
│ Secret: parkly-prod/jwt                               │
│ {                                                      │
│   "access": "jwt_sig_key_...",                       │
│   "refresh": "refresh_key_..."                       │
│ }                                                      │
│                                                        │
│ Secret: parkly-prod/payment                           │
│ {                                                      │
│   "razorpay_key": "...",                             │
│   "razorpay_secret": "..."                           │
│ }                                                      │
└────────────┬──────────────────────────────────────────┘
             │ encrypted with KMS key
             │
    ┌────────┴─────────┐
    ▼                  ▼
  KMS               CloudTrail
  (encryption)      (audit log)
  
At Runtime:
┌──────────────────────────────────┐
│ Service Container (ECS)          │
├──────────────────────────────────┤
│ ON STARTUP:                      │
│ • Read env: DB_SECRET_ARN        │
│ • Call Secrets Manager API       │
│ • Get decrypted secret (KMS)     │
│ • Parse credentials              │
│ • Connect to RDS                 │
│                                  │
│ Never hardcode secrets anywhere! │
└──────────────────────────────────┘
```

---

## 5. Service-to-Service Communication Patterns

### Pattern A: Synchronous (HTTP REST)
```
Client → API Gateway → service-A → service-B
                            │          │
                        read/write   read/write
                        RDS/DDB      RDS/DDB
```

**Example:** search-service calls prediction-service for availability scores.

### Pattern B: Asynchronous (EventBridge)
```
service-A emits event → EventBridge → service-B
                    (loose coupling)      ↓
                                    consume at own pace
                                    (no blocking)
                                    
Example: booking-service emits BookingCreated
         → notification-service receives & sends SMS
         → payment-service receives & initiates payout
         → Glue receives & archives to datalake
```

### Pattern C: Direct Database Access
```
service-A ─────┐
service-B ──┼─→ PostgreSQL / DynamoDB
service-C ─┘
```

**All services share RDS schema** (single source of truth).
**Services never call each other for reads**, they query the database directly.

---

## 6. Availability & Disaster Recovery

```
Multi-AZ Architecture (us-east-1)
┌─────────────────────────────────────────┐
│           AWS Region us-east-1          │
├──────────────────────┬──────────────────┤
│      AZ-1            │      AZ-2        │
│ (us-east-1a)         │ (us-east-1b)     │
│                      │                  │
│ ECS Task 1           │ ECS Task 1       │
│ ECS Task 2           │ ECS Task 2       │
│ ECS Task 3           │ ECS Task 3       │
│ ─────────────        │ ─────────────    │
│ ALB                  │ ALB              │
│ (primary)            │ (standby)        │
└──────────────────────┼──────────────────┘
                       │
                  RDS Primary ──┬─→ RDS Replica
                       │        │
                  (sync replication across AZ)
                       │
                   ┌────┴─────┐
                   ▼          ▼
                DynamoDB (managed by AWS)
                ├─ 3 copies across AZs
                └─ auto-heal on failure
```

**RTO (Recovery Time Objective):** < 5 minutes (RDS failover automatic)
**RPO (Recovery Point Objective):** < 1 minute (RDS sync replicas)

---

## 7. Monitoring & Alerting

```
All Services ─┐
              ├─ stderr/stdout (structured JSON)
              │
              ▼
         CloudWatch Logs
              │
         ┌────┴────────────────┐
         ▼                      ▼
    Log Groups            Metric Filters
    (/aws/ecs/parkly-*)   (parse JSON → metrics)
         │                      │
         ├─ searchable          ├─ latency_p99
         ├─ filterable          ├─ error_rate
         ├─ queryable           ├─ throughput
         └─ retentionable       └─ concurrency
                                     │
                            ┌────────▼──────────┐
                            │ CloudWatch Alarms │
                            ├───────────────────┤
                            │ IF latency_p99    │
                            │    > 500ms        │
                            │ THEN send to SNS  │
                            │    → ops_team@... │
                            └───────────────────┘

CloudWatch Dashboards
├─ Platform Overview
│  ├─ all services health (green/red)
│  ├─ latency distribution
│  ├─ error rate by service
│  └─ throughput (req/sec)
│
├─ Per-Service Dashboard
│  ├─ response time (p50, p95, p99)
│  ├─ memory/CPU utilization
│  ├─ errors (4xx, 5xx)
│  └─ database connection pool
│
└─ Infrastructure Dashboard
   ├─ RDS CPU/connections
   ├─ DynamoDB consumed capacity
   ├─ S3 request rate
   └─ NAT gateway bytes processed
```

