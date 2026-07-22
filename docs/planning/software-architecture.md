# Software Architecture

**Status:** 🔒 Frozen  
**Version:** 1.0  
**Last updated:** Planning phase

---

> This is a placeholder. Copy the approved Software Architecture specification here before M1.

## Summary

Defines the system architecture: frontend (Next.js on Vercel), backend (FastAPI on Render), Supabase (Auth, PostgreSQL, Storage), AI worker (GPU), ChromaDB, and module boundaries.

## Key Architectural Decisions (Frozen)

- Monorepo with `frontend/`, `backend/`, `shared/`, `scripts/`
- Async job queue for all AI workloads
- AI modules registered via module registry pattern
- Supabase RLS for data ownership
- Separate GPU worker for inference

See conversation-approved specification for full document body.
