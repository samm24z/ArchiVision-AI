import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { getSupabaseAnonKey, getSupabaseUrl } from "@/lib/env";

/**
 * Updates and refreshes the Supabase session in Edge Middleware.
 * Synchronizes auth cookies between the incoming request and outgoing response,
 * and enforces route protection rules.
 */
export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabaseUrl = getSupabaseUrl();
  const supabaseAnonKey = getSupabaseAnonKey();

  // If Supabase is not configured yet (e.g. initial dev), pass through without breaking
  if (!supabaseUrl || !supabaseAnonKey) {
    return supabaseResponse;
  }

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet: Array<{ name: string; value: string; options?: Record<string, unknown> }>) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value)
        );
        supabaseResponse = NextResponse.next({
          request,
        });
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options as Parameters<typeof supabaseResponse.cookies.set>[2])
        );
      },
    },
  });

  // IMPORTANT: Do NOT use supabase.auth.getSession() in server code/middleware
  // getUser() sends a request to the Supabase Auth server to validate the token.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;

  // Protected routes: /dashboard (and sub-paths)
  const isProtectedRoute = path === "/dashboard" || path.startsWith("/dashboard/");
  // Auth routes: /login, /signup
  const isAuthRoute = path === "/login" || path === "/signup";

  // 1. Unauthenticated users attempting to access protected routes -> redirect to login
  if (!user && isProtectedRoute) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", path);
    return NextResponse.redirect(url);
  }

  // 2. Authenticated users visiting /login or /signup -> redirect to /dashboard
  if (user && isAuthRoute) {
    const rawNext = request.nextUrl.searchParams.get("next");
    // Prevent open redirect vulnerabilities: next must start with '/' and not '//'
    const safeNext =
      rawNext && rawNext.startsWith("/") && !rawNext.startsWith("//")
        ? rawNext
        : "/dashboard";

    const url = request.nextUrl.clone();
    url.pathname = safeNext;
    url.searchParams.delete("next");
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
