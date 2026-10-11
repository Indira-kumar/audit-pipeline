import express from 'express';
import type { ErrorRequestHandler, Express } from 'express';
import { MongoServerError } from 'mongodb';
import { AuditController } from './controllers/AuditController.js';
import { createAuditRouter } from './routes/auditRoutes.js';
import { AuditError } from './services/AuditService.js';

export function createApp(controller: AuditController): Express {
  const app = express();
  app.use(express.json());
  app.get('/api/health', (_request, response) => response.json({ status: 'ok' }));
  app.use('/api/audit-entries', createAuditRouter(controller));

  const handleError: ErrorRequestHandler = (error: unknown, _request, response, _next) => {
    if (error instanceof MongoServerError && error.code === 11000) {
      response.status(409).json({ error: 'Evidence ID already exists.' });
      return;
    }
    if (error instanceof AuditError) {
      response.status(error.status).json({ error: error.message });
      return;
    }
    console.error(error);
    response.status(500).json({ error: 'Internal server error.' });
  };
  app.use(handleError);
  return app;
}
