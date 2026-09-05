import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { CircuitBreaker, CircuitState } from '../../../src/core/circuit-breaker';
import { AgentError } from '../../../src/core/result';

describe('CircuitBreaker Unit Tests', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('starts in CLOSED state with zero failure count', () => {
    const cb = new CircuitBreaker({ name: 'test-breaker' });
    expect(cb.getState()).toBe('CLOSED');
    expect(cb.getFailureCount()).toBe(0);
    expect(cb.getSuccessCount()).toBe(0);
    expect(cb.getLastFailureTime()).toBeNull();
    expect(cb.name).toBe('test-breaker');
  });

  it('executes successful actions normally in CLOSED state', async () => {
    const cb = new CircuitBreaker();
    const action = vi.fn().mockResolvedValue('success-payload');

    const result = await cb.execute(action);

    expect(result).toBe('success-payload');
    expect(action).toHaveBeenCalledTimes(1);
    expect(cb.getState()).toBe('CLOSED');
    expect(cb.getFailureCount()).toBe(0);
  });

  it('resets failure count if a failure is followed by a success in CLOSED state', async () => {
    const cb = new CircuitBreaker({ failureThreshold: 3 });

    // 2 consecutive failures
    await expect(cb.execute(async () => { throw new Error('fail 1'); })).rejects.toThrow('fail 1');
    expect(cb.getFailureCount()).toBe(1);

    await expect(cb.execute(async () => { throw new Error('fail 2'); })).rejects.toThrow('fail 2');
    expect(cb.getFailureCount()).toBe(2);
    expect(cb.getState()).toBe('CLOSED');

    // Followed by 1 success
    const result = await cb.execute(async () => 'recovered');
    expect(result).toBe('recovered');
    expect(cb.getFailureCount()).toBe(0);
    expect(cb.getState()).toBe('CLOSED');
  });

  it('trips to OPEN state after 3 consecutive failures', async () => {
    const transitions: Array<{ from: CircuitState; to: CircuitState }> = [];
    const cb = new CircuitBreaker({
      failureThreshold: 3,
      onStateChange: (from, to) => transitions.push({ from, to }),
    });

    await expect(cb.execute(async () => { throw new Error('fail 1'); })).rejects.toThrow('fail 1');
    await expect(cb.execute(async () => { throw new Error('fail 2'); })).rejects.toThrow('fail 2');
    expect(cb.getState()).toBe('CLOSED');

    // 3rd failure trips the breaker
    await expect(cb.execute(async () => { throw new Error('fail 3'); })).rejects.toThrow('fail 3');
    expect(cb.getState()).toBe('OPEN');
    expect(cb.getFailureCount()).toBe(3);
    expect(cb.getLastFailureTime()).not.toBeNull();
    expect(transitions).toEqual([{ from: 'CLOSED', to: 'OPEN' }]);
  });

  it('fast-fails immediately in OPEN state without calling action if no fallback', async () => {
    const cb = new CircuitBreaker({ failureThreshold: 1 });
    await expect(cb.execute(async () => { throw new Error('trip'); })).rejects.toThrow();
    expect(cb.getState()).toBe('OPEN');

    const action = vi.fn().mockResolvedValue('should-not-run');

    let errorCaught: AgentError | undefined;
    try {
      await cb.execute(action);
    } catch (err) {
      errorCaught = err as AgentError;
    }

    expect(action).not.toHaveBeenCalled();
    expect(errorCaught).toBeInstanceOf(AgentError);
    expect(errorCaught?.code).toBe('CIRCUIT_OPEN');
    expect(errorCaught?.retryable).toBe(true);
  });

  it('executes fallback in OPEN state instead of throwing', async () => {
    const cb = new CircuitBreaker({ failureThreshold: 1 });
    await expect(cb.execute(async () => { throw new Error('trip'); })).rejects.toThrow();
    expect(cb.getState()).toBe('OPEN');

    const action = vi.fn().mockResolvedValue('action-result');
    const fallback = vi.fn().mockResolvedValue('fallback-result');

    const result = await cb.execute(action, fallback);

    expect(action).not.toHaveBeenCalled();
    expect(fallback).toHaveBeenCalledTimes(1);
    expect(result).toBe('fallback-result');
  });

  it('executes fallback when action trips the circuit on threshold failure', async () => {
    const cb = new CircuitBreaker({ failureThreshold: 1 });
    const fallback = vi.fn().mockResolvedValue('tripped-fallback');

    const result = await cb.execute(async () => {
      throw new Error('trip now');
    }, fallback);

    expect(result).toBe('tripped-fallback');
    expect(cb.getState()).toBe('OPEN');
  });

  it('transitions from OPEN to HALF_OPEN after resetTimeoutMs elapses', async () => {
    const transitions: Array<{ from: CircuitState; to: CircuitState }> = [];
    const cb = new CircuitBreaker({
      failureThreshold: 1,
      resetTimeoutMs: 10000,
      onStateChange: (from, to) => transitions.push({ from, to }),
    });

    await expect(cb.execute(async () => { throw new Error('trip'); })).rejects.toThrow();
    expect(cb.getState()).toBe('OPEN');

    // Advance 5000ms (still within cooldown)
    vi.advanceTimersByTime(5000);
    expect(cb.getState()).toBe('OPEN');

    // Advance remaining 5001ms
    vi.advanceTimersByTime(5001);
    expect(cb.getState()).toBe('HALF_OPEN');
    expect(transitions).toEqual([
      { from: 'CLOSED', to: 'OPEN' },
      { from: 'OPEN', to: 'HALF_OPEN' },
    ]);
  });

  it('recovers to CLOSED when trial action in HALF_OPEN succeeds', async () => {
    const transitions: Array<{ from: CircuitState; to: CircuitState }> = [];
    const cb = new CircuitBreaker({
      failureThreshold: 1,
      resetTimeoutMs: 10000,
      halfOpenSuccessThreshold: 1,
      onStateChange: (from, to) => transitions.push({ from, to }),
    });

    await expect(cb.execute(async () => { throw new Error('trip'); })).rejects.toThrow();
    vi.advanceTimersByTime(10000);
    expect(cb.getState()).toBe('HALF_OPEN');

    // Trial execution succeeds
    const result = await cb.execute(async () => 'trial-success');

    expect(result).toBe('trial-success');
    expect(cb.getState()).toBe('CLOSED');
    expect(cb.getFailureCount()).toBe(0);
    expect(transitions).toContainEqual({ from: 'HALF_OPEN', to: 'CLOSED' });
  });

  it('re-trips to OPEN when trial action in HALF_OPEN fails (without fallback)', async () => {
    const cb = new CircuitBreaker({
      failureThreshold: 1,
      resetTimeoutMs: 10000,
    });

    await expect(cb.execute(async () => { throw new Error('trip'); })).rejects.toThrow();
    vi.advanceTimersByTime(10000);
    expect(cb.getState()).toBe('HALF_OPEN');

    // Trial execution fails
    await expect(cb.execute(async () => {
      throw new Error('trial-failed');
    })).rejects.toThrow('trial-failed');

    expect(cb.getState()).toBe('OPEN');
  });

  it('re-trips to OPEN and executes fallback when trial action in HALF_OPEN fails', async () => {
    const cb = new CircuitBreaker({
      failureThreshold: 1,
      resetTimeoutMs: 10000,
    });

    await expect(cb.execute(async () => { throw new Error('trip'); })).rejects.toThrow();
    vi.advanceTimersByTime(10000);
    expect(cb.getState()).toBe('HALF_OPEN');

    const fallback = vi.fn().mockResolvedValue('half-open-fallback');
    const result = await cb.execute(async () => {
      throw new Error('trial-failed');
    }, fallback);

    expect(result).toBe('half-open-fallback');
    expect(cb.getState()).toBe('OPEN');
  });

  it('resets circuit manually via reset()', async () => {
    const transitions: Array<{ from: CircuitState; to: CircuitState }> = [];
    const cb = new CircuitBreaker({
      failureThreshold: 1,
      onStateChange: (from, to) => transitions.push({ from, to }),
    });

    await expect(cb.execute(async () => { throw new Error('trip'); })).rejects.toThrow();
    expect(cb.getState()).toBe('OPEN');

    cb.reset();

    expect(cb.getState()).toBe('CLOSED');
    expect(cb.getFailureCount()).toBe(0);
    expect(cb.getLastFailureTime()).toBeNull();
    expect(transitions).toEqual([
      { from: 'CLOSED', to: 'OPEN' },
      { from: 'OPEN', to: 'CLOSED' },
    ]);
  });

  it('forces circuit to OPEN manually via trip()', () => {
    const transitions: Array<{ from: CircuitState; to: CircuitState }> = [];
    const cb = new CircuitBreaker({
      name: 'manual-trip-test',
      onStateChange: (from, to) => transitions.push({ from, to }),
    });

    expect(cb.getState()).toBe('CLOSED');
    cb.trip();

    expect(cb.getState()).toBe('OPEN');
    expect(cb.getLastFailureTime()).not.toBeNull();
    expect(transitions).toEqual([{ from: 'CLOSED', to: 'OPEN' }]);
  });
});
