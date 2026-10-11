import { connectDatabase, demoTenantId } from './config/database.js';
import { AuditRepository } from './repositories/AuditRepository.js';
import { AIService } from './services/AIService.js';
import { AIWorkerService } from './workers/AIWorkerService.js';

const { client, entries } = await connectDatabase();
const worker = new AIWorkerService({
  repository: new AuditRepository(entries, demoTenantId()),
  aiService: new AIService(),
  pollIntervalMs: Number(process.env.WORKER_POLL_MS ?? 1000),
});

worker.start();
async function stop(): Promise<void> {
  worker.stop();
  await client.close();
}
process.on('SIGTERM', stop);
process.on('SIGINT', stop);
