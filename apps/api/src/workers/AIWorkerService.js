export class AIWorkerService {
  constructor({ repository, aiService, pollIntervalMs = 1000 }) {
    this.repository = repository;
    this.aiService = aiService;
    this.pollIntervalMs = pollIntervalMs;
    this.timer = null;
  }

  start() {
    if (this.timer) return;
    this.timer = setInterval(() => {
      this.runOnce().catch((error) => console.error('Worker cycle failed:', error));
    }, this.pollIntervalMs);
    console.log('AI worker started; persistence will be connected next.');
  }

  stop() {
    if (!this.timer) return;
    clearInterval(this.timer);
    this.timer = null;
  }

  async runOnce() {
    const entry = await this.repository.claimPending();
    if (!entry) return;

    const result = await this.aiService.enrich(entry);
    await this.repository.completeEnrichment(entry, result);
  }
}

