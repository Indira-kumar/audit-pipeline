import { Router } from 'express';
import { AuditController } from '../controllers/AuditController.js';

export function createAuditRouter(controller: AuditController): Router {
  const router = Router();
  router.get('/', controller.list.bind(controller));
  router.post('/', controller.create.bind(controller));
  router.put('/:id', controller.update.bind(controller));
  router.post('/:id/similar', controller.similar.bind(controller));
  return router;
}
