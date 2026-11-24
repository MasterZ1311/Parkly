import { randomUUID } from 'node:crypto';
import { Result, ok, AgentError, ExecutionContext } from '../../core';
import { HostOnboardingAgent, HostOnboardingInput } from '../../agents/host-onboarding';
import { VisualInspectionAgent } from '../../agents/visual-inspection';
import { IEventBus, DOMAIN_EVENTS } from '../../bus';
import { ISagaStateStore } from '../saga-state-store.interface';

export interface HostOnboardingSagaResult {
  sagaStatus: 'COMPLETED' | 'PAUSED_MANUAL_REVIEW';
  hostId: string;
  kycStatus: string;
  spaceId?: string;
  listingActive?: boolean;
}

export class HostOnboardingSaga {
  constructor(
    public readonly hostAgent: HostOnboardingAgent,
    public readonly visualAgent: VisualInspectionAgent,
    public readonly eventBus: IEventBus,
    public readonly sagaStore?: ISagaStateStore
  ) {}

  public async execute(
    input: HostOnboardingInput,
    ctx: ExecutionContext
  ): Promise<Result<HostOnboardingSagaResult, AgentError>> {
    const kycResult = await this.hostAgent.execute(input, ctx);
    if (!kycResult.success) return kycResult;

    if (kycResult.data.kycStatus === 'MANUAL_REVIEW_REQUIRED') {
      return ok({
        sagaStatus: 'PAUSED_MANUAL_REVIEW',
        hostId: kycResult.data.hostId,
        kycStatus: 'MANUAL_REVIEW_REQUIRED',
      });
    }

    const inspectionResult = await this.visualAgent.execute(
      {
        spaceId: `spc_${input.userId}_01`,
        photoUrls: ['https://s3.ap-south-1.amazonaws.com/parkly/sample.jpg'],
      },
      ctx
    );

    if (!inspectionResult.success) return inspectionResult;

    // Publish Space.VisuallyAudited
    await this.eventBus.publish({
      id: randomUUID(),
      source: 'parkly.ai',
      'detail-type': DOMAIN_EVENTS.SPACE_VISUALLY_AUDITED,
      time: new Date().toISOString(),
      detail: {
        spaceId: inspectionResult.data.spaceId,
        inspectionResult: inspectionResult.data.inspectionResult,
      },
      correlationId: ctx.correlationId,
    });

    return ok({
      sagaStatus: 'COMPLETED',
      hostId: kycResult.data.hostId,
      spaceId: inspectionResult.data.spaceId,
      listingActive: inspectionResult.data.inspectionResult === 'APPROVED',
      kycStatus: kycResult.data.kycStatus,
    });
  }
}
