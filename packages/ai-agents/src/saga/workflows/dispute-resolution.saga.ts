import { randomUUID } from 'node:crypto';
import { Result, ok, AgentError, ExecutionContext } from '../../core';
import {
  DisputeMediationAgent,
  DisputeMediationInput,
  DisputeMediationOutput,
} from '../../agents/dispute-mediation';
import { ISensorVerificationTool, IPaymentLedgerTool } from '../../tools';
import { IEventBus, DOMAIN_EVENTS } from '../../bus';

export interface DisputeResolutionSagaResult extends DisputeMediationOutput {
  sagaStatus: 'COMPLETED';
}

export class DisputeResolutionSaga {
  constructor(
    public readonly disputeAgent: DisputeMediationAgent,
    public readonly sensorTool: ISensorVerificationTool,
    public readonly ledgerTool: IPaymentLedgerTool,
    public readonly eventBus: IEventBus
  ) {}

  public async execute(
    input: DisputeMediationInput,
    ctx: ExecutionContext
  ): Promise<Result<DisputeResolutionSagaResult, AgentError>> {
    const mediationResult = await this.disputeAgent.execute(input, ctx);
    if (!mediationResult.success) return mediationResult;

    await this.eventBus.publish({
      id: randomUUID(),
      source: 'parkly.ai',
      'detail-type': DOMAIN_EVENTS.DISPUTE_RESOLVED,
      time: new Date().toISOString(),
      detail: mediationResult.data,
      correlationId: ctx.correlationId,
    });

    return ok({
      sagaStatus: 'COMPLETED',
      ...mediationResult.data,
    });
  }
}
