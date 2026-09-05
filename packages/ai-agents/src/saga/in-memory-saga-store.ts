import { ISagaStateStore, SagaState } from './saga-state-store.interface';

export class InMemorySagaStore implements ISagaStateStore {
  private readonly states: Map<string, SagaState<any>> = new Map();

  public async saveState<T>(state: SagaState<T>): Promise<void> {
    this.states.set(state.sagaId, { ...state });
  }

  public async getState<T>(sagaId: string): Promise<SagaState<T> | null> {
    const s = this.states.get(sagaId);
    return s ? ({ ...s } as SagaState<T>) : null;
  }

  public async updateState<T>(sagaId: string, update: Partial<SagaState<T>>): Promise<void> {
    const existing = this.states.get(sagaId);
    if (!existing) {
      throw new Error(`Saga state not found for ID: ${sagaId}`);
    }
    this.states.set(sagaId, {
      ...existing,
      ...update,
      updatedAt: new Date().toISOString(),
    });
  }

  public clear(): void {
    this.states.clear();
  }
}
