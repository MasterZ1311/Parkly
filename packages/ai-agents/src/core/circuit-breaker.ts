/**
 * Distributed Circuit Breaker Implementation
 * Prevents cascading failures for external tool calls (vision, geocoding, OCR, routing).
 */

import { AgentError } from './result';

export type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

export interface CircuitBreakerOptions {
  readonly failureThreshold?: number; // default: 3
  readonly resetTimeoutMs?: number; // default: 10000ms
  readonly halfOpenSuccessThreshold?: number; // default: 1
  readonly name?: string;
  readonly onStateChange?: (from: CircuitState, to: CircuitState) => void;
}

export class CircuitBreaker {
  readonly name: string;
  readonly failureThreshold: number;
  readonly resetTimeoutMs: number;
  readonly halfOpenSuccessThreshold: number;
  private readonly onStateChange?: (from: CircuitState, to: CircuitState) => void;

  private state: CircuitState = 'CLOSED';
  private failureCount = 0;
  private successCount = 0;
  private lastFailureTime: number | null = null;

  constructor(options?: CircuitBreakerOptions) {
    this.name = options?.name ?? 'CircuitBreaker';
    this.failureThreshold = options?.failureThreshold ?? 3;
    const rawReset = options?.resetTimeoutMs ?? 10000;
    this.resetTimeoutMs = rawReset <= 0 ? 1000 : rawReset;
    this.halfOpenSuccessThreshold = options?.halfOpenSuccessThreshold ?? 1;
    this.onStateChange = options?.onStateChange;
  }

  getState(): CircuitState {
    if (this.state === 'OPEN' && this.lastFailureTime !== null) {
      const elapsed = Date.now() - this.lastFailureTime;
      if (elapsed >= this.resetTimeoutMs) {
        this.transitionTo('HALF_OPEN');
      }
    }
    return this.state;
  }

  getFailureCount(): number {
    return this.failureCount;
  }

  getSuccessCount(): number {
    return this.successCount;
  }

  getLastFailureTime(): number | null {
    return this.lastFailureTime;
  }

  reset(): void {
    this.failureCount = 0;
    this.successCount = 0;
    this.lastFailureTime = null;
    this.transitionTo('CLOSED');
  }

  trip(): void {
    this.lastFailureTime = Date.now();
    this.failureCount = this.failureThreshold;
    this.successCount = 0;
    this.transitionTo('OPEN');
  }

  async execute<T>(action: () => Promise<T>, fallback?: () => Promise<T>): Promise<T> {
    const currentState = this.getState();

    if (currentState === 'OPEN') {
      if (fallback) {
        return await fallback();
      }
      throw new AgentError(
        'CIRCUIT_OPEN',
        `CircuitBreaker [${this.name}] is OPEN (failures: ${this.failureCount})`,
        {
          circuitName: this.name,
          state: 'OPEN',
          lastFailureTime: this.lastFailureTime,
          resetTimeoutMs: this.resetTimeoutMs,
        },
        undefined,
        this.name,
        true
      );
    }

    if (currentState === 'HALF_OPEN') {
      try {
        const result = await action();
        this.successCount++;
        if (this.successCount >= this.halfOpenSuccessThreshold) {
          this.reset();
        }
        return result;
      } catch (error) {
        this.trip();
        if (fallback) {
          return await fallback();
        }
        throw error;
      }
    }

    // currentState === 'CLOSED'
    try {
      const result = await action();
      this.failureCount = 0;
      return result;
    } catch (error) {
      this.failureCount++;
      if (this.failureCount >= this.failureThreshold) {
        this.trip();
      }
      if (this.state === 'OPEN' && fallback) {
        return await fallback();
      }
      throw error;
    }
  }

  private transitionTo(nextState: CircuitState): void {
    const prevState = this.state;
    if (prevState !== nextState) {
      this.state = nextState;
      if (nextState === 'HALF_OPEN') {
        this.successCount = 0;
      }
      this.onStateChange?.(prevState, nextState);
    }
  }
}
