# ArchiVision AI

**Design Smarter. Build Better.**

An AI copilot for architecture, interior design, and home planning — built as a production-quality final-year major project and startup foundation.

## Status

| Milestone | Status |
|-----------|--------|
| M0 — Project Initialization | ✅ Complete (frozen) |
| M1 — Deployed Application Shell | 🔧 Local implementation (deploy pending) |
| M2 — Auth, profiles, preferences | Pending |

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | Next.js, React, TypeScript, Tailwind CSS, shadcn/ui |
| Backend | FastAPI, Python |
| Database | PostgreSQL (Supabase) — from M2 |
| Auth | Supabase Auth — from M2 |
| Storage | Supabase Storage — from M4 |
| AI | SDXL, ControlNet, Qwen2.5, Qwen2-VL, ChromaDB — later milestones |
| Deployment | Vercel, Render, Supabase |

## Repository Structure

```
ArchiVision AI/
├── docs/           # Project documentation and planning references
├── frontend/       # Next.js web application
├── backend/        # FastAPI application
├── shared/         # Cross-cutting contracts (types, constants) — future use
├── scripts/        # Verification and maintenance scripts
├── .env.example    # Environment variable template
└── README.md       # This file
```

## Quick Start

See **[docs/SETUP.md](docs/SETUP.md)** for the complete developer setup guide.

### Prerequisites

- Node.js 20+
- Python 3.11+
- Git

### Environment files

See `.env.example`. Local copies:

- Frontend: `frontend/.env.local` (`NEXT_PUBLIC_API_URL`, …)
- Backend: `backend/.env` (`API_CORS_ORIGINS`, `ENVIRONMENT`, …)

Never commit those files.

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

- API: [http://localhost:8000](http://localhost:8000)
- Health: [http://localhost:8000/health](http://localhost:8000/health)

### Frontend

```bash
cd frontend
npm install
npm run dev
```

- App shell: [http://localhost:3000](http://localhost:3000)
- Frontend health: [http://localhost:3000/api/health](http://localhost:3000/api/health)

The shell page reports whether the frontend can reach `GET /health` on the API.

### M1 verification (servers must already be running)

```powershell
# Windows
.\scripts\verify-m1.ps1
```

```bash
# macOS / Linux
bash scripts/verify-m1.sh
```

## Documentation

| Document | Location |
|----------|----------|
| Developer setup | [docs/SETUP.md](docs/SETUP.md) |
| Deployment (Vercel / Render) | [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) |
| Documentation index | [docs/README.md](docs/README.md) |
| Frozen planning specs | [docs/planning/](docs/planning/) |

## Live URLs

Not deployed yet. After Render and Vercel go live, record URLs in [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md).

## License

Private — final-year academic project. License TBD before public release.
