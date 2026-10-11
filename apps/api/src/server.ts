import { createApp } from './app.js';
import { connectDatabase, demoTenantId } from './config/database.js';
import { AuditController } from './controllers/AuditController.js';
import { AuditRepository } from './repositories/AuditRepository.js';
import { AuditService } from './services/AuditService.js';

const { client, entries } = await connectDatabase();
const repository = new AuditRepository(entries, demoTenantId());
const controller = new AuditController(new AuditService(repository));
const port = Number(process.env.API_PORT ?? 4000);
const server = createApp(controller).listen(port, () => {
  console.log(`Audit API listening on http://localhost:${port}`);
});

async function stop(): Promise<void> {
  server.close();
  await client.close();
}
process.on('SIGTERM', stop);
process.on('SIGINT', stop);
