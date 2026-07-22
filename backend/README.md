# ArchiVision AI — Backend

FastAPI application for ArchiVision AI.

## Stack

- FastAPI
- Uvicorn
- Python 3.11+

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

## Structure

```
backend/
├── app/
│   ├── __init__.py
│   └── main.py        # FastAPI app instance (M0: no routes)
├── tests/
│   └── test_app.py    # Scaffold tests
├── requirements.txt
├── requirements-dev.txt
└── pyproject.toml
```

## Milestone Scope

**M0:** FastAPI instance starts successfully. No routes, no database.  
**M1:** Health endpoint and CORS.  
**M2+:** Auth, projects, and domain APIs.
