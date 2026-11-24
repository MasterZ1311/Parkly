/**
 * Empirical Verification and Stress Harness
 * Executed by challenger_e2e_m1_1
 * 
 * Tests setup-offline.ts and e2e-harness.ts empirically.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import * as http from 'node:http';
import * as https from 'node:https';
import {
  E2ETestHarness,
  expectSuccess,
  expectFailure,
  EventBridgeEvent,
  CHENNAI_LOCATIONS,
  MOCK_DOCUMENTS,
  MOCK_PHOTOS,
  MOCK_TELEMETRY,
} from '../e2e/helpers/e2e-harness';
import { ok, err, AgentError } from '../../src/core/index';

describe('EMPIRICAL CHALLENGE 1: setup-offline.ts Network Interceptor Defect Analysis', () => {
  it('1.1 should demonstrate that importing setup-offline.ts throws TypeError: Cannot redefine property: request', async () => {
    let importError: any = null;
    try {
      await import('../e2e/helpers/setup-offline');
    } catch (e) {
      importError = e;
    }

    // setup-offline.ts executes installOfflineBarrier() at module evaluation time (line 110).
    // In Node.js ESM, `import * as http from 'node:http'` provides an immutable module namespace
    // whose properties (like request and get) cannot be reassigned via `(http as any).request = ...`.
    expect(importError).not.toBeNull();
    expect(importError).toBeInstanceOf(TypeError);
    expect(importError.message).toContain('Cannot redefine property: request');
  });

  it('1.2 inspects the property descriptor of http.request and https.request in ESM namespace', () => {
    const descHttp = Object.getOwnPropertyDescriptor(http, 'request');
    const descHttps = Object.getOwnPropertyDescriptor(https, 'request');

    // In ESM module namespace, properties are non-configurable:
    expect(descHttp).toBeDefined();
    expect(descHttp?.configurable).toBe(false);

    expect(descHttps).toBeDefined();
    expect(descHttps?.configurable).toBe(false);

    // Attempting Object.defineProperty or assignment throws TypeError: Cannot redefine property
    expect(() => {
      Object.defineProperty(http, 'request', {
        value: () => { throw new Error('Blocked'); },
      });
    }).toThrow(TypeError);
  });

  it('1.3 demonstrates that default import or CJS require of node:http CAN be mutated', async () => {
    // Test if default import or createRequire allows interception
    const defaultHttp = (await import('node:http')).default;
    expect(defaultHttp).toBeDefined();

    const origRequest = defaultHttp.request;
    expect(typeof origRequest).toBe('function');

    // Check if defaultHttp.request is mutable:
    let canMutateDefault = false;
    try {
      const mockReq = () => { throw new Error('Blocked via defaultHttp'); };
      defaultHttp.request = mockReq as any;
      canMutateDefault = defaultHttp.request === mockReq;
    } finally {
      defaultHttp.request = origRequest;
    }
    expect(canMutateDefault).toBe(true);
  });

  it('1.4 verifies globalThis.fetch interception logic in isolation', async () => {
    // Test the fetch interception logic implemented in setup-offline.ts lines 45-57
    const originalFetch = globalThis.fetch;
    class MockOfflineViolationError extends Error {
      constructor(public target: string) {
        super(`[OFFLINE VIOLATION] Test attempted real outbound network request to: ${target}`);
        this.name = 'OfflineViolationError';
      }
    }

    try {
      globalThis.fetch = (input: string | URL | { url: string }, _init?: unknown): Promise<Response> => {
        const url =
          typeof input === 'string'
            ? input
            : input instanceof URL
              ? input.toString()
              : input && typeof input === 'object' && 'url' in input
                ? String(input.url)
                : 'unknown-fetch';
        throw new MockOfflineViolationError(`fetch(${url})`);
      };

      // Test with string
      expect(() => globalThis.fetch('https://api.openai.com/v1/models')).toThrow(MockOfflineViolationError);
      try {
        await globalThis.fetch('https://api.openai.com/v1/models');
      } catch (e: any) {
        expect(e.target).toBe('fetch(https://api.openai.com/v1/models)');
      }

      // Test with URL object
      try {
        await globalThis.fetch(new URL('https://dynamodb.ap-south-1.amazonaws.com/'));
      } catch (e: any) {
        expect(e.target).toBe('fetch(https://dynamodb.ap-south-1.amazonaws.com/)');
      }

      // Test with request object
      try {
        await globalThis.fetch({ url: 'https://events.amazonaws.com' });
      } catch (e: any) {
        expect(e.target).toBe('fetch(https://events.amazonaws.com)');
      }
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});

describe('EMPIRICAL CHALLENGE 2: E2ETestHarness Core Functionality', () => {
  let harness: E2ETestHarness;

  beforeEach(() => {
    harness = new E2ETestHarness();
  });

  it('2.1 should create valid ExecutionContext with defaults and custom overrides', () => {
    const ctxDefault = harness.createContext();
    expect(ctxDefault.initiatorUserId).toBe('usr_driver_chennai_01');
    expect(ctxDefault.correlationId).toMatch(/^corr_/);
    expect(ctxDefault.traceId).toMatch(/^trace_/);
    expect(typeof ctxDefault.timestamp).toBe('string');

    const ctxCustom = harness.createContext('usr_host_999', 'corr_custom_123');
    expect(ctxCustom.initiatorUserId).toBe('usr_host_999');
    expect(ctxCustom.correlationId).toBe('corr_custom_123');

    const childCtx = ctxCustom.createChildContext();
    expect(childCtx.initiatorUserId).toBe('usr_host_999');
    expect(childCtx.correlationId).toBe('corr_custom_123');
    expect(childCtx.traceId).not.toBe(ctxCustom.traceId);
  });

  it('2.2 should publish and subscribe to specific events and wildcard *', async () => {
    const directEvents: any[] = [];
    const wildcardEvents: any[] = [];

    const unsubDirect = harness.eventBus.subscribe('Space.VisuallyAudited', (e) => {
      directEvents.push(e);
    });
    const unsubWildcard = harness.eventBus.subscribe('*', (e) => {
      wildcardEvents.push(e);
    });

    const sampleEvent: EventBridgeEvent = {
      id: 'evt_1',
      source: 'parkly.ai',
      'detail-type': 'Space.VisuallyAudited',
      time: new Date().toISOString(),
      detail: { spaceId: 'spc_001', approved: true },
      correlationId: 'corr_test_01',
    };

    await harness.eventBus.publish(sampleEvent);

    expect(directEvents).toHaveLength(1);
    expect(directEvents[0].id).toBe('evt_1');
    expect(wildcardEvents).toHaveLength(1);
    expect(wildcardEvents[0].id).toBe('evt_1');

    // Harness capturedEvents tracking
    expect(harness.capturedEvents).toHaveLength(1);
    expect(harness.getEmittedEvents('Space.VisuallyAudited')).toHaveLength(1);
    expect(harness.getEmittedEvents('Other.Event')).toHaveLength(0);

    // Test unsubscribe
    unsubDirect();
    await harness.eventBus.publish({
      ...sampleEvent,
      id: 'evt_2',
    });

    expect(directEvents).toHaveLength(1); // Direct should not receive evt_2
    expect(wildcardEvents).toHaveLength(2); // Wildcard still receives evt_2

    unsubWildcard();
  });

  it('2.3 should isolate subscriber exceptions and route them to DLQ', async () => {
    const dlqBefore = harness.getDLQ();
    expect(dlqBefore).toHaveLength(0);

    let healthySubscriberRan = false;

    // Failing subscriber 1: throws Error synchronously
    harness.eventBus.subscribe('Payment.Requested', () => {
      throw new Error('Sync database connection failed');
    });

    // Failing subscriber 2: rejects async Promise
    harness.eventBus.subscribe('Payment.Requested', async () => {
      throw new AgentError('DOWNSTREAM_FAILURE', 'Async ledger timeout');
    });

    // Failing subscriber 3: throws non-Error primitive
    harness.eventBus.subscribe('Payment.Requested', () => {
      throw 'Raw string error in subscriber';
    });

    // Healthy subscriber: must run despite peer failures (fault isolation)
    harness.eventBus.subscribe('Payment.Requested', () => {
      healthySubscriberRan = true;
    });

    const event: EventBridgeEvent = {
      id: 'evt_dlq_test',
      source: 'parkly.ai',
      'detail-type': 'Payment.Requested',
      time: new Date().toISOString(),
      detail: { amount: 500 },
    };

    await harness.eventBus.publish(event);

    // Assert healthy subscriber ran
    expect(healthySubscriberRan).toBe(true);

    // Assert DLQ captured all 3 errors
    const dlq = harness.getDLQ();
    expect(dlq).toHaveLength(3);

    expect(dlq[0].event.id).toBe('evt_dlq_test');
    expect(dlq[0].error.message).toContain('Sync database connection failed');
    expect(dlq[0].reason).toBe('Subscriber handler threw an exception');

    expect(dlq[1].event.id).toBe('evt_dlq_test');
    expect(dlq[1].error).toBeInstanceOf(AgentError);
    expect((dlq[1].error as AgentError).code).toBe('DOWNSTREAM_FAILURE');

    expect(dlq[2].event.id).toBe('evt_dlq_test');
    expect(dlq[2].error.message).toContain('Raw string error in subscriber');

    // Test clear DLQ
    harness.eventBus.clearDeadLetterQueue();
    expect(harness.getDLQ()).toHaveLength(0);
  });

  it('2.4 should verify expectSuccess type guard', () => {
    // 1. Success path: should not throw
    const okResult = ok({ bookingId: 'bk_123', status: 'CONFIRMED' });
    expect(() => {
      expectSuccess(okResult);
    }).not.toThrow();

    // TypeScript narrowing verification
    expectSuccess(okResult);
    expect(okResult.data.bookingId).toBe('bk_123');

    // 2. Failure path: must throw assertion error when given an err Result
    const errResult = err(AgentError.validation('Invalid phone number'));
    expect(() => {
      expectSuccess(errResult);
    }).toThrow();

    // Verify what it throws inside Vitest (globalExpect assertion error)
    try {
      expectSuccess(errResult);
    } catch (e: any) {
      expect(e.message).toMatch(/expected false to be true|Expected Result\.ok/);
    }
  });

  it('2.5 should verify expectFailure type guard and error code assertions', () => {
    // 1. Expected failure without specific code
    const errResult = err(AgentError.timeout('Execution timed out', { budgetMs: 5000 }));
    expect(() => {
      expectFailure(errResult);
    }).not.toThrow();

    // 2. Expected failure with matching code
    expect(() => {
      expectFailure(errResult, 'TIMEOUT_ERROR');
    }).not.toThrow();

    // 3. Failure with wrong code: must throw
    expect(() => {
      expectFailure(errResult, 'VALIDATION_ERROR');
    }).toThrow();

    try {
      expectFailure(errResult, 'VALIDATION_ERROR');
    } catch (e: any) {
      expect(e.message).toMatch(/expected 'TIMEOUT_ERROR' to be 'VALIDATION_ERROR'|Expected error code 'VALIDATION_ERROR'/);
    }

    // 4. Given an ok Result: must throw
    const okResult = ok({ message: 'All good' });
    expect(() => {
      expectFailure(okResult);
    }).toThrow();
  });

  it('2.6 should verify waitForEvent async resolution and timeout', async () => {
    // Immediate or delayed event resolution
    setTimeout(() => {
      harness.eventBus.publish({
        id: 'evt_async_01',
        source: 'parkly.ai',
        'detail-type': 'Host.KYCVerified',
        time: new Date().toISOString(),
        detail: { hostId: 'host_01' },
      });
    }, 50);

    const received = await harness.waitForEvent('Host.KYCVerified', 1000);
    expect(received.id).toBe('evt_async_01');
    expect(received['detail-type']).toBe('Host.KYCVerified');

    // Timeout expectation
    await expect(harness.waitForEvent('NonExistent.Event', 100)).rejects.toThrow(
      /Timeout waiting for event 'NonExistent.Event' after 100ms/
    );
  });

  it('2.7 should verify harness mock resetting and saga state store persistence', async () => {
    // 1. Modify mocks
    harness.mocks.ocr.setSimulatedConfidence(0.42);
    harness.mocks.geocoding.setConsecutiveErrors(2);
    harness.mocks.vision.setGateClearance(1.8);

    // 2. Saga state save & retrieval
    await harness.sagaStore.saveState({
      sagaId: 'saga_001',
      name: 'HostOnboardingSaga',
      status: 'PENDING',
      currentStep: 'OCR_PARSE',
      data: { hostId: 'host_123' },
      history: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    const state = await harness.sagaStore.getState('saga_001');
    expect(state).not.toBeNull();
    expect(state?.status).toBe('PENDING');

    // 3. Reset harness
    harness.reset();

    expect(harness.capturedEvents).toHaveLength(0);
    expect(await harness.sagaStore.getState('saga_001')).toBeNull();

    // Verify OCR mock returned to default
    const ocrRes = await harness.mocks.ocr.parseDocument('https://s3.ap-south-1.amazonaws.com/parkly/doc_pan_valid_01.jpg');
    expectSuccess(ocrRes);
    expect(ocrRes.data.confidenceScore).toBe(MOCK_DOCUMENTS.validPan.confidenceScore);
  });

  it('2.8 should verify all 7 agents and 3 sagas are correctly initialized and executable in harness', async () => {
    expect(harness.agents.hostOnboarding).toBeDefined();
    expect(harness.agents.visualInspection).toBeDefined();
    expect(harness.agents.occupancyPredictor).toBeDefined();
    expect(harness.agents.dynamicPricing).toBeDefined();
    expect(harness.agents.driverConcierge).toBeDefined();
    expect(harness.agents.disputeMediation).toBeDefined();
    expect(harness.agents.cityAnalytics).toBeDefined();
    expect(harness.agents.orchestrator).toBeDefined();

    expect(harness.sagas.hostOnboarding).toBeDefined();
    expect(harness.sagas.bookingHold).toBeDefined();
    expect(harness.sagas.disputeResolution).toBeDefined();

    // Execute HostOnboardingAgent
    const ctx = harness.createContext();
    const hostRes = await harness.agents.hostOnboarding.execute({
      userId: 'usr_suresh_01',
      rawAddress: CHENNAI_LOCATIONS.tNagarBurkit.rawAddress,
      documentUrls: [MOCK_DOCUMENTS.validPan.url],
      declaredSlots: 2,
      vehicleTypes: ['CAR', 'SUV'],
    }, ctx);

    expectSuccess(hostRes);
    expect(hostRes.data.kycStatus).toBe('VERIFIED_AUTO');
    expect(hostRes.data.geocoding.geohash).toBe('tf341tw');

    // Execute DynamicPricingAgent with bounds verification
    const priceRes = await harness.agents.dynamicPricing.execute({
      spaceId: 'spc_001',
      baseHourlyRate: 40,
      currentOccupancyRate: 0.95,
      hostPricingPreferences: { allowDynamic: true, maxMultiplier: 1.5 },
    }, ctx);

    expectSuccess(priceRes);
    expect(priceRes.data.calculatedHourlyRate).toBeLessThanOrEqual(60); // 40 * 1.5
    expect(priceRes.data.calculatedHourlyRate).toBeGreaterThanOrEqual(40);
  });
});
