import { Result, AgentError } from '../../core';

export interface TrafficEtaResult {
  etaMinutes: number;
  distanceMeters: number;
  trafficDensity: 'LIGHT' | 'MODERATE' | 'HEAVY' | 'BLOCKED';
  isAccessRoadOpen: boolean;
}

export interface ITrafficMonitorTool {
  calculateEta(
    origin: { lat: number; lng: number },
    dest: { lat: number; lng: number }
  ): Promise<Result<TrafficEtaResult, AgentError>>;
}
