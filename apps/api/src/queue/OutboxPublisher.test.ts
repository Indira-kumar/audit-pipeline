import assert from 'node:assert/strict';
import test from 'node:test';
import { ObjectId } from 'mongodb';
import type { AuditEntry } from '../types.js';
import { OutboxPublisher } from './OutboxPublisher.js';

const entry = {
  _id: new ObjectId(),
  evidenceVersion: 3,
  enrichmentJob: { state: 'PUBLISHING', claimToken: 'claim-1' },
} as AuditEntry;

test('publisher marks a Mongo outbox entry only after queue insertion succeeds', async () => {
  const calls: string[] = [];
  let pending = true;
  const publisher = new OutboxPublisher({
    repository: {
      async claimUnpublished() {
        if (!pending) return null;
        pending = false;
        calls.push('claim');
        return entry;
      },
      async markPublished() {
        calls.push('published');
      },
      async releasePublishClaim() {
        calls.push('released');
      },
    },
    queue: {
      async add() {
        calls.push('queued');
      },
    },
  });
  await publisher.runOnce();
  assert.deepEqual(calls, ['claim', 'queued', 'published']);
});

test('publisher returns the claim for retry when Redis insertion fails', async () => {
  const calls: string[] = [];
  const publisher = new OutboxPublisher({
    repository: {
      async claimUnpublished() {
        return entry;
      },
      async markPublished() {
        calls.push('published');
      },
      async releasePublishClaim() {
        calls.push('released');
      },
    },
    queue: {
      async add() {
        throw new Error('Redis unavailable');
      },
    },
  });
  await assert.rejects(publisher.runOnce(), /Redis unavailable/);
  assert.deepEqual(calls, ['released']);
});
