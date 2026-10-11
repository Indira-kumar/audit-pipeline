import { EmbeddingService } from '../embeddings/EmbeddingService.js';
import type { AIProvider } from '../providers/AIProvider.js';
import { MockAIProvider } from '../providers/MockAIProvider.js';
import { OllamaProvider } from '../providers/OllamaProvider.js';
import { OpenRouterProvider } from '../providers/OpenRouterProvider.js';
import type { AuditEntry, EnrichmentResult, RiskLevel } from '../types.js';

function riskLevel(score: number): RiskLevel {
  return score >= 70 ? 'HIGH' : score >= 40 ? 'MEDIUM' : 'LOW';
}

// Eight explainable features satisfy the assessment's mock vector requirement.
function semanticVector(entry: AuditEntry): number[] {
  const description = entry.description.toLowerCase();
  return [
    /override|manual/.test(description) ? 1 : 0,
    /approv|bypass/.test(description) ? 1 : 0,
    /duplicate|repeat/.test(description) ? 1 : 0,
    /invoice|payable|adjustment/.test(description) ? 1 : 0,
    Math.min(entry.monetaryImpact / 100000, 1),
    /urgent|emergency/.test(description) ? 1 : 0,
    /vendor|payment|supplier/.test(description) ? 1 : 0,
    entry.controlId.startsWith('CTRL-FIN') ? 1 : 0.1,
  ];
}

export function createAIProvider(): AIProvider {
  const provider = process.env.AI_PROVIDER ?? (process.env.MOCK_AI === 'true' ? 'mock' : 'ollama');
  const timeoutMs = Number(process.env.AI_TIMEOUT_MS ?? 120000);
  if (!Number.isFinite(timeoutMs) || timeoutMs < 1000) throw new Error('Invalid AI_TIMEOUT_MS.');
  if (provider === 'mock') return new MockAIProvider();
  if (provider === 'ollama') {
    return new OllamaProvider(
      process.env.AI_MODEL ?? 'llama3.2',
      process.env.OLLAMA_URL ?? 'http://127.0.0.1:11434',
      timeoutMs,
    );
  }
  if (provider === 'openrouter') {
    const key = process.env.OPENROUTER_API_KEY;
    const model = process.env.AI_MODEL;
    if (!key || !model) throw new Error('OpenRouter needs OPENROUTER_API_KEY and AI_MODEL.');
    return new OpenRouterProvider(model, key, timeoutMs);
  }
  throw new Error(`Unsupported AI_PROVIDER: ${provider}`);
}

export class AIService {
  constructor(
    private readonly provider: AIProvider,
    private readonly embeddings: EmbeddingService,
  ) {}

  async enrich(entry: AuditEntry): Promise<EnrichmentResult> {
    const result = await this.provider.generate(entry);
    const searchEmbedding = await this.embeddings.embed(entry);
    return {
      ...result,
      riskLevel: riskLevel(result.riskScore),
      semanticVector: semanticVector(entry),
      searchEmbedding,
    };
  }
}
