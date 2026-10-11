import { Redis } from 'ioredis';
import { connectDatabase, demoTenantId } from './config/database.js';
import { EnrichmentQueue } from './queue/EnrichmentQueue.js';
import { OutboxPublisher } from './queue/OutboxPublisher.js';
import { AuditRepository } from './repositories/AuditRepository.js';
import { AIService, createAIProvider } from './services/AIService.js';
import { AIWorkerService } from './workers/AIWorkerService.js';

const provider = createAIProvider();
const { client, entries } = await connectDatabase();
const repository = new AuditRepository(entries, demoTenantId());
const redisUrl = process.env.REDIS_URL ?? 'redis://127.0.0.1:6379';
const producerConnection = new Redis(redisUrl, { maxRetriesPerRequest: 1, connectTimeout: 2000 });
const workerConnection = new Redis(redisUrl, { maxRetriesPerRequest: null });
const queue = new EnrichmentQueue(producerConnection);
const publisher = new OutboxPublisher({
  repository,
  queue,
  pollIntervalMs: Number(process.env.WORKER_POLL_MS ?? 1000),
});
const worker = new AIWorkerService({
  repository,
  publisher,
  aiService: new AIService(provider),
  connection: workerConnection,
  concurrency: Number(process.env.WORKER_CONCURRENCY ?? 2),
  rateLimitMax: Number(process.env.WORKER_RATE_LIMIT_MAX ?? 2),
  rateLimitWindowMs: Number(process.env.WORKER_RATE_LIMIT_WINDOW_MS ?? 1000),
});
worker.start();

let stopping = false;
async function stop(): Promise<void> {
  if (stopping) return;
  stopping = true;
  await worker.close();
  await queue.close();
  producerConnection.disconnect();
  workerConnection.disconnect();
  await client.close();
}
process.on('SIGTERM', () => void stop());
process.on('SIGINT', () => void stop());
