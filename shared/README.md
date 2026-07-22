# Shared

Cross-cutting contracts shared between the frontend and backend.

## Purpose

This directory holds code and definitions used by more than one part of the monorepo — for example:

- Shared TypeScript/Python type definitions (future)
- Constants (module codes, event types)
- Validation schemas (future)

## Status (M0)

**Empty scaffold.** No shared code yet.

Shared artifacts will be introduced when the first cross-boundary contract is needed — likely during **M3 (Projects)** or **M5 (Job Queue)** when generation status enums and module type codes must stay in sync.

## Conventions (Future)

- Prefer language-native exports duplicated with clear comments over complex codegen in early milestones.
- If duplication becomes painful, introduce OpenAPI-generated TypeScript types from the FastAPI schema.
