# Software Architecture

**Status:** 🔒 Frozen  
**Version:** 1.1
**Last updated:** 2026-10-08

> Version 1.1: Approved S3.1 decision to retain backend Supabase service-role
> access with FastAPI ownership enforcement as the primary API authorization
> boundary.

---

> This is a placeholder. Copy the approved Software Architecture specification here before M1.

## Summary

Defines the system architecture: frontend (Next.js on Vercel), backend (FastAPI on Render), Supabase (Auth, PostgreSQL, Storage), AI worker (GPU), ChromaDB, and module boundaries.

## Key Architectural Decisions (Frozen)

- Monorepo with `frontend/`, `backend/`, `shared/`, `scripts/`
- Async job queue for all AI workloads
- AI modules registered via module registry pattern
- Supabase RLS for data ownership
- Backend API requests use the Supabase service-role key for server-side
	PostgREST access. Service-role access bypasses Supabase RLS, so FastAPI must
	enforce ownership using the verified JWT's `current_user.id` for every
	project operation.
- Separate GPU worker for inference

## S3.1 Ownership and Database Access Decision

The S3.1 backend retains Option B: FastAPI uses the Supabase service-role key
for server-side project database/PostgREST access. This key bypasses Supabase
RLS for those backend requests; therefore, FastAPI ownership filtering is the
primary authorization boundary and is mandatory for every project operation.

Supabase RLS remains enabled as defense in depth for direct authenticated
Supabase access. Production approval requires real integration tests proving
cross-user ownership isolation through the backend and direct Supabase access.

The service-role key is backend-only and must never be exposed to the frontend,
browser code, public environment variables, or API responses.

See conversation-approved specification for full document body.
