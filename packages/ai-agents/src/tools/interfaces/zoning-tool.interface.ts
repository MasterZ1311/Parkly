import { Result, AgentError } from '../../core';

export type ZoningStatus =
  | 'RESIDENTIAL_PERMITTED'
  | 'COMMERCIAL_PERMITTED'
  | 'NON_RESIDENTIAL_PROHIBITED'
  | 'AMBIGUOUS';

export interface ZoningResult {
  status: ZoningStatus;
  zoneCode: string;
  authority: string;
  requiresSpecialPermit: boolean;
}

export interface IZoningTool {
  checkCompliance(
    latitude: number,
    longitude: number,
    declaredUse?: 'RESIDENTIAL' | 'COMMERCIAL'
  ): Promise<Result<ZoningResult, AgentError>>;
}
