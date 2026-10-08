-- =============================================================================
-- Migration: 00001_create_profiles_and_auth_trigger.sql
-- Milestone: M2 — Authentication & User Profiles
-- Description: Creates public.profiles and public.user_preferences tables,
--              enables Row Level Security (RLS) with self-access policies,
--              and sets up an automated trigger on auth.users to bootstrap
--              profile and preference records on user signup.
-- =============================================================================

-- Enable UUID extension if not already available
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- -----------------------------------------------------------------------------
-- 1. Helper function for updated_at timestamps
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = TIMEZONE('utc'::text, NOW());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- -----------------------------------------------------------------------------
-- 2. Table: public.profiles
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name TEXT,
    avatar_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc'::text, NOW()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc'::text, NOW())
);

-- Profiles updated_at trigger
DROP TRIGGER IF EXISTS set_profiles_updated_at ON public.profiles;
CREATE TRIGGER set_profiles_updated_at
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

-- -----------------------------------------------------------------------------
-- 3. Table: public.user_preferences
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.user_preferences (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    theme TEXT NOT NULL DEFAULT 'dark',
    default_model TEXT NOT NULL DEFAULT 'qwen2.5-7b',
    notifications_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc'::text, NOW()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc'::text, NOW())
);

-- User preferences updated_at trigger
DROP TRIGGER IF EXISTS set_user_preferences_updated_at ON public.user_preferences;
CREATE TRIGGER set_user_preferences_updated_at
    BEFORE UPDATE ON public.user_preferences
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

-- -----------------------------------------------------------------------------
-- 4. Enable Row Level Security (RLS)
-- -----------------------------------------------------------------------------
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_preferences ENABLE ROW LEVEL SECURITY;

-- -----------------------------------------------------------------------------
-- 5. RLS Policies: public.profiles
-- -----------------------------------------------------------------------------
CREATE POLICY "Users can view their own profile"
    ON public.profiles
    FOR SELECT
    USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
    ON public.profiles
    FOR UPDATE
    USING (auth.uid() = id);

CREATE POLICY "Users can insert their own profile"
    ON public.profiles
    FOR INSERT
    WITH CHECK (auth.uid() = id);

-- -----------------------------------------------------------------------------
-- 6. RLS Policies: public.user_preferences
-- -----------------------------------------------------------------------------
CREATE POLICY "Users can view their own preferences"
    ON public.user_preferences
    FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own preferences"
    ON public.user_preferences
    FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own preferences"
    ON public.user_preferences
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- -----------------------------------------------------------------------------
-- 7. Trigger Function: handle_new_user
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
    user_full_name TEXT;
    user_avatar_url TEXT;
BEGIN
    -- Extract full name from raw_user_meta_data if present
    user_full_name := NULLIF(TRIM(NEW.raw_user_meta_data->>'full_name'), '');
    IF user_full_name IS NULL THEN
        user_full_name := NULLIF(TRIM(NEW.raw_user_meta_data->>'name'), '');
    END IF;

    user_avatar_url := NULLIF(TRIM(NEW.raw_user_meta_data->>'avatar_url'), '');

    -- Insert profile
    INSERT INTO public.profiles (id, full_name, avatar_url, created_at, updated_at)
    VALUES (NEW.id, user_full_name, user_avatar_url, TIMEZONE('utc'::text, NOW()), TIMEZONE('utc'::text, NOW()))
    ON CONFLICT (id) DO UPDATE
        SET full_name = COALESCE(EXCLUDED.full_name, public.profiles.full_name),
            avatar_url = COALESCE(EXCLUDED.avatar_url, public.profiles.avatar_url),
            updated_at = TIMEZONE('utc'::text, NOW());

    -- Insert user preferences
    INSERT INTO public.user_preferences (user_id, theme, default_model, notifications_enabled, created_at, updated_at)
    VALUES (NEW.id, 'dark', 'qwen2.5-7b', TRUE, TIMEZONE('utc'::text, NOW()), TIMEZONE('utc'::text, NOW()))
    ON CONFLICT (user_id) DO NOTHING;

    RETURN NEW;
END;
$$;

-- -----------------------------------------------------------------------------
-- 8. Trigger on auth.users
-- -----------------------------------------------------------------------------
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user();
