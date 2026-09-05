import { AgentError } from '../core';
import { EventBridgeEvent } from './eventbridge-event';
import { IEventBus, EventHandler, DeadLetterEnvelope } from './event-bus.interface';

export class InMemoryEventBus implements IEventBus {
  private readonly handlers: Map<string, Set<EventHandler<any>>> = new Map();
  private readonly deadLetterQueue: DeadLetterEnvelope[] = [];
  private readonly publishedHistory: EventBridgeEvent<unknown>[] = [];

  public async publish<T>(event: EventBridgeEvent<T>): Promise<void> {
    this.publishedHistory.push(event);
    const detailType = event['detail-type'];
    const subscribers = new Set<EventHandler<any>>();

    // Direct subscribers
    const exactHandlers = this.handlers.get(detailType);
    if (exactHandlers) {
      exactHandlers.forEach((h) => subscribers.add(h));
    }

    // Wildcard subscribers ('*')
    const wildcardHandlers = this.handlers.get('*');
    if (wildcardHandlers) {
      wildcardHandlers.forEach((h) => subscribers.add(h));
    }

    if (subscribers.size === 0) {
      return;
    }

    // Isolate subscriber errors via Promise.allSettled
    const subscriberList: EventHandler<any>[] = [];
    subscribers.forEach((h) => subscriberList.push(h));
    const results = await Promise.allSettled(
      subscriberList.map((handler) => Promise.resolve().then(() => handler(event)))
    );

    for (const res of results) {
      if (res.status === 'rejected') {
        const error = res.reason instanceof Error ? res.reason : new Error(String(res.reason));
        this.deadLetterQueue.push({
          event,
          error: error instanceof AgentError ? error : AgentError.internal(error.message, error),
          timestamp: new Date().toISOString(),
          reason: 'Subscriber handler threw an exception',
        });
      }
    }
  }

  public subscribe<T = unknown>(detailType: string, handler: EventHandler<T>): () => void {
    if (!this.handlers.has(detailType)) {
      this.handlers.set(detailType, new Set());
    }
    const set = this.handlers.get(detailType)!;
    set.add(handler as EventHandler<any>);

    return () => {
      set.delete(handler as EventHandler<any>);
      if (set.size === 0) {
        this.handlers.delete(detailType);
      }
    };
  }

  public getDeadLetterQueue(): DeadLetterEnvelope[] {
    return [...this.deadLetterQueue];
  }

  public clearDeadLetterQueue(): void {
    this.deadLetterQueue.length = 0;
  }

  public getPublishedHistory(): EventBridgeEvent<unknown>[] {
    return [...this.publishedHistory];
  }

  public clear(): void {
    this.handlers.clear();
    this.deadLetterQueue.length = 0;
    this.publishedHistory.length = 0;
  }
}
