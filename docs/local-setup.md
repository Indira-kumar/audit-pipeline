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
ollama pull embeddinggemma
ollama list
```

Ensure Ollama is running at `http://127.0.0.1:11434`. `AI_MODEL` must match a name shown by `ollama list`; the default is `llama3.2`. If you change `.env`, restart `npm run dev`. For a demo without local models, set `AI_PROVIDER=mock` and `EMBEDDING_PROVIDER=mock` in `.env`. The embedding model can be changed with `EMBEDDING_MODEL`.

Then seed examples:

```bash
npm run seed
```

The seed command is safe to run again; it keeps existing entries and edits. It also adds search embeddings to completed records. After changing the embedding model, run `npm run reindex` to rebuild stored vectors.

## 3. Run the app

```bash
npm run dev
```

Open `http://127.0.0.1:5173`. Try creating evidence, editing a note, changing an amount, and finding similar cases on a completed seed record. New records pass through `PENDING` and `PROCESSING` to `COMPLETED`; a note edit saves without a new job. If enrichment failed while the model was unavailable, use **Retry AI** on that row after fixing the model configuration.

The dev command starts the API, worker, and UI. Press `Ctrl+C` to stop them. Run `npm run db:down` when you want to stop MongoDB and Redis.

## Check the code

```bash
npm run lint
npm run format:check
npm run typecheck
npm run test
npm run build
```
