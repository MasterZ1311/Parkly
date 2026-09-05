import { Result, ok, AgentError } from '../../core';
import { IZoningTool, ZoningResult, ZoningStatus } from '../interfaces/zoning-tool.interface';

export class MockZoningProvider implements IZoningTool {
  private overrideStatus: ZoningStatus | null = null;

  public setOverrideStatus(status: ZoningStatus | null): void {
    this.overrideStatus = status;
  }

  public async checkCompliance(
    _lat: number,
    _lng: number,
    declaredUse: 'RESIDENTIAL' | 'COMMERCIAL' = 'RESIDENTIAL'
  ): Promise<Result<ZoningResult, AgentError>> {
    if (this.overrideStatus) {
      return ok({
        status: this.overrideStatus,
        zoneCode: 'CMDA-R2',
        authority: 'Chennai Metropolitan Development Authority',
        requiresSpecialPermit: this.overrideStatus === 'NON_RESIDENTIAL_PROHIBITED',
      });
    }

    return ok({
      status: declaredUse === 'COMMERCIAL' ? 'COMMERCIAL_PERMITTED' : 'RESIDENTIAL_PERMITTED',
      zoneCode: declaredUse === 'COMMERCIAL' ? 'CMDA-C4' : 'CMDA-R2',
      authority: 'Chennai Metropolitan Development Authority',
      requiresSpecialPermit: false,
    });
  }

  public reset(): void {
    this.overrideStatus = null;
  }
}
