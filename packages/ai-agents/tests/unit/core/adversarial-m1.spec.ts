import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import {
  ExecutionContext,
  createExecutionContext,
  createChildContext,
} from '../../../src/core/context';
import { AgentLogger } from '../../../src/core/telemetry';
import { BaseAgent, AgentOptions } from '../../../src/core/agent.interface';
import { Result, ok, AgentError } from '../../../src/core/result';

describe('Adversarial Verification Suite: Milestone 1', () => {
  const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

  // =========================================================================
  // TARGET 1: ExecutionContext Propagation & Invariants
  // =========================================================================
  describe('Target 1: ExecutionContext Deep Propagation & Invariants', () => {
    it('ADV-CTX-01: Preserves correlationId across 15 levels of nested child contexts while ensuring 100% distinct traceIds', () => {
      const rootCorr = 'root-corr-alpha-999';
      const root = createExecutionContext({
        correlationId: rootCorr,
        initiatorUserId: 'user-initiator-0',
        metadata: { depth: 0, rootFlag: true },
      });

      const chain: ExecutionContext[] = [root];
      const DEPTH = 15;

      for (let i = 1; i <= DEPTH; i++) {
        const parent = chain[i - 1]!;
        const child = parent.createChildContext({
          metadata: { [`level_${i}`]: i, currentDepth: i },
        });
        chain.push(child);
      }

      expect(chain.length).toBe(DEPTH + 1);

      // Verify correlationId invariant across all 16 contexts
      for (let i = 0; i < chain.length; i++) {
        expect(chain[i]!.correlationId).toBe(rootCorr);
        expect(chain[i]!.initiatorUserId).toBe('user-initiator-0');
      }

      // Verify all traceIds are valid UUIDs and mutually unique
      const traceIds = chain.map((ctx) => ctx.traceId);
      const uniqueTraceIds = new Set(traceIds);
      expect(uniqueTraceIds.size).toBe(DEPTH + 1);

      for (const tid of traceIds) {
        expect(tid).toMatch(UUID_REGEX);
      }

      // Verify metadata inheritance at depth 15
      const leaf = chain[DEPTH]!;
      expect(leaf.metadata.rootFlag).toBe(true);
      expect(leaf.metadata.depth).toBe(0);
      expect(leaf.metadata.currentDepth).toBe(15);
      for (let i = 1; i <= DEPTH; i++) {
        expect(leaf.metadata[`level_${i}`]).toBe(i);
      }
    });

    it('ADV-CTX-02: Guarantees immutability of parent metadata upon child overrides and external mutation attempts', () => {
      const parent = createExecutionContext({
        metadata: {
          config: 'immutable-parent',
          tags: ['chennai', 'omr'],
          counter: 10,
        },
      });

      // Child overrides 'config' and 'counter'
      const child = parent.createChildContext({
        metadata: {
          config: 'child-override',
          counter: 999,
          childSpecific: true,
        },
      });

      // Parent metadata must be frozen and untouched
      expect(Object.isFrozen(parent.metadata)).toBe(true);
      expect(parent.metadata.config).toBe('immutable-parent');
      expect(parent.metadata.counter).toBe(10);
      expect((parent.metadata as any).childSpecific).toBeUndefined();

      // Child metadata is frozen and has overridden values
      expect(Object.isFrozen(child.metadata)).toBe(true);
      expect(child.metadata.config).toBe('child-override');
      expect(child.metadata.counter).toBe(999);
      expect(child.metadata.childSpecific).toBe(true);

      // Direct mutation on parent metadata must fail
      expect(() => {
        (parent.metadata as any).config = 'mutated';
      }).toThrow();

      // Direct mutation on child metadata must fail
      expect(() => {
        (child.metadata as any).newField = 'polluted';
      }).toThrow();
    });

    it('ADV-CTX-03: Defends correlationId invariant against malicious override attempts in createChildContext', () => {
      const root = createExecutionContext({ correlationId: 'genuine-root-corr' });

      // Attempt to tamper with correlationId via instance method
      const tamperedChild1 = root.createChildContext({
        metadata: { injected: true },
        // Pass forbidden correlationId in raw object
        ...({ correlationId: 'evil-spoofed-corr' } as any),
      });

      expect(tamperedChild1.correlationId).toBe('genuine-root-corr');

      // Attempt to tamper with correlationId via standalone createChildContext
      const tamperedChild2 = createChildContext(root, {
        correlationId: 'evil-spoofed-corr-2',
      });

      expect(tamperedChild2.correlationId).toBe('genuine-root-corr');

      // Attempt with plain ExecutionContextData object
      const plainParent = {
        correlationId: 'plain-parent-corr',
        traceId: 'plain-trace-id',
        initiatorUserId: 'plain-user',
        timestamp: new Date().toISOString(),
        metadata: { plain: true },
      };

      const tamperedChild3 = createChildContext(plainParent, {
        correlationId: 'evil-spoofed-corr-3',
      });

      expect(tamperedChild3.correlationId).toBe('plain-parent-corr');
    });

    it('ADV-CTX-04: High-concurrency fan-out (50 parallel child contexts) maintains correlationId and distinct traceIds', () => {
      const root = createExecutionContext({ correlationId: 'fanout-corr-77' });
      const CHILD_COUNT = 50;

      const children = Array.from({ length: CHILD_COUNT }, (_, index) =>
        root.createChildContext({ metadata: { spanIndex: index } })
      );

      const traceIdSet = new Set<string>();
      children.forEach((c, idx) => {
        expect(c.correlationId).toBe('fanout-corr-77');
        expect(c.metadata.spanIndex).toBe(idx);
        traceIdSet.add(c.traceId);
      });

      expect(traceIdSet.size).toBe(CHILD_COUNT);
    });
  });

  // =========================================================================
  // TARGET 2: Structured Telemetry & Logger Resilience
  // =========================================================================
  describe('Target 2: Structured Telemetry & Logger Resilience', () => {
    it('ADV-TEL-01: Safely stringifies self-referencing and mutually circular objects without throwing or stack overflow', () => {
      const logLines: string[] = [];
      const logger = new AgentLogger({
        minLevel: 'debug',
        writeFn: (line) => logLines.push(line),
      });

      // 1. Direct self-reference
      const selfRef: Record<string, unknown> = { name: 'self-node' };
      selfRef.loop = selfRef;

      // 2. Mutual circular reference
      const nodeA: Record<string, unknown> = { label: 'A' };
      const nodeB: Record<string, unknown> = { label: 'B' };
      nodeA.link = nodeB;
      nodeB.link = nodeA;

      // 3. Circular reference in AgentError details
      const circularError = new AgentError('DOWNSTREAM_FAILURE', 'Circular fault', {
        culprit: nodeA,
      });

      expect(() => {
        logger.info('Testing direct self-reference', { payload: selfRef });
        logger.warn('Testing mutual circular reference', { nodeA, nodeB });
        logger.error('Testing circular error object', circularError);
      }).not.toThrow();

      expect(logLines.length).toBe(3);

      // Verify circular tokens in JSON output
      const json1 = JSON.parse(logLines[0]!);
      expect(json1.payload.name).toBe('self-node');
      expect(json1.payload.loop).toBe('[Circular]');

      const json2 = JSON.parse(logLines[1]!);
      expect(json2.nodeA.label).toBe('A');
      expect(json2.nodeA.link.label).toBe('B');
      expect(json2.nodeA.link.link).toBe('[Circular]');

      const json3 = JSON.parse(logLines[2]!);
      expect(json3.err.name).toBe('AgentError');
      expect(json3.err.details.culprit.link.link).toBe('[Circular]');
    });

    it('ADV-TEL-02: Handles BigInt, Symbols, and function values in log payloads without serialization crash', () => {
      const logLines: string[] = [];
      const logger = new AgentLogger({
        minLevel: 'debug',
        writeFn: (line) => logLines.push(line),
      });

      const mixedPayload = {
        bigNumber: 9007199254740993123456789n,
        arrayBigInt: [100n, 200n, 300n],
        symbolValue: Symbol('test-symbol'),
        funcValue: () => 'do-not-execute',
        nanValue: NaN,
        infValue: Infinity,
        normalStr: 'valid-text',
      };

      expect(() => {
        logger.info('Mixed esoteric types', mixedPayload);
      }).not.toThrow();

      expect(logLines.length).toBe(1);
      const parsed = JSON.parse(logLines[0]!);
      expect(parsed.bigNumber).toBe('9007199254740993123456789');
      expect(parsed.arrayBigInt).toEqual(['100', '200', '300']);
      expect(parsed.normalStr).toBe('valid-text');
      // Functions and symbols are omitted by JSON.stringify
      expect(parsed.symbolValue).toBeUndefined();
      expect(parsed.funcValue).toBeUndefined();
      // NaN and Infinity become null in standard JSON
      expect(parsed.nanValue).toBeNull();
      expect(parsed.infValue).toBeNull();
    });

    it('ADV-TEL-03: High-volume throughput (2,000 log entries) and memory buffer clearing', () => {
      const logger = new AgentLogger({
        minLevel: 'info',
        retainMemoryLogs: true,
        writeFn: () => {}, // silence stdout
      });

      const TOTAL_LOGS = 2000;
      for (let i = 0; i < TOTAL_LOGS; i++) {
        logger.info(`Message ${i}`, { index: i, parity: i % 2 === 0 ? 'even' : 'odd' });
      }

      expect(logger.getMemoryLogs().length).toBe(TOTAL_LOGS);

      // Verify clearing empties the buffer
      logger.clearMemoryLogs();
      expect(logger.getMemoryLogs().length).toBe(0);

      // Verify logger continues working normally after clear
      logger.info('Post-clear message', { fresh: true });
      expect(logger.getMemoryLogs().length).toBe(1);
      expect(logger.getMemoryLogs()[0]!.msg).toBe('Post-clear message');
    });

    it('ADV-TEL-04: Multi-level child logger context inheritance and binding encapsulation', () => {
      const logLines: string[] = [];
      const rootLogger = new AgentLogger({
        minLevel: 'debug',
        bindings: { service: 'parkly-ai', environment: 'test' },
        writeFn: (line) => logLines.push(line),
      });

      // Child 1 adds correlation and trace IDs
      const child1 = rootLogger.child({
        correlationId: 'corr-xyz-100',
        traceId: 'trace-abc-200',
      });

      // Child 2 (grandchild) adds agentName
      const grandchild = child1.child({
        agentName: 'DynamicPricingAgent',
        zone: 'chennai-tnagar',
      });

      grandchild.info('Tariff calculated', { surgeMultiplier: 1.5 });

      expect(logLines.length).toBe(1);
      const parsed = JSON.parse(logLines[0]!);
      // Verify all bindings from root, child1, and grandchild are present
      expect(parsed.service).toBe('parkly-ai');
      expect(parsed.environment).toBe('test');
      expect(parsed.correlationId).toBe('corr-xyz-100');
      expect(parsed.traceId).toBe('trace-abc-200');
      expect(parsed.agentName).toBe('DynamicPricingAgent');
      expect(parsed.zone).toBe('chennai-tnagar');
      expect(parsed.surgeMultiplier).toBe(1.5);
      expect(parsed.level).toBe('info');

      // Verify root logger bindings were NOT modified by child loggers
      rootLogger.info('Root message');
      const rootParsed = JSON.parse(logLines[1]!);
      expect(rootParsed.service).toBe('parkly-ai');
      expect(rootParsed.correlationId).toBeUndefined();
      expect(rootParsed.agentName).toBeUndefined();
    });

    it('ADV-TEL-05: TelemetrySpan measures elapsed time and records errors', async () => {
      const logLines: string[] = [];
      const logger = new AgentLogger({
        minLevel: 'debug',
        writeFn: (line) => logLines.push(line),
      });

      const span = logger.startSpan('pricing.surgeCalculation', { spaceId: 'sp-101' });
      span.setAttribute('demandTier', 'HIGH');

      await new Promise((resolve) => setTimeout(resolve, 30));
      const duration = span.end();

      expect(duration).toBeGreaterThanOrEqual(20);
      expect(logLines.length).toBe(1);
      const log = JSON.parse(logLines[0]!);
      expect(log.spanName).toBe('pricing.surgeCalculation');
      expect(log.spaceId).toBe('sp-101');
      expect(log.demandTier).toBe('HIGH');
      expect(log.durationMs).toBe(duration);
    });

    it('ADV-TEL-06: Evaluates diamond dependency handling (shared non-circular references)', () => {
      const logLines: string[] = [];
      const logger = new AgentLogger({
        minLevel: 'info',
        writeFn: (str) => logLines.push(str),
      });

      const sharedLocation = { lat: 13.0827, lng: 80.2707, zone: 'T. Nagar' };
      logger.info('Route calculation', {
        origin: sharedLocation,
        destination: sharedLocation,
      });

      expect(logLines.length).toBe(1);
      const parsed = JSON.parse(logLines[0]!);
      expect(parsed.origin).toEqual({ lat: 13.0827, lng: 80.2707, zone: 'T. Nagar' });
      expect(parsed.destination).toEqual({ lat: 13.0827, lng: 80.2707, zone: 'T. Nagar' });
      expect(parsed.destination).not.toBe('[Circular]');
    });

    it('ADV-TEL-07: Uncaught exception if logger writeFn throws', () => {
      const failingLogger = new AgentLogger({
        minLevel: 'info',
        writeFn: () => {
          throw new Error('Disk full / write pipe broken');
        },
      });

      expect(() => {
        failingLogger.info('This will trigger write failure');
      }).not.toThrow();
    });
  });

  // =========================================================================
  // TARGET 3: BaseAgent Zod Validation & Adversarial Payloads
  // =========================================================================
  describe('Target 3: BaseAgent Zod Validation & Adversarial Payloads', () => {
    // Adversarial Test Agent
    interface AdvInput {
      targetId: string;
      budget: number;
      tags?: string[];
    }
    interface AdvOutput {
      confirmed: boolean;
      allocatedBudget: number;
    }

    class AdversarialProbeAgent extends BaseAgent<AdvInput, AdvOutput> {
      readonly inputSchema = z.object({
        targetId: z.string().min(3).max(20),
        budget: z.number().positive().max(100000),
        tags: z.array(z.string()).optional(),
      });

      readonly outputSchema = z.object({
        confirmed: z.boolean(),
        allocatedBudget: z.number().positive().max(100000),
      });

      public internalCallCount = 0;
      public outputPayloadOverride?: any;

      constructor(name = 'AdversarialProbeAgent', options?: AgentOptions) {
        super(name, options);
      }

      protected async executeInternal(
        input: AdvInput,
        _ctx: ExecutionContext
      ): Promise<Result<AdvOutput, AgentError>> {
        this.internalCallCount++;
        if (this.outputPayloadOverride !== undefined) {
          return ok(this.outputPayloadOverride);
        }
        return ok({
          confirmed: true,
          allocatedBudget: input.budget,
        });
      }
    }

    const testCtx = createExecutionContext({ correlationId: 'adv-test-corr' });

    it('ADV-ZOD-01: Rejects diverse malformed input types (null, undefined, arrays, scalars) without calling executeInternal', async () => {
      const agent = new AdversarialProbeAgent();

      const invalidInputs = [
        null,
        undefined,
        12345,
        'string-payload',
        true,
        [],
        [1, 2, 3],
        {}, // missing required targetId and budget
        { targetId: 'ab' }, // targetId too short (< 3)
        { targetId: 'valid-id', budget: -50 }, // negative budget
        { targetId: 'valid-id', budget: 0 }, // non-positive budget
        { targetId: 'valid-id', budget: 'NaN' }, // budget wrong type
        { targetId: 'valid-id', budget: 100, tags: 'not-an-array' },
      ];

      for (const input of invalidInputs) {
        const result = await agent.execute(input, testCtx);

        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error).toBeInstanceOf(AgentError);
          expect(result.error.code).toBe('VALIDATION_ERROR');
          expect(result.error.retryable).toBe(false);
          expect(result.error.message).toContain('Input schema validation failed');
        }
      }

      // executeInternal must never have been called for any of these inputs
      expect(agent.internalCallCount).toBe(0);
    });

    it('ADV-ZOD-02: Prototype pollution payloads are safely sanitized by Zod and cannot pollute global Object prototype', async () => {
      const agent = new AdversarialProbeAgent();

      // Clean check before test
      expect((Object.prototype as any).pollutedKey).toBeUndefined();
      expect(({} as any).pollutedKey).toBeUndefined();

      // Payload 1: __proto__ injection
      const pollutedInput1 = JSON.parse(
        '{"targetId":"valid-id-01","budget":500,"__proto__":{"pollutedKey":"malicious_value_1"}}'
      );

      const res1 = await agent.execute(pollutedInput1, testCtx);
      expect(res1.success).toBe(true);

      // Verify Object.prototype was NOT polluted
      expect((Object.prototype as any).pollutedKey).toBeUndefined();
      expect(({} as any).pollutedKey).toBeUndefined();

      // Payload 2: constructor.prototype injection
      const pollutedInput2 = JSON.parse(
        '{"targetId":"valid-id-02","budget":750,"constructor":{"prototype":{"pollutedKey":"malicious_value_2"}}}'
      );

      // Zod strips unknown fields by default
      const res2 = await agent.execute(pollutedInput2, testCtx);
      expect(res2.success).toBe(true);

      expect((Object.prototype as any).pollutedKey).toBeUndefined();
      expect(({} as any).pollutedKey).toBeUndefined();
    });

    it('ADV-ZOD-03: Catches and rejects invalid output responses from executeInternal via outputSchema validation', async () => {
      const agent = new AdversarialProbeAgent();

      const invalidOutputs = [
        { confirmed: 'not-a-boolean', allocatedBudget: 100 }, // type error
        { confirmed: true, allocatedBudget: -50 }, // negative budget
        { confirmed: true, allocatedBudget: 999999999 }, // exceeds max(100000)
        { confirmed: true }, // missing allocatedBudget
        null,
        'malformed-string',
      ];

      for (const badOutput of invalidOutputs) {
        agent.outputPayloadOverride = badOutput;
        const result = await agent.execute(
          { targetId: 'valid-target', budget: 100 },
          testCtx
        );

        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error).toBeInstanceOf(AgentError);
          expect(result.error.code).toBe('VALIDATION_ERROR');
          expect(result.error.message).toContain('Output schema validation failed');
          expect(result.error.retryable).toBe(false);
        }
      }
    });

    it('ADV-ZOD-04: Gracefully handles input objects with throwing getters without crashing execute()', async () => {
      const agent = new AdversarialProbeAgent();
      const explodingInput = {
        get targetId(): string {
          throw new Error('Exploding getter access');
        },
        budget: 500,
      };

      const result = await agent.execute(explodingInput, testCtx);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBeInstanceOf(AgentError);
        expect(result.error.code).toBe('VALIDATION_ERROR');
        expect(result.error.message).toContain('Input schema validation threw an unexpected exception');
        expect(result.error.retryable).toBe(false);
      }
    });

    it('ADV-ZOD-05: Gracefully handles throwing getters in agent output without crashing execute()', async () => {
      const agent = new AdversarialProbeAgent();
      agent.outputPayloadOverride = {
        get confirmed(): boolean {
          throw new Error('Output getter exploded');
        },
        allocatedBudget: 500,
      };

      const result = await agent.execute({ targetId: 'valid-id', budget: 500 }, testCtx);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBeInstanceOf(AgentError);
        expect(result.error.code).toBe('VALIDATION_ERROR');
        expect(result.error.message).toContain('Output schema validation threw an unexpected exception');
        expect(result.error.retryable).toBe(false);
      }
    });

    it('ADV-ZOD-06: Gracefully rejects null or undefined ctx without crashing execute()', async () => {
      const agent = new AdversarialProbeAgent();

      const result = await agent.execute({ targetId: 'valid-id', budget: 500 }, null as any);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBeInstanceOf(AgentError);
        expect(result.error.code).toBe('VALIDATION_ERROR');
        expect(result.error.message).toContain('Execution context cannot be null or undefined');
        expect(result.error.retryable).toBe(false);
      }
    });
  });
});
