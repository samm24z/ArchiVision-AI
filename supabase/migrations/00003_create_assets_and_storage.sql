-- =============================================================================
-- Migration: 00003_create_assets_and_storage.sql
-- Milestone: M4 — Storage & Assets
-- Description: Creates project-owned asset metadata, a private Storage bucket,
--              and defense-in-depth database/Storage ownership policies.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Asset metadata
-- -----------------------------------------------------------------------------
CREATE TABLE public.assets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    category TEXT NOT NULL CHECK (
        category IN ('sketch', 'floor_plan', 'reference_image', 'document')
    ),
    original_filename TEXT NOT NULL,
    storage_path TEXT NOT NULL UNIQUE,
    mime_type TEXT NOT NULL CHECK (
        mime_type IN ('image/jpeg', 'image/png', 'image/webp', 'application/pdf')
    ),
    CONSTRAINT assets_category_mime_check CHECK (
        (category = 'sketch' AND mime_type IN ('image/jpeg', 'image/png', 'image/webp'))
        OR (category = 'floor_plan' AND mime_type IN ('image/jpeg', 'image/png', 'application/pdf'))
        OR (category = 'reference_image' AND mime_type IN ('image/jpeg', 'image/png', 'image/webp'))
        OR (category = 'document' AND mime_type = 'application/pdf')
    ),
    file_size_bytes BIGINT NOT NULL CHECK (
        file_size_bytes >= 0 AND file_size_bytes <= 20971520
    ),
    width INTEGER,
    height INTEGER,
    metadata JSONB,
    upload_status TEXT NOT NULL CHECK (
        upload_status IN ('uploading', 'available', 'failed')
    ),
    created_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc'::text, NOW()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc'::text, NOW()),
    deleted_at TIMESTAMPTZ,
    CONSTRAINT assets_dimensions_check CHECK (
        (mime_type = 'application/pdf' AND width IS NULL AND height IS NULL)
        OR (
            mime_type <> 'application/pdf'
            AND width IS NOT NULL
            AND width > 0
            AND height IS NOT NULL
            AND height > 0
        )
    )
);

-- -----------------------------------------------------------------------------
-- 2. Timestamp and access-pattern indexes
-- -----------------------------------------------------------------------------
DROP TRIGGER IF EXISTS set_assets_updated_at ON public.assets;
CREATE TRIGGER set_assets_updated_at
    BEFORE UPDATE ON public.assets
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

CREATE INDEX assets_project_id_idx
    ON public.assets (project_id);

CREATE INDEX assets_project_id_deleted_at_idx
    ON public.assets (project_id, deleted_at);

CREATE INDEX assets_project_id_created_at_idx
    ON public.assets (project_id, created_at DESC);

-- -----------------------------------------------------------------------------
-- 3. Private Supabase Storage bucket
-- -----------------------------------------------------------------------------
INSERT INTO storage.buckets (
    id,
    name,
    public,
    file_size_limit,
    allowed_mime_types
)
VALUES (
    'project-assets',
    'project-assets',
    FALSE,
    20971520,
    ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf']::TEXT[]
)
ON CONFLICT (id) DO UPDATE
SET public = FALSE,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

-- -----------------------------------------------------------------------------
-- 4. Asset metadata RLS
-- -----------------------------------------------------------------------------
ALTER TABLE public.assets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view assets in their own projects"
    ON public.assets
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1
            FROM public.projects
            WHERE projects.id = assets.project_id
              AND projects.owner_id = auth.uid()
        )
    );

CREATE POLICY "Users can create assets in their own projects"
    ON public.assets
    FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1
            FROM public.projects
            WHERE projects.id = assets.project_id
              AND projects.owner_id = auth.uid()
        )
    );

CREATE POLICY "Users can update assets in their own projects"
    ON public.assets
    FOR UPDATE
    USING (
        EXISTS (
            SELECT 1
            FROM public.projects
            WHERE projects.id = assets.project_id
              AND projects.owner_id = auth.uid()
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1
            FROM public.projects
            WHERE projects.id = assets.project_id
              AND projects.owner_id = auth.uid()
        )
    );

CREATE POLICY "Users can delete assets in their own projects"
    ON public.assets
    FOR DELETE
    USING (
        EXISTS (
            SELECT 1
            FROM public.projects
            WHERE projects.id = assets.project_id
              AND projects.owner_id = auth.uid()
        )
    );

-- -----------------------------------------------------------------------------
-- 5. Storage object path ownership policies
-- -----------------------------------------------------------------------------

CREATE POLICY "Users can read assets in their own projects"
    ON storage.objects
    FOR SELECT
    USING (
        bucket_id = 'project-assets'
        AND array_length(string_to_array(name, '/'), 1) = 5
        AND split_part(name, '/', 1) = 'projects'
        AND split_part(name, '/', 3) = 'assets'
        AND split_part(name, '/', 2) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        AND split_part(name, '/', 4) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        AND split_part(name, '/', 5) <> ''
        AND EXISTS (
            SELECT 1
            FROM public.assets
            JOIN public.projects ON projects.id = assets.project_id
            WHERE assets.id = (
                CASE
                    WHEN split_part(name, '/', 4) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
                    THEN split_part(name, '/', 4)::UUID
                END
            )
              AND assets.project_id = (
                CASE
                    WHEN split_part(name, '/', 2) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
                    THEN split_part(name, '/', 2)::UUID
                END
              )
              AND assets.storage_path = name
              AND assets.upload_status = 'available'
              AND assets.deleted_at IS NULL
              AND projects.owner_id = auth.uid()
        )
    );

CREATE POLICY "Users can upload assets to their own projects"
    ON storage.objects
    FOR INSERT
    WITH CHECK (
        bucket_id = 'project-assets'
        AND array_length(string_to_array(name, '/'), 1) = 5
        AND split_part(name, '/', 1) = 'projects'
        AND split_part(name, '/', 3) = 'assets'
        AND split_part(name, '/', 2) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        AND split_part(name, '/', 4) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        AND split_part(name, '/', 5) <> ''
        AND EXISTS (
            SELECT 1
            FROM public.assets
            JOIN public.projects ON projects.id = assets.project_id
            WHERE assets.id = (
                CASE
                    WHEN split_part(name, '/', 4) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
                    THEN split_part(name, '/', 4)::UUID
                END
            )
              AND assets.project_id = (
                CASE
                    WHEN split_part(name, '/', 2) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
                    THEN split_part(name, '/', 2)::UUID
                END
              )
              AND assets.storage_path = name
              AND assets.upload_status = 'uploading'
              AND assets.deleted_at IS NULL
              AND projects.owner_id = auth.uid()
        )
    );

CREATE POLICY "Users can update assets in their own projects"
    ON storage.objects
    FOR UPDATE
    USING (
        bucket_id = 'project-assets'
        AND array_length(string_to_array(name, '/'), 1) = 5
        AND split_part(name, '/', 1) = 'projects'
        AND split_part(name, '/', 3) = 'assets'
        AND split_part(name, '/', 2) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        AND split_part(name, '/', 4) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        AND split_part(name, '/', 5) <> ''
        AND EXISTS (
            SELECT 1
            FROM public.assets
            JOIN public.projects ON projects.id = assets.project_id
            WHERE assets.id = (
                CASE
                    WHEN split_part(name, '/', 4) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
                    THEN split_part(name, '/', 4)::UUID
                END
            )
              AND assets.project_id = (
                CASE
                    WHEN split_part(name, '/', 2) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
                    THEN split_part(name, '/', 2)::UUID
                END
              )
              AND assets.storage_path = name
              AND assets.upload_status = 'available'
              AND assets.deleted_at IS NULL
              AND projects.owner_id = auth.uid()
        )
    )
    WITH CHECK (
        bucket_id = 'project-assets'
        AND array_length(string_to_array(name, '/'), 1) = 5
        AND split_part(name, '/', 1) = 'projects'
        AND split_part(name, '/', 3) = 'assets'
        AND split_part(name, '/', 2) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        AND split_part(name, '/', 4) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        AND split_part(name, '/', 5) <> ''
        AND EXISTS (
            SELECT 1
            FROM public.assets
            JOIN public.projects ON projects.id = assets.project_id
            WHERE assets.id = (
                CASE
                    WHEN split_part(name, '/', 4) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
                    THEN split_part(name, '/', 4)::UUID
                END
            )
              AND assets.project_id = (
                CASE
                    WHEN split_part(name, '/', 2) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
                    THEN split_part(name, '/', 2)::UUID
                END
              )
              AND assets.storage_path = name
              AND assets.upload_status = 'available'
              AND assets.deleted_at IS NULL
              AND projects.owner_id = auth.uid()
        )
    );

CREATE POLICY "Users can delete assets in their own projects"
    ON storage.objects
    FOR DELETE
    USING (
        bucket_id = 'project-assets'
        AND array_length(string_to_array(name, '/'), 1) = 5
        AND split_part(name, '/', 1) = 'projects'
        AND split_part(name, '/', 3) = 'assets'
        AND split_part(name, '/', 2) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        AND split_part(name, '/', 4) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        AND split_part(name, '/', 5) <> ''
        AND EXISTS (
            SELECT 1
            FROM public.assets
            JOIN public.projects ON projects.id = assets.project_id
            WHERE assets.id = (
                CASE
                    WHEN split_part(name, '/', 4) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
                    THEN split_part(name, '/', 4)::UUID
                END
            )
              AND assets.project_id = (
                CASE
                    WHEN split_part(name, '/', 2) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
                    THEN split_part(name, '/', 2)::UUID
                END
              )
              AND assets.storage_path = name
              AND assets.upload_status = 'available'
              AND assets.deleted_at IS NULL
              AND projects.owner_id = auth.uid()
        )
    );