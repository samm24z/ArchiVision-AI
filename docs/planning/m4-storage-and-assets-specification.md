# M4 - Storage & Assets Specification

**Status:** Frozen  
**Version:** 1.0  
**Last updated:** 2026-10-08

## 1. Objective

M4 establishes the secure asset-management and Supabase Storage foundation used by later ArchiVision AI workflows.

M4 provides authenticated users with project-owned asset storage for sketches, floor plans, reference images, and documents. M4 does not process assets with AI and does not generate new design outputs.

Asset ownership is derived through:

```text
User -> Project -> Asset
```

The client never supplies or controls an asset owner. FastAPI derives the authenticated user from the verified M2 JWT and authorizes every operation through the asset's project owner.

## 2. Scope

M4 consists of:

- S4.1 - Asset & Storage Foundation
- S4.2 - Project Asset Workspace

S4.1 establishes the database, private Storage bucket, server-controlled upload/access/delete API, validation, ownership checks, and backend tests.

S4.2 adds the asset workspace to the existing project overview, including upload, progress, listing, preview/access, and archive/delete interactions.

M4 must not implement AI processing or generation.

## 3. S4.1 - Asset & Storage Foundation

S4.1 includes:

1. `assets` database table
2. Asset-to-project relationship
3. Asset categories and upload statuses
4. Private Supabase Storage bucket
5. Safe project-scoped storage paths
6. FastAPI-controlled multipart upload
7. Server-side file validation
8. Asset listing and metadata retrieval
9. Authorized signed URL issuance
10. Soft-deleted metadata with physical object removal
11. FastAPI ownership enforcement
12. Supabase Storage and database RLS defense in depth
13. Backend tests and staging verification

S4.1 does not include thumbnails, image transformation, AI processing, or generated assets.

## 4. S4.2 - Project Asset Workspace

S4.2 adds an Assets section to the existing project overview route:

```text
/dashboard/projects/[projectId]
```

The workspace includes:

- Upload asset control
- Allowed-format and 20 MB guidance
- Upload progress
- Uploading, success, and failure states
- Retry behavior where retry is safe
- Cancellation where technically appropriate
- Empty state
- Asset list or grid
- Asset metadata display
- Image preview through an authorized signed URL
- PDF access through an authorized signed URL
- Archive/delete confirmation
- Responsive and accessible controls

The workspace does not create public URLs and does not perform browser-direct public uploads.

## 5. Architecture

The approved upload flow is:

```text
Browser
  |
  | authenticated JWT, multipart/form-data
  v
FastAPI
  |
  | validate JWT and project ownership
  | validate category, extension, MIME, and size
  | generate asset UUID and safe storage path
  v
Private Supabase Storage
  |
  | object stored successfully
  v
Asset metadata in PostgreSQL
  |
  | metadata available
  v
Authorized signed URL, when requested
```

FastAPI is the primary authorization boundary for backend API requests and uses the existing M2 authentication dependency. The backend continues using the approved service-role architecture for server-side Supabase access.

Supabase RLS and Storage policies remain enabled as defense in depth for direct authenticated Supabase access. The service-role key is backend-only and must never be sent to the browser, placed in a `NEXT_PUBLIC_*` variable, returned by an API, or embedded in a client bundle.

Browser-direct public uploads are prohibited.

## 6. Data Model

Create a public `assets` table with the following fields:

```text
id                 UUID PRIMARY KEY
project_id         UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE
category           TEXT NOT NULL
original_filename  TEXT NOT NULL
storage_path       TEXT NOT NULL UNIQUE
mime_type          TEXT NOT NULL
file_size_bytes    BIGINT NOT NULL
width              INTEGER NULL
height             INTEGER NULL
metadata           JSONB NULL
upload_status      TEXT NOT NULL
created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
deleted_at         TIMESTAMPTZ NULL
```

### 6.1 Ownership

Assets do not have an `owner_id` column. Ownership is derived through `project_id`:

```text
assets.project_id -> projects.id -> projects.owner_id
```

Every backend asset operation must verify that the authenticated user owns the referenced project.

### 6.2 Foreign Key

`assets.project_id` references `public.projects(id)` with `ON DELETE CASCADE` for physical project deletion. Normal project deletion remains the M3 soft-delete behavior, so asset metadata and Storage objects are not removed merely because a project is archived.

M4 does not introduce physical project deletion. Normal M3 project deletion remains soft deletion. If a future milestone introduces physical project deletion, associated Storage objects must be physically removed or reconciled before asset metadata is allowed to disappear through the database cascade. M4 must not implement that future project-deletion workflow.

### 6.3 Categories

The initial allowed categories are:

- `sketch`
- `floor_plan`
- `reference_image`
- `document`

The following are not valid M4 categories:

- `generated_image`
- `render`
- `ai_result`
- `visualization`

### 6.4 Upload Status

The initial upload statuses are:

- `uploading`
- `available`
- `failed`

Only `available` assets are returned by normal asset listing and signed-URL operations. Failed or incomplete records are not user-accessible and require cleanup/reconciliation handling.

### 6.5 Constraints and Indexes

The database must enforce:

- UUID primary key
- Non-null `project_id`, category, filename, path, MIME type, file size, status, and timestamps
- Non-negative `file_size_bytes`
- Positive `width` and `height` when present
- `width` and `height` both nullable for PDFs
- `storage_path` uniqueness
- Category check constraint
- Upload-status check constraint
- `project_id` foreign key

Required indexes:

- `assets(project_id)`
- `assets(project_id, deleted_at)`
- `assets(project_id, created_at DESC)`
- The unique constraint/index on `storage_path`

No content-hash deduplication or speculative indexes are required. Duplicate uploads are allowed.

### 6.6 Timestamps and Soft Deletion

`updated_at` must be maintained by the existing database timestamp trigger/function convention.

Asset metadata deletion is soft deletion:

- Set `deleted_at = NOW()`.
- Do not return the record from normal asset listing.
- Do not issue signed URLs for the record.
- Keep the metadata row for audit/reconciliation purposes.

The corresponding Storage object is physically removed after authorization succeeds.

## 7. Storage Architecture

### 7.1 Bucket

Create one private bucket:

```text
project-assets
```

Purpose: private source assets belonging to ArchiVision AI projects.

Public buckets are prohibited for M4 assets.

### 7.2 Storage Path

Use this path convention:

```text
projects/{project_id}/assets/{asset_id}/{normalized_filename}
```

The `project_id` and `asset_id` are UUIDs generated by the server. The path must be generated by FastAPI and must never be accepted as an authoritative client value.

The asset UUID makes duplicate uploads safe without content-hash deduplication. The unique `storage_path` constraint prevents accidental object-path collisions.

### 7.3 Filename Rules

The server must normalize the client filename before using it in a path:

- Use only the basename; discard directory components.
- Reject or remove path separators, control characters, and traversal sequences.
- Normalize whitespace and trim leading/trailing whitespace.
- Preserve only a safe filename stem and the validated extension.
- Use a safe fallback filename when the normalized stem is empty.
- Do not use the raw client filename as a directory or project identifier.

Path construction must be independent of client-supplied directory syntax.

### 7.4 Access

Storage objects remain private. The browser receives access only through a signed URL issued after FastAPI has verified:

1. The JWT is valid.
2. The asset exists and is not soft-deleted.
3. The asset's project exists.
4. The authenticated user owns that project.

Signed URLs expire after 15 minutes. Raw service-role credentials and unrestricted Storage URLs are never returned.

## 8. Validation

Validation is mandatory on the server. Browser validation is only a usability aid.

### 8.1 Size

The maximum accepted asset size is exactly 20 MiB per asset:

```text
20 MiB = 20 x 1024 x 1024 = 20,971,520 bytes
```

`file_size_bytes` must be less than or equal to `20,971,520`.

The server must reject files above the limit before Storage upload with HTTP 413.

### 8.2 Allowed Types

Only these formats are accepted:

| Category of file | MIME type | Allowed extensions |
|---|---|---|
| JPEG | `image/jpeg` | `.jpg`, `.jpeg` |
| PNG | `image/png` | `.png` |
| WebP | `image/webp` | `.webp` |
| PDF | `application/pdf` | `.pdf` |

Category-to-format combinations are restricted to this matrix:

| Asset category | Allowed formats |
|---|---|
| `sketch` | JPEG, PNG, WebP |
| `floor_plan` | JPEG, PNG, PDF |
| `reference_image` | JPEG, PNG, WebP |
| `document` | PDF |

The server must reject any category/format combination outside this matrix.

SVG, DWG, DXF, ZIP, video, audio, and all other formats are rejected.

The server must validate the declared MIME type together with the filename extension and content signature where technically available. The browser-provided MIME value is not trusted by itself.

### 8.3 Dimensions

For JPEG, PNG, and WebP assets, store image width and height after successful validation.

For PDFs, `width` and `height` remain `NULL`.

M4 does not require PDF page rendering or image transformation.

### 8.4 Duplicate Uploads

Duplicate uploads are allowed. M4 must not calculate or enforce content-hash deduplication.

## 9. API Contract

All asset endpoints require the existing M2 Bearer JWT authentication dependency. The client never submits `owner_id`.

Ownership failures use HTTP 404 where revealing the existence of another user's project or asset would disclose protected information.

FastAPI errors follow the existing response convention:

```json
{"detail": "Human-readable message"}
```

### 9.1 Upload Asset

```text
POST /api/v1/projects/{project_id}/assets
```

Authentication: required.

Request: `multipart/form-data` containing:

- `file`: one uploaded file
- `category`: one of `sketch`, `floor_plan`, `reference_image`, `document`

The request must not contain an owner field or authoritative Storage path.

Server behavior:

1. Validate the JWT.
2. Verify project ownership.
3. Validate category, extension, content type, and size.
4. Generate the asset UUID and safe Storage path.
5. Upload to the private bucket.
6. Create or finalize the metadata record.
7. Return the available asset metadata.

Success: HTTP 201.

Possible errors:

- HTTP 400: malformed multipart request or invalid request shape
- HTTP 401: missing or invalid authentication
- HTTP 404: project does not exist, is unavailable, or is not owned by the user
- HTTP 413: file exceeds 20 MB
- HTTP 415: unsupported or inconsistent file type
- HTTP 422: invalid category or field validation failure
- HTTP 502/503: Storage or persistence failure

### 9.2 List Project Assets

```text
GET /api/v1/projects/{project_id}/assets
```

Authentication: required.

Returns active, available assets for an owned project, ordered by `created_at DESC`.

Soft-deleted, failed, and incomplete assets are excluded.

Success: HTTP 200 with an array of asset metadata. No signed URL is required for listing.

Ownership or project absence: HTTP 404.

### 9.3 Get Asset Metadata

```text
GET /api/v1/assets/{asset_id}
```

Authentication: required.

Returns metadata only when the asset is available, not soft-deleted, and belongs to a project owned by the authenticated user.

Success: HTTP 200.

Missing, deleted, or unauthorized asset: HTTP 404.

### 9.4 Obtain Signed Access URL

```text
POST /api/v1/assets/{asset_id}/signed-url
```

Authentication: required.

The server verifies ownership and active status, then creates a signed URL for the private `project-assets` object with a 15-minute expiry.

Response:

```json
{
  "asset_id": "uuid",
  "signed_url": "url",
  "expires_in_seconds": 900
}
```

Success: HTTP 200.

Missing, deleted, or unauthorized asset: HTTP 404.

Storage signing failure: HTTP 502/503.

### 9.5 Delete/Archive Asset

```text
DELETE /api/v1/assets/{asset_id}
```

Authentication: required.

The endpoint performs an authorized asset archive operation:

1. Verify JWT and project ownership.
2. Remove the private Storage object.
3. Soft-delete the metadata row.

Success: HTTP 204.

Missing, deleted, or unauthorized asset: HTTP 404.

Storage failure: HTTP 502/503; metadata remains active unless the object is confirmed absent.

The endpoint never performs an unowned physical delete and never exposes a permanent-delete claim to the client.

## 10. Lifecycle and Failure Handling

### 10.1 Upload

```text
upload request
    -> authentication
    -> project ownership check
    -> validation
    -> safe asset ID/path generation
    -> Storage object creation
    -> metadata creation/finalization
    -> available
```

An implementation may persist an `uploading` record when needed for operational reconciliation, but only a complete object plus metadata record may become `available`.

### 10.2 Storage Failure

If Storage upload fails:

- Return a Storage failure response.
- Do not return an available asset.
- Do not leave an active metadata record pointing to an object that was not created.

### 10.3 Metadata Failure

If the Storage object is created but metadata creation/finalization fails:

- Return a persistence failure response.
- Attempt best-effort physical removal of the newly created object.
- Do not claim atomicity that Supabase Storage and PostgreSQL cannot provide.
- Record the failure through the backend's operational logging/reconciliation mechanism without exposing secrets.

If cleanup itself fails, the object is an orphan requiring deliberate reconciliation; it must not become visible through normal asset APIs.

### 10.4 Delete

The normal delete flow is:

```text
authorized delete
    -> Storage object removal
    -> metadata soft-delete
```

If Storage deletion succeeds but metadata update fails, return a server/storage failure and flag the metadata for reconciliation. The object is gone, but the metadata must not be silently reported as successfully archived.

If metadata soft-delete succeeds but Storage deletion fails, the asset must remain unavailable through normal access and signed-URL APIs, and the failed physical cleanup must be retried/reconciled. The implementation must not claim that both systems changed atomically.

Repeated authorized deletion must be idempotent at the API boundary and must not affect another asset.

## 11. Security and RLS

### 11.1 FastAPI Ownership

FastAPI is the primary authorization boundary. Every operation must resolve:

```text
current_user.id
    -> projects.owner_id
    -> assets.project_id
```

The server must not trust:

- `owner_id` from request bodies
- user IDs from query parameters
- user IDs from URL parameters as proof of ownership
- client-provided Storage paths

Cross-user and cross-project access should return HTTP 404 rather than reveal protected resource existence.

### 11.2 Asset Table RLS

Enable RLS on `public.assets`.

Policies must enforce project ownership through an `EXISTS` relationship to `public.projects`:

- SELECT: only assets whose project is owned by `auth.uid()`
- INSERT: only assets whose project is owned by `auth.uid()`
- UPDATE: only assets whose project is owned by `auth.uid()` in both `USING` and `WITH CHECK`
- DELETE: only assets whose project is owned by `auth.uid()`

Soft-deleted assets may remain visible to authorized internal reconciliation processes but must not be returned by normal user-facing queries.

### 11.3 Storage Object Policies

The `project-assets` bucket is private and must have Storage policies for authenticated access only.

Storage object policies must ensure:

- The bucket is `project-assets`.
- The object path follows the project-scoped convention.
- The project UUID extracted from the path belongs to `auth.uid()`.
- Anonymous users cannot read, insert, update, or delete objects.
- A user cannot access an object under another user's project path.
- A user cannot use a project path to bypass the `assets` metadata ownership check.

FastAPI service-role operations must still perform the same ownership checks before Storage calls. Service-role access is not a substitute for authorization.

### 11.4 Public URL Policy

M4 assets are not public. Do not expose public bucket URLs or permanent public object URLs. Access is through authorized signed URLs only.

## 12. S4.2 Frontend Experience

The existing project overview receives an Assets section.

### 12.1 Upload

Provide:

- File selection control
- Category selection
- Allowed-format guidance
- 20 MB limit guidance
- Upload progress
- Disabled duplicate-submit state
- Success and failure feedback
- Safe retry behavior
- Cancellation where supported by the selected upload implementation

The browser sends the user's access token to FastAPI. It does not send service-role credentials and does not upload directly to a public bucket.

### 12.2 Asset List and Access

Display available assets with:

- Original filename
- Category
- MIME type
- File size
- Image dimensions when present
- Created date
- Current upload status where relevant

Images may be previewed only with an authorized 15-minute signed URL. PDFs may be opened or downloaded only through an authorized signed URL.

M4 does not generate thumbnails.

### 12.3 Delete

Provide an archive/delete action with confirmation. Explain that the asset is removed from the active workspace while the metadata lifecycle is handled by the backend.

After success, remove the asset from the active list. Do not claim a permanent metadata deletion.

### 12.4 States and Accessibility

Provide:

- Empty state
- Loading state
- Uploading state
- Success state
- Failure state
- Retry state
- Preview/access failure state
- Delete confirmation state
- Keyboard-accessible controls
- Labels and status announcements for upload progress
- Responsive behavior on mobile and desktop

## 13. Error Handling

Use the existing FastAPI error shape and never expose stack traces, service credentials, or Storage internals.

| Condition | Expected status |
|---|---:|
| Malformed request | 400 |
| Missing/invalid JWT | 401 |
| Authenticated operation forbidden without resource disclosure | 404 |
| Missing project or asset | 404 |
| File exceeds 20 MB | 413 |
| Unsupported/inconsistent type | 415 |
| Invalid category or fields | 422 |
| Storage failure | 502 or 503 |
| Metadata/database failure | 502 or 503 |
| Unexpected backend failure | 500 |
| Network failure in frontend | Client-visible retryable error |

The frontend must show useful messages for these conditions without displaying raw backend stack traces.

## 14. Testing Requirements

### 14.1 Database

Verify:

- `assets` table exists
- Required columns and nullability
- Project foreign key and delete behavior
- Category and upload-status constraints
- File-size and dimension constraints
- Required indexes
- `storage_path` uniqueness
- `created_at`, `updated_at`, and `deleted_at`
- Soft-delete query behavior

### 14.2 Storage

Verify:

- Private `project-assets` bucket
- No public access
- Storage object policies
- Authorized object access
- Unauthorized object denial
- Signed URL creation
- Signed URL expiry of 15 minutes
- Anonymous access denied

### 14.3 Upload Validation

Verify:

- Valid JPEG
- Valid PNG
- Valid WebP
- Valid PDF
- Invalid MIME type
- Invalid extension/content mismatch
- Oversized file
- Unsafe filename
- Path traversal attempt
- Duplicate upload allowed
- Correct image dimensions
- Nullable PDF dimensions

### 14.4 Ownership and Lifecycle

Verify:

- User A cannot list User B assets
- User A cannot retrieve User B assets
- User A cannot access assets in User B's project
- User A cannot issue a signed URL for User B's asset
- User A cannot delete User B's asset
- Successful upload
- Storage failure handling
- Metadata failure handling
- Orphan cleanup/reconciliation behavior
- Soft deletion
- Physical Storage object removal
- Metadata retention after deletion

### 14.5 API and Frontend

Verify:

- Authentication and status codes
- Ownership behavior
- Error response format
- Empty state
- Upload control
- Progress state
- Success state
- Failure and retry state
- Image preview
- PDF access
- Delete confirmation
- Responsive behavior
- Accessibility behavior

## 15. Production Verification

Use a development or staging Supabase project, never an unapproved production target.

Before verification:

- Confirm the target project identity without printing secrets.
- Confirm the private bucket exists.
- Confirm the `assets` table and policies exist.
- Confirm no production data will be modified.

Verification procedure:

1. Create disposable User A and User B, or use dedicated existing test accounts.
2. Upload one temporary User A asset through FastAPI.
3. Verify the asset metadata and Storage object exist.
4. Verify User A can list and retrieve the asset metadata.
5. Verify User A can obtain a 15-minute signed URL.
6. Verify User B cannot list, retrieve, sign, or delete User A's asset.
7. Verify User B cannot access an asset in User A's project.
8. Verify anonymous access is denied.
9. Verify the asset can be archived through the API.
10. Verify the metadata row remains soft-deleted.
11. Verify the Storage object is physically removed.
12. Verify failed upload/cleanup behavior where safe fault injection is available.
13. Remove only disposable test users and data through approved cleanup procedures.

Never print passwords, access tokens, service-role keys, signed URLs, or other secrets. Report only safe identifiers and statuses.

## 16. Out of Scope

M4 explicitly excludes:

- AI image generation
- Image transformation
- Sketch interpretation
- Floor-plan AI analysis
- Embeddings
- ChromaDB
- RAG
- AI Copilot
- Job queues
- Background workers
- Model inference
- Generated design pipelines
- Cost estimation
- Sustainability analysis
- Collaboration
- Sharing
- Thumbnails
- Advanced image processing
- Asset versioning unless explicitly required by a later approved specification
- Generated-image, render, AI-result, or visualization asset categories

## 17. Acceptance Criteria

M4 is complete only when:

- The `assets` schema exists and matches this contract.
- The private `project-assets` bucket exists.
- Storage paths are server-generated and project-scoped.
- Only JPEG, PNG, WebP, and PDF files are accepted.
- The 20 MB limit is enforced server-side.
- Image dimensions are stored and PDF dimensions remain nullable.
- Uploads are controlled by FastAPI.
- Asset ownership is derived through the project.
- Database and Storage RLS/policies prevent cross-user and cross-project access.
- Signed URLs are authorized and expire after 15 minutes.
- Asset metadata is soft-deleted and Storage objects are physically removed.
- Duplicate uploads remain allowed.
- Thumbnails and AI processing are absent from M4.
- S4.1 API tests pass.
- S4.2 workspace states and access behavior pass.
- Staging verification passes without exposing secrets.
- Existing M2/M3 authentication and project behavior remain functional.

## 18. Implementation Order

Implementation must happen in this order:

```text
M4
  |
  +-- S4.1 Database + Storage + Assets API
  |
  +-- S4.1 verification
  |
  +-- S4.2 Project Asset Workspace
  |
  +-- S4.2 verification
  |
  +-- Production/staging verification
```

Do not implement S4.2 before S4.1 database, Storage, API, and security verification is complete.

Do not implement M5 or later AI workflows during M4.

## 19. Open Decisions

No architecture decisions remain open for the approved M4 contract.

Implementation may choose compatible libraries and internal module boundaries, but it must preserve the bucket privacy, 20 MB limit, four-format allowlist, FastAPI-controlled upload flow, 15-minute signed URLs, ownership chain, soft-delete/physical-object-delete behavior, and M4 scope defined here.
