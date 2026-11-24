import { describe, it, expect, beforeEach } from 'vitest';
import {
  OccupancyPredictorAgent,
  MockOccupancyQueryProvider,
  ExecutionContext,
} from '../../../src';

describe('OccupancyPredictorAgent Unit & Invariant Tests', () => {
  let occupancyTool: MockOccupancyQueryProvider;
  let agent: OccupancyPredictorAgent;
  let ctx: ExecutionContext;

  beforeEach(() => {
    occupancyTool = new MockOccupancyQueryProvider();
    agent = new OccupancyPredictorAgent({ occupancyTool });
    ctx = new ExecutionContext({ correlationId: 'test-corr-id' });
  });

  it('predicts vacancy probability from historical timeseries data within latency budget', async () => {
    occupancyTool.simulateLatencyMs(10); // Well under 150ms

    const res = await agent.execute(
      {
        spaceId: 'spc_annanagar_round_01',
        targetArrivalTime: new Date().toISOString(),
        targetDurationMinutes: 120,
      },
      ctx
    );

    expect(res.success).toBe(true);
    if (!res.success) return;

    expect(res.data.spaceId).toBe('spc_annanagar_round_01');
    expect(res.data.arrivalProbability).toBeGreaterThan(0);
    expect(res.data.confidenceScore).toBe(0.85);
    expect(res.data.demandTier).toBe('PEAK_COMMUTE');
  });

  it('invariant: triggers heuristic fallback when model latency exceeds 150ms threshold', async () => {
    occupancyTool.simulateLatencyMs(180); // Exceeds 150ms invariant threshold

    const res = await agent.execute(
      {
        spaceId: 'spc_tnagar_burkit_01',
        targetArrivalTime: new Date().toISOString(),
        targetDurationMinutes: 60,
      },
      ctx
    );

    expect(res.success).toBe(true);
    if (!res.success) return;

    expect(res.data.demandTier).toBe('HEURISTIC_FALLBACK');
    expect(res.data.contextualFactors).toContain('LATENCY_TIMEOUT_FALLBACK_TRIGGERED');
    expect(res.data.confidenceScore).toBe(0.5);
  });
});
