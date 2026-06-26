# Parkly — Hackathon Pitch

### 🅿️ The Airbnb for Parking. AI-powered. Built on AWS.

*By ZEUS Technologies*

---

## 1. The Hook

> Drivers in Indian metros spend an average of **30+ minutes a day circling for parking**. Meanwhile, millions of private driveways, society slots, and commercial bays sit **empty**.

The parking exists. The demand exists. The two just never meet. **Parkly connects them.**

---

## 2. The Problem

Urban parking is broken on both sides of the market:

- **Drivers** waste fuel, time, and patience hunting for a spot — then can't pay digitally or reserve ahead. Circling for parking is a major contributor to urban congestion and emissions.
- **Hosts** (homeowners, businesses, malls) own parking that sits idle most of the day and earns them nothing.
- **Cities** have no real-time visibility into where parking demand actually is, making planning reactive instead of predictive.

There's no trusted marketplace that makes unused parking **discoverable, bookable, and monetizable** — with intelligence about *when* a spot will actually be free.

---

## 3. The Solution — Parkly

**Parkly is a two-sided smart-parking marketplace.** Any unused space becomes a listing. Any driver can find, predict, reserve, navigate to, and pay for it — in seconds.

Three things make Parkly different from "just a parking app":

1. **AI availability prediction** — we don't only show what's free *now*, we predict what will be free *when you arrive*, with a confidence score.
2. **Dynamic, demand-aware pricing** — fair prices that reflect real demand, with hosts always in control of their base rate.
3. **A real marketplace with trust built in** — manual host/property verification, role-based access, tokenized payments, and automatic host payouts.

---

## 4. Who It's For

| User | What they get |
|------|---------------|
| **Drivers** | Find, predict, book, navigate, and pay for parking digitally — no more circling. |
| **Hosts** | Turn an idle driveway or bay into passive income with a few taps. |
| **Businesses** | Monetize parking assets and reduce on-site congestion. |
| **Government** | Real-time demand heatmaps and forecasting for smarter city planning *(roadmap)*. |

---

## 5. Live Demo Flow (What We'll Show)

A complete end-to-end journey, all running locally on a laptop:

1. **Driver logs in** with phone + OTP (no passwords).
2. **Searches** for parking near a Chennai location → sees ranked results with **live occupancy** and an **AI availability prediction** (probability + confidence).
3. **Opens a space**, picks a duration → sees a **transparent, dynamically-priced** quote.
4. **Books and pays** (UPI-ready) → gets instant confirmation.
5. **Host Dashboard** lights up — new booking, revenue chart updates, live occupancy ring.
6. **Admin Portal** shows the new activity, and we approve a pending **host verification**.

> Everything is real code: 11 microservices, 3 frontends, a seeded Chennai dataset, and 40 passing tests.

---

## 6. How It Works (Architecture)

```
📱 Driver App   🖥️ Host Dashboard   🔧 Admin Portal
        │              │                  │
        └──────────────┴──────── HTTPS ───┘
                       │
                ┌──────▼──────┐
                │ API Gateway │  rate limit · JWT · routing
                └──────┬──────┘
   ┌──────┬──────┬─────┼─────┬──────┬──────┬──────┐
  Auth  Booking Pay  Search Pred  Host  Occ  Pricing  Notif  Admin
   │       │     │     │     │      │     │      │
   ▼       ▼     ▼     ▼     ▼      ▼     ▼      ▼
PostgreSQL (RDS)        DynamoDB (OTP · occupancy · notifs)
        │
        └────────────► EventBridge (async events) ──► Analytics (S3 · Glue · Athena)
```

- **11 independent microservices** (Node + TypeScript), each independently deployable.
- **Event-driven**: services emit events to **EventBridge** instead of tightly calling each other.
- **Two databases by job**: PostgreSQL for transactions, DynamoDB for high-velocity/TTL data.
- **No city-specific hardcoding** — the city is data, so we scale from Chennai to any city or country **without re-architecting**.

---

## 7. The AWS-Native Backbone

Parkly is built cloud-native and provisioned as code with **AWS CDK**:

- **RDS PostgreSQL** — encrypted, Multi-AZ transactional store
- **DynamoDB** — OTPs (auto-expiring), real-time occupancy, notifications
- **EventBridge** — the async nervous system tying services together
- **S3 + Glue + Athena + QuickSight** — data lake and analytics pipeline
- **SNS** — SMS OTP and alerts
- **Secrets Manager + KMS** — zero hardcoded credentials, encryption everywhere
- **Lambda + ECS Fargate** — serverless events + containerized services
- **Bedrock + SageMaker** — AI assistant and the upgrade path for prediction
- **CloudFront + Amplify + CloudWatch** — delivery and observability

One `cdk deploy` provisions the whole environment. One `docker compose up` runs it all locally.

---

## 8. The Intelligence

- **Prediction engine** — models demand from time-of-day and day-of-week patterns to output an availability probability, confidence, and estimated vacancies. It's a clean, transparent rule engine today with a **fixed interface that swaps directly to a trained SageMaker model** — no caller changes.
- **Dynamic pricing** — a pure function of base price × demand multiplier (peak hours, weekends, occupancy), with host opt-out.
- **Recommendation ranking** — weighted scoring across distance, price, and predicted availability.

These aren't black boxes — they're tested (including property-based tests) and explainable, which matters for a marketplace where users trust the price and the prediction.

---

## 9. Why We'll Win

- **It actually runs.** Full monorepo, 11 services, 3 apps, infrastructure-as-code, seeded data, and **40 passing tests** — not slideware.
- **Real marketplace, not a toy.** Auth + RBAC, verification, tokenized payments, refunds, and host payouts are all implemented.
- **Built to scale from day one.** Microservices + event-driven + no city hardcoding = Chennai today, national tomorrow, global after.
- **AWS-native and production-shaped.** Security baseline, encryption, least-privilege IAM, observability — the boring stuff that makes it real.
- **A clear AI upgrade path.** Rule-based now, SageMaker-ready by design.

---

## 10. Traction & Roadmap

**Phase 1 — MVP (built):** Chennai launch, manual onboarding, rule-based AI, full marketplace, web + mobile.

**Next:**
- Live Google Maps + turn-by-turn navigation
- Production UPI (Razorpay/Cashfree) + push notifications
- Trained SageMaker prediction model on real occupancy history
- IoT sensor rollout (ingestion API + simulator already built)
- **Government dashboard** — demand heatmaps, forecasting, violation tracking
- Multi-city, multi-country expansion

---

## 11. The Ask

We're looking for **pilot partners** (a city zone, a mall, or a residential community), **mentorship on go-to-market**, and **AWS credits** to run the first live cohort.

Give us one neighborhood. We'll show you a city that never circles for parking again.

---

### 🅿️ Parkly — *Find parking before you even leave.*

*ZEUS Technologies · Chennai, Tamil Nadu 🇮🇳*
