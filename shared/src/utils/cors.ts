// ============================================================
// Parkly — Hardened CORS Configuration
// ============================================================

export interface HardenedCorsOptions {
  origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => void;
  methods: string[];
  allowedHeaders: string[];
  exposedHeaders: string[];
  credentials: boolean;
  maxAge: number;
}

export const DEFAULT_ALLOWED_ORIGINS = [
  'https://parkly.in',
  'https://www.parkly.in',
  'https://host.parkly.in',
  'https://admin.parkly.in',
  'http://localhost:3000',
  'http://localhost:3001',
  'http://localhost:3002',
  'http://localhost:8081',
];

/**
 * Returns hardened CORS configuration options for Express microservices.
 * - Origins allowed:
 *   - https://parkly.in, https://www.parkly.in, https://host.parkly.in, https://admin.parkly.in
 *   - http://localhost:3000 (landing/web preview)
 *   - http://localhost:3001 (host dashboard)
 *   - http://localhost:3002 (admin portal)
 *   - http://localhost:8081 (Expo / Metro bundler)
 *   - Requests with no origin (mobile app native, curl, server-to-server)
 *   - Localhost / 127.0.0.1 on any port in non-production environments
 *   - Any origins configured via ALLOWED_ORIGINS environment variable
 * - Methods: GET, POST, PUT, DELETE, PATCH, OPTIONS
 * - Allowed Headers: Content-Type, Authorization, X-Requested-With, X-Correlation-ID, X-Request-ID, Accept, X-Razorpay-Signature
 * - Exposed Headers: X-Correlation-ID, X-Response-Time, Content-Range, X-Total-Count
 * - credentials: true
 * - maxAge: 86400 (24h preflight cache)
 */
export function getHardenedCorsOptions(extraOrigins: string[] = []): HardenedCorsOptions {
  const envOrigins = process.env['ALLOWED_ORIGINS']
    ? process.env['ALLOWED_ORIGINS'].split(',').map((o) => o.trim()).filter(Boolean)
    : [];

  const allowedOrigins = Array.from(new Set([
    ...DEFAULT_ALLOWED_ORIGINS,
    ...envOrigins,
    ...extraOrigins,
  ]));

  return {
    origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
      // Allow requests with no origin (e.g. mobile apps, curl, server-to-server)
      if (!origin) {
        return callback(null, true);
      }

      // Check allowed explicit origins
      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      // In non-production, allow localhost / 127.0.0.1 on any port
      if (process.env['NODE_ENV'] !== 'production') {
        const isLocal = /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
        if (isLocal) {
          return callback(null, true);
        }
      }

      return callback(new Error(`CORS policy: Origin ${origin} not allowed`));
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-Requested-With',
      'X-Correlation-ID',
      'X-Request-ID',
      'Accept',
      'X-Razorpay-Signature',
    ],
    exposedHeaders: [
      'X-Correlation-ID',
      'X-Response-Time',
      'Content-Range',
      'X-Total-Count',
    ],
    credentials: true,
    maxAge: 86400,
  };
}
