# 🅿️ Parkly — Test Infrastructure & 4-Tier E2E Testing Specification

> **Document Version**: 1.0.0  
> **Status**: Approved E2E Test Infrastructure  
> **Scope**: Autonomous Multi-Agent Framework (`packages/ai-agents`)  
> **Testing Approach**: Requirement-Driven, Opaque-Box, Zero-Network Deterministic  

---

## 1. Architectural Philosophy & Testing Strategy

The Parkly Autonomous Multi-Agent System orchestrates critical real-time parking operations across Chennai: host onboarding, multimodal space auditing, predictive occupancy matching, micro-zone dynamic pricing, conversational driver concierge, and autonomous dispute arbitration.

To guarantee industrial resilience, the test infrastructure enforces a **4-tier requirement-driven, opaque-box testing pyramid**:

1. **Opaque-Box Verification**: Tests interact strictly through public TypeScript contracts and exports (`packages/ai-agents/src/index.ts`). Private class internals, internal variables, or unpublished methods are NEVER touched.
2. **Zero-Network Determinism**: 100% of automated tests pass without internet access, external API keys, or live AWS infrastructure. All 13 external tools are interfaced via strictly typed mock providers with deterministic Chennai fixtures.
3. **Property & Invariant Enforcement**: Critical safety constraints (such as dynamic price clamping, low-confidence KYC escalation, gate clearance limits, and dispute compensation freezes) are mathematically bounded and verified against adversarial edges.
4. **End-to-End Choreography**: Validates asynchronous event delivery via AWS EventBridge envelope standards, multi-agent sagas with LIFO rollbacks, and distributed circuit breakers.

---

## 2. Directory Layout & Test Organization

```
packages/ai-agents/
├── src/
│   ├── index.ts                           # Unified package exports tested by E2E suites
│   ├── core/                              # BaseAgent, Result, ExecutionContext, CircuitBreaker
│   ├── bus/                               # InMemoryEventBus, EventBridge envelope, Catalog
│   ├── saga/                              # SagaOrchestrator, ISagaStateStore, 3 Workflows
│   ├── agents/                            # 7 Domain Agents + Central Orchestrator
│   └── tools/                             # 13 Interfaces, Geohash utility, Mock Providers
└── tests/
    └── e2e/
        ├── helpers/
        │   └── e2e-harness.ts             # Test container, event collectors, mock factories
        ├── tier1-features.e2e.spec.ts     # Tier 1: Feature Coverage (65 tests, 5 per feature)
        ├── tier2-boundary.e2e.spec.ts     # Tier 2: Boundary & Corner Cases (65 tests)
        ├── tier3-pairwise.e2e.spec.ts     # Tier 3: Cross-Feature Interactions (15 tests)
        └── tier4-scenarios.e2e.spec.ts    # Tier 4: Chennai Mobility Scenarios (8 scenarios)
```

---

## 3. Comprehensive 4-Tier E2E Test Matrix

| # | Feature Under Test | Public Contract / Target | Tier 1 (Coverage) | Tier 2 (Boundary) | Tier 3 (Pairwise) | Tier 4 (Scenario) | Total Tests |
|---|-------------------|--------------------------|:-----------------:|:-----------------:|:-----------------:|:-----------------:|:-----------:|
| 1 | `HostOnboardingAgent` | `HostOnboardingAgent` | 5 | 5 | Pairwise #2, #8, #10 | Scenario #7 | 13 |
| 2 | `VisualInspectionAgent` | `VisualInspectionAgent` | 5 | 5 | Pairwise #2, #6, #7 | Scenario #1, #6 | 13 |
| 3 | `OccupancyPredictorAgent` | `OccupancyPredictorAgent` | 5 | 5 | Pairwise #3, #9 | Scenario #1, #2 | 12 |
| 4 | `DynamicPricingAgent` | `DynamicPricingAgent` | 5 | 5 | Pairwise #1, #3 | Scenario #1, #2 | 12 |
| 5 | `DriverConciergeAgent` | `DriverConciergeAgent` | 5 | 5 | Pairwise #4, #11 | Scenario #1, #6 | 12 |
| 6 | `DisputeMediationAgent` | `DisputeMediationAgent` | 5 | 5 | Pairwise #5, #12 | Scenario #4, #5 | 12 |
| 7 | `CityAnalyticsAgent` | `CityAnalyticsAgent` | 5 | 5 | Pairwise #13 | Scenario #8 | 11 |
| 8 | `ParklyOrchestratorAgent` | `ParklyOrchestratorAgent`| 5 | 5 | Pairwise #6, #14 | Scenario #1 to #8 | 18 |
| 9 | Host Onboarding Saga | `HostOnboardingSaga` | 5 | 5 | Pairwise #2, #10 | Scenario #7 | 13 |
| 10 | Booking Hold Saga | `BookingHoldSaga` | 5 | 5 | Pairwise #4, #15 | Scenario #1, #2, #3 | 14 |
| 11 | Dispute Resolution Saga | `DisputeResolutionSaga` | 5 | 5 | Pairwise #5, #12 | Scenario #4, #5 | 13 |
| 12 | Distributed Circuit Breaker | `CircuitBreaker` | 5 | 5 | Pairwise #7, #8 | Scenario #7 | 12 |
| 13 | `InMemoryEventBus` & Events | `InMemoryEventBus` | 5 | 5 | Pairwise #14, #15 | Scenario #1 to #8 | 18 |
| **Total** | **All 13 Features** | **Unified Public API** | **65** | **65** | **15** | **8** | **153 Tests** |

---

## 4. Test Harness Architecture (`E2ETestHarness`)

The `E2ETestHarness` (`tests/e2e/helpers/e2e-harness.ts`) provides an isolated runtime container:

```typescript
export class E2ETestHarness {
  readonly eventBus: InMemoryEventBus;
  readonly sagaStore: InMemorySagaStore;
  readonly orchestrator: ParklyOrchestratorAgent;
  readonly tools: MockToolContainer;
  readonly publishedEvents: EventBridgeEvent<unknown>[] = [];

  static async create(options?: TestHarnessOptions): Promise<E2ETestHarness>;
  
  createContext(overrides?: Partial<ExecutionContext>): ExecutionContext;
  getPublishedEvents(detailType?: string): EventBridgeEvent<unknown>[];
  clearEvents(): void;
  resetMocks(): void;
}
```

### Deterministic Test Fixtures
- **Chennai Geospatial Coordinates**:
  - T. Nagar (Usman Rd / Burkit Rd): `13.0382, 80.2314`, Geohash `tf34b8c`
  - Anna Nagar (Tower Metro): `13.0827, 80.2107`, Geohash `tf34d4g`
  - OMR Phase 1 (Tidel Park / Sholinganallur): `12.9716, 80.2464`, Geohash `tf3429y`
- **Mock KYC Documents**:
  - Valid PAN: `ABCDE1234F` with confidence 0.96
  - Low-confidence PAN: `A3C0E1234?` with confidence 0.72
  - GCC Property Tax Deed: `CORP-CHN-2024-88192`
- **Mock Photos**:
  - Adequate clearance: Gate height 2.8m, width 3.2m, covered, CCTV visible
  - Inadequate clearance: Gate height 2.10m, debris present
  - Redaction test: 2 license plates (`TN01AB1234`, `TN09CD5678`), 1 human face
- **Mock IoT Sensor Telematics**:
  - Ultrasonic sensor departure timestamp matching or contradicting host reports

---

## 5. Detailed Test Specifications

### 5.1 Tier 1: Feature Coverage Test Suite (`tier1-features.e2e.spec.ts`)
*Minimum 5 tests per feature covering representative happy paths (65 tests total).*

#### Feature 1: `HostOnboardingAgent`
- **T1.1.1**: Onboard residential property on Burkit Road, T. Nagar. Asserts `kycStatus === 'VERIFIED_AUTO'`, confidence >= 0.85, Geohash precision 7 (`tf34b8c`), and `zoningCompliance === 'RESIDENTIAL_PERMITTED'`.
- **T1.1.2**: Onboard multi-slot commercial parking on 2nd Avenue, Anna Nagar. Asserts `VERIFIED_AUTO` and `COMMERCIAL_PERMITTED`.
- **T1.1.3**: Onboard mixed-use property near Sholinganallur, OMR. Asserts `VERIFIED_AUTO` and `MIXED_USE_PERMITTED`.
- **T1.1.4**: Onboard single two-wheeler parking space in Mylapore. Asserts declared slots = 1, vehicleType = motorcycle.
- **T1.1.5**: Onboard 10-slot SUV/van parking facility in Velachery. Asserts total capacity = 10, valid Geohash P7.

#### Feature 2: `VisualInspectionAgent`
- **T1.2.1**: Audit covered, CCTV-equipped concrete parking bay in T. Nagar. Asserts `inspectionResult === 'APPROVED'`, `isCovered === true`, `gateClearanceAdequate === true`.
- **T1.2.2**: Audit outdoor asphalt parking lot in Anna Nagar. Asserts `APPROVED`, `isCovered === false`, surfaceType = asphalt.
- **T1.2.3**: Audit EV charging enabled space in OMR. Asserts `APPROVED`, `evChargerDetected === true`.
- **T1.2.4**: Privacy redaction on space with parked vehicle. Asserts `privacyActions.licensePlatesBlurred >= 1`.
- **T1.2.5**: Privacy redaction on space with security guard visible. Asserts `privacyActions.facesBlurred >= 1`.

#### Feature 3: `OccupancyPredictorAgent`
- **T1.3.1**: Weekday morning commute prediction in Anna Nagar. Asserts `demandTier === 'PEAK_COMMUTE'`, `arrivalProbability` in 70–90%, confidence >= 0.80.
- **T1.3.2**: Weekend shopping rush prediction in T. Nagar. Asserts `demandTier === 'PEAK_SHOPPING'`, `arrivalProbability` in 35–65%.
- **T1.3.3**: Off-peak late night prediction in OMR. Asserts `demandTier === 'LOW_DEMAND'`, `arrivalProbability` > 90%.
- **T1.3.4**: Rainy weather forecast context. Asserts contextual factors list weather warning.
- **T1.3.5**: High capacity commercial space (15 slots). Asserts `estimatedAvailableSlots >= 3`.

#### Feature 4: `DynamicPricingAgent`
- **T1.4.1**: Midday normal demand in Anna Nagar. Asserts calculated rate equals base rate (multiplier 1.0).
- **T1.4.2**: Commute surge in OMR with 75% occupancy. Asserts multiplier in 1.1–1.3x.
- **T1.4.3**: Festive surge in T. Nagar with 95% occupancy. Asserts multiplier in 1.4–1.8x.
- **T1.4.4**: Fixed price space with `allowDynamic === false`. Asserts calculated rate strictly equals base rate.
- **T1.4.5**: Low occupancy night rate. Asserts calculated rate does not fall below base rate.

#### Feature 5: `DriverConciergeAgent`
- **T1.5.1**: Natural language query near Pothys ("Find covered parking under 60/hr for 2h"). Asserts `action === 'PRESENT_RECOMMENDATION'`, valid deep link.
- **T1.5.2**: EV query in OMR ("Need EV charging spot near Tidel Park"). Asserts recommended space has EV charging.
- **T1.5.3**: Ambiguous query ("Parking"). Asserts `action === 'CLARIFICATION_NEEDED'`.
- **T1.5.4**: Unmatchable price query ("Find parking in T. Nagar for 5/hr"). Asserts `action === 'NO_SPACES_FOUND'`.
- **T1.5.5**: Turn-by-turn routing request. Asserts Google Maps deep link generated with correct destination coordinates.

#### Feature 6: `DisputeMediationAgent`
- **T1.6.1**: Verified overstay in T. Nagar (90 min). Asserts `adjudication === 'OVERSTAY_CONFIRMED'`, penalty = ₹120, host compensation = ₹100.
- **T1.6.2**: False overstay report (sensor confirms departure before end time). Asserts `adjudication === 'DISPUTE_DISMISSED'`.
- **T1.6.3**: Driver reports blocked driveway upon arrival. Asserts `adjudication === 'REFUND_ISSUED'`.
- **T1.6.4**: Unauthorized vehicle reported. Asserts adjudication confirms violation and logs vehicle plate.
- **T1.6.5**: Overstay within 5-minute grace period. Asserts `adjudication === 'DISPUTE_DISMISSED'` with grace notice.

#### Feature 7: `CityAnalyticsAgent`
- **T1.7.1**: Standard weekly report for Chennai ("2026-W36", 3 zones). Asserts off-street hours > 0, cruising minutes reduced > 0.
- **T1.7.2**: Mathematical CO2 verification. Asserts `estimatedCO2AbatedKg === cruisingMinutes * 0.0229`.
- **T1.7.3**: Single-zone report for T. Nagar. Asserts zone choke points correctly identified.
- **T1.7.4**: OMR IT corridor macro metrics. Asserts off-street hours computed accurately.
- **T1.7.5**: Structured report format. Asserts GeoJSON output compatible with mapping tools.

#### Feature 8: `ParklyOrchestratorAgent`
- **T1.8.1**: Event routing: Dispatches `Host.Submitted` to `HostOnboardingAgent` and preserves correlationId.
- **T1.8.2**: Execution budget: Step completes within 5,000ms budget.
- **T1.8.3**: ExecutionContext propagation: Sub-agent receives matching correlationId and fresh traceId.
- **T1.8.4**: DLQ routing on fatal worker error: Original payload preserved in dead-letter queue.
- **T1.8.5**: Concurrent event handling: Handles multiple simultaneous events without state cross-contamination.

#### Feature 9: Host Onboarding Saga
- **T1.9.1**: Full forward saga: KYC -> Geocode -> Zoning -> Inspection -> Listing Activated.
- **T1.9.2**: Listing status transitions from `draft` to `active`.
- **T1.9.3**: State store records all step transitions (`PENDING` -> `STEP_COMPLETED` -> `COMPLETED`).
- **T1.9.4**: Re-entrant execution with identical correlationId returns existing result.
- **T1.9.5**: SMS notification emitted upon activation.

#### Feature 10: Booking Hold Saga
- **T1.10.1**: Full forward saga: Search -> Vacancy -> Pricing -> 10m Hold -> QR Generation.
- **T1.10.2**: Booking status set to `created` with `holdExpiresAt` 10 minutes in future.
- **T1.10.3**: Digital entry QR code payload verified.
- **T1.10.4**: Payment intent token generated.
- **T1.10.5**: Slot locked atomically against concurrent booking.

#### Feature 11: Dispute Resolution Saga
- **T1.11.1**: Full forward saga: Dispute.Raised -> Sensor audit -> Adjudication -> Ledger -> SMS.
- **T1.11.2**: Ledger debits driver account and credits host account.
- **T1.11.3**: Platform audit log recorded in state store.
- **T1.11.4**: Dismissed dispute saga releases escrow hold cleanly.
- **T1.11.5**: SMS alert sent to driver and host.

#### Feature 12: Distributed Circuit Breaker
- **T1.12.1**: Normal execution in `CLOSED` state passes through.
- **T1.12.2**: Single transient failure keeps circuit in `CLOSED` state.
- **T1.12.3**: 3 consecutive failures trip circuit to `OPEN` state.
- **T1.12.4**: In `OPEN` state, fallback function executed immediately.
- **T1.12.5**: After reset timeout, probe in `HALF_OPEN` succeeds and transitions back to `CLOSED`.

#### Feature 13: `InMemoryEventBus` & Events
- **T1.13.1**: Publish event triggers subscribed handler.
- **T1.13.2**: Fan-out: 3 subscribers receive same event concurrently via `Promise.allSettled`.
- **T1.13.3**: Unsubscribe callback prevents future handler invocation.
- **T1.13.4**: EventBridge envelope contains `source: "parkly.ai"`, `time`, `id`, `detail-type`.
- **T1.13.5**: Subscriber failure captured in DLQ without impacting other subscribers.

---

### 5.2 Tier 2: Boundary & Corner Cases Test Suite (`tier2-boundary.e2e.spec.ts`)
*Minimum 5 tests per feature covering boundary limits, mathematical invariants, and error modes (65 tests total).*

- **T2.1 (HostOnboardingAgent)**:
  - T2.1.1: OCR confidence = 0.849 (< 0.85) -> flags `MANUAL_REVIEW_REQUIRED`.
  - T2.1.2: Zoning classified as `NON_RESIDENTIAL_PROHIBITED` -> flags `MANUAL_REVIEW_REQUIRED`.
  - T2.1.3: Empty document URLs `[]` -> returns `Result.err(VALIDATION_ERROR)`.
  - T2.1.4: Latitude 91.0 / Longitude 185.0 -> returns `Result.err(VALIDATION_ERROR)`.
  - T2.1.5: Declared slots = 0 or -1 -> returns `Result.err(VALIDATION_ERROR)`.

- **T2.2 (VisualInspectionAgent)**:
  - T2.2.1: Gate clearance = 2.19m (< 2.2m) -> returns `ACTION_REQUIRED`.
  - T2.2.2: Debris/obstruction blocking entrance -> returns `ACTION_REQUIRED`.
  - T2.2.3: Empty photos array `[]` -> returns `Result.err(VALIDATION_ERROR)`.
  - T2.2.4: 10 license plates and 5 faces detected -> exact counts reported in `privacyActions`.
  - T2.2.5: Severe flooding / sinkhole -> returns `REJECTED`.

- **T2.3 (OccupancyPredictorAgent)**:
  - T2.3.1: ML latency = 165ms (> 150ms) -> immediately activates heuristic fallback `(1/demandMultiplier)`.
  - T2.3.2: Target arrival time in past -> returns `Result.err(VALIDATION_ERROR)`.
  - T2.3.3: Duration = 0 minutes -> returns `Result.err(VALIDATION_ERROR)`.
  - T2.3.4: 100% full slot historical state -> probability clamped to minimum 5.0%.
  - T2.3.5: Coordinates far outside Chennai -> returns prediction with confidence < 0.5.

- **T2.4 (DynamicPricingAgent)**:
  - T2.4.1: Demand collapse (calculated price < base rate) -> strictly clamped to `baseHourlyRate`.
  - T2.4.2: Extreme demand surge (calculated price > maxMultiplier * base) -> strictly clamped to `maxMultiplier * baseHourlyRate`.
  - T2.4.3: Base hourly rate <= 0 -> returns `Result.err(VALIDATION_ERROR)`.
  - T2.4.4: Max multiplier < 1.0 (e.g. 0.8) -> returns `Result.err(VALIDATION_ERROR)`.
  - T2.4.5: Occupancy rate boundaries (0.0 and 1.0) -> smooth computation without division-by-zero.

- **T2.5 (DriverConciergeAgent)**:
  - T2.5.1: Blocked gate at arrival -> triggers emergency relocation <= 200m at ₹0 driver surcharge.
  - T2.5.2: Whitespace-only query string -> returns `action: CLARIFICATION_NEEDED`.
  - T2.5.3: Unrealistic budget (₹1/hr) -> returns `action: NO_SPACES_FOUND`.
  - T2.5.4: Missing driver coordinates -> returns `Result.err(VALIDATION_ERROR)`.
  - T2.5.5: Zero backup bays within 200m -> gracefully escalates to driver support.

- **T2.6 (DisputeMediationAgent)**:
  - T2.6.1: Disputed compensation = ₹1,200 (> ₹1,000) -> freezes payout; sets `adjudication: ESCALATED_MANUAL`.
  - T2.6.2: Disputed compensation = ₹1,000.00 -> auto-approved; ₹1,000.01 -> frozen.
  - T2.6.3: Sensor proves driver departed early -> sets `adjudication: DISPUTE_DISMISSED`.
  - T2.6.4: Overstay within 10-min grace period -> sets `DISPUTE_DISMISSED` with ₹0 penalty.
  - T2.6.5: Corrupted booking ID -> returns `Result.err(VALIDATION_ERROR)`.

- **T2.7 (CityAnalyticsAgent)**:
  - T2.7.1: Malformed ISO week ("2026-36") -> returns `Result.err(VALIDATION_ERROR)`.
  - T2.7.2: Empty zones array `[]` -> returns `Result.err(VALIDATION_ERROR)`.
  - T2.7.3: Zero cruising minutes -> CO2 abated is exactly 0.0 kg.
  - T2.7.4: 10,000,000 cruising minutes -> formula computes without floating overflow.
  - T2.7.5: Unknown city ID -> returns `VALIDATION_ERROR`.

- **T2.8 (ParklyOrchestratorAgent)**:
  - T2.8.1: Worker execution > 5000ms -> orchestrator aborts with `TIMEOUT_ERROR`.
  - T2.8.2: Worker fatal unhandled exception -> trapped and converted to `INTERNAL_ERROR` in DLQ.
  - T2.8.3: Circular event storm -> terminates cascade at max hops limit.
  - T2.8.4: Poison-pill malformed JSON envelope -> routed to DLQ without crashing bus.
  - T2.8.5: Context propagation across 4 nested sub-agent hops preserves root correlationId.

- **T2.9 (Host Onboarding Saga)**:
  - T2.9.1: Visual inspection REJECTED -> LIFO compensation deactivates space, marks saga `COMPENSATED`.
  - T2.9.2: Geocoding failure -> saga halts before visual inspection, cleans up draft.
  - T2.9.3: OCR failure -> flags `MANUAL_REVIEW_REQUIRED`, pauses forward progress.
  - T2.9.4: Duplicate `Host.Submitted` event -> idempotent response.
  - T2.9.5: State store persistence failure -> enters safe `FAILED` state.

- **T2.10 (Booking Hold Saga)**:
  - T2.10.1: Concurrent holds for last slot -> one succeeds, second gets concurrency conflict (409).
  - T2.10.2: 10-minute hold expires -> automated compensation releases slot lock.
  - T2.10.3: Payment webhook failure -> cancels booking and unlocks slot immediately.
  - T2.10.4: Duration <= 0 requested -> rejected before lock acquisition.
  - T2.10.5: Gateway outage -> hold expires cleanly, preventing ghost lock.

- **T2.11 (Dispute Resolution Saga)**:
  - T2.11.1: Compensation > ₹1,000 -> freezes ledger transfer, holds funds, marks `ESCALATED_MANUAL`.
  - T2.11.2: Sensor telemetry unavailable -> escalates to human operator.
  - T2.11.3: Ledger debit failure -> retries without double-charging.
  - T2.11.4: Dual counter-dispute -> consolidated under single booking saga.
  - T2.11.5: Dispute raised > 72 hours post-booking -> rejected by policy.

- **T2.12 (Distributed Circuit Breaker)**:
  - T2.12.1: 2 failures followed by 1 success -> failure count resets to 0.
  - T2.12.2: 3 failures -> transitions to `OPEN`.
  - T2.12.3: In `OPEN` state, immediately executes fallback without calling target.
  - T2.12.4: Probe in `HALF_OPEN` fails -> returns to `OPEN` and resets cooldown.
  - T2.12.5: Reset timeout <= 0 -> clamped to minimum 1,000ms safety cooldown.

- **T2.13 (InMemoryEventBus & Events)**:
  - T2.13.1: Large payload (> 256KB) -> handled without memory leak.
  - T2.13.2: 100 rapid concurrent subscriptions -> zero race conditions.
  - T2.13.3: Subscriber throws non-Error object -> normalized into DeadLetterEnvelope.
  - T2.13.4: Event published with no subscribers -> silently ignored without error.
  - T2.13.5: Empty DLQ query returns `[]`.

---

### 5.3 Tier 3: Cross-Feature Combinations Test Suite (`tier3-pairwise.e2e.spec.ts`)
*15 pairwise interaction tests validating multi-module choreography.*

1. **Pairwise 1: `SearchServiceTool` + `DynamicPricingAgent`**: Geospatial search queries nearby spaces; dynamic pricing recalculates surge tariff based on live occupancy before returning ranked listings.
2. **Pairwise 2: `HostOnboardingAgent` + `VisualInspectionAgent`**: Successful KYC verification emits `Host.KYCVerified`, triggering `VisualInspectionAgent` to audit property photos.
3. **Pairwise 3: `OccupancyPredictorAgent` + `DynamicPricingAgent`**: Occupancy predictor emits `Occupancy.Changed` under `PEAK_SHOPPING`; dynamic pricing immediately increases micro-zone multiplier.
4. **Pairwise 4: `DriverConciergeAgent` + `Booking Hold Saga`**: Driver concierge selects top recommendation; initiates booking hold saga, locking slot and returning QR deep link.
5. **Pairwise 5: `DisputeMediationAgent` + `SensorVerificationTool`**: Overstay dispute prompts sensor tool to query ultrasonic / ANPR logs and cross-verify actual departure against booking window.
6. **Pairwise 6: `VisualInspectionAgent` + `ParklyOrchestratorAgent`**: Visual inspection approval emits `Space.VisuallyAudited`; orchestrator activates public search index for the space.
7. **Pairwise 7: `CircuitBreaker` + `VisionTool`**: Vision tool experiences 3 consecutive timeouts; circuit breaker trips `OPEN`; visual inspection activates fallback description heuristics.
8. **Pairwise 8: `CircuitBreaker` + `GeocodingTool`**: Geocoding tool errors 3 times; circuit breaker trips; host onboarding falls back to Geohash centroid lookup.
9. **Pairwise 9: `OccupancyPredictorAgent` + Heuristic Fallback**: ML inference latency exceeds 150ms during search query; predictor falls back to `(1/demandMultiplier)` and search completes cleanly.
10. **Pairwise 10: `HostOnboardingAgent` + `NotificationTool`**: Non-residential zoning failure triggers notification dispatcher to send manual review SMS to host.
11. **Pairwise 11: `DriverConciergeAgent` + Emergency Backup Relocation**: Driver encounters blocked gate; concierge queries search tool for backup bay <= 200m, holds new slot, and waives surcharge.
12. **Pairwise 12: `DisputeMediationAgent` + `PaymentLedgerTool`**: Overstay confirmed; dispute mediator calls ledger tool to debit ₹120 from driver and credit ₹100 to host balance.
13. **Pairwise 13: `CityAnalyticsAgent` + `AnalyticsLakeTool`**: Scheduled analytics cron triggers S3 Athena queries to aggregate off-street hours and compute CO2 abated.
14. **Pairwise 14: `InMemoryEventBus` + `ParklyOrchestratorAgent`**: Orchestrator routes domain events across bus; subscriber failure captured in DLQ without impacting peer subscribers.
15. **Pairwise 15: `Booking Hold Saga` + Payment Timeout Compensation**: 10-minute hold window elapses without payment; saga compensation unlocks slot and sets booking status to `cancelled`.

---

### 5.4 Tier 4: Real-World Chennai Mobility Scenarios (`tier4-scenarios.e2e.spec.ts`)
*8 comprehensive end-to-end Chennai urban mobility scenarios.*

1. **Scenario 1: T. Nagar Festival Shopping Rush (Diwali Peak)**
   - *Setting*: Usman Road / Burkit Road, T. Nagar. Extreme retail traffic.
   - *Flow*: Driver asks Concierge for covered parking under ₹80/hr near Pothys. Predictor detects `PEAK_SHOPPING` (occupancy 92%). Dynamic pricing raises rate from ₹40 to ₹64 (1.6x multiplier, within host 1.8x cap). Booking hold saga acquires atomic lock (`FOR UPDATE`), issues 10-minute hold and QR code.
   - *Verification*: Price strictly capped, atomic lock acquired, QR entry generated within 500ms.

2. **Scenario 2: Anna Nagar Commuter Metro Park-and-Ride**
   - *Setting*: Anna Nagar Tower Metro Station. Weekday 08:30 AM morning rush.
   - *Flow*: Commuter requests 9-hour park-and-ride reservation (08:30 - 17:30). Predictor applies duration penalty. Dynamic pricing evaluates `PEAK_COMMUTE` (1.25x). Booking saga holds slot, payment succeeds via UPI intent, booking transitions `confirmed` -> `active` upon QR scan.
   - *Verification*: Duration penalty applied, state machine reaches `active`, payment ledger credited.

3. **Scenario 3: OMR IT Corridor Overnight Shift Parking**
   - *Setting*: OMR Phase 1 (Tidel Park / Sholinganallur). Evening shift change.
   - *Flow*: Driver requests overnight parking with EV charging. Search filters for `evCharging === true` and `security_level === 'gated'`. Concierge recommends Sholinganallur Tech Bay. Hold placed, UPI payment completed, digital entry pass issued.
   - *Verification*: Only EV-equipped spaces returned, booking confirmed, entry instructions include gate PIN.

4. **Scenario 4: T. Nagar Shopper Overstay Dispute Resolution**
   - *Setting*: Burkit Road Parking Bay. Shopper exceeds 2-hour booking by 90 minutes.
   - *Flow*: Host files overstay dispute. DisputeMediationAgent cross-checks IoT ultrasonic sensor logs; confirms vehicle remained until 17:30 (expected 16:00). Mediator assesses ₹120 penalty and ₹100 host compensation. Because ₹100 <= ₹1000, autonomous execution debits driver and credits host.
   - *Verification*: Telematics confirm overstay, penalty calculated accurately, payout executed autonomously without human freeze.

5. **Scenario 5: High-Value Dispute Escalation & Payout Freeze**
   - *Setting*: Anna Nagar Commercial Parking Lot. Major property damage dispute of ₹2,500.
   - *Flow*: Host claims ₹2,500 for gate damage and extended overstay. DisputeMediationAgent detects claim > ₹1,000 threshold. Automated payout is FROZEN immediately. Adjudication set to `ESCALATED_MANUAL`. Case snapshot dispatched to GCC admin console.
   - *Verification*: Zero automatic funds transferred, escrow locked, admin notification emitted.

6. **Scenario 6: Gate Access Blockage & Autonomous 200m Relocation**
   - *Setting*: Usman Road Commercial Alley. Delivery truck blocking driveway.
   - *Flow*: Driver arrives; reports gate blocked via Concierge one-tap prompt. Concierge searches for pre-vetted alternatives within 200m; finds bay 140m away on Burkit Road. Transfers booking, creates new QR code, waives surcharge (₹0 extra to driver). Penalizes original host.
   - *Verification*: Backup bay <= 200m, driver surcharge == 0, new QR code issued, original space flagged for audit.

7. **Scenario 7: Blurry GCC Property Tax Receipt KYC Escalation**
   - *Setting*: Mylapore residential host onboarding.
   - *Flow*: Host uploads blurry smartphone photo of Corporation of Chennai tax receipt. HostOnboardingAgent runs OCR: confidence score = 0.71 (< 0.85). Agent sets `kycStatus = 'MANUAL_REVIEW_REQUIRED'`. Does NOT activate space. Emits admin task and sends SMS requesting clearer photo.
   - *Verification*: Space remains inactive (`draft`), no public visibility, manual review task created.

8. **Scenario 8: Greater Chennai Corporation (GCC) Weekly Mobility Intelligence Report**
   - *Setting*: GCC Smart City Operations (T. Nagar, OMR, Anna Nagar). Monday 06:00 AM cron.
   - *Flow*: EventBus triggers `CityAnalytics.Scheduled` for period `"2026-W36"`. CityAnalyticsAgent queries S3 Athena lake across all 3 zones. Computes 48,200 off-street hours, 184,000 cruising minutes reduced, and `184,000 * 0.0229 = 4,213.6 kg CO2` abated. Identifies Panagal Park / Usman Rd choke point (1,420 unsatisfied searches). Generates executive report.
   - *Verification*: CO2 formula verified, choke points identified, report schema validated.

---

## 6. Execution Commands & Verification

### Running All Tests
```bash
# Execute entire test suite across all 4 tiers (153 tests)
npm test

# Alternatively using Vitest directly
npx vitest run tests/e2e
```

### Running Individual Tiers
```bash
# Tier 1: Feature Coverage (65 tests)
npx vitest run tests/e2e/tier1-features.e2e.spec.ts

# Tier 2: Boundary & Corner Cases (65 tests)
npx vitest run tests/e2e/tier2-boundary.e2e.spec.ts

# Tier 3: Pairwise Interactions (15 tests)
npx vitest run tests/e2e/tier3-pairwise.e2e.spec.ts

# Tier 4: Chennai Real-World Scenarios (8 scenarios)
npx vitest run tests/e2e/tier4-scenarios.e2e.spec.ts
```

### Strict Offline Guarantee
All test suites execute without network access:
- Zero real HTTP / SQS / DynamoDB calls.
- In-memory event bus and in-memory saga store.
- Deterministic mock providers for all 13 tools.

---

## 7. Invariant & Safety Guard Verification Checklist

| Safety Invariant | Bounding Rule | Verified In |
|---|---|---|
| KYC Confidence Threshold | OCR confidence < 0.85 -> `MANUAL_REVIEW_REQUIRED` | Tier 1 (T1.1.1), Tier 2 (T2.1.1), Tier 4 (Scenario 7) |
| Gate Clearance Safety | Clearance < 2.2m -> `ACTION_REQUIRED` | Tier 1 (T1.2.1), Tier 2 (T2.2.1) |
| Prediction Latency Fallback | ML query latency > 150ms -> heuristic `(1/multiplier)` | Tier 1 (T1.3.1), Tier 2 (T2.3.1), Tier 3 (Pairwise 9) |
| Dynamic Price Floor | Calculated rate >= `baseHourlyRate` | Tier 1 (T1.4.5), Tier 2 (T2.4.1) |
| Dynamic Price Ceiling | Calculated rate <= `maxMultiplier * baseHourlyRate` | Tier 1 (T1.4.3), Tier 2 (T2.4.2), Tier 4 (Scenario 1) |
| Gate Blockage Relocation | Relocation radius <= 200m, driver surcharge == ₹0 | Tier 1 (T1.5.1), Tier 2 (T2.5.1), Tier 4 (Scenario 6) |
| Dispute Compensation Freeze | Compensation > ₹1,000 -> freeze payout, `ESCALATED_MANUAL` | Tier 1 (T1.6.1), Tier 2 (T2.6.1), Tier 4 (Scenario 5) |
| CO2 Abatement Formula | CO2 abated = `cruisingMinutes * 0.0229` kg | Tier 1 (T1.7.2), Tier 2 (T2.7.3), Tier 4 (Scenario 8) |
| Orchestrator Timeout Budget | Max worker execution time <= 5,000ms | Tier 1 (T1.8.2), Tier 2 (T2.8.1) |
| Circuit Breaker Trip | 3 consecutive failures -> `OPEN` | Tier 1 (T1.12.3), Tier 2 (T2.12.2), Tier 3 (Pairwise 7) |

---

## 8. Test Completion & `TEST_READY.md` Protocol

Upon completion of test suite implementation:
1. All 153 tests across Tiers 1–4 must execute and pass via `npm test` with 0 failures and 0 skipped tests.
2. `TEST_READY.md` will be published at the workspace root detailing total test counts, execution time, and coverage sign-off.
3. Sub-orchestrator `sub_orch_e2e` will notify the parent orchestrator that the testing track is ready for integration verification.
