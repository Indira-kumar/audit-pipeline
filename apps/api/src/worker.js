import { AuditRepository } from './repositories/AuditRepository.js';
import { AIService } from './services/AIService.js';
import { AIWorkerService } from './workers/AIWorkerService.js';

const worker = new AIWorkerService({
  repository: new AuditRepository(),
  aiService: new AIService(),
  pollIntervalMs: Number(process.env.WORKER_POLL_MS ?? 1000),
});

worker.start();
process.on('SIGTERM', () => worker.stop());
process.on('SIGINT', () => worker.stop());

