// ============================================================
// Parkly — Graceful Lifecycle Management
// Handles startup readiness and shutdown with connection draining.
// ============================================================

import { Server } from 'http';
import { logger } from '../logger';

export interface GracefulShutdownOptions {
  /** HTTP server to close. */
  server: Server;
  /** Service name for logging. */
  serviceName: string;
  /** Grace period before force-kill (ms). Default: 10000 */
  gracePeriodMs?: number;
  /** Cleanup functions to call before shutting down (close DB connections, etc.) */
  onShutdown?: () => Promise<void>;
}

/**
 * Registers SIGTERM/SIGINT handlers for graceful shutdown:
 * 1. Stop accepting new connections
 * 2. Run cleanup callbacks (close DB pools, flush logs)
 * 3. Force exit after grace period
 */
export function registerGracefulShutdown(opts: GracefulShutdownOptions): void {
  const { server, serviceName, gracePeriodMs = 10000, onShutdown } = opts;
  let isShuttingDown = false;

  async function shutdown(signal: string): Promise<void> {
    if (isShuttingDown) return;
    isShuttingDown = true;

    logger.info({ service: serviceName, signal }, 'Graceful shutdown initiated');

    // Force exit safety net
    const forceTimer = setTimeout(() => {
      logger.error({ service: serviceName }, 'Forced shutdown after grace period');
      process.exit(1);
    }, gracePeriodMs);
    forceTimer.unref();

    try {
      // 1. Stop accepting new connections
      await new Promise<void>((resolve, reject) => {
        server.close((err) => (err ? reject(err) : resolve()));
      });
      logger.info({ service: serviceName }, 'Server closed — no new connections');

      // 2. Run cleanup
      if (onShutdown) {
        await onShutdown();
        logger.info({ service: serviceName }, 'Cleanup completed');
      }

      logger.info({ service: serviceName }, 'Graceful shutdown complete');
      process.exit(0);
    } catch (err) {
      logger.error({ service: serviceName, err }, 'Error during shutdown');
      process.exit(1);
    }
  }

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

/**
 * Readiness state — services can mark themselves as ready once dependencies are connected.
 * The API gateway can check /health?ready=true to confirm a service is accepting traffic.
 */
export class ReadinessState {
  private ready = false;
  private checks: Map<string, boolean> = new Map();

  /** Mark a dependency as ready. */
  markReady(name: string): void {
    this.checks.set(name, true);
    this.evaluate();
  }

  /** Mark a dependency as not ready. */
  markNotReady(name: string): void {
    this.checks.set(name, false);
    this.evaluate();
  }

  /** Register a required dependency. */
  require(name: string): void {
    this.checks.set(name, false);
  }

  get isReady(): boolean {
    return this.ready;
  }

  private evaluate(): void {
    this.ready = [...this.checks.values()].every(Boolean);
  }
}
