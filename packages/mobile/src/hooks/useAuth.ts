import { useCallback } from 'react';
import { useSession } from '@/providers/SessionProvider';
import { supabase } from '@/lib/supabase';
import type { AppMetadata } from '@upoe/shared';

/**
 * Primary auth hook for mobile.
 * Extracts user, role, and community context from the SessionProvider.
 * signOut() clears the session -- Stack.Protected handles redirect automatically.
 */
export function useAuth() {
  const { session, isLoading } = useSession();

  const user = session?.user ?? null;
  const metadata = (user?.app_metadata ?? {}) as AppMetadata;

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    // No manual navigation -- Stack.Protected detects null session and redirects
  }, []);

  const refreshSession = useCallback(async () => {
    const { data } = await supabase.auth.refreshSession();
    return data.session;
  }, []);

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
