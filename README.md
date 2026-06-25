# 🅿️ Parkly — Smart City Parking Marketplace

> AI-powered, real-time parking discovery and booking platform for Indian cities. Built with AWS, TypeScript, React Native, and microservices architecture.

---

## 🏗️ Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                        Clients                               │
│   📱 Mobile App (Expo RN)  🖥️ Host Dashboard  🔧 Admin Portal │
└──────────────┬──────────────────────────────────────────────┘
               │ HTTPS
┌──────────────▼──────────────────────────────────────────────┐
│            API Gateway (:4000)                               │
│   Rate Limiting · Auth Header Forwarding · Reverse Proxy     │
└──┬───┬───┬───┬───┬───┬───┬───┬───┬───┬─────────────────────┘
   │   │   │   │   │   │   │   │   │   │
   ▼   ▼   ▼   ▼   ▼   ▼   ▼   ▼   ▼   ▼
  Auth Book Pay Srch Pred Host Occ  Prc  Notif Admin
 :4001 :4002 :4003 :4004 :4005 :4010 :4007 :4008 :4009 :4011
   │                               │
   ▼                               ▼
PostgreSQL (RDS)          DynamoDB (OTP/Occupancy/Notifs)

All services → EventBridge (async events)
```

## 📁 Project Structure

```
parkly/
├── apps/
│   ├── mobile/              # Expo React Native app
│   ├── host-dashboard/      # Vite + React (port 3001)
│   └── admin-portal/        # Vite + React (port 3002)
├── services/
│   ├── api-gateway/         # Central API gateway (:4000)
│   ├── auth-service/        # OTP + JWT auth (:4001)
│   ├── booking-service/     # Booking CRUD + concurrency (:4002)
│   ├── payment-service/     # Payment initiation + webhooks (:4003)
│   ├── search-service/      # Geospatial search + ranking (:4004)
│   ├── prediction-service/  # ML occupancy prediction (:4005)
│   ├── occupancy-service/   # Real-time occupancy ingestion (:4007)
│   ├── pricing-service/     # Dynamic pricing engine (:4008)
│   ├── notification-service/# Push/SMS/In-app notifications (:4009)
│   ├── host-service/        # Host onboarding + space mgmt (:4010)
│   └── admin-service/       # Platform admin operations (:4011)
├── shared/                  # @parkly/shared — types, middleware, AWS clients
├── infra/
│   ├── prisma/              # Database schema + migrations + seed
│   └── cdk/                 # AWS CDK infrastructure (IaC)
├── docker-compose.yml       # Local dev environment
└── package.json             # npm workspace root
```

## 🚀 Quick Start (Local Development)

### Prerequisites
- Node.js 20+
- npm 10+
- Docker Desktop

### 1. Clone & Install
```bash
git clone https://github.com/your-org/parkly.git
cd parkly
cp .env.example .env
# Fill in .env values (see Configuration section)
npm install
```

### 2. Start Infrastructure
```bash
npm run dev:infra
# Starts: PostgreSQL, DynamoDB Local
```

### 3. Run Migrations & Seed
```bash
npm run migrate     # Run Prisma migrations
npm run seed        # Seed Chennai data
```

### 4. Start Services
```bash
# Start core backend services
npm run dev:core    # API Gateway + Auth + Booking + Search

# Or start everything
npm run dev         # All 11 microservices
```

### 5. Start Web Apps
```bash
npm run dev:host-dashboard    # http://localhost:3001
npm run dev:admin-portal      # http://localhost:3002
```

### 6. Start Mobile App
```bash
cd apps/mobile
npx expo start
# Scan QR with Expo Go app
```

## 🔑 Key Endpoints

| Service | Base URL | Key Routes |
|---------|----------|-----------|
| Auth | `POST /api/v1/auth/otp/request` | Request OTP |
| Auth | `POST /api/v1/auth/otp/verify` | Verify OTP + get JWT |
| Search | `POST /api/v1/search` | Search nearby spaces |
| Booking | `POST /api/v1/bookings` | Create booking |
| Booking | `GET /api/v1/bookings` | List user bookings |
| Payment | `POST /api/v1/payments/initiate` | Start payment |
| Occupancy | `GET /api/v1/occupancy/:spaceId` | Live occupancy |
| Host | `POST /api/v1/host/spaces` | Create space |
| Admin | `GET /api/v1/admin/stats` | Platform stats |

## ☁️ AWS Infrastructure

```bash
# Deploy to AWS (dev)
cd infra/cdk
npm install
npm run deploy:dev

# Deploy to production
npm run deploy:prod
```

### AWS Services Used
| Service | Purpose |
|---------|---------|
| RDS PostgreSQL | Transactional data (users, bookings, spaces, payments) |
| DynamoDB | OTP records, real-time occupancy, notifications |
| S3 | Space photo uploads, data lake |
| EventBridge | Async service communication |
| SNS | OTP SMS delivery |
| CloudWatch | Logging & monitoring |
| Secrets Manager | Database credentials (production) |

## 🐳 Docker

```bash
# Full stack locally
npm run docker:up    # docker compose up -d
npm run docker:logs  # docker compose logs -f
npm run docker:down  # docker compose down
```

## 🧪 Testing

```bash
npm test             # Run all tests
npm test -w shared   # Test shared package only
```

## 📱 Mobile App Features

- ✅ Phone + OTP authentication
- ✅ Search parking by area/location
- ✅ Map view with live markers
- ✅ Space details with amenities + duration selector
- ✅ Booking flow with vehicle input
- ✅ Payment integration (UPI-ready)
- ✅ Booking history (upcoming/past)
- ✅ User profile + role-based menus

## 🌐 Web Apps

**Host Dashboard** (port 3001)
- Revenue charts (monthly earnings breakdown)
- Live occupancy ring charts per listing
- Booking management table
- Add new space modal

**Admin Portal** (port 3002)
- Platform-wide stats + area chart
- Host verification workflow (expand/approve/reject)
- User management with suspend actions
- Platform-wide bookings view

## ⚙️ Configuration

See `.env.example` for all available configuration options. Key variables:

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string |
| `JWT_ACCESS_SECRET` | JWT signing secret (min 32 chars) |
| `AWS_ACCESS_KEY_ID` | AWS credentials |
| `PAYMENT_PROVIDER` | `mock` \| `razorpay` \| `cashfree` |
| `SMS_PROVIDER` | `mock` \| `sns` \| `twilio` |

## 🔒 Security

- Phone-based auth (no passwords)
- JWT with 15-minute access tokens + 30-day refresh tokens
- All secrets via environment variables (Secrets Manager in prod)
- Row-level ownership checks on all user data
- Request rate limiting on API gateway
- Security headers (CSP, X-Frame-Options, etc.)

## 📍 MVP Scope (Chennai Launch)

- [x] OTP Authentication
- [x] Space discovery + geospatial search
- [x] Real-time occupancy tracking  
- [x] Demand-based dynamic pricing
- [x] Booking management (instant/scheduled)
- [x] Payment integration (mock → Razorpay)
- [x] Host dashboard + earnings
- [x] Admin portal + verifications
- [ ] Push notifications (FCM — integration ready)
- [ ] Google Maps live integration (key required)
- [ ] Production Razorpay/Cashfree UPI integration

---

**Built by ZEUS Technologies** · Chennai, Tamil Nadu 🇮🇳
