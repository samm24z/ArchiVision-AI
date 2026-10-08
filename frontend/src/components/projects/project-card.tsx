import Link from "next/link";

import type { Project } from "@/lib/api";

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

const projectTypeLabels = {
  concept: "Concept",
  interior: "Interior",
  mixed: "Mixed",
} as const;

export function ProjectCard({ project }: { project: Project }) {
  return (
    <Link
      href={`/dashboard/projects/${project.id}`}
      className="group flex min-h-52 flex-col justify-between rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-brand-300 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2"
    >
      <div>
        <div className="flex items-start justify-between gap-4">
          <span className="rounded-full bg-brand-50 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-brand-600">
            {projectTypeLabels[project.project_type]}
          </span>
          {project.is_archived && (
            <span className="text-xs font-medium text-neutral-500">Archived</span>
          )}
        </div>
        <h2 className="mt-5 text-xl font-semibold tracking-tight text-neutral-950 group-hover:text-brand-600">
          {project.name}
        </h2>
        {project.description && (
          <p className="mt-2 line-clamp-2 text-sm leading-6 text-neutral-600">
            {project.description}
          </p>
        )}
      </div>
      <div className="mt-6 flex items-center justify-between gap-3 border-t border-neutral-100 pt-4 text-xs text-neutral-500">
        <span>{project.city || "Location not set"}</span>
        <span>Updated {formatDate(project.updated_at)}</span>
      </div>
    </Link>
  );
}