import type { AuditEntry } from '../types.js';

export interface ProviderResult {
  riskScore: number;
  aiSummary: string;
  anomalyFlags: string[];
}

export interface AIProvider {
  generate(entry: AuditEntry): Promise<ProviderResult>;
}

export const enrichmentSchema = {
  type: 'object',
  properties: {
    riskScore: { type: 'integer', minimum: 0, maximum: 100 },
    aiSummary: { type: 'string' },
    anomalyFlags: { type: 'array', items: { type: 'string' } },
  },
  required: ['riskScore', 'aiSummary', 'anomalyFlags'],
  additionalProperties: false,
} as const;

export function parseProviderResult(content: unknown): ProviderResult {
  const value: unknown = typeof content === 'string' ? JSON.parse(content) : content;
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('AI provider returned an invalid object.');
  }
  const result = value as Record<string, unknown>;
  if (
    !Number.isInteger(result.riskScore) ||
    (result.riskScore as number) < 0 ||
    (result.riskScore as number) > 100 ||
    typeof result.aiSummary !== 'string' ||
    !result.aiSummary.trim() ||
    result.aiSummary.length > 600 ||
    !Array.isArray(result.anomalyFlags) ||
    result.anomalyFlags.length > 10 ||
    !result.anomalyFlags.every((flag) => typeof flag === 'string' && flag.length <= 80)
  ) {
    throw new Error('AI provider returned invalid enrichment fields.');
  }
  return {
    riskScore: result.riskScore as number,
    aiSummary: result.aiSummary.trim(),
    anomalyFlags: [...new Set(result.anomalyFlags as string[])],
  };
}

export function promptFor(entry: AuditEntry): string {
  return [
    'Assess this audit evidence for financial and control risk.',
    'Return only JSON with riskScore (integer 0-100), aiSummary (one concise sentence), and anomalyFlags (short uppercase labels).',
    'Use only the supplied evidence. A large amount alone is not proof of misconduct.',
    JSON.stringify({
      eventType: entry.eventType,
      entityName: entry.entityName,
      description: entry.description,
      monetaryImpact: entry.monetaryImpact,
      controlId: entry.controlId,
    }),
  ].join('\n');
}
