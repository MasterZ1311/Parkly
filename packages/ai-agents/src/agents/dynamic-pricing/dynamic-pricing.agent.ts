import {
  BaseAgent,
  AgentOptions,
  ExecutionContext,
  Result,
  AgentError,
} from '../../core';
import { IPricingEngineTool } from '../../tools';
import {
  DynamicPricingInput,
  DynamicPricingInputSchema,
  DynamicPricingOutput,
  DynamicPricingOutputSchema,
} from './dynamic-pricing.schema';

export interface DynamicPricingAgentDeps {
  pricingEngineTool: IPricingEngineTool;
}

export class DynamicPricingAgent extends BaseAgent<
  DynamicPricingInput,
  DynamicPricingOutput
> {
  readonly inputSchema = DynamicPricingInputSchema;
  readonly outputSchema = DynamicPricingOutputSchema;

  constructor(
    private readonly deps: DynamicPricingAgentDeps,
    options?: AgentOptions
  ) {
    super('DynamicPricingAgent', options);
  }

  protected async executeInternal(
    input: DynamicPricingInput,
    _ctx: ExecutionContext
  ): Promise<Result<DynamicPricingOutput, AgentError>> {
    return this.deps.pricingEngineTool.calculateSurge(input);
  }
}
