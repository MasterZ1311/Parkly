import {
  BaseAgent,
  AgentOptions,
  ExecutionContext,
  Result,
  ok,
  AgentError,
} from '../../core';
import { IAnalyticsLakeTool } from '../../tools';
import {
  CityAnalyticsInput,
  CityAnalyticsInputSchema,
  CityAnalyticsOutput,
  CityAnalyticsOutputSchema,
} from './city-analytics.schema';

export interface CityAnalyticsAgentDeps {
  analyticsLakeTool: IAnalyticsLakeTool;
}

export class CityAnalyticsAgent extends BaseAgent<
  CityAnalyticsInput,
  CityAnalyticsOutput
> {
  readonly inputSchema = CityAnalyticsInputSchema;
  readonly outputSchema = CityAnalyticsOutputSchema;

  constructor(
    private readonly deps: CityAnalyticsAgentDeps,
    options?: AgentOptions
  ) {
    super('CityAnalyticsAgent', options);
  }

  protected async executeInternal(
    input: CityAnalyticsInput,
    _ctx: ExecutionContext
  ): Promise<Result<CityAnalyticsOutput, AgentError>> {
    const lakeRes = await this.deps.analyticsLakeTool.queryCityMetrics(
      input.cityId,
      input.period,
      input.zones
    );
    if (!lakeRes.success) return lakeRes;

    return ok({
      cityId: input.cityId,
      reportGeneratedAt: new Date().toISOString(),
      metrics: {
        totalOffStreetHoursProvided: lakeRes.data.totalOffStreetHoursProvided,
        estimatedCurbsideCruisingReducedMinutes:
          lakeRes.data.estimatedCurbsideCruisingReducedMinutes,
        estimatedCO2AbatedKg: lakeRes.data.estimatedCO2AbatedKg,
        unmetDemandChokePoints: lakeRes.data.unmetDemandChokePoints,
      },
      recommendation:
        'Expand off-street host supply around Usman Rd choke point to abate further CO2 emissions.',
    });
  }
}
