# Local setup

Run these steps from the repository root. You need Node.js 24 or newer, Docker, and Ollama for local Llama enrichment.

## 1. Install and configure

```bash
npm ci
cp .env.example .env
```

## 2. Start MongoDB, Redis, and the model

```bash
npm run db:up
ollama pull llama3.2
```

Ensure Ollama is running at `http://127.0.0.1:11434`. Set `AI_MODEL` in `.env` if you use another model. For a demo without a local model, set `AI_PROVIDER=mock` in `.env`.

Then seed examples:

```bash
npm run seed
```

The seed command is safe to run again; it keeps existing entries and edits.

## 3. Run the app

```bash
npm run dev
```

Open `http://127.0.0.1:5173`. Try creating evidence, editing a note, changing an amount, and finding similar cases on a completed seed record. New records pass through `PENDING` and `PROCESSING` to `COMPLETED`; a note edit saves without a new job.

The dev command starts the API, worker, and UI. Press `Ctrl+C` to stop them. Run `npm run db:down` when you want to stop MongoDB and Redis.

## Check the code

```bash
npm run lint
npm run format:check
npm run typecheck
npm run test
npm run build
```
