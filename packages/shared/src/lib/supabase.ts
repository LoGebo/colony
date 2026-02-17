import { createClient } from '@supabase/supabase-js';
import type { Database } from '../types/database.types';

export type SupabaseClient = ReturnType<typeof createSupabaseClient>;

/**
 * Factory for creating typed Supabase clients.
 * Available for external consumers (admin, mobile) that need a custom client instance.
 * Currently not imported by any consumer - each package creates its own client directly.
 */
export function createSupabaseClient(
  supabaseUrl: string,
  supabaseKey: string,
  options?: {
    accessToken?: string;
    persistSession?: boolean;
  }
) {
  return createClient<Database>(supabaseUrl, supabaseKey, {
    auth: {
      persistSession: options?.persistSession ?? true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
    global: {
      headers: options?.accessToken
        ? { Authorization: `Bearer ${options.accessToken}` }
        : {},
    },
  });
}
