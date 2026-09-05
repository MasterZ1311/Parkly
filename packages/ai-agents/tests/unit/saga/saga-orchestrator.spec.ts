import { describe, it, expect } from 'vitest';
import {
  SagaOrchestrator,
  InMemorySagaStore,
  ISagaStep,
  ExecutionContext,
  ok,
  err,
  AgentError,
} from '../../../src';

describe('SagaOrchestrator & Compensation Engine', () => {
  const ctx = new ExecutionContext();

  it('completes all forward saga steps when every step succeeds', async () => {
    const store = new InMemorySagaStore();

    interface OrderContext extends Record<string, unknown> {
      orderId: string;
      reserved: boolean;
      charged: boolean;
    }

    const steps: ISagaStep<OrderContext>[] = [
      {
        name: 'ReserveInventory',
        execute: async (data) => ok({ reserved: true }),
        compensate: async (data) => ok(undefined),
      },
      {
        name: 'ChargePayment',
        execute: async (data) => ok({ charged: true }),
        compensate: async (data) => ok(undefined),
      },
    ];

    const saga = new SagaOrchestrator<OrderContext>('OrderSaga', steps, store);
    const result = await saga.execute(
      { orderId: 'ord_123', reserved: false, charged: false },
      ctx
    );

    expect(result.success).toBe(true);
    if (!result.success) return;

    expect(result.data.status).toBe('COMPLETED');
    expect(result.data.data.reserved).toBe(true);
    expect(result.data.data.charged).toBe(true);

    const saved = await store.getState(result.data.sagaId);
    expect(saved?.status).toBe('COMPLETED');
    expect(saved?.history.length).toBeGreaterThan(2);
  });

  it('executes LIFO compensation when a middle step fails', async () => {
    const store = new InMemorySagaStore();
    const compensatedSteps: string[] = [];

    interface BookingContext extends Record<string, unknown> {
      slotLocked: boolean;
      paymentDone: boolean;
    }

    const steps: ISagaStep<BookingContext>[] = [
      {
        name: 'LockSlot',
        execute: async () => ok({ slotLocked: true }),
        compensate: async () => {
          compensatedSteps.push('LockSlot');
          return ok(undefined);
        },
      },
      {
        name: 'ProcessPayment',
        execute: async () => {
          return err(AgentError.downstream('Payment gateway timeout'));
        },
        compensate: async () => {
          compensatedSteps.push('ProcessPayment');
          return ok(undefined);
        },
      },
    ];

    const saga = new SagaOrchestrator<BookingContext>('BookingSaga', steps, store);
    const result = await saga.execute({ slotLocked: false, paymentDone: false }, ctx);

    expect(result.success).toBe(true);
    if (!result.success) return;

    expect(result.data.status).toBe('COMPENSATED');
    expect(compensatedSteps).toEqual(['LockSlot']); // LockSlot compensated in reverse order

    const saved = await store.getState(result.data.sagaId);
    expect(saved?.status).toBe('COMPENSATED');
  });
});
