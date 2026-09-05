import { Result, ok, AgentError } from '../../core';
import {
  ISensorVerificationTool,
  SensorAuditRecord,
} from '../interfaces/sensor-verification-tool.interface';

export class MockSensorVerificationProvider implements ISensorVerificationTool {
  private overstayMinutes = 90;
  private vehiclePresent = true;

  public setOverstayMinutes(minutes: number): void {
    this.overstayMinutes = minutes;
  }

  public setVehiclePresent(present: boolean): void {
    this.vehiclePresent = present;
  }

  public async verifyOverstay(
    spaceId: string,
    bookingId: string,
    _scheduledEndTime: string
  ): Promise<Result<SensorAuditRecord, AgentError>> {
    return ok({
      spaceId,
      bookingId,
      vehiclePlate: 'TN09BZ4321',
      vehiclePresent: this.vehiclePresent,
      detectedEntryTime: '2026-09-05T14:00:00.000Z',
      detectedExitTime:
        this.overstayMinutes > 0
          ? '2026-09-05T17:30:00.000Z'
          : '2026-09-05T15:55:00.000Z',
      overstayMinutes: this.overstayMinutes,
      sensorConfidence: 0.98,
    });
  }

  public reset(): void {
    this.overstayMinutes = 90;
    this.vehiclePresent = true;
  }
}
