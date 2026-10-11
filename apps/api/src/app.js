import express from 'express';
import { createAuditRouter } from './routes/auditRoutes.js';

export function createApp(controller) {
  const app = express();

  app.use(express.json());
  app.get('/api/health', (_request, response) => {
    response.json({ status: 'ok' });
  });
  app.use('/api/audit-entries', createAuditRouter(controller));

  app.use((error, _request, response, _next) => {
    const status = error.code === 11000 ? 409 : (error.status ?? 500);
    if (status === 500) console.error(error);
    const message = error.code === 11000 ? 'Evidence ID already exists.' : error.message;
    response.status(status).json({ error: message });
  });

  return app;
}
