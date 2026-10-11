import { MongoClient, ObjectId } from 'mongodb';
import type { AuditEntry } from '../types.js';

export function demoTenantId(): ObjectId {
  const value = process.env.DEMO_TENANT_ID ?? '000000000000000000000001';
  if (!ObjectId.isValid(value)) throw new Error('DEMO_TENANT_ID must be a MongoDB ObjectId');
  return new ObjectId(value);
}

export async function connectDatabase() {
  const uri = process.env.MONGODB_URI ?? 'mongodb://127.0.0.1:27017/smartaudit';
  const client = new MongoClient(uri, { serverSelectionTimeoutMS: 5000 });
  await client.connect();

  const entries = client.db().collection<AuditEntry>('audit_entries');
  await entries.createIndexes([
    { key: { tenantId: 1, evidenceId: 1 }, unique: true },
    { key: { tenantId: 1, timestamp: -1 } },
    { key: { tenantId: 1, 'aiMetadata.status': 1, timestamp: -1 } },
    {
      key: {
        tenantId: 1,
        'aiMetadata.status': 1,
        'enrichmentJob.state': 1,
        'enrichmentJob.requestedAt': 1,
      },
    },
  ]);

  return { client, entries };
}
