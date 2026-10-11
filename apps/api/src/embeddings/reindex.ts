import type { Collection, ObjectId } from 'mongodb';
import type { AuditEntry } from '../types.js';
import { EmbeddingService } from './EmbeddingService.js';

export async function reindexCompleted(
  entries: Collection<AuditEntry>,
  tenantId: ObjectId,
  embeddings: EmbeddingService,
): Promise<number> {
  let indexed = 0;
  const cursor = entries.find({
    tenantId,
    'aiMetadata.status': 'COMPLETED',
    'aiMetadata.searchEmbedding.model': { $ne: embeddings.model },
  });
  for await (const entry of cursor) {
    const searchEmbedding = await embeddings.embed(entry);
    const result = await entries.updateOne(
      {
        _id: entry._id,
        tenantId,
        evidenceVersion: entry.evidenceVersion,
        'aiMetadata.status': 'COMPLETED',
      },
      { $set: { 'aiMetadata.searchEmbedding': searchEmbedding } },
    );
    indexed += result.modifiedCount;
  }
  return indexed;
}
