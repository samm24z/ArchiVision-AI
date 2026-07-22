# ArchiVision AI

**Design Smarter. Build Better.**

An AI copilot for architecture, interior design, and home planning — built as a production-quality final-year major project and startup foundation.

## Status

| Milestone | Status |
|-----------|--------|
| M0 — Project Initialization | ✅ Complete |
| M1 — Deployed Application Shell | ⏳ Pending |

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | Next.js, React, TypeScript, Tailwind CSS, shadcn/ui |
| Backend | FastAPI, Python |
| Database | PostgreSQL (Supabase) |
| Auth | Supabase Auth |
| Storage | Supabase Storage |
| AI | SDXL, ControlNet, Qwen2.5, Qwen2-VL, ChromaDB |
| Deployment | Vercel, Render, Supabase |

## Repository Structure

```
ArchiVision AI/
├── docs/           # Project documentation and planning references
├── frontend/       # Next.js web application
├── backend/        # FastAPI application
├── shared/         # Cross-cutting contracts (types, constants) — future use
├── scripts/        # Development and deployment scripts — future use
├── .env.example    # Environment variable template
└── README.md       # This file
```

## Quick Start

See **[docs/SETUP.md](docs/SETUP.md)** for the complete developer setup guide.

### Prerequisites

- Node.js 20+
- Python 3.11+
- Git

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Opens at [http://localhost:3000](http://localhost:3000)

### Backend

```bash
cd backend
python -m venv .venv
# Windows
.venv\Scripts\activate
# macOS / Linux
source .venv/bin/activate

pip install -r requirements.txt
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

API process starts at [http://localhost:8000](http://localhost:8000) (no routes exposed in M0).

## Documentation

| Document | Location |
|----------|----------|
| Developer setup | [docs/SETUP.md](docs/SETUP.md) |
| Documentation index | [docs/README.md](docs/README.md) |
| Frozen planning specs | [docs/planning/](docs/planning/) |

## License

Private — final-year academic project. License TBD before public release.
