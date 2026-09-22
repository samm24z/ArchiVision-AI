/**
 * Minimal API client for M1 connectivity checks.
 */

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
