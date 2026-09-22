# ArchiVision AI — Backend

FastAPI application for ArchiVision AI.

## Stack

- FastAPI
- Uvicorn
- Python 3.11+
- pydantic-settings

## Commands

```bash
python -m venv .venv
.venv\Scripts\Activate.ps1   # Windows
source .venv/bin/activate    # macOS / Linux

pip install -r requirements.txt
pip install -r requirements-dev.txt

uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
pytest
ruff check .
```

## Environment

Copy API-related keys from the repo-root `.env.example` into **`backend/.env`**.

Settings load `.env` from the process working directory. Run uvicorn from `backend/` so this file is found. A root-level `.env` is ignored.

| Variable | Purpose |
|----------|---------|
| `ENVIRONMENT` | `development` enables `/docs`. Use `production` on Render. |
| `API_CORS_ORIGINS` | Comma-separated browser origins allowed to call the API. Local default: `http://localhost:3000`. |

## M1 endpoints

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/health` | Liveness for Render and the frontend shell |

## Structure

```
backend/
├── app/
│   ├── __init__.py
│   ├── main.py              # FastAPI app, CORS, routers
│   ├── core/config.py       # Environment settings
│   └── api/routes/health.py
├── tests/
│   ├── test_app.py
│   └── test_health.py
├── render.yaml              # Render service notes (dashboard uses Root Directory backend)
├── requirements.txt
├── requirements-dev.txt
└── pyproject.toml
```

## Milestone Scope

**M0:** FastAPI instance starts.  
**M1:** Health endpoint, CORS, env config.  
**M2+:** Auth, projects, and domain APIs.
