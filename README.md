# Audit Pipeline

The TypeScript API and React dashboard save audit evidence immediately and queues relevant records for background risk enrichment. Auditor note edits take the direct save path; changes to core evidence queue fresh enrichment.

## High-level design

![Audit pipeline HLD](audit-pipeline-hld.png)

The design separates fast evidence capture from slower AI processing. The first two sections are implemented; the background enrichment section is next.

## Modules

1. **Input and review:** Create evidence, edit notes or core fields, inspect records, and request similar historical exceptions in the dashboard.
2. **API and storage:** Validate requests, use targeted MongoDB updates, and atomically mark records for enrichment when core evidence changes.
3. **Background enrichment:** Publish jobs, compute AI metadata, and write version-checked results. This module is still pending.

## Repository layout

```text
apps/
  api/             Express API and background worker
    src/
      controllers/ HTTP request handling
      repositories/ MongoDB access
      services/     Audit rules and AI boundary
      workers/      Background processing scaffold
  web/             React dashboard
```

## Local setup

See [docs/local-setup.md](docs/local-setup.md).

Seed data includes completed historical examples so [similarity search](docs/similarity-search.md) can be tried now. Newly created records remain `PENDING` until the background enrichment module is built.
