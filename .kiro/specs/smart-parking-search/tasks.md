# Implementation Plan: Smart Parking Search

## Overview

This plan implements the Smart Parking Search feature as a set of TypeScript microservice components: Search Service (orchestrator), Geolocation Service, Prediction Engine, Spatial Index Manager, and Region Configuration Service. The implementation follows an incremental approach — starting with data models and validation, then building core services, and finally wiring them together with ranking, pagination, and error handling.

## Tasks

- [ ] 1. Set up project structure and core data models
  - [ ] 1.1 Create project directory structure and configuration
    - Create `services/search-service/` directory with `src/`, `tests/property/`, `tests/unit/`, `tests/integration/` subdirectories
    - Initialize TypeScript project with `tsconfig.json`, `package.json`
    - Install dependencies: `fast-check`, `vitest`, and type definitions
    - Create `src/models/` directory for all data model interfaces
    - _Requirements: 9.1, 9.2_

  - [ ] 1.2 Implement core data model interfaces and types
    - Create `src/models/search-query.ts` with `SearchQuery`, `LocationInput`, `FilterSet`, `VehicleType`, `SecurityLevel`, `AccessibilityFeature` types
    - Create `src/models/search-response.ts` with `SearchResponse`, `ParkingSpaceResult`, `PaginationInfo`, `SearchMeta`, `AlternativeSpace` interfaces
    - Create `src/models/parking-space.ts` with `ParkingSpace`, `Coordinates`, `Region`, `TimeSlot` interfaces
    - Create `src/models/prediction.ts` with `AvailabilityPrediction` interface
    - Create `src/models/errors.ts` with `ErrorResponse`, `ValidationError`, `GeoResolutionError` types
    - _Requirements: 1.5, 5.1, 5.2, 5.3, 7.1, 9.2_

  - [ ] 1.3 Implement SearchQuery JSON parser and serializer
    - Create `src/parsers/query-parser.ts` with `parseQuery(raw: string): Result<SearchQuery, ValidationError>` function
    - Implement `serializeQuery(query: SearchQuery): string` function
    - Handle JSON parse errors with character position reporting
    - Enforce 64 KB payload size limit
    - Treat absent optional fields as explicitly unset (not null or default)
    - Detect and report missing required fields (location, arrivalTime) by name
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7_

  - [ ]* 1.4 Write property test for SearchQuery round-trip serialization
    - **Property 1: Search Query Serialization Round-Trip**
    - Generate arbitrary valid SearchQuery objects with all combinations of optional fields
    - Assert: `parseQuery(serializeQuery(query))` produces identical values for all present fields
    - **Validates: Requirements 7.1, 7.2, 7.3**

  - [ ]* 1.5 Write property tests for malformed JSON and missing fields
    - **Property 17: Malformed JSON Error Detail**
    - Generate random invalid JSON strings and assert error response contains field name or character position
    - **Property 18: Missing Required Fields Error**
    - Generate JSON objects with random subsets of required fields removed, assert all missing fields listed
    - **Property 19: Payload Size Rejection**
    - Generate payloads exceeding 64 KB, assert rejection with appropriate error
    - **Property 20: Optional Field Unset Semantics**
    - Generate valid JSON with random optional fields omitted, assert fields treated as unset
    - **Validates: Requirements 7.4, 7.5, 7.6, 7.7**

- [ ] 2. Implement input validation layer
  - [ ] 2.1 Implement location input validation
    - Create `src/validators/location-validator.ts`
    - Validate text inputs are at most 200 characters
    - Validate latitude is in [-90, 90] and longitude is in [-180, 180]
    - Return specific validation failure messages for each constraint violation
    - _Requirements: 1.5, 1.6_

  - [ ]* 2.2 Write property test for location input validation
    - **Property 2: Location Input Validation**
    - Generate strings of varying length (0-500 chars) and random coordinate pairs
    - Assert: acceptance if and only if text ≤ 200 chars, lat in [-90,90], lng in [-180,180]
    - **Validates: Requirements 1.5, 1.6**

  - [ ] 2.3 Implement arrival time validation
    - Create `src/validators/time-validator.ts`
    - Accept arrival times from current time up to 7 days in the future (inclusive)
    - Reject times in the past or more than 7 days ahead with error indicating valid range
    - _Requirements: 2.5, 2.6_

  - [ ] 2.4 Implement duration validation
    - Add duration validation to `src/validators/time-validator.ts`
    - Accept durations between 15 minutes and 72 hours (4320 minutes) inclusive
    - Reject durations outside range with error indicating valid range
    - _Requirements: 2.7_

  - [ ]* 2.5 Write property tests for time and duration validation
    - **Property 5: Arrival Time Validation**
    - Generate random DateTimes, assert acceptance iff within [now, now + 7 days]
    - **Property 6: Duration Validation**
    - Generate random integers, assert acceptance iff within [15, 4320] minutes
    - **Validates: Requirements 2.5, 2.6, 2.7**

  - [ ] 2.6 Implement query validation orchestrator
    - Create `src/validators/query-validator.ts` with `validateQuery(query: SearchQuery): Result<SearchQuery, ValidationError[]>`
    - Compose location, time, and duration validators
    - Collect all validation errors before returning (do not fail on first error)
    - _Requirements: 1.6, 2.6, 2.7, 7.4, 7.5_

- [ ] 3. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 4. Implement Geolocation Service
  - [ ] 4.1 Implement Geolocation Service interface and core logic
    - Create `src/services/geolocation-service.ts`
    - Implement `geocode(input: string): Promise<Result<Coordinates, GeoResolutionError>>`
    - Implement `resolveLandmark(name: string, cityIds: string[]): Promise<Result<Coordinates, GeoResolutionError>>`
    - Implement `suggestAlternatives(input: string, limit: number): Promise<LocationSuggestion[]>` (up to 5 suggestions)
    - Return error with original input text and suggestions when resolution fails
    - _Requirements: 1.1, 1.3, 1.4_

  - [ ]* 4.2 Write property test for geo-resolution error format
    - **Property 4: Geo-Resolution Error Format**
    - Generate arbitrary location inputs that cannot be resolved
    - Assert: error contains original unresolved input text and at most 5 alternative suggestions
    - **Validates: Requirements 1.4**

  - [ ]* 4.3 Write unit tests for Geolocation Service
    - Test geocoding resolves known addresses within 500ms
    - Test landmark resolution against registered database
    - Test error response format with suggestion alternatives
    - _Requirements: 1.1, 1.3, 1.4_

- [ ] 5. Implement Spatial Index Manager and Region Configuration
  - [ ] 5.1 Implement Region Configuration Service
    - Create `src/services/region-config-service.ts`
    - Implement `getRegionForCoordinates(coords: Coordinates): Promise<Region | null>`
    - Implement `getAdjacentRegions(regionId: string): Promise<Region[]>`
    - Support dynamic region addition through configuration data
    - _Requirements: 8.1, 8.2, 8.3_

  - [ ] 5.2 Implement Spatial Index Manager
    - Create `src/services/spatial-index-manager.ts`
    - Implement geohash-based spatial indexing with configurable precision
    - Implement `query(geohashPrefix: string[], filters?: SpatialFilter): Promise<ParkingSpaceRef[]>`
    - Implement `getAdjacentCells(geohash: string, precision: number): string[]` for cross-boundary queries
    - Support proximity lookups across region boundaries
    - _Requirements: 8.4, 8.5_

  - [ ]* 5.3 Write property test for cross-boundary inclusion
    - **Property 21: Cross-Boundary Inclusion**
    - Generate search coordinates near region boundaries with radii extending into adjacent regions
    - Assert: results include ParkingSpace entries from adjacent regions within the specified radius
    - **Validates: Requirements 8.5**

- [ ] 6. Implement filtering engine
  - [ ] 6.1 Implement individual filter functions
    - Create `src/filters/filter-engine.ts`
    - Implement price range filter (min ≥ 0.01, max ≤ 999,999.99)
    - Implement vehicle type filter (set membership check)
    - Implement EV charging filter (boolean match)
    - Implement covered parking filter (boolean match)
    - Implement security level filter (ordinal comparison: none < basic < monitored < staffed < gated)
    - Implement accessibility features filter (set containment — all selected features must be present)
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6_

  - [ ] 6.2 Implement composite filter application with AND logic
    - Add `applyFilters(spaces: ParkingSpace[], filters: FilterSet): ParkingSpace[]` function
    - Apply all active filters using logical AND conjunction
    - Return empty array with indication when no spaces match
    - _Requirements: 3.7, 3.8_

  - [ ]* 6.3 Write property tests for filter correctness
    - **Property 9: Individual Filter Correctness**
    - Generate random FilterSets (single criterion) and ParkingSpace arrays
    - Assert: all entries in filtered results satisfy the specified filter condition
    - **Property 10: Filter Conjunction**
    - Generate multi-filter sets, compare result of applying all filters simultaneously with intersection of individual filter results
    - **Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7**

  - [ ] 6.3 Implement time-based constraint filtering
    - Create `src/filters/time-filter.ts`
    - Implement `applyTimeConstraints(spaces: ParkingSpace[], arrival: DateTime, duration: Duration): ParkingSpace[]`
    - Filter spaces whose availability schedules can accommodate the full requested duration at arrival time
    - Apply availability threshold filtering (configurable, default 70%)
    - _Requirements: 2.1, 2.2_

  - [ ]* 6.4 Write property tests for time-based filtering
    - **Property 7: Availability Threshold Filtering**
    - Generate spaces with random predictions and thresholds, assert all results meet threshold
    - **Property 8: Duration Accommodation Filtering**
    - Generate queries with valid durations, assert all result spaces can accommodate the full duration
    - **Validates: Requirements 2.1, 2.2**

- [ ] 7. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 8. Implement Prediction Engine integration
  - [ ] 8.1 Implement Prediction Engine interface and client
    - Create `src/services/prediction-engine.ts`
    - Implement `predict(spaceIds: string[], arrivalTime: DateTime, duration: Duration): Promise<Map<string, AvailabilityPrediction>>`
    - Implement `suggestAlternatives(spaceId: string, threshold: number, limit: number): Promise<AlternativeSpace[]>`
    - Enforce bounds: probability [0,100], vacancies non-negative ≤ capacity, confidence [0,100]
    - Handle insufficient data case: confidence = 0, insufficientData = true
    - Generate up to 3 alternatives when confidence below threshold
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7_

  - [ ]* 8.2 Write property tests for prediction bounds and alternatives
    - **Property 11: Prediction Bounds Invariant**
    - Generate random prediction outputs, assert probability in [0,100], vacancies ≤ capacity, confidence in [0,100]
    - **Property 12: Low-Confidence Alternatives**
    - Generate spaces with confidence below threshold, assert at most 3 alternatives each with confidence ≥ threshold
    - **Property 13: Insufficient Data Indication**
    - Generate spaces with insufficient data, assert confidence = 0 and insufficientData = true
    - **Validates: Requirements 4.2, 4.3, 4.4, 4.5, 4.7**

- [ ] 9. Implement ranking and pagination
  - [ ] 9.1 Implement composite ranking algorithm
    - Create `src/ranking/ranker.ts`
    - Implement `rankResults(spaces: ParkingSpace[], predictions: Map<string, AvailabilityPrediction>, origin: Coordinates): RankedResult[]`
    - Apply weights: distance (0.35), availability (0.35), price (0.15), confidence (0.15)
    - Normalize each factor to [0,1] range
    - Implement graceful degradation ranking (distance + price only when predictions unavailable)
    - Sort results in descending composite score order
    - _Requirements: 5.4, 6.4_

  - [ ]* 9.2 Write property test for ranking monotonicity
    - **Property 15: Ranking Monotonicity**
    - Generate random scored results, assert each adjacent pair has first.score ≥ second.score
    - **Validates: Requirements 5.4**

  - [ ] 9.3 Implement pagination
    - Create `src/pagination/paginator.ts`
    - Implement `paginate(results: RankedResult[], page: number, pageSize: number): PaginatedResponse`
    - Enforce page size bounds [5, 100], default 20
    - Calculate totalResults, totalPages
    - Handle edge cases: page beyond results, empty results
    - _Requirements: 6.2_

  - [ ]* 9.4 Write property test for pagination bounds
    - **Property 16: Pagination Bounds**
    - Generate random result sets and page parameters in [5,100]
    - Assert: each page has at most pageSize entries, total entries across pages equals total results
    - **Validates: Requirements 6.2**

- [ ] 10. Implement Search Service orchestrator
  - [ ] 10.1 Implement Search Service main pipeline
    - Create `src/services/search-service.ts`
    - Implement `search(query: SearchQuery): Promise<SearchResponse>` as the main entry point
    - Orchestrate: validate → geocode → spatial query → filter → predict → rank → paginate
    - Apply defaults: current time for omitted arrival, 1 hour for omitted duration, 2 km radius
    - Include `meta.predictionStatus` field ('available' | 'unavailable' | 'degraded')
    - Include `meta.appliedDefaults` listing fields that used defaults
    - Include API version in response
    - _Requirements: 2.3, 2.4, 5.1, 5.4, 5.5, 5.6, 6.4, 9.2_

  - [ ] 10.2 Implement candidate finding with radius constraint
    - Add `findCandidates(coords: Coordinates, radius: number, regionId: string): Promise<ParkingSpace[]>` to Search Service
    - Use Spatial Index Manager for geohash-based proximity lookup
    - Include adjacent geohash cells for boundary queries
    - Filter results to only include spaces within the specified radius
    - _Requirements: 1.2, 8.5_

  - [ ]* 10.3 Write property test for radius constraint
    - **Property 3: Radius Constraint**
    - Generate random coordinates, spaces, and radii
    - Assert: all entries in results have distance from origin ≤ search radius
    - **Validates: Requirements 1.2**

- [ ] 11. Implement error handling and HTTP response formatting
  - [ ] 11.1 Implement error response formatting
    - Create `src/errors/error-handler.ts`
    - Format 400 errors with machine-readable code, message, and field/position
    - Format 429 errors with retry_after_seconds value
    - Format 503 errors with machine-readable code and message
    - Implement graceful degradation: return results without predictions when Prediction Engine unavailable
    - _Requirements: 6.4, 6.5, 9.3, 9.5_

  - [ ]* 11.2 Write property test for error response completeness
    - **Property 22: Error Response Completeness**
    - Generate error responses for 400, 429, 503 statuses
    - Assert: all contain machine-readable code and human-readable message; 429 includes retry_after_seconds
    - **Validates: Requirements 9.5**

  - [ ]* 11.3 Write unit tests for error handling and degraded mode
    - Test Prediction Engine unavailable returns results with degraded status
    - Test 429 includes Retry-After header and retry_after_seconds in body
    - Test empty results return indication message
    - Test default values applied correctly (arrival time, duration)
    - Test view toggle support (single response serves both Map and List views)
    - _Requirements: 2.3, 2.4, 3.8, 5.5, 5.6, 6.4, 9.3_

- [ ] 12. Implement API route handler and rate limiting
  - [ ] 12.1 Implement REST API endpoint
    - Create `src/api/search-route.ts`
    - Implement `POST /api/v1/search` endpoint
    - Wire request validation, Search Service invocation, and response serialization
    - Implement rate limiting (100 requests/min per consumer) with 429 + Retry-After header
    - Return appropriate HTTP status codes (200, 400, 429, 503)
    - _Requirements: 9.1, 9.3, 9.5_

  - [ ]* 12.2 Write unit tests for API route handler
    - Test successful search returns 200 with correct response structure
    - Test invalid query returns 400 with field-level errors
    - Test rate limiting returns 429 with retry_after_seconds
    - Test HTTP status codes used correctly
    - _Requirements: 9.3, 9.5_

- [ ] 13. Wire all components and implement response completeness
  - [ ] 13.1 Wire all services together and verify end-to-end flow
    - Create `src/index.ts` as the service entry point
    - Wire dependency injection for all services (SearchService, GeolocationService, PredictionEngine, SpatialIndexManager, RegionConfigService)
    - Implement health endpoint
    - Verify complete request flow from API endpoint through all services
    - _Requirements: 5.1, 9.1_

  - [ ]* 13.2 Write property test for response completeness
    - **Property 14: Response Completeness**
    - Generate search results and assert each ParkingSpaceResult contains all required fields: id, name, coordinates, distance, price, availability, amenities, and response includes version
    - **Validates: Requirements 5.1, 5.2, 5.3, 9.2**

  - [ ]* 13.3 Write integration tests for end-to-end search flow
    - Test complete search flow with all services wired
    - Test graceful degradation when Prediction Engine unavailable
    - Test cross-region boundary searches
    - Test new region activation within 5 minutes of config change
    - _Requirements: 1.1, 6.1, 6.4, 8.3, 8.5_

- [ ] 14. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document
- Unit tests validate specific examples and edge cases
- All code uses TypeScript with fast-check for property-based testing and vitest as the test runner
- The implementation follows the microservice architecture defined in the design document

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["1.2"] },
    { "id": 2, "tasks": ["1.3", "5.1"] },
    { "id": 3, "tasks": ["1.4", "1.5", "2.1", "2.3", "2.4"] },
    { "id": 4, "tasks": ["2.2", "2.5", "2.6", "5.2"] },
    { "id": 5, "tasks": ["4.1", "5.3", "6.1"] },
    { "id": 6, "tasks": ["4.2", "4.3", "6.2", "6.3"] },
    { "id": 7, "tasks": ["6.4", "8.1"] },
    { "id": 8, "tasks": ["8.2", "9.1"] },
    { "id": 9, "tasks": ["9.2", "9.3"] },
    { "id": 10, "tasks": ["9.4", "10.1"] },
    { "id": 11, "tasks": ["10.2", "11.1"] },
    { "id": 12, "tasks": ["10.3", "11.2", "11.3", "12.1"] },
    { "id": 13, "tasks": ["12.2", "13.1"] },
    { "id": 14, "tasks": ["13.2", "13.3"] }
  ]
}
```
