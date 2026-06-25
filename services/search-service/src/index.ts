// ============================================================
// Search Service — Entry Point
// ============================================================

import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { searchRouter } from './routes/search';
import { errorHandler, notFoundHandler, requestLogger, securityHeaders, logger } from '@parkly/shared';

const PORT = process.env['SEARCH_PORT'] || 4004;
const SERVICE_NAME = 'search-service';
process.env['SERVICE_NAME'] = SERVICE_NAME;

const app = express();
app.use(helmet({ contentSecurityPolicy: false }));
app.use(securityHeaders);
app.use(cors({ origin: process.env['ALLOWED_ORIGINS']?.split(',') || '*' }));
app.use(express.json({ limit: '64kb' })); // Max payload 64KB per spec
app.use(requestLogger);

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: SERVICE_NAME, version: '1.0.0', timestamp: new Date().toISOString() });
});

app.use('/search', searchRouter);

app.use(notFoundHandler);
app.use(errorHandler);

const server = app.listen(PORT, () => {
  logger.info({ port: PORT, service: SERVICE_NAME }, `${SERVICE_NAME} started`);
});

process.on('SIGTERM', () => {
  server.close(() => process.exit(0));
});

export default app;
