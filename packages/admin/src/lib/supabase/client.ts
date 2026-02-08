import { createBrowserClient } from '@supabase/ssr';
import type { Database } from '@upoe/shared';

/**
 * Browser-side Supabase client using @supabase/ssr cookie-based auth.
 * Use in Client Components ('use client' files).
 */
export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
  );
}
