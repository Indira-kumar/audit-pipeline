import assert from 'node:assert/strict';
import test from 'node:test';
import { ObjectId } from 'mongodb';
import { AuditService } from './AuditService.js';
import type { AuditEntry, AuditStore } from '../types.js';

function fixture() {
  let entry: AuditEntry = {
    _id: new ObjectId(),
    tenantId: new ObjectId(),
    timestamp: new Date(),
    eventType: 'Control Execution',
    evidenceId: 'EVID-TEST',
    entityName: 'Vendor',
    description: 'Invoice approved',
    monetaryImpact: 65000,
    controlId: 'CTRL-1',
    actorUserId: 'user_test',
    evidenceVersion: 1,
    aiMetadata: {
      status: 'COMPLETED',
      riskScore: 82,
      riskLevel: 'HIGH',
      aiSummary: 'Approval exception',
      anomalyFlags: ['MANUAL_OVERRIDE'],
      semanticVector: [1, 0, 0, 0, 0, 0, 0, 0],
      auditorNotes: '',
    },
    enrichmentJob: { state: 'DONE', requestedAt: new Date() },
    created: new Date(),
    updated: new Date(),
  };
  const repository: AuditStore = {
    async list() {
      return [entry];
    },
    async create(input) {
      entry = { ...input, _id: new ObjectId(), tenantId: entry.tenantId };
      return entry;
    },
    async findById() {
      return entry;
    },
    async updateNotes(_id, set) {
      entry = {
        ...entry,
        updated: set.updated,
        aiMetadata: { ...entry.aiMetadata, auditorNotes: set['aiMetadata.auditorNotes'] },
      };
      return entry;
    },
    async updateCore(_id, version, set) {
      if (version !== entry.evidenceVersion) return null;
      entry = {
        ...entry,
        description: set.description ?? entry.description,
        monetaryImpact: set.monetaryImpact ?? entry.monetaryImpact,
        controlId: set.controlId ?? entry.controlId,
        updated: set.updated,
        evidenceVersion: version + 1,
        aiMetadata: {
          ...entry.aiMetadata,
          status: set['aiMetadata.status'],
          riskScore: set['aiMetadata.riskScore'],
          riskLevel: set['aiMetadata.riskLevel'],
          aiSummary: set['aiMetadata.aiSummary'],
          anomalyFlags: set['aiMetadata.anomalyFlags'],
          semanticVector: set['aiMetadata.semanticVector'],
          auditorNotes: set['aiMetadata.auditorNotes'] ?? entry.aiMetadata.auditorNotes,
        },
        enrichmentJob: {
          state: set['enrichmentJob.state'],
          requestedAt: set['enrichmentJob.requestedAt'],
          requestId: set['enrichmentJob.requestId'],
        },
      };
      return entry;
    },
    async retryFailed(_id, version) {
      if (entry.aiMetadata.status !== 'FAILED' || version !== entry.evidenceVersion) return null;
      entry = {
        ...entry,
        aiMetadata: {
          ...entry.aiMetadata,
          status: 'PENDING',
          riskScore: null,
          riskLevel: null,
          aiSummary: null,
          anomalyFlags: [],
          semanticVector: [],
        },
        enrichmentJob: { state: 'UNPUBLISHED', requestedAt: new Date(), requestId: 'retry-1' },
      };
      return entry;
    },
    async *findSimilarCandidates() {},
  };
  return {
    service: new AuditService(repository),
    id: entry._id.toHexString(),
    fail() {
      entry = {
        ...entry,
        aiMetadata: { ...entry.aiMetadata, status: 'FAILED' },
        enrichmentJob: { state: 'FAILED', requestedAt: new Date(), lastError: 'Model missing' },
      };
    },
  };
}

test('auditor note update keeps completed AI results and does not queue a job', async () => {
  const { service, id } = fixture();
  const updated = await service.update(id, { auditorNotes: 'Reviewed' });
  assert.equal(updated.aiMetadata.auditorNotes, 'Reviewed');
  assert.equal(updated.aiMetadata.status, 'COMPLETED');
  assert.equal(updated.enrichmentJob.state, 'DONE');
  assert.equal(updated.evidenceVersion, 1);
});

test('core update invalidates AI results and preserves the auditor note', async () => {
  const { service, id } = fixture();
  await service.update(id, { auditorNotes: 'Keep this note' });
  const updated = await service.update(id, { monetaryImpact: 90000 });
  assert.equal(updated.monetaryImpact, 90000);
  assert.equal(updated.aiMetadata.status, 'PENDING');
  assert.equal(updated.aiMetadata.auditorNotes, 'Keep this note');
  assert.deepEqual(updated.aiMetadata.semanticVector, []);
  assert.equal(updated.enrichmentJob.state, 'UNPUBLISHED');
  assert.equal(updated.evidenceVersion, 2);
});

test('failed enrichment can be retried without changing evidence or auditor note', async () => {
  const { service, id, fail } = fixture();
  await assert.rejects(service.retryFailed(id), { status: 409 });
  await service.update(id, { auditorNotes: 'Keep this note' });
  fail();
  const retried = await service.retryFailed(id);
  assert.equal(retried.aiMetadata.status, 'PENDING');
  assert.equal(retried.enrichmentJob.state, 'UNPUBLISHED');
  assert.equal(retried.enrichmentJob.requestId, 'retry-1');
  assert.equal(retried.evidenceVersion, 1);
  assert.equal(retried.aiMetadata.auditorNotes, 'Keep this note');
});
