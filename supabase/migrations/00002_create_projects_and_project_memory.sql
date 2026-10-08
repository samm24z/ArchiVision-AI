-- =============================================================================
-- Migration: 00002_create_projects_and_project_memory.sql
-- Milestone: M3 — Projects Foundation
-- Description: Creates owned projects, one-to-one project memory, RLS policies,
--              supporting indexes, timestamp triggers, and atomic project creation.
-- =============================================================================

-- ----------------------------------------------------------------------------
-- 1. Projects
-- ----------------------------------------------------------------------------
CREATE TABLE public.projects (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    owner_id UUID NOT NULL REFERENCES auth.users(id),
    name TEXT NOT NULL,
    description TEXT,
    project_type TEXT NOT NULL CHECK (project_type IN ('concept', 'interior', 'mixed')),
    city TEXT,
    climate TEXT,
    cover_image_url TEXT,
    is_archived BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc'::text, NOW()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc'::text, NOW()),
    deleted_at TIMESTAMPTZ
);

-- ----------------------------------------------------------------------------
-- 2. Project memory
-- ----------------------------------------------------------------------------
CREATE TABLE public.project_memory (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL UNIQUE REFERENCES public.projects(id) ON DELETE CASCADE,
    brief TEXT,
    style_preferences JSONB,
    palette_preferences JSONB,
    material_preferences JSONB,
    constraints JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc'::text, NOW()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc'::text, NOW())
);

-- ----------------------------------------------------------------------------
-- 3. Timestamp triggers
-- ----------------------------------------------------------------------------
DROP TRIGGER IF EXISTS set_projects_updated_at ON public.projects;
CREATE TRIGGER set_projects_updated_at
    BEFORE UPDATE ON public.projects
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS set_project_memory_updated_at ON public.project_memory;
CREATE TRIGGER set_project_memory_updated_at
    BEFORE UPDATE ON public.project_memory
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

-- ----------------------------------------------------------------------------
-- 4. Required access-pattern indexes
-- ----------------------------------------------------------------------------
CREATE INDEX projects_owner_id_idx
    ON public.projects (owner_id);

CREATE INDEX projects_owner_id_deleted_at_idx
    ON public.projects (owner_id, deleted_at);

CREATE INDEX projects_owner_id_updated_at_idx
    ON public.projects (owner_id, updated_at DESC);

-- ----------------------------------------------------------------------------
-- 5. Row Level Security
-- ----------------------------------------------------------------------------
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_memory ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own projects"
    ON public.projects
    FOR SELECT
    USING (auth.uid() = owner_id);

CREATE POLICY "Users can create their own projects"
    ON public.projects
    FOR INSERT
    WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Users can update their own projects"
    ON public.projects
    FOR UPDATE
    USING (auth.uid() = owner_id)
    WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Users can delete their own projects"
    ON public.projects
    FOR DELETE
    USING (auth.uid() = owner_id);

CREATE POLICY "Users can view memory for their own projects"
    ON public.project_memory
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1
            FROM public.projects
            WHERE projects.id = project_memory.project_id
              AND projects.owner_id = auth.uid()
        )
    );

CREATE POLICY "Users can create memory for their own projects"
    ON public.project_memory
    FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1
            FROM public.projects
            WHERE projects.id = project_memory.project_id
              AND projects.owner_id = auth.uid()
        )
    );

CREATE POLICY "Users can update memory for their own projects"
    ON public.project_memory
    FOR UPDATE
    USING (
        EXISTS (
            SELECT 1
            FROM public.projects
            WHERE projects.id = project_memory.project_id
              AND projects.owner_id = auth.uid()
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1
            FROM public.projects
            WHERE projects.id = project_memory.project_id
              AND projects.owner_id = auth.uid()
        )
    );

CREATE POLICY "Users can delete memory for their own projects"
    ON public.project_memory
    FOR DELETE
    USING (
        EXISTS (
            SELECT 1
            FROM public.projects
            WHERE projects.id = project_memory.project_id
              AND projects.owner_id = auth.uid()
        )
    );

-- ----------------------------------------------------------------------------
-- 6. Atomic project and project-memory creation
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_project_with_memory(
    p_owner_id UUID,
    p_name TEXT,
    p_description TEXT DEFAULT NULL,
    p_project_type TEXT DEFAULT 'concept',
    p_city TEXT DEFAULT NULL,
    p_climate TEXT DEFAULT NULL,
    p_cover_image_url TEXT DEFAULT NULL
)
RETURNS SETOF public.projects
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
    created_project public.projects;
BEGIN
    IF auth.role() <> 'service_role' AND auth.uid() IS DISTINCT FROM p_owner_id THEN
        RAISE EXCEPTION 'project owner does not match authenticated user';
    END IF;

    INSERT INTO public.projects (
        owner_id,
        name,
        description,
        project_type,
        city,
        climate,
        cover_image_url
    )
    VALUES (
        p_owner_id,
        p_name,
        p_description,
        p_project_type,
        p_city,
        p_climate,
        p_cover_image_url
    )
    RETURNING * INTO created_project;

    INSERT INTO public.project_memory (project_id)
    VALUES (created_project.id);

    RETURN NEXT created_project;
END;
$$;

REVOKE ALL ON FUNCTION public.create_project_with_memory(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_project_with_memory(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) TO authenticated, service_role;