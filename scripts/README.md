# Scripts

Development, deployment, and maintenance scripts for ArchiVision AI.

## Purpose

Automation that is not part of the application runtime lives here.

## M1 scripts

| Script | Purpose |
|--------|---------|
| `verify-m1.ps1` | Windows: `GET /health`, `GET /api/health`, CORS origin check |
| `verify-m1.sh` | Unix: same checks |

Both assume:

- Backend is already running at `http://localhost:8000`
- Frontend is already running at `http://localhost:3000`

```powershell
.\scripts\verify-m1.ps1
```

```bash
bash scripts/verify-m1.sh
```

## Planned scripts (later milestones)

| Script | Milestone | Purpose |
|--------|-----------|---------|
| `dev.sh` / `dev.ps1` | Optional | Start frontend + backend together |
| `ingest-rag-corpus.py` | M11 | Embed and load ChromaDB |
| `seed-templates.py` | M3 | Seed system prompt templates |

## Usage convention

- Scripts should be idempotent where possible.
- Document each script with a header comment and an entry in `docs/SETUP.md`.
