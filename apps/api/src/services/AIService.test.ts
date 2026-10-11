import assert from 'node:assert/strict';
import test from 'node:test';
import { ObjectId } from 'mongodb';
import { parseProviderResult } from '../providers/AIProvider.js';
import type { AuditEntry } from '../types.js';
import { AIService } from './AIService.js';

const entry: AuditEntry = {
  _id: new ObjectId(),
  tenantId: new ObjectId(),
  timestamp: new Date(),
  eventType: 'Control Execution',
  evidenceId: 'TEST-1',
  entityName: 'Vendor',
  description: 'Manual approval override for a vendor invoice',
  monetaryImpact: 90000,
  controlId: 'CTRL-FIN-302',
  actorUserId: 'user_test',
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
  enrichmentJob: { state: 'UNPUBLISHED', requestedAt: new Date() },
  created: new Date(),
  updated: new Date(),
};

test('provider output becomes a scored result and an eight-dimensional vector', async () => {
  const ai = new AIService({
    async generate() {
      return {
        riskScore: 84,
        aiSummary: 'Approval override needs review.',
        anomalyFlags: ['OVERRIDE'],
      };
    },
  });
  const result = await ai.enrich(entry);
  assert.equal(result.riskLevel, 'HIGH');
  assert.equal(result.semanticVector.length, 8);
  assert.equal(result.semanticVector[0], 1);
  assert.equal(result.semanticVector[1], 1);
});

test('provider data is validated before it can be saved', () => {
  assert.throws(() => parseProviderResult('{"riskScore":101,"aiSummary":"x","anomalyFlags":[]}'));
  assert.throws(() => parseProviderResult('{"riskScore":20,"aiSummary":"","anomalyFlags":[]}'));
  assert.deepEqual(
    parseProviderResult('{"riskScore":20,"aiSummary":"Ok","anomalyFlags":["A","A"]}'),
    {
      riskScore: 20,
      aiSummary: 'Ok',
      anomalyFlags: ['A'],
    },
  );
});
