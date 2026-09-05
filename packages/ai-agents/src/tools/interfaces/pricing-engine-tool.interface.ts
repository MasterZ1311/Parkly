import { Result, AgentError } from '../../core';

export interface PricingCalculationParams {
  spaceId: string;
  baseHourlyRate: number;
  currentOccupancyRate: number;
  demandForecastTier?: string;
  hostPricingPreferences?: {
    allowDynamic: boolean;
    maxMultiplier: number;
  };
}

export interface PricingResult {
  spaceId: string;
  calculatedHourlyRate: number;
  appliedMultiplier: number;
  surgeReason: string;
  effectiveFrom: string;
  effectiveUntil: string;
}

export interface IPricingEngineTool {
  calculateSurge(params: PricingCalculationParams): Promise<Result<PricingResult, AgentError>>;
}
