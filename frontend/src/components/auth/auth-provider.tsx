"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { Session, User } from "@supabase/supabase-js";

import { createClient } from "@/lib/supabase/client";

interface SignUpResult {
  error?: string;
  user?: User | null;
}

interface SignInResult {
  error?: string;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  signIn: (email: string, password: string) => Promise<SignInResult>;
  signUp: (
    email: string,
    password: string,
    fullName: string
  ) => Promise<SignUpResult>;
  signOut: () => Promise<void>;
  getToken: () => Promise<string | null>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Memoize supabase client instance for the browser context
  const supabase = useMemo(() => createClient(), []);

  useEffect(() => {
    let mounted = true;

    // Fetch initial session
    supabase.auth
      .getSession()
      .then(({ data: { session: initialSession }, error }) => {
        if (!mounted) return;
        if (error) {
          // If Supabase is unconfigured or credentials invalid in local dev, gracefully fail
          setIsLoading(false);
          return;
        }
        setSession(initialSession);
        setUser(initialSession?.user ?? null);
        setIsLoading(false);
      })
      .catch(() => {
        if (mounted) setIsLoading(false);
      });

    // Listen for auth state changes (sign in, sign out, token refresh)
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, currentSession) => {
      if (!mounted) return;
      setSession(currentSession);
      setUser(currentSession?.user ?? null);
      setIsLoading(false);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [supabase]);

  const signIn = useCallback(
    async (email: string, password: string): Promise<SignInResult> => {
      try {
        const { error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });

        if (error) {
          return { error: error.message };
        }

        return {};
      } catch (err) {
        return {
          error:
            err instanceof Error ? err.message : "An unexpected error occurred.",
        };
      }
    },
    [supabase]
  );

  const signUp = useCallback(
    async (
      email: string,
      password: string,
      fullName: string
    ): Promise<SignUpResult> => {
      try {
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            data: {
              full_name: fullName.trim(),
            },
          },
        });

        if (error) {
          return { error: error.message };
        }

        return { user: data.user };
      } catch (err) {
        return {
          error:
            err instanceof Error ? err.message : "An unexpected error occurred.",
        };
      }
    },
    [supabase]
  );

  const signOut = useCallback(async (): Promise<void> => {
    try {
      await supabase.auth.signOut();
      setUser(null);
      setSession(null);
    } catch {
      // Ignore sign out errors
    }
  }, [supabase]);

  const getToken = useCallback(async (): Promise<string | null> => {
    try {
      const {
        data: { session: currentSession },
      } = await supabase.auth.getSession();
      return currentSession?.access_token ?? null;
    } catch {
      return null;
    }
  }, [supabase]);

  const value = useMemo<AuthContextType>(
    () => ({
      user,
      session,
      isLoading,
      isAuthenticated: !!user,
      signIn,
      signUp,
      signOut,
      getToken,
    }),
    [user, session, isLoading, signIn, signUp, signOut, getToken]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
