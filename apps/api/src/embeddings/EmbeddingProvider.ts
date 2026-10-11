export interface EmbeddingProvider {
  readonly model: string;
  embed(texts: string[]): Promise<number[][]>;
}

export function validEmbedding(vector: unknown): vector is number[] {
  if (!Array.isArray(vector) || !vector.length) return false;
  if (!vector.every((part) => typeof part === 'number' && Number.isFinite(part))) return false;
  const norm = Math.hypot(...vector);
  return Number.isFinite(norm) && norm > 0;
}
