import type { AuditEntry } from '../types.js';
import { enrichmentSchema, parseProviderResult, promptFor } from './AIProvider.js';
import type { AIProvider, ProviderResult } from './AIProvider.js';

export class OpenRouterProvider implements AIProvider {
  constructor(
    private readonly model: string,
    private readonly apiKey: string,
    private readonly timeoutMs: number,
  ) {}

  async generate(entry: AuditEntry): Promise<ProviderResult> {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: this.model,
        stream: false,
        temperature: 0,
        messages: [{ role: 'user', content: promptFor(entry) }],
        response_format: {
          type: 'json_schema',
          json_schema: { name: 'audit_enrichment', strict: true, schema: enrichmentSchema },
        },
      }),
      signal: AbortSignal.timeout(this.timeoutMs),
    });
    if (!response.ok) throw new Error(`OpenRouter request failed (${response.status}).`);
    const body = (await response.json()) as {
      choices?: Array<{ message?: { content?: unknown } }>;
    };
    return parseProviderResult(body.choices?.[0]?.message?.content);
  }
}
