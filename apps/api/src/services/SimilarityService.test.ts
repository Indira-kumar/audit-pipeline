import assert from 'node:assert/strict';
import test from 'node:test';
import { ObjectId } from 'mongodb';
import type { SimilarityCandidate } from '../types.js';
import { rankSimilarExceptions, validVector } from './SimilarityService.js';

const vector = (first: number, second = 0): number[] => [first, second, 0, 0, 0, 0, 0, 0];

function candidate(id: string, timestamp: string, semanticVector: number[]): SimilarityCandidate {
  return {
    _id: new ObjectId(id),
    evidenceId: id,
    entityName: 'Vendor',
    description: 'Historical exception',
    timestamp: new Date(timestamp),
    aiMetadata: { riskScore: 80, semanticVector },
  };
}

async function* stream(entries: SimilarityCandidate[]): AsyncIterable<SimilarityCandidate> {
  for (const entry of entries) yield entry;
}

test('returns three highest cosine matches, with recent cases first on ties', async () => {
  const entries = [
    candidate('000000000000000000000001', '2026-01-01', vector(0, 1)),
    candidate('000000000000000000000002', '2026-01-02', vector(1)),
    candidate('000000000000000000000003', '2026-01-03', vector(0.9, 0.1)),
    candidate('000000000000000000000004', '2026-01-04', vector(1)),
    candidate('000000000000000000000005', '2026-01-05', vector(0.8, 0.2)),
    candidate('000000000000000000000006', '2026-01-06', vector(0)),
  ];
  const result = await rankSimilarExceptions(vector(1), stream(entries));
  assert.deepEqual(
    result.map((item) => item.evidenceId),
    ['000000000000000000000004', '000000000000000000000002', '000000000000000000000003'],
  );
  assert.deepEqual(
    result.map((item) => item.similarityScore),
    [1, 1, 0.994],
  );
});

test('accepts only finite, nonzero eight-dimensional vectors', () => {
  assert.equal(validVector(vector(1)), true);
  assert.equal(validVector([1, 2]), false);
  assert.equal(validVector(vector(0)), false);
  assert.equal(validVector(vector(Number.NaN)), false);
  assert.equal(validVector(vector(Number.MAX_VALUE, Number.MAX_VALUE)), false);
});
