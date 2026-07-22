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

## Structure

```
frontend/
├── src/
│   └── app/           # Next.js App Router (M0: layout + placeholder only)
│       ├── layout.tsx
│       ├── page.tsx
│       └── globals.css
├── public/            # Static assets (future)
├── package.json
├── tsconfig.json
├── next.config.ts
├── tailwind.config.ts
└── postcss.config.mjs
```

## Milestone Scope

**M0:** Tooling and dev server scaffold only.  
**M2+:** Auth, pages, and components.  
**M8+:** Design Studio and product UI.
