import type { AuditEntry } from '../types.js';
import { enrichmentSchema, parseProviderResult, promptFor } from './AIProvider.js';
import type { AIProvider, ProviderResult } from './AIProvider.js';

export class OllamaProvider implements AIProvider {
  constructor(
    private readonly model: string,
    private readonly baseUrl: string,
    private readonly timeoutMs: number,
  ) {}

  async generate(entry: AuditEntry): Promise<ProviderResult> {
    const response = await fetch(new URL('/api/chat', this.baseUrl), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: this.model,
        stream: false,
        format: enrichmentSchema,
        options: { temperature: 0 },
        messages: [{ role: 'user', content: promptFor(entry) }],
      }),
      signal: AbortSignal.timeout(this.timeoutMs),
    });
    if (!response.ok) throw new Error(`Ollama request failed (${response.status}).`);
    const body = (await response.json()) as { message?: { content?: unknown } };
    return parseProviderResult(body.message?.content);
  }
}
