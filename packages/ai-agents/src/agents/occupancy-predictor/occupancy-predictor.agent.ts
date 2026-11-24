import {
  BaseAgent,
  AgentOptions,
  ExecutionContext,
  Result,
  ok,
  AgentError,
} from '../../core';
import { IOccupancyQueryTool } from '../../tools';
import {
  OccupancyPredictorInput,
  OccupancyPredictorInputSchema,
  OccupancyPredictorOutput,
  OccupancyPredictorOutputSchema,
} from './occupancy-predictor.schema';

export interface OccupancyPredictorAgentDeps {
  occupancyTool: IOccupancyQueryTool;
}

export class OccupancyPredictorAgent extends BaseAgent<
  OccupancyPredictorInput,
  OccupancyPredictorOutput
> {
  readonly inputSchema = OccupancyPredictorInputSchema;
  readonly outputSchema = OccupancyPredictorOutputSchema;

  constructor(
    private readonly deps: OccupancyPredictorAgentDeps,
    options?: AgentOptions
  ) {
    super('OccupancyPredictorAgent', options);
  }

  protected async executeInternal(
    input: OccupancyPredictorInput,
    _ctx: ExecutionContext
  ): Promise<Result<OccupancyPredictorOutput, AgentError>> {
    const startTime = Date.now();
    const occupancyData = await this.deps.occupancyTool.getHistoricalOccupancy(
      input.spaceId
    );
    const duration = Date.now() - startTime;

    // Strict invariant: if latency > 150ms -> heuristic fallback
    if (duration > 150 || !occupancyData.success) {
      const demandMultiplier = 1.4;
      const heuristicProb = Number(Math.max(0.05, 1 / demandMultiplier).toFixed(2));
      return ok({
        spaceId: input.spaceId,
        arrivalProbability: heuristicProb,
        confidenceScore: 0.5,
        estimatedAvailableSlots: 1,
        demandTier: 'HEURISTIC_FALLBACK',
        contextualFactors: ['LATENCY_TIMEOUT_FALLBACK_TRIGGERED'],
      });
    }

    const rate = occupancyData.data.averageOccupancyRate;
    const prob = Number(Math.max(0.05, 1 - rate * 0.6).toFixed(2));

    return ok({
      spaceId: input.spaceId,
      arrivalProbability: prob,
      confidenceScore: 0.85,
      estimatedAvailableSlots: rate > 0.8 ? 1 : 3,
      demandTier: rate > 0.8 ? 'PEAK_SHOPPING' : 'PEAK_COMMUTE',
      contextualFactors: ['HISTORICAL_TIME_SERIES_VERIFIED'],
    });
  }
}
