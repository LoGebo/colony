import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@upoe/shared';
import { supabase } from '@/lib/supabase';
import { useAuth } from './useAuth';

/* ------------------------------------------------------------------ */
/*  Types                                                             */
/* ------------------------------------------------------------------ */

export interface AnnouncementFeedItem {
  announcement_id: string;
  read_at: string | null;
  acknowledged_at: string | null;
  announcements: {
    id: string;
    title: string;
    body: string;
    target_segment: string;
    is_urgent: boolean;
    requires_acknowledgment: boolean;
    publish_at: string | null;
    created_at: string;
  };
}

export interface AnnouncementDetailData {
  id: string;
  community_id: string;
  title: string;
  body: string;
  target_segment: string;
  target_criteria: Record<string, unknown> | null;
  publish_at: string | null;
  is_urgent: boolean;
  requires_acknowledgment: boolean;
  total_recipients: number;
  read_count: number;
  created_at: string;
  created_by: string | null;
}

/* ------------------------------------------------------------------ */
/*  Queries                                                           */
/* ------------------------------------------------------------------ */

/**
 * Announcement feed for the current resident.
 * Fetches via announcement_recipients (only records targeting this resident).
 * Filters to published, non-deleted announcements.
 */
export function useAnnouncementFeed() {
  const { residentId } = useAuth();

  return useQuery({
    queryKey: queryKeys.announcements.feed(residentId!).queryKey,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('announcement_recipients')
        .select(
          'announcement_id, read_at, acknowledged_at, announcements!inner(id, title, body, target_segment, is_urgent, requires_acknowledgment, publish_at, created_at)',
        )
        .eq('resident_id', residentId!)
        .lte('announcements.publish_at', new Date().toISOString())
        .is('announcements.deleted_at', null)
        .order('announcements(created_at)' as never, { ascending: false });

      if (error) throw error;
      return (data ?? []) as unknown as AnnouncementFeedItem[];
    },
    enabled: !!residentId,
  });
}

/**
 * Single announcement detail.
 */
export function useAnnouncementDetail(id: string) {
  return useQuery({
    queryKey: queryKeys.announcements.detail(id).queryKey,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('announcements')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;
      return data as unknown as AnnouncementDetailData;
    },
    enabled: !!id,
  });
}

/* ------------------------------------------------------------------ */
/*  Mutations                                                         */
/* ------------------------------------------------------------------ */

/**
 * Mark an announcement as read for the current resident.
 * Only updates if not already read (read_at IS NULL).
 */
export function useMarkAnnouncementRead() {
  const { residentId } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (announcementId: string) => {
      const { error } = await supabase
        .from('announcement_recipients')
        .update({ read_at: new Date().toISOString() })
        .eq('announcement_id', announcementId)
        .eq('resident_id', residentId!)
        .is('read_at', null);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.announcements.feed(residentId!).queryKey,
      });
    },
  });
}

/**
 * Acknowledge an announcement (confirm reading).
 */
export function useAcknowledgeAnnouncement() {
  const { residentId } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (announcementId: string) => {
      const { error } = await supabase
        .from('announcement_recipients')
        .update({ acknowledged_at: new Date().toISOString() })
        .eq('announcement_id', announcementId)
        .eq('resident_id', residentId!);

      if (error) throw error;
    },
    onSuccess: (_data, announcementId) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.announcements.feed(residentId!).queryKey,
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.announcements.detail(announcementId).queryKey,
      });
    },
  });
}
