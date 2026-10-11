import type { AuditEntry } from '../types.js';
import type { AIProvider, ProviderResult } from './AIProvider.js';

export class MockAIProvider implements AIProvider {
  constructor(private readonly delayMs = 400) {}

  async generate(entry: AuditEntry): Promise<ProviderResult> {
    await new Promise((resolve) => setTimeout(resolve, this.delayMs));
    const description = entry.description.toLowerCase();
    const flags: string[] = [];
    if (entry.monetaryImpact >= 50000) flags.push('MONETARY_THRESHOLD_EXCEEDED');
    if (/override|bypass/.test(description)) flags.push('APPROVAL_OVERRIDE');
    if (/duplicate/.test(description)) flags.push('POSSIBLE_DUPLICATE');
    if (/urgent|outside.*approval/.test(description)) flags.push('UNUSUAL_APPROVAL');
    const riskScore = Math.min(
      100,
      20 + flags.length * 20 + (entry.monetaryImpact >= 100000 ? 10 : 0),
    );
    return {
      riskScore,
      aiSummary: `${entry.entityName}: ${entry.description.slice(0, 180)}. Review the supporting approval and transaction evidence.`,
      anomalyFlags: flags,
    };
  }
}
