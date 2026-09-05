import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import { BaseAgent, AgentOptions } from '../../../src/core/agent.interface';
import { Result, ok, AgentError } from '../../../src/core/result';
import { ExecutionContext, createExecutionContext } from '../../../src/core/context';
import { AgentLogger } from '../../../src/core/telemetry';

// Test Agent Implementation
interface CalcInput {
  value: number;
}
interface CalcOutput {
  result: number;
}

class TestCalculationAgent extends BaseAgent<CalcInput, CalcOutput> {
  readonly inputSchema = z.object({
    value: z.number().min(0, 'value must be non-negative'),
  });

  readonly outputSchema = z.object({
    result: z.number().max(1000, 'result cannot exceed 1000'),
  });

  public hookOrder: string[] = [];
  public executeInternalDelayMs = 0;
  public throwInternalError?: Error;
  public throwBeforeHook?: Error;
  public throwAfterHook?: Error;
  public throwOnErrorHook?: Error;
  public malformedOutput = false;

  constructor(name = 'TestCalculationAgent', options?: AgentOptions) {
    super(name, options);
  }

  protected override async onBeforeExecute(_input: CalcInput, _ctx: ExecutionContext): Promise<void> {
    this.hookOrder.push('onBeforeExecute');
    if (this.throwBeforeHook) {
      throw this.throwBeforeHook;
    }
  }

  protected override async onAfterExecute(_output: CalcOutput, _ctx: ExecutionContext): Promise<void> {
    this.hookOrder.push('onAfterExecute');
    if (this.throwAfterHook) {
      throw this.throwAfterHook;
    }
  }

  protected override async onError(error: AgentError, _ctx: ExecutionContext): Promise<void> {
    this.hookOrder.push(`onError:${error.code}`);
    if (this.throwOnErrorHook) {
      throw this.throwOnErrorHook;
    }
  }

  protected async executeInternal(
    input: CalcInput,
    _ctx: ExecutionContext
  ): Promise<Result<CalcOutput, AgentError>> {
    this.hookOrder.push('executeInternal');

    if (this.throwInternalError) {
      throw this.throwInternalError;
    }

    if (this.executeInternalDelayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, this.executeInternalDelayMs));
    }

    if (this.malformedOutput) {
      // Violates outputSchema constraint (result cannot exceed 1000)
      return ok({ result: 9999 });
    }

    return ok({ result: input.value * 2 });
  }
}

describe('BaseAgent Abstract Class & Lifecycle Unit Tests', () => {
  const ctx = createExecutionContext({ correlationId: 'test-corr-1' });

  it('AGT-01: Happy Path Execution with full schema validation and lifecycle hooks', async () => {
    const memoryLogs: string[] = [];
    const logger = new AgentLogger({
      writeFn: (str) => memoryLogs.push(str),
    });

    const agent = new TestCalculationAgent('HappyAgent', { logger });
    const result = await agent.execute({ value: 25 }, ctx);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual({ result: 50 });
    }

    expect(agent.hookOrder).toEqual([
      'onBeforeExecute',
      'executeInternal',
      'onAfterExecute',
    ]);
  });

  it('AGT-02: Input validation error rejects invalid input without running executeInternal', async () => {
    const agent = new TestCalculationAgent();

    // Value is negative, violating z.number().min(0)
    const result = await agent.execute({ value: -10 }, ctx);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBeInstanceOf(AgentError);
      expect(result.error.code).toBe('VALIDATION_ERROR');
      expect(result.error.message).toContain('Input schema validation failed');
      expect(result.error.agentName).toBe('TestCalculationAgent');
      expect(result.error.retryable).toBe(false);
    }

    expect(agent.hookOrder).toEqual(['onError:VALIDATION_ERROR']);
  });

  it('AGT-03: Output validation error catches malformed agent responses', async () => {
    const agent = new TestCalculationAgent();
    agent.malformedOutput = true;

    const result = await agent.execute({ value: 10 }, ctx);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBeInstanceOf(AgentError);
      expect(result.error.code).toBe('VALIDATION_ERROR');
      expect(result.error.message).toContain('Output schema validation failed');
    }

    expect(agent.hookOrder).toEqual([
      'onBeforeExecute',
      'executeInternal',
      'onError:VALIDATION_ERROR',
    ]);
  });

  it('AGT-04: Timeout budget enforcement aborts slow agent executions', async () => {
    const agent = new TestCalculationAgent('SlowAgent', { timeoutMs: 50 });
    agent.executeInternalDelayMs = 150; // Exceeds 50ms budget

    const result = await agent.execute({ value: 5 }, ctx);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBeInstanceOf(AgentError);
      expect(result.error.code).toBe('TIMEOUT_ERROR');
      expect(result.error.message).toContain('Execution timed out after budget of 50ms');
      expect(result.error.retryable).toBe(true);
    }

    expect(agent.hookOrder).toContain('onError:TIMEOUT_ERROR');
  });

  it('AGT-05: Fast execution cleans up timer handle without open handle warnings', async () => {
    const agent = new TestCalculationAgent('FastAgent', { timeoutMs: 5000 });
    const result = await agent.execute({ value: 12 }, ctx);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.result).toBe(24);
    }
  });

  it('AGT-06: Exception shielding intercepts unhandled exceptions as DOWNSTREAM_FAILURE', async () => {
    const agent = new TestCalculationAgent();
    agent.throwInternalError = new Error('Database connection pool exhausted');

    const result = await agent.execute({ value: 7 }, ctx);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBeInstanceOf(AgentError);
      expect(result.error.code).toBe('DOWNSTREAM_FAILURE');
      expect(result.error.message).toContain('Database connection pool exhausted');
      expect(result.error.retryable).toBe(true);
    }

    expect(agent.hookOrder).toEqual([
      'onBeforeExecute',
      'executeInternal',
      'onError:DOWNSTREAM_FAILURE',
    ]);
  });

  it('AGT-07: Lifecycle hook failures in onBeforeExecute abort and return INTERNAL_ERROR', async () => {
    const agent = new TestCalculationAgent();
    agent.throwBeforeHook = new Error('Auth token decrypt failed');

    const result = await agent.execute({ value: 15 }, ctx);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBeInstanceOf(AgentError);
      expect(result.error.code).toBe('INTERNAL_ERROR');
      expect(result.error.message).toContain('onBeforeExecute lifecycle hook failed');
    }

    expect(agent.hookOrder).toEqual([
      'onBeforeExecute',
      'onError:INTERNAL_ERROR',
    ]);
  });

  it('AGT-08: Lifecycle hook failures in onAfterExecute abort and return INTERNAL_ERROR', async () => {
    const agent = new TestCalculationAgent();
    agent.throwAfterHook = new Error('Audit journal write error');

    const result = await agent.execute({ value: 20 }, ctx);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBeInstanceOf(AgentError);
      expect(result.error.code).toBe('INTERNAL_ERROR');
      expect(result.error.message).toContain('onAfterExecute lifecycle hook failed');
    }

    expect(agent.hookOrder).toEqual([
      'onBeforeExecute',
      'executeInternal',
      'onAfterExecute',
      'onError:INTERNAL_ERROR',
    ]);
  });

  it('AGT-09: onError lifecycle hook throwing does not crash execute()', async () => {
    const agent = new TestCalculationAgent();
    agent.throwBeforeHook = new Error('Pre-hook crash');
    agent.throwOnErrorHook = new Error('Notifier unreachable');

    // Must not throw an uncaught promise rejection
    const result = await agent.execute({ value: 1 }, ctx);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe('INTERNAL_ERROR');
    }
  });

  it('AGT-10: Concurrency isolation with 10 parallel agent executions', async () => {
    const agent = new TestCalculationAgent();
    const testValues = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

    const promises = testValues.map((val) => {
      const childCtx = ctx.createChildContext({ metadata: { inputVal: val } });
      return agent.execute({ value: val }, childCtx);
    });

    const results = await Promise.all(promises);

    expect(results.length).toBe(10);
    results.forEach((res, index) => {
      expect(res.success).toBe(true);
      if (res.success) {
        expect(res.data.result).toBe(testValues[index]! * 2);
      }
    });
  });
});
