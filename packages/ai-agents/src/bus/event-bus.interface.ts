import { AgentError } from '../core';
import { EventBridgeEvent } from './eventbridge-event';

export interface DeadLetterEnvelope {
  readonly event: EventBridgeEvent<unknown>;
  readonly error: AgentError | Error;
  readonly timestamp: string;
  readonly reason?: string;
}

export type EventHandler<T = unknown> = (event: EventBridgeEvent<T>) => Promise<void> | void;

export interface IEventBus {
  publish<T>(event: EventBridgeEvent<T>): Promise<void>;
  subscribe<T = unknown>(detailType: string, handler: EventHandler<T>): () => void;
  getDeadLetterQueue(): DeadLetterEnvelope[];
  clearDeadLetterQueue(): void;
  getPublishedHistory?(): EventBridgeEvent<unknown>[];
  clear?(): void;
}
