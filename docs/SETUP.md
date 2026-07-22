# ArchiVision AI — Developer Setup Guide

This guide walks a new developer through setting up the ArchiVision AI monorepo from scratch.

**Current milestone:** M0 — Project Initialization  
**Scope:** Repository structure, tooling, and local dev servers. No auth, database, or AI yet.

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

Copy the environment template to the repository root:

```bash
# Windows (PowerShell)
Copy-Item .env.example .env

# macOS / Linux
cp .env.example .env
```

Edit `.env` and adjust values if needed. Defaults work for local M0 development.

**Important:** Never commit `.env` to Git. It is listed in `.gitignore`.

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

Open [http://localhost:3000](http://localhost:3000). M0 ships a minimal placeholder — product pages arrive in later milestones.

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
| `pytest` | Run backend tests (scaffold only in M0) |
| `ruff check .` | Lint Python code |

M0 exposes a FastAPI application instance with **no HTTP routes**. The process starts successfully; API endpoints begin in M1.

---

## 5. Verify M0 Completion

Run these checks after setup:

- [ ] `frontend/` — `npm run dev` starts without errors
- [ ] `frontend/` — `npm run build` completes successfully
- [ ] `backend/` — `uvicorn app.main:app --reload` starts without errors
- [ ] `.env` exists locally and is **not** tracked by Git
- [ ] Both `node_modules/` and `.venv/` are **not** tracked by Git

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

Update `NEXT_PUBLIC_API_URL` in `.env` if you change the backend port.

### Python virtual environment not activating (Windows)

Run PowerShell as Administrator once:

```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

### npm install fails

Ensure Node.js 20+ is active:

```bash
node --version
```

Delete `node_modules/` and retry:

```bash
rm -rf node_modules package-lock.json
npm install
```

---

## 8. What Comes Next (M1)

M1 will add:

- Deployed frontend on Vercel
- Deployed backend on Render
- Health check endpoints
- Frontend ↔ backend connectivity on production URLs

Do not implement M1 steps until M0 is reviewed and approved.

---

## Getting Help

1. Check [docs/README.md](./README.md) for documentation index
2. Review frozen specs in [docs/planning/](./planning/)
3. Confirm your milestone scope in [planning/master-development-roadmap.md](./planning/master-development-roadmap.md)
