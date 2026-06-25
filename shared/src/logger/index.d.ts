export declare const logger: any;
export type Logger = typeof logger;
/**
 * Create a child logger with a correlation ID attached.
 */
export declare function createRequestLogger(requestId: string, service?: string): Logger;
//# sourceMappingURL=index.d.ts.map