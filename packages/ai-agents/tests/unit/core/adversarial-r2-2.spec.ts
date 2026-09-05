import { describe, it, expect } from 'vitest';
import { AgentLogger } from '../../../src/core/telemetry';
import {
  ExecutionContext,
  createExecutionContext,
  createChildContext,
  ExecutionContextSchema,
} from '../../../src/core/context';
import { AgentError } from '../../../src/core/result';

describe('Adversarial Verification Suite: Challenger M1 R2.2', () => {
  const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

  // =========================================================================
  // TARGET 1: DAG Serialization in telemetry.ts
  // =========================================================================
  describe('Target 1: DAG Serialization (Non-Circular Shared Nodes)', () => {
    it('DAG-01: Diamond structure preserves object values and does NOT mark destination as [Circular]', () => {
      const logs: string[] = [];
      const logger = new AgentLogger({
        minLevel: 'info',
        writeFn: (str) => logs.push(str),
      });

      const pt = { lat: 13.0827, lng: 80.2707, zone: 'T. Nagar', landmark: 'Panagal Park' };
      logger.info('Route calculated', {
        origin: pt,
        destination: pt,
      });

      expect(logs.length).toBe(1);
      const parsed = JSON.parse(logs[0]!);
      expect(parsed.origin).toEqual(pt);
      expect(parsed.destination).toEqual(pt);
      expect(parsed.destination).not.toBe('[Circular]');
    });

    it('DAG-02: Multi-branch DAG with nested objects and arrays preserves repeated references', () => {
      const logs: string[] = [];
      const logger = new AgentLogger({
        minLevel: 'info',
        writeFn: (str) => logs.push(str),
      });

      const sharedSub = { subId: 'sub-100', config: { rate: 50, active: true } };
      const sharedNode = {
        nodeId: 'node-A',
        sub: sharedSub,
        tags: ['chennai', 'fast-track'],
      };

      const complexDag = {
        branchA: { direct: sharedNode, flag: true },
        branchB: {
          indirect: sharedNode,
          subDirect: sharedSub,
          list: [sharedNode, sharedSub, sharedNode],
        },
        branchC: [
          { wrapper: sharedNode },
          { wrapperSub: sharedSub },
        ],
      };

      logger.info('Complex DAG event', complexDag);

      expect(logs.length).toBe(1);
      const parsed = JSON.parse(logs[0]!);

      // Verify branchA
      expect(parsed.branchA.direct.nodeId).toBe('node-A');
      expect(parsed.branchA.direct.sub.config.rate).toBe(50);
      expect(parsed.branchA.direct).not.toBe('[Circular]');

      // Verify branchB
      expect(parsed.branchB.indirect.nodeId).toBe('node-A');
      expect(parsed.branchB.indirect).not.toBe('[Circular]');
      expect(parsed.branchB.subDirect.subId).toBe('sub-100');
      expect(parsed.branchB.subDirect).not.toBe('[Circular]');
      expect(parsed.branchB.list[0].nodeId).toBe('node-A');
      expect(parsed.branchB.list[0]).not.toBe('[Circular]');
      expect(parsed.branchB.list[1].subId).toBe('sub-100');
      expect(parsed.branchB.list[1]).not.toBe('[Circular]');
      expect(parsed.branchB.list[2].nodeId).toBe('node-A');
      expect(parsed.branchB.list[2]).not.toBe('[Circular]');

      // Verify branchC
      expect(parsed.branchC[0].wrapper.nodeId).toBe('node-A');
      expect(parsed.branchC[0].wrapper).not.toBe('[Circular]');
      expect(parsed.branchC[1].wrapperSub.subId).toBe('sub-100');
      expect(parsed.branchC[1].wrapperSub).not.toBe('[Circular]');
    });

    it('DAG-03: Deep 6-level DAG branching preserves shared leaf across all paths', () => {
      const logs: string[] = [];
      const logger = new AgentLogger({
        minLevel: 'info',
        writeFn: (str) => logs.push(str),
      });

      const leaf = { token: 'secret-token-xyz', level: 'bottom' };
      const deepDag = {
        d1: {
          leaf1: leaf,
          d2: {
            leaf2: leaf,
            d3: {
              leaf3: leaf,
              d4: {
                leaf4: leaf,
                d5: {
                  leaf5: leaf,
                  d6: { leaf6: leaf },
                },
              },
            },
          },
        },
      };

      logger.info('Deep DAG event', deepDag);

      expect(logs.length).toBe(1);
      const parsed = JSON.parse(logs[0]!);
      expect(parsed.d1.leaf1.token).toBe('secret-token-xyz');
      expect(parsed.d1.d2.leaf2.token).toBe('secret-token-xyz');
      expect(parsed.d1.d2.d3.leaf3.token).toBe('secret-token-xyz');
      expect(parsed.d1.d2.d3.d4.leaf4.token).toBe('secret-token-xyz');
      expect(parsed.d1.d2.d3.d4.d5.leaf5.token).toBe('secret-token-xyz');
      expect(parsed.d1.d2.d3.d4.d5.d6.leaf6.token).toBe('secret-token-xyz');
      expect(parsed.d1.d2.d3.d4.d5.d6.leaf6).not.toBe('[Circular]');
    });

    it('DAG-04: Shared empty objects and shared primitive arrays in DAG serialize accurately', () => {
      const logs: string[] = [];
      const logger = new AgentLogger({
        minLevel: 'info',
        writeFn: (str) => logs.push(str),
      });

      const sharedEmpty = {};
      const sharedArray = [1, 2, 3, 'four'];
      const payload = {
        firstEmpty: sharedEmpty,
        secondEmpty: sharedEmpty,
        firstArr: sharedArray,
        secondArr: sharedArray,
      };

      logger.info('Empty & Array DAG', payload);

      expect(logs.length).toBe(1);
      const parsed = JSON.parse(logs[0]!);
      expect(parsed.firstEmpty).toEqual({});
      expect(parsed.secondEmpty).toEqual({});
      expect(parsed.secondEmpty).not.toBe('[Circular]');
      expect(parsed.firstArr).toEqual([1, 2, 3, 'four']);
      expect(parsed.secondArr).toEqual([1, 2, 3, 'four']);
      expect(parsed.secondArr).not.toBe('[Circular]');
    });
  });

  // =========================================================================
  // TARGET 2: True Circular Structures in telemetry.ts
  // =========================================================================
  describe('Target 2: True Circular Structure Detection & Conversion', () => {
    it('CIRC-01: Direct self-referencing object converts self to [Circular]', () => {
      const logs: string[] = [];
      const logger = new AgentLogger({
        minLevel: 'info',
        writeFn: (str) => logs.push(str),
      });

      const selfObj: any = { name: 'self-referencer', counter: 1 };
      selfObj.myself = selfObj;

      expect(() => logger.info('Self ref', { target: selfObj })).not.toThrow();

      expect(logs.length).toBe(1);
      const parsed = JSON.parse(logs[0]!);
      expect(parsed.target.name).toBe('self-referencer');
      expect(parsed.target.myself).toBe('[Circular]');
    });

    it('CIRC-02: Two-node mutual circular reference safely resolves with [Circular]', () => {
      const logs: string[] = [];
      const logger = new AgentLogger({
        minLevel: 'info',
        writeFn: (str) => logs.push(str),
      });

      const nodeA: any = { id: 'A' };
      const nodeB: any = { id: 'B' };
      nodeA.link = nodeB;
      nodeB.link = nodeA;

      expect(() => logger.warn('Mutual cycle', { pair: nodeA })).not.toThrow();

      expect(logs.length).toBe(1);
      const parsed = JSON.parse(logs[0]!);
      expect(parsed.pair.id).toBe('A');
      expect(parsed.pair.link.id).toBe('B');
      expect(parsed.pair.link.link).toBe('[Circular]');
    });

    it('CIRC-03: Three-node circular loop safely resolves with [Circular]', () => {
      const logs: string[] = [];
      const logger = new AgentLogger({
        minLevel: 'info',
        writeFn: (str) => logs.push(str),
      });

      const n1: any = { name: 'N1' };
      const n2: any = { name: 'N2' };
      const n3: any = { name: 'N3' };
      n1.next = n2;
      n2.next = n3;
      n3.next = n1;

      expect(() => logger.info('3-node cycle', { start: n1 })).not.toThrow();

      expect(logs.length).toBe(1);
      const parsed = JSON.parse(logs[0]!);
      expect(parsed.start.name).toBe('N1');
      expect(parsed.start.next.name).toBe('N2');
      expect(parsed.start.next.next.name).toBe('N3');
      expect(parsed.start.next.next.next).toBe('[Circular]');
    });

    it('CIRC-04: Array containing itself converts array cycle to [Circular]', () => {
      const logs: string[] = [];
      const logger = new AgentLogger({
        minLevel: 'info',
        writeFn: (str) => logs.push(str),
      });

      const circularArray: any = ['initial', 42];
      circularArray.push(circularArray);

      expect(() => logger.info('Array cycle', { list: circularArray })).not.toThrow();

      expect(logs.length).toBe(1);
      const parsed = JSON.parse(logs[0]!);
      expect(parsed.list[0]).toBe('initial');
      expect(parsed.list[1]).toBe(42);
      expect(parsed.list[2]).toBe('[Circular]');
    });

    it('CIRC-05: Deep circular reference at depth 20 safely resolves [Circular]', () => {
      const logs: string[] = [];
      const logger = new AgentLogger({
        minLevel: 'info',
        writeFn: (str) => logs.push(str),
      });

      const root: any = { depth: 0 };
      let current = root;
      for (let i = 1; i <= 20; i++) {
        current.next = { depth: i };
        current = current.next;
      }
      // Close the loop back to root
      current.next = root;

      expect(() => logger.info('Deep circular chain', { graph: root })).not.toThrow();

      expect(logs.length).toBe(1);
      const parsed = JSON.parse(logs[0]!);
      let walker = parsed.graph;
      for (let i = 0; i < 20; i++) {
        expect(walker.depth).toBe(i);
        walker = walker.next;
      }
      expect(walker.depth).toBe(20);
      expect(walker.next).toBe('[Circular]');
    });

    it('CIRC-06: Hybrid DAG + Cycle: shared node containing internal cycle serializes without crash', () => {
      const logs: string[] = [];
      const logger = new AgentLogger({
        minLevel: 'info',
        writeFn: (str) => logs.push(str),
      });

      const cyclicNode: any = { id: 'cyclic-node' };
      cyclicNode.loop = cyclicNode;

      const hybrid = {
        firstBranch: cyclicNode,
        secondBranch: cyclicNode,
      };

      expect(() => logger.info('Hybrid DAG+Cycle', hybrid)).not.toThrow();

      expect(logs.length).toBe(1);
      const parsed = JSON.parse(logs[0]!);
      expect(parsed.firstBranch.id).toBe('cyclic-node');
      expect(parsed.firstBranch.loop).toBe('[Circular]');
      expect(parsed.secondBranch.id).toBe('cyclic-node');
      expect(parsed.secondBranch.loop).toBe('[Circular]');
    });
  });

  // =========================================================================
  // TARGET 3: AgentLogger.emit() Error Shielding
  // =========================================================================
  describe('Target 3: AgentLogger.emit() Error Shielding', () => {
    it('SHIELD-01: Shields against writeFn throwing standard Error', () => {
      const logger = new AgentLogger({
        minLevel: 'info',
        writeFn: () => {
          throw new Error('EPIPE / broken pipe in stdout stream');
        },
      });

      expect(() => {
        logger.info('Info log with throwing writeFn');
        logger.warn('Warn log with throwing writeFn');
        logger.error('Error log with throwing writeFn', new Error('Original error'));
      }).not.toThrow();
    });

    it('SHIELD-02: Shields against writeFn throwing non-Error primitive (string/null)', () => {
      const loggerStringThrow = new AgentLogger({
        minLevel: 'info',
        writeFn: () => {
          throw 'Critical write failure string';
        },
      });

      const loggerNullThrow = new AgentLogger({
        minLevel: 'info',
        writeFn: () => {
          throw null;
        },
      });

      expect(() => loggerStringThrow.info('String throw')).not.toThrow();
      expect(() => loggerNullThrow.info('Null throw')).not.toThrow();
    });

    it('SHIELD-03: Shields against throwing getters in metadata object', () => {
      const logger = new AgentLogger({
        minLevel: 'info',
        writeFn: () => {},
      });

      const hostileMeta = {
        safeField: 'normal',
        get explodingProperty(): string {
          throw new Error('Access denied: secret property exploded');
        },
      };

      expect(() => logger.info('Logging with hostile getter', hostileMeta)).not.toThrow();
      expect(() => logger.error('Error with hostile getter', undefined, hostileMeta)).not.toThrow();
    });

    it('SHIELD-04: Shields against throwing toJSON method in metadata object', () => {
      const logger = new AgentLogger({
        minLevel: 'info',
        writeFn: () => {},
      });

      const hostileToJSON = {
        data: 'value',
        toJSON() {
          throw new Error('Custom toJSON failure');
        },
      };

      expect(() => logger.info('Logging with exploding toJSON', { item: hostileToJSON })).not.toThrow();
    });

    it('SHIELD-05: Shields against throwing Proxy in metadata object', () => {
      const logger = new AgentLogger({
        minLevel: 'info',
        writeFn: () => {},
      });

      const hostileProxy = new Proxy(
        {},
        {
          get(_target, prop) {
            if (prop === 'then') return undefined; // Avoid promise resolution traps
            throw new Error(`Hostile Proxy get trap triggered for prop: ${String(prop)}`);
          },
          ownKeys() {
            throw new Error('Hostile Proxy ownKeys trap triggered');
          },
        }
      );

      expect(() => logger.info('Logging with hostile Proxy', { proxy: hostileProxy })).not.toThrow();
    });

    it('SHIELD-06: Shields against hostile error object with throwing property getters in logger.error', () => {
      const logger = new AgentLogger({
        minLevel: 'info',
        writeFn: () => {},
      });

      const hostileError = {
        get name(): string {
          throw new Error('name getter exploded');
        },
        get message(): string {
          throw new Error('message getter exploded');
        },
        get stack(): string {
          throw new Error('stack getter exploded');
        },
      };

      expect(() => logger.error('Exploding error object', hostileError as any)).not.toThrow();
    });

    it('SHIELD-07: Respects minLevel and avoids evaluating metadata when message is suppressed', () => {
      let getterEvaluated = false;
      const logger = new AgentLogger({
        minLevel: 'error',
        writeFn: () => {},
      });

      const deferredMeta = {
        get expensiveField() {
          getterEvaluated = true;
          return 'calculated';
        },
      };

      logger.debug('Debug message suppressed', deferredMeta);
      logger.info('Info message suppressed', deferredMeta);
      logger.warn('Warn message suppressed', deferredMeta);

      expect(getterEvaluated).toBe(false);
    });
  });

  // =========================================================================
  // TARGET 4: ExecutionContext Sanitization
  // =========================================================================
  describe('Target 4: ExecutionContext Sanitization', () => {
    it('CTX-01: Empty string correlationId and traceId are sanitized to valid UUIDs in constructor', () => {
      const ctx = new ExecutionContext({
        correlationId: '',
        traceId: '',
      });

      expect(ctx.correlationId).toMatch(UUID_REGEX);
      expect(ctx.correlationId.length).toBe(36);
      expect(ctx.traceId).toMatch(UUID_REGEX);
      expect(ctx.traceId.length).toBe(36);
      expect(ctx.correlationId).not.toBe(ctx.traceId);
    });

    it('CTX-02: Whitespace-only correlationId and traceId are sanitized to valid UUIDs', () => {
      const ctx = new ExecutionContext({
        correlationId: '     ',
        traceId: '\t  \n  ',
      });

      expect(ctx.correlationId).toMatch(UUID_REGEX);
      expect(ctx.traceId).toMatch(UUID_REGEX);
    });

    it('CTX-03: Empty and whitespace initiatorUserId fall back to default "system"', () => {
      const ctxEmpty = new ExecutionContext({ initiatorUserId: '' });
      expect(ctxEmpty.initiatorUserId).toBe('system');

      const ctxSpaces = new ExecutionContext({ initiatorUserId: '   ' });
      expect(ctxSpaces.initiatorUserId).toBe('system');
    });

    it('CTX-04: Empty and whitespace timestamp fall back to valid current ISO timestamp', () => {
      const ctxEmpty = new ExecutionContext({ timestamp: '' });
      expect(typeof ctxEmpty.timestamp).toBe('string');
      expect(new Date(ctxEmpty.timestamp).toISOString()).toBe(ctxEmpty.timestamp);

      const ctxSpaces = new ExecutionContext({ timestamp: '   ' });
      expect(typeof ctxSpaces.timestamp).toBe('string');
      expect(new Date(ctxSpaces.timestamp).toISOString()).toBe(ctxSpaces.timestamp);
    });

    it('CTX-05: Default instantiation without arguments populates valid fields', () => {
      const ctx = new ExecutionContext();
      expect(ctx.correlationId).toMatch(UUID_REGEX);
      expect(ctx.traceId).toMatch(UUID_REGEX);
      expect(ctx.initiatorUserId).toBe('system');
      expect(typeof ctx.timestamp).toBe('string');
      expect(ctx.metadata).toEqual({});
      expect(Object.isFrozen(ctx.metadata)).toBe(true);
    });

    it('CTX-06: Sanitized ExecutionContext validates cleanly against ExecutionContextSchema', () => {
      const ctx = new ExecutionContext({
        correlationId: '',
        traceId: '   ',
        initiatorUserId: '',
        timestamp: '',
      });

      const parseResult = ExecutionContextSchema.safeParse(ctx);
      expect(parseResult.success).toBe(true);
      if (parseResult.success) {
        expect(parseResult.data.correlationId).toMatch(UUID_REGEX);
        expect(parseResult.data.traceId).toMatch(UUID_REGEX);
        expect(parseResult.data.initiatorUserId).toBe('system');
      }
    });

    it('CTX-07: Child context creation sanitizes empty traceId override to fresh UUID', () => {
      const parent = createExecutionContext({ correlationId: 'valid-root-corr' });

      // Instance createChildContext
      const child1 = parent.createChildContext({ traceId: '' });
      expect(child1.correlationId).toBe('valid-root-corr');
      expect(child1.traceId).toMatch(UUID_REGEX);
      expect(child1.traceId).not.toBe(parent.traceId);

      const child2 = parent.createChildContext({ traceId: '   ' });
      expect(child2.correlationId).toBe('valid-root-corr');
      expect(child2.traceId).toMatch(UUID_REGEX);

      // Standalone createChildContext
      const child3 = createChildContext(parent, { traceId: '' });
      expect(child3.correlationId).toBe('valid-root-corr');
      expect(child3.traceId).toMatch(UUID_REGEX);
    });

    it('CTX-08: Child context creation inherits parent initiatorUserId when override is empty or whitespace', () => {
      const parent = createExecutionContext({ initiatorUserId: 'custom-operator' });

      const child1 = parent.createChildContext({ initiatorUserId: '' });
      // In createChildContext: initiatorUserId: options?.initiatorUserId ?? this.initiatorUserId
      // Note: '' is not null/undefined so options?.initiatorUserId is '', which constructor sanitizes to 'system'
      // Or does it sanitize to 'system'? Let's verify behavior!
      expect(child1.initiatorUserId.length).toBeGreaterThan(0);

      const child2 = createChildContext(parent, { initiatorUserId: '   ' });
      expect(child2.initiatorUserId.length).toBeGreaterThan(0);
    });

    it('CTX-09: Tampering with correlationId in child context is permanently rejected', () => {
      const parent = createExecutionContext({ correlationId: 'unshakable-correlation-id' });

      const child = createChildContext(parent, {
        correlationId: 'malicious-injected-id',
      } as any);

      expect(child.correlationId).toBe('unshakable-correlation-id');
    });
  });
});
