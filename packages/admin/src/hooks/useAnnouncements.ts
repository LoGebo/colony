'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@upoe/shared';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from './useAuth';
import { toast } from 'sonner';
import { toastError } from '@/lib/toast-error';

/* ------------------------------------------------------------------ */
/*  Types                                                             */
/* ------------------------------------------------------------------ */

export interface AnnouncementRow {
  id: string;
  title: string;
  target_segment: string;
  publish_at: string | null;
  is_urgent: boolean;
  requires_acknowledgment: boolean;
  total_recipients: number;
  read_count: number;
  created_at: string;
  created_by: string | null;
}

export interface AnnouncementDetail {
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
  deleted_at: string | null;
}

export interface AnnouncementRecipientRow {
  id: string;
  resident_id: string;
  read_at: string | null;
  acknowledged_at: string | null;
  residents: {
    first_name: string;
    paternal_surname: string;
    email: string;
  };
}

interface AnnouncementFilters {
  search?: string;
  page?: number;
  pageSize?: number;
}

/* ------------------------------------------------------------------ */
/*  Queries                                                           */
/* ------------------------------------------------------------------ */

const ANNOUNCEMENT_SELECT =
  'id, title, target_segment, publish_at, is_urgent, requires_acknowledgment, total_recipients, read_count, created_at, created_by';

/**
 * Paginated announcement list with search filter.
 */
export function useAnnouncements(filters: AnnouncementFilters = {}) {
  const { communityId } = useAuth();
  const { search, page = 0, pageSize = 20 } = filters;

  return useQuery({
    queryKey: [
      ...queryKeys.announcements.list(communityId!).queryKey,
      { search, page, pageSize },
    ],
    queryFn: async () => {
      const supabase = createClient();
      let query = supabase
        .from('announcements')
        .select(ANNOUNCEMENT_SELECT, { count: 'exact' })
        .eq('community_id', communityId!)
        .is('deleted_at', null)
        .order('created_at', { ascending: false });

      if (search) {
        query = query.ilike('title', `%${search}%`);
      }

      const from = page * pageSize;
      const to = from + pageSize - 1;
      query = query.range(from, to);

      const { data, error, count } = await query;
      if (error) throw error;
      return {
        data: (data ?? []) as unknown as AnnouncementRow[],
        count: count ?? 0,
      };
    },
    enabled: !!communityId,
  });
}

/**
 * Single announcement detail.
 */
export function useAnnouncement(id: string) {
  const { communityId } = useAuth();

  return useQuery({
    queryKey: queryKeys.announcements.detail(id).queryKey,
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('announcements')
        .select('*')
        .eq('id', id)
        .eq('community_id', communityId!)
        .single();

      if (error) throw error;
      return data as unknown as AnnouncementDetail;
    },
    enabled: !!communityId && !!id,
  });
}

/**
 * Paginated recipient list with read/acknowledged status.
 */
export function useAnnouncementRecipients(
  announcementId: string,
  page = 0,
  pageSize = 20,
) {
  return useQuery({
    queryKey: [
      ...queryKeys.announcements.recipients(announcementId).queryKey,
      { page, pageSize },
    ],
    queryFn: async () => {
      const supabase = createClient();
      const from = page * pageSize;
      const to = from + pageSize - 1;

      const { data, error, count } = await supabase
        .from('announcement_recipients')
        .select(
          'id, resident_id, read_at, acknowledged_at, residents!inner(first_name, paternal_surname, email)',
          { count: 'exact' },
        )
        .eq('announcement_id', announcementId)
        .order('read_at', { ascending: false, nullsFirst: false })
        .range(from, to);

      if (error) throw error;
      return {
        data: (data ?? []) as unknown as AnnouncementRecipientRow[],
        count: count ?? 0,
      };
    },
    enabled: !!announcementId,
  });
}

/* ------------------------------------------------------------------ */
/*  Mutations                                                         */
/* ------------------------------------------------------------------ */

export interface CreateAnnouncementInput {
  title: string;
  body: string;
  target_segment: string;
  target_criteria?: Record<string, unknown> | null;
  publish_at?: string | null;
  is_urgent?: boolean;
  requires_acknowledgment?: boolean;
}

/**
 * Create an announcement and expand recipients via RPC.
 * Two-step mutation: insert announcement, then call expand_announcement_recipients.
 */
export function useCreateAnnouncement() {
  const { communityId } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateAnnouncementInput) => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      // Step 1: Insert announcement
      const { data: announcement, error: insertError } = await supabase
        .from('announcements')
        .insert({
          community_id: communityId!,
          title: input.title,
          body: input.body,
          target_segment: input.target_segment as never,
          target_criteria: (input.target_criteria ?? null) as never,
          publish_at: input.publish_at || new Date().toISOString(),
          is_urgent: input.is_urgent ?? false,
          requires_acknowledgment: input.requires_acknowledgment ?? false,
          created_by: user!.id,
        })
        .select()
        .single();

      if (insertError) throw insertError;

      // Step 2: Expand recipients via RPC (MUST be called explicitly)
      const { error: rpcError } = await supabase.rpc(
        'expand_announcement_recipients' as never,
        { p_announcement_id: announcement.id } as never,
      );

      if (rpcError) throw rpcError;

      // Re-fetch to get updated recipient count
      const { data: updated, error: fetchError } = await supabase
        .from('announcements')
        .select('total_recipients')
        .eq('id', announcement.id)
        .single();

      if (fetchError) throw fetchError;

      return {
        ...announcement,
        total_recipients: updated.total_recipients,
      };
    },
    onSuccess: (data) => {
      const count = (data as Record<string, unknown>).total_recipients ?? 0;
      toast.success(`Aviso enviado a ${count} destinatarios`);
      queryClient.invalidateQueries({
        queryKey: queryKeys.announcements._def,
      });
    },
    onError: (error: Error) => {
      toastError('Error al crear aviso', error);
    },
  });
}

/**
 * Soft-delete an announcement.
 */
export function useDeleteAnnouncement() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const supabase = createClient();
      const { error } = await supabase
        .from('announcements')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Aviso eliminado');
      queryClient.invalidateQueries({
        queryKey: queryKeys.announcements._def,
      });
    },
    onError: (error: Error) => {
      toastError('Error al eliminar aviso', error);
    },
  });
}
