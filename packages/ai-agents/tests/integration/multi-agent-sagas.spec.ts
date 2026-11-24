import { describe, it, expect, beforeEach } from 'vitest';
import {
  HostOnboardingAgent,
  VisualInspectionAgent,
  OccupancyPredictorAgent,
  DynamicPricingAgent,
  DriverConciergeAgent,
  DisputeMediationAgent,
  MockOcrProvider,
  MockGeocodingProvider,
  MockZoningProvider,
  MockVisionProvider,
  MockOccupancyQueryProvider,
  MockPricingEngineProvider,
  MockSearchServiceProvider,
  MockBookingServiceProvider,
  MockTrafficMonitorProvider,
  MockSensorVerificationProvider,
  MockPaymentLedgerProvider,
  MockNotificationProvider,
  InMemoryEventBus,
  InMemorySagaStore,
  HostOnboardingSaga,
  BookingHoldSaga,
  DisputeResolutionSaga,
  ExecutionContext,
  DOMAIN_EVENTS,
  MOCK_DOCUMENTS,
  CircuitBreaker,
} from '../../src';

describe('Multi-Agent Distributed Sagas & Event Choreography', () => {
  let eventBus: InMemoryEventBus;
  let sagaStore: InMemorySagaStore;
  let ctx: ExecutionContext;

  beforeEach(() => {
    eventBus = new InMemoryEventBus();
    sagaStore = new InMemorySagaStore();
    ctx = new ExecutionContext({ correlationId: 'saga-integration-test-01' });
  });

  describe('Host Onboarding Saga Flow', () => {
    it('executes full KYC -> Geocode -> Inspection -> Activation pipeline', async () => {
      const ocrTool = new MockOcrProvider();
      const geocodingTool = new MockGeocodingProvider();
      const zoningTool = new MockZoningProvider();
      const visionTool = new MockVisionProvider();

      const hostAgent = new HostOnboardingAgent({ ocrTool, geocodingTool, zoningTool });
      const visualAgent = new VisualInspectionAgent({ visionTool });

      let auditedEventEmitted = false;
      eventBus.subscribe(DOMAIN_EVENTS.SPACE_VISUALLY_AUDITED, (ev) => {
        auditedEventEmitted = true;
        expect(ev.correlationId).toBe(ctx.correlationId);
      });

      const saga = new HostOnboardingSaga(hostAgent, visualAgent, eventBus, sagaStore);

      const result = await saga.execute(
        {
          userId: 'usr_chennai_host_99',
          rawAddress: '14 Burkit Road, T. Nagar, Chennai, Tamil Nadu 600017',
          documentUrls: [MOCK_DOCUMENTS.validPan.url],
          declaredSlots: 2,
          vehicleTypes: ['sedan', 'suv'],
        },
        ctx
      );

      expect(result.success).toBe(true);
      if (!result.success) return;

      expect(result.data.sagaStatus).toBe('COMPLETED');
      expect(result.data.hostId).toBe('host_usr_chennai_host_99');
      expect(result.data.listingActive).toBe(true);
      expect(auditedEventEmitted).toBe(true);
    });

    it('pauses saga at MANUAL_REVIEW_REQUIRED on blurry identity document without activating listing', async () => {
      const ocrTool = new MockOcrProvider();
      const geocodingTool = new MockGeocodingProvider();
      const zoningTool = new MockZoningProvider();
      const visionTool = new MockVisionProvider();

      const hostAgent = new HostOnboardingAgent({ ocrTool, geocodingTool, zoningTool });
      const visualAgent = new VisualInspectionAgent({ visionTool });

      const saga = new HostOnboardingSaga(hostAgent, visualAgent, eventBus, sagaStore);

      const result = await saga.execute(
        {
          userId: 'usr_chennai_host_100',
          rawAddress: '14 Burkit Road, T. Nagar, Chennai',
          documentUrls: [MOCK_DOCUMENTS.blurryPan.url],
          declaredSlots: 1,
          vehicleTypes: ['compact'],
        },
        ctx
      );

      expect(result.success).toBe(true);
      if (!result.success) return;

      expect(result.data.sagaStatus).toBe('PAUSED_MANUAL_REVIEW');
      expect(result.data.listingActive).toBeUndefined();
    });
  });

  describe('Booking Hold Saga Flow', () => {
    it('executes Vacancy Prediction -> Dynamic Pricing -> 10-Minute Hold -> QR Code issuance', async () => {
      const occupancyTool = new MockOccupancyQueryProvider();
      const pricingEngineTool = new MockPricingEngineProvider();
      const searchTool = new MockSearchServiceProvider();
      const bookingTool = new MockBookingServiceProvider();
      const trafficTool = new MockTrafficMonitorProvider();

      const predictorAgent = new OccupancyPredictorAgent({ occupancyTool });
      const pricingAgent = new DynamicPricingAgent({ pricingEngineTool });
      const conciergeAgent = new DriverConciergeAgent({ searchTool, bookingTool, trafficTool });

      const saga = new BookingHoldSaga(predictorAgent, pricingAgent, conciergeAgent, bookingTool, eventBus);

      const result = await saga.execute(
        {
          spaceId: 'spc_tnagar_burkit_01',
          driverId: 'usr_driver_77',
          baseHourlyRate: 40,
          durationHours: 2,
        },
        ctx
      );

      expect(result.success).toBe(true);
      if (!result.success) return;

      expect(result.data.sagaStatus).toBe('COMPLETED');
      expect(result.data.bookingId).toBeDefined();
      expect(result.data.holdExpiresAt).toBeDefined();
      expect(result.data.qrCode).toContain('PARKLY-QR');
      expect(result.data.totalAmount).toBeGreaterThanOrEqual(80); // 40 * 2 with potential surge
    });
  });

  describe('Dispute Resolution Saga Flow', () => {
    it('executes overstay audit -> penalty charge -> host credit -> event emission', async () => {
      const sensorTool = new MockSensorVerificationProvider();
      const ledgerTool = new MockPaymentLedgerProvider();
      const notificationTool = new MockNotificationProvider();

      const disputeAgent = new DisputeMediationAgent({ sensorTool, ledgerTool, notificationTool });

      let disputeResolvedEvent = false;
      eventBus.subscribe(DOMAIN_EVENTS.DISPUTE_RESOLVED, (ev) => {
        disputeResolvedEvent = true;
      });

      const saga = new DisputeResolutionSaga(disputeAgent, sensorTool, ledgerTool, eventBus);

      const result = await saga.execute(
        {
          disputeId: 'dsp_overstay_1092',
          bookingId: 'bk_8821',
          incidentType: 'OVERSTAY_REPORTED',
          reportedBy: 'host_01',
          evidence: { claimAmount: 100 },
        },
        ctx
      );

      expect(result.success).toBe(true);
      if (!result.success) return;

      expect(result.data.sagaStatus).toBe('COMPLETED');
      expect(result.data.adjudication).toBe('OVERSTAY_CONFIRMED');
      expect(result.data.hostCompensationAmount).toBe(100);
      expect(disputeResolvedEvent).toBe(true);
    });
  });

  describe('Circuit Breaker Fallback Integration', () => {
    it('trips circuit breaker after consecutive external tool failures and routes to fallback', async () => {
      const breaker = new CircuitBreaker({
        failureThreshold: 2,
        resetTimeoutMs: 1000,
        name: 'ThirdPartyVisionServiceBreaker',
      });

      let callCount = 0;
      const unstableApiCall = async () => {
        callCount++;
        throw new Error('External Vision API 503 Service Unavailable');
      };

      // Call 1: fails
      await expect(breaker.execute(unstableApiCall)).rejects.toThrow();
      expect(breaker.getState()).toBe('CLOSED');

      // Call 2: fails -> trips breaker to OPEN
      await expect(breaker.execute(unstableApiCall)).rejects.toThrow();
      expect(breaker.getState()).toBe('OPEN');

      // Call 3: fast-fails with fallback without hitting unstable API
      const fallbackResult = await breaker.execute(unstableApiCall, async () => {
        return { fallbackUsed: true, cachedResult: 'MANUAL_REVIEW' };
      });

      expect(callCount).toBe(2); // Never invoked third time
      expect(fallbackResult).toEqual({ fallbackUsed: true, cachedResult: 'MANUAL_REVIEW' });
    });
  });
});
