import { describe, it, expect, beforeEach } from 'vitest';
import {
  HostOnboardingAgent,
  MockOcrProvider,
  MockGeocodingProvider,
  MockZoningProvider,
  ExecutionContext,
  MOCK_DOCUMENTS,
} from '../../../src';

describe('HostOnboardingAgent Unit & Invariant Tests', () => {
  let ocrTool: MockOcrProvider;
  let geocodingTool: MockGeocodingProvider;
  let zoningTool: MockZoningProvider;
  let agent: HostOnboardingAgent;
  let ctx: ExecutionContext;

  beforeEach(() => {
    ocrTool = new MockOcrProvider();
    geocodingTool = new MockGeocodingProvider();
    zoningTool = new MockZoningProvider();
    agent = new HostOnboardingAgent({ ocrTool, geocodingTool, zoningTool });
    ctx = new ExecutionContext({ correlationId: 'test-corr-id' });
  });

  it('successfully auto-verifies valid residential host KYC submission', async () => {
    const res = await agent.execute(
      {
        userId: 'usr_suresh_01',
        rawAddress: '14 Burkit Road, T. Nagar, Chennai, Tamil Nadu 600017',
        documentUrls: [MOCK_DOCUMENTS.validPan.url],
        declaredSlots: 2,
        vehicleTypes: ['sedan', 'suv'],
      },
      ctx
    );

    expect(res.success).toBe(true);
    if (!res.success) return;

    expect(res.data.hostId).toBe('host_usr_suresh_01');
    expect(res.data.kycStatus).toBe('VERIFIED_AUTO');
    expect(res.data.confidenceScore).toBeGreaterThanOrEqual(0.85);
    expect(res.data.geocoding.latitude).toBeCloseTo(13.0382, 3);
    expect(res.data.geocoding.geohash).toBe('tf341tw');
    expect(res.data.zoningCompliance).toBe('RESIDENTIAL_PERMITTED');
  });

  it('invariant: flags MANUAL_REVIEW_REQUIRED when OCR confidence < 0.85', async () => {
    const res = await agent.execute(
      {
        userId: 'usr_suresh_02',
        rawAddress: '14 Burkit Road, T. Nagar, Chennai, Tamil Nadu 600017',
        documentUrls: [MOCK_DOCUMENTS.blurryPan.url], // blurry PAN has confidence 0.71
        declaredSlots: 1,
        vehicleTypes: ['compact'],
      },
      ctx
    );

    expect(res.success).toBe(true);
    if (!res.success) return;

    expect(res.data.kycStatus).toBe('MANUAL_REVIEW_REQUIRED');
    expect(res.data.confidenceScore).toBeLessThan(0.85);
  });

  it('invariant: flags MANUAL_REVIEW_REQUIRED when zoning is non-residential', async () => {
    zoningTool.setOverrideStatus('NON_RESIDENTIAL_PROHIBITED');

    const res = await agent.execute(
      {
        userId: 'usr_suresh_03',
        rawAddress: '14 Burkit Road, T. Nagar, Chennai, Tamil Nadu 600017',
        documentUrls: [MOCK_DOCUMENTS.validPan.url],
        declaredSlots: 2,
        vehicleTypes: ['sedan'],
      },
      ctx
    );

    expect(res.success).toBe(true);
    if (!res.success) return;

    expect(res.data.kycStatus).toBe('MANUAL_REVIEW_REQUIRED');
    expect(res.data.zoningCompliance).toBe('NON_RESIDENTIAL_PROHIBITED');
  });

  it('fails with validation error when input payload violates Zod schema', async () => {
    const res = await agent.execute(
      {
        userId: '', // invalid: min(1) required
        rawAddress: 'Chennai',
        documentUrls: [],
        declaredSlots: -1, // invalid: positive integer required
        vehicleTypes: [],
      },
      ctx
    );

    expect(res.success).toBe(false);
    if (res.success) return;
    expect(res.error.code).toBe('VALIDATION_ERROR');
  });
});
