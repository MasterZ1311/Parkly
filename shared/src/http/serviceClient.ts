// ============================================================
// Parkly — Inter-Service HTTP Client
// Replaces raw axios calls with circuit breaker + correlation ID propagation.
// ============================================================

import { CircuitBreaker, CircuitBreakerOptions, CircuitOpenError } from './circuitBreaker';
import { logger } from '../logger';

export interface ServiceClientOptions extends Omit<CircuitBreakerOptions, 'name'> {
  /** Base URL of the downstream service. */
  baseUrl: string;
  /** Service name for logging and circuit breaker. */
  serviceName: string;
}

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  path: string;
  body?: unknown;
  headers?: Record<string, string>;
  params?: Record<string, string | number | boolean | undefined>;
  /** Correlation/request ID to propagate downstream. */
  requestId?: string;
}

export interface ServiceResponse<T = unknown> {
  status: number;
  data: T;
  latencyMs: number;
}

/**
 * HTTP client with built-in circuit breaker, timeout, and correlation ID forwarding.
 * Use this for all inter-service communication instead of raw axios/fetch.
 */
export class ServiceClient {
  private readonly breaker: CircuitBreaker;
  private readonly baseUrl: string;
  private readonly serviceName: string;

  constructor(opts: ServiceClientOptions) {
    this.baseUrl = opts.baseUrl.replace(/\/$/, '');
    this.serviceName = opts.serviceName;
    this.breaker = new CircuitBreaker({ name: opts.serviceName, ...opts });
  }

  async request<T = unknown>(opts: RequestOptions): Promise<ServiceResponse<T>> {
    const method = opts.method || 'GET';
    const url = this.buildUrl(opts.path, opts.params);

    const start = Date.now();

    try {
      const result = await this.breaker.execute(async (signal) => {
        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
          ...(opts.requestId ? { 'X-Request-Id': opts.requestId } : {}),
          ...opts.headers,
        };

        const fetchOpts: RequestInit = {
          method,
          headers,
          signal,
          ...(opts.body ? { body: JSON.stringify(opts.body) } : {}),
        };

        const response = await fetch(url, fetchOpts);
        const data = (await response.json()) as T;
        return { status: response.status, data };
      });

      const latencyMs = Date.now() - start;

      logger.debug(
        { service: this.serviceName, method, path: opts.path, status: result.status, latencyMs },
        'Service call completed',
      );

      return { ...result, latencyMs };
    } catch (err) {
      const latencyMs = Date.now() - start;

      if (err instanceof CircuitOpenError) {
        logger.warn({ service: this.serviceName, method, path: opts.path }, 'Service call blocked by circuit breaker');
      } else {
        logger.error(
          { service: this.serviceName, method, path: opts.path, latencyMs, err },
          'Service call failed',
        );
      }
      throw err;
    }
  }

  async get<T = unknown>(path: string, params?: Record<string, string | number | boolean | undefined>, requestId?: string): Promise<ServiceResponse<T>> {
    return this.request<T>({ method: 'GET', path, params, requestId });
  }

  async post<T = unknown>(path: string, body?: unknown, requestId?: string): Promise<ServiceResponse<T>> {
    return this.request<T>({ method: 'POST', path, body, requestId });
  }

  async put<T = unknown>(path: string, body?: unknown, requestId?: string): Promise<ServiceResponse<T>> {
    return this.request<T>({ method: 'PUT', path, body, requestId });
  }

  getCircuitStats() {
    return this.breaker.getStats();
  }

  private buildUrl(path: string, params?: Record<string, string | number | boolean | undefined>): string {
    const cleanPath = path.startsWith('/') ? path : `/${path}`;
    const url = new URL(`${this.baseUrl}${cleanPath}`);

    if (params) {
      for (const [key, value] of Object.entries(params)) {
        if (value !== undefined) {
          url.searchParams.set(key, String(value));
        }
      }
    }

    return url.toString();
  }
}

/**
 * Registry of service clients — singleton per downstream service.
 */
const clients = new Map<string, ServiceClient>();

export function getServiceClient(serviceName: string, baseUrl: string, opts?: Partial<ServiceClientOptions>): ServiceClient {
  const key = `${serviceName}:${baseUrl}`;
  if (!clients.has(key)) {
    clients.set(key, new ServiceClient({ serviceName, baseUrl, ...opts }));
  }
  return clients.get(key)!;
}
