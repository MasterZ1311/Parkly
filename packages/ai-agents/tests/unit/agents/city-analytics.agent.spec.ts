import { describe, it, expect, beforeEach } from 'vitest';
import {
  CityAnalyticsAgent,
  MockAnalyticsLakeProvider,
  ExecutionContext,
} from '../../../src';

describe('CityAnalyticsAgent Unit & Invariant Tests', () => {
  let analyticsLakeTool: MockAnalyticsLakeProvider;
  let agent: CityAnalyticsAgent;
  let ctx: ExecutionContext;

  beforeEach(() => {
    analyticsLakeTool = new MockAnalyticsLakeProvider();
    agent = new CityAnalyticsAgent({ analyticsLakeTool });
    ctx = new ExecutionContext({ correlationId: 'test-corr-id' });
  });

  it('aggregates mobility metrics and computes abated CO2 for target city zones', async () => {
    const res = await agent.execute(
      {
        cityId: 'chennai',
        period: '2026-W36',
        zones: ['T_NAGAR', 'OMR_PHASE1', 'ANNA_NAGAR'],
      },
      ctx
    );

    expect(res.success).toBe(true);
    if (!res.success) return;

    expect(res.data.cityId).toBe('chennai');
    expect(res.data.metrics.totalOffStreetHoursProvided).toBe(48200);
    expect(res.data.metrics.estimatedCurbsideCruisingReducedMinutes).toBe(184000);
    // Invariant: 184000 * 0.0229 = 4213.6 kg CO2 abated
    expect(res.data.metrics.estimatedCO2AbatedKg).toBeCloseTo(4213.6, 1);
    expect(res.data.metrics.unmetDemandChokePoints.length).toBeGreaterThan(0);
    expect(res.data.recommendation).toBeDefined();
  });

  it('fails with validation error when period does not match ISO week format', async () => {
    const res = await agent.execute(
      {
        cityId: 'chennai',
        period: '2026-09-05', // Invalid format; expects YYYY-Www
        zones: ['T_NAGAR'],
      },
      ctx
    );

    expect(res.success).toBe(false);
    if (res.success) return;
    expect(res.error.code).toBe('VALIDATION_ERROR');
  });
});
