"use client";

import React, { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

import { useAuth } from "@/components/auth/auth-provider";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { signIn, isAuthenticated } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Safe redirect destination
  const rawNext = searchParams.get("next");
  const nextUrl =
    rawNext && rawNext.startsWith("/") && !rawNext.startsWith("//")
      ? rawNext
      : "/dashboard";

  // If already authenticated, redirect
  React.useEffect(() => {
    if (isAuthenticated) {
      router.replace(nextUrl);
    }
  }, [isAuthenticated, nextUrl, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!email.trim() || !password) {
      setError("Please enter both email and password.");
      return;
    }

    setLoading(true);

    try {
      const result = await signIn(email, password);

      if (result.error) {
        setError(result.error);
        setLoading(false);
      } else {
        router.push(nextUrl);
        router.refresh();
      }
    } catch {
      setError("An unexpected error occurred. Please try again.");
      setLoading(false);
    }
  };

  return (
    <div>
      <div className="mb-6 text-center">
        <h1 className="text-2xl font-bold tracking-tight text-neutral-900">
          Sign in to your account
        </h1>
        <p className="mt-2 text-sm text-neutral-600">
          Welcome back to ArchiVision AI
        </p>
      </div>

      {error && (
        <div
          className="mb-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700"
          role="alert"
        >
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label
            htmlFor="email"
            className="block text-sm font-medium text-neutral-700"
          >
            Email address
          </label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={loading}
            placeholder="architect@example.com"
            className="mt-1 block w-full rounded-lg border border-neutral-300 px-3 py-2 text-neutral-900 shadow-sm placeholder:text-neutral-400 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 sm:text-sm disabled:opacity-60"
          />
        </div>

        <div>
          <label
            htmlFor="password"
            className="block text-sm font-medium text-neutral-700"
          >
            Password
          </label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={loading}
            placeholder="••••••••"
            className="mt-1 block w-full rounded-lg border border-neutral-300 px-3 py-2 text-neutral-900 shadow-sm placeholder:text-neutral-400 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 sm:text-sm disabled:opacity-60"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="mt-2 flex w-full justify-center rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2 disabled:opacity-60"
        >
          {loading ? "Signing in…" : "Sign In"}
        </button>
      </form>

      <div className="mt-6 border-t border-neutral-200 pt-4 text-center text-sm text-neutral-600">
        Don&apos;t have an account?{" "}
        <Link
          href={`/signup${rawNext ? `?next=${encodeURIComponent(rawNext)}` : ""}`}
          className="font-medium text-brand-600 hover:text-brand-500"
        >
          Sign up
        </Link>
      </div>

      <div className="mt-4 text-center">
        <Link
          href="/"
          className="text-xs text-neutral-500 hover:text-neutral-700"
        >
          ← Back to home
        </Link>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="text-center text-sm text-neutral-500">
          Loading sign in…
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
