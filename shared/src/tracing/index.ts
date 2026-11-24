// ============================================================
// Parkly — OpenTelemetry Tracing Setup & W3C Trace Context
// ============================================================

import * as crypto from 'crypto';
import { trace, context, SpanStatusCode, Span, SpanContext } from '@opentelemetry/api';

export interface TracingConfig {
  enabled: boolean;
  serviceName: string;
  environment: string;
  otlpEndpoint: string;
}

export interface W3CTraceContext {
  version: string;
  traceId: string;
  spanId: string;
  traceFlags: string;
  traceparent: string;
}

/**
 * Retrieve current OpenTelemetry tracing configuration from environment.
 */
export function getTracingConfig(): TracingConfig {
  return {
    enabled: process.env['OTEL_ENABLED'] === 'true',
    serviceName:
      process.env['OTEL_SERVICE_NAME'] ||
      process.env['SERVICE_NAME'] ||
      'parkly-service',
    environment:
      process.env['DEPLOYMENT_ENVIRONMENT'] ||
      process.env['NODE_ENV'] ||
      'development',
    otlpEndpoint:
      process.env['OTEL_EXPORTER_OTLP_ENDPOINT'] ||
      'http://localhost:4318/v1/traces',
  };
}

/**
 * Generate a random 32-hex character (16-byte) W3C trace ID.
 */
export function generateTraceId(): string {
  return crypto.randomBytes(16).toString('hex');
}

/**
 * Generate a random 16-hex character (8-byte) W3C span ID.
 */
export function generateSpanId(): string {
  return crypto.randomBytes(8).toString('hex');
}

/**
 * Format a W3C traceparent header string.
 * Example: "00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01"
 */
export function formatTraceparent(
  traceId: string,
  spanId: string,
  sampled = true,
  version = '00',
): string {
  const flags = sampled ? '01' : '00';
  return `${version}-${traceId}-${spanId}-${flags}`;
}

/**
 * Parse a W3C traceparent header string into its components.
 */
export function parseTraceparent(header?: string | string[]): W3CTraceContext | null {
  if (!header) return null;
  const raw = Array.isArray(header) ? header[0] : header;
  if (!raw || typeof raw !== 'string') return null;

  // W3C traceparent format: 00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01
  const parts = raw.trim().split('-');
  if (parts.length < 4) return null;

  const [version, traceId, spanId, traceFlags] = parts;
  if (!version || !traceId || !spanId || !traceFlags) return null;

  // Validate hex lengths
  if (version.length !== 2 || traceId.length !== 32 || spanId.length !== 16 || traceFlags.length !== 2) {
    return null;
  }

  // Reject all-zero traceId or spanId per W3C specification
  if (/^0{32}$/.test(traceId) || /^0{16}$/.test(spanId)) {
    return null;
  }

  return {
    version,
    traceId,
    spanId,
    traceFlags,
    traceparent: `${version}-${traceId}-${spanId}-${traceFlags}`,
  };
}

/**
 * Extract W3C traceparent from request headers or carrier dictionary.
 */
export function extractTraceparent(
  carrier: Record<string, string | string[] | undefined>,
): W3CTraceContext | null {
  const header =
    carrier['traceparent'] ||
    carrier['Traceparent'] ||
    carrier['TRACEPARENT'];
  return parseTraceparent(header);
}

/**
 * Inject W3C traceparent header into an outgoing HTTP request headers object.
 */
export function injectTraceparent(
  carrier: Record<string, string>,
  traceCtx?: Partial<W3CTraceContext>,
): void {
  const activeMeta = getTraceMetadata();
  const traceId = traceCtx?.traceId || activeMeta.traceId || generateTraceId();
  const spanId = traceCtx?.spanId || activeMeta.spanId || generateSpanId();
  const flags = traceCtx?.traceFlags || activeMeta.traceFlags || '01';
  const traceparent = `${traceCtx?.version || '00'}-${traceId}-${spanId}-${flags}`;

  carrier['traceparent'] = traceparent;
  carrier['x-correlation-id'] = traceId;
}

/**
 * Get trace metadata for Pino structured logging from the active OpenTelemetry span.
 */
export function getTraceMetadata(): {
  traceId?: string;
  spanId?: string;
  traceFlags?: string;
  service?: string;
} {
  const activeSpan = trace.getSpan(context.active());
  if (activeSpan) {
    const spanContext = activeSpan.spanContext();
    if (spanContext && spanContext.traceId) {
      return {
        traceId: spanContext.traceId,
        spanId: spanContext.spanId,
        traceFlags: String(spanContext.traceFlags),
        service: process.env['SERVICE_NAME'] || 'parkly',
      };
    }
  }

  return {
    service: process.env['SERVICE_NAME'] || 'parkly',
  };
}

/**
 * Pino log mixin to automatically correlate Pino logs with OpenTelemetry traces.
 */
export function pinoTraceMixin(): object {
  const meta = getTraceMetadata();
  if (meta.traceId) {
    return {
      traceId: meta.traceId,
      spanId: meta.spanId,
      traceFlags: meta.traceFlags,
    };
  }
  return {};
}

/**
 * Express middleware to handle W3C traceparent context propagation.
 * - Extracts incoming W3C traceparent or creates a new distributed trace ID.
 * - Sets 'traceparent', 'x-trace-id', and 'x-correlation-id' on response.
 * - Attaches trace context to req.traceContext.
 */
export function traceContextMiddleware() {
  return (req: any, res: any, next: (err?: any) => void): void => {
    const existing = extractTraceparent(req.headers);
    const traceId = existing ? existing.traceId : generateTraceId();
    const parentSpanId = existing ? existing.spanId : undefined;
    const currentSpanId = generateSpanId();
    const traceFlags = existing ? existing.traceFlags : '01';
    const traceparent = formatTraceparent(traceId, currentSpanId, traceFlags === '01');

    req.traceContext = {
      version: '00',
      traceId,
      spanId: currentSpanId,
      parentSpanId,
      traceFlags,
      traceparent,
    };

    // Propagate on request and response headers
    req.headers['traceparent'] = traceparent;
    if (!req.headers['x-correlation-id']) {
      req.headers['x-correlation-id'] = traceId;
    }
    req.correlationId = req.headers['x-correlation-id'] || traceId;
    req.requestId = req.requestId || traceId;

    res.setHeader('traceparent', traceparent);
    res.setHeader('x-trace-id', traceId);
    res.setHeader('x-correlation-id', req.correlationId);

    next();
  };
}

/**
 * Tracing Manager instance
 */
export class TracingManager {
  private config: TracingConfig;
  private isShutdown = false;
  private tracerInstance = trace.getTracer('parkly-tracer', '1.0.0');

  constructor(config?: Partial<TracingConfig>) {
    this.config = {
      ...getTracingConfig(),
      ...config,
    };
  }

  public getConfig(): TracingConfig {
    return this.config;
  }

  public isEnabled(): boolean {
    return this.config.enabled;
  }

  public getTracer() {
    return this.tracerInstance;
  }

  /**
   * Start a span and execute an async callback within that span context.
   */
  public async withSpan<T>(name: string, fn: (span: Span) => Promise<T>): Promise<T> {
    const tracer = this.getTracer();
    const span = tracer.startSpan(name);

    return context.with(trace.setSpan(context.active(), span), async () => {
      try {
        const result = await fn(span);
        span.setStatus({ code: SpanStatusCode.OK });
        return result;
      } catch (err: any) {
        span.setStatus({
          code: SpanStatusCode.ERROR,
          message: err?.message || 'Error executing span',
        });
        span.recordException(err);
        throw err;
      } finally {
        span.end();
      }
    });
  }

  /**
   * Clean shutdown of the tracing subsystem.
   */
  public async shutdown(): Promise<void> {
    if (this.isShutdown) return;
    this.isShutdown = true;

    if (this.config.enabled) {
      try {
        // Flush and clean up any active tracing providers
        const activeSpan = trace.getSpan(context.active());
        if (activeSpan) {
          activeSpan.end();
        }
      } catch (err) {
        // Suppress shutdown errors
      }
    }
  }
}

let globalTracingManager: TracingManager | null = null;

/**
 * Initialize OpenTelemetry tracing subsystem.
 * Reads OTEL_ENABLED, OTEL_SERVICE_NAME, DEPLOYMENT_ENVIRONMENT, OTEL_EXPORTER_OTLP_ENDPOINT.
 * Attaches SIGTERM/SIGINT clean shutdown handlers.
 */
export function initTracing(customConfig?: Partial<TracingConfig>): TracingManager {
  if (!globalTracingManager) {
    globalTracingManager = new TracingManager(customConfig);
    registerTracingShutdown(globalTracingManager);
  }
  return globalTracingManager;
}

/**
 * Register clean shutdown handlers on SIGTERM and SIGINT for OpenTelemetry.
 */
export function registerTracingShutdown(manager: TracingManager): void {
  const shutdownHandler = async (signal: string) => {
    try {
      await manager.shutdown();
    } catch {
      // Ignore errors during termination
    }
  };

  process.once('SIGTERM', () => {
    void shutdownHandler('SIGTERM');
  });

  process.once('SIGINT', () => {
    void shutdownHandler('SIGINT');
  });
}

// Auto-initialize if OTEL_ENABLED is set to 'true'
if (process.env['OTEL_ENABLED'] === 'true') {
  initTracing();
}
