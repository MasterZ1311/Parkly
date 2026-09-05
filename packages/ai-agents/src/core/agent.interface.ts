/**
 * BaseAgent Abstract Class & Lifecycle Protocol
 * Enforces Zod input/output schema validation, timeout budgets, and error shielding.
 */

import { z } from 'zod';
import { Result, AgentError, ok, err } from './result';
import { ExecutionContext } from './context';
import { IAgentLogger, AgentLogger } from './telemetry';

export interface AgentOptions {
  readonly timeoutMs?: number; // default: 5000ms
  readonly logger?: IAgentLogger;
}

export abstract class BaseAgent<TInput, TOutput> {
  readonly name: string;
  readonly options: AgentOptions;
  protected readonly timeoutMs: number;
  protected readonly logger: IAgentLogger;

  abstract readonly inputSchema: z.ZodType<TInput>;
  abstract readonly outputSchema: z.ZodType<TOutput>;

  constructor(name: string, options?: AgentOptions) {
    this.name = name;
    this.options = options ?? {};
    this.timeoutMs = this.options.timeoutMs ?? 5000;
    this.logger = this.options.logger ?? new AgentLogger({ bindings: { agentName: name } });
  }

  /**
   * Internal agent business logic implementation.
   * Receives strictly validated input and execution context.
   */
  protected abstract executeInternal(
    input: TInput,
    ctx: ExecutionContext
  ): Promise<Result<TOutput, AgentError>>;

  /**
   * Optional lifecycle hooks
   */
  protected onBeforeExecute?(input: TInput, ctx: ExecutionContext): Promise<void> | void;
  protected onAfterExecute?(output: TOutput, ctx: ExecutionContext): Promise<void> | void;
  protected onError?(error: AgentError, ctx: ExecutionContext): Promise<void> | void;

  /**
   * Primary entry point. Guarantees:
   * 1. Execution context null/undefined guard
   * 2. Contextual logger child propagation and span creation
   * 3. Input validation via Zod with throwing getter / proxy trap shielding
   * 4. Lifecycle hook execution (onBeforeExecute)
   * 5. Enforced timeout budget wrapping executeInternal
   * 6. Output validation via Zod with throwing getter / proxy trap shielding
   * 7. Lifecycle hook execution (onAfterExecute)
   * 8. Shielded error interception and onError hook dispatch
   */
  public async execute(
    rawInput: unknown,
    ctx: ExecutionContext
  ): Promise<Result<TOutput, AgentError>> {
    // 0. Guard against null or undefined ExecutionContext
    if (!ctx || typeof ctx !== 'object') {
      const validationError = AgentError.validation(
        `[${this.name}] Execution context cannot be null or undefined`,
        undefined,
        this.name
      );
      this.logger.error(`[${this.name}] Execution context cannot be null or undefined`);
      await this.handleErrorSafe(validationError, ctx);
      return err(validationError);
    }

    // Contextual logger and span sequence: create child logger first to bind correlation context
    const agentCtxLogger = this.logger.child({
      correlationId: ctx.correlationId,
      traceId: ctx.traceId,
      agentName: this.name,
    });
    const span = agentCtxLogger.startSpan(`${this.name}.execute`);

    agentCtxLogger.debug(`Agent ${this.name} execution started`);

    // 1. Validate Input Payload with exception shielding
    let validatedInput: TInput;
    try {
      const inputParse = this.inputSchema.safeParse(rawInput);
      if (!inputParse.success) {
        const validationError = AgentError.validation(
          `[${this.name}] Input schema validation failed`,
          inputParse.error.issues,
          this.name
        );
        span.recordError(validationError);
        await this.handleErrorSafe(validationError, ctx);
        return err(validationError);
      }
      validatedInput = inputParse.data;
    } catch (parseEx) {
      const validationError = AgentError.validation(
        `[${this.name}] Input schema validation threw an unexpected exception: ${
          parseEx instanceof Error ? parseEx.message : String(parseEx)
        }`,
        parseEx,
        this.name
      );
      span.recordError(validationError);
      await this.handleErrorSafe(validationError, ctx);
      return err(validationError);
    }

    // 2. Pre-execution Lifecycle Hook
    try {
      await this.onBeforeExecute?.(validatedInput, ctx);
    } catch (hookError) {
      const wrappedError = AgentError.internal(
        `[${this.name}] onBeforeExecute lifecycle hook failed: ${
          hookError instanceof Error ? hookError.message : String(hookError)
        }`,
        hookError,
        this.name
      );
      span.recordError(wrappedError);
      await this.handleErrorSafe(wrappedError, ctx);
      return err(wrappedError);
    }

    // 3. Timeout Budget Enforcement with executeInternal
    let timer: ReturnType<typeof setTimeout> | undefined;
    let internalResult: Result<TOutput, AgentError>;

    try {
      const timeoutPromise = new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
          reject(
            AgentError.timeout(
              `[${this.name}] Execution timed out after budget of ${this.timeoutMs}ms`,
              { timeoutMs: this.timeoutMs },
              this.name
            )
          );
        }, this.timeoutMs);
        if (typeof timer.unref === 'function') {
          timer.unref();
        }
      });

      const executionPromise = Promise.resolve().then(() =>
        this.executeInternal(validatedInput, ctx)
      );

      internalResult = await Promise.race([executionPromise, timeoutPromise]);
    } catch (caught) {
      const agentError =
        caught instanceof AgentError
          ? caught
          : AgentError.downstream(
              `[${this.name}] Unhandled exception during execution: ${
                caught instanceof Error ? caught.message : String(caught)
              }`,
              caught,
              this.name
            );

      span.recordError(agentError);
      await this.handleErrorSafe(agentError, ctx);
      return err(agentError);
    } finally {
      if (timer !== undefined) {
        clearTimeout(timer);
      }
    }

    // 4. Check Internal Result Error
    if (!internalResult.success) {
      span.recordError(internalResult.error);
      await this.handleErrorSafe(internalResult.error, ctx);
      return internalResult;
    }

    // 5. Validate Output Payload with exception shielding
    let validatedOutput: TOutput;
    try {
      const outputParse = this.outputSchema.safeParse(internalResult.data);
      if (!outputParse.success) {
        const outputValidationError = AgentError.validation(
          `[${this.name}] Output schema validation failed`,
          outputParse.error.issues,
          this.name
        );
        span.recordError(outputValidationError);
        await this.handleErrorSafe(outputValidationError, ctx);
        return err(outputValidationError);
      }
      validatedOutput = outputParse.data;
    } catch (parseEx) {
      const outputValidationError = AgentError.validation(
        `[${this.name}] Output schema validation threw an unexpected exception: ${
          parseEx instanceof Error ? parseEx.message : String(parseEx)
        }`,
        parseEx,
        this.name
      );
      span.recordError(outputValidationError);
      await this.handleErrorSafe(outputValidationError, ctx);
      return err(outputValidationError);
    }

    // 6. Post-execution Lifecycle Hook
    try {
      await this.onAfterExecute?.(validatedOutput, ctx);
    } catch (hookError) {
      const wrappedError = AgentError.internal(
        `[${this.name}] onAfterExecute lifecycle hook failed: ${
          hookError instanceof Error ? hookError.message : String(hookError)
        }`,
        hookError,
        this.name
      );
      span.recordError(wrappedError);
      await this.handleErrorSafe(wrappedError, ctx);
      return err(wrappedError);
    }

    span.end();
    agentCtxLogger.debug(`Agent ${this.name} execution completed successfully`);
    return ok(validatedOutput);
  }

  private async handleErrorSafe(error: AgentError, ctx?: ExecutionContext): Promise<void> {
    try {
      if (ctx) {
        await this.onError?.(error, ctx);
      }
    } catch (handlerError) {
      this.logger.error(`[${this.name}] onError lifecycle hook threw an exception`, handlerError);
    }
  }
}
