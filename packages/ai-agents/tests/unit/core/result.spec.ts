import { describe, it, expect } from 'vitest';
import {
  Result,
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
  AgentError,
} from '../../../src/core/result';

describe('Result Monad & AgentError Unit Tests', () => {
  describe('ok() and isOk()', () => {
    it('creates a success Result with primitive data', () => {
      const res = ok(42);
      expect(res.success).toBe(true);
      if (isOk(res)) {
        expect(res.data).toBe(42);
      }
      expect(isErr(res)).toBe(false);
    });

    it('creates a success Result with complex object', () => {
      const payload = { spaceId: 'SP-101', rate: 50 };
      const res = ok(payload);
      expect(res.success).toBe(true);
      expect(res.data).toEqual(payload);
    });

    it('creates a success Result with null and undefined', () => {
      const resNull = ok(null);
      expect(resNull.success).toBe(true);
      expect(resNull.data).toBeNull();
      expect(isOk(resNull)).toBe(true);

      const resUndefined = ok(undefined);
      expect(resUndefined.success).toBe(true);
      expect(resUndefined.data).toBeUndefined();
      expect(isOk(resUndefined)).toBe(true);
    });
  });

  describe('err() and isErr()', () => {
    it('creates a failure Result with AgentError', () => {
      const agentError = AgentError.validation('Invalid parking spot');
      const res = err(agentError);
      expect(res.success).toBe(false);
      if (isErr(res)) {
        expect(res.error).toBe(agentError);
        expect(res.error.code).toBe('VALIDATION_ERROR');
      }
      expect(isOk(res)).toBe(false);
    });

    it('creates a failure Result with generic error', () => {
      const res = err('Custom string error');
      expect(res.success).toBe(false);
      expect(res.error).toBe('Custom string error');
    });
  });

  describe('map() and mapErr()', () => {
    it('transforms data when Result is success', () => {
      const res = ok(10);
      const mapped = map(res, (n) => n * 2);
      expect(mapped.success).toBe(true);
      if (mapped.success) {
        expect(mapped.data).toBe(20);
      }
    });

    it('bypasses mapping function when Result is error', () => {
      const originalError = AgentError.timeout('Timed out');
      const res = err(originalError);
      let called = false;
      const mapped = map(res, (n: number) => {
        called = true;
        return n * 2;
      });
      expect(called).toBe(false);
      expect(mapped.success).toBe(false);
      if (!mapped.success) {
        expect(mapped.error).toBe(originalError);
      }
    });

    it('transforms error when Result is failure', () => {
      const res = err(AgentError.internal('Bug'));
      const mapped = mapErr(res, (e) => new Error(`Wrapped: ${e.message}`));
      expect(mapped.success).toBe(false);
      if (!mapped.success) {
        expect(mapped.error.message).toBe('Wrapped: Bug');
      }
    });

    it('bypasses mapErr when Result is success', () => {
      const res = ok('Chennai');
      let called = false;
      const mapped = mapErr(res, (e: AgentError) => {
        called = true;
        return e.message;
      });
      expect(called).toBe(false);
      expect(mapped.success).toBe(true);
      if (mapped.success) {
        expect(mapped.data).toBe('Chennai');
      }
    });
  });

  describe('flatMap()', () => {
    it('chains multiple successful monadic operations', () => {
      const initial = ok(10);
      const chained = flatMap(initial, (n) => ok(`Val: ${n * 5}`));
      expect(chained.success).toBe(true);
      if (chained.success) {
        expect(chained.data).toBe('Val: 50');
      }
    });

    it('short-circuits when initial Result is failure', () => {
      const initial = err(AgentError.validation('Bad input'));
      let called = false;
      const chained = flatMap(initial, (n: number) => {
        called = true;
        return ok(n * 2);
      });
      expect(called).toBe(false);
      expect(chained.success).toBe(false);
      if (!chained.success) {
        expect(chained.error.code).toBe('VALIDATION_ERROR');
      }
    });

    it('returns downstream failure if chained function returns err', () => {
      const initial = ok(5);
      const chained = flatMap(initial, () => err(AgentError.invariant('Negative price')));
      expect(chained.success).toBe(false);
      if (!chained.success) {
        expect(chained.error.code).toBe('BUSINESS_INVARIANT_VIOLATION');
      }
    });
  });

  describe('unwrap() and unwrapOr()', () => {
    it('unwraps data on success', () => {
      const res = ok('Anna Nagar');
      expect(unwrap(res)).toBe('Anna Nagar');
    });

    it('throws contained error on unwrap when Result is error', () => {
      const agentErr = AgentError.circuitOpen('Vision circuit is open');
      const res = err(agentErr);
      expect(() => unwrap(res)).toThrow(agentErr);
    });

    it('unwraps data with unwrapOr on success', () => {
      const res = ok('T. Nagar');
      expect(unwrapOr(res, 'Fallback')).toBe('T. Nagar');
    });

    it('returns fallback with unwrapOr on failure', () => {
      const res = err(AgentError.timeout('Timeout'));
      expect(unwrapOr(res, 'Fallback')).toBe('Fallback');
    });
  });

  describe('fromPromise()', () => {
    it('resolves to ok(data) when promise succeeds', async () => {
      const promise = Promise.resolve({ bookingId: 'BK-123' });
      const res = await fromPromise(promise);
      expect(res.success).toBe(true);
      if (res.success) {
        expect(res.data.bookingId).toBe('BK-123');
      }
    });

    it('maps rejected Error to DOWNSTREAM_FAILURE by default', async () => {
      const promise = Promise.reject(new Error('Connection dropped'));
      const res = await fromPromise(promise);
      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.error).toBeInstanceOf(AgentError);
        expect(res.error.code).toBe('DOWNSTREAM_FAILURE');
        expect(res.error.message).toBe('Connection dropped');
      }
    });

    it('preserves rejected AgentError directly', async () => {
      const originalErr = AgentError.timeout('Gateway timeout');
      const promise = Promise.reject(originalErr);
      const res = await fromPromise(promise);
      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.error).toBe(originalErr);
      }
    });

    it('uses custom errorMapper when provided', async () => {
      const promise = Promise.reject('Non-error string rejection');
      const res = await fromPromise(promise, (raw) => AgentError.internal(`Custom: ${raw}`));
      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.error.code).toBe('INTERNAL_ERROR');
        expect(res.error.message).toBe('Custom: Non-error string rejection');
      }
    });
  });

  describe('tryCatch()', () => {
    it('returns ok(data) when function succeeds', () => {
      const res = tryCatch(() => JSON.parse('{"status":"OK"}'));
      expect(res.success).toBe(true);
      if (res.success) {
        expect(res.data).toEqual({ status: 'OK' });
      }
    });

    it('catches thrown error and returns INTERNAL_ERROR by default', () => {
      const res = tryCatch(() => JSON.parse('invalid json'));
      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.error).toBeInstanceOf(AgentError);
        expect(res.error.code).toBe('INTERNAL_ERROR');
      }
    });

    it('preserves thrown AgentError directly', () => {
      const agentError = AgentError.invariant('Cap exceeded');
      const res = tryCatch(() => {
        throw agentError;
      });
      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.error).toBe(agentError);
      }
    });

    it('uses custom errorMapper when provided', () => {
      const res = tryCatch(
        () => {
          throw new Error('Disk full');
        },
        (err) => AgentError.downstream('Mapped error', err)
      );
      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.error.code).toBe('DOWNSTREAM_FAILURE');
        expect(res.error.message).toBe('Mapped error');
      }
    });
  });

  describe('Result namespace convenience object', () => {
    it('exposes all methods via Result namespace', () => {
      expect(Result.ok(1)).toEqual({ success: true, data: 1 });
      expect(Result.err('err')).toEqual({ success: false, error: 'err' });
      expect(Result.isOk(Result.ok(1))).toBe(true);
      expect(Result.isErr(Result.err(1))).toBe(true);
      expect(Result.map(Result.ok(2), (x) => x * 2)).toEqual({ success: true, data: 4 });
      expect(Result.unwrap(Result.ok('test'))).toBe('test');
      expect(Result.unwrapOr(Result.err('bad'), 'good')).toBe('good');
    });
  });

  describe('AgentError hierarchy and serialization', () => {
    it('subclasses Error and maintains prototype chain', () => {
      const err = new AgentError('VALIDATION_ERROR', 'Field required');
      expect(err).toBeInstanceOf(Error);
      expect(err).toBeInstanceOf(AgentError);
      expect(err.name).toBe('AgentError');
      expect(err.code).toBe('VALIDATION_ERROR');
    });

    it('correctly sets retryable flags per error code', () => {
      expect(new AgentError('TIMEOUT_ERROR', 'msg').retryable).toBe(true);
      expect(new AgentError('CIRCUIT_OPEN', 'msg').retryable).toBe(true);
      expect(new AgentError('DOWNSTREAM_FAILURE', 'msg').retryable).toBe(true);

      expect(new AgentError('VALIDATION_ERROR', 'msg').retryable).toBe(false);
      expect(new AgentError('BUSINESS_INVARIANT_VIOLATION', 'msg').retryable).toBe(false);
      expect(new AgentError('INTERNAL_ERROR', 'msg').retryable).toBe(false);
    });

    it('supports options bag constructor parameter', () => {
      const cause = new Error('Socket reset');
      const err = new AgentError('DOWNSTREAM_FAILURE', 'Service unavailable', {
        details: { endpoint: '/api/v1/spaces' },
        cause,
        agentName: 'DriverConciergeAgent',
        retryable: true,
      });

      expect(err.code).toBe('DOWNSTREAM_FAILURE');
      expect(err.message).toBe('Service unavailable');
      expect(err.details).toEqual({ endpoint: '/api/v1/spaces' });
      expect(err.cause).toBe(cause);
      expect(err.agentName).toBe('DriverConciergeAgent');
      expect(err.retryable).toBe(true);
    });

    it('supports static factory methods', () => {
      const valErr = AgentError.validation('Invalid pin code', { pin: 'abc' }, 'HostAgent');
      expect(valErr.code).toBe('VALIDATION_ERROR');
      expect(valErr.retryable).toBe(false);
      expect(valErr.agentName).toBe('HostAgent');

      const timeErr = AgentError.timeout('Operation timed out', undefined, 'PricingAgent');
      expect(timeErr.code).toBe('TIMEOUT_ERROR');
      expect(timeErr.retryable).toBe(true);

      const circuitErr = AgentError.circuitOpen('Vision breaker open', undefined, 'VisionAgent');
      expect(circuitErr.code).toBe('CIRCUIT_OPEN');
      expect(circuitErr.retryable).toBe(true);

      const downErr = AgentError.downstream('DB failure', new Error('DB connection fail'));
      expect(downErr.code).toBe('DOWNSTREAM_FAILURE');
      expect(downErr.retryable).toBe(true);

      const invErr = AgentError.invariant('Price below base rate');
      expect(invErr.code).toBe('BUSINESS_INVARIANT_VIOLATION');
      expect(invErr.retryable).toBe(false);

      const intErr = AgentError.internal('Unexpected undefined');
      expect(intErr.code).toBe('INTERNAL_ERROR');
      expect(intErr.retryable).toBe(false);
    });

    it('serializes cleanly via toJSON()', () => {
      const cause = new Error('Root cause issue');
      const err = new AgentError('INTERNAL_ERROR', 'Fatal bug', { path: '/tmp' }, cause, 'TestAgent', false);
      const json = err.toJSON();

      expect(json.name).toBe('AgentError');
      expect(json.code).toBe('INTERNAL_ERROR');
      expect(json.message).toBe('Fatal bug');
      expect(json.agentName).toBe('TestAgent');
      expect(json.retryable).toBe(false);
      expect(json.details).toEqual({ path: '/tmp' });
      expect(json.cause).toEqual({
        name: 'Error',
        message: 'Root cause issue',
        stack: cause.stack,
      });
      expect(typeof json.stack).toBe('string');
    });

    it('serializes cleanly when cause is a primitive or string', () => {
      const err = new AgentError('INTERNAL_ERROR', 'Fatal bug', undefined, 'Raw string cause');
      const json = err.toJSON();
      expect(json.cause).toBe('Raw string cause');
    });
  });
});
