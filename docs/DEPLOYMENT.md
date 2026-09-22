# ArchiVision AI — Deployment Guide (M1)

This guide deploys the **application shell**: Next.js on Vercel and FastAPI on Render, with health checks and CORS.

**M1 does not include** authentication, Supabase, database, AI, or GitHub Actions.

---

## Prerequisites

- GitHub repository with `main` containing the M1 code
- [Vercel](https://vercel.com) account
- [Render](https://render.com) account
- Live URLs will be filled in after first deploy

---

## 1. Deploy the backend (Render)

1. In Render, create a **Web Service** from this GitHub repository.
2. Set:
   - **Root Directory:** `backend`
   - **Runtime:** Python
   - **Build Command:** `pip install -r requirements.txt`
   - **Start Command:** `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
3. Environment variables:

   | Key | Value |
   |-----|--------|
   | `ENVIRONMENT` | `production` |
   | `API_CORS_ORIGINS` | Your Vercel origin(s), comma-separated. Example: `https://your-app.vercel.app,http://localhost:3000` |

4. Health check path: `/health` (also set in `backend/render.yaml`).
5. Deploy, then open:

   `https://<your-service>.onrender.com/health`

   Expect HTTP **200** and JSON with `"status": "ok"`.

### Render Blueprint note

`backend/render.yaml` documents the service. Render auto-detects a blueprint named `render.yaml` at the **repository root**. For M1, create the service in the dashboard using the values above (or copy the file to the repo root later if you want Blueprint auto-apply).

Free-tier services may **cold-start** (first request can take 30–60 seconds).

---

## 2. Deploy the frontend (Vercel)

1. Import the same GitHub repository into Vercel.
2. Set:
   - **Root Directory:** `frontend`
   - **Framework:** Next.js (auto-detected)
3. Environment variable:

   | Key | Value |
   |-----|--------|
   | `NEXT_PUBLIC_API_URL` | Render API origin **without** a trailing slash. Example: `https://<your-service>.onrender.com` |
   | `NEXT_PUBLIC_APP_NAME` | `ArchiVision AI` (optional) |
   | `NEXT_PUBLIC_APP_URL` | Your Vercel origin (optional) |

4. Deploy, then verify:
   - `https://<your-app>.vercel.app` — shell page shows backend **Connected** (or a clear error)
   - `https://<your-app>.vercel.app/api/health` — HTTP **200**

`NEXT_PUBLIC_*` variables are baked in at **build time**. Change the API URL → **redeploy** the frontend.

---

## 3. Finalize CORS

After both URLs exist:

1. Set Render `API_CORS_ORIGINS` to the exact Vercel origin (scheme + host, no path).
2. Include `http://localhost:3000` if you still develop locally against production API (optional; not recommended long-term).
3. Redeploy the Render service if env vars do not hot-reload.
4. Reload the Vercel shell and confirm **Connected** with no browser CORS errors.

---

## 4. Production smoke checks

```bash
curl https://<your-service>.onrender.com/health
curl https://<your-app>.vercel.app/api/health
curl -s -D - -H "Origin: https://<your-app>.vercel.app" https://<your-service>.onrender.com/health -o /dev/null
```

The last command should include:

`Access-Control-Allow-Origin: https://<your-app>.vercel.app`

---

## 5. Live URLs

Record production URLs here after first successful deploy (do not put secrets):

| Service | URL |
|---------|-----|
| Frontend (Vercel) | _pending_ |
| Backend (Render) | _pending_ |
