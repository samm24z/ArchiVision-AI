/** Shared API client for backend health, projects, and asset requests. */

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

export type AssetCategory =
  | "sketch"
  | "floor_plan"
  | "reference_image"
  | "document";

export type UploadStatus = "uploading" | "available" | "failed";

export type Asset = {
  id: string;
  project_id: string;
  category: AssetCategory;
  original_filename: string;
  storage_path: string;
  mime_type: string;
  file_size_bytes: number;
  width: number | null;
  height: number | null;
  metadata: Record<string, unknown> | null;
  upload_status: UploadStatus;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

export type SignedAssetUrl = {
  asset_id: string;
  signed_url: string;
  expires_in_seconds: number;
};

export const MAX_ASSET_SIZE_BYTES = 20 * 1024 * 1024; // 20 MiB = 20,971,520 bytes

export const CATEGORY_ALLOWED_FORMATS: Record<
  AssetCategory,
  { label: string; extensions: string[]; mimeTypes: string[]; description: string }
> = {
  sketch: {
    label: "Sketch",
    extensions: [".jpg", ".jpeg", ".png", ".webp"],
    mimeTypes: ["image/jpeg", "image/png", "image/webp"],
    description: "JPEG, PNG, WebP up to 20 MB",
  },
  floor_plan: {
    label: "Floor Plan",
    extensions: [".jpg", ".jpeg", ".png", ".pdf"],
    mimeTypes: ["image/jpeg", "image/png", "application/pdf"],
    description: "JPEG, PNG, PDF up to 20 MB",
  },
  reference_image: {
    label: "Reference Image",
    extensions: [".jpg", ".jpeg", ".png", ".webp"],
    mimeTypes: ["image/jpeg", "image/png", "image/webp"],
    description: "JPEG, PNG, WebP up to 20 MB",
  },
  document: {
    label: "Document",
    extensions: [".pdf"],
    mimeTypes: ["application/pdf"],
    description: "PDF up to 20 MB",
  },
};

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

/* -------------------------------------------------------------------------- */
/*                              M4 S4.2 Asset APIs                            */
/* -------------------------------------------------------------------------- */

export function fetchProjectAssets(
  token: string,
  projectId: string
): Promise<Asset[]> {
  return requestApi<Asset[]>(`/api/v1/projects/${projectId}/assets`, token);
}

export function fetchAssetMetadata(
  token: string,
  assetId: string
): Promise<Asset> {
  return requestApi<Asset>(`/api/v1/assets/${assetId}`, token);
}

export function getAssetSignedUrl(
  token: string,
  assetId: string
): Promise<SignedAssetUrl> {
  return requestApi<SignedAssetUrl>(`/api/v1/assets/${assetId}/signed-url`, token, {
    method: "POST",
  });
}

export function deleteAsset(token: string, assetId: string): Promise<void> {
  return requestApi<void>(`/api/v1/assets/${assetId}`, token, {
    method: "DELETE",
  });
}

export function uploadProjectAsset(
  token: string,
  projectId: string,
  file: File,
  category: AssetCategory,
  onProgress?: (percent: number) => void,
  abortSignal?: AbortSignal
): Promise<Asset> {
  return new Promise((resolve, reject) => {
    if (abortSignal?.aborted) {
      reject(new DOMException("Upload was cancelled.", "AbortError"));
      return;
    }

    const xhr = new XMLHttpRequest();
    const formData = new FormData();
    formData.append("category", category);
    formData.append("file", file);

    const onAbort = () => {
      xhr.abort();
      reject(new DOMException("Upload was cancelled.", "AbortError"));
    };

    if (abortSignal) {
      abortSignal.addEventListener("abort", onAbort, { once: true });
    }

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && onProgress) {
        const percent = Math.min(
          100,
          Math.round((event.loaded / event.total) * 100)
        );
        onProgress(percent);
      }
    };

    xhr.onload = () => {
      if (abortSignal) {
        abortSignal.removeEventListener("abort", onAbort);
      }

      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const data = JSON.parse(xhr.responseText) as Asset;
          resolve(data);
        } catch {
          reject(
            new ApiRequestError(
              xhr.status,
              "Invalid response received from server."
            )
          );
        }
      } else {
        let message = `Backend returned HTTP ${xhr.status}.`;
        try {
          const body = JSON.parse(xhr.responseText) as { detail?: string };
          if (body.detail) {
            message = body.detail;
          }
        } catch {
          // Fall back to status-based message.
        }
        reject(new ApiRequestError(xhr.status, message));
      }
    };

    xhr.onerror = () => {
      if (abortSignal) {
        abortSignal.removeEventListener("abort", onAbort);
      }
      reject(
        new ApiRequestError(
          0,
          "Network connection failure during upload. Please check your connection and try again."
        )
      );
    };

    xhr.ontimeout = () => {
      if (abortSignal) {
        abortSignal.removeEventListener("abort", onAbort);
      }
      reject(new ApiRequestError(408, "Upload timed out. Please try again."));
    };

    const url = `${getApiBaseUrl()}/api/v1/projects/${projectId}/assets`;
    xhr.open("POST", url);
    xhr.setRequestHeader("Authorization", `Bearer ${token}`);
    xhr.setRequestHeader("Accept", "application/json");
    // Do not set Content-Type header so browser computes multipart boundary automatically.
    xhr.send(formData);
  });
}
