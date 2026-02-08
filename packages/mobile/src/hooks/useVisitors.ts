import {
  useQuery,
  useMutation,
  useInfiniteQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { queryKeys } from '@upoe/shared';
import { supabase } from '@/lib/supabase';
import { useAuth } from './useAuth';

// ---------- useActiveInvitations ----------

export function useActiveInvitations() {
  const { residentId, communityId } = useAuth();

  return useQuery({
    queryKey: queryKeys.visitors.active(communityId!).queryKey,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('invitations')
        .select('*, qr_codes(id, payload, status), units(unit_number)')
        .eq('created_by_resident_id', residentId!)
        .eq('community_id', communityId!)
        .in('status', ['approved', 'pending'])
        .is('cancelled_at', null)
        .is('deleted_at', null)
        .gte('valid_until', new Date().toISOString())
        .order('valid_from', { ascending: true });

      if (error) throw error;
      return data;
    },
    enabled: !!residentId && !!communityId,
  });
}

// ---------- useInvitationDetail ----------

export function useInvitationDetail(id: string) {
  return useQuery({
    queryKey: queryKeys.visitors.detail(id).queryKey,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('invitations')
        .select('*, qr_codes(*), units(unit_number)')
        .eq('id', id)
        .single();

      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });
}

// ---------- useCreateInvitation ----------

interface CreateInvitationInput {
  visitor_name: string;
  invitation_type: 'single_use' | 'recurring' | 'event' | 'vehicle_preauth';
  valid_from: string;
  valid_until?: string;
  visitor_phone?: string;
  vehicle_plate?: string;
  recurring_days?: number[];
  recurring_start_time?: string;
  recurring_end_time?: string;
  unit_id?: string;
}

export function useCreateInvitation() {
  const { residentId, communityId } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateInvitationInput) => {
      // 1. Insert the invitation
      const { data: invitation, error: insertError } = await supabase
        .from('invitations')
        .insert({
          visitor_name: input.visitor_name,
          invitation_type: input.invitation_type,
          valid_from: input.valid_from,
          valid_until: input.valid_until,
          visitor_phone: input.visitor_phone,
          vehicle_plate: input.vehicle_plate,
          recurring_days: input.recurring_days,
          recurring_start_time: input.recurring_start_time,
          recurring_end_time: input.recurring_end_time,
          unit_id: input.unit_id,
          community_id: communityId!,
          created_by_resident_id: residentId!,
        })
        .select()
        .single();

      if (insertError) throw insertError;

      // 2. Re-fetch with qr_codes to check if a DB trigger created one
      const { data: withQr, error: fetchError } = await supabase
        .from('invitations')
        .select('*, qr_codes(*), units(unit_number)')
        .eq('id', invitation.id)
        .single();

      if (fetchError) throw fetchError;

      // 3. If no QR code was auto-generated, create one manually
      const qrCodes = withQr.qr_codes as unknown[];
      if (!qrCodes || qrCodes.length === 0) {
        // TODO: Replace with server-side HMAC-signed payload when QR_HMAC_SECRET is configured
        const fallbackPayload = JSON.stringify({
          invitation_id: invitation.id,
          community_id: communityId,
          created_at: Date.now(),
        });

        const { error: qrError } = await supabase.from('qr_codes').insert({
          invitation_id: invitation.id,
          community_id: communityId!,
          resident_id: residentId,
          payload: fallbackPayload,
          signature: 'unsigned', // Placeholder until HMAC signing is configured
          is_single_use: input.invitation_type === 'single_use',
          valid_from: input.valid_from,
          valid_until:
            input.valid_until ??
            new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
          status: 'active',
        });

        if (qrError) throw qrError;

        // Re-fetch the invitation with the newly created QR code
        const { data: final, error: finalError } = await supabase
          .from('invitations')
          .select('*, qr_codes(*), units(unit_number)')
          .eq('id', invitation.id)
          .single();

        if (finalError) throw finalError;
        return final;
      }

      return withQr;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.visitors._def });
    },
  });
}

// ---------- useCancelInvitation ----------

export function useCancelInvitation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (invitationId: string) => {
      const { data, error } = await supabase
        .from('invitations')
        .update({
          status: 'cancelled',
          cancelled_at: new Date().toISOString(),
        })
        .eq('id', invitationId)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.visitors._def });
    },
  });
}

// ---------- useVisitorHistory ----------

export function useVisitorHistory(pageSize = 20) {
  const { residentId, communityId } = useAuth();

  return useInfiniteQuery({
    queryKey: queryKeys.visitors.list({ residentId, communityId, type: 'history' }).queryKey,
    queryFn: async ({ pageParam = 0 }) => {
      const from = pageParam * pageSize;
      const to = from + pageSize - 1;

      const { data, error, count } = await supabase
        .from('invitations')
        .select('*, qr_codes(id, status), units(unit_number)', { count: 'exact' })
        .eq('created_by_resident_id', residentId!)
        .eq('community_id', communityId!)
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
        .range(from, to);

      if (error) throw error;
      return { data: data ?? [], count: count ?? 0, page: pageParam };
    },
    initialPageParam: 0,
    getNextPageParam: (lastPage) => {
      const nextPage = lastPage.page + 1;
      const totalPages = Math.ceil(lastPage.count / pageSize);
      return nextPage < totalPages ? nextPage : undefined;
    },
    enabled: !!residentId && !!communityId,
  });
}
