import { AuditRepository } from '../repositories/AuditRepository.js';
import { AIService } from '../services/AIService.js';

interface WorkerOptions {
  repository: AuditRepository;
  aiService: AIService;
  pollIntervalMs?: number;
}

export class AIWorkerService {
  private readonly repository: AuditRepository;
  private readonly aiService: AIService;
  private readonly pollIntervalMs: number;
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor({ repository, aiService, pollIntervalMs = 1000 }: WorkerOptions) {
    this.repository = repository;
    this.aiService = aiService;
    this.pollIntervalMs = pollIntervalMs;
  }

  start(): void {
    if (this.timer) return;
    this.timer = setInterval(() => {
      this.runOnce().catch((error: unknown) => console.error('Worker cycle failed:', error));
    }, this.pollIntervalMs);
    console.log('AI worker scaffold started; enrichment is part of the next module.');
  }

  stop(): void {
    if (!this.timer) return;
    clearInterval(this.timer);
    this.timer = null;
  }

  async runOnce(): Promise<void> {
    const entry = await this.repository.claimPending();
    if (!entry) return;
    const result = await this.aiService.enrich(entry);
    await this.repository.completeEnrichment(entry, result);
  }
}
