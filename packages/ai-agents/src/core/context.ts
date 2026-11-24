/**
 * ExecutionContext Abstraction & Factory
 * Guarantees distributed correlation, trace propagation, and context immutability.
 */

import { randomUUID } from 'crypto';
import { z } from 'zod';

export const ExecutionContextSchema = z.object({
  correlationId: z.string().min(1, 'correlationId is required'),
  traceId: z.string().min(1, 'traceId is required'),
  initiatorUserId: z.string().default('system'),
  timestamp: z.string().min(1, 'timestamp is required'),
  metadata: z.record(z.unknown()).default({}),
});

export type ExecutionContextData = z.infer<typeof ExecutionContextSchema>;

export interface ExecutionContextOptions {
  correlationId?: string;
  traceId?: string;
  initiatorUserId?: string;
  timestamp?: string;
  metadata?: Record<string, unknown>;
}

export class ExecutionContext implements ExecutionContextData {
  public readonly correlationId: string;
  public readonly traceId: string;
  public readonly initiatorUserId: string;
  public readonly timestamp: string;
  public readonly metadata: Record<string, unknown>;

  constructor(data?: ExecutionContextOptions) {
    const correlationIdInput = data?.correlationId;
    this.correlationId =
      typeof correlationIdInput === 'string' && correlationIdInput.trim().length > 0
        ? correlationIdInput
        : randomUUID();

    const traceIdInput = data?.traceId;
    this.traceId =
      typeof traceIdInput === 'string' && traceIdInput.trim().length > 0
        ? traceIdInput
        : randomUUID();

    const userIdInput = data?.initiatorUserId;
    this.initiatorUserId =
      typeof userIdInput === 'string' && userIdInput.trim().length > 0
        ? userIdInput
        : 'system';

    const timestampInput = data?.timestamp;
    this.timestamp =
      typeof timestampInput === 'string' && timestampInput.trim().length > 0
        ? timestampInput
        : new Date().toISOString();

    this.metadata = Object.freeze({ ...(data?.metadata ?? {}) });
  }

  public static create(overrides?: ExecutionContextOptions): ExecutionContext {
    return new ExecutionContext(overrides);
  }

  public createChildContext(options?: {
    traceId?: string;
    initiatorUserId?: string;
    timestamp?: string;
    metadata?: Record<string, unknown>;
  }): ExecutionContext {
    return new ExecutionContext({
      correlationId: this.correlationId, // Invariant: correlationId is permanently preserved across hops
      traceId: options?.traceId,         // Falls back to fresh randomUUID() if undefined or empty
      initiatorUserId: options?.initiatorUserId ?? this.initiatorUserId,
      timestamp: options?.timestamp,
      metadata: { ...this.metadata, ...(options?.metadata ?? {}) },
    });
  }
}

export function createExecutionContext(options?: ExecutionContextOptions): ExecutionContext {
  return ExecutionContext.create(options);
}

export function createChildContext(
  parent: ExecutionContext | ExecutionContextData,
  overrides?: Partial<ExecutionContextOptions>
): ExecutionContext {
  if (parent instanceof ExecutionContext) {
    return parent.createChildContext(overrides);
  }
  return new ExecutionContext({
    correlationId: parent.correlationId,
    traceId: overrides?.traceId,
    initiatorUserId: overrides?.initiatorUserId ?? parent.initiatorUserId,
    timestamp: overrides?.timestamp,
    metadata: { ...(parent.metadata ?? {}), ...(overrides?.metadata ?? {}) },
  });
}
