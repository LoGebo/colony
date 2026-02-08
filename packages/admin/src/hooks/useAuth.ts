'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import type { User, Session } from '@supabase/supabase-js';
import type { AppMetadata } from '@upoe/shared';

/**
 * Primary auth hook for admin dashboard.
 * Manages its own auth state via onAuthStateChange subscription.
 * Same API shape as mobile useAuth for cross-platform consistency.
 *
 * The Supabase client is created lazily inside useEffect to avoid
 * createBrowserClient errors during Next.js SSR/prerendering where
 * environment variables may not be available.
 */
export function useAuth() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const supabaseRef = useRef<ReturnType<typeof createClient> | null>(null);

  // Lazy getter for the Supabase client (client-side only)
  const getSupabase = useCallback(() => {
    if (!supabaseRef.current) {
      supabaseRef.current = createClient();
    }
    return supabaseRef.current;
  }, []);

  useEffect(() => {
    const supabase = getSupabase();

    // Restore session on mount
    supabase.auth.getSession().then(({ data: { session: restored } }) => {
      setSession(restored);
      setUser(restored?.user ?? null);
      setIsLoading(false);
    });

    // Subscribe to auth state changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      setUser(newSession?.user ?? null);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [getSupabase]);

  const metadata = (user?.app_metadata ?? {}) as AppMetadata;

  const signOut = useCallback(async () => {
    await getSupabase().auth.signOut();
    router.push('/sign-in');
  }, [router, getSupabase]);

  const refreshSession = useCallback(async () => {
    const { data } = await getSupabase().auth.refreshSession();
    return data.session;
  }, [getSupabase]);

  return {
    user,
    session,
    role: metadata.role,
    communityId: metadata.community_id,
    residentId: metadata.resident_id,
    guardId: metadata.guard_id,
    organizationId: metadata.organization_id,
    isLoading,
    signOut,
    refreshSession,
  };
}
