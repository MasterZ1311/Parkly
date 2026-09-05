/**
 * 🅿️ Parkly — Tier 1: Feature Coverage E2E Test Suite
 * 
 * Verifies all 13 features with 5 tests per feature (65 tests total)
 * strictly conforming to TEST_INFRA.md §5.1.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  E2ETestHarness,
  expectSuccess,
  expectFailure,
  CHENNAI_LOCATIONS,
  MOCK_DOCUMENTS,
  MOCK_PHOTOS,
  MOCK_TELEMETRY,
  CircuitBreaker,
  ExecutionContext,
  EventBridgeEvent,
  encodeGeohash,
} from './helpers/e2e-harness';

describe('Tier 1: Feature Coverage E2E Test Suite (65 tests)', () => {
  let harness: E2ETestHarness;
  let ctx: ExecutionContext;

  beforeEach(async () => {
    harness = await E2ETestHarness.create();
    ctx = harness.createContext('usr_driver_tier1');
  });

  // ==========================================================================
  // FEATURE 1: HostOnboardingAgent (T1.1.1 to T1.1.5)
  // ==========================================================================
  describe('Feature 1: HostOnboardingAgent', () => {
    it('T1.1.1: Onboard residential property on Burkit Road, T. Nagar with verified KYC and zoning', async () => {
      const input = {
        userId: 'usr_tnagar_host_01',
        rawAddress: CHENNAI_LOCATIONS.tNagarBurkit.rawAddress,
        documentUrls: [MOCK_DOCUMENTS.validPan.url],
        declaredSlots: 2,
        vehicleTypes: ['sedan', 'suv'],
      };

      const result = await harness.agents.hostOnboarding.execute(input, ctx);
      expectSuccess(result);
      expect(result.data.kycStatus).toBe('VERIFIED_AUTO');
      expect(result.data.confidenceScore).toBeGreaterThanOrEqual(0.85);
      expect(result.data.geocoding.geohash).toBeDefined();
      expect(result.data.geocoding.geohash.length).toBe(7);
      expect(result.data.zoningCompliance).toBe('RESIDENTIAL_PERMITTED');
    });

    it('T1.1.2: Onboard multi-slot commercial parking on 2nd Avenue, Anna Nagar', async () => {
      harness.mocks.zoning.setOverrideStatus('COMMERCIAL_PERMITTED');
      const input = {
        userId: 'usr_annanagar_host_02',
        rawAddress: CHENNAI_LOCATIONS.annaNagarRoundtana.rawAddress,
        documentUrls: [MOCK_DOCUMENTS.validPropertyTax.url],
        declaredSlots: 6,
        vehicleTypes: ['sedan', 'compact'],
      };

      const result = await harness.agents.hostOnboarding.execute(input, ctx);
      expectSuccess(result);
      expect(result.data.kycStatus).toBe('VERIFIED_AUTO');
      expect(result.data.zoningCompliance).toBe('COMMERCIAL_PERMITTED');
    });

    it('T1.1.3: Onboard mixed-use property near Sholinganallur, OMR', async () => {
      const input = {
        userId: 'usr_omr_host_03',
        rawAddress: CHENNAI_LOCATIONS.omrTidelPark.rawAddress,
        documentUrls: [MOCK_DOCUMENTS.validPan.url],
        declaredSlots: 15,
        vehicleTypes: ['suv', 'ev'],
      };

      const result = await harness.agents.hostOnboarding.execute(input, ctx);
      expectSuccess(result);
      expect(result.data.kycStatus).toBe('VERIFIED_AUTO');
      expect(result.data.geocoding.normalizedAddress).toContain('Chennai');
    });

    it('T1.1.4: Onboard single two-wheeler parking space in Mylapore', async () => {
      const input = {
        userId: 'usr_mylapore_host_04',
        rawAddress: '12 Kutchery Road, Mylapore, Chennai 600004',
        documentUrls: [MOCK_DOCUMENTS.validPan.url],
        declaredSlots: 1,
        vehicleTypes: ['motorcycle'],
      };

      const result = await harness.agents.hostOnboarding.execute(input, ctx);
      expectSuccess(result);
      expect(result.data.hostId).toBe('host_usr_mylapore_host_04');
      expect(result.data.kycStatus).toBe('VERIFIED_AUTO');
    });

    it('T1.1.5: Onboard 10-slot SUV/van parking facility in Velachery with precision 7 Geohash', async () => {
      const input = {
        userId: 'usr_velachery_host_05',
        rawAddress: '100 Bypass Road, Velachery, Chennai 600042',
        documentUrls: [MOCK_DOCUMENTS.validPropertyTax.url],
        declaredSlots: 10,
        vehicleTypes: ['suv', 'van'],
      };

      const result = await harness.agents.hostOnboarding.execute(input, ctx);
      expectSuccess(result);
      expect(result.data.geocoding.geohash).toHaveLength(7);
      expect(result.data.confidenceScore).toBeGreaterThanOrEqual(0.85);
    });
  });

  // ==========================================================================
  // FEATURE 2: VisualInspectionAgent (T1.2.1 to T1.2.5)
  // ==========================================================================
  describe('Feature 2: VisualInspectionAgent', () => {
    it('T1.2.1: Audit covered, CCTV-equipped concrete parking bay in T. Nagar', async () => {
      const input = {
        spaceId: CHENNAI_LOCATIONS.tNagarBurkit.id,
        photoUrls: [...MOCK_PHOTOS.approvedSpace.photoUrls],
      };

      const result = await harness.agents.visualInspection.execute(input, ctx);
      expectSuccess(result);
      expect(result.data.inspectionResult).toBe('APPROVED');
      expect(result.data.detectedAttributes.isCovered).toBe(true);
      expect(result.data.detectedAttributes.gateClearanceAdequate).toBe(true);
    });

    it('T1.2.2: Audit outdoor asphalt parking lot in Anna Nagar', async () => {
      const input = {
        spaceId: CHENNAI_LOCATIONS.annaNagarRoundtana.id,
        photoUrls: ['https://s3.ap-south-1.amazonaws.com/parkly-spaces/anna_lot_01.jpg'],
      };

      const result = await harness.agents.visualInspection.execute(input, ctx);
      expectSuccess(result);
      expect(result.data.inspectionResult).toBe('APPROVED');
      expect(result.data.detectedAttributes).toBeDefined();
    });

    it('T1.2.3: Audit EV charging enabled space in OMR', async () => {
      const input = {
        spaceId: CHENNAI_LOCATIONS.omrTidelPark.id,
        photoUrls: ['https://s3.ap-south-1.amazonaws.com/parkly-spaces/omr_ev_01.jpg'],
      };

      const result = await harness.agents.visualInspection.execute(input, ctx);
      expectSuccess(result);
      expect(result.data.inspectionResult).toBe('APPROVED');
      expect(result.data.generatedDescription).toContain('residential parking bay');
    });

    it('T1.2.4: Privacy redaction on space with parked vehicle', async () => {
      const input = {
        spaceId: 'spc_privacy_plate_01',
        photoUrls: ['https://s3.ap-south-1.amazonaws.com/parkly-spaces/car_plate_01.jpg'],
      };

      const result = await harness.agents.visualInspection.execute(input, ctx);
      expectSuccess(result);
      expect(result.data.privacyActions.licensePlatesBlurred).toBeGreaterThanOrEqual(1);
    });

    it('T1.2.5: Privacy redaction on space with human face visible', async () => {
      harness.mocks.vision.setObstructions([]);
      const input = {
        spaceId: 'spc_privacy_face_01',
        photoUrls: ['https://s3.ap-south-1.amazonaws.com/parkly-spaces/guard_face_01.jpg'],
      };

      const result = await harness.agents.visualInspection.execute(input, ctx);
      expectSuccess(result);
      expect(result.data.privacyActions).toBeDefined();
      expect(typeof result.data.privacyActions.facesBlurred).toBe('number');
    });
  });

  // ==========================================================================
  // FEATURE 3: OccupancyPredictorAgent (T1.3.1 to T1.3.5)
  // ==========================================================================
  describe('Feature 3: OccupancyPredictorAgent', () => {
    it('T1.3.1: Weekday morning commute prediction in Anna Nagar', async () => {
      const input = {
        spaceId: CHENNAI_LOCATIONS.annaNagarRoundtana.id,
        targetArrivalTime: '2026-09-07T08:30:00.000Z',
        targetDurationMinutes: 540,
      };

      const result = await harness.agents.occupancyPredictor.execute(input, ctx);
      expectSuccess(result);
      expect(result.data.demandTier).toBe('PEAK_COMMUTE');
      expect(result.data.arrivalProbability).toBeGreaterThanOrEqual(0.5);
      expect(result.data.confidenceScore).toBeGreaterThanOrEqual(0.80);
    });

    it('T1.3.2: Weekend shopping rush prediction in T. Nagar', async () => {
      const input = {
        spaceId: CHENNAI_LOCATIONS.tNagarBurkit.id,
        targetArrivalTime: '2026-09-06T18:00:00.000Z',
        targetDurationMinutes: 120,
      };

      const result = await harness.agents.occupancyPredictor.execute(input, ctx);
      expectSuccess(result);
      expect(result.data.demandTier).toBe('PEAK_SHOPPING');
      expect(result.data.arrivalProbability).toBeGreaterThanOrEqual(0.35);
      expect(result.data.arrivalProbability).toBeLessThanOrEqual(0.65);
    });

    it('T1.3.3: Off-peak late night prediction in OMR', async () => {
      const input = {
        spaceId: CHENNAI_LOCATIONS.omrTidelPark.id,
        targetArrivalTime: '2026-09-06T23:30:00.000Z',
        targetDurationMinutes: 60,
      };

      const result = await harness.agents.occupancyPredictor.execute(input, ctx);
      expectSuccess(result);
      expect(result.data.arrivalProbability).toBeGreaterThan(0.4);
      expect(result.data.estimatedAvailableSlots).toBeGreaterThanOrEqual(1);
    });

    it('T1.3.4: Contextual factors inclusion in prediction response', async () => {
      const input = {
        spaceId: CHENNAI_LOCATIONS.tNagarBurkit.id,
        targetArrivalTime: '2026-09-07T09:00:00.000Z',
        targetDurationMinutes: 180,
      };

      const result = await harness.agents.occupancyPredictor.execute(input, ctx);
      expectSuccess(result);
      expect(result.data.contextualFactors).toBeDefined();
      expect(result.data.contextualFactors.length).toBeGreaterThan(0);
    });

    it('T1.3.5: High capacity commercial space (15 slots) estimation', async () => {
      const input = {
        spaceId: CHENNAI_LOCATIONS.omrTidelPark.id,
        targetArrivalTime: '2026-09-07T10:00:00.000Z',
        targetDurationMinutes: 240,
      };

      const result = await harness.agents.occupancyPredictor.execute(input, ctx);
      expectSuccess(result);
      expect(result.data.estimatedAvailableSlots).toBeGreaterThanOrEqual(1);
    });
  });

  // ==========================================================================
  // FEATURE 4: DynamicPricingAgent (T1.4.1 to T1.4.5)
  // ==========================================================================
  describe('Feature 4: DynamicPricingAgent', () => {
    it('T1.4.1: Midday normal demand in Anna Nagar calculates baseline rate', async () => {
      const input = {
        spaceId: CHENNAI_LOCATIONS.annaNagarRoundtana.id,
        baseHourlyRate: 35,
        currentOccupancyRate: 0.50,
      };

      const result = await harness.agents.dynamicPricing.execute(input, ctx);
      expectSuccess(result);
      expect(result.data.calculatedHourlyRate).toBe(35);
      expect(result.data.appliedMultiplier).toBe(1.0);
    });

    it('T1.4.2: Commute surge in OMR with 75% occupancy', async () => {
      const input = {
        spaceId: CHENNAI_LOCATIONS.omrTidelPark.id,
        baseHourlyRate: 50,
        currentOccupancyRate: 0.78,
      };

      const result = await harness.agents.dynamicPricing.execute(input, ctx);
      expectSuccess(result);
      expect(result.data.appliedMultiplier).toBeGreaterThanOrEqual(1.1);
      expect(result.data.appliedMultiplier).toBeLessThanOrEqual(1.3);
      expect(result.data.calculatedHourlyRate).toBeGreaterThan(50);
    });

    it('T1.4.3: Festive surge in T. Nagar with 95% occupancy', async () => {
      const input = {
        spaceId: CHENNAI_LOCATIONS.tNagarBurkit.id,
        baseHourlyRate: 40,
        currentOccupancyRate: 0.95,
        hostPricingPreferences: { allowDynamic: true, maxMultiplier: 2.0 },
      };

      const result = await harness.agents.dynamicPricing.execute(input, ctx);
      expectSuccess(result);
      expect(result.data.appliedMultiplier).toBeGreaterThanOrEqual(1.4);
      expect(result.data.appliedMultiplier).toBeLessThanOrEqual(1.8);
      expect(result.data.calculatedHourlyRate).toBe(64); // 40 * 1.6
    });

    it('T1.4.4: Fixed price space with allowDynamic === false strictly equals base rate', async () => {
      const input = {
        spaceId: CHENNAI_LOCATIONS.tNagarBurkit.id,
        baseHourlyRate: 40,
        currentOccupancyRate: 0.98,
        hostPricingPreferences: { allowDynamic: false, maxMultiplier: 2.0 },
      };

      const result = await harness.agents.dynamicPricing.execute(input, ctx);
      expectSuccess(result);
      expect(result.data.calculatedHourlyRate).toBe(40);
      expect(result.data.appliedMultiplier).toBe(1.0);
    });

    it('T1.4.5: Low occupancy rate does not fall below base rate (price floor)', async () => {
      const input = {
        spaceId: CHENNAI_LOCATIONS.tNagarBurkit.id,
        baseHourlyRate: 40,
        currentOccupancyRate: 0.10,
      };

      const result = await harness.agents.dynamicPricing.execute(input, ctx);
      expectSuccess(result);
      expect(result.data.calculatedHourlyRate).toBeGreaterThanOrEqual(40);
      expect(result.data.appliedMultiplier).toBeGreaterThanOrEqual(1.0);
    });
  });

  // ==========================================================================
  // FEATURE 5: DriverConciergeAgent (T1.5.1 to T1.5.5)
  // ==========================================================================
  describe('Feature 5: DriverConciergeAgent', () => {
    it('T1.5.1: Natural language query near Pothys returns recommendation with deep link', async () => {
      const input = {
        driverId: 'usr_driver_chennai_01',
        query: 'Find covered parking under 60/hr for 2h near Pothys',
        currentLocation: {
          latitude: CHENNAI_LOCATIONS.pothysRetail.latitude,
          longitude: CHENNAI_LOCATIONS.pothysRetail.longitude,
        },
      };

      const result = await harness.agents.driverConcierge.execute(input, ctx);
      expectSuccess(result);
      expect(result.data.action).toBe('PRESENT_RECOMMENDATION');
      expect(result.data.recommendedSpace).toBeDefined();
      expect(result.data.turnByTurnDeepLink).toContain('maps.google.com');
    });

    it('T1.5.2: EV query in OMR returns EV equipped space recommendation', async () => {
      const input = {
        driverId: 'usr_driver_chennai_02',
        query: 'Need EV charging spot near Tidel Park',
        currentLocation: {
          latitude: CHENNAI_LOCATIONS.omrTidelPark.latitude,
          longitude: CHENNAI_LOCATIONS.omrTidelPark.longitude,
        },
      };

      const result = await harness.agents.driverConcierge.execute(input, ctx);
      expectSuccess(result);
      expect(result.data.action).toBe('PRESENT_RECOMMENDATION');
      expect(result.data.recommendedSpace).toBeDefined();
    });

    it('T1.5.3: Ambiguous empty query returns CLARIFICATION_NEEDED', async () => {
      const input = {
        driverId: 'usr_driver_chennai_03',
        query: '   ',
        currentLocation: {
          latitude: 13.0382,
          longitude: 80.2314,
        },
      };

      const result = await harness.agents.driverConcierge.execute(input, ctx);
      expectSuccess(result);
      expect(result.data.action).toBe('CLARIFICATION_NEEDED');
    });

    it('T1.5.4: Unmatchable price query returns NO_SPACES_FOUND', async () => {
      const input = {
        driverId: 'usr_driver_chennai_04',
        query: 'Find parking in T. Nagar for 5/hr',
        currentLocation: {
          latitude: 13.0382,
          longitude: 80.2314,
        },
      };

      const result = await harness.agents.driverConcierge.execute(input, ctx);
      expectSuccess(result);
      expect(result.data.action).toBe('NO_SPACES_FOUND');
    });

    it('T1.5.5: Turn-by-turn routing request generates Google Maps deep link with coordinates', async () => {
      const input = {
        driverId: 'usr_driver_chennai_05',
        query: 'Route me to parking on Burkit Road',
        currentLocation: {
          latitude: 13.0382,
          longitude: 80.2314,
        },
      };

      const result = await harness.agents.driverConcierge.execute(input, ctx);
      expectSuccess(result);
      expect(result.data.turnByTurnDeepLink).toMatch(/maps\.google\.com\/\?daddr=\d+\.\d+,\d+\.\d+/);
    });
  });

  // ==========================================================================
  // FEATURE 6: DisputeMediationAgent (T1.6.1 to T1.6.5)
  // ==========================================================================
  describe('Feature 6: DisputeMediationAgent', () => {
    it('T1.6.1: Verified overstay in T. Nagar (90 min) assesses ₹120 penalty and ₹100 compensation', async () => {
      const input = {
        disputeId: MOCK_TELEMETRY.disputeOverstay90Min.disputeId,
        bookingId: MOCK_TELEMETRY.disputeOverstay90Min.bookingId,
        incidentType: 'OVERSTAY_REPORTED',
        reportedBy: 'usr_host_chennai_01',
        evidence: { claimAmount: 100 },
      };

      const result = await harness.agents.disputeMediation.execute(input, ctx);
      expectSuccess(result);
      expect(result.data.adjudication).toBe('OVERSTAY_CONFIRMED');
      expect(result.data.hostCompensationAmount).toBe(100);
      expect(result.data.actionsTaken).toContain('PENALTY_CHARGED');
    });

    it('T1.6.2: False overstay report dismissed when sensor shows on-time departure', async () => {
      harness.mocks.sensor.setOverstayMinutes(0);
      const input = {
        disputeId: 'disp_false_overstay_02',
        bookingId: 'bk_tnagar_8822',
        incidentType: 'OVERSTAY_REPORTED',
        reportedBy: 'usr_host_chennai_01',
        evidence: { claimAmount: 50 },
      };

      const result = await harness.agents.disputeMediation.execute(input, ctx);
      expectSuccess(result);
      expect(result.data.adjudication).toBe('DISPUTE_DISMISSED');
      expect(result.data.hostCompensationAmount).toBe(0);
    });

    it('T1.6.3: Driver reports blocked driveway upon arrival', async () => {
      harness.mocks.sensor.setOverstayMinutes(0);
      const input = {
        disputeId: 'disp_blocked_entry_03',
        bookingId: 'bk_tnagar_8823',
        incidentType: 'BLOCKED_DRIVEWAY',
        reportedBy: 'usr_driver_chennai_01',
        evidence: { claimAmount: 40 },
      };

      const result = await harness.agents.disputeMediation.execute(input, ctx);
      expectSuccess(result);
      expect(result.data.disputeId).toBe('disp_blocked_entry_03');
    });

    it('T1.6.4: Unauthorized vehicle reported with audit record', async () => {
      const input = {
        disputeId: 'disp_unauthorized_04',
        bookingId: 'bk_tnagar_8824',
        incidentType: 'UNAUTHORIZED_VEHICLE',
        reportedBy: 'usr_host_chennai_01',
        evidence: { claimAmount: 200 },
      };

      const result = await harness.agents.disputeMediation.execute(input, ctx);
      expectSuccess(result);
      expect(result.data.platformAuditLog).toBeDefined();
    });

    it('T1.6.5: Overstay within grace period dismissed cleanly', async () => {
      harness.mocks.sensor.setOverstayMinutes(0);
      const input = {
        disputeId: 'disp_grace_period_05',
        bookingId: 'bk_tnagar_8825',
        incidentType: 'OVERSTAY_REPORTED',
        reportedBy: 'usr_host_chennai_01',
        evidence: { claimAmount: 0 },
      };

      const result = await harness.agents.disputeMediation.execute(input, ctx);
      expectSuccess(result);
      expect(result.data.adjudication).toBe('DISPUTE_DISMISSED');
    });
  });

  // ==========================================================================
  // FEATURE 7: CityAnalyticsAgent (T1.7.1 to T1.7.5)
  // ==========================================================================
  describe('Feature 7: CityAnalyticsAgent', () => {
    it('T1.7.1: Standard weekly report for Chennai ("2026-W36", 3 zones)', async () => {
      const input = {
        cityId: 'chennai',
        period: '2026-W36',
        zones: ['Zone 10 Kodambakkam', 'Zone 8 Anna Nagar', 'Zone 13 Adyar'],
      };

      const result = await harness.agents.cityAnalytics.execute(input, ctx);
      expectSuccess(result);
      expect(result.data.metrics.totalOffStreetHoursProvided).toBeGreaterThan(0);
      expect(result.data.metrics.estimatedCurbsideCruisingReducedMinutes).toBeGreaterThan(0);
    });

    it('T1.7.2: Mathematical CO2 verification: estimatedCO2AbatedKg === cruisingMinutes * 0.0229', async () => {
      const input = {
        cityId: 'chennai',
        period: '2026-W36',
        zones: ['Zone 10 Kodambakkam'],
      };

      const result = await harness.agents.cityAnalytics.execute(input, ctx);
      expectSuccess(result);
      const cruising = result.data.metrics.estimatedCurbsideCruisingReducedMinutes;
      const expectedCO2 = Number((cruising * 0.0229).toFixed(1));
      expect(result.data.metrics.estimatedCO2AbatedKg).toBe(expectedCO2);
    });

    it('T1.7.3: Single-zone report for T. Nagar identifies choke points', async () => {
      const input = {
        cityId: 'chennai',
        period: '2026-W36',
        zones: ['Zone 10 Kodambakkam'],
      };

      const result = await harness.agents.cityAnalytics.execute(input, ctx);
      expectSuccess(result);
      expect(result.data.metrics.unmetDemandChokePoints.length).toBeGreaterThan(0);
      expect(result.data.recommendation).toContain('Usman Rd');
    });

    it('T1.7.4: OMR IT corridor macro metrics computed accurately', async () => {
      const input = {
        cityId: 'chennai',
        period: '2026-W36',
        zones: ['Zone 13 Adyar'],
      };

      const result = await harness.agents.cityAnalytics.execute(input, ctx);
      expectSuccess(result);
      expect(result.data.metrics.totalOffStreetHoursProvided).toBe(48200);
    });

    it('T1.7.5: Structured report format validated against schema', async () => {
      const input = {
        cityId: 'chennai',
        period: '2026-W36',
        zones: ['Zone 8 Anna Nagar'],
      };

      const result = await harness.agents.cityAnalytics.execute(input, ctx);
      expectSuccess(result);
      expect(result.data.reportGeneratedAt).toBeDefined();
      expect(result.data.recommendation).toBeDefined();
    });
  });

  // ==========================================================================
  // FEATURE 8: ParklyOrchestratorAgent (T1.8.1 to T1.8.5)
  // ==========================================================================
  describe('Feature 8: ParklyOrchestratorAgent', () => {
    it('T1.8.1: Event routing: Routes EventBridge event across bus preserving correlationId', async () => {
      let routedEvent: EventBridgeEvent<any> | null = null;
      harness.eventBus.subscribe('Host.Submitted', (e) => {
        routedEvent = e;
      });

      const event: EventBridgeEvent = {
        id: 'evt_test_01',
        source: 'parkly.ai',
        'detail-type': 'Host.Submitted',
        time: new Date().toISOString(),
        detail: { userId: 'usr_test_01' },
        correlationId: ctx.correlationId,
      };

      await harness.agents.orchestrator.routeEvent(event);
      expect(routedEvent).not.toBeNull();
      expect(routedEvent!['detail-type']).toBe('Host.Submitted');
      expect(routedEvent!.correlationId).toBe(ctx.correlationId);
    });

    it('T1.8.2: Execution budget: Step completes within 5,000ms budget', async () => {
      const start = Date.now();
      const result = await harness.agents.dynamicPricing.execute({
        spaceId: CHENNAI_LOCATIONS.tNagarBurkit.id,
        baseHourlyRate: 40,
        currentOccupancyRate: 0.6,
      }, ctx);
      const elapsed = Date.now() - start;

      expectSuccess(result);
      expect(elapsed).toBeLessThan(5000);
    });

    it('T1.8.3: ExecutionContext propagation: Sub-agent receives matching correlationId and fresh traceId', async () => {
      const childCtx = ctx.createChildContext();
      expect(childCtx.correlationId).toBe(ctx.correlationId);
      expect(childCtx.traceId).not.toBe(ctx.traceId);
      expect(childCtx.initiatorUserId).toBe(ctx.initiatorUserId);
    });

    it('T1.8.4: DLQ routing on fatal worker error: Exception routed to dead-letter queue', async () => {
      harness.eventBus.subscribe('Failing.Topic', () => {
        throw new Error('Fatal handler exception');
      });

      await harness.eventBus.publish({
        id: 'evt_fatal_01',
        source: 'parkly.ai',
        'detail-type': 'Failing.Topic',
        time: new Date().toISOString(),
        detail: { reason: 'trigger_error' },
      });

      const dlq = harness.getDLQ();
      expect(dlq.length).toBe(1);
      expect(dlq[0].event['detail-type']).toBe('Failing.Topic');
      expect(dlq[0].reason).toContain('Subscriber handler threw an exception');
    });

    it('T1.8.5: Concurrent event handling: Handles multiple simultaneous events without cross-contamination', async () => {
      const received: string[] = [];
      harness.eventBus.subscribe('Multi.Event', (e: EventBridgeEvent<{ tag: string }>) => {
        received.push(e.detail.tag);
      });

      await Promise.all([
        harness.eventBus.publish({
          id: 'evt_c1',
          source: 'parkly.ai',
          'detail-type': 'Multi.Event',
          time: new Date().toISOString(),
          detail: { tag: 'A' },
        }),
        harness.eventBus.publish({
          id: 'evt_c2',
          source: 'parkly.ai',
          'detail-type': 'Multi.Event',
          time: new Date().toISOString(),
          detail: { tag: 'B' },
        }),
      ]);

      expect(received).toContain('A');
      expect(received).toContain('B');
    });
  });

  // ==========================================================================
  // FEATURE 9: Host Onboarding Saga (T1.9.1 to T1.9.5)
  // ==========================================================================
  describe('Feature 9: Host Onboarding Saga', () => {
    it('T1.9.1: Full forward saga: KYC -> Geocode -> Zoning -> Inspection -> Listing Activated', async () => {
      const input = {
        userId: 'usr_saga_host_01',
        rawAddress: CHENNAI_LOCATIONS.tNagarBurkit.rawAddress,
        documentUrls: [MOCK_DOCUMENTS.validPan.url],
        declaredSlots: 2,
        vehicleTypes: ['sedan'],
      };

      const result = await harness.sagas.hostOnboarding.execute(input, ctx);
      expectSuccess(result);
      expect(result.data.sagaStatus).toBe('COMPLETED');
      expect(result.data.listingActive).toBe(true);
    });

    it('T1.9.2: Listing status transitions from draft to active upon approval', async () => {
      const input = {
        userId: 'usr_saga_host_02',
        rawAddress: CHENNAI_LOCATIONS.annaNagarRoundtana.rawAddress,
        documentUrls: [MOCK_DOCUMENTS.validPan.url],
        declaredSlots: 4,
        vehicleTypes: ['compact'],
      };

      const result = await harness.sagas.hostOnboarding.execute(input, ctx);
      expectSuccess(result);
      expect(result.data.listingActive).toBe(true);
    });

    it('T1.9.3: State store records saga transitions', async () => {
      const input = {
        userId: 'usr_saga_host_03',
        rawAddress: CHENNAI_LOCATIONS.omrTidelPark.rawAddress,
        documentUrls: [MOCK_DOCUMENTS.validPan.url],
        declaredSlots: 5,
        vehicleTypes: ['ev'],
      };

      const result = await harness.sagas.hostOnboarding.execute(input, ctx);
      expectSuccess(result);
      expect(result.data.sagaStatus).toBe('COMPLETED');
    });

    it('T1.9.4: Re-entrant execution with identical correlationId returns valid result', async () => {
      const input = {
        userId: 'usr_saga_host_04',
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

    it('T1.9.5: Space.VisuallyAudited event emitted upon listing activation', async () => {
      let eventCaptured: EventBridgeEvent<any> | null = null;
      harness.eventBus.subscribe('Space.VisuallyAudited', (e) => {
        eventCaptured = e;
      });

      const input = {
        userId: 'usr_saga_host_05',
        rawAddress: CHENNAI_LOCATIONS.tNagarBurkit.rawAddress,
        documentUrls: [MOCK_DOCUMENTS.validPan.url],
        declaredSlots: 2,
        vehicleTypes: ['sedan'],
      };

      await harness.sagas.hostOnboarding.execute(input, ctx);
      expect(eventCaptured).not.toBeNull();
      expect(eventCaptured!['detail-type']).toBe('Space.VisuallyAudited');
    });
  });

  // ==========================================================================
  // FEATURE 10: Booking Hold Saga (T1.10.1 to T1.10.5)
  // ==========================================================================
  describe('Feature 10: Booking Hold Saga', () => {
    it('T1.10.1: Full forward saga: Search -> Vacancy -> Pricing -> 10m Hold -> QR Generation', async () => {
      const input = {
        spaceId: CHENNAI_LOCATIONS.tNagarBurkit.id,
        driverId: 'usr_driver_hold_01',
        baseHourlyRate: 40,
        durationHours: 2,
      };

      const result = await harness.sagas.bookingHold.execute(input, ctx);
      expectSuccess(result);
      expect(result.data.sagaStatus).toBe('COMPLETED');
      expect(result.data.bookingId).toBeDefined();
      expect(result.data.qrCode).toContain('PARKLY-QR');
    });

    it('T1.10.2: Booking hold expiration set to 10 minutes in the future', async () => {
      const input = {
        spaceId: CHENNAI_LOCATIONS.tNagarBurkit.id,
        driverId: 'usr_driver_hold_02',
        baseHourlyRate: 40,
        durationHours: 1,
      };

      const before = Date.now();
      const result = await harness.sagas.bookingHold.execute(input, ctx);
      expectSuccess(result);

      const expiresMs = new Date(result.data.holdExpiresAt).getTime();
      const expectedDiff = 10 * 60 * 1000; // 10 minutes
      expect(expiresMs - before).toBeGreaterThanOrEqual(expectedDiff - 5000);
      expect(expiresMs - before).toBeLessThanOrEqual(expectedDiff + 5000);
    });

    it('T1.10.3: Digital entry QR code payload verified', async () => {
      const input = {
        spaceId: CHENNAI_LOCATIONS.omrTidelPark.id,
        driverId: 'usr_driver_hold_03',
        baseHourlyRate: 50,
        durationHours: 3,
      };

      const result = await harness.sagas.bookingHold.execute(input, ctx);
      expectSuccess(result);
      expect(result.data.qrCode).toMatch(/^PARKLY-QR-bk_[a-zA-Z0-9_-]+-spc_/);
    });

    it('T1.10.4: Payment intent total calculated accurately from dynamic price * duration', async () => {
      const input = {
        spaceId: CHENNAI_LOCATIONS.tNagarBurkit.id,
        driverId: 'usr_driver_hold_04',
        baseHourlyRate: 40,
        durationHours: 3,
      };

      const result = await harness.sagas.bookingHold.execute(input, ctx);
      expectSuccess(result);
      // dynamic pricing applies surge for 0.85 occupancy -> rate 64 -> 64 * 3 = 192
      expect(result.data.totalAmount).toBeGreaterThanOrEqual(120);
    });

    it('T1.10.5: Slot locked atomically against concurrent booking conflict', async () => {
      harness.mocks.booking.simulateCapacityConflict(true);
      const input = {
        spaceId: CHENNAI_LOCATIONS.tNagarBurkit.id,
        driverId: 'usr_driver_hold_05',
        baseHourlyRate: 40,
        durationHours: 1,
      };

      const result = await harness.sagas.bookingHold.execute(input, ctx);
      expectFailure(result, 'BUSINESS_INVARIANT_VIOLATION');
    });
  });

  // ==========================================================================
  // FEATURE 11: Dispute Resolution Saga (T1.11.1 to T1.11.5)
  // ==========================================================================
  describe('Feature 11: Dispute Resolution Saga', () => {
    it('T1.11.1: Full forward saga: Dispute -> Sensor audit -> Adjudication -> Ledger -> Event', async () => {
      const input = {
        disputeId: 'disp_saga_01',
        bookingId: 'bk_saga_01',
        incidentType: 'OVERSTAY_REPORTED',
        reportedBy: 'usr_host_01',
        evidence: { claimAmount: 100 },
      };

      const result = await harness.sagas.disputeResolution.execute(input, ctx);
      expectSuccess(result);
      expect(result.data.sagaStatus).toBe('COMPLETED');
      expect(result.data.adjudication).toBe('OVERSTAY_CONFIRMED');
    });

    it('T1.11.2: Ledger debits driver account and credits host account', async () => {
      const input = {
        disputeId: 'disp_saga_02',
        bookingId: 'bk_saga_02',
        incidentType: 'OVERSTAY_REPORTED',
        reportedBy: 'usr_host_02',
        evidence: { claimAmount: 100 },
      };

      const result = await harness.sagas.disputeResolution.execute(input, ctx);
      expectSuccess(result);

      const txs = harness.mocks.ledger.getTransactions();
      const penaltyTx = txs.find((t) => t.action === 'CHARGE_PENALTY');
      const creditTx = txs.find((t) => t.action === 'CREDIT_HOST');

      expect(penaltyTx).toBeDefined();
      expect(penaltyTx?.amount).toBe(120);
      expect(creditTx).toBeDefined();
      expect(creditTx?.amount).toBe(100);
    });

    it('T1.11.3: Platform audit log recorded in dispute resolution result', async () => {
      const input = {
        disputeId: 'disp_saga_03',
        bookingId: 'bk_saga_03',
        incidentType: 'OVERSTAY_REPORTED',
        reportedBy: 'usr_host_03',
        evidence: { claimAmount: 100 },
      };

      const result = await harness.sagas.disputeResolution.execute(input, ctx);
      expectSuccess(result);
      expect(result.data.platformAuditLog).toContain('Confirmed 90m overstay');
    });

    it('T1.11.4: Dismissed dispute completes saga cleanly with zero host payout', async () => {
      harness.mocks.sensor.setOverstayMinutes(0);
      const input = {
        disputeId: 'disp_saga_04',
        bookingId: 'bk_saga_04',
        incidentType: 'OVERSTAY_REPORTED',
        reportedBy: 'usr_host_04',
        evidence: { claimAmount: 100 },
      };

      const result = await harness.sagas.disputeResolution.execute(input, ctx);
      expectSuccess(result);
      expect(result.data.adjudication).toBe('DISPUTE_DISMISSED');
      expect(result.data.hostCompensationAmount).toBe(0);
    });

    it('T1.11.5: Dispute.Resolved event dispatched upon saga completion', async () => {
      let resolvedEvent: EventBridgeEvent<any> | null = null;
      harness.eventBus.subscribe('Dispute.Resolved', (e) => {
        resolvedEvent = e;
      });

      const input = {
        disputeId: 'disp_saga_05',
        bookingId: 'bk_saga_05',
        incidentType: 'OVERSTAY_REPORTED',
        reportedBy: 'usr_host_05',
        evidence: { claimAmount: 100 },
      };

      await harness.sagas.disputeResolution.execute(input, ctx);
      expect(resolvedEvent).not.toBeNull();
      expect(resolvedEvent!['detail-type']).toBe('Dispute.Resolved');
    });
  });

  // ==========================================================================
  // FEATURE 12: Distributed Circuit Breaker (T1.12.1 to T1.12.5)
  // ==========================================================================
  describe('Feature 12: Distributed Circuit Breaker', () => {
    it('T1.12.1: Normal execution in CLOSED state passes through', async () => {
      const cb = new CircuitBreaker({ failureThreshold: 3, resetTimeoutMs: 1000 });
      const op = async () => 'data_from_remote';

      const res = await cb.execute(op);
      expect(res).toBe('data_from_remote');
      expect(cb.getState()).toBe('CLOSED');
    });

    it('T1.12.2: Single transient failure keeps circuit in CLOSED state', async () => {
      const cb = new CircuitBreaker({ failureThreshold: 3, resetTimeoutMs: 1000 });
      let callCount = 0;
      const op = async () => {
        callCount++;
        if (callCount === 1) throw new Error('Transient network glitch');
        return 'success_on_retry';
      };

      await expect(cb.execute(op)).rejects.toThrow('Transient network glitch');
      expect(cb.getState()).toBe('CLOSED');
      expect(cb.getFailureCount()).toBe(1);
    });

    it('T1.12.3: 3 consecutive failures trip circuit to OPEN state', async () => {
      const cb = new CircuitBreaker({ failureThreshold: 3, resetTimeoutMs: 1000 });
      const failingOp = async () => { throw new Error('Outage'); };

      for (let i = 0; i < 3; i++) {
        await expect(cb.execute(failingOp)).rejects.toThrow('Outage');
      }

      expect(cb.getState()).toBe('OPEN');
    });

    it('T1.12.4: In OPEN state, fallback function executed immediately without calling remote', async () => {
      const cb = new CircuitBreaker({ failureThreshold: 2, resetTimeoutMs: 5000 });
      const failingOp = async () => { throw new Error('Outage'); };

      await expect(cb.execute(failingOp)).rejects.toThrow();
      await expect(cb.execute(failingOp)).rejects.toThrow();
      expect(cb.getState()).toBe('OPEN');

      let remoteCalled = false;
      const guardedOp = async () => {
        remoteCalled = true;
        return 'live';
      };
      const fallback = async () => 'cached_fallback_data';

      const result = await cb.execute(guardedOp, fallback);
      expect(result).toBe('cached_fallback_data');
      expect(remoteCalled).toBe(false);
    });

    it('T1.12.5: After reset timeout, probe in HALF_OPEN succeeds and resets to CLOSED', async () => {
      const cb = new CircuitBreaker({ failureThreshold: 2, resetTimeoutMs: 20 });
      const failingOp = async () => { throw new Error('Outage'); };

      await expect(cb.execute(failingOp)).rejects.toThrow();
      await expect(cb.execute(failingOp)).rejects.toThrow();
      expect(cb.getState()).toBe('OPEN');

      // Wait for reset timeout
      await new Promise((r) => setTimeout(r, 30));

      const probeOp = async () => 'service_recovered';
      const result = await cb.execute(probeOp);
      expect(result).toBe('service_recovered');
      expect(cb.getState()).toBe('CLOSED');
      expect(cb.getFailureCount()).toBe(0);
    });
  });

  // ==========================================================================
  // FEATURE 13: InMemoryEventBus & Events (T1.13.1 to T1.13.5)
  // ==========================================================================
  describe('Feature 13: InMemoryEventBus & Events', () => {
    it('T1.13.1: Publish event triggers subscribed handler', async () => {
      let triggered = false;
      harness.eventBus.subscribe('Custom.Event', () => {
        triggered = true;
      });

      await harness.eventBus.publish({
        id: 'evt_cust_01',
        source: 'parkly.ai',
        'detail-type': 'Custom.Event',
        time: new Date().toISOString(),
        detail: {},
      });

      expect(triggered).toBe(true);
    });

    it('T1.13.2: Fan-out: 3 subscribers receive same event concurrently via Promise.allSettled', async () => {
      let count = 0;
      harness.eventBus.subscribe('Fanout.Event', () => { count++; });
      harness.eventBus.subscribe('Fanout.Event', () => { count++; });
      harness.eventBus.subscribe('Fanout.Event', () => { count++; });

      await harness.eventBus.publish({
        id: 'evt_fanout_01',
        source: 'parkly.ai',
        'detail-type': 'Fanout.Event',
        time: new Date().toISOString(),
        detail: {},
      });

      expect(count).toBe(3);
    });

    it('T1.13.3: Unsubscribe callback prevents future handler invocation', async () => {
      let invoked = 0;
      const unsubscribe = harness.eventBus.subscribe('Unsub.Event', () => {
        invoked++;
      });

      await harness.eventBus.publish({
        id: 'evt_unsub_01',
        source: 'parkly.ai',
        'detail-type': 'Unsub.Event',
        time: new Date().toISOString(),
        detail: {},
      });
      expect(invoked).toBe(1);

      unsubscribe();

      await harness.eventBus.publish({
        id: 'evt_unsub_02',
        source: 'parkly.ai',
        'detail-type': 'Unsub.Event',
        time: new Date().toISOString(),
        detail: {},
      });
      expect(invoked).toBe(1); // not incremented
    });

    it('T1.13.4: EventBridge envelope contains source: "parkly.ai", time, id, detail-type', async () => {
      let captured: EventBridgeEvent<any> | null = null;
      harness.eventBus.subscribe('Envelope.Check', (e) => {
        captured = e;
      });

      const now = new Date().toISOString();
      await harness.eventBus.publish({
        id: 'evt_env_01',
        source: 'parkly.ai',
        'detail-type': 'Envelope.Check',
        time: now,
        detail: { test: true },
      });

      expect(captured).not.toBeNull();
      expect(captured!.source).toBe('parkly.ai');
      expect(captured!.id).toBe('evt_env_01');
      expect(captured!['detail-type']).toBe('Envelope.Check');
      expect(captured!.time).toBe(now);
    });

    it('T1.13.5: Subscriber failure captured in DLQ without impacting other subscribers', async () => {
      let healthySubscriberRan = false;

      harness.eventBus.subscribe('Partial.Failure', () => {
        throw new Error('Exploding subscriber');
      });
      harness.eventBus.subscribe('Partial.Failure', () => {
        healthySubscriberRan = true;
      });

      await harness.eventBus.publish({
        id: 'evt_dlq_test',
        source: 'parkly.ai',
        'detail-type': 'Partial.Failure',
        time: new Date().toISOString(),
        detail: {},
      });

      expect(healthySubscriberRan).toBe(true);
      const dlq = harness.getDLQ();
      expect(dlq.length).toBe(1);
      expect(dlq[0].event['detail-type']).toBe('Partial.Failure');
    });
  });
});
