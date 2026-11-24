import { Result, ok, AgentError } from '../../core';
import {
  IAnalyticsLakeTool,
  CityMobilityMetrics,
} from '../interfaces/analytics-lake-tool.interface';

export class MockAnalyticsLakeProvider implements IAnalyticsLakeTool {
  private customMetrics: Partial<CityMobilityMetrics> | null = null;

  public setMockMetrics(metrics: Partial<CityMobilityMetrics>): void {
    this.customMetrics = { ...metrics };
  }

  public async queryCityMetrics(
    cityId: string,
    period: string,
    _zones: string[]
  ): Promise<Result<CityMobilityMetrics, AgentError>> {
    const cruising = this.customMetrics?.estimatedCurbsideCruisingReducedMinutes ?? 184000;
    const co2 = Number((cruising * 0.0229).toFixed(1)); // Invariant: 0.0229 kg per cruising minute

    return ok({
      cityId,
      period,
      totalOffStreetHoursProvided:
        this.customMetrics?.totalOffStreetHoursProvided ?? 48200,
      estimatedCurbsideCruisingReducedMinutes: cruising,
      estimatedCO2AbatedKg: co2,
      unmetDemandChokePoints: [
        { intersection: 'Panagal Park / Usman Road', unsatisfiedSearches: 1420 },
        { intersection: 'Anna Nagar Roundtana / 2nd Ave', unsatisfiedSearches: 850 },
      ],
      ...this.customMetrics,
    });
  }

  public reset(): void {
    this.customMetrics = null;
  }
}
