import { EventBridgeEvent, IEventBus } from '../../bus';
import { ISagaStateStore } from '../../saga';

export interface ParklyOrchestratorDeps {
  eventBus: IEventBus;
  sagaStore: ISagaStateStore;
  timeoutBudgetMs?: number;
}

export class ParklyOrchestratorAgent {
  constructor(public readonly deps: ParklyOrchestratorDeps) {}

  public async routeEvent<T = unknown>(event: EventBridgeEvent<T>): Promise<void> {
    await this.deps.eventBus.publish(event);
  }

  public getDeadLetters() {
    return this.deps.eventBus.getDeadLetterQueue();
  }

  public clearDeadLetters() {
    this.deps.eventBus.clearDeadLetterQueue();
  }
}
