import {
  useQuery,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query';
import { queryKeys } from '@upoe/shared';
import { supabase } from '@/lib/supabase';
import { useAuth } from './useAuth';

// ---------- useRecentHandovers ----------

/**
 * Fetches the 20 most recent shift handover notes for the community.
 * Joins guards table to get guard name.
 */
export function useRecentHandovers(communityId?: string) {
  return useQuery({
    queryKey: queryKeys.handovers.recent(communityId!).queryKey,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('shift_handovers')
        .select(
          `id, guard_id, notes, priority, pending_items,
           shift_started_at, shift_ended_at,
           acknowledged_by, acknowledged_at, created_at,
           guards!shift_handovers_guard_id_fkey(full_name)`
        )
        .eq('community_id', communityId!)
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) throw error;
      return data;
    },
    enabled: !!communityId,
  });
}

// ---------- useUnacknowledgedHandovers ----------

/**
 * Fetches handover notes that have not yet been acknowledged.
 */
export function useUnacknowledgedHandovers(communityId?: string) {
  return useQuery({
    queryKey: queryKeys.handovers.unacknowledged(communityId!).queryKey,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('shift_handovers')
        .select(
          `id, guard_id, notes, priority, pending_items,
           shift_started_at, shift_ended_at,
           acknowledged_by, acknowledged_at, created_at,
           guards!shift_handovers_guard_id_fkey(full_name)`
        )
        .eq('community_id', communityId!)
        .is('acknowledged_at', null)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: !!communityId,
  });
}

// ---------- useCreateHandover ----------

interface CreateHandoverInput {
  notes: string;
  priority: string;
  pending_items?: Array<{ description: string; completed: boolean }>;
  access_point_id?: string;
  shift_id?: string;
}

/**
 * Creates a new shift handover note.
 */
export function useCreateHandover() {
  const { communityId, guardId } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateHandoverInput) => {
      const { data, error } = await supabase
        .from('shift_handovers')
        .insert({
          community_id: communityId!,
          guard_id: guardId!,
          notes: input.notes,
          priority: input.priority,
          pending_items: input.pending_items ?? [],
          access_point_id: input.access_point_id,
          shift_id: input.shift_id,
        } as never)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.handovers._def });
    },
  });
}

// ---------- useAcknowledgeHandover ----------

/**
 * Marks a handover note as acknowledged by the current guard.
 */
export function useAcknowledgeHandover() {
  const { guardId } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (handoverId: string) => {
      const { data, error } = await supabase
        .from('shift_handovers')
        .update({
          acknowledged_by: guardId!,
          acknowledged_at: new Date().toISOString(),
        } as never)
        .eq('id', handoverId)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.handovers._def });
    },
  });
}
