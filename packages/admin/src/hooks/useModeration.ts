'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@upoe/shared';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from './useAuth';
import { toast } from 'sonner';

/* ------------------------------------------------------------------ */
/*  Types                                                             */
/* ------------------------------------------------------------------ */

export interface ModerationQueueItem {
  id: string;
  item_type: string;
  item_id: string;
  priority: number;
  status: string;
  queued_at: string;
  assigned_to: string | null;
  assigned_at: string | null;
}

export interface ModerationStats {
  pending: number;
  inReview: number;
  resolvedToday: number;
}

/* ------------------------------------------------------------------ */
/*  Queries                                                           */
/* ------------------------------------------------------------------ */

/**
 * Fetch the moderation queue (unresolved items).
 */
export function useModerationQueue() {
  const { communityId } = useAuth();

  return useQuery({
    queryKey: queryKeys.moderation.queue(communityId!).queryKey,
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('moderation_queue')
        .select(
          'id, item_type, item_id, priority, status, queued_at, assigned_to, assigned_at'
        )
        .eq('community_id', communityId!)
        .is('resolved_at', null)
        .order('priority', { ascending: false })
        .order('queued_at', { ascending: true });

      if (error) throw error;
      return (data ?? []) as unknown as ModerationQueueItem[];
    },
    enabled: !!communityId,
  });
}

/**
 * Fetch source content for a moderation item based on its type.
 */
export function useModerationItemDetail(itemId: string, itemType: string) {
  return useQuery({
    queryKey: ['moderation-item-detail', itemId, itemType],
    queryFn: async () => {
      const supabase = createClient();

      if (itemType === 'listing') {
        const { data, error } = await supabase
          .from('marketplace_listings')
          .select('id, title, description, price, category, photo_urls, created_at')
          .eq('id', itemId)
          .single();
        if (error) throw error;
        return { type: 'listing' as const, data: { ...data, status: 'active' } };
      }

      if (itemType === 'post') {
        const { data, error } = await supabase
          .from('posts')
          .select('id, title, content, post_type, created_at')
          .eq('id', itemId)
          .single();
        if (error) throw error;
        return { type: 'post' as const, data };
      }

      if (itemType === 'comment') {
        const { data, error } = await supabase
          .from('post_comments')
          .select('id, content, created_at')
          .eq('id', itemId)
          .single();
        if (error) throw error;
        return { type: 'comment' as const, data };
      }

      throw new Error(`Tipo de item desconocido: ${itemType}`);
    },
    enabled: !!itemId && !!itemType,
  });
}

/**
 * Fetch moderation stats for the community.
 */
export function useModerationStats() {
  const { communityId } = useAuth();

  return useQuery({
    queryKey: queryKeys.moderation.stats(communityId!).queryKey,
    queryFn: async () => {
      const supabase = createClient();

      // Total pending (resolved_at IS NULL)
      const { count: pendingCount, error: pendingError } = await supabase
        .from('moderation_queue')
        .select('*', { count: 'exact', head: true })
        .eq('community_id', communityId!)
        .is('resolved_at', null);

      if (pendingError) throw pendingError;

      // In review (status = 'in_review')
      const { count: reviewCount, error: reviewError } = await supabase
        .from('moderation_queue')
        .select('*', { count: 'exact', head: true })
        .eq('community_id', communityId!)
        .eq('status', 'in_review' as never)
        .is('resolved_at', null);

      if (reviewError) throw reviewError;

      // Resolved today
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const { count: resolvedCount, error: resolvedError } = await supabase
        .from('moderation_queue')
        .select('*', { count: 'exact', head: true })
        .eq('community_id', communityId!)
        .not('resolved_at', 'is', null)
        .gte('resolved_at', todayStart.toISOString());

      if (resolvedError) throw resolvedError;

      return {
        pending: pendingCount ?? 0,
        inReview: reviewCount ?? 0,
        resolvedToday: resolvedCount ?? 0,
      } as ModerationStats;
    },
    enabled: !!communityId,
  });
}

/* ------------------------------------------------------------------ */
/*  Mutations                                                         */
/* ------------------------------------------------------------------ */

/**
 * Claim the next moderation item via RPC.
 */
export function useClaimModerationItem() {
  const { communityId } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase.rpc('claim_moderation_item', {
        p_community_id: communityId!,
      } as never);

      if (error) throw error;
      return data as { id: string; item_id: string; item_type: string } | null;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.moderation._def });
    },
    onError: (error: Error) => {
      toast.error(`Error al reclamar item: ${error.message}`);
    },
  });
}

/**
 * Resolve a moderation item (approve/reject) via RPC.
 */
export function useResolveModeration() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: {
      queueId: string;
      resolution: 'approved' | 'rejected';
      notes?: string;
    }) => {
      const supabase = createClient();
      const { data, error } = await supabase.rpc('resolve_moderation', {
        p_queue_id: input.queueId,
        p_resolution: input.resolution,
        p_notes: input.notes ?? null,
      } as never);

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success('Item de moderacion resuelto');
      queryClient.invalidateQueries({ queryKey: queryKeys.moderation._def });
      queryClient.invalidateQueries({ queryKey: queryKeys.marketplace._def });
    },
    onError: (error: Error) => {
      toast.error(`Error al resolver moderacion: ${error.message}`);
    },
  });
}
