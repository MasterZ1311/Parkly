import { randomUUID } from 'node:crypto';
import { Result, ok, AgentError } from '../../core';
import {
  INotificationTool,
  NotificationPayload,
} from '../interfaces/notification-tool.interface';

export class MockNotificationProvider implements INotificationTool {
  private sentNotifications: NotificationPayload[] = [];

  public async send(
    payload: NotificationPayload
  ): Promise<Result<{ delivered: boolean; id: string }, AgentError>> {
    this.sentNotifications.push({ ...payload });
    return ok({ delivered: true, id: `notif_${randomUUID().substring(0, 8)}` });
  }

  public getSentNotifications(): NotificationPayload[] {
    return [...this.sentNotifications];
  }

  public filterByRecipient(recipient: string): NotificationPayload[] {
    return this.sentNotifications.filter((n) => n.recipient.includes(recipient));
  }

  public clear(): void {
    this.sentNotifications = [];
  }

  public reset(): void {
    this.sentNotifications = [];
  }
}
