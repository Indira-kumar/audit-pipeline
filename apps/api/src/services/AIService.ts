import type { AuditEntry, EnrichmentResult } from '../types.js';

export class AIService {
  async enrich(_entry: AuditEntry): Promise<EnrichmentResult> {
    // A later increment will return risk, summary, flags, and an 8D vector.
    throw new Error('AI enrichment is part of the next increment.');
  }
}
