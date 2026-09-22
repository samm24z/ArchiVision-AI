"use client";

import { useEffect, useState } from "react";

import { fetchBackendHealth, type ApiHealthResult } from "@/lib/api";
import { getApiBaseUrl, getAppName } from "@/lib/env";

type ConnectionState =
  | { status: "loading" }
  | { status: "ready"; result: ApiHealthResult };

export default function M1ShellPage() {
  const [state, setState] = useState<ConnectionState>({ status: "loading" });
  const appName = getAppName();
  const apiBaseUrl = getApiBaseUrl();

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
      <p className="text-sm font-medium tracking-wide text-brand-600">
        Milestone M1
      </p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight">{appName}</h1>
      <p className="mt-3 text-sm leading-6 text-neutral-600">
        Application shell. This page verifies that the web app can reach the
        FastAPI backend. Product features begin in later milestones.
      </p>

      <section className="mt-8 rounded-lg border border-neutral-200 bg-white p-5 shadow-sm">
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
