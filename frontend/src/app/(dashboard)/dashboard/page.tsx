"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { useAuth } from "@/components/auth/auth-provider";
import { getApiBaseUrl } from "@/lib/env";

interface BackendProfileResult {
  status: "idle" | "loading" | "success" | "error";
  data?: {
    id: string;
    email: string | null;
    role: string;
    app_metadata: Record<string, unknown>;
    user_metadata: Record<string, unknown>;
  };
  error?: string;
}

export default function DashboardPage() {
  const router = useRouter();
  const { user, isLoading, signOut, getToken } = useAuth();
  const [backendCheck, setBackendCheck] = useState<BackendProfileResult>({
    status: "idle",
  });
  const apiBaseUrl = getApiBaseUrl();

  const handleSignOut = async () => {
    await signOut();
    router.push("/login");
    router.refresh();
  };

  const verifyBackendAuth = async () => {
    setBackendCheck({ status: "loading" });
    try {
      const token = await getToken();
      if (!token) {
        setBackendCheck({
          status: "error",
          error: "No active access token found in browser session.",
        });
        return;
      }

      const res = await fetch(`${apiBaseUrl}/api/v1/auth/me`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!res.ok) {
        const errorBody = await res.text();
        setBackendCheck({
          status: "error",
          error: `HTTP ${res.status}: ${errorBody}`,
        });
        return;
      }

      const data = await res.json();
      setBackendCheck({
        status: "success",
        data,
      });
    } catch (err) {
      setBackendCheck({
        status: "error",
        error:
          err instanceof Error
            ? err.message
            : "Network error reaching backend API.",
      });
    }
  };

  useEffect(() => {
    if (user) {
      verifyBackendAuth();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-neutral-50 p-6">
        <p className="text-sm text-neutral-600">Loading session…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-50 px-4 py-12 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-2xl space-y-6">
        {/* Header bar */}
        <header className="flex items-center justify-between rounded-xl border border-neutral-200 bg-white p-6 shadow-sm">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-brand-600">
              Milestone M2
            </p>
            <h1 className="text-xl font-bold tracking-tight text-neutral-900">
              ArchiVision AI Dashboard
            </h1>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="rounded-lg border border-neutral-200 px-3 py-1.5 text-xs font-medium text-neutral-700 hover:bg-neutral-50"
            >
              Public Shell
            </Link>
            <button
              onClick={handleSignOut}
              className="rounded-lg bg-neutral-900 px-3.5 py-1.5 text-xs font-medium text-white hover:bg-neutral-800"
            >
              Sign Out
            </button>
          </div>
        </header>

        {/* User Identity Card */}
        <section className="rounded-xl border border-neutral-200 bg-white p-6 shadow-sm space-y-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">
            Frontend Supabase Session
          </h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 text-sm">
            <div className="rounded-lg bg-neutral-50 p-3">
              <span className="text-xs text-neutral-500 block">Email</span>
              <span className="font-mono text-neutral-900 text-xs break-all">
                {user?.email || "N/A"}
              </span>
            </div>
            <div className="rounded-lg bg-neutral-50 p-3">
              <span className="text-xs text-neutral-500 block">User ID (sub)</span>
              <span className="font-mono text-neutral-900 text-xs break-all">
                {user?.id || "N/A"}
              </span>
            </div>
            <div className="rounded-lg bg-neutral-50 p-3">
              <span className="text-xs text-neutral-500 block">Full Name</span>
              <span className="text-neutral-900 text-xs font-medium">
                {(user?.user_metadata?.full_name as string) || "Not set"}
              </span>
            </div>
            <div className="rounded-lg bg-neutral-50 p-3">
              <span className="text-xs text-neutral-500 block">Created At</span>
              <span className="text-neutral-900 text-xs">
                {user?.created_at
                  ? new Date(user.created_at).toLocaleString()
                  : "N/A"}
              </span>
            </div>
          </div>
        </section>

        {/* Backend Handshake Verification Card */}
        <section className="rounded-xl border border-neutral-200 bg-white p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">
                FastAPI Authenticated Handshake
              </h2>
              <p className="text-xs text-neutral-500 font-mono mt-0.5">
                GET {apiBaseUrl}/api/v1/auth/me
              </p>
            </div>
            <button
              onClick={verifyBackendAuth}
              disabled={backendCheck.status === "loading"}
              className="rounded-md border border-neutral-300 px-2.5 py-1 text-xs font-medium text-neutral-700 hover:bg-neutral-50 disabled:opacity-50"
            >
              {backendCheck.status === "loading" ? "Checking…" : "Re-test"}
            </button>
          </div>

          {backendCheck.status === "loading" && (
            <p className="text-sm text-neutral-600">
              Forwarding JWT bearer token to FastAPI backend…
            </p>
          )}

          {backendCheck.status === "success" && backendCheck.data && (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 space-y-2">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-emerald-600" />
                <p className="text-sm font-semibold text-emerald-900">
                  Backend Verified JWT Token
                </p>
              </div>
              <p className="text-xs text-emerald-800">
                FastAPI decoded and validated the Supabase access token via PyJWT
                without external network latency.
              </p>
              <pre className="mt-2 overflow-x-auto rounded bg-white p-2.5 font-mono text-[11px] text-neutral-800 border border-emerald-100">
                {JSON.stringify(backendCheck.data, null, 2)}
              </pre>
            </div>
          )}

          {backendCheck.status === "error" && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 space-y-2">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-amber-600" />
                <p className="text-sm font-semibold text-amber-900">
                  Backend Verification Notice
                </p>
              </div>
              <p className="text-xs text-amber-800">{backendCheck.error}</p>
              <p className="text-xs text-neutral-500">
                Ensure backend is running with SUPABASE_JWT_SECRET configured in
                backend/.env.
              </p>
            </div>
          )}
        </section>

        {/* Milestone Note */}
        <p className="text-center text-xs text-neutral-500">
          ArchiVision AI — Milestone M2 Authentication Foundation. Projects and
          Studio features unlock in M3+.
        </p>
      </div>
    </div>
  );
}
