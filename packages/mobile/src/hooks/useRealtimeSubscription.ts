import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';

/**
 * Generic hook for subscribing to Supabase Realtime postgres_changes
 * with automatic TanStack Query cache invalidation.
 *
 * Features:
 * - Automatic cleanup on unmount (prevents memory leaks)
 * - Invalidates multiple query keys on database changes
 * - Optional custom event callback for additional logic
 * - Conditional subscription based on enabled flag
 */

export interface UseRealtimeSubscriptionOptions {
  /** Unique channel identifier (must be deterministic, avoid Date.now()) */
  channelName: string;
  /** Postgres table to watch */
  table: string;
  /** Event type to listen for (default: '*' for all events) */
  event?: 'INSERT' | 'UPDATE' | 'DELETE' | '*';
  /** PostgREST filter e.g., 'status=eq.pending' or 'created_by_resident_id=eq.123' */
  filter?: string;
  /** Array of query key arrays to invalidate on event */
  queryKeys: readonly (readonly unknown[])[];
  /** Whether subscription is active (default: true) */
  enabled?: boolean;
  /** Optional callback for custom logic on event */
  onEvent?: (payload: any) => void;
}

/**
 * Subscribe to Supabase Realtime postgres_changes and invalidate TanStack queries.
 *
 * Example:
 * ```tsx
 * useRealtimeSubscription({
 *   channelName: `invitations-${residentId}`,
 *   table: 'invitations',
 *   event: 'UPDATE',
 *   filter: `created_by_resident_id=eq.${residentId}`,
 *   queryKeys: [
 *     queryKeys.visitors.active(communityId).queryKey,
 *     queryKeys.visitors._def,
 *   ],
 *   enabled: !!residentId && !!communityId,
 * });
 * ```
 */
export function useRealtimeSubscription({
  channelName,
  table,
  event = '*',
  filter,
  queryKeys,
  enabled = true,
  onEvent,
}: UseRealtimeSubscriptionOptions) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!enabled) {
      return;
    }

    // Create Realtime channel
    const channel: RealtimeChannel = supabase.channel(channelName);

    // Subscribe to postgres_changes with optional filter
    channel.on(
      'postgres_changes',
      {
        event,
        schema: 'public',
        table,
        filter,
      },
      (payload) => {
        // Call custom event handler if provided
        if (onEvent) {
          onEvent(payload);
        }

        // Invalidate all provided query keys to trigger refetch
        queryKeys.forEach((queryKey) => {
          queryClient.invalidateQueries({ queryKey });
        });
      }
    );

    // Subscribe to the channel
    channel.subscribe();

    // Cleanup: unsubscribe on unmount or when dependencies change
    return () => {
      channel.unsubscribe();
    };
  }, [channelName, table, event, filter, enabled, JSON.stringify(queryKeys), onEvent, queryClient]);
}
