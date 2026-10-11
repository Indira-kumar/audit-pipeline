import type { AuditEntry, SearchEmbedding } from '../types.js';
import { validEmbedding } from './EmbeddingProvider.js';
import type { EmbeddingProvider } from './EmbeddingProvider.js';
import { MockEmbeddingProvider } from './MockEmbeddingProvider.js';
import { OllamaEmbeddingProvider } from './OllamaEmbeddingProvider.js';

const maxChunkChars = 400;
const overlapWords = 12;

export function evidenceChunks(entry: AuditEntry): string[] {
  const words = entry.description.trim().split(/\s+/);
  const context = [
    `Event: ${entry.eventType}`,
    `Entity: ${entry.entityName}`,
    `Control: ${entry.controlId}`,
    `Amount USD: ${entry.monetaryImpact}`,
  ].join('\n');
  const chunks: string[] = [];
  let start = 0;
  while (start < words.length) {
    let end = start;
    let length = 0;
    while (
      end < words.length &&
      (end === start || length + words[end]!.length + 1 <= maxChunkChars)
    ) {
      length += words[end]!.length + 1;
      end += 1;
    }
    chunks.push(`${context}\nDescription: ${words.slice(start, end).join(' ')}`);
    if (end === words.length) break;
    start = end - Math.min(overlapWords, Math.floor((end - start) / 4));
  }
  return chunks;
}

export function createEmbeddingProvider(): EmbeddingProvider {
  const provider =
    process.env.EMBEDDING_PROVIDER ?? (process.env.AI_PROVIDER === 'mock' ? 'mock' : 'ollama');
  if (provider === 'mock') return new MockEmbeddingProvider();
  if (provider === 'ollama') {
    const timeoutMs = Number(process.env.AI_TIMEOUT_MS ?? 120000);
    if (!Number.isFinite(timeoutMs) || timeoutMs < 1000) throw new Error('Invalid AI_TIMEOUT_MS.');
    return new OllamaEmbeddingProvider(
      process.env.EMBEDDING_MODEL ?? 'embeddinggemma',
      process.env.OLLAMA_URL ?? 'http://127.0.0.1:11434',
      timeoutMs,
    );
  }
  throw new Error(`Unsupported EMBEDDING_PROVIDER: ${provider}`);
}

export class EmbeddingService {
  constructor(private readonly provider: EmbeddingProvider) {}

  get model(): string {
    return this.provider.model;
  }

  async embed(entry: AuditEntry): Promise<SearchEmbedding> {
    const texts = evidenceChunks(entry);
    const vectors = await this.provider.embed(texts);
    const dimensions = vectors[0]?.length;
    if (
      vectors.length !== texts.length ||
      !dimensions ||
      !vectors.every(validEmbedding) ||
      !vectors.every((vector) => vector.length === dimensions)
    ) {
      throw new Error('Embedding provider returned invalid vectors.');
    }
    return {
      model: this.provider.model,
      chunks: texts.map((text, index) => ({ text, vector: vectors[index]! })),
    };
  }
}
