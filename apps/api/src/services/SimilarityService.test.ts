import assert from 'node:assert/strict';
import test from 'node:test';
import { ObjectId } from 'mongodb';
import type { AuditEntry, SimilarityCandidate } from '../types.js';
import { rankSimilarExceptions, validSearchEmbedding } from './SimilarityService.js';

const index = (vector: number[], model = 'embeddinggemma') => ({
  model,
  chunks: [{ text: 'Audit evidence', vector }],
});

const source = {
  description: 'Manual approval override for a vendor invoice',
  controlId: 'CTRL-FIN-302',
  aiMetadata: { searchEmbedding: index([1, 0, 0]) },
} as AuditEntry;

function candidate(
  id: string,
  timestamp: string,
  vector: number[],
  description: string,
  controlId = 'CTRL-OTHER',
  model = 'embeddinggemma',
): SimilarityCandidate {
  return {
    _id: new ObjectId(id),
    evidenceId: id,
    entityName: 'Vendor',
    description,
    controlId,
    timestamp: new Date(timestamp),
    aiMetadata: { riskScore: 80, searchEmbedding: index(vector, model) },
  };
}

async function* stream(entries: SimilarityCandidate[]): AsyncIterable<SimilarityCandidate> {
  for (const entry of entries) yield entry;
}

test('hybrid search returns three matching-model records and rewards keyword overlap', async () => {
  const entries = [
    candidate('000000000000000000000001', '2026-01-01', [1, 0, 0], 'Unrelated purchase'),
    candidate(
      '000000000000000000000002',
      '2026-01-02',
      [0.96, 0.28, 0],
      'Manual approval override for a vendor invoice',
      'CTRL-FIN-302',
    ),
    candidate('000000000000000000000003', '2026-01-03', [0, 1, 0], 'Other exception'),
    candidate('000000000000000000000004', '2026-01-04', [0.7, 0.7, 0], 'Other exception'),
    candidate(
      '000000000000000000000005',
      '2026-01-05',
      [1, 0, 0],
      'Wrong model',
      'CTRL-OTHER',
      'other',
    ),
  ];
  const result = await rankSimilarExceptions(source, stream(entries));
  assert.deepEqual(
    result.map((item) => item.evidenceId),
    ['000000000000000000000002', '000000000000000000000001', '000000000000000000000004'],
  );
  assert.equal(result[0]?.keywordScore, 1);
  assert.ok(result[0]!.semanticScore < result[1]!.semanticScore);
});

test('rejects empty, non-finite, and inconsistent stored embeddings', () => {
  assert.equal(validSearchEmbedding(index([1, 0, 0])), true);
  assert.equal(validSearchEmbedding(index([])), false);
  assert.equal(validSearchEmbedding(index([Number.NaN, 0])), false);
  assert.equal(validSearchEmbedding({ model: 'a', chunks: [] }), false);
  assert.equal(
    validSearchEmbedding({
      model: 'a',
      chunks: [
        { text: 'a', vector: [1, 0] },
        { text: 'b', vector: [1] },
      ],
    }),
    false,
  );
});
