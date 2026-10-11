export class AuditController {
  constructor(repository) {
    this.repository = repository;
  }

  async list(_request, response) {
    response.json(await this.repository.list());
  }

  async create(request, response) {
    const entry = await this.repository.create(request.body);
    response.status(201).json(entry);
  }

  async update(request, response) {
    const entry = await this.repository.update(request.params.id, request.body);
    response.json(entry);
  }

  async similar(request, response) {
    const entries = await this.repository.findSimilar(request.params.id);
    response.json(entries);
  }
}

