import { Result, AgentError } from '../../core';

export interface SensorAuditRecord {
  spaceId: string;
  bookingId: string;
  vehiclePlate?: string;
  vehiclePresent: boolean;
  detectedEntryTime: string | null;
  detectedExitTime: string | null;
  overstayMinutes: number;
  sensorConfidence: number;
}

export interface ISensorVerificationTool {
  verifyOverstay(
    spaceId: string,
    bookingId: string,
    scheduledEndTime: string
  ): Promise<Result<SensorAuditRecord, AgentError>>;
}
