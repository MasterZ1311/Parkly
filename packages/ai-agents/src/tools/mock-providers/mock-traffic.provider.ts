import { Result, ok, AgentError } from '../../core';
import {
  ITrafficMonitorTool,
  TrafficEtaResult,
} from '../interfaces/traffic-monitor-tool.interface';

export class MockTrafficMonitorProvider implements ITrafficMonitorTool {
  private isBlocked = false;

  public setBlockedAccess(blocked: boolean): void {
    this.isBlocked = blocked;
  }

  public async calculateEta(
    _origin: { lat: number; lng: number },
    _dest: { lat: number; lng: number }
  ): Promise<Result<TrafficEtaResult, AgentError>> {
    return ok({
      etaMinutes: this.isBlocked ? 45 : 12,
      distanceMeters: 2800,
      trafficDensity: this.isBlocked ? 'BLOCKED' : 'MODERATE',
      isAccessRoadOpen: !this.isBlocked,
    });
  }

  public reset(): void {
    this.isBlocked = false;
  }
}
