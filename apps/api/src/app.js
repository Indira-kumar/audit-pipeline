import express from 'express';
import { AuditController } from './controllers/AuditController.js';
import { AuditRepository } from './repositories/AuditRepository.js';
import { createAuditRouter } from './routes/auditRoutes.js';

export function createApp() {
  const app = express();
  const repository = new AuditRepository();
  const controller = new AuditController(repository);

  app.use(express.json());
  app.get('/api/health', (_request, response) => {
    response.json({ status: 'ok' });
  });
  app.use('/api/audit-entries', createAuditRouter(controller));

  app.use((error, _request, response, _next) => {
    const status = error.status ?? 500;
    if (status === 500) console.error(error);
    response.status(status).json({ error: error.message });
  });

  return app;
}

