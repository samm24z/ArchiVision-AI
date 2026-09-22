# ArchiVision AI — Developer Setup Guide

This guide walks a new developer through setting up the ArchiVision AI monorepo locally.

**Current milestone:** M1 — Deployed Application Shell (local complete; cloud deploy pending)  
**Scope:** Tooling, health endpoints, CORS, frontend↔backend connectivity. No auth, database, or AI.

---

## Prerequisites

Install the following before proceeding:

| Tool | Minimum Version | Verify |
|------|-----------------|--------|
| Git | 2.40+ | `git --version` |
| Node.js | 20.x LTS | `node --version` |
| npm | 10+ | `npm --version` |
| Python | 3.11+ | `python --version` |
| pip | 23+ | `pip --version` |

### Recommended tools (optional)

- **nvm** or **fnm** — manage Node.js versions
- **pyenv** — manage Python versions
- **VS Code** or **Cursor** — primary IDE

---

## 1. Clone the Repository

```bash
git clone <repository-url> archivision-ai
cd archivision-ai
```

---

## 2. Environment Variables

The repo root `.env.example` is the **template**. FastAPI and Next.js each need their own local file.

### Backend — `backend/.env`

Settings load `.env` from the **current working directory**. Always start uvicorn from `backend/`.

```bash
# Windows (PowerShell)
Copy-Item .env.example backend\.env

# macOS / Linux
cp .env.example backend/.env
```

Keep at least:

```
ENVIRONMENT=development
API_HOST=0.0.0.0
API_PORT=8000
API_CORS_ORIGINS=http://localhost:3000
```

A `.env` at the **repository root is not read** by the API.

### Frontend — `frontend/.env.local`

Next.js only loads env files from the `frontend/` directory.

```bash
# Windows (PowerShell)
@"
NEXT_PUBLIC_APP_NAME=ArchiVision AI
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_API_URL=http://localhost:8000
"@ | Set-Content frontend\.env.local

# macOS / Linux
cat > frontend/.env.local << 'EOF'
NEXT_PUBLIC_APP_NAME=ArchiVision AI
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_API_URL=http://localhost:8000
EOF
```

`NEXT_PUBLIC_API_URL` must be the FastAPI origin **without a trailing slash**.

**Important:** Never commit `.env`, `backend/.env`, or `frontend/.env.local`. They are listed in `.gitignore`.

---

## 3. Frontend Setup (Next.js)

```bash
cd frontend
npm install
npm run dev
```

| Command | Purpose |
|---------|---------|
| `npm run dev` | Start development server on port 3000 |
| `npm run build` | Production build |
| `npm run start` | Serve production build |
| `npm run lint` | Run ESLint |

Open [http://localhost:3000](http://localhost:3000). M1 shows a connectivity shell (not product UI).

Frontend health (does not call FastAPI): [http://localhost:3000/api/health](http://localhost:3000/api/health)

---

## 4. Backend Setup (FastAPI)

Open a **second terminal** from the repository root:

```bash
cd backend
python -m venv .venv
```

Activate the virtual environment:

```bash
# Windows (PowerShell)
.venv\Scripts\Activate.ps1

# Windows (CMD)
.venv\Scripts\activate.bat

# macOS / Linux
source .venv/bin/activate
```

Install dependencies and start the server:

```bash
pip install -r requirements.txt
pip install -r requirements-dev.txt
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

| Command | Purpose |
|---------|---------|
| `uvicorn app.main:app --reload` | Dev server with auto-reload |
| `pytest` | Backend tests (health + bootstrap) |
| `ruff check .` | Lint Python code |

Health: [http://localhost:8000/health](http://localhost:8000/health)  
OpenAPI docs (development only): [http://localhost:8000/docs](http://localhost:8000/docs)

---

## 5. Verify M1 locally

With **both** servers running:

```powershell
# Windows
.\scripts\verify-m1.ps1
```

```bash
# macOS / Linux
bash scripts/verify-m1.sh
```

Manual checklist:

- [ ] `GET http://localhost:8000/health` returns `200` and `"status": "ok"`
- [ ] `GET http://localhost:3000/api/health` returns `200` and `"status": "ok"`
- [ ] Shell page shows **Connected** (backend reachable + CORS)
- [ ] `cd backend && pytest` passes
- [ ] `cd backend && ruff check .` passes
- [ ] `cd frontend && npm run lint` passes
- [ ] `cd frontend && npm run build` completes
- [ ] Env files exist locally and are **not** tracked by Git

---

## 6. IDE Configuration

### VS Code / Cursor extensions (recommended)

- ESLint
- Tailwind CSS IntelliSense
- Python
- Pylance
- Ruff

### Multi-root workspace (optional)

Open the repository root folder. Both `frontend/` and `backend/` are subprojects within one workspace.

---

## 7. Troubleshooting

### Port already in use

```bash
# Frontend — use a different port
npm run dev -- -p 3001

# Backend — use a different port
uvicorn app.main:app --reload --port 8001
```

If you change the backend port, set `NEXT_PUBLIC_API_URL` in `frontend/.env.local` and restart `npm run dev`.

If you change the frontend origin, set `API_CORS_ORIGINS` in `backend/.env` and restart uvicorn.

### Python virtual environment not activating (Windows)

```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

### npm install fails

Ensure Node.js 20+ is active, then:

```bash
rm -rf node_modules package-lock.json
npm install
```

### Shell page: Unable to reach backend

1. Confirm uvicorn is running on the URL in `NEXT_PUBLIC_API_URL`.
2. Confirm `API_CORS_ORIGINS` includes the exact frontend origin (`http://localhost:3000`).
3. Restart both servers after changing env files.

---

## 8. What Comes Next

- Cloud deploy: [DEPLOYMENT.md](./DEPLOYMENT.md) (Render + Vercel) — do this after local M1 is approved.
- **M2:** Authentication and database (Supabase). Do not start M2 until M1 is complete.

---

## Getting Help

1. Check [docs/README.md](./README.md) for documentation index
2. Review frozen specs in [docs/planning/](./planning/)
3. Confirm your milestone scope in [planning/master-development-roadmap.md](./planning/master-development-roadmap.md)
