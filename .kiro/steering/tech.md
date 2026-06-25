# Parkly — Tech Stack & Build

## Architecture

- Microservice-oriented (each service independently deployable)
- API-first design
- Mobile-first frontend

## High-Level Flow

Mobile App → API Gateway → Auth → Services (Booking, Payment, Notification, Recommendation, Prediction) → Database → Analytics → Admin Dashboard

## Principles

- Strong typing wherever possible
- Composition over inheritance
- Configuration over hardcoding
- Every module should have tests
- Every API documented
- Feature flags for rollout control
- Readable code over clever code

## Security

- JWT authentication, OAuth
- HTTPS/TLS everywhere
- AES encryption at rest
- Role-based access control (RBAC)
- Rate limiting, WAF
- Payment tokenization (never store raw payment data)
- Audit logs on all sensitive operations

## Scalability Requirements

- Must scale from one city to multiple countries without architectural redesign
- Modular design — no city-specific hardcoding
- Business logic separated from UI and infrastructure

## Commands

> **Note:** No build system is configured yet. This section should be updated once the tech stack is chosen and project scaffolding is complete.

```
# Placeholder — update when project is initialized
# npm install / yarn install
# npm run dev
# npm run build
# npm run test
```
