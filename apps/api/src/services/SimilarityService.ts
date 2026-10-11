import type { SimilarityCandidate, SimilarMatch } from '../types.js';

const dimensions = 8;
const resultLimit = 3;

export function validVector(value: unknown): value is number[] {
  if (!Array.isArray(value) || value.length !== dimensions) return false;
  if (!value.every((part) => typeof part === 'number' && Number.isFinite(part))) return false;
  const norm = Math.hypot(...value);
  return Number.isFinite(norm) && norm > 0;
}

interface RankedCandidate {
  entry: SimilarityCandidate;
  score: number;
}

function compareCandidates(left: RankedCandidate, right: RankedCandidate): number {
  return (
    right.score - left.score ||
    right.entry.timestamp.getTime() - left.entry.timestamp.getTime() ||
    left.entry._id.toHexString().localeCompare(right.entry._id.toHexString())
  );
}

export async function rankSimilarExceptions(
  sourceVector: number[],
  candidates: AsyncIterable<SimilarityCandidate>,
): Promise<SimilarMatch[]> {
  const sourceNorm = Math.hypot(...sourceVector);
  const best: RankedCandidate[] = [];

  for await (const entry of candidates) {
    const vector = entry.aiMetadata.semanticVector;
    if (!validVector(vector)) continue;

    const dot = sourceVector.reduce((sum, part, index) => sum + part * vector[index]!, 0);
    const score = Math.max(-1, Math.min(1, dot / (sourceNorm * Math.hypot(...vector))));
    best.push({ entry, score });
    best.sort(compareCandidates);
    if (best.length > resultLimit) best.pop();
  }

  return best.map(({ entry, score }) => ({
    id: entry._id,
    evidenceId: entry.evidenceId,
    entityName: entry.entityName,
    description: entry.description,
    riskScore: entry.aiMetadata.riskScore,
    similarityScore: Number(score.toFixed(3)),
  }));
}
