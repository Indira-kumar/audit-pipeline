import type { Request, Response } from 'express';
import { AuditService } from '../services/AuditService.js';

export class AuditController {
  constructor(private readonly service: AuditService) {}

  async list(_request: Request, response: Response): Promise<void> {
    response.json(await this.service.list());
  }

  async create(request: Request, response: Response): Promise<void> {
    const entry = await this.service.create(request.body);
    response.status(201).json(entry);
  }

  async update(request: Request, response: Response): Promise<void> {
    const entry = await this.service.update(String(request.params.id), request.body);
    response.json(entry);
  }

  async retry(request: Request, response: Response): Promise<void> {
    const entry = await this.service.retryFailed(String(request.params.id));
    response.json(entry);
  }

  async similar(request: Request, response: Response): Promise<void> {
    const entries = await this.service.findSimilar(String(request.params.id));
    response.json(entries);
  }
}
