import { createApp } from './app.js';

const port = Number(process.env.API_PORT ?? 4000);
const server = createApp().listen(port, () => {
  console.log(`Audit API listening on http://localhost:${port}`);
});

process.on('SIGTERM', () => server.close());
process.on('SIGINT', () => server.close());

