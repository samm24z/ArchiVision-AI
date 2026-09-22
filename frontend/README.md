# ArchiVision AI — Frontend

Next.js application for ArchiVision AI.

## Stack

- Next.js 15 (App Router)
- React 19
- TypeScript
- Tailwind CSS

## Commands

```bash
npm install
npm run dev      # http://localhost:3000
npm run build
npm run lint
```

## Environment

Create **`frontend/.env.local`** (Next.js does not read a repo-root `.env`):

```
NEXT_PUBLIC_APP_NAME=ArchiVision AI
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_API_URL=http://localhost:8000
```

`NEXT_PUBLIC_API_URL` is the FastAPI origin with **no trailing slash**. It is inlined at build time.

On Vercel, set the same variables in the project dashboard. After changing `NEXT_PUBLIC_API_URL`, redeploy.

## M1 routes

| Path | Purpose |
|------|---------|
| `/` | Connectivity shell (not product UI) |
| `/api/health` | Frontend process health (does not call FastAPI) |

The shell uses `src/lib/api.ts` (`fetchBackendHealth`) to call `{NEXT_PUBLIC_API_URL}/health`.

## Structure

```
frontend/
├── src/
│   ├── app/
│   │   ├── layout.tsx
│   │   ├── page.tsx              # M1 shell
│   │   ├── globals.css
│   │   └── api/health/route.ts
│   └── lib/
│       ├── env.ts
│       └── api.ts
├── public/
├── package.json
├── tsconfig.json
├── next.config.ts
├── tailwind.config.ts
└── postcss.config.mjs
```

## Milestone Scope

**M0:** Tooling and dev server scaffold.  
**M1:** Health route, API client, connectivity shell.  
**M2+:** Auth, pages, and components.  
**M8+:** Design Studio and product UI.
