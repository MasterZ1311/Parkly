import { Result, AgentError } from '../../core';

export interface HistoricalOccupancyData {
  spaceId: string;
  averageOccupancyRate: number;
  historicalVacancies: number;
  sampleCount: number;
}

export interface LiveSensorStatus {
  spaceId: string;
  occupiedSlots: number;
  totalSlots: number;
  lastReportedTime: string;
  sensorHealth: 'HEALTHY' | 'DEGRADED' | 'OFFLINE';
}

export interface IOccupancyQueryTool {
  getHistoricalOccupancy(
    spaceId: string,
    timeWindow?: { startTime: string; endTime: string }
  ): Promise<Result<HistoricalOccupancyData, AgentError>>;

  getLiveSensorStatus(spaceId: string): Promise<Result<LiveSensorStatus, AgentError>>;
}
