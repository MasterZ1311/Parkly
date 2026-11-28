import { AxiosError } from 'axios';

export type ApiErrorKind =
  | 'session-expired'
  | 'restricted'
  | 'maintenance'
  | 'server-error'
  | 'offline'
  | 'conflict'
  | 'payment-failed'
  | 'not-found'
  | 'validation';

export interface ClassifiedApiError {
  kind: ApiErrorKind;
  status?: number;
  code?: string;
  message: string;
  statusRoute?:
    | '/status/session-expired'
    | '/status/restricted'
    | '/status/maintenance'
    | '/status/server-error'
    | '/status/offline';
}

export function classifyApiError(
  err: unknown,
  fallbackMessage = 'Something went wrong communicating with Parkly.',
): ClassifiedApiError {
  const axiosErr = err as AxiosError<{
    error?: { code?: string; message?: string };
    message?: string;
  }>;

  const status = axiosErr?.response?.status;
  const code = axiosErr?.response?.data?.error?.code || axiosErr?.code;
  const serverMessage =
    axiosErr?.response?.data?.error?.message ||
    axiosErr?.response?.data?.message ||
    (err instanceof Error ? err.message : undefined);

  if (!axiosErr?.response) {
    return {
      kind: 'offline',
      code,
      message: serverMessage || 'Unable to reach Parkly servers. Check your connection.',
      statusRoute: '/status/offline',
    };
  }

  if (status === 401) {
    return {
      kind: 'session-expired',
      status,
      code,
      message: serverMessage || 'Your session has expired. Please sign in again.',
      statusRoute: '/status/session-expired',
    };
  }

  if (status === 403) {
    return {
      kind: 'restricted',
      status,
      code,
      message: serverMessage || 'This account action is restricted.',
      statusRoute: '/status/restricted',
    };
  }

  if (status === 402) {
    return {
      kind: 'payment-failed',
      status,
      code,
      message: serverMessage || 'Payment authorization failed.',
    };
  }

  if (status === 404) {
    return {
      kind: 'not-found',
      status,
      code,
      message: serverMessage || 'Requested resource was not found.',
    };
  }

  if (status === 409) {
    return {
      kind: 'conflict',
      status,
      code,
      message: serverMessage || 'This parking slot was just claimed.',
    };
  }

  if (status === 503) {
    return {
      kind: 'maintenance',
      status,
      code,
      message: serverMessage || 'Parkly services are temporarily undergoing maintenance.',
      statusRoute: '/status/maintenance',
    };
  }

  if (typeof status === 'number' && status >= 500) {
    return {
      kind: 'server-error',
      status,
      code,
      message: serverMessage || 'Booking gateway encountered an unexpected server error.',
      statusRoute: '/status/server-error',
    };
  }

  return {
    kind: 'validation',
    status,
    code,
    message: serverMessage || fallbackMessage,
  };
}
