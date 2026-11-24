# Project: Parkly Autonomous Multi-Agent Architecture

## Architecture
The Parkly Autonomous Multi-Agent Architecture provides an enterprise-ready, modular, offline-deterministic multi-agent framework implemented in TypeScript for intelligent parking discovery, host onboarding, visual inspection, dynamic pricing, fraud mitigation, and city mobility analytics.

```
                    ┌────────────────────────────────────────────────────────┐
                    │               ParklyOrchestratorAgent                  │
                    │      (Supervisor, Router, Timeout Guard, DLQ)          │
                    └──────────────────────────┬─────────────────────────────┘
                                               │
                    ┌──────────────────────────┴─────────────────────────────┐
                    │            Distributed Saga Governor                   │
                    │   (SagaOrchestrator, ISagaStateStore, Workflows)       │
                    └──────────────────────────┬─────────────────────────────┘
                                               │
        ┌──────────────────────────────────────┼──────────────────────────────────────┐
        │                                      │                                      │
┌───────┴──────────────┐             ┌─────────┴────────────┐               ┌─────────┴────────────┐
│  InMemoryEventBus    │             │   BaseAgent & Core   │               │ Pluggable Tool Layer │
│ (EventBridge Schema, │             │ (Result<T,E>, Ctx,   │               │ (13 Strict Contracts │
│  18 Domain Events)   │             │  CircuitBreaker, Tel)│               │  & Mock Providers)   │
└──────────────────────┘             └──────────────────────┘               └──────────────────────┘
        │                                      │                                      │
        └──────────────────────────────────────┼──────────────────────────────────────┘
                                               │
         ┌─────────────────────────────────────┴─────────────────────────────────────┐
         │                       7 Specialized Domain Agents                         │
         ├──────────────────────────┬────────────────────────────┬───────────────────┤
         │ HostOnboardingAgent      │ VisualInspectionAgent      │ OccupancyPredictor│
         │ DynamicPricingAgent      │ DriverConciergeAgent       │ DisputeMediation  │
         │ CityAnalyticsAgent       │                            │                   │
         └──────────────────────────┴────────────────────────────┴───────────────────┘
```

## Feature Inventory
| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| 1 | BaseAgent Abstract Class | Generic base agent `BaseAgent<TInput, TOutput>` with Zod schema validation (`validateInput`, `validateOutput`), lifecycle hooks, and timeout budget enforcement | M1 | ORIGINAL_REQUEST §R1, docs/08 |
| 2 | Result Monad & Error Codes | Functional `Result<T, E>` monad (`ok`, `err`, `isOk`, `isErr`) and `AgentError` with typed codes (`VALIDATION_ERROR`, `TIMEOUT_ERROR`, `CIRCUIT_OPEN`, `DOWNSTREAM_FAILURE`, `BUSINESS_INVARIANT_VIOLATION`) | M1 | ORIGINAL_REQUEST §R1, docs/08 |
| 3 | ExecutionContext Propagation | Context envelope carrying `correlationId`, `traceId`, `initiatorUserId`, timestamp, and child context propagation | M1 | ORIGINAL_REQUEST §R1, docs/06, docs/08 |
| 4 | Distributed Circuit Breaker | `CircuitBreaker` with 3-failure trip threshold, cooldown reset window, state transitions (`CLOSED`, `OPEN`, `HALF_OPEN`), and fallback invocation | M1 | ORIGINAL_REQUEST §R1, §R2, docs/08 |
| 5 | Structured Telemetry & Logging | Pino-compatible JSON logger with correlation metadata, metric spans, and latency tracking | M1 | ORIGINAL_REQUEST §R1, docs/08 |
| 6 | Workspace & Package Setup | Monorepo root `package.json`, `packages/ai-agents` setup, TypeScript 5+ strict config, and Vitest test runner configuration | M1 | ORIGINAL_REQUEST, docs/04 |
| 7 | Tool TypeScript Interfaces | 13 strict tool contracts (`IOcrTool`, `IGeocodingTool`, `IZoningTool`, `IVisionTool`, `IOccupancyQueryTool`, `IPricingEngineTool`, `ISearchServiceTool`, `IBookingServiceTool`, `ITrafficMonitorTool`, `ISensorVerificationTool`, `IPaymentLedgerTool`, `INotificationTool`, `IAnalyticsLakeTool`) | M2 | ORIGINAL_REQUEST §R4, docs/08 |
| 8 | Geohash Algorithm Utility | Pure TypeScript base32 geohash encoder/decoder supporting precision-7 spatial indexing | M2 | ORIGINAL_REQUEST §R3, docs/08 |
| 9 | Chennai Domain Test Fixtures | Deterministic test fixtures for Chennai locations (T. Nagar, Anna Nagar, OMR, Pothys), GCC property tax receipts, Indian PAN cards, photos, sensor telemetry, and dispute records | M2 | ORIGINAL_REQUEST §R4, §R6, docs/05 |
| 10 | 13 Deterministic Mock Providers | Zero-internet offline mock implementations for all 13 tools with configurable latency, error modes, and circuit breaker compatibility | M2 | ORIGINAL_REQUEST §R4, docs/08 |
| 11 | EventBridge Event Envelope | Strongly typed AWS EventBridge event envelope (`source: 'parkly.ai'`, `detail-type`, `detail`, `time`, `id`, `correlationId`) | M3 | ORIGINAL_REQUEST §R5, docs/03 |
| 12 | InMemoryEventBus Implementation | Local async event bus with topic/pattern subscription, asynchronous fan-out (`Promise.allSettled`), subscriber error isolation, and Dead-Letter Queue (DLQ) routing | M3 | ORIGINAL_REQUEST §R5, docs/03 |
| 13 | Strongly-Typed Domain Event Catalog | Catalog of 18 domain events (`Host.Submitted`, `Host.KYCVerified`, `Space.VisuallyAudited`, `Search.Requested`, `Occupancy.Changed`, `Pricing.Updated`, `Dispute.Raised`, `Dispute.Resolved`, `CityAnalytics.Scheduled`, etc.) | M3 | ORIGINAL_REQUEST §R5, docs/03, docs/08 |
| 14 | Distributed Saga Governor | `SagaOrchestrator` coordinating forward execution, LIFO compensation rollbacks, and lifecycle tracking (`PENDING`, `STEP_COMPLETED`, `COMPLETED`, `COMPENSATING`, `COMPENSATED`, `FAILED`) | M3 | ORIGINAL_REQUEST §R2, docs/08 |
| 15 | Saga State Store | `ISagaStateStore` interface and `InMemorySagaStore` implementation with immutable audit logs and query APIs | M3 | ORIGINAL_REQUEST §R2, docs/08 |
| 16 | Host Onboarding Saga Workflow | Distributed saga: KYC OCR -> Spatial Geocoding -> Municipal Zoning -> Visual Inspection -> Listing Activation, with rollback compensation | M3 | ORIGINAL_REQUEST §R2, docs/08 |
| 17 | Booking Hold Saga Workflow | Distributed saga: Search -> ETA Vacancy Prediction -> Dynamic Pricing -> 10-Minute Hold -> QR Code Generation, with lock release compensation | M3 | ORIGINAL_REQUEST §R2, docs/05, docs/08 |
| 18 | Dispute Resolution Saga Workflow | Distributed saga: Sensor Telematics Audit -> Adjudication -> Ledger Penalty/Refund -> Notification, with human escalation freezing | M3 | ORIGINAL_REQUEST §R2, docs/08 |
| 19 | HostOnboardingAgent | Automated KYC extraction, geocoding (precision 7), zoning check. Invariant: OCR < 0.85 or non-residential zoning -> `MANUAL_REVIEW_REQUIRED` | M4 | ORIGINAL_REQUEST §R3.1, docs/08 |
| 20 | VisualInspectionAgent | Photo analysis for clearance, amenities, surface, obstructions, and privacy redactions (plates/faces). Invariant: gate < 2.2m or obstructions -> `ACTION_REQUIRED` | M4 | ORIGINAL_REQUEST §R3.2, docs/08 |
| 21 | OccupancyPredictorAgent | Arrival vacancy probability from historical timeseries and live IoT data. Invariant: query latency > 150ms -> fallback heuristic `(1 / demandMultiplier)` | M4 | ORIGINAL_REQUEST §R3.3, docs/08 |
| 22 | DynamicPricingAgent | Real-time tariff calculation from demand surges and competitor indexing. Invariant: strictly clamped to `[baseHourlyRate, maxMultiplier * baseHourlyRate]` | M4 | ORIGINAL_REQUEST §R3.4, docs/06, docs/08 |
| 23 | DriverConciergeAgent | NLP search parsing, multi-criteria ranking, provisional hold, turn-by-turn deep link. Invariant: gate blockage -> emergency relocation <= 200m at 0 surcharge | M4 | ORIGINAL_REQUEST §R3.5, docs/08 |
| 24 | DisputeMediationAgent | Fraud sentinel cross-verifying sensor logs and reservation windows. Invariant: compensation > ₹1,000 -> freeze payout, escalate to `ESCALATED_MANUAL` | M4 | ORIGINAL_REQUEST §R3.6, docs/08 |
| 25 | CityAnalyticsAgent | Macro mobility metrics (off-street hours, cruising reduced, CO2 abated at 0.0229 kg/min, unmet demand choke points) for ISO week periods | M4 | ORIGINAL_REQUEST §R3.7, docs/08 |
| 26 | ParklyOrchestratorAgent | Central supervisor routing domain events, enforcing 5000ms max execution budget per worker step, managing sagas, and routing unrecoverable errors to DLQ | M4 | ORIGINAL_REQUEST §R2, docs/08 |
| 27 | Unified Package Exports & Public API | Central `src/index.ts` exporting all agents, schemas, tools, bus, sagas, and core utilities | M4 | ORIGINAL_REQUEST §Package Layout |
| 28 | Comprehensive Unit & Invariant Test Suite | Complete automated unit and invariant test suite covering all 8 agents, 13 tools, circuit breakers, and boundary constraints | M5 | ORIGINAL_REQUEST §R6, docs/08 |
| 29 | Multi-Agent Saga Integration Test Suite | End-to-end integration tests exercising multi-agent choreographies and sagas (Onboarding, Search/Booking, Dispute, Fallback) | M5 | ORIGINAL_REQUEST §R6, docs/08 |
| 30 | Adversarial Coverage Hardening (Tier 5) | White-box adversarial edge-case testing, mutation resilience, and gap elimination | M5 | Project Pattern Tier 5 |

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| M1 | Package Foundation, Core Agent Framework & Telemetry | Workspace package setup, TypeScript strict config, Vitest setup, Result monad, ExecutionContext, CircuitBreaker, structured logger, and BaseAgent | none | COMPLETED |
| M2 | Pluggable Tool Abstraction Layer, Mock Providers & Fixtures | 13 tool interfaces, pure TS geohash utility, Chennai test fixtures, and 13 deterministic mock providers | M1 | COMPLETED |
| M3 | EventBridge Event Bus & Distributed Saga Governor | EventBridge envelope, InMemoryEventBus, domain events catalog, SagaOrchestrator, ISagaStateStore, InMemorySagaStore, and 3 saga workflows | M1, M2 | COMPLETED |
| M4 | 7 Specialized Domain Agents & Central Orchestrator Agent | HostOnboarding, VisualInspection, OccupancyPredictor, DynamicPricing, DriverConcierge, DisputeMediation, CityAnalytics agents, schemas, invariants, ParklyOrchestratorAgent, and unified exports | M1, M2, M3 | COMPLETED |
| M5 | Final Milestone: E2E Test Suite Pass (Tiers 1-4) & Adversarial Hardening (Tier 5) | Verification of 100% passing E2E test suite published by E2E Testing Track, followed by white-box adversarial coverage hardening | M4, TEST_READY.md | COMPLETED |

## Parallel Track: E2E Testing Track
- **Owner**: `sub_orch_e2e_testing`
- **Deliverables**: `TEST_INFRA.md`, test runner, comprehensive test suites across Tiers 1-4 (>= 5 tests per feature, boundary tests, pairwise tests, real-world application scenarios), and publication of `TEST_READY.md`.

## Interface Contracts
### BaseAgent ↔ Specialized Agents
```typescript
abstract class BaseAgent<TInput, TOutput> {
  constructor(readonly name: string, readonly options?: AgentOptions);
  abstract readonly inputSchema: z.ZodType<TInput>;
  abstract readonly outputSchema: z.ZodType<TOutput>;
  execute(input: unknown, ctx: ExecutionContext): Promise<Result<TOutput, AgentError>>;
  protected abstract executeInternal(input: TInput, ctx: ExecutionContext): Promise<Result<TOutput, AgentError>>;
}
```

### Result Monad Contract
```typescript
type Result<T, E = AgentError> = 
  | { success: true; data: T; error?: never }
  | { success: false; data?: never; error: E };
```

### EventBus Contract
```typescript
interface IEventBus {
  publish<T>(event: EventBridgeEvent<T>): Promise<void>;
  subscribe<T>(detailType: string, handler: EventHandler<T>): () => void;
  getDeadLetterQueue(): DeadLetterEnvelope[];
}
```

### Saga Orchestrator Contract
```typescript
interface ISagaStep<TContext> {
  name: string;
  execute: (context: TContext) => Promise<Result<Partial<TContext>, AgentError>>;
  compensate: (context: TContext) => Promise<Result<void, AgentError>>;
}
```

## Code Layout
```
packages/ai-agents/
├── package.json
├── tsconfig.json
├── vitest.config.ts
├── src/
│   ├── index.ts
│   ├── core/
│   │   ├── agent.interface.ts
│   │   ├── result.ts
│   │   ├── context.ts
│   │   ├── circuit-breaker.ts
│   │   └── telemetry.ts
│   ├── bus/
│   │   ├── event-bus.interface.ts
│   │   ├── in-memory-event-bus.ts
│   │   ├── eventbridge-event.ts
│   │   └── events.catalog.ts
│   ├── saga/
│   │   ├── saga-orchestrator.ts
│   │   ├── saga-state-store.interface.ts
│   │   ├── in-memory-saga-store.ts
│   │   └── workflows/
│   │       ├── host-onboarding.saga.ts
│   │       ├── booking-hold.saga.ts
│   │       └── dispute-resolution.saga.ts
│   ├── agents/
│   │   ├── orchestrator/
│   │   │   └── orchestrator.agent.ts
│   │   ├── host-onboarding/
│   │   │   ├── host-onboarding.agent.ts
│   │   │   └── host-onboarding.schema.ts
│   │   ├── visual-inspection/
│   │   │   ├── visual-inspection.agent.ts
│   │   │   └── visual-inspection.schema.ts
│   │   ├── occupancy-predictor/
│   │   │   ├── occupancy-predictor.agent.ts
│   │   │   └── occupancy-predictor.schema.ts
│   │   ├── dynamic-pricing/
│   │   │   ├── dynamic-pricing.agent.ts
│   │   │   └── dynamic-pricing.schema.ts
│   │   ├── driver-concierge/
│   │   │   ├── driver-concierge.agent.ts
│   │   │   └── driver-concierge.schema.ts
│   │   ├── dispute-mediation/
│   │   │   ├── dispute-mediation.agent.ts
│   │   │   └── dispute-mediation.schema.ts
│   │   └── city-analytics/
│   │       ├── city-analytics.agent.ts
│   │       └── city-analytics.schema.ts
│   ├── tools/
│   │   ├── interfaces/
│   │   │   ├── ocr-tool.interface.ts
│   │   │   ├── geocoding-tool.interface.ts
│   │   │   ├── zoning-tool.interface.ts
│   │   │   ├── vision-tool.interface.ts
│   │   │   ├── occupancy-query-tool.interface.ts
│   │   │   ├── pricing-engine-tool.interface.ts
│   │   │   ├── search-service-tool.interface.ts
│   │   │   ├── booking-service-tool.interface.ts
│   │   │   ├── traffic-monitor-tool.interface.ts
│   │   │   ├── sensor-verification-tool.interface.ts
│   │   │   ├── payment-ledger-tool.interface.ts
│   │   │   ├── notification-tool.interface.ts
│   │   │   └── analytics-lake-tool.interface.ts
│   │   ├── utils/
│   │   │   └── geohash.ts
│   │   └── mock-providers/
│   │       ├── mock-ocr.provider.ts
│   │       ├── mock-geocoding.provider.ts
│   │       ├── mock-zoning.provider.ts
│   │       ├── mock-vision.provider.ts
│   │       ├── mock-occupancy.provider.ts
│   │       ├── mock-pricing.provider.ts
│   │       ├── mock-search.provider.ts
│   │       ├── mock-booking.provider.ts
│   │       ├── mock-traffic.provider.ts
│   │       ├── mock-sensor.provider.ts
│   │       ├── mock-ledger.provider.ts
│   │       ├── mock-notification.provider.ts
│   │       └── mock-analytics.provider.ts
│   └── fixtures/
│       ├── chennai-locations.fixture.ts
│       ├── mock-documents.fixture.ts
│       ├── mock-photos.fixture.ts
│       └── mock-telemetry.fixture.ts
└── tests/
    ├── unit/
    │   ├── core/
    │   ├── tools/
    │   ├── bus/
    │   ├── saga/
    │   └── agents/
    ├── integration/
    └── e2e/
```
