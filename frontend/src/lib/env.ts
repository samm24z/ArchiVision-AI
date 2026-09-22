/**
 * Frontend environment configuration.
 * Reads Next.js public environment variables with safe defaults for local dev.
 */

const DEFAULT_API_URL = "http://localhost:8000";

export function getApiBaseUrl(): string {
  return process.env.NEXT_PUBLIC_API_URL?.trim() || DEFAULT_API_URL;
}

export function getAppName(): string {
  return process.env.NEXT_PUBLIC_APP_NAME?.trim() || "ArchiVision AI";
}

export function getAppUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL?.trim() || "http://localhost:3000";
}
