function notImplemented() {
  const error = new Error('Audit persistence is part of the next increment.');
  error.status = 501;
  throw error;
}

export class AuditRepository {
  async list() {
    notImplemented();
  }

  async create(_evidence) {
    notImplemented();
  }

  async update(_id, _changes) {
    notImplemented();
  }

  async findSimilar(_id) {
    notImplemented();
  }

  async claimPending() {
    // A later increment will atomically claim a PENDING record here.
    return null;
  }

  async completeEnrichment(_entry, _result) {
    notImplemented();
  }
}

