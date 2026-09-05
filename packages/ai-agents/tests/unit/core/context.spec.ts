import { describe, it, expect } from 'vitest';
import {
  ExecutionContext,
  createExecutionContext,
  createChildContext,
  ExecutionContextSchema,
} from '../../../src/core/context';

describe('ExecutionContext Unit Tests', () => {
  const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

  describe('createExecutionContext() and ExecutionContext.create()', () => {
    it('creates root context with auto-generated UUIDs and default initiatorUserId', () => {
      const ctx = createExecutionContext();

      expect(ctx.correlationId).toMatch(UUID_REGEX);
      expect(ctx.traceId).toMatch(UUID_REGEX);
      expect(ctx.initiatorUserId).toBe('system');
      expect(typeof ctx.timestamp).toBe('string');
      expect(new Date(ctx.timestamp).toISOString()).toBe(ctx.timestamp);
      expect(ctx.metadata).toEqual({});
      expect(Object.isFrozen(ctx.metadata)).toBe(true);
    });

    it('creates context with custom options overrides', () => {
      const customMeta = { tenantId: 'TN-44', channel: 'mobile' };
      const ctx = createExecutionContext({
        correlationId: 'corr-12345',
        traceId: 'trace-67890',
        initiatorUserId: 'user-chennai-99',
        timestamp: '2026-09-05T10:00:00.000Z',
        metadata: customMeta,
      });

      expect(ctx.correlationId).toBe('corr-12345');
      expect(ctx.traceId).toBe('trace-67890');
      expect(ctx.initiatorUserId).toBe('user-chennai-99');
      expect(ctx.timestamp).toBe('2026-09-05T10:00:00.000Z');
      expect(ctx.metadata).toEqual(customMeta);
      expect(Object.isFrozen(ctx.metadata)).toBe(true);
    });

    it('guarantees immutability of metadata against external mutation', () => {
      const externalMeta = { key: 'initial' };
      const ctx = createExecutionContext({ metadata: externalMeta });

      externalMeta.key = 'mutated';
      expect(ctx.metadata.key).toBe('initial');
      expect(() => {
        (ctx.metadata as any).newKey = 'forbidden';
      }).toThrow();
    });

    it('sanitizes empty and whitespace correlationId and traceId to fresh randomUUIDs', () => {
      const ctxEmpty = new ExecutionContext({
        correlationId: '',
        traceId: '   ',
        initiatorUserId: '   ',
      });

      expect(ctxEmpty.correlationId).toMatch(UUID_REGEX);
      expect(ctxEmpty.correlationId.length).toBeGreaterThan(0);
      expect(ctxEmpty.traceId).toMatch(UUID_REGEX);
      expect(ctxEmpty.initiatorUserId).toBe('system');

      // Validates cleanly against ExecutionContextSchema
      const parseResult = ExecutionContextSchema.safeParse(ctxEmpty);
      expect(parseResult.success).toBe(true);
    });

    it('instantiates cleanly with no arguments (default options)', () => {
      const ctx = new ExecutionContext();
      expect(ctx.correlationId).toMatch(UUID_REGEX);
      expect(ctx.traceId).toMatch(UUID_REGEX);
      expect(ctx.initiatorUserId).toBe('system');
      expect(typeof ctx.timestamp).toBe('string');
    });
  });

  describe('createChildContext() and child context propagation', () => {
    it('preserves correlationId and generates new traceId by default (Invariant)', () => {
      const parent = createExecutionContext({
        correlationId: 'root-correlation-001',
        traceId: 'root-trace-001',
        initiatorUserId: 'driver-45',
        metadata: { parentTag: 'value-parent' },
      });

      const child = createChildContext(parent);

      expect(child.correlationId).toBe('root-correlation-001'); // Invariant: must match parent
      expect(child.traceId).toMatch(UUID_REGEX);
      expect(child.traceId).not.toBe('root-trace-001'); // Trace must be unique
      expect(child.initiatorUserId).toBe('driver-45'); // Inherited
      expect(child.metadata.parentTag).toBe('value-parent');
    });

    it('merges child metadata with parent metadata and preserves isolation', () => {
      const parent = createExecutionContext({
        metadata: { parentOnly: 'A', shared: 'original' },
      });

      const child = createChildContext(parent, {
        metadata: { childOnly: 'B', shared: 'override' },
      });

      expect(child.metadata).toEqual({
        parentOnly: 'A',
        shared: 'override',
        childOnly: 'B',
      });
      // Parent is unchanged
      expect(parent.metadata.shared).toBe('original');
      expect((parent.metadata as any).childOnly).toBeUndefined();
    });

    it('supports child context creation via instance method ctx.createChildContext()', () => {
      const parent = ExecutionContext.create({
        correlationId: 'instance-corr-99',
        metadata: { region: 'chennai-tnagar' },
      });

      const child = parent.createChildContext({
        metadata: { step: 'visual-inspection' },
      });

      expect(child.correlationId).toBe('instance-corr-99');
      expect(child.metadata.region).toBe('chennai-tnagar');
      expect(child.metadata.step).toBe('step' in child.metadata ? 'visual-inspection' : '');
    });

    it('preserves correlationId across 5 nested child context hops', () => {
      const root = createExecutionContext({ correlationId: 'saga-boundary-777' });
      const hop1 = createChildContext(root, { metadata: { hop: 1 } });
      const hop2 = createChildContext(hop1, { metadata: { hop: 2 } });
      const hop3 = createChildContext(hop2, { metadata: { hop: 3 } });
      const hop4 = createChildContext(hop3, { metadata: { hop: 4 } });
      const hop5 = createChildContext(hop4, { metadata: { hop: 5 } });

      expect(hop1.correlationId).toBe('saga-boundary-777');
      expect(hop2.correlationId).toBe('saga-boundary-777');
      expect(hop3.correlationId).toBe('saga-boundary-777');
      expect(hop4.correlationId).toBe('saga-boundary-777');
      expect(hop5.correlationId).toBe('saga-boundary-777');

      // Trace IDs across all hops are all distinct
      const traceIds = new Set([
        root.traceId,
        hop1.traceId,
        hop2.traceId,
        hop3.traceId,
        hop4.traceId,
        hop5.traceId,
      ]);
      expect(traceIds.size).toBe(6);
      expect(hop5.metadata.hop).toBe(5);
    });
  });

  describe('ExecutionContextSchema validation', () => {
    it('validates a correct ExecutionContext object', () => {
      const valid = {
        correlationId: 'c-1',
        traceId: 't-1',
        initiatorUserId: 'u-1',
        timestamp: new Date().toISOString(),
        metadata: { test: true },
      };

      const result = ExecutionContextSchema.safeParse(valid);
      expect(result.success).toBe(true);
    });

    it('rejects an ExecutionContext with empty correlationId or traceId', () => {
      const invalidCorr = {
        correlationId: '',
        traceId: 't-1',
        initiatorUserId: 'u-1',
        timestamp: new Date().toISOString(),
      };
      const parseCorr = ExecutionContextSchema.safeParse(invalidCorr);
      expect(parseCorr.success).toBe(false);

      const invalidTrace = {
        correlationId: 'c-1',
        traceId: '',
        initiatorUserId: 'u-1',
        timestamp: new Date().toISOString(),
      };
      const parseTrace = ExecutionContextSchema.safeParse(invalidTrace);
      expect(parseTrace.success).toBe(false);
    });
  });
});
