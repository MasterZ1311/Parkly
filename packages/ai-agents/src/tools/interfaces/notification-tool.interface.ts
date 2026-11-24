import { Result, AgentError } from '../../core';

export interface NotificationPayload {
  recipient: string;
  channel: 'SMS' | 'PUSH' | 'EMAIL';
  title?: string;
  message: string;
  urgency?: 'LOW' | 'NORMAL' | 'HIGH';
  metadata?: Record<string, unknown>;
}

export interface INotificationTool {
  send(payload: NotificationPayload): Promise<Result<{ delivered: boolean; id: string }, AgentError>>;
}
