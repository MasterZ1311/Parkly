# Original User Request

## 2026-09-05T04:47:16Z

# Teamwork Project Prompt — Draft

> Status: Launched — Delegated to teamwork_preview
> Goal: Craft prompt → get user approval → delegate to teamwork_preview
> Requested team: [none — teamwork routes from the description]

Implement the complete, production-grade Autonomous Multi-Agent Architecture for Parkly in TypeScript based on docs/08_AI_AGENT_ARCHITECTURE.md, docs/03_SYSTEM_ARCHITECTURE.md, docs/05_DATABASE_SCHEMA_AND_MODELS.md, and docs/06_CORE_SERVICES_AND_API_SPEC.md. The system must deliver an enterprise-ready modular agent framework consisting of the central `ParklyOrchestratorAgent`, 7 specialized domain worker agents, a pluggable tool abstraction layer with deterministic test fixtures, an event-driven saga execution engine, distributed circuit breakers, and comprehensive automated test suites.

Working directory: e:\Github\Parkly
Integrity mode: development

References:
- [docs/08_AI_AGENT_ARCHITECTURE.md](file:///e:/Github/Parkly/docs/08_AI_AGENT_ARCHITECTURE.md) (Multi-Agent Specification)
- [docs/03_SYSTEM_ARCHITECTURE.md](file:///e:/Github/Parkly/docs/03_SYSTEM_ARCHITECTURE.md) (System Architecture & Topology)
- [docs/05_DATABASE_SCHEMA_AND_MODELS.md](file:///e:/Github/Parkly/docs/05_DATABASE_SCHEMA_AND_MODELS.md) (Data Models & Schemas)
- [docs/06_CORE_SERVICES_AND_API_SPEC.md](file:///e:/Github/Parkly/docs/06_CORE_SERVICES_AND_API_SPEC.md) (Core API Specifications)

---

## Production Target Architecture & Package Layout

The implementation will reside in the repository as a clean, production-ready module (`packages/ai-agents` or `services/ai-agents`), structured as follows:

```
packages/ai-agents/
├── package.json
├── tsconfig.json
├── src/
│   ├── index.ts                           # Unified package exports
│   ├── core/
│   │   ├── agent.interface.ts             # BaseAgent contract, lifecycle hooks, execute()
│   │   ├── result.ts                      # Standard Result<T, E> Monad and error classes
│   │   ├── context.ts                     # ExecutionContext with correlationId, trace, user
│   │   ├── circuit-breaker.ts             # Circuit breaker implementation for external tools
│   │   └── telemetry.ts                   # Structured logging (Pino-compatible) & metric spans
│   ├── bus/
│   │   ├── event-bus.interface.ts         # IEventBus contract (publish, subscribe, DLQ)
│   │   ├── in-memory-event-bus.ts         # Fully typed local event bus for dev & testing
│   │   ├── eventbridge-event.ts           # Amazon EventBridge standard envelope schema
│   │   └── events.catalog.ts              # Strongly-typed domain event definitions
│   ├── saga/
│   │   ├── saga-orchestrator.ts           # Distributed saga governor with rollback handlers
│   │   ├── saga-state-store.interface.ts  # ISagaStateStore (DynamoDB-ready interface)
│   │   ├── in-memory-saga-store.ts        # In-memory saga state store with full audit logs
│   │   └── workflows/
│   │       ├── host-onboarding.saga.ts    # Host KYC -> Geocode -> Inspection -> Activate
│   │       ├── booking-hold.saga.ts       # Search -> ETA Vacancy -> Pricing -> Hold -> QR
│   │       └── dispute-resolution.saga.ts # Sensor Audit -> Adjudication -> Penalty/Refund
│   ├── agents/
│   │   ├── orchestrator/
│   │   │   └── orchestrator.agent.ts      # ParklyOrchestratorAgent (router, supervisor, timeout)
│   │   ├── host-onboarding/
│   │   │   ├── host-onboarding.agent.ts   # HostOnboardingAgent implementation
│   │   │   └── host-onboarding.schema.ts  # Input/Output Zod schemas & types
│   │   ├── visual-inspection/
│   │   │   ├── visual-inspection.agent.ts # VisualInspectionAgent implementation
│   │   │   └── visual-inspection.schema.ts
│   │   ├── occupancy-predictor/
│   │   │   ├── occupancy-predictor.agent.ts# OccupancyPredictorAgent implementation
│   │   │   └── occupancy-predictor.schema.ts
│   │   ├── dynamic-pricing/
│   │   │   ├── dynamic-pricing.agent.ts   # DynamicPricingAgent implementation
│   │   │   └── dynamic-pricing.schema.ts
│   │   ├── driver-concierge/
│   │   │   ├── driver-concierge.agent.ts  # DriverConciergeAgent implementation
│   │   │   └── driver-concierge.schema.ts
│   │   ├── dispute-mediation/
│   │   │   ├── dispute-mediation.agent.ts # DisputeMediationAgent implementation
│   │   │   └── dispute-mediation.schema.ts
│   │   └── city-analytics/
│   │       ├── city-analytics.agent.ts    # CityAnalyticsAgent implementation
│   │       └── city-analytics.schema.ts
│   └── tools/
│       ├── interfaces/                    # Strict tool contracts
│       │   ├── ocr-tool.interface.ts
│       │   ├── geocoding-tool.interface.ts
│       │   ├── zoning-tool.interface.ts
│       │   ├── vision-tool.interface.ts
│       │   ├── occupancy-query-tool.interface.ts
│       │   ├── pricing-engine-tool.interface.ts
│       │   ├── search-service-tool.interface.ts
│       │   ├── booking-service-tool.interface.ts
│       │   ├── traffic-monitor-tool.interface.ts
│       │   ├── sensor-verification-tool.interface.ts
│       │   ├── payment-ledger-tool.interface.ts
│       │   ├── notification-tool.interface.ts
│       │   └── analytics-lake-tool.interface.ts
│       └── mock-providers/                # Fully deterministic offline test fixtures
│           ├── mock-ocr.provider.ts
│           ├── mock-geocoding.provider.ts
│           ├── mock-zoning.provider.ts
│           ├── mock-vision.provider.ts
│           ├── mock-occupancy.provider.ts
│           ├── mock-pricing.provider.ts
│           ├── mock-search.provider.ts
│           ├── mock-booking.provider.ts
│           ├── mock-traffic.provider.ts
│           ├── mock-sensor.provider.ts
│           ├── mock-ledger.provider.ts
│           ├── mock-notification.provider.ts
│           └── mock-analytics.provider.ts
└── tests/
    ├── unit/                              # Unit tests for all 8 agents & tools
    │   ├── host-onboarding.agent.spec.ts
    │   ├── visual-inspection.agent.spec.ts
    │   ├── occupancy-predictor.agent.spec.ts
    │   ├── dynamic-pricing.agent.spec.ts
    │   ├── driver-concierge.agent.spec.ts
    │   ├── dispute-mediation.agent.spec.ts
    │   ├── city-analytics.agent.spec.ts
    │   └── orchestrator.agent.spec.ts
    ├── integration/                       # End-to-end multi-agent sagas & fallbacks
    │   ├── onboarding-to-inspection.spec.ts
    │   ├── search-and-booking-flow.spec.ts
    │   ├── dispute-escalation-flow.spec.ts
    │   └── circuit-breaker-fallback.spec.ts
    └── fixtures/                          # Sample payloads, Chennai locations, test KYC
```

---

## Detailed Requirements

### R1. Base Agent Framework, Lifecycle & Telemetry
Build an extensible base agent abstraction (`BaseAgent<TInput, TOutput>`) providing:
- Runtime schema validation using Zod for both input payloads and output results.
- Standardized execution envelopes returning `Result<TOutput, AgentError>` with typed error codes (`VALIDATION_ERROR`, `TIMEOUT_ERROR`, `CIRCUIT_OPEN`, `DOWNSTREAM_FAILURE`, `BUSINESS_INVARIANT_VIOLATION`).
- Unified context passing (`ExecutionContext`) carrying `correlationId`, `traceId`, `initiatorUserId`, and timestamp.
- Structured logger emitting JSON logs with correlation context.
- Execution timeout enforcement (default: 5000ms max execution budget per worker agent step).

### R2. Core Orchestrator & Distributed Saga Governor
Implement `ParklyOrchestratorAgent`:
- Spawns, coordinates, and supervises worker sub-agents with strict timeout budgets and isolation.
- Dispatches and processes domain events matching the EventBridge specification.
- Manages distributed sagas (`SagaOrchestrator`) with state persistence tracking (`PENDING`, `STEP_COMPLETED`, `COMPENSATING`, `COMPENSATED`, `FAILED`).
- Implements circuit breaker guards (`CircuitBreaker`) per external tool integration (e.g. failing vision or geocoding APIs trip after 3 consecutive errors and divert to fallback providers).
- Handles dead-letter queue (DLQ) routing when an unrecoverable error occurs, retaining the original payload and stack trace for administrative review.

### R3. Implementation of All 7 Specialized Domain Agents

#### 1. HostOnboardingAgent
- **Input**: `userId`, `rawAddress`, `documentUrls`, `declaredSlots`, `vehicleTypes`.
- **Logic**: Executes OCR on identity documents (PAN, property deed), performs spatial geocoding with geohash generation (precision 7), and performs municipal zoning validation.
- **Output**: `hostId`, `kycStatus` (`VERIFIED_AUTO` | `MANUAL_REVIEW_REQUIRED`), `confidenceScore`, `extractedIdentity` (ownerName, panNumber, propertyTaxId), `geocoding` (lat, lng, geohash, normalizedAddress), `zoningCompliance`.
- **Failures & Invariants**: If OCR confidence < 0.85 or zoning is non-residential/ambiguous, flags `MANUAL_REVIEW_REQUIRED` and emits a notification for admin review.

#### 2. VisualInspectionAgent
- **Input**: `spaceId`, `photoUrls`.
- **Logic**: Analyzes photos for surface condition, gate width and vertical clearance, security amenities (CCTV, lighting, EV charger), detects physical obstructions, and applies automated privacy anonymization (blurring license plates and human faces). Synthesizes an attractive listing description.
- **Output**: `spaceId`, `inspectionResult` (`APPROVED` | `REJECTED` | `ACTION_REQUIRED`), `detectedAttributes`, `privacyActions` (blurred counts), `generatedDescription`.
- **Failures & Invariants**: If gate clearance < 2.2m or obstructions are present, returns `ACTION_REQUIRED` with specific actionable feedback for the host.

#### 3. OccupancyPredictorAgent
- **Input**: `spaceId`, `targetArrivalTime`, `targetDurationMinutes`, `userCurrentLocation`.
- **Logic**: Aggregates historical time-series slot occupancy data, live IoT sensor states, and contextual city factors (festivals, traffic choke points, weather). Computes arrival vacancy probability and confidence score.
- **Output**: `spaceId`, `arrivalProbability`, `confidenceScore`, `estimatedAvailableSlots`, `demandTier`, `contextualFactors`.
- **Failures & Invariants**: If ML model/query latency exceeds 150ms, immediately activates deterministic rule-based fallback heuristic (`1 / demandMultiplier` with duration scaling).

#### 4. DynamicPricingAgent
- **Input**: `spaceId`, `baseHourlyRate`, `currentOccupancyRate`, `demandForecastTier`, `hostPricingPreferences` (`allowDynamic`, `maxMultiplier`).
- **Logic**: Evaluates real-time occupancy pressure, micro-zone demand surges, and competitor curbside rates to calculate optimal hourly parking tariffs.
- **Output**: `spaceId`, `calculatedHourlyRate`, `appliedMultiplier`, `surgeReason`, `effectiveFrom`, `effectiveUntil`.
- **Failures & Invariants**: Strict invariant safety guards: `calculatedHourlyRate` can NEVER fall below `baseHourlyRate`, and can NEVER exceed `maxMultiplier * baseHourlyRate`.

#### 5. DriverConciergeAgent
- **Input**: `driverId`, `query` (natural language, e.g. "Find me covered parking near Pothys for 2 hours under 60/hr"), `currentLocation`.
- **Logic**: Parses intent, executes geospatial search with multi-criteria scoring (distance, ETA arrival probability, price), initiates provisional booking hold, generates turn-by-turn deep links and entry instructions.
- **Output**: `action` (`PRESENT_RECOMMENDATION` | `CLARIFICATION_NEEDED` | `NO_SPACES_FOUND`), `recommendedSpace`, `turnByTurnDeepLink`, `entryInstructions`.
- **Failures & Invariants**: If driver arrives and gate is reported inaccessible or blocked, triggers immediate relocation to the closest pre-vetted backup bay within 200m at zero driver surcharge.

#### 6. DisputeMediationAgent (Fraud Sentinel)
- **Input**: `disputeId`, `bookingId`, `incidentType` (`OVERSTAY_REPORTED`, `UNAUTHORIZED_VEHICLE`, `NO_SHOW`, etc.), `reportedBy`, `evidence`.
- **Logic**: Cross-verifies telematics and sensor records with reservation window timestamps. Adjudicates violation, calculates penalty charges and host compensation, and updates payment ledger.
- **Output**: `disputeId`, `adjudication` (`OVERSTAY_CONFIRMED` | `DISPUTE_DISMISSED` | `ESCALATED_MANUAL`), `actionsTaken`, `hostCompensationAmount`, `platformAuditLog`.
- **Failures & Invariants**: If disputed compensation > ₹1,000, freezes automatic payout and escalates to human operations with full evidence snapshot.

#### 7. CityAnalyticsAgent
- **Input**: `cityId`, `period` (ISO week, e.g. "2026-W36"), `zones`.
- **Logic**: Aggregates macro mobility data across zones. Computes off-street hours supplied, cruising minutes saved, CO2 abated in kg, and identifies unmet demand choke points.
- **Output**: `cityId`, `reportGeneratedAt`, `metrics` (off-street hours, cruising reduced, CO2 abated, choke points), `recommendation`.
- **Failures & Invariants**: Generates structured report payload suitable for automated email dispatch and GeoJSON mapping.

### R4. Pluggable Tool Layer with Deterministic Test Providers
Define TypeScript interfaces and production-ready mock providers for all external tools:
- `IOcrTool` / `MockOcrProvider`: Parses mock PAN and property tax receipts with configurable confidence scores.
- `IGeocodingTool` / `MockGeocodingProvider`: Computes coordinates, normalized addresses, and Geohash precision 7 values for Chennai landmarks (T. Nagar, Anna Nagar, OMR).
- `IZoningTool` / `MockZoningProvider`: Validates municipal residential land-use zones.
- `IVisionTool` / `MockVisionProvider`: Detects gate clearance, surface, CCTV, EV charging, and simulates license plate redactions.
- `IOccupancyQueryTool` / `MockOccupancyQueryProvider`: Supplies historical and live sensor telemetry.
- `IPricingEngineTool` / `MockPricingEngineProvider`: Computes surge multipliers.
- `ISearchServiceTool` / `MockSearchServiceProvider`: Geospatial radius queries with ranking.
- `IBookingServiceTool` / `MockBookingServiceProvider`: Slot lock reservation holds.
- `ITrafficMonitorTool` / `MockTrafficMonitorProvider`: Live ETA and traffic delay calculations.
- `ISensorVerificationTool` / `MockSensorVerificationProvider`: Vehicle presence verification logs.
- `IPaymentLedgerTool` / `MockPaymentLedgerProvider`: Escrow hold, penalty charge, and refund dispatch.
- `INotificationTool` / `MockNotificationProvider`: SMS/Push message capture for test assertions.
- `IAnalyticsLakeTool` / `MockAnalyticsLakeProvider`: S3 Athena aggregation query simulator.

### R5. Asynchronous Event Bus and Domain Event Choreography
- Implement `IEventBus` with strong EventBridge typing (`source: "parkly.ai"`, `detail-type`, `detail`, `time`, `id`).
- Provide `InMemoryEventBus` supporting topic subscriptions, fan-out event dispatch, and dead-letter queues.
- Standard domain events:
  - `Host.Submitted` -> triggers `HostOnboardingAgent`
  - `Host.KYCVerified` -> triggers `VisualInspectionAgent`
  - `Space.VisuallyAudited` -> triggers `ParklyOrchestratorAgent` (activates listing)
  - `Search.Requested` -> triggers `DriverConciergeAgent`
  - `Occupancy.Changed` -> triggers `OccupancyPredictorAgent` & `DynamicPricingAgent`
  - `Pricing.Updated` -> invalidates search cache
  - `Dispute.Raised` -> triggers `DisputeMediationAgent`
  - `Dispute.Resolved` -> triggers `PaymentLedgerTool` & notification dispatch
  - `CityAnalytics.Scheduled` -> triggers `CityAnalyticsAgent`

### R6. Verification & Automated Test Suites
Deliver comprehensive automated test suites using Vitest or Jest:
- **Unit Tests**: Minimum 1 test suite per agent verifying standard happy paths, boundary conditions, schema validation failures, and edge cases.
- **Invariant Tests**: Dedicated tests asserting strict bounding on dynamic pricing, low-confidence KYC escalation, gate obstruction warnings, and dispute compensation caps.
- **Saga Integration Tests**: End-to-end tests exercising complete multi-agent sagas via the event bus:
  1. Onboarding saga: `Host.Submitted` -> OCR verification -> Geocoding -> Visual inspection -> Listing activation.
  2. Search & hold saga: Natural language query -> ETA occupancy prediction -> Dynamic pricing -> Hold placement.
  3. Dispute arbitration saga: Overstay report -> Telematics verification -> Adjudication -> Penalty charge & notification.
  4. Failure & circuit breaker recovery: Simulating third-party API outage and verifying fallback execution.

---

## Acceptance Criteria

### Type Safety & Architecture Conformance
- [ ] TypeScript compiles cleanly in strict mode with zero type errors (`tsc --noEmit` / `npm run build`).
- [ ] Every agent inherits from `BaseAgent` and enforces typed Zod validation on inputs and outputs.
- [ ] Standard `Result<T, E>` monad is used across all agent execution boundaries with zero unhandled promise rejections.

### Agent Logic & Invariants
- [ ] `HostOnboardingAgent`: Successfully flags `MANUAL_REVIEW_REQUIRED` when OCR confidence is < 0.85 or zoning is non-residential.
- [ ] `VisualInspectionAgent`: Identifies narrow gates (< 2.2m) and returns actionable correction advice to the host; correctly reports blurred plate/face counts.
- [ ] `OccupancyPredictorAgent`: Calculates vacancy probability; falls back to deterministic rule-based heuristic when execution latency exceeds 150ms.
- [ ] `DynamicPricingAgent`: Clamps calculated price strictly between `baseHourlyRate` and `maxMultiplier * baseHourlyRate`.
- [ ] `DriverConciergeAgent`: Re-routes driver to alternative backup bay within 200m upon simulated gate access blockage.
- [ ] `DisputeMediationAgent`: Confirms overstay via sensor verification, computes exact penalty/compensation, and escalates to manual review if compensation > ₹1,000.
- [ ] `CityAnalyticsAgent`: Computes aggregate off-street hours, cruising minutes reduced, and CO2 abated for target city zones.

### Multi-Agent Choreography & Saga Execution
- [ ] `ParklyOrchestratorAgent` executes and tracks multi-agent sagas through all lifecycle states (`PENDING`, `STEP_COMPLETED`, `COMPLETED`, `FAILED`).
- [ ] Event bus successfully routes domain events with correlation IDs preserved across all agent hops.
- [ ] Circuit breaker successfully trips after configured consecutive failures and redirects to fallbacks.

### Test Coverage & Offline Runnability
- [ ] 100% of automated unit and integration tests pass via a single command (`npm test`) without requiring internet access or cloud API credentials.
- [ ] Comprehensive test fixtures cover Chennai sample addresses, mock KYC docs, space photos, and IoT sensor logs.
