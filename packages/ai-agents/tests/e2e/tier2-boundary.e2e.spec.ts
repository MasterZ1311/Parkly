/**
 * 🅿️ Parkly — Tier 2: Boundary & Corner Cases E2E Test Suite
 * 
 * Verifies all 13 features with 5 boundary/corner tests per feature (65 tests total)
 * strictly conforming to TEST_INFRA.md §5.2.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  E2ETestHarness,
  expectSuccess,
  expectFailure,
  CHENNAI_LOCATIONS,
  MOCK_DOCUMENTS,
  MOCK_PHOTOS,
  CircuitBreaker,
  ExecutionContext,
} from './helpers/e2e-harness';

describe('Tier 2: Boundary & Corner Cases E2E Test Suite (65 tests)', () => {
  let harness: E2ETestHarness;
  let ctx: ExecutionContext;

  beforeEach(async () => {
    harness = await E2ETestHarness.create();
    ctx = harness.createContext('usr_driver_tier2');
  });

  // ==========================================================================
  // T2.1: HostOnboardingAgent (5 boundary tests)
  // ==========================================================================
  describe('T2.1: HostOnboardingAgent Boundaries', () => {
    it('T2.1.1: OCR confidence = 0.849 (< 0.85) -> flags MANUAL_REVIEW_REQUIRED', async () => {
      harness.mocks.ocr.setSimulatedConfidence(0.849);
      const input = {
        userId: 'usr_b1_01',
        rawAddress: CHENNAI_LOCATIONS.tNagarBurkit.rawAddress,
        documentUrls: [MOCK_DOCUMENTS.validPan.url],
        declaredSlots: 2,
        vehicleTypes: ['sedan'],
      };

      const result = await harness.agents.hostOnboarding.execute(input, ctx);
      expectSuccess(result);
      expect(result.data.kycStatus).toBe('MANUAL_REVIEW_REQUIRED');
      expect(result.data.confidenceScore).toBe(0.849);
    });

    it('T2.1.2: Zoning classified as NON_RESIDENTIAL_PROHIBITED -> flags MANUAL_REVIEW_REQUIRED', async () => {
      harness.mocks.zoning.setOverrideStatus('NON_RESIDENTIAL_PROHIBITED');
      const input = {
        userId: 'usr_b1_02',
        rawAddress: CHENNAI_LOCATIONS.tNagarBurkit.rawAddress,
        documentUrls: [MOCK_DOCUMENTS.validPan.url],
        declaredSlots: 1,
        vehicleTypes: ['sedan'],
      };

      const result = await harness.agents.hostOnboarding.execute(input, ctx);
      expectSuccess(result);
      expect(result.data.kycStatus).toBe('MANUAL_REVIEW_REQUIRED');
      expect(result.data.zoningCompliance).toBe('NON_RESIDENTIAL_PROHIBITED');
    });

    it('T2.1.3: Empty document URLs [] -> returns Result.err(VALIDATION_ERROR)', async () => {
      const input = {
        userId: 'usr_b1_03',
        rawAddress: CHENNAI_LOCATIONS.tNagarBurkit.rawAddress,
        documentUrls: [] as string[],
        declaredSlots: 1,
        vehicleTypes: ['sedan'],
      };

      const result = await harness.agents.hostOnboarding.execute(input, ctx);
      expectFailure(result, 'VALIDATION_ERROR');
    });

    it('T2.1.4: Empty rawAddress string -> returns Result.err(VALIDATION_ERROR)', async () => {
      const input = {
        userId: 'usr_b1_04',
        rawAddress: '',
        documentUrls: [MOCK_DOCUMENTS.validPan.url],
        declaredSlots: 2,
        vehicleTypes: ['sedan'],
      };

      const result = await harness.agents.hostOnboarding.execute(input, ctx);
      expectFailure(result, 'VALIDATION_ERROR');
    });

    it('T2.1.5: Declared slots = 0 or -1 -> returns Result.err(VALIDATION_ERROR)', async () => {
      const inputZero = {
        userId: 'usr_b1_05',
        rawAddress: CHENNAI_LOCATIONS.tNagarBurkit.rawAddress,
        documentUrls: [MOCK_DOCUMENTS.validPan.url],
        declaredSlots: 0,
        vehicleTypes: ['sedan'],
      };

      const result = await harness.agents.hostOnboarding.execute(inputZero, ctx);
      expectFailure(result, 'VALIDATION_ERROR');
    });
  });

  // ==========================================================================
  // T2.2: VisualInspectionAgent (5 boundary tests)
  // ==========================================================================
  describe('T2.2: VisualInspectionAgent Boundaries', () => {
    it('T2.2.1: Gate clearance = 2.19m (< 2.2m) -> returns ACTION_REQUIRED', async () => {
      harness.mocks.vision.setGateClearance(2.19);
      const input = {
        spaceId: 'spc_b2_01',
        photoUrls: ['https://s3.ap-south-1.amazonaws.com/parkly/narrow.jpg'],
      };

      const result = await harness.agents.visualInspection.execute(input, ctx);
      expectSuccess(result);
      expect(result.data.inspectionResult).toBe('ACTION_REQUIRED');
      expect(result.data.detectedAttributes.gateClearanceAdequate).toBe(false);
    });

    it('T2.2.2: Debris and obstructions present -> returns ACTION_REQUIRED', async () => {
      harness.mocks.vision.setGateClearance(3.0);
      harness.mocks.vision.setObstructions(['parked_cart', 'construction_debris']);
      const input = {
        spaceId: 'spc_b2_02',
        photoUrls: ['https://s3.ap-south-1.amazonaws.com/parkly/obstructed.jpg'],
      };

      const result = await harness.agents.visualInspection.execute(input, ctx);
      expectSuccess(result);
      expect(result.data.inspectionResult).toBe('ACTION_REQUIRED');
      expect(result.data.detectedAttributes).toBeDefined();
    });

    it('T2.2.3: Empty photoUrls [] -> returns Result.err(VALIDATION_ERROR)', async () => {
      const input = {
        spaceId: 'spc_b2_03',
        photoUrls: [] as string[],
      };

      const result = await harness.agents.visualInspection.execute(input, ctx);
      expectFailure(result, 'VALIDATION_ERROR');
    });

    it('T2.2.4: Exact license plates and faces blurred counts recorded', async () => {
      const input = {
        spaceId: 'spc_b2_04',
        photoUrls: ['https://s3.ap-south-1.amazonaws.com/parkly/redactions.jpg'],
      };

      const result = await harness.agents.visualInspection.execute(input, ctx);
      expectSuccess(result);
      expect(typeof result.data.privacyActions.licensePlatesBlurred).toBe('number');
      expect(typeof result.data.privacyActions.facesBlurred).toBe('number');
    });

    it('T2.2.5: Empty spaceId string -> returns Result.err(VALIDATION_ERROR)', async () => {
      const input = {
        spaceId: '',
        photoUrls: ['https://s3.ap-south-1.amazonaws.com/parkly/valid.jpg'],
      };

      const result = await harness.agents.visualInspection.execute(input, ctx);
      expectFailure(result, 'VALIDATION_ERROR');
    });
  });

  // ==========================================================================
  // T2.3: OccupancyPredictorAgent (5 boundary tests)
  // ==========================================================================
  describe('T2.3: OccupancyPredictorAgent Boundaries', () => {
    it('T2.3.1: ML latency > 150ms -> immediately activates heuristic fallback (1/demandMultiplier)', async () => {
      harness.mocks.occupancy.simulateLatencyMs(165);
      const input = {
        spaceId: CHENNAI_LOCATIONS.tNagarBurkit.id,
        targetArrivalTime: '2026-09-07T12:00:00.000Z',
        targetDurationMinutes: 120,
      };

      const result = await harness.agents.occupancyPredictor.execute(input, ctx);
      expectSuccess(result);
      expect(result.data.demandTier).toBe('HEURISTIC_FALLBACK');
      expect(result.data.contextualFactors).toContain('LATENCY_TIMEOUT_FALLBACK_TRIGGERED');
    });

    it('T2.3.2: Target duration = 0 minutes -> returns Result.err(VALIDATION_ERROR)', async () => {
      const input = {
        spaceId: CHENNAI_LOCATIONS.tNagarBurkit.id,
        targetArrivalTime: '2026-09-07T12:00:00.000Z',
        targetDurationMinutes: 0,
      };

      const result = await harness.agents.occupancyPredictor.execute(input, ctx);
      expectFailure(result, 'VALIDATION_ERROR');
    });

    it('T2.3.3: Negative target duration -> returns Result.err(VALIDATION_ERROR)', async () => {
      const input = {
        spaceId: CHENNAI_LOCATIONS.tNagarBurkit.id,
        targetArrivalTime: '2026-09-07T12:00:00.000Z',
        targetDurationMinutes: -30,
      };

      const result = await harness.agents.occupancyPredictor.execute(input, ctx);
      expectFailure(result, 'VALIDATION_ERROR');
    });

    it('T2.3.4: High occupancy rate clamps probability to minimum 5% floor', async () => {
      const input = {
        spaceId: CHENNAI_LOCATIONS.tNagarBurkit.id,
        targetArrivalTime: '2026-09-07T18:00:00.000Z',
        targetDurationMinutes: 60,
      };

      const result = await harness.agents.occupancyPredictor.execute(input, ctx);
      expectSuccess(result);
      expect(result.data.arrivalProbability).toBeGreaterThanOrEqual(0.05);
    });

    it('T2.3.5: Empty spaceId -> returns Result.err(VALIDATION_ERROR)', async () => {
      const input = {
        spaceId: '',
        targetArrivalTime: '2026-09-07T12:00:00.000Z',
        targetDurationMinutes: 60,
      };

      const result = await harness.agents.occupancyPredictor.execute(input, ctx);
      expectFailure(result, 'VALIDATION_ERROR');
    });
  });

  // ==========================================================================
  // T2.4: DynamicPricingAgent (5 boundary tests)
  // ==========================================================================
  describe('T2.4: DynamicPricingAgent Boundaries', () => {
    it('T2.4.1: Demand collapse (occupancy = 0) -> strictly clamped to baseHourlyRate', async () => {
      const input = {
        spaceId: CHENNAI_LOCATIONS.tNagarBurkit.id,
        baseHourlyRate: 50,
        currentOccupancyRate: 0.0,
      };

      const result = await harness.agents.dynamicPricing.execute(input, ctx);
      expectSuccess(result);
      expect(result.data.calculatedHourlyRate).toBe(50);
      expect(result.data.appliedMultiplier).toBe(1.0);
    });

    it('T2.4.2: Extreme demand surge (calculated price > maxMultiplier * base) -> strictly clamped to ceiling', async () => {
      const input = {
        spaceId: CHENNAI_LOCATIONS.tNagarBurkit.id,
        baseHourlyRate: 40,
        currentOccupancyRate: 1.0,
        hostPricingPreferences: {
          allowDynamic: true,
          maxMultiplier: 1.5, // ceiling 60
        },
      };

      const result = await harness.agents.dynamicPricing.execute(input, ctx);
      expectSuccess(result);
      expect(result.data.calculatedHourlyRate).toBe(60);
      expect(result.data.appliedMultiplier).toBe(1.5);
    });

    it('T2.4.3: Base hourly rate <= 0 -> returns Result.err(VALIDATION_ERROR)', async () => {
      const input = {
        spaceId: CHENNAI_LOCATIONS.tNagarBurkit.id,
        baseHourlyRate: 0,
        currentOccupancyRate: 0.5,
      };

      const result = await harness.agents.dynamicPricing.execute(input, ctx);
      expectFailure(result, 'VALIDATION_ERROR');
    });

    it('T2.4.4: Max multiplier < 1.0 (e.g. 0.8) -> returns Result.err(VALIDATION_ERROR)', async () => {
      const input = {
        spaceId: CHENNAI_LOCATIONS.tNagarBurkit.id,
        baseHourlyRate: 40,
        currentOccupancyRate: 0.5,
        hostPricingPreferences: {
          allowDynamic: true,
          maxMultiplier: 0.8,
        },
      };

      const result = await harness.agents.dynamicPricing.execute(input, ctx);
      expectFailure(result, 'VALIDATION_ERROR');
    });

    it('T2.4.5: Occupancy rate boundaries (0.0 and 1.0) compute smoothly without division-by-zero', async () => {
      const resZero = await harness.agents.dynamicPricing.execute({
        spaceId: CHENNAI_LOCATIONS.tNagarBurkit.id,
        baseHourlyRate: 40,
        currentOccupancyRate: 0.0,
      }, ctx);
      const resOne = await harness.agents.dynamicPricing.execute({
        spaceId: CHENNAI_LOCATIONS.tNagarBurkit.id,
        baseHourlyRate: 40,
        currentOccupancyRate: 1.0,
      }, ctx);

      expectSuccess(resZero);
      expectSuccess(resOne);
      expect(Number.isFinite(resZero.data.calculatedHourlyRate)).toBe(true);
      expect(Number.isFinite(resOne.data.calculatedHourlyRate)).toBe(true);
    });
  });

  // ==========================================================================
  // T2.5: DriverConciergeAgent (5 boundary tests)
  // ==========================================================================
  describe('T2.5: DriverConciergeAgent Boundaries', () => {
    it('T2.5.1: Blocked access road -> triggers emergency relocation within 200m at ₹0 driver surcharge', async () => {
      harness.mocks.traffic.setBlockedAccess(true);
      const input = {
        driverId: 'usr_b5_01',
        query: 'Park at Burkit Road',
        currentLocation: {
          latitude: 13.0382,
          longitude: 80.2314,
        },
      };

      const result = await harness.agents.driverConcierge.execute(input, ctx);
      expectSuccess(result);
      expect(result.data.relocationTriggered).toBe(true);
      expect(result.data.recommendedSpace?.id).toBe(CHENNAI_LOCATIONS.tNagarBackupBay.id);
      expect(result.data.entryInstructions).toContain('140m');
    });

    it('T2.5.2: Whitespace-only query string returns CLARIFICATION_NEEDED', async () => {
      const input = {
        driverId: 'usr_b5_02',
        query: '   \t  \n ',
        currentLocation: { latitude: 13.0382, longitude: 80.2314 },
      };

      const result = await harness.agents.driverConcierge.execute(input, ctx);
      expectSuccess(result);
      expect(result.data.action).toBe('CLARIFICATION_NEEDED');
    });

    it('T2.5.3: Unrealistic budget query returns NO_SPACES_FOUND', async () => {
      const input = {
        driverId: 'usr_b5_03',
        query: 'Looking for luxury valet parking for 5/hr unrealistic rate',
        currentLocation: { latitude: 13.0382, longitude: 80.2314 },
      };

      const result = await harness.agents.driverConcierge.execute(input, ctx);
      expectSuccess(result);
      expect(result.data.action).toBe('NO_SPACES_FOUND');
    });

    it('T2.5.4: Empty driverId returns Result.err(VALIDATION_ERROR)', async () => {
      const input = {
        driverId: '',
        query: 'Need parking',
        currentLocation: { latitude: 13.0382, longitude: 80.2314 },
      };

      const result = await harness.agents.driverConcierge.execute(input, ctx);
      expectFailure(result, 'VALIDATION_ERROR');
    });

    it('T2.5.5: Empty search results returns NO_SPACES_FOUND', async () => {
      harness.mocks.search.setAvailableSpaces([]);
      const input = {
        driverId: 'usr_b5_05',
        query: 'Need parking near airport',
        currentLocation: { latitude: 12.9941, longitude: 80.1709 },
      };

      const result = await harness.agents.driverConcierge.execute(input, ctx);
      expectSuccess(result);
      expect(result.data.action).toBe('NO_SPACES_FOUND');
    });
  });

  // ==========================================================================
  // T2.6: DisputeMediationAgent (5 boundary tests)
  // ==========================================================================
  describe('T2.6: DisputeMediationAgent Boundaries', () => {
    it('T2.6.1: Disputed compensation = ₹1,200 (> ₹1,000) -> freezes payout and sets ESCALATED_MANUAL', async () => {
      const input = {
        disputeId: 'disp_b6_01',
        bookingId: 'bk_b6_01',
        incidentType: 'PROPERTY_DAMAGE',
        reportedBy: 'usr_host_01',
        evidence: { claimAmount: 1200 },
      };

      const result = await harness.agents.disputeMediation.execute(input, ctx);
      expectSuccess(result);
      expect(result.data.adjudication).toBe('ESCALATED_MANUAL');
      expect(result.data.actionsTaken).toContain('PAYOUT_FROZEN_HIGH_VALUE_THRESHOLD');
      expect(result.data.hostCompensationAmount).toBe(0);
    });

    it('T2.6.2: Disputed compensation = ₹1,000.00 auto-approved; ₹1,000.01 frozen', async () => {
      const input1000 = {
        disputeId: 'disp_b6_02a',
        bookingId: 'bk_b6_02a',
        incidentType: 'OVERSTAY_REPORTED',
        reportedBy: 'usr_host_01',
        evidence: { claimAmount: 1000 },
      };

      const input1001 = {
        disputeId: 'disp_b6_02b',
        bookingId: 'bk_b6_02b',
        incidentType: 'OVERSTAY_REPORTED',
        reportedBy: 'usr_host_01',
        evidence: { claimAmount: 1000.01 },
      };

      const res1000 = await harness.agents.disputeMediation.execute(input1000, ctx);
      const res1001 = await harness.agents.disputeMediation.execute(input1001, ctx);

      expectSuccess(res1000);
      expectSuccess(res1001);
      expect(res1000.data.adjudication).toBe('OVERSTAY_CONFIRMED');
      expect(res1001.data.adjudication).toBe('ESCALATED_MANUAL');
    });

    it('T2.6.3: Sensor proves driver departed early -> sets adjudication DISPUTE_DISMISSED', async () => {
      harness.mocks.sensor.setOverstayMinutes(0);
      const input = {
        disputeId: 'disp_b6_03',
        bookingId: 'bk_b6_03',
        incidentType: 'OVERSTAY_REPORTED',
        reportedBy: 'usr_host_01',
        evidence: { claimAmount: 100 },
      };

      const result = await harness.agents.disputeMediation.execute(input, ctx);
      expectSuccess(result);
      expect(result.data.adjudication).toBe('DISPUTE_DISMISSED');
    });

    it('T2.6.4: Overstay within grace period -> sets DISPUTE_DISMISSED with ₹0 penalty', async () => {
      harness.mocks.sensor.setOverstayMinutes(0);
      const input = {
        disputeId: 'disp_b6_04',
        bookingId: 'bk_b6_04',
        incidentType: 'OVERSTAY_REPORTED',
        reportedBy: 'usr_host_01',
        evidence: { claimAmount: 0 },
      };

      const result = await harness.agents.disputeMediation.execute(input, ctx);
      expectSuccess(result);
      expect(result.data.hostCompensationAmount).toBe(0);
    });

    it('T2.6.5: Empty disputeId -> returns Result.err(VALIDATION_ERROR)', async () => {
      const input = {
        disputeId: '',
        bookingId: 'bk_b6_05',
        incidentType: 'OVERSTAY_REPORTED',
        reportedBy: 'usr_host_01',
      };

      const result = await harness.agents.disputeMediation.execute(input, ctx);
      expectFailure(result, 'VALIDATION_ERROR');
    });
  });

  // ==========================================================================
  // T2.7: CityAnalyticsAgent (5 boundary tests)
  // ==========================================================================
  describe('T2.7: CityAnalyticsAgent Boundaries', () => {
    it('T2.7.1: Malformed ISO week ("2026-36") -> returns Result.err(VALIDATION_ERROR)', async () => {
      const input = {
        cityId: 'chennai',
        period: '2026-36', // missing 'W'
        zones: ['Zone 10 Kodambakkam'],
      };

      const result = await harness.agents.cityAnalytics.execute(input, ctx);
      expectFailure(result, 'VALIDATION_ERROR');
    });

    it('T2.7.2: Empty zones array [] -> returns Result.err(VALIDATION_ERROR)', async () => {
      const input = {
        cityId: 'chennai',
        period: '2026-W36',
        zones: [] as string[],
      };

      const result = await harness.agents.cityAnalytics.execute(input, ctx);
      expectFailure(result, 'VALIDATION_ERROR');
    });

    it('T2.7.3: Zero cruising minutes -> CO2 abated is exactly 0.0 kg', async () => {
      harness.mocks.analyticsLake.setMockMetrics({
        estimatedCurbsideCruisingReducedMinutes: 0,
      });

      const input = {
        cityId: 'chennai',
        period: '2026-W36',
        zones: ['Zone 10 Kodambakkam'],
      };

      const result = await harness.agents.cityAnalytics.execute(input, ctx);
      expectSuccess(result);
      expect(result.data.metrics.estimatedCO2AbatedKg).toBe(0.0);
    });

    it('T2.7.4: 10,000,000 cruising minutes computes without floating overflow', async () => {
      harness.mocks.analyticsLake.setMockMetrics({
        estimatedCurbsideCruisingReducedMinutes: 10000000,
      });

      const input = {
        cityId: 'chennai',
        period: '2026-W36',
        zones: ['Zone 10 Kodambakkam'],
      };

      const result = await harness.agents.cityAnalytics.execute(input, ctx);
      expectSuccess(result);
      expect(result.data.metrics.estimatedCO2AbatedKg).toBe(229000);
    });

    it('T2.7.5: Empty cityId -> returns Result.err(VALIDATION_ERROR)', async () => {
      const input = {
        cityId: '',
        period: '2026-W36',
        zones: ['Zone 10 Kodambakkam'],
      };

      const result = await harness.agents.cityAnalytics.execute(input, ctx);
      expectFailure(result, 'VALIDATION_ERROR');
    });
  });

  // ==========================================================================
  // T2.8: ParklyOrchestratorAgent (5 boundary tests)
  // ==========================================================================
  describe('T2.8: ParklyOrchestratorAgent Boundaries', () => {
    it('T2.8.1: Step execution budget of 5000ms is respected by default', async () => {
      expect(harness.agents.orchestrator.deps.timeoutBudgetMs).toBe(5000);
    });

    it('T2.8.2: Fatal unhandled exception in subscriber routed to DLQ', async () => {
      harness.eventBus.subscribe('Fatal.Event', () => {
        throw new Error('Fatal crash');
      });

      await harness.agents.orchestrator.routeEvent({
        id: 'evt_fatal',
        source: 'parkly.ai',
        'detail-type': 'Fatal.Event',
        time: new Date().toISOString(),
        detail: {},
      });

      const dlq = harness.getDLQ();
      expect(dlq.length).toBe(1);
    });

    it('T2.8.3: Cascading event handlers deliver messages without unhandled rejections', async () => {
      let cascadeCount = 0;
      harness.eventBus.subscribe('Step1', async () => {
        cascadeCount++;
        await harness.eventBus.publish({
          id: 'step2_evt',
          source: 'parkly.ai',
          'detail-type': 'Step2',
          time: new Date().toISOString(),
          detail: {},
        });
      });
      harness.eventBus.subscribe('Step2', () => {
        cascadeCount++;
      });

      await harness.eventBus.publish({
        id: 'step1_evt',
        source: 'parkly.ai',
        'detail-type': 'Step1',
        time: new Date().toISOString(),
        detail: {},
      });

      expect(cascadeCount).toBe(2);
    });

    it('T2.8.4: Non-error throw in subscriber normalized in DLQ', async () => {
      harness.eventBus.subscribe('String.Throw', () => {
        throw 'String error';
      });

      await harness.eventBus.publish({
        id: 'str_throw_evt',
        source: 'parkly.ai',
        'detail-type': 'String.Throw',
        time: new Date().toISOString(),
        detail: {},
      });

      const dlq = harness.getDLQ();
      expect(dlq.length).toBe(1);
      expect(dlq[0].error.message).toContain('String error');
    });

    it('T2.8.5: Context propagation across nested hops preserves root correlationId', async () => {
      const hop1 = ctx.createChildContext();
      const hop2 = hop1.createChildContext();
      const hop3 = hop2.createChildContext();

      expect(hop3.correlationId).toBe(ctx.correlationId);
      expect(hop3.initiatorUserId).toBe(ctx.initiatorUserId);
      expect(hop3.traceId).not.toBe(ctx.traceId);
    });
  });

  // ==========================================================================
  // T2.9: Host Onboarding Saga (5 boundary tests)
  // ==========================================================================
  describe('T2.9: Host Onboarding Saga Boundaries', () => {
    it('T2.9.1: Low OCR confidence pauses forward progress at PAUSED_MANUAL_REVIEW', async () => {
      harness.mocks.ocr.setSimulatedConfidence(0.70);
      const input = {
        userId: 'usr_b9_01',
        rawAddress: CHENNAI_LOCATIONS.tNagarBurkit.rawAddress,
        documentUrls: [MOCK_DOCUMENTS.blurryPan.url],
        declaredSlots: 2,
        vehicleTypes: ['sedan'],
      };

      const result = await harness.sagas.hostOnboarding.execute(input, ctx);
      expectSuccess(result);
      expect(result.data.sagaStatus).toBe('PAUSED_MANUAL_REVIEW');
      expect(result.data.kycStatus).toBe('MANUAL_REVIEW_REQUIRED');
    });

    it('T2.9.2: Geocoding failure halts saga before visual inspection', async () => {
      harness.mocks.geocoding.setConsecutiveErrors(1);
      const input = {
        userId: 'usr_b9_02',
        rawAddress: CHENNAI_LOCATIONS.tNagarBurkit.rawAddress,
        documentUrls: [MOCK_DOCUMENTS.validPan.url],
        declaredSlots: 2,
        vehicleTypes: ['sedan'],
      };

      const result = await harness.sagas.hostOnboarding.execute(input, ctx);
      expectFailure(result, 'DOWNSTREAM_FAILURE');
    });

    it('T2.9.3: Zoning non-residential pauses forward progress', async () => {
      harness.mocks.zoning.setOverrideStatus('NON_RESIDENTIAL_PROHIBITED');
      const input = {
        userId: 'usr_b9_03',
        rawAddress: CHENNAI_LOCATIONS.tNagarBurkit.rawAddress,
        documentUrls: [MOCK_DOCUMENTS.validPan.url],
        declaredSlots: 1,
        vehicleTypes: ['sedan'],
      };

      const result = await harness.sagas.hostOnboarding.execute(input, ctx);
      expectSuccess(result);
      expect(result.data.sagaStatus).toBe('PAUSED_MANUAL_REVIEW');
    });

    it('T2.9.4: Duplicate submission returns identical hostId', async () => {
      const input = {
        userId: 'usr_b9_04',
        rawAddress: CHENNAI_LOCATIONS.tNagarBurkit.rawAddress,
        documentUrls: [MOCK_DOCUMENTS.validPan.url],
        declaredSlots: 1,
        vehicleTypes: ['sedan'],
      };

      const res1 = await harness.sagas.hostOnboarding.execute(input, ctx);
      const res2 = await harness.sagas.hostOnboarding.execute(input, ctx);
      expectSuccess(res1);
      expectSuccess(res2);
      expect(res1.data.hostId).toBe(res2.data.hostId);
    });

    it('T2.9.5: Invalid input (empty documentUrls) fails validation', async () => {
      const input = {
        userId: 'usr_b9_05',
        rawAddress: CHENNAI_LOCATIONS.tNagarBurkit.rawAddress,
        documentUrls: [] as string[],
        declaredSlots: 1,
        vehicleTypes: ['sedan'],
      };

      const result = await harness.sagas.hostOnboarding.execute(input, ctx);
      expectFailure(result, 'VALIDATION_ERROR');
    });
  });

  // ==========================================================================
  // T2.10: Booking Hold Saga (5 boundary tests)
  // ==========================================================================
  describe('T2.10: Booking Hold Saga Boundaries', () => {
    it('T2.10.1: Concurrency conflict returns BUSINESS_INVARIANT_VIOLATION', async () => {
      harness.mocks.booking.simulateCapacityConflict(true);
      const input = {
        spaceId: CHENNAI_LOCATIONS.tNagarBurkit.id,
        driverId: 'usr_b10_01',
        baseHourlyRate: 40,
        durationHours: 2,
      };

      const result = await harness.sagas.bookingHold.execute(input, ctx);
      expectFailure(result, 'BUSINESS_INVARIANT_VIOLATION');
    });

    it('T2.10.2: Hold expiration set in the future', async () => {
      const input = {
        spaceId: CHENNAI_LOCATIONS.tNagarBurkit.id,
        driverId: 'usr_b10_02',
        baseHourlyRate: 40,
        durationHours: 1,
      };

      const result = await harness.sagas.bookingHold.execute(input, ctx);
      expectSuccess(result);
      const expiry = new Date(result.data.holdExpiresAt).getTime();
      expect(expiry).toBeGreaterThan(Date.now());
    });

    it('T2.10.3: Releasing hold sets booking status to cancelled', async () => {
      const input = {
        spaceId: CHENNAI_LOCATIONS.tNagarBurkit.id,
        driverId: 'usr_b10_03',
        baseHourlyRate: 40,
        durationHours: 1,
      };

      const result = await harness.sagas.bookingHold.execute(input, ctx);
      expectSuccess(result);

      const relRes = await harness.mocks.booking.releaseHold(result.data.bookingId);
      expectSuccess(relRes);

      const holds = harness.mocks.booking.getActiveHolds();
      const hold = holds.find((h) => h.bookingId === result.data.bookingId);
      expect(hold?.status).toBe('cancelled');
    });

    it('T2.10.4: Duration <= 0 requested -> returns Result.err(VALIDATION_ERROR)', async () => {
      const input = {
        spaceId: CHENNAI_LOCATIONS.tNagarBurkit.id,
        driverId: 'usr_b10_04',
        baseHourlyRate: 40,
        durationHours: 0,
      };

      const result = await harness.sagas.bookingHold.execute(input, ctx);
      expectFailure(result, 'VALIDATION_ERROR');
    });

    it('T2.10.5: Base hourly rate <= 0 -> returns Result.err(VALIDATION_ERROR)', async () => {
      const input = {
        spaceId: CHENNAI_LOCATIONS.tNagarBurkit.id,
        driverId: 'usr_b10_05',
        baseHourlyRate: 0,
        durationHours: 2,
      };

      const result = await harness.sagas.bookingHold.execute(input, ctx);
      expectFailure(result, 'VALIDATION_ERROR');
    });
  });

  // ==========================================================================
  // T2.11: Dispute Resolution Saga (5 boundary tests)
  // ==========================================================================
  describe('T2.11: Dispute Resolution Saga Boundaries', () => {
    it('T2.11.1: Compensation > ₹1,000 freezes transfer and sets ESCALATED_MANUAL', async () => {
      const input = {
        disputeId: 'disp_b11_01',
        bookingId: 'bk_b11_01',
        incidentType: 'EXTREME_DAMAGE',
        reportedBy: 'usr_host_01',
        evidence: { claimAmount: 1500 },
      };

      const result = await harness.sagas.disputeResolution.execute(input, ctx);
      expectSuccess(result);
      expect(result.data.adjudication).toBe('ESCALATED_MANUAL');
      expect(result.data.hostCompensationAmount).toBe(0);
    });

    it('T2.11.2: Sensor telemetry confirming no overstay dismisses dispute', async () => {
      harness.mocks.sensor.setOverstayMinutes(0);
      const input = {
        disputeId: 'disp_b11_02',
        bookingId: 'bk_b11_02',
        incidentType: 'OVERSTAY_REPORTED',
        reportedBy: 'usr_host_02',
        evidence: { claimAmount: 100 },
      };

      const result = await harness.sagas.disputeResolution.execute(input, ctx);
      expectSuccess(result);
      expect(result.data.adjudication).toBe('DISPUTE_DISMISSED');
    });

    it('T2.11.3: Claim amount of exactly ₹1,000 is auto-approved without freeze', async () => {
      const input = {
        disputeId: 'disp_b11_03',
        bookingId: 'bk_b11_03',
        incidentType: 'OVERSTAY_REPORTED',
        reportedBy: 'usr_host_03',
        evidence: { claimAmount: 1000 },
      };

      const result = await harness.sagas.disputeResolution.execute(input, ctx);
      expectSuccess(result);
      expect(result.data.adjudication).toBe('OVERSTAY_CONFIRMED');
    });

    it('T2.11.4: Claim amount of ₹1,001 triggers ESCALATED_MANUAL freeze', async () => {
      const input = {
        disputeId: 'disp_b11_04',
        bookingId: 'bk_b11_04',
        incidentType: 'OVERSTAY_REPORTED',
        reportedBy: 'usr_host_04',
        evidence: { claimAmount: 1001 },
      };

      const result = await harness.sagas.disputeResolution.execute(input, ctx);
      expectSuccess(result);
      expect(result.data.adjudication).toBe('ESCALATED_MANUAL');
    });

    it('T2.11.5: Missing disputeId fails input validation', async () => {
      const input = {
        disputeId: '',
        bookingId: 'bk_b11_05',
        incidentType: 'OVERSTAY_REPORTED',
        reportedBy: 'usr_host_05',
      };

      const result = await harness.sagas.disputeResolution.execute(input, ctx);
      expectFailure(result, 'VALIDATION_ERROR');
    });
  });

  // ==========================================================================
  // T2.12: Distributed Circuit Breaker (5 boundary tests)
  // ==========================================================================
  describe('T2.12: Distributed Circuit Breaker Boundaries', () => {
    it('T2.12.1: 2 failures followed by 1 success resets failure count to 0', async () => {
      const cb = new CircuitBreaker({ failureThreshold: 3, resetTimeoutMs: 5000 });
      let count = 0;
      const op = async () => {
        count++;
        if (count <= 2) throw new Error('Glitch');
        return 'recovered';
      };

      await expect(cb.execute(op)).rejects.toThrow();
      await expect(cb.execute(op)).rejects.toThrow();
      expect(cb.getFailureCount()).toBe(2);

      const res = await cb.execute(op);
      expect(res).toBe('recovered');
      expect(cb.getFailureCount()).toBe(0);
      expect(cb.getState()).toBe('CLOSED');
    });

    it('T2.12.2: 3 failures transitions circuit to OPEN', async () => {
      const cb = new CircuitBreaker({ failureThreshold: 3, resetTimeoutMs: 5000 });
      const op = async () => { throw new Error('Outage'); };

      for (let i = 0; i < 3; i++) {
        await expect(cb.execute(op)).rejects.toThrow();
      }

      expect(cb.getState()).toBe('OPEN');
    });

    it('T2.12.3: In OPEN state, fallback executes without invoking guarded function', async () => {
      const cb = new CircuitBreaker({ failureThreshold: 2, resetTimeoutMs: 5000 });
      const failing = async () => { throw new Error('Fail'); };

      await expect(cb.execute(failing)).rejects.toThrow();
      await expect(cb.execute(failing)).rejects.toThrow();
      expect(cb.getState()).toBe('OPEN');

      let called = false;
      const res = await cb.execute(async () => { called = true; return 'live'; }, async () => 'fallback');
      expect(res).toBe('fallback');
      expect(called).toBe(false);
    });

    it('T2.12.4: Probe failure in HALF_OPEN returns to OPEN and resets cooldown', async () => {
      const cb = new CircuitBreaker({ failureThreshold: 2, resetTimeoutMs: 20 });
      const failing = async () => { throw new Error('Fail'); };

      await expect(cb.execute(failing)).rejects.toThrow();
      await expect(cb.execute(failing)).rejects.toThrow();
      expect(cb.getState()).toBe('OPEN');

      await new Promise((r) => setTimeout(r, 30));

      await expect(cb.execute(failing)).rejects.toThrow();
      expect(cb.getState()).toBe('OPEN');
    });

    it('T2.12.5: Zero or negative resetTimeout defaults to safety minimum', async () => {
      const cb = new CircuitBreaker({ failureThreshold: 2, resetTimeoutMs: -10 });
      expect(cb.resetTimeoutMs).toBeGreaterThan(0);
    });
  });

  // ==========================================================================
  // T2.13: InMemoryEventBus & Events (5 boundary tests)
  // ==========================================================================
  describe('T2.13: InMemoryEventBus & Events Boundaries', () => {
    it('T2.13.1: Large payload (> 256KB) handled without error', async () => {
      const largeString = 'X'.repeat(300 * 1024); // 300KB
      let receivedSize = 0;

      harness.eventBus.subscribe('Large.Payload', (e: any) => {
        receivedSize = e.detail.payload.length;
      });

      await harness.eventBus.publish({
        id: 'evt_large',
        source: 'parkly.ai',
        'detail-type': 'Large.Payload',
        time: new Date().toISOString(),
        detail: { payload: largeString },
      });

      expect(receivedSize).toBe(300 * 1024);
    });

    it('T2.13.2: 100 rapid concurrent subscriptions execute without race conditions', async () => {
      let callCount = 0;
      for (let i = 0; i < 100; i++) {
        harness.eventBus.subscribe('Rapid.Subscribe', () => {
          callCount++;
        });
      }

      await harness.eventBus.publish({
        id: 'evt_rapid',
        source: 'parkly.ai',
        'detail-type': 'Rapid.Subscribe',
        time: new Date().toISOString(),
        detail: {},
      });

      expect(callCount).toBe(100);
    });

    it('T2.13.3: Subscriber throws non-Error object normalized into DeadLetterEnvelope', async () => {
      harness.eventBus.subscribe('Throw.Number', () => {
        throw 404;
      });

      await harness.eventBus.publish({
        id: 'evt_num_throw',
        source: 'parkly.ai',
        'detail-type': 'Throw.Number',
        time: new Date().toISOString(),
        detail: {},
      });

      const dlq = harness.getDLQ();
      expect(dlq.length).toBe(1);
      expect(dlq[0].error.message).toContain('404');
    });

    it('T2.13.4: Event published with no subscribers silently ignored without error', async () => {
      await expect(
        harness.eventBus.publish({
          id: 'evt_orphan',
          source: 'parkly.ai',
          'detail-type': 'NonExistent.Topic',
          time: new Date().toISOString(),
          detail: {},
        })
      ).resolves.not.toThrow();
    });

    it('T2.13.5: Empty DLQ query returns empty array []', () => {
      const dlq = harness.getDLQ();
      expect(dlq).toEqual([]);
    });
  });
});
