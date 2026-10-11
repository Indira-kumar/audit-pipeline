import assert from 'node:assert/strict';
import test from 'node:test';
import { ObjectId } from 'mongodb';
import { EmbeddingService, evidenceChunks } from '../embeddings/EmbeddingService.js';
import { MockEmbeddingProvider } from '../embeddings/MockEmbeddingProvider.js';
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
  const ai = new AIService(
    {
      async generate() {
        return {
          riskScore: 84,
          aiSummary: 'Approval override needs review.',
          anomalyFlags: ['OVERRIDE'],
        };
      },
    },
    new EmbeddingService(new MockEmbeddingProvider()),
  );
  const result = await ai.enrich(entry);
  assert.equal(result.riskLevel, 'HIGH');
  assert.equal(result.semanticVector.length, 8);
  assert.equal(result.semanticVector[0], 1);
  assert.equal(result.semanticVector[1], 1);
  assert.equal(result.searchEmbedding.model, 'mock-hash-v1');
  assert.equal(result.searchEmbedding.chunks[0]?.vector.length, 32);
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

test('long descriptions are chunked with shared context and overlapping text', () => {
  const longEntry = {
    ...entry,
    description: Array.from({ length: 140 }, (_, index) => `invoice${index}`).join(' '),
  };
  const chunks = evidenceChunks(longEntry);
  assert.ok(chunks.length > 1);
  assert.ok(chunks.every((chunk) => chunk.includes('Control: CTRL-FIN-302')));
  assert.ok(chunks.every((chunk) => chunk.includes('Amount USD: 90000')));
  assert.ok(chunks[0]!.includes('invoice0'));
  assert.ok(chunks.at(-1)!.includes('invoice139'));
  const firstWords = chunks[0]!.split('Description: ')[1]!.split(' ');
  assert.ok(chunks[1]!.includes(firstWords.at(-1)!));
});
