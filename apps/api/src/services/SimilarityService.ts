import { validEmbedding } from '../embeddings/EmbeddingProvider.js';
import type { AuditEntry, SearchEmbedding, SimilarityCandidate, SimilarMatch } from '../types.js';

const resultLimit = 3;
const stopwords = new Set(['and', 'for', 'the', 'with', 'from', 'this', 'that', 'was', 'are']);

export function validSearchEmbedding(value: unknown): value is SearchEmbedding {
  if (!value || typeof value !== 'object') return false;
  const index = value as Partial<SearchEmbedding>;
  if (typeof index.model !== 'string' || !index.model || !Array.isArray(index.chunks)) return false;
  const dimensions = index.chunks[0]?.vector?.length;
  return (
    index.chunks.length > 0 &&
    typeof dimensions === 'number' &&
    index.chunks.every(
      (chunk) =>
        chunk !== null &&
        typeof chunk === 'object' &&
        typeof chunk.text === 'string' &&
        chunk.text.length > 0 &&
        validEmbedding(chunk.vector) &&
        chunk.vector.length === dimensions,
    )
  );
}

function cosine(left: number[], right: number[]): number {
  const dot = left.reduce((sum, part, index) => sum + part * right[index]!, 0);
  return Math.max(-1, Math.min(1, dot / (Math.hypot(...left) * Math.hypot(...right))));
}

function keywords(description: string): Set<string> {
  return new Set(
    (description.toLowerCase().match(/[a-z0-9]+/g) ?? []).filter(
      (token) => token.length >= 3 && !stopwords.has(token),
    ),
  );
}

function lexicalScore(source: AuditEntry, candidate: SimilarityCandidate): number {
  const left = keywords(source.description);
  const right = keywords(candidate.description);
  const union = new Set([...left, ...right]);
  const overlap = union.size
    ? [...left].filter((token) => right.has(token)).length / union.size
    : 0;
  return 0.8 * overlap + 0.2 * Number(source.controlId === candidate.controlId);
}

interface RankedCandidate {
  entry: SimilarityCandidate;
  score: number;
  semantic: number;
  keyword: number;
}

function compareCandidates(left: RankedCandidate, right: RankedCandidate): number {
  return (
    right.score - left.score ||
    right.entry.timestamp.getTime() - left.entry.timestamp.getTime() ||
    left.entry._id.toHexString().localeCompare(right.entry._id.toHexString())
  );
}

export async function rankSimilarExceptions(
  source: AuditEntry,
  candidates: AsyncIterable<SimilarityCandidate>,
): Promise<SimilarMatch[]> {
  const sourceIndex = source.aiMetadata.searchEmbedding;
  if (!validSearchEmbedding(sourceIndex)) throw new Error('Source search embedding is invalid.');
  const dimensions = sourceIndex.chunks[0]!.vector.length;
  const best: RankedCandidate[] = [];

  for await (const entry of candidates) {
    const index = entry.aiMetadata.searchEmbedding;
    if (
      !validSearchEmbedding(index) ||
      index.model !== sourceIndex.model ||
      index.chunks[0]!.vector.length !== dimensions
    ) {
      continue;
    }
    const semantic = Math.max(
      0,
      ...sourceIndex.chunks.flatMap((left) =>
        index.chunks.map((right) => cosine(left.vector, right.vector)),
      ),
    );
    const keyword = lexicalScore(source, entry);
    const score = 0.75 * semantic + 0.25 * keyword;
    best.push({ entry, score, semantic, keyword });
    best.sort(compareCandidates);
    if (best.length > resultLimit) best.pop();
  }

  return best.map(({ entry, score, semantic, keyword }) => ({
    id: entry._id,
    evidenceId: entry.evidenceId,
    entityName: entry.entityName,
    description: entry.description,
    riskScore: entry.aiMetadata.riskScore,
    similarityScore: Number(score.toFixed(3)),
    semanticScore: Number(semantic.toFixed(3)),
    keywordScore: Number(keyword.toFixed(3)),
  }));
}
