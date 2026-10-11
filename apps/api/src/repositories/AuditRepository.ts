import { ObjectId } from 'mongodb';
import type { Collection } from 'mongodb';
import type {
  AuditEntry,
  AuditStore,
  CoreUpdateSet,
  EnrichmentResult,
  NewAuditEntry,
  NoteUpdateSet,
} from '../types.js';

export class AuditRepository implements AuditStore {
  constructor(
    private readonly collection: Collection<AuditEntry>,
    private readonly tenantId: ObjectId,
  ) {}

  list(): Promise<AuditEntry[]> {
    return this.collection
      .find({ tenantId: this.tenantId })
      .sort({ timestamp: -1 })
      .limit(100)
      .toArray();
  }

  async create(entry: NewAuditEntry): Promise<AuditEntry> {
    const document: AuditEntry = { ...entry, _id: new ObjectId(), tenantId: this.tenantId };
    await this.collection.insertOne(document);
    return document;
  }

  findById(id: ObjectId): Promise<AuditEntry | null> {
    return this.collection.findOne({ _id: id, tenantId: this.tenantId });
  }

  updateNotes(id: ObjectId, set: NoteUpdateSet): Promise<AuditEntry | null> {
    return this.collection.findOneAndUpdate(
      { _id: id, tenantId: this.tenantId },
      { $set: set },
      { returnDocument: 'after' },
    );
  }

  updateCore(
    id: ObjectId,
    expectedVersion: number,
    set: CoreUpdateSet,
  ): Promise<AuditEntry | null> {
    return this.collection.findOneAndUpdate(
      { _id: id, tenantId: this.tenantId, evidenceVersion: expectedVersion },
      { $set: set, $inc: { evidenceVersion: 1 } },
      { returnDocument: 'after' },
    );
  }

  findSimilarCandidates(source: AuditEntry): Promise<AuditEntry[]> {
    return this.collection
      .find({
        tenantId: this.tenantId,
        _id: { $ne: source._id },
        timestamp: { $lt: source.timestamp },
        'aiMetadata.status': 'COMPLETED',
        'aiMetadata.semanticVector': { $size: 8 },
        'aiMetadata.anomalyFlags.0': { $exists: true },
      })
      .toArray();
  }

  async claimPending(): Promise<AuditEntry | null> {
    // The background enrichment module will consume the job marker later.
    return null;
  }

  async completeEnrichment(_entry: AuditEntry, _result: EnrichmentResult): Promise<void> {
    throw new Error('Background enrichment is not implemented yet.');
  }
}
