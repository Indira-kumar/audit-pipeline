import { ObjectId } from 'mongodb';
import type {
  AuditEntry,
  AuditStore,
  CoreUpdateSet,
  NewAuditEntry,
  SimilarMatch,
} from '../types.js';
import { rankSimilarExceptions, validVector } from './SimilarityService.js';

const coreFields = ['monetaryImpact', 'description', 'controlId'] as const;
const createFields = new Set([
  'timestamp',
  'eventType',
  'evidenceId',
  'entityName',
  'description',
  'monetaryImpact',
  'controlId',
  'actorUserId',
]);
const updateFields = new Set([...coreFields, 'auditorNotes']);

type CoreField = (typeof coreFields)[number];
type Changes = Partial<Pick<AuditEntry, CoreField>> & { auditorNotes?: string };

export class AuditError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

function objectInput(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new AuditError(400, 'Expected a JSON object.');
  }
  return value as Record<string, unknown>;
}

function knownFields(input: Record<string, unknown>, allowed: Set<string>): void {
  const unknown = Object.keys(input).find((key) => !allowed.has(key));
  if (unknown) throw new AuditError(400, `Unknown field: ${unknown}`);
}

function text(value: unknown, name: string, max = 500): string {
  if (typeof value !== 'string' || !value.trim() || value.length > max) {
    throw new AuditError(400, `${name} must be a non-empty string under ${max} characters.`);
  }
  return value.trim();
}

function amount(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    throw new AuditError(400, 'monetaryImpact must be a non-negative number.');
  }
  return value;
}

function entryId(value: string): ObjectId {
  if (!ObjectId.isValid(value)) throw new AuditError(400, 'Invalid audit entry ID.');
  return new ObjectId(value);
}

export class AuditService {
  constructor(private readonly repository: AuditStore) {}

  list(): Promise<AuditEntry[]> {
    return this.repository.list();
  }

  create(rawInput: unknown): Promise<AuditEntry> {
    const input = objectInput(rawInput);
    knownFields(input, createFields);
    if (input.timestamp !== undefined && typeof input.timestamp !== 'string') {
      throw new AuditError(400, 'timestamp must be a date string.');
    }
    const timestamp = input.timestamp ? new Date(input.timestamp) : new Date();
    if (Number.isNaN(timestamp.getTime())) throw new AuditError(400, 'Invalid timestamp.');
    const now = new Date();

    const entry: NewAuditEntry = {
      timestamp,
      eventType: text(input.eventType ?? 'Control Execution', 'eventType', 100),
      evidenceId: text(input.evidenceId, 'evidenceId', 100),
      entityName: text(input.entityName, 'entityName', 200),
      description: text(input.description, 'description', 1000),
      monetaryImpact: amount(input.monetaryImpact),
      controlId: text(input.controlId, 'controlId', 100),
      actorUserId: text(input.actorUserId, 'actorUserId', 100),
      evidenceVersion: 1,
      aiMetadata: {
        status: 'PENDING',
        riskScore: null,
        riskLevel: null,
        aiSummary: null,
        anomalyFlags: [],
        semanticVector: [],
        auditorNotes: '',
      },
      enrichmentJob: { state: 'UNPUBLISHED', requestedAt: now },
      created: now,
      updated: now,
    };
    return this.repository.create(entry);
  }

  async update(rawId: string, rawInput: unknown): Promise<AuditEntry> {
    const id = entryId(rawId);
    const input = objectInput(rawInput);
    knownFields(input, updateFields);
    if (!Object.keys(input).length) throw new AuditError(400, 'No fields to update.');

    const changes: Changes = {};
    if ('monetaryImpact' in input) changes.monetaryImpact = amount(input.monetaryImpact);
    if ('description' in input) changes.description = text(input.description, 'description', 1000);
    if ('controlId' in input) changes.controlId = text(input.controlId, 'controlId', 100);
    if ('auditorNotes' in input) {
      if (typeof input.auditorNotes !== 'string' || input.auditorNotes.length > 2000) {
        throw new AuditError(400, 'auditorNotes must be a string under 2000 characters.');
      }
      changes.auditorNotes = input.auditorNotes;
    }

    for (let attempt = 0; attempt < 3; attempt += 1) {
      const current = await this.repository.findById(id);
      if (!current) throw new AuditError(404, 'Audit entry not found.');

      const coreChanges: Partial<Pick<AuditEntry, CoreField>> = {};
      if (
        changes.monetaryImpact !== undefined &&
        changes.monetaryImpact !== current.monetaryImpact
      ) {
        coreChanges.monetaryImpact = changes.monetaryImpact;
      }
      if (changes.description !== undefined && changes.description !== current.description) {
        coreChanges.description = changes.description;
      }
      if (changes.controlId !== undefined && changes.controlId !== current.controlId) {
        coreChanges.controlId = changes.controlId;
      }
      const noteChanged =
        changes.auditorNotes !== undefined &&
        changes.auditorNotes !== current.aiMetadata.auditorNotes;
      const coreChanged = Object.keys(coreChanges).length > 0;
      if (!coreChanged && !noteChanged) return current;

      const now = new Date();
      if (!coreChanged) {
        const auditorNotes = changes.auditorNotes;
        if (auditorNotes === undefined) return current;
        const updated = await this.repository.updateNotes(id, {
          updated: now,
          'aiMetadata.auditorNotes': auditorNotes,
        });
        if (updated) return updated;
        throw new AuditError(404, 'Audit entry not found.');
      }

      const set: CoreUpdateSet = {
        ...coreChanges,
        updated: now,
        'aiMetadata.status': 'PENDING',
        'aiMetadata.riskScore': null,
        'aiMetadata.riskLevel': null,
        'aiMetadata.aiSummary': null,
        'aiMetadata.anomalyFlags': [],
        'aiMetadata.semanticVector': [],
        'enrichmentJob.state': 'UNPUBLISHED',
        'enrichmentJob.requestedAt': now,
      };
      if (noteChanged) set['aiMetadata.auditorNotes'] = changes.auditorNotes;
      const updated = await this.repository.updateCore(id, current.evidenceVersion, set);
      if (updated) return updated;
    }
    throw new AuditError(409, 'Entry changed while saving. Please try again.');
  }

  async findSimilar(rawId: string): Promise<SimilarMatch[]> {
    const id = entryId(rawId);
    const source = await this.repository.findById(id);
    if (!source) throw new AuditError(404, 'Audit entry not found.');
    if (
      source.aiMetadata.status !== 'COMPLETED' ||
      !validVector(source.aiMetadata.semanticVector)
    ) {
      throw new AuditError(409, 'Similarity is available after enrichment completes.');
    }
    return rankSimilarExceptions(
      source.aiMetadata.semanticVector,
      this.repository.findSimilarCandidates(source),
    );
  }
}
