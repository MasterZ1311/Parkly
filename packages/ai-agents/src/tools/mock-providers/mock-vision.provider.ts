import { Result, ok, err, AgentError } from '../../core';
import { IVisionTool, VisionInspectionResult } from '../interfaces/vision-tool.interface';

export class MockVisionProvider implements IVisionTool {
  private simulatedGateClearance: number | null = null;
  private simulatedObstructions: string[] = [];
  private simulatedFailureCount = 0;

  public setGateClearance(widthMeters: number): void {
    this.simulatedGateClearance = widthMeters;
  }

  public setObstructions(obstructions: string[]): void {
    this.simulatedObstructions = [...obstructions];
  }

  public simulateConsecutiveErrors(count: number): void {
    this.simulatedFailureCount = count;
  }

  public async inspectSpace(
    _spaceId: string,
    photoUrls: string[]
  ): Promise<Result<VisionInspectionResult, AgentError>> {
    if (this.simulatedFailureCount > 0) {
      this.simulatedFailureCount--;
      return err(AgentError.downstream('Mock Vision tool inference failure'));
    }

    if (!photoUrls || photoUrls.length === 0) {
      return err(AgentError.validation('At least one photo URL is required for visual inspection'));
    }

    const clearance = this.simulatedGateClearance ?? 2.8;
    const obstructions = this.simulatedObstructions.length > 0 ? this.simulatedObstructions : [];
    const isAdequate = clearance >= 2.2 && obstructions.length === 0;

    let inspectionResult: 'APPROVED' | 'REJECTED' | 'ACTION_REQUIRED' = 'APPROVED';
    const feedback: string[] = [];

    if (!isAdequate) {
      inspectionResult = 'ACTION_REQUIRED';
      if (clearance < 2.2) {
        feedback.push(`Gate clearance ${clearance.toFixed(2)}m is below required 2.20m minimum standard`);
      }
      for (const obs of obstructions) {
        feedback.push(`Obstruction detected: ${obs}`);
      }
    }

    return ok({
      inspectionResult,
      detectedAttributes: {
        isCovered: true,
        surfaceType: 'concrete_paved',
        estimatedWidthMeters: clearance,
        estimatedLengthMeters: 5.5,
        gateClearanceAdequate: clearance >= 2.2,
        cctvVisible: true,
        lightingAdequate: true,
        evChargerDetected: false,
      },
      privacyActions: {
        licensePlatesBlurred: 1,
        facesBlurred: 0,
      },
      generatedDescription:
        'Secure covered residential parking bay in Chennai with wide gate and CCTV coverage.',
      obstructions,
      feedbackMessages: feedback,
    });
  }

  public reset(): void {
    this.simulatedGateClearance = null;
    this.simulatedObstructions = [];
    this.simulatedFailureCount = 0;
  }
}
