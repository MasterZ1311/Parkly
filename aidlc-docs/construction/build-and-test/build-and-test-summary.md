# Parkly — Build & Test Summary

## Build
- **Tooling**: TypeScript project per workspace; `npm run build` builds all.
- **Command**: `npm install` then `npm run build` from the repo root.
- Shared library builds first (other services depend on `@parkly/shared`).

## Unit & Property Tests (NFR-QUAL-1, NFR-QUAL-2)
Run all: `npm test`. Coverage of critical business logic:

| Suite | File | What it verifies |
|---|---|---|
| geo | `services/shared/src/geo.test.ts` | haversine correctness + symmetry property |
| pricing | `services/pricing-service/src/pricing.test.ts` | multiplier bounds, price >= base (property) |
| prediction | `services/prediction-service/src/prediction.test.ts` | probability/confidence bounds (property) |
| scoring | `services/recommendation-service/src/scoring.test.ts` | score bounds + sorted (property) |
| otp | `services/auth-service/src/otp.test.ts` | generate/verify/expiry/lockout, no raw OTP stored |
| booking | `services/booking-service/src/domain.test.ts` | overlap/conflict, recurrence, price |
| payout | `services/payment-service/src/payout.test.ts` | commission split (property), refund policy |
| occupancy | `services/occupancy-service/src/store.test.ts` | occupancy validation, history |
| search | `services/search-service/src/search.test.ts` | radius/price filter, rank order |

## Integration testing (recommended next)
- Spin up services + gateway, exercise: OTP login → create+approve listing →
  search → book → pay → cancel/refund. A Postman/newman collection or a
  supertest-based suite can automate this.

## Infrastructure validation
- `cd infrastructure && npx cdk synth` validates the CDK stacks compile to
  CloudFormation without deploying.

## Security compliance (pragmatic baseline)
See `aidlc-docs/construction/security-compliance.md` for the per-rule summary.
