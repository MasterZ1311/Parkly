/**
 * Structured Logging & Telemetry Spans
 * Emits Pino-compatible structured JSON entries and microsecond performance spans.
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogBindings {
  correlationId?: string;
  traceId?: string;
  agentName?: string;
  [key: string]: unknown;
}

export interface LogEntry {
  readonly time: string;
  readonly level: LogLevel;
  readonly msg: string;
  readonly correlationId?: string;
  readonly traceId?: string;
  readonly agentName?: string;
  readonly durationMs?: number;
  readonly details?: unknown;
  readonly err?: {
    readonly name?: string;
    readonly message: string;
    readonly stack?: string;
    readonly code?: string;
  };
  readonly [key: string]: unknown;
}

export interface IAgentLogger {
  debug(message: string, meta?: Record<string, unknown>): void;
  info(message: string, meta?: Record<string, unknown>): void;
  warn(message: string, meta?: Record<string, unknown>): void;
  error(message: string, error?: unknown, meta?: Record<string, unknown>): void;
  child(bindings: LogBindings): IAgentLogger;
  startSpan(name: string, meta?: Record<string, unknown>): TelemetrySpan;
}

export type ILogger = IAgentLogger;

export class TelemetrySpan {
  readonly name: string;
  private readonly startTime: number;
  private attributes: Record<string, unknown> = {};

  constructor(name: string, private readonly logger: IAgentLogger, initialMeta?: Record<string, unknown>) {
    this.name = name;
    this.startTime = performance.now();
    if (initialMeta) {
      this.attributes = { ...initialMeta };
    }
  }

  setAttribute(key: string, value: unknown): this {
    this.attributes[key] = value;
    return this;
  }

  end(): number {
    const durationMs = Math.round((performance.now() - this.startTime) * 100) / 100;
    this.logger.debug(`Span ended: ${this.name}`, {
      spanName: this.name,
      durationMs,
      ...this.attributes,
    });
    return durationMs;
  }

  recordError(error: unknown): void {
    const durationMs = Math.round((performance.now() - this.startTime) * 100) / 100;
    this.logger.error(`Span failed: ${this.name}`, error, {
      spanName: this.name,
      durationMs,
      ...this.attributes,
    });
  }
}

export interface LoggerOptions {
  minLevel?: LogLevel;
  bindings?: LogBindings;
  writeFn?: (jsonString: string) => void;
  retainMemoryLogs?: boolean;
}

const LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

/**
 * Safely stringifies an object to JSON, preserving repeated non-circular
 * references in Directed Acyclic Graphs (DAGs) while detecting true circular
 * references and converting them to '[Circular]'. Handles BigInt and serialization throws.
 */
function safeStringify(obj: unknown): string {
  try {
    const stack: unknown[] = [];

    return (
      JSON.stringify(obj, function (this: unknown, _key: string, value: unknown) {
        if (typeof value === 'bigint') {
          return value.toString();
        }

        if (typeof value === 'object' && value !== null) {
          // Adjust active ancestor stack to the current container (this)
          const thisIndex = stack.indexOf(this);
          if (thisIndex !== -1) {
            stack.length = thisIndex + 1;
          } else {
            stack.push(this);
          }

          // Check if value is already an ancestor on the active recursion branch
          if (stack.indexOf(value) !== -1) {
            return '[Circular]';
          }
        }

        return value;
      }) ?? 'undefined'
    );
  } catch (error) {
    // Fallback if custom toJSON or property getters throw during serialization
    try {
      return JSON.stringify({
        level: 'error',
        msg: 'Serialization failure in safeStringify',
        error: error instanceof Error ? error.message : String(error),
      });
    } catch {
      return '{"level":"error","msg":"Critical serialization failure"}';
    }
  }
}

export class AgentLogger implements IAgentLogger {
  private readonly minLevel: LogLevel;
  private readonly bindings: LogBindings;
  private readonly writeFn: (jsonString: string) => void;
  private readonly memoryLogs: Array<Record<string, unknown>> = [];
  private readonly retainMemoryLogs: boolean;

  constructor(options?: LoggerOptions) {
    this.minLevel = options?.minLevel ?? 'info';
    this.bindings = options?.bindings ?? {};
    this.writeFn = options?.writeFn ?? ((str: string) => process.stdout.write(str + '\n'));
    this.retainMemoryLogs = options?.retainMemoryLogs ?? false;
  }

  private shouldLog(level: LogLevel): boolean {
    return LEVEL_PRIORITY[level] >= LEVEL_PRIORITY[this.minLevel];
  }

  private emit(level: LogLevel, message: string, meta?: Record<string, unknown>, error?: unknown): void {
    if (!this.shouldLog(level)) return;

    try {
      const entry: Record<string, unknown> = {
        level,
        time: new Date().toISOString(),
        msg: message,
        ...this.bindings,
        ...meta,
      };

      if (error !== undefined) {
        if (error instanceof Error) {
          entry.err = {
            name: error.name,
            message: error.message,
            stack: error.stack,
            ...((error as any).code ? { code: (error as any).code } : {}),
            ...((error as any).details ? { details: (error as any).details } : {}),
          };
        } else {
          entry.err = { message: String(error) };
        }
      }

      if (this.retainMemoryLogs) {
        this.memoryLogs.push(entry);
      }

      this.writeFn(safeStringify(entry));
    } catch (loggingError) {
      // Shield against writeFn, meta accessor, or custom toJSON errors.
      // Observability must never crash the caller.
      try {
        if (typeof process !== 'undefined' && process.stderr && typeof process.stderr.write === 'function') {
          process.stderr.write(
            `[AgentLogger] Failed to emit log (${level}: ${message}): ${String(loggingError)}\n`
          );
        }
      } catch {
        // Silently swallow if stderr is also unavailable
      }
    }
  }

  debug(message: string, meta?: Record<string, unknown>): void {
    this.emit('debug', message, meta);
  }

  info(message: string, meta?: Record<string, unknown>): void {
    this.emit('info', message, meta);
  }

  warn(message: string, meta?: Record<string, unknown>): void {
    this.emit('warn', message, meta);
  }

  error(message: string, error?: unknown, meta?: Record<string, unknown>): void {
    this.emit('error', message, meta, error);
  }

  child(bindings: LogBindings): IAgentLogger {
    return new AgentLogger({
      minLevel: this.minLevel,
      bindings: { ...this.bindings, ...bindings },
      writeFn: this.writeFn,
      retainMemoryLogs: this.retainMemoryLogs,
    });
  }

  startSpan(name: string, meta?: Record<string, unknown>): TelemetrySpan {
    return new TelemetrySpan(name, this, meta);
  }

  getMemoryLogs(): Array<Record<string, unknown>> {
    return [...this.memoryLogs];
  }

  clearMemoryLogs(): void {
    this.memoryLogs.length = 0;
  }
}
