import { Result, ok, err, AgentError } from '../../core';
import {
  IPricingEngineTool,
  PricingCalculationParams,
  PricingResult,
} from '../interfaces/pricing-engine-tool.interface';

export class MockPricingEngineProvider implements IPricingEngineTool {
  public async calculateSurge(
    params: PricingCalculationParams
  ): Promise<Result<PricingResult, AgentError>> {
    const { baseHourlyRate, currentOccupancyRate, hostPricingPreferences } = params;

    if (baseHourlyRate <= 0) {
      return err(AgentError.validation('baseHourlyRate must be greater than 0'));
    }

    const allowDynamic = hostPricingPreferences?.allowDynamic ?? true;
    const maxMultiplier = hostPricingPreferences?.maxMultiplier ?? 2.0;

    if (maxMultiplier < 1.0) {
      return err(AgentError.validation('maxMultiplier cannot be less than 1.0'));
    }

    if (!allowDynamic) {
      return ok({
        spaceId: params.spaceId,
        calculatedHourlyRate: baseHourlyRate,
        appliedMultiplier: 1.0,
        surgeReason: 'DYNAMIC_DISABLED_BY_HOST',
        effectiveFrom: new Date().toISOString(),
        effectiveUntil: new Date(Date.now() + 3600000).toISOString(),
      });
    }

    // Dynamic surge calculation: multiplier scales with occupancy
    let multiplier = 1.0;
    let reason = 'BASELINE_DEMAND';

    if (currentOccupancyRate >= 0.9) {
      multiplier = 1.6;
      reason = 'PEAK_SHOPPING_SURGE';
    } else if (currentOccupancyRate >= 0.75) {
      multiplier = 1.25;
      reason = 'COMMUTE_RUSH_SURGE';
    } else if (currentOccupancyRate < 0.3) {
      multiplier = 0.9; // Attempt discount
      reason = 'LOW_DEMAND_DISCOUNT';
    }

    // Strict invariant bounds: [baseHourlyRate, maxMultiplier * baseHourlyRate]
    const clampedMultiplier = Math.min(Math.max(multiplier, 1.0), maxMultiplier);
    const calculatedRate = Math.round(baseHourlyRate * clampedMultiplier);

    return ok({
      spaceId: params.spaceId,
      calculatedHourlyRate: calculatedRate,
      appliedMultiplier: clampedMultiplier,
      surgeReason: reason,
      effectiveFrom: new Date().toISOString(),
      effectiveUntil: new Date(Date.now() + 3600000).toISOString(),
    });
  }

  public reset(): void {}
}
