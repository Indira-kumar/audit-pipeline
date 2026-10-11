import type { AuditRepository } from '../repositories/AuditRepository.js';
import type { JobPublisher } from './EnrichmentQueue.js';

interface PublisherOptions {
  repository: Pick<AuditRepository, 'claimUnpublished' | 'markPublished' | 'releasePublishClaim'>;
  queue: JobPublisher;
  pollIntervalMs?: number;
}

export class OutboxPublisher {
  private timer: ReturnType<typeof setTimeout> | null = null;
  private inFlight: Promise<void> | null = null;
  private running = false;

  constructor(private readonly options: PublisherOptions) {}

  start(): void {
    if (this.running) return;
    this.running = true;
    this.schedule(0);
  }

  private schedule(delay: number): void {
    this.timer = setTimeout(() => {
      this.inFlight = this.runOnce()
        .catch((error: unknown) => console.error('Outbox publish failed:', error))
        .finally(() => {
          this.inFlight = null;
          if (this.running) this.schedule(this.options.pollIntervalMs ?? 1000);
        });
    }, delay);
  }

  async runOnce(): Promise<void> {
    for (let count = 0; count < 50; count += 1) {
      const entry = await this.options.repository.claimUnpublished(30000);
      if (!entry) return;
      try {
        await this.options.queue.add(entry);
        await this.options.repository.markPublished(entry);
      } catch (error) {
        await this.options.repository.releasePublishClaim(entry);
        throw error;
      }
    }
  }

  async close(): Promise<void> {
    this.running = false;
    if (this.timer) clearTimeout(this.timer);
    await this.inFlight;
  }
}
