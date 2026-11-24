# 🅿️ Parkly — Autonomous Multi-Agent Architecture & Lifecycle Specification

> **Document Version**: 1.0.0  
> **Status**: Approved Specification  
> **Goal**: Automate the end-to-end parking marketplace lifecycle — from host supply discovery and visual space inspection to real-time predictive matching, algorithmic yield pricing, autonomous dispute arbitration, and smart city traffic analytics.

---

## 1. High-Level Multi-Agent Ecosystem

```
                                  ┌─────────────────────────────┐
                                  │   ParklyOrchestratorAgent   │
                                  │ (Workflow & State Governor) │
                                  └──────────────┬──────────────┘
                                                 │
         ┌───────────────────┬───────────────────┼───────────────────┬───────────────────┐
         │                   │                   │                   │                   │
         ▼                   ▼                   ▼                   ▼                   ▼
┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐
│ HostOnboarding  │ │ VisualInspection│ │ Occupancy       │ │ DynamicPricing  │ │ DriverConcierge │
│     Agent       │ │     Agent       │ │ PredictorAgent  │ │     Agent       │ │     Agent       │
└────────┬────────┘ └────────┬────────┘ └────────┬────────┘ └────────┬────────┘ └────────┬────────┘
         │                   │                   │                   │                   │
         └───────────────────┼───────────────────┴───────────────────┼───────────────────┘
                             │                                       │
                             ▼                                       ▼
                    ┌─────────────────┐                     ┌─────────────────┐
                    │ DisputeMediation│                     │  CityAnalytics  │
                    │      Agent      │                     │      Agent      │
                    └─────────────────┘                     └─────────────────┘
```

---

## 2. Detailed Agent Specifications

### 2.1 `HostOnboardingAgent`
* **Role**: Automates host acquisition, KYC verification, document parsing, and spatial geocoding.
* **Input Contract**:
  ```json
  {
    "userId": "usr_99120a",
    "rawAddress": "Old No 14, New No 28, Burkit Road, T. Nagar, Chennai 600017",
    "documentUrls": ["https://s3.parkly.in/kyc/tax_receipt_99120.pdf"],
    "declaredSlots": 2,
    "vehicleTypes": ["sedan", "suv"]
  }
  ```
* **Output Contract**:
  ```json
  {
    "hostId": "hst_4810ac",
    "kycStatus": "VERIFIED_AUTO",
    "confidenceScore": 0.96,
    "extractedIdentity": {
      "ownerName": "Suresh Krishnan",
      "panNumber": "ABCDE1234F",
      "propertyTaxId": "CORP-CHN-2024-88192"
    },
    "geocoding": {
      "latitude": 13.0382,
      "longitude": 80.2314,
      "geohash": "tf34b8c",
      "normalizedAddress": "28 Burkit Rd, T. Nagar, Chennai, Tamil Nadu 600017"
    },
    "zoningCompliance": "RESIDENTIAL_PERMITTED"
  }
  ```
* **Tools Needed**:
  - `OCR_DocumentParserTool` (AWS Textract / Bedrock Vision for PAN & property deed parsing)
  - `GoogleMapsGeocodingTool` (Address geocoding & boundary validation)
  - `ZoningComplianceTool` (Municipal land-use dataset lookup)
  - `DatabaseWriteTool` (Prisma Host & Space records)
* **Hand-off Trigger**: Hands off to `VisualInspectionAgent` once KYC documents are parsed and spatial coordinates are verified.
* **Failure Handling**: If document confidence is < 0.85 or zoning is ambiguous, flags as `MANUAL_REVIEW_REQUIRED` and dispatches task to human admin console via SNS.

---

### 2.2 `VisualInspectionAgent`
* **Role**: Analyzes host-uploaded property photographs to verify space suitability, detect obstructions, audit security amenities, and auto-enhance listings.
* **Input Contract**:
  ```json
  {
    "spaceId": "spc_chennai_tnagar_01",
    "photoUrls": [
      "https://s3.parkly.in/spaces/img_gate_01.jpg",
      "https://s3.parkly.in/spaces/img_bay_02.jpg"
    ]
  }
  ```
* **Output Contract**:
  ```json
  {
    "spaceId": "spc_chennai_tnagar_01",
    "inspectionResult": "APPROVED",
    "detectedAttributes": {
      "isCovered": true,
      "surfaceType": "concrete_paved",
      "estimatedWidthMeters": 2.8,
      "estimatedLengthMeters": 5.4,
      "gateClearanceAdequate": true,
      "cctvVisible": true,
      "lightingAdequate": true,
      "evChargerDetected": false
    },
    "privacyActions": {
      "licensePlatesBlurred": 1,
      "facesBlurred": 0
    },
    "generatedDescription": "Spacious covered concrete parking bay on Burkit Road with wide gated entry and 24/7 CCTV surveillance. Ideal for sedans and SUVs."
  }
  ```
* **Tools Needed**:
  - `MultimodalVisionTool` (Claude 3.5 Sonnet / AWS Bedrock Titan Multimodal)
  - `ImageAnonymizerTool` (OpenCV / Rekognition for auto-blurring plates and faces)
  - `S3ImageProcessorTool` (Watermarking & thumbnail generation)
* **Hand-off Trigger**: Emits `Space.VisuallyAudited` -> notifies `ParklyOrchestratorAgent` to activate public space index.
* **Failure Handling**: If obstructions (debris, narrow gate < 2.2m) are detected, generates specific actionable feedback to host ("Please upload a clearer picture showing gate clearance without parked two-wheelers").

---

### 2.3 `OccupancyPredictorAgent`
* **Role**: Predicts slot vacancy probability at the driver's projected time of arrival (ETA), factoring in historical time-series, live sensor data, and local events.
* **Input Contract**:
  ```json
  {
    "spaceId": "spc_chennai_tnagar_01",
    "targetArrivalTime": "2026-09-05T15:30:00Z",
    "targetDurationMinutes": 120,
    "userCurrentLocation": { "latitude": 13.0827, "longitude": 80.2707 }
  }
  ```
* **Output Contract**:
  ```json
  {
    "spaceId": "spc_chennai_tnagar_01",
    "arrivalProbability": 86.4,
    "confidenceScore": 0.91,
    "estimatedAvailableSlots": 3,
    "demandTier": "PEAK_SHOPPING",
    "contextualFactors": [
      "Weekend afternoon retail surge in T. Nagar",
      "No severe rain forecast",
      "Zero road closures reported on Burkit Road"
    ]
  }
  ```
* **Tools Needed**:
  - `HistoricalOccupancyQueryTool` (DynamoDB timeseries & S3 Athena data lake)
  - `LiveSensorQueryTool` (Current ultrasonic / camera sensor states)
  - `CityContextTool` (Local event schedule: cricket matches, festivals, weather forecasts)
  - `SageMakerInferenceTool` (Time-series ML prediction endpoint)
* **Hand-off Trigger**: Streams predictions to `SearchService` and sends demand tier updates to `DynamicPricingAgent`.
* **Failure Handling**: Falls back to deterministic rule-based heuristic (`1 / demandMultiplier` with duration penalty) if SageMaker model latency exceeds 150ms.

---

### 2.4 `DynamicPricingAgent`
* **Role**: Continuously optimizes pricing per micro-zone to balance marketplace liquidity, prevent curbside flooding, and maximize host earnings.
* **Input Contract**:
  ```json
  {
    "spaceId": "spc_chennai_tnagar_01",
    "baseHourlyRate": 40.0,
    "currentOccupancyRate": 0.83,
    "demandForecastTier": "PEAK_SHOPPING",
    "hostPricingPreferences": { "allowDynamic": true, "maxMultiplier": 1.5 }
  }
  ```
* **Output Contract**:
  ```json
  {
    "spaceId": "spc_chennai_tnagar_01",
    "calculatedHourlyRate": 56.0,
    "appliedMultiplier": 1.4,
    "surgeReason": "T. Nagar festive shopping demand",
    "effectiveFrom": "2026-09-05T15:00:00Z",
    "effectiveUntil": "2026-09-05T18:00:00Z"
  }
  ```
* **Tools Needed**:
  - `PricingRulesEngineTool` (Evaluates host min/max bounds and city caps)
  - `CompetitorCurbsideRateTool` (Compares with municipal off-street parking rates)
  - `DatabasePricingUpdateTool` (Writes active pricing cache)
* **Hand-off Trigger**: Emits `Pricing.Updated` to invalidate search cache in Redis/DynamoDB.
* **Failure Handling**: Invariant safety guard: Calculated price must never fall below `baseHourlyRate` and must never exceed `maxMultiplier * baseHourlyRate`.

---

### 2.5 `DriverConciergeAgent`
* **Role**: Serves as the conversational driver companion, handling multimodal search, reservation hold, smart re-routing, and gate entry assistance.
* **Input Contract**:
  ```json
  {
    "driverId": "usr_77189b",
    "query": "Find me covered parking near Pothys T. Nagar for 2 hours, budget under 60/hr",
    "currentLocation": { "latitude": 13.0401, "longitude": 80.2330 }
  }
  ```
* **Output Contract**:
  ```json
  {
    "action": "PRESENT_RECOMMENDATION",
    "recommendedSpace": {
      "id": "spc_chennai_tnagar_01",
      "name": "Burkit Road Gated Covered Parking",
      "distanceMeters": 280,
      "walkingTimeMinutes": 3,
      "hourlyRate": 56.0,
      "arrivalProbability": 86.4
    },
    "turnByTurnDeepLink": "https://maps.google.com/?daddr=13.0382,80.2314",
    "entryInstructions": "Show the in-app QR code to the watchman or use gate pin #4412."
  }
  ```
* **Tools Needed**:
  - `SearchServiceAPITool` (Geospatial search with ranking scores)
  - `BookingServiceAPITool` (Provisional hold initiation)
  - `LiveTrafficMonitorTool` (Google Routes / Mapbox Matrix API for driver ETA monitoring)
* **Hand-off Trigger**: On driver confirmation, invokes `BookingService` and monitors travel trajectory. If ETA delay causes slot risk, offers 1-tap booking extension.
* **Failure Handling**: If driver arrives and gate is inaccessible, instantly relocates driver to the nearest pre-vetted backup bay within 200m with zero penalty.

---

### 2.6 `DisputeMediationAgent` (Fraud Sentinel)
* **Role**: Autonomous arbitration for parking conflicts (overstay, unauthorized vehicles, blocked driveways, host no-shows).
* **Input Contract**:
  ```json
  {
    "disputeId": "dsp_1092aa",
    "bookingId": "bkg_7718aa09",
    "incidentType": "OVERSTAY_REPORTED",
    "reportedBy": "host_4810ac",
    "evidence": {
      "hostTimestamp": "2026-09-05T17:30:00Z",
      "expectedEndTime": "2026-09-05T16:00:00Z",
      "sensorDetectedDeparture": null
    }
  }
  ```
* **Output Contract**:
  ```json
  {
    "disputeId": "dsp_1092aa",
    "adjudication": "OVERSTAY_CONFIRMED",
    "actionsTaken": [
      { "action": "CHARGE_OVERSTAY_PENALTY", "amount": 120.0, "recipient": "host" },
      { "action": "SEND_SMS_WARNING", "recipient": "driver", "urgency": "HIGH" },
      { "action": "NOTIFY_TOWING_SERVICE", "triggered": false }
    ],
    "hostCompensationAmount": 100.0,
    "platformAuditLog": "Driver exceeded booking window by 90 minutes. Telematics verify vehicle present."
  }
  ```
* **Tools Needed**:
  - `SensorVerificationTool` (Cross-checks ultrasonic/ANPR logs)
  - `PaymentLedgerTool` (Escrow hold, automatic penalty charging, refund distribution)
  - `NotificationDispatcherTool` (SMS/push alerts to driver and host)
* **Hand-off Trigger**: Emits `Dispute.Resolved` or escalates to human operations if disputed amount > ₹1,000.
* **Failure Handling**: Fail-safe escrow hold; freezes questionable payouts until human administrator reviews camera snapshot.

---

### 2.7 `CityAnalyticsAgent`
* **Role**: Aggregates macro mobility data to generate intelligence reports for Municipal Corporations, Smart City authorities, and urban planners.
* **Input Contract**:
  ```json
  {
    "cityId": "chennai",
    "period": "2026-W36",
    "zones": ["T_NAGAR", "OMR_PHASE1", "ANNA_NAGAR"]
  }
  ```
* **Output Contract**:
  ```json
  {
    "cityId": "chennai",
    "reportGeneratedAt": "2026-09-05T09:00:00Z",
    "metrics": {
      "totalOffStreetHoursProvided": 48200,
      "estimatedCurbsideCruisingReducedMinutes": 184000,
      "estimatedCO2AbatedKg": 4210.5,
      "unmetDemandChokePoints": [
        { "intersection": "Panagal Park / Usman Rd", "unsatisfiedSearches": 1420 }
      ]
    },
    "recommendation": "Encourage RWA off-street parking enrollment on Burkit and Venkatnarayana roads to absorb shopping overflow."
  }
  ```
* **Tools Needed**:
  - `AthenaQueryTool` (SQL over S3 Parquet data lake)
  - `ReportCompilerTool` (Generates executive PDF summaries and GeoJSON maps)
  - `EmailDispatcherTool` (Dispatches weekly intelligence to GCC / Traffic Police officials)
* **Hand-off Trigger**: Scheduled cron execution every Monday at 06:00 AM IST.

---

### 2.8 `ParklyOrchestratorAgent`
* **Role**: The centralized workflow governor that routes asynchronous domain events, manages retries, enforces dead-letter handling, and maintains overall state consistency.
* **Responsibilities**:
  1. Listens to domain events on Amazon EventBridge.
  2. Spawns and supervises worker sub-agents with strict timeout boundaries (5000ms max execution).
  3. Maintains a persistent distributed saga execution log in DynamoDB.
  4. Manages circuit breakers for external third-party tools (e.g., if Google Maps API throttles, redirects queries to Mapbox or cached Geohash centroids).

---

## 3. Communication Architecture: Event-Driven vs. Direct RPC

### 3.1 Comparison Matrix

| Architectural Dimension | Direct RPC (gRPC / HTTP REST) | Event-Driven Message Queue (EventBridge / SQS) |
|---|---|---|
| **Coupling** | **Tight**: Caller must know target endpoint, protocol, and availability. | **Loose**: Producers publish domain events without knowing downstream consumers. |
| **Resilience & Fault Isolation**| **Fragile**: If `VisualInspectionAgent` is down, host onboarding crashes. | **High**: Events persist in queue. If an agent fails, events wait safely without loss. |
| **Latency** | **Low (Immediate)**: Synchronous response (50–200ms). | **Asynchronous**: Sub-second event delivery, but eventual consistency. |
| **Scalability & Backpressure** | **Prone to cascading failure** under traffic spikes. | **Elastic**: Consumers process at their own rate with DLQs (Dead-Letter Queues). |
| **Auditability & Replayability** | **Difficult**: Requires distributed distributed tracing across all hops. | **Native**: Event logs in S3/EventBridge Archive allow replaying past incidents. |

---

### 3.2 Recommended Architectural Paradigm: Hybrid Choreography

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                            HYBRID DUAL PATTERN                              │
├──────────────────────────────────────┬──────────────────────────────────────┤
│ 1. Synchronous Direct RPC (HTTP/REST)│ For critical, sub-second, driver-    │
│    Fastify / API Gateway             │ facing transactions (e.g., Search,   │
│                                      │ Slot Lock hold, Payment initiation)  │
├──────────────────────────────────────┼──────────────────────────────────────┤
│ 2. Asynchronous Event-Driven Bus     │ For all inter-agent choreography,    │
│    Amazon EventBridge + SQS          │ image analysis, predictive modeling, │
│                                      │ dispute resolution, and analytics    │
└──────────────────────────────────────┴──────────────────────────────────────┘
```

### 3.3 Justification for Parkly
1. **Driver Experience Demands Sub-Second Sync Responses**: When a driver clicks "Search" or "Reserve Now", they cannot wait for an asynchronous message queue round-trip. The initial slot availability and reservation hold MUST happen synchronously via atomic database RPC.
2. **Background Automation Demands Asynchronous Queuing**: Visual photo inspection, document OCR, historical ML retraining, dynamic pricing updates, and municipal report compilation are heavy, asynchronous tasks. Using EventBridge + SQS guarantees:
   - **Zero impact on driver booking latency**.
   - **Infinite horizontal scaling** during Chennai rush hours or festival shopping surges.
   - **Zero lost data**: If an external LLM or vision tool experiences rate limiting, the event remains in the SQS dead-letter queue with automated exponential backoff retry.
