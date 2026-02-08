import { createClient } from '@supabase/supabase-js';
import type { Database } from '@upoe/shared';

/**
 * Server-side only admin client with service_role key.
 * Bypasses RLS -- use only in Server Actions and Route Handlers.
 *
 * NEVER import this file in 'use client' components.
 * The SUPABASE_SERVICE_ROLE_KEY is NOT prefixed with NEXT_PUBLIC_
 * to ensure it stays server-side only.
 */
export function createAdminClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );
}
