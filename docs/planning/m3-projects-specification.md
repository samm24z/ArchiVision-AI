# M3 — Projects Foundation Specification

## 1. Objective

M3 introduces persistent architecture projects for authenticated ArchiVision AI users.

After M3, a newly registered user must be able to create, view, update, list, and soft-delete their own projects.

Projects must be strictly isolated between users.

M3 is divided into:

- S3.1 — Database + Projects API
- S3.2 — Dashboard + Project Overview

The project must continue using the existing authentication foundation from M2.

The backend must derive the authenticated user identity from the verified JWT. The client must never be trusted to provide the project owner.

## 2. Projects Data Model

Create a `projects` table with:

- `id` UUID PRIMARY KEY
- `owner_id` UUID NOT NULL REFERENCES auth.users(id)
- `name` TEXT NOT NULL
- `description` TEXT NULL
- `project_type` enum/value constrained to:
  - `concept`
  - `interior`
  - `mixed`
- `city` TEXT NULL
- `climate` TEXT NULL
- `cover_image_url` TEXT NULL
- `is_archived` BOOLEAN NOT NULL DEFAULT FALSE
- `created_at` TIMESTAMPTZ NOT NULL DEFAULT NOW()
- `updated_at` TIMESTAMPTZ NOT NULL DEFAULT NOW()
- `deleted_at` TIMESTAMPTZ NULL

Project ownership is represented by `owner_id`.

The client must never be allowed to choose or override `owner_id`.

## 3. Project Memory Data Model

Create a `project_memory` table with:

- `id` UUID PRIMARY KEY
- `project_id` UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE
- `brief` TEXT NULL
- `style_preferences` JSONB NULL
- `palette_preferences` JSONB NULL
- `material_preferences` JSONB NULL
- `constraints` JSONB NULL
- `created_at` TIMESTAMPTZ NOT NULL DEFAULT NOW()
- `updated_at` TIMESTAMPTZ NOT NULL DEFAULT NOW()

Relationship:

projects 1 : 1 project_memory

`project_id` must therefore be UNIQUE.

A project memory record must be created atomically when a project is created.

M3 does NOT implement advanced AI memory, embeddings, RAG, ChromaDB, or conversational memory.

This table is the persistent foundation for later AI/project-memory milestones.

## 4. Database Integrity

Implement:

- foreign-key constraints
- UUID primary keys
- appropriate NOT NULL constraints
- unique constraint for `project_memory.project_id`
- ON DELETE CASCADE from project to project_memory
- automatic `updated_at` maintenance using a database trigger/function

Projects must support soft deletion.

Soft deletion means:

- `is_archived = TRUE`
- `deleted_at = NOW()`

Normal project listing must exclude soft-deleted projects.

## 5. Indexes

Create indexes supporting the expected access patterns:

- `projects(owner_id)`
- `projects(owner_id, deleted_at)`
- `projects(owner_id, updated_at DESC)`

`project_memory(project_id)` is inherently unique because of the 1:1 relationship and should be indexed through its UNIQUE constraint.

Do not add speculative indexes without a documented access pattern.

## 6. Security / RLS

Supabase Row Level Security must be enabled.

Projects:

A user may access only projects where:

`auth.uid() = owner_id`

Project memory:

A user may access project memory only when they own the corresponding project.

Use RLS as defense in depth.

FastAPI must ALSO enforce ownership.

The authenticated identity comes from the existing M2 JWT verification system.

The server must use:

`current_user.id`

when determining ownership.

Never trust:

- `owner_id` from request bodies
- user IDs supplied by query parameters
- user IDs supplied by URL parameters as proof of ownership

Cross-user project access must not expose whether another user's project exists.

For API access to a project owned by another user, return HTTP 404 rather than revealing its existence.

## 7. Project API

Implement the following API contract during S3.1.

### POST

POST `/api/v1/projects`

Creates a project belonging to the authenticated user.

The request may contain:

- name
- description
- project_type
- city
- climate
- cover_image_url

The request must NOT accept `owner_id` as a trusted ownership field.

The backend assigns ownership from the authenticated JWT.

Creating the project also creates its `project_memory` record atomically.

### GET LIST

GET `/api/v1/projects`

Returns projects belonging to the authenticated user.

Requirements:

- authenticated users only
- exclude soft-deleted projects
- order by `updated_at DESC`
- do not return projects belonging to other users

### GET SINGLE

GET `/api/v1/projects/{project_id}`

Returns a project belonging to the authenticated user.

If the project:

- does not exist, OR
- belongs to another user, OR
- has been soft-deleted

return HTTP 404.

### PATCH

PATCH `/api/v1/projects/{project_id}`

Updates editable project fields.

Ownership cannot be changed.

`owner_id` must never be mutable through this endpoint.

Update `updated_at` automatically.

If the project does not belong to the authenticated user, return HTTP 404.

### DELETE

DELETE `/api/v1/projects/{project_id}`

This is a soft delete.

Set:

- `is_archived = TRUE`
- `deleted_at = NOW()`

Do not physically delete the project.

The associated `project_memory` should remain available internally unless the approved implementation contract explicitly requires otherwise.

After deletion, normal project listing must no longer return the project.

If the project does not belong to the authenticated user, return HTTP 404.

## 8. API Authentication

All project endpoints require authentication.

Unauthenticated requests must return HTTP 401.

Use the existing M2 authentication/dependency system.

Do not introduce a second authentication mechanism.

Do not replace the existing JWT/JWKS implementation.

## 9. API Validation

Validate project input using the backend's existing validation conventions.

At minimum:

- name is required when creating a project
- project_type must be one of:
  - concept
  - interior
  - mixed
- nullable fields remain optional
- owner_id is server-controlled

Do not introduce speculative fields.

## 10. Frontend — S3.2

M3 frontend work must create a basic project management experience.

The dashboard becomes the user's project hub.

It should provide:

- project list
- project cards
- project name
- project type
- relevant metadata
- updated timestamp
- empty state when no projects exist
- create-project action
- loading state
- error state

Create a project creation form.

The form should support the approved project fields.

After successful creation, the user should be able to open the project overview.

Create the project overview route:

`/dashboard/projects/[projectId]`

The project overview should provide:

- project identity
- project metadata
- edit capability
- archive/delete capability
- project memory foundation visibility only where appropriate

Do not implement AI generation inside M3.

Do not implement uploads inside M3.

Do not implement image generation inside M3.

Do not implement floor-plan processing inside M3.

## 11. Frontend Routing

Existing M2 authentication behavior must remain intact.

Protected project routes must require authentication.

Do not break:

- `/login`
- `/signup`
- `/auth/*`
- `/dashboard`
- `/api/health`

Do not change the authentication architecture.

## 12. S3.1 Scope

S3.1 consists of:

1. Database migration
2. projects table
3. project_memory table
4. constraints
5. relationships
6. indexes
7. RLS policies
8. updated_at trigger/function
9. FastAPI project schemas
10. FastAPI project CRUD endpoints
11. ownership enforcement
12. soft deletion
13. backend tests

S3.1 acceptance:

- authenticated user can create a project
- project ownership is assigned from JWT
- project memory is automatically created
- authenticated user can list their projects
- authenticated user can retrieve their project
- authenticated user can update their project
- authenticated user can soft-delete their project
- soft-deleted projects are excluded from normal listing
- unauthenticated requests return 401
- another user's project cannot be accessed
- cross-user access returns 404
- RLS prevents cross-user database access
- existing M2 authentication remains functional

## 13. S3.2 Scope

S3.2 consists of:

1. Dashboard project hub
2. Project cards
3. Empty state
4. Create project flow
5. Project overview route
6. Project editing
7. Project archiving
8. Loading states
9. Error states
10. Persistence after browser reload

S3.2 acceptance:

A newly authenticated user can:

1. open the dashboard
2. see their projects
3. create a project
4. see the new project
5. open the project overview
6. edit project information
7. archive the project
8. refresh the browser
9. see persisted project state

## 14. Out of Scope

The following must NOT be implemented in M3:

- file uploads
- Supabase Storage integration
- AI image generation
- sketch processing
- architectural visualization
- floor-plan analysis
- job queue
- background workers
- ChromaDB
- embeddings
- RAG
- AI Copilot
- conversational memory
- Gallery
- interior redesign
- cost estimation
- sustainability analysis
- collaboration
- sharing
- Google OAuth
- social login
- advanced permissions
- team/workspace accounts

Those belong to later milestones.

## 15. Testing Requirements

S3.1 backend tests must cover:

- create project
- list projects
- get project
- update project
- soft delete project
- automatic project memory creation
- authentication failure
- malformed authentication
- cross-user access
- ownership enforcement
- invalid project type
- required project name
- soft-deleted project behavior

Frontend tests/verification should cover the core project management flow according to the repository's existing testing conventions.

Existing M0 and M2 tests must continue passing.

## 16. Definition of Done

M3 is complete only when:

- project database schema exists
- RLS is enabled and verified
- project ownership is enforced
- project memory is created automatically
- CRUD API works
- soft deletion works
- backend tests pass
- dashboard project hub works
- project creation works
- project overview works
- project editing works
- project archiving works
- persistence works after reload
- existing authentication remains functional
- lint/build/test checks pass
- production deployment remains healthy

Final product-level acceptance:

"A newly registered ArchiVision AI user can create and manage persistent architecture projects, while being cryptographically authenticated and completely isolated from other users' projects."

## 17. Implementation Order

Implementation must happen in this order:

M3
  |
  +-- S3.1 Database + Projects API
  |
  +-- Verification
  |
  +-- S3.2 Dashboard + Project Overview
  |
  +-- Verification
  |
  +-- Production deployment verification

Do not implement S3.2 before S3.1 is verified.

Do not implement later milestones during M3.

## Final Instruction

Create ONLY:

`docs/planning/m3-projects-specification.md`

Use the specification above as the source of truth.

After creating the file, STOP.

Report only:

1. the file created
2. a short confirmation that no other files were modified

Do not implement anything else.
