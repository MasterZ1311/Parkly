// ============================================================
// Parkly — Circuit Breaker for Inter-Service HTTP Calls
// Prevents cascading failures across microservices.
// States: CLOSED → OPEN → HALF_OPEN → CLOSED
// ============================================================

import { logger } from '../logger';

export type CircuitState = 'closed' | 'open' | 'half_open';

export interface CircuitBreakerOptions {
  /** Name of the downstream service (for logging). */
  name: string;
  /** Number of failures before opening the circuit. Default: 5 */
  failureThreshold?: number;
  /** Time in ms to wait before trying again (half-open). Default: 30000 */
  resetTimeout?: number;
  /** Number of successful calls in half-open to close circuit. Default: 2 */
  successThreshold?: number;
  /** Timeout for individual requests in ms. Default: 5000 */
  requestTimeout?: number;
}

export class CircuitBreaker {
  private state: CircuitState = 'closed';
  private failureCount = 0;
  private successCount = 0;
  private lastFailureTime = 0;
  private readonly failureThreshold: number;
  private readonly resetTimeout: number;
  private readonly successThreshold: number;
  private readonly requestTimeout: number;
  private readonly name: string;

  constructor(opts: CircuitBreakerOptions) {
    this.name = opts.name;
    this.failureThreshold = opts.failureThreshold ?? 5;
    this.resetTimeout = opts.resetTimeout ?? 30000;
    this.successThreshold = opts.successThreshold ?? 2;
    this.requestTimeout = opts.requestTimeout ?? 5000;
  }

  get currentState(): CircuitState {
    if (this.state === 'open') {
      // Check if reset timeout has passed → transition to half_open
      if (Date.now() - this.lastFailureTime >= this.resetTimeout) {
        this.state = 'half_open';
        this.successCount = 0;
        logger.info({ service: this.name }, 'Circuit breaker → half_open');
      }
    }
    return this.state;
  }

  /**
   * Execute a function through the circuit breaker.
   * Throws if the circuit is open.
   */
  async execute<T>(fn: (signal: AbortSignal) => Promise<T>): Promise<T> {
    const state = this.currentState;

    if (state === 'open') {
      throw new CircuitOpenError(this.name, this.resetTimeout - (Date.now() - this.lastFailureTime));
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.requestTimeout);

    try {
      const result = await fn(controller.signal);
      this.onSuccess();
      return result;
    } catch (err) {
      this.onFailure();
      throw err;
    } finally {
      clearTimeout(timeout);
    }
  }

  private onSuccess(): void {
    if (this.state === 'half_open') {
      this.successCount++;
      if (this.successCount >= this.successThreshold) {
        this.state = 'closed';
        this.failureCount = 0;
        logger.info({ service: this.name }, 'Circuit breaker → closed (recovered)');
      }
    }
    this.failureCount = 0;
  }

  private onFailure(): void {
    this.failureCount++;
    this.lastFailureTime = Date.now();

    if (this.state === 'half_open') {
      this.state = 'open';
      logger.warn({ service: this.name }, 'Circuit breaker → open (half_open test failed)');
    } else if (this.failureCount >= this.failureThreshold) {
      this.state = 'open';
      logger.warn({ service: this.name, failures: this.failureCount }, 'Circuit breaker → open');
    }
  }

  /** Reset the circuit to closed (useful for testing). */
  reset(): void {
    this.state = 'closed';
    this.failureCount = 0;
    this.successCount = 0;
  }

  getStats() {
    return {
      name: this.name,
      state: this.currentState,
      failureCount: this.failureCount,
      successCount: this.successCount,
    };
  }
}

export class CircuitOpenError extends Error {
  readonly code = 'CIRCUIT_OPEN';

  constructor(
    public readonly serviceName: string,
    public readonly retryAfterMs: number,
  ) {
    super(`Circuit breaker open for ${serviceName}. Retry after ${Math.ceil(retryAfterMs / 1000)}s.`);
    this.name = 'CircuitOpenError';
  }
}
