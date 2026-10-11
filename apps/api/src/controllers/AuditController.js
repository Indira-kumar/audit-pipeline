export class AuditController {
  constructor(service) {
    this.service = service;
  }

  async list(_request, response) {
    response.json(await this.service.list());
  }

  async create(request, response) {
    const entry = await this.service.create(request.body);
    response.status(201).json(entry);
  }

  async update(request, response) {
    const entry = await this.service.update(request.params.id, request.body);
    response.json(entry);
  }

  async similar(request, response) {
    const entries = await this.service.findSimilar(request.params.id);
    response.json(entries);
  }
}
