// ============================================================
// Parkly — Shared Package Entry Point
// ============================================================

export * from './types';
export * from './config';
export * from './errors';
export * from './logger';
export * from './utils';
export * from './utils/cors';
export * from './aws/clients';
export * from './middleware/auth';
export * from './middleware/errorHandler';
export * from './middleware/requestLogger';
export * from './middleware/responseTimer';
export { securityHeaders, requestLogger } from './middleware/requestLogger';
export { responseTimer } from './middleware/responseTimer';
export { errorHandler, notFoundHandler } from './middleware/errorHandler';
export {
  authenticate,
  optionalAuthenticate,
  requireRole,
  requireInternalOrRole,
  requireOwnership,
} from './middleware/auth';

// Health Checks
export * from './health';

// HTTP / Circuit Breaker
export * from './http';

// Lifecycle (graceful shutdown, readiness)
export * from './lifecycle';

// Brand Theme & Palette
export * from './theme/palette';

// OpenTelemetry Tracing
export * from './tracing';
