import { connectDatabase, demoTenantId } from './config/database.js';
import { createEmbeddingProvider, EmbeddingService } from './embeddings/EmbeddingService.js';
import { reindexCompleted } from './embeddings/reindex.js';

const embeddings = new EmbeddingService(createEmbeddingProvider());
const { client, entries } = await connectDatabase();
try {
  const indexed = await reindexCompleted(entries, demoTenantId(), embeddings);
  console.log(`Search index ready: ${indexed} completed entries indexed with ${embeddings.model}.`);
} finally {
  await client.close();
}
