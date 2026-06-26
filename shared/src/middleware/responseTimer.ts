// ============================================================
// Parkly — Response Timer Middleware
// Adds X-Response-Time header for client visibility.
// ============================================================

import { Request, Response, NextFunction } from 'express';

/**
 * Attaches a high-resolution timer and sets X-Response-Time header.
 * Clients (mobile app, dashboards) can use this to monitor backend latency.
 */
export function responseTimer(req: Request, res: Response, next: NextFunction): void {
  const start = process.hrtime.bigint();

  // Hook into writeHead to set header before response is sent
  const originalWriteHead = res.writeHead.bind(res);
  res.writeHead = function (statusCode: number, ...args: unknown[]): Response {
    const durationNs = process.hrtime.bigint() - start;
    const durationMs = Number(durationNs) / 1_000_000;
    res.setHeader('X-Response-Time', `${durationMs.toFixed(2)}ms`);
    return (originalWriteHead as Function)(statusCode, ...args);
  } as typeof res.writeHead;

  next();
}
