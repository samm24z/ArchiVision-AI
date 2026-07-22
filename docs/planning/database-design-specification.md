# Database Design Specification

**Status:** 🔒 Frozen  
**Version:** 1.0  
**Last updated:** Planning phase

---

> This is a placeholder. Copy the approved Database Design Specification here before M1.

## Summary

Defines 14 PostgreSQL tables, entity relationships, data placement (PostgreSQL vs Supabase Storage vs ChromaDB), and cross-cutting strategies (soft delete, versioning, memory snapshots).

## Primary Entities (Frozen)

- `profiles`, `user_preferences`, `projects`, `project_memory`
- `assets`, `generations`, `generation_outputs`, `explainability_reports`
- `conversations`, `messages`
- Supporting: `ai_module_types`, `prompt_templates`, `activity_events`
- Audit: `project_memory_versions` (V1.0.1)

See conversation-approved specification for full document body.
