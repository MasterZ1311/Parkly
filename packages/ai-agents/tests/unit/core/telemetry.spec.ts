import { describe, it, expect } from 'vitest';
import { AgentLogger } from '../../../src/core/telemetry';
import { AgentError } from '../../../src/core/result';

describe('Telemetry & AgentLogger Unit Tests', () => {
  it('emits valid single-line JSON log strings with required fields', () => {
    const emittedLines: string[] = [];
    const logger = new AgentLogger({
      writeFn: (line) => emittedLines.push(line),
      minLevel: 'debug',
    });

    logger.info('Host onboarding initiated', { hostId: 'H-101' });

    expect(emittedLines.length).toBe(1);
    const parsed = JSON.parse(emittedLines[0]!);
    expect(parsed.level).toBe('info');
    expect(parsed.msg).toBe('Host onboarding initiated');
    expect(parsed.hostId).toBe('H-101');
    expect(typeof parsed.time).toBe('string');
  });

  it('filters logs according to minLevel configuration', () => {
    const emittedLines: string[] = [];
    const logger = new AgentLogger({
      minLevel: 'warn',
      writeFn: (line) => emittedLines.push(line),
    });

    logger.debug('debug should be suppressed');
    logger.info('info should be suppressed');
    logger.warn('warn should be emitted');
    logger.error('error should be emitted');

    expect(emittedLines.length).toBe(2);
    const parsedWarn = JSON.parse(emittedLines[0]!);
    const parsedError = JSON.parse(emittedLines[1]!);
    expect(parsedWarn.level).toBe('warn');
    expect(parsedError.level).toBe('error');
  });

  it('creates contextual child loggers that automatically inject bindings', () => {
    const emittedLines: string[] = [];
    const rootLogger = new AgentLogger({
      bindings: { environment: 'production' },
      writeFn: (line) => emittedLines.push(line),
    });

    const childLogger = rootLogger.child({
      correlationId: 'corr-xyz-123',
      traceId: 'trace-abc-456',
      agentName: 'DynamicPricingAgent',
    });

    childLogger.info('Recalculated surge multiplier', { multiplier: 1.5 });

    expect(emittedLines.length).toBe(1);
    const parsed = JSON.parse(emittedLines[0]!);
    expect(parsed.environment).toBe('production');
    expect(parsed.correlationId).toBe('corr-xyz-123');
    expect(parsed.traceId).toBe('trace-abc-456');
    expect(parsed.agentName).toBe('DynamicPricingAgent');
    expect(parsed.multiplier).toBe(1.5);
  });

  it('formats Error instances including name, message, stack, code, and details', () => {
    const emittedLines: string[] = [];
    const logger = new AgentLogger({
      writeFn: (line) => emittedLines.push(line),
    });

    const agentError = new AgentError(
      'VALIDATION_ERROR',
      'Plate number format invalid',
      { plate: 'TN-01-??' },
      undefined,
      'VisualInspectionAgent'
    );

    logger.error('Verification failed', agentError);

    expect(emittedLines.length).toBe(1);
    const parsed = JSON.parse(emittedLines[0]!);
    expect(parsed.level).toBe('error');
    expect(parsed.msg).toBe('Verification failed');
    expect(parsed.err).toBeDefined();
    expect(parsed.err.name).toBe('AgentError');
    expect(parsed.err.message).toBe('Plate number format invalid');
    expect(parsed.err.code).toBe('VALIDATION_ERROR');
    expect(parsed.err.details).toEqual({ plate: 'TN-01-??' });
    expect(typeof parsed.err.stack).toBe('string');
  });

  it('handles non-Error objects safely in logger.error', () => {
    const emittedLines: string[] = [];
    const logger = new AgentLogger({
      writeFn: (line) => emittedLines.push(line),
    });

    logger.error('Something went wrong', 'Plain string reason');

    expect(emittedLines.length).toBe(1);
    const parsed = JSON.parse(emittedLines[0]!);
    expect(parsed.err).toEqual({ message: 'Plain string reason' });
  });

  it('handles circular references and BigInt safely without throwing', () => {
    const emittedLines: string[] = [];
    const logger = new AgentLogger({
      writeFn: (line) => emittedLines.push(line),
    });

    const circularObj: any = { name: 'circular-test' };
    circularObj.self = circularObj;

    expect(() => {
      logger.info('Logging circular object', {
        circular: circularObj,
        bigNumber: BigInt(9007199254740991),
      });
    }).not.toThrow();

    expect(emittedLines.length).toBe(1);
    const parsed = JSON.parse(emittedLines[0]!);
    expect(parsed.circular.self).toBe('[Circular]');
    expect(parsed.bigNumber).toBe('9007199254740991');
  });

  it('correctly serializes Directed Acyclic Graphs (DAGs) without converting shared nodes to [Circular]', () => {
    const emittedLines: string[] = [];
    const logger = new AgentLogger({
      writeFn: (line) => emittedLines.push(line),
      minLevel: 'info',
    });

    const sharedCoord = { lat: 13.0827, lng: 80.2707, zone: 'T. Nagar' };
    const routePayload = {
      origin: sharedCoord,
      destination: sharedCoord,
      waypoints: [sharedCoord],
    };

    logger.info('Route calculated', routePayload);

    expect(emittedLines.length).toBe(1);
    const parsed = JSON.parse(emittedLines[0]!);
    expect(parsed.origin).toEqual(sharedCoord);
    expect(parsed.destination).toEqual(sharedCoord);
    expect(parsed.destination).not.toBe('[Circular]');
    expect(parsed.waypoints[0]).toEqual(sharedCoord);
  });

  it('shields against throwing writeFn without crashing caller', () => {
    const failingLogger = new AgentLogger({
      minLevel: 'info',
      writeFn: () => {
        throw new Error('EPIPE: Broken pipe in stdout');
      },
    });

    expect(() => {
      failingLogger.info('This write will fail');
      failingLogger.error('This error log will also fail');
    }).not.toThrow();
  });

  it('shields against throwing getters in log metadata', () => {
    const logger = new AgentLogger({
      writeFn: () => {},
      minLevel: 'info',
    });

    const explodingMeta = {
      safeField: 'ok',
      get exploding(): string {
        throw new Error('Exploding getter in meta');
      },
    };

    expect(() => {
      logger.info('Testing hostile meta', explodingMeta);
    }).not.toThrow();
  });

  describe('TelemetrySpan measurements', () => {
    it('measures execution duration and logs span completion', async () => {
      const emittedLines: string[] = [];
      const logger = new AgentLogger({
        minLevel: 'debug',
        writeFn: (line) => emittedLines.push(line),
      });

      const span = logger.startSpan('occupancy-prediction-query');
      span.setAttribute('spaceId', 'SP-99');

      // Small async delay
      await new Promise((resolve) => setTimeout(resolve, 20));

      const duration = span.end();

      expect(duration).toBeGreaterThanOrEqual(15);
      expect(emittedLines.length).toBe(1);
      const parsed = JSON.parse(emittedLines[0]!);
      expect(parsed.msg).toBe('Span ended: occupancy-prediction-query');
      expect(parsed.spanName).toBe('occupancy-prediction-query');
      expect(parsed.spaceId).toBe('SP-99');
      expect(parsed.durationMs).toBe(duration);
    });

    it('records error in span and logs error message', () => {
      const emittedLines: string[] = [];
      const logger = new AgentLogger({
        writeFn: (line) => emittedLines.push(line),
      });

      const span = logger.startSpan('failing-subroutine', { attempt: 1 });
      span.recordError(new Error('Subroutine fault'));

      expect(emittedLines.length).toBe(1);
      const parsed = JSON.parse(emittedLines[0]!);
      expect(parsed.level).toBe('error');
      expect(parsed.msg).toBe('Span failed: failing-subroutine');
      expect(parsed.attempt).toBe(1);
      expect(parsed.err.message).toBe('Subroutine fault');
      expect(typeof parsed.durationMs).toBe('number');
    });
  });

  describe('in-memory log capture for testing', () => {
    it('retains memory logs when retainMemoryLogs is true', () => {
      const logger = new AgentLogger({
        retainMemoryLogs: true,
        writeFn: () => {}, // silent in console
      });

      logger.info('First message', { id: 1 });
      logger.warn('Second message', { id: 2 });

      const logs = logger.getMemoryLogs();
      expect(logs.length).toBe(2);
      expect(logs[0]!.msg).toBe('First message');
      expect(logs[1]!.msg).toBe('Second message');

      logger.clearMemoryLogs();
      expect(logger.getMemoryLogs().length).toBe(0);
    });
  });
});
