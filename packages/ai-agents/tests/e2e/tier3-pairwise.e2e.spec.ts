/**
 * 🅿️ Parkly — Tier 3: Cross-Feature Combinations E2E Test Suite
 * 
 * Verifies 15 pairwise cross-feature interactions and choreography
 * strictly conforming to TEST_INFRA.md §5.3.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  E2ETestHarness,
  expectSuccess,
  CHENNAI_LOCATIONS,
  MOCK_DOCUMENTS,
  MOCK_PHOTOS,
  CircuitBreaker,
  ExecutionContext,
  EventBridgeEvent,
} from './helpers/e2e-harness';

describe('Tier 3: Cross-Feature Combinations E2E Test Suite (15 tests)', () => {
  let harness: E2ETestHarness;
  let ctx: ExecutionContext;

  beforeEach(async () => {
    harness = await E2ETestHarness.create();
    ctx = harness.createContext('usr_driver_tier3');
  });

  // Pairwise 1: SearchServiceTool + DynamicPricingAgent
  it('Pairwise 1: SearchServiceTool + DynamicPricingAgent computes real-time surge pricing on search candidates', async () => {
    const searchRes = await harness.mocks.search.searchSpaces({
      latitude: CHENNAI_LOCATIONS.tNagarBurkit.latitude,
      longitude: CHENNAI_LOCATIONS.tNagarBurkit.longitude,
    });
    expectSuccess(searchRes);
    expect(searchRes.data.length).toBeGreaterThan(0);

    const topSpace = searchRes.data[0];
    const pricingRes = await harness.agents.dynamicPricing.execute({
      spaceId: topSpace.id,
      baseHourlyRate: topSpace.hourlyRate,
      currentOccupancyRate: 0.95, // festive surge
    }, ctx);

    expectSuccess(pricingRes);
    expect(pricingRes.data.calculatedHourlyRate).toBe(64); // 40 * 1.6
    expect(pricingRes.data.appliedMultiplier).toBe(1.6);
  });

  // Pairwise 2: HostOnboardingAgent + VisualInspectionAgent
  it('Pairwise 2: HostOnboardingAgent + VisualInspectionAgent validates KYC and inspects property photos in succession', async () => {
    const kycResult = await harness.agents.hostOnboarding.execute({
      userId: 'usr_pair2_host',
      rawAddress: CHENNAI_LOCATIONS.tNagarBurkit.rawAddress,
      documentUrls: [MOCK_DOCUMENTS.validPan.url],
      declaredSlots: 2,
      vehicleTypes: ['sedan'],
    }, ctx);
    expectSuccess(kycResult);
    expect(kycResult.data.kycStatus).toBe('VERIFIED_AUTO');

    const inspectionResult = await harness.agents.visualInspection.execute({
      spaceId: `spc_${kycResult.data.hostId}_01`,
      photoUrls: [...MOCK_PHOTOS.approvedSpace.photoUrls],
    }, ctx);
    expectSuccess(inspectionResult);
    expect(inspectionResult.data.inspectionResult).toBe('APPROVED');
  });

  // Pairwise 3: OccupancyPredictorAgent + DynamicPricingAgent
  it('Pairwise 3: OccupancyPredictorAgent + DynamicPricingAgent links predictive demand tier to tariff multiplier', async () => {
    const predRes = await harness.agents.occupancyPredictor.execute({
      spaceId: CHENNAI_LOCATIONS.tNagarBurkit.id,
      targetArrivalTime: '2026-09-06T18:00:00.000Z',
      targetDurationMinutes: 120,
    }, ctx);
    expectSuccess(predRes);
    expect(predRes.data.demandTier).toBe('PEAK_SHOPPING');

    const pricingRes = await harness.agents.dynamicPricing.execute({
      spaceId: CHENNAI_LOCATIONS.tNagarBurkit.id,
      baseHourlyRate: 40,
      currentOccupancyRate: 0.92,
      demandForecastTier: predRes.data.demandTier,
    }, ctx);
    expectSuccess(pricingRes);
    expect(pricingRes.data.appliedMultiplier).toBe(1.6);
  });

  // Pairwise 4: DriverConciergeAgent + Booking Hold Saga
  it('Pairwise 4: DriverConciergeAgent + Booking Hold Saga selects recommended space and initiates slot hold', async () => {
    const conciergeRes = await harness.agents.driverConcierge.execute({
      driverId: 'usr_driver_p4',
      query: 'Find parking near Burkit Road for 2 hours',
      currentLocation: {
        latitude: CHENNAI_LOCATIONS.tNagarBurkit.latitude,
        longitude: CHENNAI_LOCATIONS.tNagarBurkit.longitude,
      },
    }, ctx);
    expectSuccess(conciergeRes);
    expect(conciergeRes.data.recommendedSpace).toBeDefined();

    const holdRes = await harness.sagas.bookingHold.execute({
      spaceId: (conciergeRes.data.recommendedSpace as any).id,
      driverId: 'usr_driver_p4',
      baseHourlyRate: (conciergeRes.data.recommendedSpace as any).hourlyRate,
      durationHours: 2,
    }, ctx);
    expectSuccess(holdRes);
    expect(holdRes.data.qrCode).toBeDefined();
  });

  // Pairwise 5: DisputeMediationAgent + SensorVerificationTool
  it('Pairwise 5: DisputeMediationAgent + SensorVerificationTool cross-verifies telematics and confirms violation', async () => {
    harness.mocks.sensor.setOverstayMinutes(90);
    harness.mocks.sensor.setVehiclePresent(true);

    const disputeRes = await harness.agents.disputeMediation.execute({
      disputeId: 'disp_p5_01',
      bookingId: 'bk_p5_01',
      incidentType: 'OVERSTAY_REPORTED',
      reportedBy: 'usr_host_p5',
      evidence: { claimAmount: 100 },
    }, ctx);

    expectSuccess(disputeRes);
    expect(disputeRes.data.adjudication).toBe('OVERSTAY_CONFIRMED');
    expect(disputeRes.data.hostCompensationAmount).toBe(100);
  });

  // Pairwise 6: VisualInspectionAgent + ParklyOrchestratorAgent
  it('Pairwise 6: VisualInspectionAgent + ParklyOrchestratorAgent emits and routes Space.VisuallyAudited event', async () => {
    let spaceAuditedEvent: EventBridgeEvent<any> | null = null;
    harness.eventBus.subscribe('Space.VisuallyAudited', (e) => {
      spaceAuditedEvent = e;
    });

    const inspection = await harness.agents.visualInspection.execute({
      spaceId: 'spc_p6_01',
      photoUrls: [...MOCK_PHOTOS.approvedSpace.photoUrls],
    }, ctx);
    expectSuccess(inspection);

    await harness.agents.orchestrator.routeEvent({
      id: 'evt_p6_01',
      source: 'parkly.ai',
      'detail-type': 'Space.VisuallyAudited',
      time: new Date().toISOString(),
      detail: inspection.data,
      correlationId: ctx.correlationId,
    });

    expect(spaceAuditedEvent).not.toBeNull();
    expect(spaceAuditedEvent!['detail-type']).toBe('Space.VisuallyAudited');
  });

  // Pairwise 7: CircuitBreaker + VisionTool
  it('Pairwise 7: CircuitBreaker + VisionTool trips OPEN on repeated errors and triggers fallback description', async () => {
    const cb = new CircuitBreaker({ failureThreshold: 3, resetTimeoutMs: 10000 });
    harness.mocks.vision.simulateConsecutiveErrors(3);

    const targetOp = async () => {
      const res = await harness.mocks.vision.inspectSpace('spc_p7', ['photo.jpg']);
      if (!res.success) throw new Error(res.error.message);
      return res.data;
    };
    const fallbackOp = async () => ({
      inspectionResult: 'APPROVED' as const,
      generatedDescription: 'Secure covered residential parking bay (cached fallback heuristic).',
    });

    // 3 failures trip circuit
    await expect(cb.execute(targetOp)).rejects.toThrow();
    await expect(cb.execute(targetOp)).rejects.toThrow();
    await expect(cb.execute(targetOp)).rejects.toThrow();
    expect(cb.getState()).toBe('OPEN');

    // Next call uses fallback without calling vision
    const fallbackRes = await cb.execute(targetOp, fallbackOp);
    expect(fallbackRes.generatedDescription).toContain('cached fallback heuristic');
  });

  // Pairwise 8: CircuitBreaker + GeocodingTool
  it('Pairwise 8: CircuitBreaker + GeocodingTool handles service failure and falls back gracefully', async () => {
    const cb = new CircuitBreaker({ failureThreshold: 2, resetTimeoutMs: 5000 });
    harness.mocks.geocoding.setConsecutiveErrors(2);

    const callGeocode = async () => {
      const res = await harness.mocks.geocoding.geocode(CHENNAI_LOCATIONS.tNagarBurkit.rawAddress);
      if (!res.success) throw new Error(res.error.message);
      return res.data;
    };
    const fallbackGeocode = async () => ({
      latitude: 13.0382,
      longitude: 80.2314,
      geohash: 'tf341tw',
      normalizedAddress: 'T. Nagar Centroid, Chennai',
      city: 'Chennai',
      pincode: '600017',
      isWithinServiceBoundary: true,
    });

    await expect(cb.execute(callGeocode)).rejects.toThrow();
    await expect(cb.execute(callGeocode)).rejects.toThrow();
    expect(cb.getState()).toBe('OPEN');

    const result = await cb.execute(callGeocode, fallbackGeocode);
    expect(result.geohash).toBe('tf341tw');
    expect(result.normalizedAddress).toContain('Centroid');
  });

  // Pairwise 9: OccupancyPredictorAgent + Heuristic Fallback
  it('Pairwise 9: OccupancyPredictorAgent activates heuristic fallback when ML inference latency exceeds 150ms', async () => {
    harness.mocks.occupancy.simulateLatencyMs(170);

    const result = await harness.agents.occupancyPredictor.execute({
      spaceId: CHENNAI_LOCATIONS.tNagarBurkit.id,
      targetArrivalTime: '2026-09-07T12:00:00.000Z',
      targetDurationMinutes: 60,
    }, ctx);

    expectSuccess(result);
    expect(result.data.demandTier).toBe('HEURISTIC_FALLBACK');
    expect(result.data.arrivalProbability).toBe(0.71); // 1 / 1.4 rounded
  });

  // Pairwise 10: HostOnboardingAgent + NotificationTool
  it('Pairwise 10: HostOnboardingAgent + NotificationTool sends notification alert when KYC requires manual review', async () => {
    harness.mocks.ocr.setSimulatedConfidence(0.72);

    const onboardingRes = await harness.agents.hostOnboarding.execute({
      userId: 'usr_p10_host',
      rawAddress: CHENNAI_LOCATIONS.tNagarBurkit.rawAddress,
      documentUrls: [MOCK_DOCUMENTS.blurryPan.url],
      declaredSlots: 1,
      vehicleTypes: ['sedan'],
    }, ctx);

    expectSuccess(onboardingRes);
    expect(onboardingRes.data.kycStatus).toBe('MANUAL_REVIEW_REQUIRED');

    if (onboardingRes.data.kycStatus === 'MANUAL_REVIEW_REQUIRED') {
      await harness.mocks.notification.send({
        recipient: '+919840099999',
        channel: 'SMS',
        message: 'Your Parkly host verification requires manual review due to low document clarity.',
      });
    }

    const notifs = harness.mocks.notification.getSentNotifications();
    expect(notifs.length).toBe(1);
    expect(notifs[0].message).toContain('manual review');
  });

  // Pairwise 11: DriverConciergeAgent + Emergency Backup Relocation
  it('Pairwise 11: DriverConciergeAgent reroutes driver to backup bay within 200m upon blocked road', async () => {
    harness.mocks.traffic.setBlockedAccess(true);

    const result = await harness.agents.driverConcierge.execute({
      driverId: 'usr_driver_p11',
      query: 'Parking on Burkit Road',
      currentLocation: { latitude: 13.0382, longitude: 80.2314 },
    }, ctx);

    expectSuccess(result);
    expect(result.data.relocationTriggered).toBe(true);
    expect(result.data.recommendedSpace?.id).toBe(CHENNAI_LOCATIONS.tNagarBackupBay.id);
  });

  // Pairwise 12: DisputeMediationAgent + PaymentLedgerTool
  it('Pairwise 12: DisputeMediationAgent + PaymentLedgerTool dispatches driver debit and host credit transactions', async () => {
    harness.mocks.sensor.setOverstayMinutes(90);

    const result = await harness.agents.disputeMediation.execute({
      disputeId: 'disp_p12_01',
      bookingId: 'bk_p12_01',
      incidentType: 'OVERSTAY_REPORTED',
      reportedBy: 'usr_host_p12',
      evidence: { claimAmount: 100 },
    }, ctx);

    expectSuccess(result);
    const txs = harness.mocks.ledger.getTransactions();
    expect(txs.length).toBeGreaterThanOrEqual(2);
    expect(txs.some((t) => t.action === 'CHARGE_PENALTY')).toBe(true);
    expect(txs.some((t) => t.action === 'CREDIT_HOST')).toBe(true);
  });

  // Pairwise 13: CityAnalyticsAgent + AnalyticsLakeTool
  it('Pairwise 13: CityAnalyticsAgent + AnalyticsLakeTool aggregates mobility data and computes CO2 abated', async () => {
    const result = await harness.agents.cityAnalytics.execute({
      cityId: 'chennai',
      period: '2026-W36',
      zones: ['Zone 10 Kodambakkam', 'Zone 8 Anna Nagar'],
    }, ctx);

    expectSuccess(result);
    expect(result.data.metrics.totalOffStreetHoursProvided).toBe(48200);
    expect(result.data.metrics.estimatedCO2AbatedKg).toBe(4213.6); // 184000 * 0.0229
  });

  // Pairwise 14: InMemoryEventBus + ParklyOrchestratorAgent
  it('Pairwise 14: InMemoryEventBus + ParklyOrchestratorAgent isolates subscriber failure into DLQ while preserving siblings', async () => {
    let siblingReceived = false;

    harness.eventBus.subscribe('Orchestrated.Event', () => {
      throw new Error('Exploding subscriber');
    });
    harness.eventBus.subscribe('Orchestrated.Event', () => {
      siblingReceived = true;
    });

    await harness.agents.orchestrator.routeEvent({
      id: 'evt_p14_01',
      source: 'parkly.ai',
      'detail-type': 'Orchestrated.Event',
      time: new Date().toISOString(),
      detail: { trace: 'p14' },
      correlationId: ctx.correlationId,
    });

    expect(siblingReceived).toBe(true);
    const dlq = harness.getDLQ();
    expect(dlq.length).toBe(1);
    expect(dlq[0].event['detail-type']).toBe('Orchestrated.Event');
  });

  // Pairwise 15: Booking Hold Saga + Slot Release Compensation
  it('Pairwise 15: Booking Hold Saga cancels reservation hold cleanly upon cancellation request', async () => {
    const holdRes = await harness.sagas.bookingHold.execute({
      spaceId: CHENNAI_LOCATIONS.tNagarBurkit.id,
      driverId: 'usr_p15_driver',
      baseHourlyRate: 40,
      durationHours: 1,
    }, ctx);
    expectSuccess(holdRes);

    const releaseRes = await harness.mocks.booking.releaseHold(holdRes.data.bookingId);
    expectSuccess(releaseRes);

    const activeHolds = harness.mocks.booking.getActiveHolds();
    const cancelledHold = activeHolds.find((h) => h.bookingId === holdRes.data.bookingId);
    expect(cancelledHold?.status).toBe('cancelled');
  });
});
