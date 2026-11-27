import { EventEmitter } from 'events';
import type { NextFunction, Request, Response } from 'express';
import { getConfig, getJwtConfig } from '../config';
import { createHealthCheck } from '../health';
import { logger } from '../logger';
import { requestLogger } from '../middleware/requestLogger';

describe('Stage D ENG-D01 shared stability fixes', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  describe('getConfig lazy JWT secret resolution', () => {
    it('does not throw when non-JWT callers read getConfig() without JWT env vars', () => {
      jest.isolateModules(() => {
        delete process.env['JWT_ACCESS_SECRET'];
        delete process.env['JWT_REFRESH_SECRET'];

        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const { getConfig: isolatedGetConfig, getJwtConfig: isolatedGetJwtConfig } = require('../config') as {
          getConfig: typeof getConfig;
          getJwtConfig: typeof getJwtConfig;
        };

        const cfg = isolatedGetConfig();
        expect(cfg.cityDefault).toBe('chennai');
        expect(() => cfg.jwtAccessSecret).toThrow('Missing required environment variable: JWT_ACCESS_SECRET');
        expect(() => cfg.jwtRefreshSecret).toThrow('Missing required environment variable: JWT_REFRESH_SECRET');
        expect(() => isolatedGetJwtConfig()).toThrow('Missing required environment variable: JWT_ACCESS_SECRET');

        process.env['JWT_ACCESS_SECRET'] = 'lazy-access-secret';
        process.env['JWT_REFRESH_SECRET'] = 'lazy-refresh-secret';

        expect(cfg.jwtAccessSecret).toBe('lazy-access-secret');
        expect(isolatedGetJwtConfig()).toEqual({
          jwtAccessSecret: 'lazy-access-secret',
          jwtRefreshSecret: 'lazy-refresh-secret',
          jwtAccessTtl: 900,
          jwtRefreshTtl: 2592000,
        });
      });
    });
  });

  describe('createHealthCheck timeout cleanup', () => {
    it('clears the 3s race timer immediately after dependency checks settle', async () => {
      jest.useFakeTimers();

      const handler = createHealthCheck('test-service', '1.0.0', [
        async () => ({ name: 'db', status: 'healthy' }),
      ]);

      const json = jest.fn();
      const status = jest.fn().mockReturnValue({ json });
      const req = {} as Request;
      const res = { status, json } as unknown as Response;

      await handler(req, res);

      expect(status).toHaveBeenCalledWith(200);
      expect(jest.getTimerCount()).toBe(0);
    });
  });

  describe('requestLogger path normalization and dynamic service name', () => {
    it('logs normalized originalUrl path without query string PII and reflects SERVICE_NAME', () => {
      process.env['SERVICE_NAME'] = 'booking-service-test';
      const infoSpy = jest.spyOn(logger, 'info').mockImplementation((() => logger) as unknown as typeof logger.info);

      const req = {
        method: 'GET',
        path: '/',
        originalUrl: '/api/v1/bookings/active?token=secret-jwt',
        url: '/?token=secret-jwt',
        query: {},
        ip: '127.0.0.1',
        headers: {},
      } as unknown as Request;

      const emitter = new EventEmitter();
      const res = Object.assign(emitter, {
        statusCode: 200,
        setHeader: jest.fn(),
      }) as unknown as Response;

      const next = jest.fn() as NextFunction;
      requestLogger(req, res, next);
      expect(next).toHaveBeenCalledTimes(1);

      expect(infoSpy).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({
          method: 'GET',
          path: '/api/v1/bookings/active',
        }),
        'Incoming request',
      );

      emitter.emit('finish');
      expect(infoSpy).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({
          method: 'GET',
          path: '/api/v1/bookings/active',
          statusCode: 200,
        }),
        'Request completed',
      );
    });
  });
});
