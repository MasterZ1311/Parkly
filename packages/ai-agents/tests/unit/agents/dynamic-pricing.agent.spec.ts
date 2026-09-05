import { describe, it, expect, beforeEach } from 'vitest';
import {
  DynamicPricingAgent,
  MockPricingEngineProvider,
  ExecutionContext,
} from '../../../src';

describe('DynamicPricingAgent Unit & Invariant Tests', () => {
  let pricingEngineTool: MockPricingEngineProvider;
  let agent: DynamicPricingAgent;
  let ctx: ExecutionContext;

  beforeEach(() => {
    pricingEngineTool = new MockPricingEngineProvider();
    agent = new DynamicPricingAgent({ pricingEngineTool });
    ctx = new ExecutionContext({ correlationId: 'test-corr-id' });
  });

  it('calculates surge tariff during high occupancy rush', async () => {
    const res = await agent.execute(
      {
        spaceId: 'spc_tnagar_burkit_01',
        baseHourlyRate: 40,
        currentOccupancyRate: 0.95, // Peak demand
        hostPricingPreferences: { allowDynamic: true, maxMultiplier: 2.0 },
      },
      ctx
    );

    expect(res.success).toBe(true);
    if (!res.success) return;

    expect(res.data.spaceId).toBe('spc_tnagar_burkit_01');
    expect(res.data.calculatedHourlyRate).toBe(64); // 40 * 1.6
    expect(res.data.appliedMultiplier).toBe(1.6);
    expect(res.data.surgeReason).toBe('PEAK_SHOPPING_SURGE');
  });

  it('invariant: calculated rate is never below base rate even during low demand', async () => {
    const res = await agent.execute(
      {
        spaceId: 'spc_low_demand_01',
        baseHourlyRate: 50,
        currentOccupancyRate: 0.15, // Low demand attempts 0.9 multiplier
        hostPricingPreferences: { allowDynamic: true, maxMultiplier: 2.0 },
      },
      ctx
    );

    expect(res.success).toBe(true);
    if (!res.success) return;

    expect(res.data.calculatedHourlyRate).toBeGreaterThanOrEqual(50);
    expect(res.data.appliedMultiplier).toBeGreaterThanOrEqual(1.0);
  });

  it('invariant: calculated rate never exceeds maxMultiplier * baseHourlyRate', async () => {
    const res = await agent.execute(
      {
        spaceId: 'spc_capped_01',
        baseHourlyRate: 100,
        currentOccupancyRate: 0.99, // Surge attempts 1.6
        hostPricingPreferences: { allowDynamic: true, maxMultiplier: 1.25 }, // Capped at 1.25
      },
      ctx
    );

    expect(res.success).toBe(true);
    if (!res.success) return;

    expect(res.data.calculatedHourlyRate).toBe(125);
    expect(res.data.appliedMultiplier).toBe(1.25);
  });

  it('reverts to baseHourlyRate when dynamic pricing is disabled by host', async () => {
    const res = await agent.execute(
      {
        spaceId: 'spc_fixed_01',
        baseHourlyRate: 45,
        currentOccupancyRate: 0.95,
        hostPricingPreferences: { allowDynamic: false, maxMultiplier: 2.0 },
      },
      ctx
    );

    expect(res.success).toBe(true);
    if (!res.success) return;

    expect(res.data.calculatedHourlyRate).toBe(45);
    expect(res.data.appliedMultiplier).toBe(1.0);
    expect(res.data.surgeReason).toBe('DYNAMIC_DISABLED_BY_HOST');
  });
});
