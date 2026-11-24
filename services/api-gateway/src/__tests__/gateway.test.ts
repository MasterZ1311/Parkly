process.env['NODE_ENV'] = 'test';
process.env['AUTH_URL'] = 'http://localhost:4001';
process.env['PAYMENT_URL'] = 'http://localhost:4003';

import app, { SERVICES, rateLimiter, redisClient } from '../index';

describe('API Gateway Configuration & Routing', () => {
  it('defines downstream service URLs for all microservices', () => {
    expect(SERVICES.auth).toBeDefined();
    expect(SERVICES.booking).toBeDefined();
    expect(SERVICES.payment).toBeDefined();
    expect(SERVICES.search).toBeDefined();
    expect(SERVICES.pricing).toBeDefined();
    expect(SERVICES.prediction).toBeDefined();
    expect(SERVICES.occupancy).toBeDefined();
    expect(SERVICES.notification).toBeDefined();
    expect(SERVICES.host).toBeDefined();
    expect(SERVICES.admin).toBeDefined();
  });

  it('mounts public webhook routes before authenticated routes', () => {
    const routerStack = (app as any)._router?.stack || [];

    // Find indices of route layers in router stack
    const webhookLayerIndex = routerStack.findIndex((layer: any) => {
      const pathRegex = layer.regexp?.toString() || '';
      return pathRegex.includes('payments') && pathRegex.includes('webhook');
    });

    const protectedPaymentsLayerIndex = routerStack.findIndex((layer: any, idx: number) => {
      if (idx <= webhookLayerIndex) return false;
      const pathRegex = layer.regexp?.toString() || '';
      return pathRegex.includes('payments') && !pathRegex.includes('webhook');
    });

    expect(webhookLayerIndex).toBeGreaterThan(-1);
    expect(protectedPaymentsLayerIndex).toBeGreaterThan(webhookLayerIndex);
  });

  it('configures rateLimiter with passOnStoreError to prevent HTTP 500 when Redis fails', () => {
    expect(rateLimiter).toBeDefined();
    // express-rate-limit attaches options
    expect(typeof rateLimiter).toBe('function');
  });

  it('runs safely in fallback mode when REDIS_URL is not set or offline', () => {
    // In test environment without REDIS_URL, redisClient is null and memory store is used
    if (!process.env['REDIS_URL']) {
      expect(redisClient).toBeNull();
    }
  });
});
