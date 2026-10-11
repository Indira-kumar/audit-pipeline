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

Ensure Ollama is running at `http://127.0.0.1:11434`. `AI_MODEL` must match a name shown by `ollama list`; the default is `llama3.2`.

To skip setting up Ollama locally, set both providers in `.env` to `mock`:

```env
AI_PROVIDER=mock
EMBEDDING_PROVIDER=mock
```

Then setup DB and seed examples:

```bash
npm run db:up
npm run seed
```

If you change the embedding model, run `npm run reindex` to rebuild stored vectors.

## 3. Run the app

```bash
npm run dev
```

Open `http://127.0.0.1:5173` for the React dashboard.

## Check the code

```bash
npm run lint
npm run format:check
npm run typecheck
npm run test
npm run build
```
