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
        },
      };
      return entry;
    },
    async findSimilarCandidates() {
      return [];
    },
  };
  return { service: new AuditService(repository), id: entry._id.toHexString() };
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
