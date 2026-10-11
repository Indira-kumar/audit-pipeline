import { randomUUID } from 'node:crypto';
import { ObjectId } from 'mongodb';
import type { Collection } from 'mongodb';
import type {
  AuditEntry,
  AuditStore,
  CoreUpdateSet,
  EnrichmentResult,
  NewAuditEntry,
  NoteUpdateSet,
  SimilarityCandidate,
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
      {
        $set: set,
        $inc: { evidenceVersion: 1 },
        $unset: {
          'enrichmentJob.claimToken': '',
          'enrichmentJob.leaseUntil': '',
          'enrichmentJob.startedAt': '',
          'enrichmentJob.lastError': '',
        },
      },
      { returnDocument: 'after' },
    );
  }

  retryFailed(id: ObjectId, expectedVersion: number): Promise<AuditEntry | null> {
    const now = new Date();
    return this.collection.findOneAndUpdate(
      {
        _id: id,
        tenantId: this.tenantId,
        evidenceVersion: expectedVersion,
        'aiMetadata.status': 'FAILED',
        'enrichmentJob.state': 'FAILED',
      },
      {
        $set: {
          'aiMetadata.status': 'PENDING',
          'aiMetadata.riskScore': null,
          'aiMetadata.riskLevel': null,
          'aiMetadata.aiSummary': null,
          'aiMetadata.anomalyFlags': [],
          'aiMetadata.semanticVector': [],
          'enrichmentJob.state': 'UNPUBLISHED',
          'enrichmentJob.requestedAt': now,
          'enrichmentJob.requestId': randomUUID(),
          updated: now,
        },
        $unset: {
          'enrichmentJob.claimToken': '',
          'enrichmentJob.leaseUntil': '',
          'enrichmentJob.startedAt': '',
          'enrichmentJob.lastError': '',
        },
      },
      { returnDocument: 'after' },
    );
  }

  findSimilarCandidates(source: AuditEntry): AsyncIterable<SimilarityCandidate> {
    return this.collection
      .find({
        tenantId: this.tenantId,
        _id: { $ne: source._id },
        timestamp: { $lt: source.timestamp },
        'aiMetadata.status': 'COMPLETED',
        'aiMetadata.semanticVector': { $size: 8 },
        'aiMetadata.anomalyFlags.0': { $exists: true },
      })
      .project<SimilarityCandidate>({
        _id: 1,
        evidenceId: 1,
        entityName: 1,
        description: 1,
        timestamp: 1,
        'aiMetadata.riskScore': 1,
        'aiMetadata.semanticVector': 1,
      })
      .batchSize(100);
  }

  claimUnpublished(leaseMs: number): Promise<AuditEntry | null> {
    const now = new Date();
    return this.collection.findOneAndUpdate(
      {
        tenantId: this.tenantId,
        'aiMetadata.status': 'PENDING',
        $or: [
          { 'enrichmentJob.state': 'UNPUBLISHED' },
          { 'enrichmentJob.state': 'PUBLISHING', 'enrichmentJob.leaseUntil': { $lt: now } },
        ],
      },
      {
        $set: {
          'enrichmentJob.state': 'PUBLISHING',
          'enrichmentJob.claimToken': randomUUID(),
          'enrichmentJob.leaseUntil': new Date(now.getTime() + leaseMs),
        },
      },
      { sort: { 'enrichmentJob.requestedAt': 1 }, returnDocument: 'after' },
    );
  }

  async markPublished(entry: AuditEntry): Promise<void> {
    await this.collection.updateOne(this.publishClaim(entry), {
      $set: { 'enrichmentJob.state': 'PUBLISHED' },
      $unset: { 'enrichmentJob.claimToken': '', 'enrichmentJob.leaseUntil': '' },
    });
  }

  async releasePublishClaim(entry: AuditEntry): Promise<void> {
    await this.collection.updateOne(this.publishClaim(entry), {
      $set: { 'enrichmentJob.state': 'UNPUBLISHED' },
      $unset: { 'enrichmentJob.claimToken': '', 'enrichmentJob.leaseUntil': '' },
    });
  }

  private publishClaim(entry: AuditEntry) {
    return {
      _id: entry._id,
      tenantId: this.tenantId,
      evidenceVersion: entry.evidenceVersion,
      'enrichmentJob.state': 'PUBLISHING' as const,
      'enrichmentJob.claimToken': entry.enrichmentJob.claimToken,
    };
  }

  claimPending(id: ObjectId, version: number, requestId?: string): Promise<AuditEntry | null> {
    return this.collection.findOneAndUpdate(
      {
        _id: id,
        tenantId: this.tenantId,
        evidenceVersion: version,
        'enrichmentJob.requestId': requestId ?? { $exists: false },
        'aiMetadata.status': { $in: ['PENDING', 'PROCESSING'] },
        'enrichmentJob.state': { $in: ['PUBLISHING', 'PUBLISHED', 'PROCESSING'] },
      },
      {
        $set: {
          'aiMetadata.status': 'PROCESSING',
          'enrichmentJob.state': 'PROCESSING',
          'enrichmentJob.claimToken': randomUUID(),
          'enrichmentJob.startedAt': new Date(),
        },
        $unset: { 'enrichmentJob.leaseUntil': '', 'enrichmentJob.lastError': '' },
      },
      { returnDocument: 'after' },
    );
  }

  async completeEnrichment(entry: AuditEntry, result: EnrichmentResult): Promise<boolean> {
    const updated = await this.collection.updateOne(this.processingClaim(entry), {
      $set: {
        'aiMetadata.status': 'COMPLETED',
        'aiMetadata.riskScore': result.riskScore,
        'aiMetadata.riskLevel': result.riskLevel,
        'aiMetadata.aiSummary': result.aiSummary,
        'aiMetadata.anomalyFlags': result.anomalyFlags,
        'aiMetadata.semanticVector': result.semanticVector,
        'enrichmentJob.state': 'DONE',
        updated: new Date(),
      },
      $unset: { 'enrichmentJob.claimToken': '', 'enrichmentJob.startedAt': '' },
    });
    return updated.matchedCount === 1;
  }

  async recordFailure(entry: AuditEntry, error: string, terminal: boolean): Promise<void> {
    await this.collection.updateOne(this.processingClaim(entry), {
      $set: {
        'aiMetadata.status': terminal ? 'FAILED' : 'PENDING',
        'enrichmentJob.state': terminal ? 'FAILED' : 'PUBLISHED',
        'enrichmentJob.lastError': error.slice(0, 300),
        updated: new Date(),
      },
      $unset: { 'enrichmentJob.claimToken': '', 'enrichmentJob.startedAt': '' },
    });
  }

  async markStalledFailure(id: ObjectId, version: number, requestId?: string): Promise<void> {
    await this.collection.updateOne(
      {
        _id: id,
        tenantId: this.tenantId,
        evidenceVersion: version,
        'enrichmentJob.requestId': requestId ?? { $exists: false },
        'aiMetadata.status': 'PROCESSING',
        'enrichmentJob.state': 'PROCESSING',
      },
      {
        $set: {
          'aiMetadata.status': 'FAILED',
          'enrichmentJob.state': 'FAILED',
          'enrichmentJob.lastError': 'Worker stopped before enrichment completed.',
          updated: new Date(),
        },
        $unset: { 'enrichmentJob.claimToken': '', 'enrichmentJob.startedAt': '' },
      },
    );
  }

  private processingClaim(entry: AuditEntry) {
    return {
      _id: entry._id,
      tenantId: this.tenantId,
      evidenceVersion: entry.evidenceVersion,
      'aiMetadata.status': 'PROCESSING' as const,
      'enrichmentJob.state': 'PROCESSING' as const,
      'enrichmentJob.claimToken': entry.enrichmentJob.claimToken,
    };
  }
}
