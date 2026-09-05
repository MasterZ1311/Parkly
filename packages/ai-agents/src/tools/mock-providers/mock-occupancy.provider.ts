import { Result, ok, AgentError } from '../../core';
import {
  IOccupancyQueryTool,
  HistoricalOccupancyData,
  LiveSensorStatus,
} from '../interfaces/occupancy-query-tool.interface';

export class MockOccupancyQueryProvider implements IOccupancyQueryTool {
  private latencyMs = 0;

  public simulateLatencyMs(ms: number): void {
    this.latencyMs = ms;
  }

  public async getHistoricalOccupancy(
    spaceId: string,
    _timeWindow?: { startTime: string; endTime: string }
  ): Promise<Result<HistoricalOccupancyData, AgentError>> {
    if (this.latencyMs > 0) {
      await new Promise((r) => setTimeout(r, this.latencyMs));
    }

    const rate = spaceId.includes('burkit') ? 0.92 : 0.7;
    return ok({
      spaceId,
      averageOccupancyRate: rate,
      historicalVacancies: 1,
      sampleCount: 144,
    });
  }

  public async getLiveSensorStatus(spaceId: string): Promise<Result<LiveSensorStatus, AgentError>> {
    return ok({
      spaceId,
      occupiedSlots: 1,
      totalSlots: 2,
      lastReportedTime: new Date().toISOString(),
      sensorHealth: 'HEALTHY',
    });
  }

  public reset(): void {
    this.latencyMs = 0;
  }
}
