import {
  BaseAgent,
  AgentOptions,
  ExecutionContext,
  Result,
  ok,
  AgentError,
} from '../../core';
import { IVisionTool } from '../../tools';
import {
  VisualInspectionInput,
  VisualInspectionInputSchema,
  VisualInspectionOutput,
  VisualInspectionOutputSchema,
} from './visual-inspection.schema';

export interface VisualInspectionAgentDeps {
  visionTool: IVisionTool;
}

export class VisualInspectionAgent extends BaseAgent<
  VisualInspectionInput,
  VisualInspectionOutput
> {
  readonly inputSchema = VisualInspectionInputSchema;
  readonly outputSchema = VisualInspectionOutputSchema;

  constructor(
    private readonly deps: VisualInspectionAgentDeps,
    options?: AgentOptions
  ) {
    super('VisualInspectionAgent', options);
  }

  protected async executeInternal(
    input: VisualInspectionInput,
    _ctx: ExecutionContext
  ): Promise<Result<VisualInspectionOutput, AgentError>> {
    const inspection = await this.deps.visionTool.inspectSpace(
      input.spaceId,
      input.photoUrls
    );
    if (!inspection.success) return inspection;

    return ok({
      spaceId: input.spaceId,
      inspectionResult: inspection.data.inspectionResult,
      detectedAttributes: inspection.data.detectedAttributes,
      privacyActions: inspection.data.privacyActions,
      generatedDescription: inspection.data.generatedDescription,
    });
  }
}
