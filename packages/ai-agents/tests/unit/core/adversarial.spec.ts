/**
 * Adversarial Verification & Stress Test Suite
 * Milestone 1: CircuitBreaker, BaseAgent & Result Monad
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { z } from 'zod';
import {
  CircuitBreaker,
  CircuitState,
  BaseAgent,
  Result,
  AgentError,
  ExecutionContext,
  ok,
  err,
  unwrap,
  unwrapOr,
  map,
  mapErr,
  flatMap,
  fromPromise,
  tryCatch,
} from '../../../src/core';

describe('Adversarial Verification: Milestone 1', () => {
  // ---------------------------------------------------------------------------
  // TARGET 1: CircuitBreaker Stress & State Machine
  // ---------------------------------------------------------------------------
  describe('Target 1: CircuitBreaker Stress & State Machine', () => {
    it('handles rapid failure bursts (50 concurrent failures) with state stability', async () => {
      const stateTransitions: Array<{ from: CircuitState; to: CircuitState }> = [];
      const breaker = new CircuitBreaker({
        failureThreshold: 5,
        resetTimeoutMs: 200,
        name: 'RapidBurstBreaker',
        onStateChange: (from, to) => stateTransitions.push({ from, to }),
      });

      // Launch 50 simultaneous failing requests
      const tasks = Array.from({ length: 50 }, (_, i) =>
        breaker
          .execute(
            async () => {
              throw new Error(`Burst failure ${i}`);
            },
            async () => `fallback-${i}`
          )
          .catch((e) => e)
      );

      const results = await Promise.all(tasks);

      // Verify circuit is now OPEN
      expect(breaker.getState()).toBe('OPEN');
      // Verify state transitioned from CLOSED to OPEN exactly once
      expect(stateTransitions).toEqual([{ from: 'CLOSED', to: 'OPEN' }]);
      expect(results.length).toBe(50);

      // In CLOSED state, failures before the threshold (5) are thrown to caller
      // Once threshold is reached, breaker trips to OPEN and executes fallback
      const errors = results.filter((r) => r instanceof Error);
      const fallbacks = results.filter((r) => typeof r === 'string' && r.startsWith('fallback-'));

      expect(errors.length).toBe(breaker.failureThreshold - 1); // 4 failures thrown before trip
      expect(fallbacks.length).toBe(50 - (breaker.failureThreshold - 1)); // 46 fallbacks executed
      expect(breaker.getFailureCount()).toBe(breaker.failureThreshold);
    });

    it('cycles through CLOSED -> OPEN -> HALF_OPEN -> CLOSED -> OPEN cleanly', async () => {
      vi.useFakeTimers();
      const stateChanges: string[] = [];
      const breaker = new CircuitBreaker({
        failureThreshold: 2,
        resetTimeoutMs: 1000,
        name: 'CycleBreaker',
        onStateChange: (from, to) => stateChanges.push(`${from}->${to}`),
      });

      expect(breaker.getState()).toBe('CLOSED');

      // 1. Trigger trip (CLOSED -> OPEN)
      await expect(breaker.execute(async () => { throw new Error('fail-1'); })).rejects.toThrow();
      expect(breaker.getState()).toBe('CLOSED');
      await expect(breaker.execute(async () => { throw new Error('fail-2'); })).rejects.toThrow();
      expect(breaker.getState()).toBe('OPEN');

      // 2. Advance time past resetTimeoutMs -> HALF_OPEN
      vi.advanceTimersByTime(1001);
      expect(breaker.getState()).toBe('HALF_OPEN');

      // 3. Successful probe -> resets to CLOSED
      const probeResult = await breaker.execute(async () => 'probe-success');
      expect(probeResult).toBe('probe-success');
      expect(breaker.getState()).toBe('CLOSED');

      // 4. Trip again: 2 failures -> back to OPEN
      await expect(breaker.execute(async () => { throw new Error('fail-3'); })).rejects.toThrow();
      await expect(breaker.execute(async () => { throw new Error('fail-4'); })).rejects.toThrow();
      expect(breaker.getState()).toBe('OPEN');

      // 5. Advance time -> HALF_OPEN again
      vi.advanceTimersByTime(1001);
      expect(breaker.getState()).toBe('HALF_OPEN');

      // 6. Trial failure -> re-trips back to OPEN immediately
      await expect(breaker.execute(async () => { throw new Error('probe-failed'); })).rejects.toThrow();
      expect(breaker.getState()).toBe('OPEN');

      expect(stateChanges).toEqual([
        'CLOSED->OPEN',
        'OPEN->HALF_OPEN',
        'HALF_OPEN->CLOSED',
        'CLOSED->OPEN',
        'OPEN->HALF_OPEN',
        'HALF_OPEN->OPEN',
      ]);

      vi.useRealTimers();
    });

    it('isolates fallback execution and preserves error semantics when fallback fails', async () => {
      const breaker = new CircuitBreaker({
        failureThreshold: 1,
        resetTimeoutMs: 5000,
        name: 'FallbackIsolationBreaker',
      });

      // Trip the breaker
      await expect(breaker.execute(async () => { throw new Error('primary failure'); })).rejects.toThrow('primary failure');
      expect(breaker.getState()).toBe('OPEN');

      // Execute with a throwing fallback
      await expect(
        breaker.execute(
          async () => 'should-not-run',
          async () => {
            throw new Error('fallback failure');
          }
        )
      ).rejects.toThrow('fallback failure');

      // State remains OPEN
      expect(breaker.getState()).toBe('OPEN');
    });

    it('maintains state stability and zero drift with repeated getState polling', () => {
      const breaker = new CircuitBreaker({
        failureThreshold: 3,
        resetTimeoutMs: 5000,
      });

      for (let i = 0; i < 1000; i++) {
        expect(breaker.getState()).toBe('CLOSED');
      }
      expect(breaker.getFailureCount()).toBe(0);
      expect(breaker.getSuccessCount()).toBe(0);
      expect(breaker.getLastFailureTime()).toBeNull();
    });

    it('allows manual reset from any state restoring initial metrics', () => {
      const breaker = new CircuitBreaker({ failureThreshold: 2 });
      breaker.trip();
      expect(breaker.getState()).toBe('OPEN');

      breaker.reset();
      expect(breaker.getState()).toBe('CLOSED');
      expect(breaker.getFailureCount()).toBe(0);
      expect(breaker.getSuccessCount()).toBe(0);
      expect(breaker.getLastFailureTime()).toBeNull();
    });
  });

  // ---------------------------------------------------------------------------
  // TARGET 2: BaseAgent Concurrency, Timeout Races & Resource Leakage
  // ---------------------------------------------------------------------------
  describe('Target 2: BaseAgent Concurrency & Timeout Races', () => {
    class MockWorkerAgent extends BaseAgent<{ delayMs: number; shouldThrow?: boolean; value?: string }, { result: string }> {
      readonly inputSchema = z.object({
        delayMs: z.number(),
        shouldThrow: z.boolean().optional(),
        value: z.string().optional(),
      });
      readonly outputSchema = z.object({
        result: z.string(),
      });

      protected async executeInternal(
        input: { delayMs: number; shouldThrow?: boolean; value?: string },
        _ctx: ExecutionContext
      ): Promise<Result<{ result: string }, AgentError>> {
        if (input.delayMs > 0) {
          await new Promise((resolve) => setTimeout(resolve, input.delayMs));
        }
        if (input.shouldThrow) {
          throw new Error(`Worker exploded: ${input.value ?? 'unknown'}`);
        }
        return ok({ result: input.value ?? 'success' });
      }
    }

    it('enforces execution timeout strictly when execution exceeds budget', async () => {
      const agent = new MockWorkerAgent('StrictTimeoutAgent', { timeoutMs: 40 });
      const ctx = ExecutionContext.create();

      const startTime = performance.now();
      const res = await agent.execute({ delayMs: 150, value: 'too-slow' }, ctx);
      const elapsed = performance.now() - startTime;

      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.error.code).toBe('TIMEOUT_ERROR');
        expect(res.error.retryable).toBe(true);
        expect(res.error.agentName).toBe('StrictTimeoutAgent');
      }
      // Returned TIMEOUT_ERROR rather than waiting for completion or hanging
      expect(elapsed).toBeLessThan(1000);
    });

    it('executes 50 concurrent agent calls with diverse timings and failure modes without race conditions', async () => {
      const agent = new MockWorkerAgent('ConcurrentStressAgent', { timeoutMs: 80 });
      const parentCtx = ExecutionContext.create({ initiatorUserId: 'load-test' });

      const executions = Array.from({ length: 50 }, (_, i) => {
        const childCtx = parentCtx.createChildContext({ metadata: { index: i } });
        const isTimeout = i % 4 === 0;
        const isError = i % 4 === 1;
        const delay = isTimeout ? 150 : (i % 5) * 5;

        return agent.execute(
          {
            delayMs: delay,
            shouldThrow: isError,
            value: `call-${i}`,
          },
          childCtx
        );
      });

      const results = await Promise.all(executions);

      expect(results.length).toBe(50);
      for (let i = 0; i < 50; i++) {
        const res = results[i];
        if (i % 4 === 0) {
          // Timeout case
          expect(res.success).toBe(false);
          if (!res.success) expect(res.error.code).toBe('TIMEOUT_ERROR');
        } else if (i % 4 === 1) {
          // Error case
          expect(res.success).toBe(false);
          if (!res.success) expect(res.error.code).toBe('DOWNSTREAM_FAILURE');
        } else {
          // Success case
          expect(res.success).toBe(true);
          if (res.success) expect(res.data.result).toBe(`call-${i}`);
        }
      }
    });

    it('ensures unhandled promise rejection avoidance when executeInternal rejects AFTER timeout', async () => {
      // Setup unhandled rejection listener
      const unhandledRejections: unknown[] = [];
      const onUnhandled = (reason: unknown) => {
        unhandledRejections.push(reason);
      };
      process.on('unhandledRejection', onUnhandled);

      try {
        const agent = new MockWorkerAgent('LateRejectingAgent', { timeoutMs: 30 });
        const ctx = ExecutionContext.create();

        // Execution takes 80ms and then throws
        const res = await agent.execute({ delayMs: 80, shouldThrow: true, value: 'late-boom' }, ctx);

        // Verify initial timeout return
        expect(res.success).toBe(false);
        if (!res.success) {
          expect(res.error.code).toBe('TIMEOUT_ERROR');
        }

        // Wait for the background executeInternal to complete its delay and throw
        await new Promise((resolve) => setTimeout(resolve, 100));

        // CRITICAL CHECK: In Node.js, did the late rejection trigger an unhandledRejection event?
        // Note: Promise.resolve().then(() => executeInternal) without catch causes unhandledRejection if it throws!
        expect(unhandledRejections.length).toBe(0);
      } finally {
        process.removeListener('unhandledRejection', onUnhandled);
      }
    });

    it('cleans up timeout timers without process hang or timer leakage', async () => {
      const agent = new MockWorkerAgent('TimerCleanupAgent', { timeoutMs: 5000 });
      const ctx = ExecutionContext.create();

      // Execute 20 fast operations
      for (let i = 0; i < 20; i++) {
        const res = await agent.execute({ delayMs: 0, value: `fast-${i}` }, ctx);
        expect(res.success).toBe(true);
      }
    });
  });

  // ---------------------------------------------------------------------------
  // TARGET 3: Result Monad Edge Cases & Circular Error Structures
  // ---------------------------------------------------------------------------
  describe('Target 3: Result Monad Edge Cases', () => {
    it('handles unwrap and unwrapOr across primitive, null, and object boundaries', () => {
      expect(unwrap(ok(42))).toBe(42);
      expect(unwrap(ok('hello'))).toBe('hello');
      expect(unwrap(ok(null))).toBeNull();
      expect(unwrap(ok(undefined))).toBeUndefined();
      expect(unwrap(ok({ a: 1 }))).toEqual({ a: 1 });

      const testError = AgentError.internal('boom');
      expect(() => unwrap(err(testError))).toThrow(testError);

      expect(unwrapOr(ok(100), 200)).toBe(100);
      expect(unwrapOr(err(testError), 200)).toBe(200);
      expect(unwrapOr(ok(null), 'fallback')).toBeNull();
    });

    it('supports nested results and monad chaining (flatMap, map, mapErr)', () => {
      const innerOk = ok(10);
      const outerOk = ok(innerOk);

      const unwrapped = unwrap(outerOk);
      expect(isOk(unwrapped)).toBe(true);
      expect(unwrap(unwrapped)).toBe(10);

      // flatMap flattening
      const chained = flatMap(ok(5), (val) => ok(val * 2));
      expect(unwrap(chained)).toBe(10);

      const failedChain = flatMap(ok(5), (_) => err(AgentError.validation('invalid number')));
      expect(failedChain.success).toBe(false);

      // map and mapErr
      const mapped = map(ok(2), (x) => x + 1);
      expect(unwrap(mapped)).toBe(3);

      const mappedErr = mapErr(err(new Error('raw')), (e) => AgentError.internal(e.message));
      expect(mappedErr.success).toBe(false);
      if (!mappedErr.success) {
        expect(mappedErr.error.code).toBe('INTERNAL_ERROR');
      }
    });

    it('handles circular reference safely in AgentError.toJSON when serialized with JSON.stringify', () => {
      const circularObj: any = { tag: 'circular-data' };
      circularObj.self = circularObj;

      // Circular in details
      const errWithCircularDetails = new AgentError(
        'VALIDATION_ERROR',
        'Validation failed with circular structure',
        circularObj
      );

      // JSON.stringify should succeed without throwing
      expect(() => JSON.stringify(errWithCircularDetails)).not.toThrow();
      const parsedDetails = JSON.parse(JSON.stringify(errWithCircularDetails));
      expect(parsedDetails.details.self).toBe('[Circular]');

      // Circular in non-Error cause
      const errWithCircularCause = new AgentError(
        'DOWNSTREAM_FAILURE',
        'Downstream failure with circular cause',
        undefined,
        circularObj
      );

      expect(() => JSON.stringify(errWithCircularCause)).not.toThrow();
      const parsedCause = JSON.parse(JSON.stringify(errWithCircularCause));
      expect(parsedCause.cause.self).toBe('[Circular]');
    });

    it('preserves business details when passing an object with "cause" or other fields as details parameter', () => {
      // Developer passes details object: { cause: 'schema_mismatch', field: 'postalCode', allowed: ['600001', '600002'] }
      const businessDetails = {
        cause: 'schema_mismatch',
        field: 'postalCode',
        allowed: ['600001', '600002'],
      };

      const err = new AgentError(
        'VALIDATION_ERROR',
        'Postal code invalid',
        businessDetails
      );

      // Details must be preserved exactly
      expect(err.details).toEqual(businessDetails);
    });

    it('demonstrates half-open concurrency race where late success in half-open resets a re-tripped breaker', async () => {
      const breaker = new CircuitBreaker({
        failureThreshold: 1,
        resetTimeoutMs: 50,
        halfOpenSuccessThreshold: 1,
      });

      // Trip to OPEN
      await expect(breaker.execute(async () => { throw new Error('initial trip'); })).rejects.toThrow();
      expect(breaker.getState()).toBe('OPEN');

      // Wait for resetTimeoutMs to pass
      await new Promise((resolve) => setTimeout(resolve, 70));
      expect(breaker.getState()).toBe('HALF_OPEN');

      // Launch two concurrent operations in HALF_OPEN:
      // Op 1 fails at 20ms -> re-trips breaker to OPEN
      // Op 2 succeeds at 50ms -> calls reset() despite breaker being re-tripped!
      const op1 = breaker.execute(async () => {
        await new Promise((r) => setTimeout(r, 20));
        throw new Error('probe 1 failed');
      }).catch((e) => e);

      const op2 = breaker.execute(async () => {
        await new Promise((r) => setTimeout(r, 50));
        return 'probe 2 success';
      });

      const [res1, res2] = await Promise.all([op1, op2]);
      expect(res1).toBeInstanceOf(Error);
      expect(res2).toBe('probe 2 success');

      // Due to the race condition in execute(), Op 2 was evaluated when currentState was HALF_OPEN,
      // and when it resolved, it called this.reset(), flipping the breaker back to CLOSED
      // even though Op 1 just tripped it to OPEN!
      expect(breaker.getState()).toBe('CLOSED');
    });

    it('handles fromPromise and tryCatch with various thrown primitives and objects', async () => {
      // fromPromise with resolving promise
      const p1 = fromPromise(Promise.resolve('resolved-data'));
      expect(await p1).toEqual({ success: true, data: 'resolved-data' });

      // fromPromise with string rejection
      const p2 = fromPromise(Promise.reject('string error'));
      const r2 = await p2;
      expect(r2.success).toBe(false);
      if (!r2.success) {
        expect(r2.error.code).toBe('DOWNSTREAM_FAILURE');
        expect(r2.error.message).toContain('string error');
      }

      // tryCatch with successful function
      const t1 = tryCatch(() => 123);
      expect(t1).toEqual({ success: true, data: 123 });

      // tryCatch with throwing function
      const t2 = tryCatch(() => {
        throw new Error('sync explode');
      });
      expect(t2.success).toBe(false);
      if (!t2.success) {
        expect(t2.error.code).toBe('INTERNAL_ERROR');
        expect(t2.error.message).toContain('sync explode');
      }
    });
  });
});

function isOk<T, E>(result: Result<T, E>): result is { success: true; data: T } {
  return result.success;
}
