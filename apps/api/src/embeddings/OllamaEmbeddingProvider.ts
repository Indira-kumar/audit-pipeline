import { validEmbedding } from './EmbeddingProvider.js';
import type { EmbeddingProvider } from './EmbeddingProvider.js';

export class OllamaEmbeddingProvider implements EmbeddingProvider {
  constructor(
    readonly model: string,
    private readonly baseUrl: string,
    private readonly timeoutMs: number,
  ) {}

  async embed(texts: string[]): Promise<number[][]> {
    const response = await fetch(new URL('/api/embed', this.baseUrl), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: this.model, input: texts, truncate: false }),
      signal: AbortSignal.timeout(this.timeoutMs),
    });
    if (!response.ok) {
      const body = (await response.json().catch(() => ({}))) as { error?: unknown };
      const detail = typeof body.error === 'string' ? ` ${body.error.slice(0, 200)}.` : '';
      throw new Error(`Ollama embedding request failed (${response.status}).${detail}`);
    }
    const body = (await response.json()) as { embeddings?: unknown };
    const vectors = body.embeddings;
    const dimensions = Array.isArray(vectors) && Array.isArray(vectors[0]) ? vectors[0].length : 0;
    if (
      !Array.isArray(vectors) ||
      !dimensions ||
      vectors.length !== texts.length ||
      !vectors.every(validEmbedding) ||
      !vectors.every((vector) => vector.length === dimensions)
    ) {
      throw new Error('Ollama returned invalid embeddings.');
    }
    return vectors as number[][];
  }
}
