import { Result, AgentError } from '../../core';

export interface CityMobilityMetrics {
  cityId: string;
  period: string;
  totalOffStreetHoursProvided: number;
  estimatedCurbsideCruisingReducedMinutes: number;
  estimatedCO2AbatedKg: number;
  unmetDemandChokePoints: Array<{ intersection: string; unsatisfiedSearches: number }>;
}

export interface IAnalyticsLakeTool {
  queryCityMetrics(
    cityId: string,
    period: string,
    zones: string[]
  ): Promise<Result<CityMobilityMetrics, AgentError>>;
}
