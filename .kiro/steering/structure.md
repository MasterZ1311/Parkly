# Parkly — Project Structure

## Current State

The project is in the vision/planning phase. No application code exists yet.

```
Parkly/
├── .kiro/
│   ├── aws-aidlc-rule-details/   # AI development lifecycle rule details
│   └── steering/                  # Steering files for AI assistants
│       ├── product.md             # Product summary
│       ├── tech.md                # Tech stack and build info
│       └── structure.md           # This file
├── Parkly_Project.md              # Full vision document
```

## Planned Architecture (from vision doc)

The system is expected to follow a microservices pattern with these major components:

- **Mobile App** — Driver-facing (search, book, navigate, pay)
- **API Gateway** — Central entry point, routing, rate limiting
- **Auth Service** — JWT, OAuth, RBAC
- **Booking Service** — Reservations, scheduling, availability
- **Payment Service** — UPI, cards, wallet, refunds, payouts
- **Notification Service** — Push, SMS, email
- **Recommendation Engine** — Smart suggestions
- **Prediction Engine** — AI availability forecasting
- **Analytics Service** — Metrics, dashboards, reporting
- **Admin/Host/Government Dashboards** — Web frontends

## Conventions (to be followed once code is created)

- Keep domain models separate from infrastructure
- Separate business logic from UI layer
- Prefer reusable components
- No city-specific hardcoding in business logic
- Use feature flags for progressive rollout
- All services should expose health/metrics endpoints
- Every service gets its own directory at the top level or within a `services/` folder
