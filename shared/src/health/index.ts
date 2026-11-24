// ============================================================
// Parkly — Enhanced Health Check Module
// Deep health checks with dependency status visibility.
// ============================================================

import { Request, Response } from 'express';
import { logger } from '../logger';

export type DependencyStatus = 'healthy' | 'degraded' | 'unhealthy';

export interface DependencyCheck {
  name: string;
  status: DependencyStatus;
  latencyMs?: number;
  message?: string;
}

export interface HealthResponse {
  status: 'ok' | 'degraded' | 'down';
  service: string;
  version: string;
  uptime: number;
  timestamp: string;
  dependencies: DependencyCheck[];
  memory: {
    heapUsedMB: number;
    heapTotalMB: number;
    rssMB: number;
  };
}

type HealthCheckFn = () => Promise<DependencyCheck>;

const serviceStartTime = Date.now();

/**
 * Creates a health check handler with dependency probes.
 * Returns detailed status for ops dashboards and simple status for load balancers.
 */
export function createHealthCheck(
  serviceName: string,
  version: string,
  checks: HealthCheckFn[] = [],
) {
  return async (_req: Request, res: Response): Promise<void> => {
    const dependencies: DependencyCheck[] = [];

    // Run all dependency checks in parallel
    const results = await Promise.allSettled(
      checks.map((check) =>
        Promise.race([
          check(),
          new Promise<DependencyCheck>((resolve) =>
            setTimeout(() => resolve({ name: 'timeout', status: 'unhealthy', message: 'Check timed out (3s)' }), 3000),
          ),
        ]),
      ),
    );

    for (const result of results) {
      if (result.status === 'fulfilled') {
        dependencies.push(result.value);
      } else {
        dependencies.push({ name: 'unknown', status: 'unhealthy', message: String(result.reason) });
      }
    }

    // Overall status based on worst dependency
    const hasUnhealthy = dependencies.some((d) => d.status === 'unhealthy');
    const hasDegraded = dependencies.some((d) => d.status === 'degraded');
    const overallStatus = hasUnhealthy ? 'down' : hasDegraded ? 'degraded' : 'ok';

    const mem = process.memoryUsage();
    const response: HealthResponse = {
      status: overallStatus,
      service: serviceName,
      version,
      uptime: Math.round((Date.now() - serviceStartTime) / 1000),
      timestamp: new Date().toISOString(),
      dependencies,
      memory: {
        heapUsedMB: Math.round(mem.heapUsed / 1024 / 1024),
        heapTotalMB: Math.round(mem.heapTotal / 1024 / 1024),
        rssMB: Math.round(mem.rss / 1024 / 1024),
      },
    };

    const statusCode = overallStatus === 'ok' ? 200 : overallStatus === 'degraded' ? 200 : 503;
    res.status(statusCode).json(response);

    if (overallStatus !== 'ok') {
      logger.warn({ service: serviceName, status: overallStatus, dependencies }, 'Health check degraded/down');
    }
  };
}

/**
 * PostgreSQL (Prisma) health check factory.
 */
export function createPrismaCheck(prisma: { $queryRaw: (query: TemplateStringsArray) => Promise<unknown> }): HealthCheckFn {
  return async (): Promise<DependencyCheck> => {
    const start = Date.now();
    try {
      await prisma.$queryRaw`SELECT 1`;
      return { name: 'postgresql', status: 'healthy', latencyMs: Date.now() - start };
    } catch (err) {
      return { name: 'postgresql', status: 'unhealthy', latencyMs: Date.now() - start, message: String(err) };
    }
  };
}

/**
 * DynamoDB health check factory.
 */
export function createDynamoCheck(_getDocClient: unknown, tableName: string): HealthCheckFn {
  return async (): Promise<DependencyCheck> => {
    const start = Date.now();
    try {
      const { DescribeTableCommand } = await import('@aws-sdk/client-dynamodb');
      const { getDynamoClient } = await import('../aws/clients');
      await getDynamoClient().send(new DescribeTableCommand({ TableName: tableName }));
      return { name: `dynamodb:${tableName}`, status: 'healthy', latencyMs: Date.now() - start };
    } catch (err) {
      return { name: `dynamodb:${tableName}`, status: 'unhealthy', latencyMs: Date.now() - start, message: String(err) };
    }
  };
}

/**
 * Generic HTTP endpoint health check (for inter-service checks).
 */
export function createHttpCheck(name: string, url: string): HealthCheckFn {
  return async (): Promise<DependencyCheck> => {
    const start = Date.now();
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(2000) });
      const latencyMs = Date.now() - start;
      if (response.ok) return { name, status: 'healthy', latencyMs };
      return { name, status: 'degraded', latencyMs, message: `HTTP ${response.status}` };
    } catch (err) {
      return { name, status: 'unhealthy', latencyMs: Date.now() - start, message: String(err) };
    }
  };
}
