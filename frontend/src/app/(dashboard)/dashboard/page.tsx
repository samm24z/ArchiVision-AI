"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { useAuth } from "@/components/auth/auth-provider";
import { ProjectCard } from "@/components/projects/project-card";
import { ProjectForm } from "@/components/projects/project-form";
import {
  ApiRequestError,
  createProject,
  fetchProjects,
  type Project,
  type ProjectCreateInput,
  type ProjectUpdateInput,
} from "@/lib/api";

export default function DashboardPage() {
  const router = useRouter();
  const { user, isLoading: authLoading, getToken, signOut } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loadState, setLoadState] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState<string | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.replace("/login?next=/dashboard");
      return;
    }

    let cancelled = false;
    setLoadState("loading");

    const loadProjects = async () => {
      try {
        const token = await getToken();
        if (!token) throw new Error("Your session has expired. Please sign in again.");
        const data = await fetchProjects(token);
        if (!cancelled) {
          setProjects(data);
          setError(null);
          setLoadState("ready");
        }
      } catch (loadError) {
        if (cancelled) return;
        if (loadError instanceof ApiRequestError && loadError.status === 401) {
          await signOut();
          router.replace("/login?next=/dashboard");
          return;
        }
        setError(loadError instanceof Error ? loadError.message : "Unable to load your projects.");
        setLoadState("error");
      }
    };

    void loadProjects();
    return () => {
      cancelled = true;
    };
  }, [authLoading, getToken, router, signOut, user]);

  const handleCreate = async (input: ProjectCreateInput | ProjectUpdateInput) => {
    setIsCreating(true);
    setError(null);
    try {
      const token = await getToken();
      if (!token) throw new Error("Your session has expired. Please sign in again.");
      const created = await createProject(token, input as ProjectCreateInput);
      router.push(`/dashboard/projects/${created.id}`);
    } catch (createError) {
      if (createError instanceof ApiRequestError && createError.status === 401) {
        await signOut();
        router.replace("/login?next=/dashboard");
        return;
      }
      setError(createError instanceof Error ? createError.message : "Unable to create the project.");
      setIsCreating(false);
    }
  };

  const handleSignOut = async () => {
    await signOut();
    router.replace("/login");
  };

  if (authLoading || (!user && loadState === "loading")) {
    return <DashboardLoading />;
  }

  return (
    <main className="min-h-screen bg-neutral-50 px-4 py-8 sm:px-6 lg:px-10">
      <div className="mx-auto max-w-6xl">
        <header className="flex flex-col gap-6 border-b border-neutral-200 pb-8 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <Link href="/" className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-600">
              ArchiVision AI
            </Link>
            <p className="mt-8 text-xs font-semibold uppercase tracking-[0.18em] text-neutral-500">Project hub</p>
            <h1 className="mt-2 text-4xl font-semibold tracking-tight text-neutral-950 sm:text-5xl">Your projects</h1>
            <p className="mt-3 max-w-xl text-sm leading-6 text-neutral-600">
              Keep every architectural idea in one place, ready for the next design decision.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-sm text-neutral-500">
              {projects.length} {projects.length === 1 ? "project" : "projects"}
            </span>
            <button type="button" onClick={() => setIsCreateOpen((open) => !open)} className="button-primary" aria-expanded={isCreateOpen}>
              {isCreateOpen ? "Close form" : "Create project"}
            </button>
            <button type="button" onClick={handleSignOut} className="button-secondary">Sign out</button>
          </div>
        </header>

        {isCreateOpen && (
          <section className="mt-8 max-w-3xl rounded-2xl border border-brand-100 bg-brand-50/50 p-5 sm:p-7">
            <div className="mb-6">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-brand-600">New project</p>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight text-neutral-950">Start with the essentials</h2>
            </div>
            <ProjectForm
              mode="create"
              isSubmitting={isCreating}
              error={error}
              onCancel={() => {
                setIsCreateOpen(false);
                setError(null);
              }}
              onSubmit={handleCreate}
            />
          </section>
        )}

        {loadState === "error" && (
          <section className="mt-8 rounded-2xl border border-red-200 bg-red-50 p-5" role="alert">
            <h2 className="font-semibold text-red-950">Projects are unavailable</h2>
            <p className="mt-1 text-sm text-red-800">{error}</p>
            <button type="button" onClick={() => window.location.reload()} className="mt-4 button-secondary">Try again</button>
          </section>
        )}

        {loadState === "ready" && projects.length === 0 && !isCreateOpen && (
          <section className="mt-10 rounded-2xl border border-dashed border-neutral-300 bg-white px-6 py-16 text-center shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-600">A clear beginning</p>
            <h2 className="mx-auto mt-3 max-w-lg text-3xl font-semibold tracking-tight text-neutral-950">Your first project starts here.</h2>
            <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-neutral-600">
              Create a project to give your ideas a home and build the context for every design step ahead.
            </p>
            <button type="button" onClick={() => setIsCreateOpen(true)} className="mt-7 button-primary">Create your first project</button>
          </section>
        )}

        {loadState === "ready" && projects.length > 0 && (
          <section className="mt-10" aria-labelledby="project-list-heading">
            <div className="flex items-baseline justify-between gap-4">
              <h2 id="project-list-heading" className="text-xl font-semibold text-neutral-950">Active projects</h2>
              <p className="text-xs text-neutral-500">Recently updated first</p>
            </div>
            <div className="mt-5 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
              {projects.map((project) => <ProjectCard key={project.id} project={project} />)}
            </div>
          </section>
        )}
      </div>
    </main>
  );
}

function DashboardLoading() {
  return (
    <main className="min-h-screen bg-neutral-50 px-4 py-8 sm:px-6 lg:px-10">
      <div className="mx-auto max-w-6xl" aria-busy="true" aria-label="Loading projects">
        <div className="h-4 w-36 animate-pulse rounded bg-neutral-200" />
        <div className="mt-12 h-12 w-72 animate-pulse rounded bg-neutral-200" />
        <div className="mt-4 h-5 w-full max-w-lg animate-pulse rounded bg-neutral-200" />
        <div className="mt-10 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((item) => <div key={item} className="h-52 animate-pulse rounded-2xl bg-white shadow-sm" />)}
        </div>
      </div>
    </main>
  );
}
