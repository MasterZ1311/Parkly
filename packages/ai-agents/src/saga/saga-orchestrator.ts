import { randomUUID } from 'node:crypto';
import { Result, ok, AgentError, ExecutionContext } from '../core';
import { ISagaStateStore, SagaState, SagaStatus } from './saga-state-store.interface';

export interface ISagaStep<TContext> {
  name: string;
  execute: (context: TContext, ctx: ExecutionContext) => Promise<Result<Partial<TContext>, AgentError>>;
  compensate?: (context: TContext, ctx: ExecutionContext) => Promise<Result<void, AgentError>>;
}

export interface SagaExecutionResult<TContext> {
  sagaId: string;
  status: SagaStatus;
  data: TContext;
  error?: AgentError;
}

export class SagaOrchestrator<TContext extends Record<string, unknown>> {
  constructor(
    public readonly name: string,
    private readonly steps: ISagaStep<TContext>[],
    private readonly store?: ISagaStateStore
  ) {}

  public async execute(
    initialData: TContext,
    ctx: ExecutionContext
  ): Promise<Result<SagaExecutionResult<TContext>, AgentError>> {
    const sagaId = randomUUID();
    const executedSteps: ISagaStep<TContext>[] = [];
    let currentData = { ...initialData };

    const state: SagaState<TContext> = {
      sagaId,
      name: this.name,
      status: 'PENDING',
      currentStep: 'START',
      data: currentData,
      history: [
        {
          step: 'START',
          status: 'PENDING',
          timestamp: new Date().toISOString(),
        },
      ],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    if (this.store) {
      await this.store.saveState(state);
    }

    for (const step of this.steps) {
      state.history.push({
        step: step.name,
        status: 'EXECUTING',
        timestamp: new Date().toISOString(),
      });
      if (this.store) {
        await this.store.updateState(sagaId, {
          currentStep: step.name,
          status: 'STEP_COMPLETED',
          history: [...state.history],
        });
      }

      const stepResult = await step.execute(currentData, ctx);

      if (stepResult.success) {
        executedSteps.push(step);
        currentData = { ...currentData, ...stepResult.data };
        state.history.push({
          step: step.name,
          status: 'COMPLETED',
          timestamp: new Date().toISOString(),
          details: stepResult.data,
        });
        if (this.store) {
          await this.store.updateState(sagaId, {
            data: currentData,
            history: [...state.history],
          });
        }
      } else {
        // Step failed -> initiate LIFO compensation
        state.history.push({
          step: step.name,
          status: 'FAILED',
          timestamp: new Date().toISOString(),
          details: stepResult.error,
        });

        if (this.store) {
          await this.store.updateState(sagaId, {
            status: 'COMPENSATING',
            history: [...state.history],
          });
        }

        const compensationSteps = [...executedSteps].reverse();
        let compensationFailed = false;

        for (const compStep of compensationSteps) {
          if (compStep.compensate) {
            try {
              const compRes = await compStep.compensate(currentData, ctx);
              state.history.push({
                step: `${compStep.name}_COMPENSATION`,
                status: compRes.success ? 'COMPENSATED' : 'COMPENSATION_FAILED',
                timestamp: new Date().toISOString(),
              });
              if (!compRes.success) {
                compensationFailed = true;
              }
            } catch (e) {
              compensationFailed = true;
            }
          }
        }

        const finalStatus: SagaStatus = compensationFailed ? 'FAILED' : 'COMPENSATED';
        if (this.store) {
          await this.store.updateState(sagaId, {
            status: finalStatus,
            history: [...state.history],
          });
        }

        return ok({
          sagaId,
          status: finalStatus,
          data: currentData,
          error: stepResult.error,
        });
      }
    }

    if (this.store) {
      await this.store.updateState(sagaId, {
        status: 'COMPLETED',
        data: currentData,
      });
    }

    return ok({
      sagaId,
      status: 'COMPLETED',
      data: currentData,
    });
  }
}
