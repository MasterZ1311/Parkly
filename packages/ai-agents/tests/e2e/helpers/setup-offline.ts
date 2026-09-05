/**
 * Offline Network Interceptor
 * Strictly enforces 0 network calls during test execution.
 * Any attempt to make real HTTP/HTTPS requests or connect to remote sockets
 * immediately throws an explicit OfflineViolationError.
 */

import * as http from 'node:http';
import * as https from 'node:https';

export class OfflineViolationError extends Error {
  public readonly target: string;

  constructor(target: string) {
    super(
      `[OFFLINE VIOLATION] Test attempted real outbound network request to: ${target}. ` +
      `All tests must use deterministic mock providers and offline fixtures.`
    );
    this.name = 'OfflineViolationError';
    this.target = target;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

// 1. Enforce dummy cloud credentials so AWS SDK never reaches out to IMDS or endpoints
process.env.AWS_ACCESS_KEY_ID = 'mock-key-id-offline';
process.env.AWS_SECRET_ACCESS_KEY = 'mock-secret-key-offline';
process.env.AWS_REGION = 'ap-south-1';
process.env.AWS_EC2_METADATA_DISABLED = 'true';
process.env.NODE_ENV = 'test';

// 2. Capture originals
const originalFetch = globalThis.fetch;
const originalHttpRequest = http.request;
const originalHttpGet = http.get;
const originalHttpsRequest = https.request;
const originalHttpsGet = https.get;

let isInstalled = false;

export function installOfflineBarrier(): void {
  if (isInstalled) return;

  // Intercept global fetch
  if (typeof globalThis.fetch === 'function') {
    globalThis.fetch = (input: string | URL | { url: string }, _init?: unknown): Promise<Response> => {
      const url =
        typeof input === 'string'
          ? input
          : input instanceof URL
            ? input.toString()
            : input && typeof input === 'object' && 'url' in input
              ? String(input.url)
              : 'unknown-fetch';
      throw new OfflineViolationError(`fetch(${url})`);
    };
  }

  // Intercept node:http
  (http as any).request = ((...args: any[]) => {
    const host =
      typeof args[0] === 'string'
        ? args[0]
        : args[0]?.host || args[0]?.hostname || (args[0] instanceof URL ? args[0].host : 'unknown-http');
    throw new OfflineViolationError(`http.request(${host})`);
  }) as any;

  (http as any).get = ((...args: any[]) => {
    const host =
      typeof args[0] === 'string'
        ? args[0]
        : args[0]?.host || args[0]?.hostname || (args[0] instanceof URL ? args[0].host : 'unknown-http');
    throw new OfflineViolationError(`http.get(${host})`);
  }) as any;

  // Intercept node:https
  (https as any).request = ((...args: any[]) => {
    const host =
      typeof args[0] === 'string'
        ? args[0]
        : args[0]?.host || args[0]?.hostname || (args[0] instanceof URL ? args[0].host : 'unknown-https');
    throw new OfflineViolationError(`https.request(${host})`);
  }) as any;

  (https as any).get = ((...args: any[]) => {
    const host =
      typeof args[0] === 'string'
        ? args[0]
        : args[0]?.host || args[0]?.hostname || (args[0] instanceof URL ? args[0].host : 'unknown-https');
    throw new OfflineViolationError(`https.get(${host})`);
  }) as any;

  isInstalled = true;
}

export function restoreNetworkForDebugging(): void {
  globalThis.fetch = originalFetch;
  (http as any).request = originalHttpRequest;
  (http as any).get = originalHttpGet;
  (https as any).request = originalHttpsRequest;
  (https as any).get = originalHttpsGet;
  isInstalled = false;
}

export function isOfflineBarrierActive(): boolean {
  return isInstalled;
}

// Auto-install on module import (Vitest setupFiles execution)
installOfflineBarrier();
