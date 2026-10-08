import { NextResponse, type NextRequest } from "next/server";

import { createClient } from "@/lib/supabase/server";

/**
 * Auth Callback Route Handler.
 * Exchanges PKCE authorization code for a Supabase session and redirects
 * to the intended protected destination.
 */
export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const rawNext = requestUrl.searchParams.get("next");

  // Validate redirect destination to prevent open redirect vulnerabilities
  const next =
    rawNext && rawNext.startsWith("/") && !rawNext.startsWith("//")
      ? rawNext
      : "/dashboard";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      return NextResponse.redirect(new URL(next, request.url));
    }
  }

  // If code exchange failed or was missing, redirect to login with error
  return NextResponse.redirect(
    new URL(
      "/login?error=" + encodeURIComponent("Authentication failed or link expired. Please sign in again."),
      request.url
    )
  );
}
