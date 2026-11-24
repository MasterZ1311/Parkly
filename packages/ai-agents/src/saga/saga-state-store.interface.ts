export type SagaStatus =
  | 'PENDING'
  | 'STEP_COMPLETED'
  | 'COMPLETED'
  | 'COMPENSATING'
  | 'COMPENSATED'
  | 'FAILED';

export interface SagaHistoryEntry {
  step: string;
  status: string;
  timestamp: string;
  details?: unknown;
}

export interface SagaState<TData = Record<string, unknown>> {
  readonly sagaId: string;
  readonly name: string;
  readonly status: SagaStatus;
  readonly currentStep: string;
  readonly data: TData;
  readonly history: SagaHistoryEntry[];
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface ISagaStateStore {
  saveState<T>(state: SagaState<T>): Promise<void>;
  getState<T>(sagaId: string): Promise<SagaState<T> | null>;
  updateState<T>(sagaId: string, update: Partial<SagaState<T>>): Promise<void>;
  clear?(): void;
}
