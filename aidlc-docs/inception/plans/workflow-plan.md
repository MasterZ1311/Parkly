# Parkly — Workflow Plan

## Execution Mode
Single-stretch build per explicit user instruction ("Do everything in 1 go"). Approval gates are consolidated; all artifacts are produced and the project is scaffolded with runnable MVP code.

## Stages Selected

| Stage | Decision | Rationale |
|---|---|---|
| Workspace Detection | DONE | Greenfield confirmed |
| Reverse Engineering | SKIP | Greenfield, no existing code |
| Requirements Analysis | DONE | Requirements documented |
| User Stories | SKIP | Vision doc + Q&A give sufficient clarity |
| Workflow Planning | DONE (this doc) | Always required |
| Application Design | EXECUTE | New multi-service system needs component design |
| Units Generation | EXECUTE | System decomposed into deployable units |
| Functional Design (per-unit) | LIGHT | Captured inline in app design + code |
| NFR Requirements/Design | LIGHT | Captured in requirements NFR section |
| Infrastructure Design | EXECUTE | AWS CDK IaC scaffold |
| Code Generation (per-unit) | EXECUTE | Core deliverable |
| Build and Test | EXECUTE | Test scaffold + instructions |

## Units of Work

The system decomposes into the following units (each independently deployable):

1. **shared** — shared libraries (types, logging, validation, auth middleware, errors)
2. **auth-service** — phone/OTP auth, JWT, RBAC
3. **booking-service** — reservations, scheduling, recurring, concurrency
4. **payment-service** — UPI abstraction, refunds, payouts
5. **search-service** — geosearch, filters, ranking
6. **prediction-service** — rule-based + basic ML availability prediction
7. **recommendation-service** — scoring/ranking engine
8. **occupancy-service** — IoT ingestion, simulator, manual fallback, events
9. **pricing-service** — demand-based dynamic pricing
10. **notification-service** — in-app/push/SMS via SNS
11. **host-service** — listings, calendar, verification workflow
12. **admin-service** — monitoring, verification approvals
13. **api-gateway** — BFF/router + rate limiting + auth
14. **driver-app** — React Native mobile app
15. **host-dashboard** — React web app
16. **admin-portal** — React web app
17. **infrastructure** — AWS CDK (TypeScript)
18. **analytics** — Glue/Athena/QuickSight scaffold + data lake

## Build Order
shared → backend services → api-gateway → frontends → infrastructure → analytics → tests

## Text Workflow Representation
```
INCEPTION: Detection(done) -> Requirements(done) -> Planning(done) -> AppDesign -> Units
CONSTRUCTION: per-unit code generation (18 units) -> Build & Test
OPERATIONS: placeholder
```
