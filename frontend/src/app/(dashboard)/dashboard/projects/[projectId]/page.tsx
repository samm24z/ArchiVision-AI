"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { useAuth } from "@/components/auth/auth-provider";
import { ProjectForm } from "@/components/projects/project-form";
import {
  ApiRequestError,
  archiveProject,
  fetchProject,
  type Project,
  type ProjectCreateInput,
  type ProjectUpdateInput,
  updateProject,
} from "@/lib/api";

const projectTypeLabels = {
  concept: "Concept",
  interior: "Interior",
  mixed: "Mixed",
} as const;

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

export default function ProjectOverviewPage() {
  const params = useParams<{ projectId: string }>();
  const router = useRouter();
  const { user, isLoading: authLoading, getToken, signOut } = useAuth();
  const [project, setProject] = useState<Project | null>(null);
  const [loadState, setLoadState] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isArchiving, setIsArchiving] = useState(false);
  const [archivePending, setArchivePending] = useState(false);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.replace(`/login?next=/dashboard/projects/${params.projectId}`);
      return;
    }

    let cancelled = false;
    const loadProject = async () => {
      try {
        const token = await getToken();
        if (!token) throw new Error("Your session has expired. Please sign in again.");
        const data = await fetchProject(token, params.projectId);
        if (!cancelled) {
          setProject(data);
          setLoadState("ready");
        }
      } catch (loadError) {
        if (cancelled) return;
        if (loadError instanceof ApiRequestError && loadError.status === 401) {
          await signOut();
          router.replace(`/login?next=/dashboard/projects/${params.projectId}`);
          return;
        }
        setError(
          loadError instanceof ApiRequestError && loadError.status === 404
            ? "This project is unavailable or has been archived."
            : loadError instanceof Error
              ? loadError.message
              : "Unable to load this project."
        );
        setLoadState("error");
      }
    };

    void loadProject();
    return () => {
      cancelled = true;
    };
  }, [authLoading, getToken, params.projectId, router, signOut, user]);

  const handleSave = async (input: ProjectCreateInput | ProjectUpdateInput) => {
    setIsSaving(true);
    setError(null);
    try {
      const token = await getToken();
      if (!token) throw new Error("Your session has expired. Please sign in again.");
      const updated = await updateProject(token, params.projectId, input as ProjectUpdateInput);
      setProject(updated);
      setIsEditing(false);
    } catch (saveError) {
      if (saveError instanceof ApiRequestError && saveError.status === 401) {
        await signOut();
        router.replace(`/login?next=/dashboard/projects/${params.projectId}`);
        return;
      }
      setError(saveError instanceof Error ? saveError.message : "Unable to save changes.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleArchive = async () => {
    setIsArchiving(true);
    setError(null);
    try {
      const token = await getToken();
      if (!token) throw new Error("Your session has expired. Please sign in again.");
      await archiveProject(token, params.projectId);
      router.replace("/dashboard");
      router.refresh();
    } catch (archiveError) {
      if (archiveError instanceof ApiRequestError && archiveError.status === 401) {
        await signOut();
        router.replace(`/login?next=/dashboard/projects/${params.projectId}`);
        return;
      }
      setError(archiveError instanceof Error ? archiveError.message : "Unable to archive this project.");
      setIsArchiving(false);
      setArchivePending(false);
    }
  };

  if (authLoading || loadState === "loading") return <OverviewLoading />;

  if (loadState === "error" || !project) {
    return (
      <main className="min-h-screen bg-neutral-50 px-4 py-8 sm:px-6 lg:px-10">
        <div className="mx-auto max-w-4xl">
          <Link href="/dashboard" className="text-sm font-medium text-brand-600 hover:text-brand-900">← Back to projects</Link>
          <section className="mt-12 rounded-2xl border border-neutral-200 bg-white p-8 shadow-sm" role="alert">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-neutral-500">Project not found</p>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight text-neutral-950">This project is unavailable.</h1>
            <p className="mt-3 text-sm leading-6 text-neutral-600">{error}</p>
            <Link href="/dashboard" className="mt-6 inline-flex button-primary">Return to project hub</Link>
          </section>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-neutral-50 px-4 py-8 sm:px-6 lg:px-10">
      <div className="mx-auto max-w-4xl">
        <Link href="/dashboard" className="text-sm font-medium text-brand-600 hover:text-brand-900">← Back to projects</Link>
        <header className="mt-8 flex flex-col gap-6 border-b border-neutral-200 pb-8 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <span className="rounded-full bg-brand-50 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-brand-600">
              {projectTypeLabels[project.project_type]}
            </span>
            <h1 className="mt-5 text-4xl font-semibold tracking-tight text-neutral-950">{project.name}</h1>
            <p className="mt-3 text-sm text-neutral-500">{project.is_archived ? "Archived project" : "Active project"}</p>
          </div>
          <div className="flex flex-wrap gap-3">
            {!isEditing && <button type="button" onClick={() => setIsEditing(true)} className="button-secondary">Edit project</button>}
            <button type="button" onClick={() => setArchivePending(true)} disabled={isArchiving || archivePending} className="button-secondary text-red-700 hover:bg-red-50">Archive</button>
          </div>
        </header>

        {error && <div className="mt-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800" role="alert">{error}</div>}

        {archivePending && (
          <section className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-5" role="alertdialog" aria-labelledby="archive-heading">
            <h2 id="archive-heading" className="font-semibold text-amber-950">Archive this project?</h2>
            <p className="mt-1 text-sm leading-6 text-amber-900">It will leave your active project hub. The project is archived, not permanently deleted.</p>
            <div className="mt-4 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button type="button" onClick={() => setArchivePending(false)} className="button-secondary">Keep project</button>
              <button type="button" onClick={handleArchive} disabled={isArchiving} className="button-primary bg-red-700 hover:bg-red-800">{isArchiving ? "Archiving..." : "Archive project"}</button>
            </div>
          </section>
        )}

        {isEditing ? (
          <section className="mt-8 rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm sm:p-7">
            <div className="mb-6">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-brand-600">Project details</p>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight text-neutral-950">Edit project</h2>
            </div>
            <ProjectForm mode="edit" initialProject={project} isSubmitting={isSaving} error={error} onCancel={() => { setIsEditing(false); setError(null); }} onSubmit={handleSave} />
          </section>
        ) : (
          <section className="mt-8 grid gap-5 sm:grid-cols-2">
            <InfoItem label="Description" value={project.description || "Not set"} wide />
            <InfoItem label="City" value={project.city || "Not set"} />
            <InfoItem label="Climate" value={project.climate || "Not set"} />
            <InfoItem label="Created" value={formatDate(project.created_at)} />
            <InfoItem label="Last updated" value={formatDate(project.updated_at)} />
            <InfoItem label="Status" value={project.is_archived ? "Archived" : "Active"} />
          </section>
        )}

        <section className="mt-8 rounded-2xl border border-dashed border-neutral-300 bg-white p-6 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-neutral-500">Project memory foundation</p>
          <h2 className="mt-2 text-xl font-semibold tracking-tight text-neutral-950">Ready for your design context</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-neutral-600">Project memory is prepared for future milestones. AI generation and uploads are not part of this project yet.</p>
        </section>
      </div>
    </main>
  );
}

function InfoItem({ label, value, wide = false }: { label: string; value: string; wide?: boolean }) {
  return (
    <div className={`rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm ${wide ? "sm:col-span-2" : ""}`}>
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-neutral-500">{label}</p>
      <p className="mt-2 text-sm leading-6 text-neutral-900">{value}</p>
    </div>
  );
}

function OverviewLoading() {
  return (
    <main className="min-h-screen bg-neutral-50 px-4 py-8 sm:px-6 lg:px-10">
      <div className="mx-auto max-w-4xl" aria-busy="true" aria-label="Loading project">
        <div className="h-4 w-32 animate-pulse rounded bg-neutral-200" />
        <div className="mt-12 h-12 w-80 animate-pulse rounded bg-neutral-200" />
        <div className="mt-8 grid gap-5 sm:grid-cols-2">
          {[1, 2, 3, 4].map((item) => <div key={item} className="h-28 animate-pulse rounded-2xl bg-white shadow-sm" />)}
        </div>
      </div>
    </main>
  );
}
