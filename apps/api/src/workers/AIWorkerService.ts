import { Worker } from 'bullmq';
import type { Job } from 'bullmq';
import type { Redis } from 'ioredis';
import { ObjectId } from 'mongodb';
import { enrichmentQueueName } from '../queue/EnrichmentQueue.js';
import type { EnrichmentJob } from '../queue/EnrichmentQueue.js';
import { OutboxPublisher } from '../queue/OutboxPublisher.js';
import { AuditRepository } from '../repositories/AuditRepository.js';
import { AIService } from '../services/AIService.js';

interface WorkerOptions {
  repository: AuditRepository;
  aiService: AIService;
  publisher: OutboxPublisher;
  connection: Redis;
  concurrency?: number;
  rateLimitMax?: number;
  rateLimitWindowMs?: number;
}

export class AIWorkerService {
  private worker: Worker<EnrichmentJob> | null = null;

  constructor(private readonly options: WorkerOptions) {}

  start(): void {
    if (this.worker) return;
    this.options.publisher.start();
    this.worker = new Worker<EnrichmentJob>(enrichmentQueueName, (job) => this.processJob(job), {
      connection: this.options.connection,
      concurrency: this.options.concurrency ?? 2,
      limiter: {
        max: this.options.rateLimitMax ?? 2,
        duration: this.options.rateLimitWindowMs ?? 1000,
      },
    });
    this.worker.on('error', (error) => console.error('AI worker error:', error));
    this.worker.on('failed', (job, error) => {
      if (job) {
        void job
          .getState()
          .then((state) => {
            if (state === 'failed') {
              return this.options.repository.markStalledFailure(
                new ObjectId(job.data.entryId),
                job.data.version,
                job.data.requestId,
              );
            }
          })
          .catch((failure: unknown) =>
            console.error('Could not record terminal failure:', failure),
          );
      }
      console.error('AI job failed:', job?.id, error);
    });
    console.log('AI worker and outbox publisher started.');
  }

  async processJob(job: Job<EnrichmentJob>): Promise<void> {
    const entry = await this.options.repository.claimPending(
      new ObjectId(job.data.entryId),
      job.data.version,
      job.data.requestId,
    );
    if (!entry) return; // An earlier evidence version or duplicate job.
    try {
      const result = await this.options.aiService.enrich(entry);
      await this.options.repository.completeEnrichment(entry, result);
    } catch (error) {
      const terminal = job.attemptsMade + 1 >= (job.opts.attempts ?? 1);
      await this.options.repository.recordFailure(
        entry,
        error instanceof Error ? error.message : 'AI enrichment failed.',
        terminal,
      );
      throw error;
    }
  }

  async close(): Promise<void> {
    await this.options.publisher.close();
    await this.worker?.close();
    this.worker = null;
  }
}
