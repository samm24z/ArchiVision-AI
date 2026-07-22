# Scripts

Development, deployment, and maintenance scripts for ArchiVision AI.

## Purpose

Automation that is not part of the application runtime lives here — for example:

- Database migration helpers (future)
- RAG corpus ingestion (M11)
- Local development orchestration
- Deployment verification

## Status (M0)

**Empty scaffold.** No scripts yet.

## Planned Scripts (Future Milestones)

| Script | Milestone | Purpose |
|--------|-----------|---------|
| `dev.sh` / `dev.ps1` | M1 | Start frontend + backend together |
| `verify-setup.sh` | M1 | Smoke-test local environment |
| `ingest-rag-corpus.py` | M11 | Embed and load ChromaDB |
| `seed-templates.py` | M3 | Seed system prompt templates |

## Usage Convention

- Scripts should be idempotent where possible.
- Document each script with a header comment and an entry in `docs/SETUP.md`.
