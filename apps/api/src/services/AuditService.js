import { ObjectId } from 'mongodb';

const coreFields = ['monetaryImpact', 'description', 'controlId'];
const createFields = new Set([
  'timestamp', 'eventType', 'evidenceId', 'entityName',
  'description', 'monetaryImpact', 'controlId', 'actorUserId',
]);
const updateFields = new Set([...coreFields, 'auditorNotes']);

export class AuditError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function objectInput(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new AuditError(400, 'Expected a JSON object.');
  }
  return value;
}

function knownFields(input, allowed) {
  const unknown = Object.keys(input).filter((key) => !allowed.has(key));
  if (unknown.length) throw new AuditError(400, `Unknown field: ${unknown[0]}`);
}

function text(value, name, max = 500) {
  if (typeof value !== 'string' || !value.trim() || value.length > max) {
    throw new AuditError(400, `${name} must be a non-empty string under ${max} characters.`);
  }
  return value.trim();
}

function amount(value) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    throw new AuditError(400, 'monetaryImpact must be a non-negative number.');
  }
  return value;
}

function entryId(value) {
  if (!ObjectId.isValid(value)) throw new AuditError(400, 'Invalid audit entry ID.');
  return new ObjectId(value);
}

function cosineSimilarity(left, right) {
  if (left.length !== 8 || right.length !== 8) return null;
  const dot = left.reduce((sum, value, index) => sum + value * right[index], 0);
  const leftNorm = Math.hypot(...left);
  const rightNorm = Math.hypot(...right);
  return leftNorm && rightNorm ? dot / (leftNorm * rightNorm) : null;
}

export class AuditService {
  constructor(repository) {
    this.repository = repository;
  }

  async list() {
    return this.repository.list();
  }

  async create(rawInput) {
    const input = objectInput(rawInput);
    knownFields(input, createFields);
    const timestamp = input.timestamp ? new Date(input.timestamp) : new Date();
    if (Number.isNaN(timestamp.getTime())) throw new AuditError(400, 'Invalid timestamp.');
    const now = new Date();

    return this.repository.create({
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
        status: 'PENDING', riskScore: null, riskLevel: null,
        aiSummary: null, anomalyFlags: [], semanticVector: [], auditorNotes: '',
      },
      enrichmentJob: { state: 'UNPUBLISHED', requestedAt: now },
      created: now,
      updated: now,
    });
  }

  async update(rawId, rawInput) {
    const id = entryId(rawId);
    const input = objectInput(rawInput);
    knownFields(input, updateFields);
    if (!Object.keys(input).length) throw new AuditError(400, 'No fields to update.');

    const changes = {};
    for (const field of coreFields) {
      if (!(field in input)) continue;
      changes[field] = field === 'monetaryImpact'
        ? amount(input[field])
        : text(input[field], field, field === 'description' ? 1000 : 100);
    }
    if ('auditorNotes' in input) {
      if (typeof input.auditorNotes !== 'string' || input.auditorNotes.length > 2000) {
        throw new AuditError(400, 'auditorNotes must be a string under 2000 characters.');
      }
      changes.auditorNotes = input.auditorNotes;
    }

    for (let attempt = 0; attempt < 3; attempt += 1) {
      const current = await this.repository.findById(id);
      if (!current) throw new AuditError(404, 'Audit entry not found.');
      const set = {};
      for (const field of coreFields) {
        if (field in changes && changes[field] !== current[field]) set[field] = changes[field];
      }
      if ('auditorNotes' in changes && changes.auditorNotes !== current.aiMetadata.auditorNotes) {
        set['aiMetadata.auditorNotes'] = changes.auditorNotes;
      }
      if (!Object.keys(set).length) return current;

      const coreChanged = coreFields.some((field) => field in set);
      const now = new Date();
      set.updated = now;
      if (!coreChanged) {
        return this.repository.updateNotes(id, set);
      }

      Object.assign(set, {
        'aiMetadata.status': 'PENDING',
        'aiMetadata.riskScore': null,
        'aiMetadata.riskLevel': null,
        'aiMetadata.aiSummary': null,
        'aiMetadata.anomalyFlags': [],
        'aiMetadata.semanticVector': [],
        'enrichmentJob.state': 'UNPUBLISHED',
        'enrichmentJob.requestedAt': now,
      });
      const updated = await this.repository.updateCore(id, current.evidenceVersion, set);
      if (updated) return updated;
    }
    throw new AuditError(409, 'Entry changed while saving. Please try again.');
  }

  async findSimilar(rawId) {
    const id = entryId(rawId);
    const source = await this.repository.findById(id);
    if (!source) throw new AuditError(404, 'Audit entry not found.');
    if (source.aiMetadata.status !== 'COMPLETED' || source.aiMetadata.semanticVector.length !== 8) {
      throw new AuditError(409, 'Similarity is available after enrichment completes.');
    }

    const candidates = await this.repository.findSimilarCandidates(source);
    return candidates
      .map((entry) => ({
        entry,
        score: cosineSimilarity(source.aiMetadata.semanticVector, entry.aiMetadata.semanticVector),
      }))
      .filter(({ score }) => score !== null)
      .sort((a, b) => b.score - a.score)
      .slice(0, 3)
      .map(({ entry, score }) => ({
        id: entry._id,
        evidenceId: entry.evidenceId,
        entityName: entry.entityName,
        description: entry.description,
        riskScore: entry.aiMetadata.riskScore,
        similarityScore: Number(score.toFixed(3)),
      }));
  }
}
