import { createBrowserClient } from "@supabase/ssr";

import { getSupabaseAnonKey, getSupabaseUrl } from "@/lib/env";

/**
 * Creates a Supabase client for use in Client Components ("use client").
 * Handles authentication state in the browser and automatically synchronizes
 * auth cookies.
 */
export function createClient() {
  const supabaseUrl = getSupabaseUrl();
  const supabaseAnonKey = getSupabaseAnonKey();

  if (!supabaseUrl || !supabaseAnonKey) {
    // In local dev without Supabase configured yet, return dummy/safe client
    // so pages render rather than crashing immediately.
    return createBrowserClient(
      supabaseUrl || "http://127.0.0.1:54321",
      supabaseAnonKey || "placeholder-anon-key"
    );
  }

  return createBrowserClient(supabaseUrl, supabaseAnonKey);
}
