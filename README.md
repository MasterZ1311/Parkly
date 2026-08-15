# Parkly — Smart City Parking Marketplace

AI-powered, real-time parking discovery and booking platform for Indian cities. Built with AWS, TypeScript, React Native, and a microservices architecture.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                         Clients                             │
│  Mobile App (Expo RN)   Host Dashboard   Admin Portal       │
└──────────────┬──────────────────────────────────────────────┘
               │ HTTPS
┌──────────────▼──────────────────────────────────────────────┐
│            API Gateway (:4000)                              │
│  Rate limiting · Auth header forwarding · Reverse proxy     │
└──┬───┬───┬───┬───┬───┬───┬───┬───┬───┬─────────────────────┘
   │   │   │   │   │   │   │   │   │   │
   ▼   ▼   ▼   ▼   ▼   ▼   ▼   ▼   ▼   ▼
  Auth Book Pay Srch Pred Host Occ Prc Notif Admin
 :4001 :4002 :4003 :4004 :4005 :4010 :4007 :4008 :4009 :4011
   │                               │
   ▼                               ▼
PostgreSQL (RDS)          DynamoDB (OTP/Occupancy/Notifications)

All services → EventBridge (async events)
```

## Project Structure

```
parkly/
├── apps/
│   ├── mobile/              # Expo React Native application
│   ├── host-dashboard/      # Vite + React (port 3001)
│   └── admin-portal/        # Vite + React (port 3002)
├── services/
│   ├── api-gateway/         # Central API gateway (:4000)
│   ├── auth-service/        # OTP + JWT authentication (:4001)
│   ├── booking-service/     # Booking management and concurrency (:4002)
│   ├── payment-service/     # Payment initiation and webhooks (:4003)
│   ├── search-service/      # Geospatial search and ranking (:4004)
│   ├── prediction-service/  # ML-based occupancy prediction (:4005)
│   ├── occupancy-service/   # Real-time occupancy ingestion (:4007)
│   ├── pricing-service/     # Dynamic pricing engine (:4008)
│   ├── notification-service/# Push/SMS/In-app notifications (:4009)
│   ├── host-service/        # Host onboarding and space management (:4010)
│   └── admin-service/       # Platform administration operations (:4011)
├── shared/                  # @parkly/shared — types, middleware, AWS clients
├── infra/
│   ├── prisma/              # Database schema, migrations, and seeds
│   └── cdk/                 # AWS CDK infrastructure (IaC)
├── docker-compose.yml       # Local development environment
└── package.json             # npm workspace root
```

## Quick Start (Local Development)

Prerequisites
- Node.js 20 or later
- npm 10 or later
- Docker Desktop

1. Clone and install

```bash
git clone https://github.com/MasterZ1311/Parkly.git
cd Parkly
cp .env.example .env
# Update .env values (see Configuration section)
npm install
```

2. Start infrastructure

```bash
npm run dev:infra
# Starts: PostgreSQL, DynamoDB Local
```

3. Run migrations and seed data

```bash
npm run migrate     # Run Prisma migrations
npm run seed        # Seed example data
```

4. Start services

```bash
# Start core backend services
npm run dev:core    # API Gateway + Auth + Booking + Search

# Or start all services
npm run dev         # All microservices
```

5. Start web applications

```bash
npm run dev:host-dashboard    # http://localhost:3001
npm run dev:admin-portal      # http://localhost:3002
```

6. Start mobile application

```bash
cd apps/mobile
npx expo start
# Scan QR with Expo Go or run on simulator
```

## Key Endpoints

| Service   | Base URL                      | Routes / Purpose                                |
|-----------|-------------------------------|-------------------------------------------------|
| Auth      | `POST /api/v1/auth/otp/request` | Request OTP                                     |
| Auth      | `POST /api/v1/auth/otp/verify`  | Verify OTP and obtain JWT                       |
| Search    | `POST /api/v1/search`         | Search nearby spaces                            |
| Booking   | `POST /api/v1/bookings`       | Create booking                                  |
| Booking   | `GET /api/v1/bookings`        | List user bookings                              |
| Payment   | `POST /api/v1/payments/initiate` | Initiate payment                                |
| Occupancy | `GET /api/v1/occupancy/:spaceId` | Live occupancy for a space                      |
| Host      | `POST /api/v1/host/spaces`    | Create a new space                              |
| Admin     | `GET /api/v1/admin/stats`     | Platform statistics                             |

## AWS Infrastructure

```bash
# Deploy to AWS (development)
cd infra/cdk
npm install
npm run deploy:dev

# Deploy to production
npm run deploy:prod
```

### AWS Services Used

| Service         | Purpose                                                       |
|-----------------|---------------------------------------------------------------|
| RDS PostgreSQL  | Transactional data (users, bookings, spaces, payments)        |
| DynamoDB        | OTP records, real-time occupancy, notifications               |
| S3              | Space photo uploads and data lake                             |
| EventBridge     | Asynchronous service communication                            |
| SNS             | OTP SMS delivery                                              |
| CloudWatch      | Logging and monitoring                                        |
| Secrets Manager | Secure storage for production credentials                     |

## Docker

```bash
# Full stack locally
npm run docker:up    # docker compose up -d
npm run docker:logs  # docker compose logs -f
npm run docker:down  # docker compose down
```

## Testing

```bash
npm test             # Run all tests
npm test -w shared   # Test shared package only
```

## Mobile Application Features

- Phone-based OTP authentication
- Search for parking by area or location
- Map view with live markers
- Space details with amenities and duration selector
- Booking flow with vehicle input
- Payment integration (UPI-ready)
- Booking history (upcoming and past)
- User profile and role-based menus

## Web Applications

Host Dashboard (port 3001)
- Revenue charts and monthly earnings breakdown
- Live occupancy charts per listing
- Booking management table
- Add new space modal

Admin Portal (port 3002)
- Platform-wide statistics and reports
- Host verification workflow (approve/reject)
- User management with suspend actions
- Platform-wide bookings view

## Configuration

See `.env.example` for all available configuration options. Key variables:

| Variable             | Description                                              |
|----------------------|----------------------------------------------------------|
| `DATABASE_URL`       | PostgreSQL connection string                             |
| `JWT_ACCESS_SECRET`  | JWT signing secret (minimum 32 characters)               |
| `AWS_ACCESS_KEY_ID`  | AWS credentials                                           |
| `PAYMENT_PROVIDER`   | `mock` | `razorpay` | `cashfree`                           |
| `SMS_PROVIDER`       | `mock` | `sns` | `twilio`                               |

## Security

- Phone-based authentication (passwordless)
- JWT access tokens (15-minute expiry) and refresh tokens (30-day expiry)
- Secrets stored in environment variables for development and in Secrets Manager for production
- Row-level ownership checks for user data
- API gateway rate limiting
- Security headers (CSP, X-Frame-Options, etc.)

## MVP Scope (Chennai Launch)

Completed
- OTP authentication
- Space discovery and geospatial search
- Real-time occupancy tracking
- Demand-based dynamic pricing
- Booking management (instant and scheduled)
- Payment integration (mock → Razorpay)
- Host dashboard and earnings reporting
- Admin portal and verification workflows

Planned
- Push notifications (FCM integration)
- Google Maps live integration (API key required)
- Production UPI integrations (Razorpay/Cashfree)

---

Built by ZEUS Technologies · Chennai, Tamil Nadu
