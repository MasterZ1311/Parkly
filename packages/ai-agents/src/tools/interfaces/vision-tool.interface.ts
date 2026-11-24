import { Result, AgentError } from '../../core';

export interface VisionInspectionResult {
  inspectionResult: 'APPROVED' | 'REJECTED' | 'ACTION_REQUIRED';
  detectedAttributes: {
    isCovered: boolean;
    surfaceType: string;
    estimatedWidthMeters: number;
    estimatedLengthMeters: number;
    gateClearanceAdequate: boolean;
    cctvVisible: boolean;
    lightingAdequate: boolean;
    evChargerDetected: boolean;
  };
  privacyActions: {
    licensePlatesBlurred: number;
    facesBlurred: number;
  };
  generatedDescription: string;
  obstructions: string[];
  feedbackMessages: string[];
}

export interface IVisionTool {
  inspectSpace(
    spaceId: string,
    photoUrls: string[]
  ): Promise<Result<VisionInspectionResult, AgentError>>;
}
