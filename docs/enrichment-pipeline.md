# Enrichment flow

Creating evidence saves `PENDING` and an `UNPUBLISHED` job marker in the same MongoDB document. A publisher claims that marker and adds a versioned BullMQ job to Redis. The worker fetches the current evidence, calls the configured AI provider, and writes only AI fields with `$set`.

| AI status    | Meaning                                                                             |
| ------------ | ----------------------------------------------------------------------------------- |
| `PENDING`    | Saved and waiting for a worker, or waiting for a retry.                             |
| `PROCESSING` | A worker has claimed this evidence version.                                         |
| `COMPLETED`  | Risk score, summary, flags, and eight-dimensional vector are stored.                |
| `FAILED`     | A permanent provider error occurred, or a transient error exhausted three attempts. |

Mongo claims and the BullMQ job ID prevent duplicate publishing under normal retries. The completion write checks the evidence version and claim token, so an old worker cannot overwrite a newer core edit. Note edits update only the note field and do not requeue. BullMQ retries failed jobs up to three total attempts with exponential backoff and 50% jitter (roughly 2.5–5 seconds, then 5–10 seconds). A Redis-backed worker limit allows two AI jobs to start per second across workers by default; tune `WORKER_RATE_LIMIT_MAX` and `WORKER_RATE_LIMIT_WINDOW_MS` for your provider. BullMQ also handles concurrent workers and stalled jobs; the Mongo marker lets publishing resume if Redis is temporarily unavailable.

`AI_PROVIDER=ollama` is the default. Set `AI_MODEL` and `OLLAMA_URL` for your local model, or select `openrouter` with `OPENROUTER_API_KEY` and an OpenRouter model ID. `AI_PROVIDER=mock` provides a deterministic offline demo. The eight-dimensional vector remains an explainable assignment field. A separate embedding adapter sends short, overlapping evidence chunks to Ollama `embeddinggemma` and stores the full vectors with the model name. Similarity compares only records indexed by the same model and combines the closest chunk cosine score (75%) with description and control keyword overlap (25%). `npm run seed` indexes historical examples; `npm run reindex` backfills older completed records or a new embedding model. The mock embedding adapter keeps offline demos available. The AI provider generates the score, summary, and flags; `AIService` derives the risk level and both vectors.

Provider HTTP errors such as a missing Ollama model (404) or invalid credentials fail immediately. Timeouts, rate limits, network failures, and server errors still use exponential retries with jitter.
