# Parkly — Units Generation

The system is decomposed into 18 independently buildable units. Each backend
service is its own npm workspace with its own tests and is independently deployable
(NFR-ARCH-1).

| # | Unit | Type | Key logic tested |
|---|---|---|---|
| 1 | shared | library | geo distance (unit + property) |
| 2 | auth-service | service | OTP generation/verify, lockout |
| 3 | booking-service | service | overlap/conflict, recurrence, pricing |
| 4 | payment-service | service | commission/payout, refund policy |
| 5 | search-service | service | filtering, ranking order |
| 6 | prediction-service | service | bounded prediction (property) |
| 7 | recommendation-service | service | bounded score, sort order (property) |
| 8 | occupancy-service | service | occupancy store validation |
| 9 | pricing-service | service | multiplier bounds (property) |
| 10 | notification-service | service | (scaffold) |
| 11 | host-service | service | (scaffold) |
| 12 | admin-service | service | (scaffold) |
| 13 | api-gateway | gateway | routing/proxy |
| 14 | driver-app | mobile | — |
| 15 | host-dashboard | web | — |
| 16 | admin-portal | web | — |
| 17 | infrastructure | IaC | CDK synth |
| 18 | analytics | data | Glue/Athena scaffold |

## Dependency graph
```
shared <- (all services)
host-service <- search-service (active listings)
occupancy-service -> prediction-service (history feeds prediction)
api-gateway -> all services
frontends -> api-gateway
```
