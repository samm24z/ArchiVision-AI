"use client";

import React, { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

import { useAuth } from "@/components/auth/auth-provider";

function SignupForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { signUp, isAuthenticated } = useAuth();

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

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
    setSuccessMessage(null);

    if (!fullName.trim()) {
      setError("Please enter your full name.");
      return;
    }

    if (!email.trim() || !password) {
      setError("Please enter both email and password.");
      return;
    }

    if (password.length < 6) {
      setError("Password must be at least 6 characters long.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);

    try {
      const result = await signUp(email, password, fullName);

      if (result.error) {
        setError(result.error);
        setLoading(false);
      } else {
        // If email confirmation is required by Supabase, prompt the user
        // If auto-confirmed, the auth state listener will redirect to dashboard
        if (result.user && !result.user.confirmed_at && result.user.identities?.length) {
          setSuccessMessage(
            "Account created! Please check your email inbox to confirm your email address before signing in."
          );
          setLoading(false);
        } else {
          router.push(nextUrl);
          router.refresh();
        }
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
          Create your account
        </h1>
        <p className="mt-2 text-sm text-neutral-600">
          Get started with ArchiVision AI
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

      {successMessage && (
        <div
          className="mb-4 rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800"
          role="status"
        >
          {successMessage}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label
            htmlFor="fullName"
            className="block text-sm font-medium text-neutral-700"
          >
            Full Name
          </label>
          <input
            id="fullName"
            name="fullName"
            type="text"
            autoComplete="name"
            required
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            disabled={loading}
            placeholder="Jane Architect"
            className="mt-1 block w-full rounded-lg border border-neutral-300 px-3 py-2 text-neutral-900 shadow-sm placeholder:text-neutral-400 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 sm:text-sm disabled:opacity-60"
          />
        </div>

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
            autoComplete="new-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={loading}
            placeholder="••••••••"
            className="mt-1 block w-full rounded-lg border border-neutral-300 px-3 py-2 text-neutral-900 shadow-sm placeholder:text-neutral-400 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 sm:text-sm disabled:opacity-60"
          />
        </div>

        <div>
          <label
            htmlFor="confirmPassword"
            className="block text-sm font-medium text-neutral-700"
          >
            Confirm Password
          </label>
          <input
            id="confirmPassword"
            name="confirmPassword"
            type="password"
            autoComplete="new-password"
            required
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
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
          {loading ? "Creating account…" : "Create Account"}
        </button>
      </form>

      <div className="mt-6 border-t border-neutral-200 pt-4 text-center text-sm text-neutral-600">
        Already have an account?{" "}
        <Link
          href={`/login${rawNext ? `?next=${encodeURIComponent(rawNext)}` : ""}`}
          className="font-medium text-brand-600 hover:text-brand-500"
        >
          Sign in
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

export default function SignupPage() {
  return (
    <Suspense
      fallback={
        <div className="text-center text-sm text-neutral-500">
          Loading sign up…
        </div>
      }
    >
      <SignupForm />
    </Suspense>
  );
}
