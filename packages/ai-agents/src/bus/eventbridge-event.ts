import { randomUUID } from 'node:crypto';

export interface EventBridgeEvent<T = unknown> {
  readonly id: string;
  readonly version?: string;
  readonly 'detail-type': string;
  readonly source: string;
  readonly account?: string;
  readonly time: string;
  readonly region?: string;
  readonly resources?: string[];
  readonly detail: T;
  readonly correlationId?: string;
}

export function createEventBridgeEvent<T>(
  detailType: string,
  detail: T,
  options?: {
    source?: string;
    correlationId?: string;
    account?: string;
    region?: string;
    resources?: string[];
  }
): EventBridgeEvent<T> {
  return {
    id: randomUUID(),
    version: '0',
    'detail-type': detailType,
    source: options?.source ?? 'parkly.ai',
    account: options?.account ?? '123456789012',
    time: new Date().toISOString(),
    region: options?.region ?? 'ap-south-1',
    resources: options?.resources ?? [],
    detail,
    correlationId: options?.correlationId,
  };
}
