// ============================================================
// Tests — Hardened CORS & OpenTelemetry Tracing
// ============================================================

import {
  getHardenedCorsOptions,
  DEFAULT_ALLOWED_ORIGINS,
} from '../utils/cors';
import {
  parseTraceparent,
  formatTraceparent,
  generateTraceId,
  generateSpanId,
  extractTraceparent,
  injectTraceparent,
  traceContextMiddleware,
  getTraceMetadata,
  initTracing,
  getTracingConfig,
} from '../tracing';

describe('Hardened CORS Options', () => {
  const origEnv = process.env;

  beforeEach(() => {
    process.env = { ...origEnv };
  });

  afterAll(() => {
    process.env = origEnv;
  });

  it('allows requests with no origin (e.g. mobile apps, curl)', (done) => {
    const corsOptions = getHardenedCorsOptions();
    corsOptions.origin(undefined, (err, allow) => {
      expect(err).toBeNull();
      expect(allow).toBe(true);
      done();
    });
  });

  it('allows default whitelisted production and dev origins', (done) => {
    const corsOptions = getHardenedCorsOptions();
    let checks = DEFAULT_ALLOWED_ORIGINS.length;

    DEFAULT_ALLOWED_ORIGINS.forEach((origin) => {
      corsOptions.origin(origin, (err, allow) => {
        expect(err).toBeNull();
        expect(allow).toBe(true);
        checks--;
        if (checks === 0) done();
      });
    });
  });

  it('allows arbitrary localhost port in development', (done) => {
    process.env.NODE_ENV = 'development';
    const corsOptions = getHardenedCorsOptions();

    corsOptions.origin('http://localhost:5173', (err, allow) => {
      expect(err).toBeNull();
      expect(allow).toBe(true);
      done();
    });
  });

  it('rejects unapproved origin', (done) => {
    process.env.NODE_ENV = 'production';
    const corsOptions = getHardenedCorsOptions();

    corsOptions.origin('https://malicious-site.example.com', (err, allow) => {
      expect(err).toBeInstanceOf(Error);
      expect(err?.message).toContain('CORS policy: Origin https://malicious-site.example.com not allowed');
      expect(allow).toBeUndefined();
      done();
    });
  });

  it('supports extra configured origins via ALLOWED_ORIGINS env', (done) => {
    process.env.ALLOWED_ORIGINS = 'https://partner.parkly.in,https://kiosk.parkly.in';
    const corsOptions = getHardenedCorsOptions();

    corsOptions.origin('https://partner.parkly.in', (err, allow) => {
      expect(err).toBeNull();
      expect(allow).toBe(true);
      done();
    });
  });

  it('verifies standard headers, exposed headers, methods, credentials, and maxAge', () => {
    const corsOptions = getHardenedCorsOptions();
    expect(corsOptions.credentials).toBe(true);
    expect(corsOptions.maxAge).toBe(86400);
    expect(corsOptions.methods).toEqual(['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS']);
    expect(corsOptions.allowedHeaders).toContain('X-Razorpay-Signature');
    expect(corsOptions.allowedHeaders).toContain('X-Correlation-ID');
    expect(corsOptions.exposedHeaders).toContain('X-Correlation-ID');
    expect(corsOptions.exposedHeaders).toContain('X-Response-Time');
  });
});

describe('OpenTelemetry Tracing Instrumentation', () => {
  it('generates valid 32-hex trace ID and 16-hex span ID', () => {
    const traceId = generateTraceId();
    const spanId = generateSpanId();

    expect(traceId).toHaveLength(32);
    expect(/^[0-9a-f]{32}$/.test(traceId)).toBe(true);
    expect(spanId).toHaveLength(16);
    expect(/^[0-9a-f]{16}$/.test(spanId)).toBe(true);
  });

  it('formats and parses W3C traceparent headers', () => {
    const traceId = generateTraceId();
    const spanId = generateSpanId();
    const formatted = formatTraceparent(traceId, spanId, true);

    expect(formatted).toBe(`00-${traceId}-${spanId}-01`);

    const parsed = parseTraceparent(formatted);
    expect(parsed).not.toBeNull();
    expect(parsed?.version).toBe('00');
    expect(parsed?.traceId).toBe(traceId);
    expect(parsed?.spanId).toBe(spanId);
    expect(parsed?.traceFlags).toBe('01');
  });

  it('rejects invalid or all-zero traceparents', () => {
    expect(parseTraceparent('invalid-traceparent')).toBeNull();
    expect(parseTraceparent('00-00000000000000000000000000000000-00f067aa0ba902b7-01')).toBeNull();
    expect(parseTraceparent('00-4bf92f3577b34da6a3ce929d0e0e4736-0000000000000000-01')).toBeNull();
    expect(parseTraceparent(undefined)).toBeNull();
  });

  it('extracts and injects traceparent in headers dictionary', () => {
    const traceId = generateTraceId();
    const spanId = generateSpanId();
    const carrier: Record<string, string> = {};

    injectTraceparent(carrier, { traceId, spanId, traceFlags: '01' });
    expect(carrier['traceparent']).toBe(`00-${traceId}-${spanId}-01`);
    expect(carrier['x-correlation-id']).toBe(traceId);

    const extracted = extractTraceparent(carrier);
    expect(extracted).not.toBeNull();
    expect(extracted?.traceId).toBe(traceId);
    expect(extracted?.spanId).toBe(spanId);
  });

  it('traceContextMiddleware sets headers on response and attaches context', () => {
    const middleware = traceContextMiddleware();
    const req: any = { headers: {} };
    const resHeaders: Record<string, string> = {};
    const res: any = {
      setHeader: jest.fn((k: string, v: string) => {
        resHeaders[k.toLowerCase()] = v;
      }),
    };
    const next = jest.fn();

    middleware(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(req.traceContext).toBeDefined();
    expect(req.traceContext.traceId).toHaveLength(32);
    expect(res.setHeader).toHaveBeenCalledWith('traceparent', req.traceContext.traceparent);
    expect(res.setHeader).toHaveBeenCalledWith('x-trace-id', req.traceContext.traceId);
  });

  it('reads tracing configuration and initializes manager', async () => {
    process.env.OTEL_ENABLED = 'true';
    process.env.OTEL_SERVICE_NAME = 'test-tracer';
    process.env.DEPLOYMENT_ENVIRONMENT = 'test-env';
    process.env.OTEL_EXPORTER_OTLP_ENDPOINT = 'http://localhost:4318/v1/traces';

    const config = getTracingConfig();
    expect(config.enabled).toBe(true);
    expect(config.serviceName).toBe('test-tracer');
    expect(config.environment).toBe('test-env');
    expect(config.otlpEndpoint).toBe('http://localhost:4318/v1/traces');

    const manager = initTracing();
    expect(manager.isEnabled()).toBe(true);

    const meta = getTraceMetadata();
    expect(meta).toBeDefined();

    await manager.shutdown();
  });
});
