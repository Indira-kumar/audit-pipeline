import type { EmbeddingProvider } from './EmbeddingProvider.js';

const dimensions = 32;

export class MockEmbeddingProvider implements EmbeddingProvider {
  readonly model = 'mock-hash-v1';

  async embed(texts: string[]): Promise<number[][]> {
    return texts.map((text) => {
      const vector = Array<number>(dimensions).fill(0);
      for (const token of text.toLowerCase().match(/[a-z0-9]+/g) ?? []) {
        let hash = 2166136261;
        for (const character of token) hash = Math.imul(hash ^ character.charCodeAt(0), 16777619);
        vector[(hash >>> 0) % dimensions]! += 1;
      }
      const norm = Math.hypot(...vector);
      if (norm === 0) throw new Error('Cannot embed empty audit evidence.');
      return vector.map((value) => value / norm);
    });
  }
}
