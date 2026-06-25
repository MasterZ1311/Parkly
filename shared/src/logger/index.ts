// ============================================================
// Parkly — Structured Logger (pino-based)
// Adds correlation ID to every log line.
// SECURITY: Never log secrets, PII, or raw credentials.
// ============================================================

// eslint-disable-next-line @typescript-eslint/no-require-imports
const pinoLib = require('pino');

const isDev = process.env['NODE_ENV'] !== 'production';

export const logger = pinoLib({
  level: process.env['LOG_LEVEL'] || 'info',
  transport: isDev
    ? {
        target: 'pino-pretty',
        options: { colorize: true, translateTime: 'SYS:standard', ignore: 'pid,hostname' },
      }
    : undefined,
  formatters: {
    level: (label: string) => ({ level: label }),
  },
  base: {
    service: process.env['SERVICE_NAME'] || 'parkly',
  },
  redact: {
    paths: [
      'password',
      'otp',
      'token',
      'accessToken',
      'refreshToken',
      'authorization',
      'x-api-key',
      'AWS_SECRET_ACCESS_KEY',
      'AWS_SESSION_TOKEN',
    ],
    censor: '[REDACTED]',
  },
});

export type Logger = typeof logger;

/**
 * Create a child logger with a correlation ID attached.
 */
export function createRequestLogger(requestId: string, service?: string): Logger {
  return logger.child({ requestId, service }) as unknown as Logger;
}
