"use client";

import Link from "next/link";
import { useEffect, useState } from "react";


import { useAuth } from "@/components/auth/auth-provider";
import { fetchBackendHealth, type ApiHealthResult } from "@/lib/api";
import { getApiBaseUrl, getAppName } from "@/lib/env";

type ConnectionState =
  | { status: "loading" }
  | { status: "ready"; result: ApiHealthResult };

export default function M1ShellPage() {
  const [state, setState] = useState<ConnectionState>({ status: "loading" });
  const appName = getAppName();
  const apiBaseUrl = getApiBaseUrl();
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();

  useEffect(() => {
    let cancelled = false;

    fetchBackendHealth().then((result) => {
      if (!cancelled) {
        setState({ status: "ready", result });
      }
    });

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col justify-center px-6 py-16">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium tracking-wide text-brand-600">
          Milestone M1 &amp; M2
        </p>
        <div className="flex items-center gap-2 text-xs">
          {authLoading ? (
            <span className="text-neutral-400">Loading auth…</span>
          ) : isAuthenticated ? (
            <Link
              href="/dashboard"
              className="rounded-lg bg-brand-600 px-3 py-1.5 font-medium text-white hover:bg-brand-700"
            >
              Go to Dashboard →
            </Link>
          ) : (
            <>
              <Link
                href="/login"
                className="rounded-lg border border-neutral-300 px-3 py-1.5 font-medium text-neutral-700 hover:bg-neutral-50"
              >
                Sign In
              </Link>
              <Link
                href="/signup"
                className="rounded-lg bg-brand-600 px-3 py-1.5 font-medium text-white hover:bg-brand-700"
              >
                Sign Up
              </Link>
            </>
          )}
        </div>
      </div>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight">{appName}</h1>
      <p className="mt-3 text-sm leading-6 text-neutral-600">
        Application shell &amp; authentication verification. This page verifies that
        the web app reaches the FastAPI backend and provides entry points to M2
        authenticated features.
      </p>

      {isAuthenticated && user && (
        <section className="mt-6 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-xs">
          <p className="font-semibold text-emerald-900">
            Authenticated as: <span className="font-normal">{user.email}</span>
          </p>
          <p className="text-emerald-700 mt-1">
            User ID: <span className="font-mono">{user.id}</span>
          </p>
        </section>
      )}

      <section className="mt-6 rounded-lg border border-neutral-200 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">
          Backend connectivity
        </h2>
        <p className="mt-2 break-all font-mono text-xs text-neutral-500">
          {apiBaseUrl}/health
        </p>
        <StatusPanel state={state} />
      </section>
    </main>
  );
}

function StatusPanel({ state }: { state: ConnectionState }) {
  if (state.status === "loading") {
    return (
      <p className="mt-4 text-sm text-neutral-700" role="status">
        Checking backend health…
      </p>
    );
  }

  if (state.result.ok) {
    const { data, latencyMs } = state.result;
    return (
      <div className="mt-4 space-y-1 text-sm">
        <p className="font-medium text-brand-600" role="status">
          Connected
        </p>
        <p className="text-neutral-700">
          {data.service} · {data.environment} · v{data.version} · {latencyMs} ms
        </p>
      </div>
    );
  }

  return (
    <div className="mt-4 space-y-1 text-sm">
      <p className="font-medium text-red-700" role="alert">
        Unable to reach backend
      </p>
      <p className="text-neutral-700">{state.result.error}</p>
      <p className="text-neutral-500">
        Confirm the API is running and CORS allows this origin.
      </p>
    </div>
  );
}
