# Parkly — Application Design

## High-Level Architecture

```
+-------------------------------------------------------------+
|                     CLIENT SURFACES                         |
|  Driver App (RN)   Host Dashboard (web)   Admin Portal (web)|
+-----------------------------+-------------------------------+
                              |
                       CloudFront / Amplify
                              |
                       +------v------+
                       | API Gateway |  (auth, rate limit, route)
                       +------+------+
                              |
   +----------+----------+----+-----+----------+-----------+
   |          |          |          |          |           |
+--v--+   +---v---+  +---v----+ +---v----+ +---v----+  +---v-----+
|Auth |   |Booking|  |Payment | |Search  | |Host    |  |Admin    |
+--+--+   +---+---+  +---+----+ +---+----+ +---+----+  +---+-----+
   |          |          |          |          |           |
   |      +---v----------v----------v----------v-----------v--+
   |      |              EventBridge (event bus)              |
   |      +---+-----------+-----------+-----------+-----------+
   |          |           |           |           |
   |     +----v----+ +----v-----+ +---v-----+ +---v--------+
   |     |Occupancy| |Prediction| |Pricing  | |Notification|
   |     +----+----+ +----+-----+ +----+----+ +-----+------+
   |          |           |            |            |
+--v----------v-----------v------------v------------v---------+
|  DATA: RDS(PostgreSQL)  DynamoDB   S3   Secrets Manager     |
+-------------------------------------------------------------+
|  ANALYTICS: S3 Data Lake -> Glue ETL -> Athena -> QuickSight|
+-------------------------------------------------------------+
```

## Service Responsibilities

### auth-service
- POST /auth/otp/request, POST /auth/otp/verify, POST /auth/refresh
- Issues JWT (access + refresh). RBAC claims (driver/host/admin).
- Stores users in RDS; OTP in DynamoDB (TTL).

### booking-service
- CRUD bookings; instant/scheduled/recurring.
- Slot concurrency control (optimistic locking on availability).
- Emits BookingCreated / BookingCancelled / BookingCompleted events.

### payment-service
- UPI gateway abstraction (PaymentProvider interface).
- Tokenized payment refs only. Refund + payout logic.
- Emits PaymentCompleted / RefundIssued / PayoutScheduled.

### search-service
- Geocode query, query listings within radius, apply filters.
- Calls prediction-service + recommendation-service for ranking.

### prediction-service
- Rule-based baseline + basic ML (occupancy history) → availability probability.

### recommendation-service
- Pure scoring function: weighted(distance, price, predictedAvailability).

### occupancy-service
- POST /occupancy/ingest (sensor + simulator + manual).
- Maintains current occupancy in DynamoDB; logs to S3; emits OccupancyChanged.

### pricing-service
- Pure pricing function: base * demandMultiplier(timeOfDay, dayOfWeek, occupancy).

### notification-service
- Consumes events; sends in-app (DynamoDB), push, SMS (SNS).

### host-service
- Listings CRUD, availability calendar, verification request workflow.

### admin-service
- Monitoring reads, verification approvals, metrics.

### api-gateway (app-level BFF)
- Validates JWT, applies rate limiting, routes to services, aggregates.

## Domain Model (key entities)

Users, Hosts, ParkingSpaces, Slots, Bookings, Payments, Transactions, Vehicles,
Cities, PricingRules, OccupancyLogs, Notifications, Events, Disputes, Payouts.

(Full schema in construction/functional-design and code/shared/types.)

## Cross-Cutting Concerns
- **Auth middleware** (shared): JWT validation + RBAC guard + object-ownership checks.
- **Validation** (shared): zod schemas per endpoint.
- **Logging** (shared): structured logger with correlation ID.
- **Errors** (shared): typed errors + global handler, fail-closed.
- **Config** (shared): env-based config loader, no hardcoding.
