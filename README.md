# Audit Pipeline

The system saves audit evidence immediately, then enriches relevant records in the background. Auditor note edits take the direct save path; changes to core evidence will trigger fresh enrichment.

## High-level design

![Audit pipeline HLD](audit-pipeline-hld.png)

The design separates fast evidence capture from slower AI processing. A queue lets workers scale independently, while version checks prevent stale AI results from replacing newer evidence.

## Repository layout

```text
apps/
  api/             Express API and background worker
    src/
      controllers/ HTTP request handling
      repositories/ MongoDB access (next increment)
      services/     AI enrichment boundary
      workers/      Background processing loop
  web/             React dashboard
```

## Run the scaffold

Use Node.js 24 or newer. From this repository's root, run:

```bash
cp .env.example .env
npm install
npm run dev
```

The dashboard opens at `http://127.0.0.1:5173`. The API health endpoint is `http://localhost:4000/api/health`.

This first increment provides the process entry points and UI shell. Audit persistence, enrichment, delta evaluation, similarity search, and seeding are the next increments.
