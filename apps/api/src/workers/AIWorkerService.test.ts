import assert from 'node:assert/strict';
import test from 'node:test';
import { UnrecoverableError } from 'bullmq';
import type { Job } from 'bullmq';
import type { Redis } from 'ioredis';
import { ObjectId } from 'mongodb';
import { ProviderHttpError } from '../providers/ProviderHttpError.js';
import type { EnrichmentJob } from '../queue/EnrichmentQueue.js';
import type { OutboxPublisher } from '../queue/OutboxPublisher.js';
import type { AuditRepository } from '../repositories/AuditRepository.js';
import type { AIService } from '../services/AIService.js';
import type { AuditEntry } from '../types.js';
import { AIWorkerService } from './AIWorkerService.js';

function workerFor(error: Error) {
  const entry = { _id: new ObjectId() } as AuditEntry;
  let recorded: { message: string; terminal: boolean } | undefined;
  const repository = {
    async claimPending() {
      return entry;
    },
    async recordFailure(_entry: AuditEntry, message: string, terminal: boolean) {
      recorded = { message, terminal };
    },
  } as unknown as AuditRepository;
  const worker = new AIWorkerService({
    repository,
    aiService: {
      async enrich() {
        throw error;
      },
    } as unknown as AIService,
    publisher: {} as OutboxPublisher,
    connection: {} as Redis,
  });
  const job = {
    data: { entryId: entry._id.toHexString(), version: 1 },
    attemptsMade: 0,
    opts: { attempts: 3 },
  } as Job<EnrichmentJob>;
  return { worker, job, recorded: () => recorded };
}

test('permanent provider errors stop retries and mark the record failed', async () => {
  const error = new ProviderHttpError('Ollama', 404, ' Model not found.');
  const { worker, job, recorded } = workerFor(error);
  await assert.rejects(worker.processJob(job), UnrecoverableError);
  assert.deepEqual(recorded(), { message: error.message, terminal: true });
});

test('temporary provider errors remain eligible for BullMQ retries', async () => {
  const error = new ProviderHttpError('Ollama', 503);
  const { worker, job, recorded } = workerFor(error);
  await assert.rejects(worker.processJob(job), error);
  assert.deepEqual(recorded(), { message: error.message, terminal: false });
});

test('only retryable HTTP statuses keep the retry policy', () => {
  for (const status of [400, 401, 403, 404, 422]) {
    assert.equal(new ProviderHttpError('Provider', status).permanent, true);
  }
  for (const status of [408, 425, 429, 500, 503]) {
    assert.equal(new ProviderHttpError('Provider', status).permanent, false);
  }
});
