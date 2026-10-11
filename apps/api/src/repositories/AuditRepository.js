export class AuditRepository {
  constructor(collection, tenantId) {
    this.collection = collection;
    this.tenantId = tenantId;
  }

  list() {
    return this.collection.find({ tenantId: this.tenantId })
      .sort({ timestamp: -1 }).limit(100).toArray();
  }

  async create(entry) {
    const document = { ...entry, tenantId: this.tenantId };
    await this.collection.insertOne(document);
    return document;
  }

  findById(id) {
    return this.collection.findOne({ _id: id, tenantId: this.tenantId });
  }

  updateNotes(id, set) {
    return this.collection.findOneAndUpdate(
      { _id: id, tenantId: this.tenantId },
      { $set: set },
      { returnDocument: 'after' },
    );
  }

  updateCore(id, expectedVersion, set) {
    return this.collection.findOneAndUpdate(
      { _id: id, tenantId: this.tenantId, evidenceVersion: expectedVersion },
      { $set: set, $inc: { evidenceVersion: 1 } },
      { returnDocument: 'after' },
    );
  }

  findSimilarCandidates(source) {
    return this.collection.find({
      tenantId: this.tenantId,
      _id: { $ne: source._id },
      timestamp: { $lt: source.timestamp },
      'aiMetadata.status': 'COMPLETED',
      'aiMetadata.semanticVector': { $size: 8 },
      'aiMetadata.anomalyFlags.0': { $exists: true },
    }).toArray();
  }

  async claimPending() {
    // The background enrichment module will consume the job marker later.
    return null;
  }

  async completeEnrichment() {
    throw new Error('Background enrichment is not implemented yet.');
  }
}
