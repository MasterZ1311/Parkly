/**
 * Result Monad & Agent Error Definitions
 * Provides railway-oriented functional error handling across all agent and tool boundaries.
 */

export type AgentErrorCode =
  | 'VALIDATION_ERROR'
  | 'TIMEOUT_ERROR'
  | 'CIRCUIT_OPEN'
  | 'DOWNSTREAM_FAILURE'
  | 'BUSINESS_INVARIANT_VIOLATION'
  | 'INTERNAL_ERROR';

export interface AgentErrorOptions {
  details?: unknown;
  cause?: unknown;
  agentName?: string;
  retryable?: boolean;
}

const KNOWN_ERROR_OPTION_KEYS = new Set(['details', 'cause', 'agentName', 'retryable']);

/**
 * Checks if a parameter is an AgentErrorOptions bag without colliding with domain details objects.
 */
function isAgentErrorOptions(
  value: unknown,
  hasTrailingPositionalArgs: boolean
): value is AgentErrorOptions {
  if (hasTrailingPositionalArgs) {
    return false;
  }
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }
  const keys = Object.keys(value);
  if (keys.length === 0) {
    return false;
  }
  // All keys must belong to the recognized AgentErrorOptions keys
  const hasOnlyOptionsKeys = keys.every((key) => KNOWN_ERROR_OPTION_KEYS.has(key));
  if (!hasOnlyOptionsKeys) {
    return false;
  }
  return (
    'details' in value ||
    'cause' in value ||
    'agentName' in value ||
    'retryable' in value
  );
}

/**
 * Recursively sanitizes objects and arrays so JSON.stringify(err.toJSON()) never throws
 * "TypeError: Converting circular structure to JSON".
 * Preserves DAG structures without false-positive circular marks.
 */
function makeCircularSafe(value: unknown, ancestors = new Set<unknown>()): unknown {
  if (value === null || typeof value !== 'object') {
    if (typeof value === 'bigint') {
      return value.toString();
    }
    return value;
  }

  if (ancestors.has(value)) {
    return '[Circular]';
  }

  ancestors.add(value);

  try {
    if (value instanceof Error) {
      const errorObj: Record<string, unknown> = {
        name: value.name,
        message: value.message,
        stack: value.stack,
      };
      if ('code' in value && (value as any).code !== undefined) {
        errorObj.code = (value as any).code;
      }
      if ('cause' in value && (value as any).cause !== undefined) {
        errorObj.cause = makeCircularSafe((value as any).cause, ancestors);
      }
      return errorObj;
    }

    if (Array.isArray(value)) {
      return value.map((item) => makeCircularSafe(item, ancestors));
    }

    const result: Record<string, unknown> = {};
    for (const key of Object.keys(value)) {
      try {
        result[key] = makeCircularSafe((value as Record<string, unknown>)[key], ancestors);
      } catch {
        result[key] = '[Unserializable]';
      }
    }
    return result;
  } finally {
    ancestors.delete(value);
  }
}

export class AgentError extends Error {
  readonly code: AgentErrorCode;
  readonly details?: unknown;
  override readonly cause?: unknown;
  readonly agentName?: string;
  readonly retryable: boolean;

  constructor(
    code: AgentErrorCode,
    message: string,
    detailsOrOptions?: unknown,
    cause?: unknown,
    agentName?: string,
    retryable?: boolean
  ) {
    super(message);
    this.name = 'AgentError';
    this.code = code;

    const hasTrailingArgs =
      cause !== undefined || agentName !== undefined || retryable !== undefined;

    if (isAgentErrorOptions(detailsOrOptions, hasTrailingArgs)) {
      this.details = detailsOrOptions.details;
      this.cause = detailsOrOptions.cause !== undefined ? detailsOrOptions.cause : cause;
      this.agentName = detailsOrOptions.agentName !== undefined ? detailsOrOptions.agentName : agentName;
      this.retryable =
        detailsOrOptions.retryable !== undefined
          ? detailsOrOptions.retryable
          : (retryable ??
            (code === 'TIMEOUT_ERROR' ||
              code === 'CIRCUIT_OPEN' ||
              code === 'DOWNSTREAM_FAILURE'));
    } else {
      this.details = detailsOrOptions;
      this.cause = cause;
      this.agentName = agentName;
      this.retryable =
        retryable ??
        (code === 'TIMEOUT_ERROR' ||
          code === 'CIRCUIT_OPEN' ||
          code === 'DOWNSTREAM_FAILURE');
    }

    Object.setPrototypeOf(this, AgentError.prototype);
  }

  static validation(message: string, details?: unknown, agentName?: string): AgentError {
    return new AgentError('VALIDATION_ERROR', message, details, undefined, agentName, false);
  }

  static timeout(message: string, details?: unknown, agentName?: string): AgentError {
    return new AgentError('TIMEOUT_ERROR', message, details, undefined, agentName, true);
  }

  static circuitOpen(message: string, details?: unknown, agentName?: string): AgentError {
    return new AgentError('CIRCUIT_OPEN', message, details, undefined, agentName, true);
  }

  static downstream(message: string, cause?: unknown, agentName?: string): AgentError {
    return new AgentError('DOWNSTREAM_FAILURE', message, undefined, cause, agentName, true);
  }

  static invariant(message: string, details?: unknown, agentName?: string): AgentError {
    return new AgentError('BUSINESS_INVARIANT_VIOLATION', message, details, undefined, agentName, false);
  }

  static internal(message: string, cause?: unknown, agentName?: string): AgentError {
    return new AgentError('INTERNAL_ERROR', message, undefined, cause, agentName, false);
  }

  toJSON(): Record<string, unknown> {
    const ancestors = new Set<unknown>([this]);
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      agentName: this.agentName,
      retryable: this.retryable,
      details: this.details !== undefined ? makeCircularSafe(this.details, ancestors) : undefined,
      cause: this.cause !== undefined ? makeCircularSafe(this.cause, ancestors) : undefined,
      stack: this.stack,
    };
  }
}

export type Result<T, E = AgentError> =
  | { readonly success: true; readonly data: T; readonly error?: never }
  | { readonly success: false; readonly data?: never; readonly error: E };

export function ok<T>(data: T): Result<T, never> {
  return { success: true, data };
}

export function err<E = AgentError>(error: E): Result<never, E> {
  return { success: false, error };
}

export function isOk<T, E>(
  result: Result<T, E>
): result is { readonly success: true; readonly data: T; readonly error?: never } {
  return result.success === true;
}

export function isErr<T, E>(
  result: Result<T, E>
): result is { readonly success: false; readonly data?: never; readonly error: E } {
  return result.success === false;
}

export function map<T, U, E>(
  result: Result<T, E>,
  fn: (data: T) => U
): Result<U, E> {
  if (result.success) {
    return ok(fn(result.data));
  }
  return result;
}

export function mapErr<T, E, F>(
  result: Result<T, E>,
  fn: (error: E) => F
): Result<T, F> {
  if (result.success) {
    return result;
  }
  return err(fn(result.error));
}

export function flatMap<T, U, E>(
  result: Result<T, E>,
  fn: (data: T) => Result<U, E>
): Result<U, E> {
  if (result.success) {
    return fn(result.data);
  }
  return result;
}

export function unwrap<T, E>(result: Result<T, E>): T {
  if (result.success) {
    return result.data;
  }
  throw result.error;
}

export function unwrapOr<T, E>(result: Result<T, E>, fallback: T): T {
  if (result.success) {
    return result.data;
  }
  return fallback;
}

export async function fromPromise<T, E = AgentError>(
  promise: Promise<T>,
  errorMapper?: (error: unknown) => E
): Promise<Result<T, E>> {
  try {
    const data = await promise;
    return ok(data);
  } catch (caught) {
    if (errorMapper) {
      return err(errorMapper(caught));
    }
    if (caught instanceof AgentError) {
      return err(caught as unknown as E);
    }
    const message = caught instanceof Error ? caught.message : String(caught);
    return err(new AgentError('DOWNSTREAM_FAILURE', message, undefined, caught) as unknown as E);
  }
}

export function tryCatch<T, E = AgentError>(
  fn: () => T,
  errorMapper?: (error: unknown) => E
): Result<T, E> {
  try {
    return ok(fn());
  } catch (caught) {
    if (errorMapper) {
      return err(errorMapper(caught));
    }
    if (caught instanceof AgentError) {
      return err(caught as unknown as E);
    }
    const message = caught instanceof Error ? caught.message : String(caught);
    return err(new AgentError('INTERNAL_ERROR', message, undefined, caught) as unknown as E);
  }
}

export const Result = {
  ok,
  err,
  isOk,
  isErr,
  map,
  mapErr,
  flatMap,
  unwrap,
  unwrapOr,
  fromPromise,
  tryCatch,
};
