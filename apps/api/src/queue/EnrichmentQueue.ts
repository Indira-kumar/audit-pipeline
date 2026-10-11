import { Queue } from 'bullmq';
import type { Redis } from 'ioredis';
import type { AuditEntry } from '../types.js';

export const enrichmentQueueName = 'audit-enrichment';

export interface EnrichmentJob {
  entryId: string;
  version: number;
}

export interface JobPublisher {
  add(entry: AuditEntry): Promise<void>;
}

export class EnrichmentQueue implements JobPublisher {
  private readonly queue: Queue<EnrichmentJob>;

  constructor(connection: Redis) {
    this.queue = new Queue<EnrichmentJob>(enrichmentQueueName, { connection });
  }

  async add(entry: AuditEntry): Promise<void> {
    const entryId = entry._id.toHexString();
    await this.queue.add(
      'enrich',
      { entryId, version: entry.evidenceVersion },
      {
        jobId: `${entryId}-v${entry.evidenceVersion}`,
        attempts: 3,
        backoff: { type: 'exponential', delay: 1000 },
        removeOnComplete: { age: 86400, count: 1000 },
        removeOnFail: { age: 604800, count: 1000 },
      },
    );
  }

  async close(): Promise<void> {
    await this.queue.close();
  }
}
