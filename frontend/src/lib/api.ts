/** Shared API client for backend health and authenticated project requests. */

import { getApiBaseUrl } from "./env";

export type HealthResponse = {
  status: string;
  service: string;
  version: string;
  environment: string;
};

export type ApiHealthResult =
  | { ok: true; data: HealthResponse; latencyMs: number }
  | { ok: false; error: string };

export type ProjectType = "concept" | "interior" | "mixed";

export type Project = {
  id: string;
  owner_id: string;
  name: string;
  description: string | null;
  project_type: ProjectType;
  city: string | null;
  climate: string | null;
  cover_image_url: string | null;
  is_archived: boolean;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

export type ProjectCreateInput = {
  name: string;
  project_type: ProjectType;
  description?: string;
  city?: string;
  climate?: string;
  cover_image_url?: string;
};

export type ProjectUpdateInput = Partial<
  Pick<
    Project,
    "name" | "description" | "project_type" | "city" | "climate" | "cover_image_url"
  >
>;

export class ApiRequestError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiRequestError";
    this.status = status;
  }
}

const HEALTH_TIMEOUT_MS = 10_000;

export async function fetchBackendHealth(): Promise<ApiHealthResult> {
  const apiBaseUrl = getApiBaseUrl();
  const startedAt = Date.now();

  try {
    const response = await fetch(`${apiBaseUrl}/health`, {
      method: "GET",
      headers: { Accept: "application/json" },
      cache: "no-store",
      signal: AbortSignal.timeout(HEALTH_TIMEOUT_MS),
    });

    const latencyMs = Date.now() - startedAt;

    if (!response.ok) {
      return {
        ok: false,
        error: `Backend returned HTTP ${response.status}`,
      };
    }

    const data = (await response.json()) as HealthResponse;

    if (data.status !== "ok") {
      return {
        ok: false,
        error: `Unexpected backend status: ${data.status}`,
      };
    }

    return { ok: true, data, latencyMs };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown connection error";

    return {
      ok: false,
      error: message,
    };
  }
}

const PROJECT_TIMEOUT_MS = 10_000;

async function requestApi<T>(
  path: string,
  token: string,
  options: RequestInit = {}
): Promise<T> {
  const response = await fetch(`${getApiBaseUrl()}${path}`, {
    ...options,
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${token}`,
      ...options.headers,
    },
    cache: "no-store",
    signal: AbortSignal.timeout(PROJECT_TIMEOUT_MS),
  });

  if (!response.ok) {
    let message = `Backend returned HTTP ${response.status}.`;
    try {
      const body = (await response.json()) as { detail?: string };
      if (body.detail) {
        message = body.detail;
      }
    } catch {
      // Keep the status-based message when the backend has no JSON error body.
    }
    throw new ApiRequestError(response.status, message);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

export function fetchProjects(token: string): Promise<Project[]> {
  return requestApi<Project[]>("/api/v1/projects", token);
}

export function fetchProject(token: string, projectId: string): Promise<Project> {
  return requestApi<Project>(`/api/v1/projects/${projectId}`, token);
}

export function createProject(
  token: string,
  input: ProjectCreateInput
): Promise<Project> {
  return requestApi<Project>("/api/v1/projects", token, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
}

export function updateProject(
  token: string,
  projectId: string,
  input: ProjectUpdateInput
): Promise<Project> {
  return requestApi<Project>(`/api/v1/projects/${projectId}`, token, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
}

export function archiveProject(token: string, projectId: string): Promise<void> {
  return requestApi<void>(`/api/v1/projects/${projectId}`, token, {
    method: "DELETE",
  });
}
