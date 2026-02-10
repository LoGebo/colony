import {
  useQuery,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query';
import { queryKeys } from '@upoe/shared';
import { supabase } from '@/lib/supabase';
import { useAuth } from './useAuth';
import { useRealtimeSubscription } from './useRealtimeSubscription';

// ---------- useGuardAccessPoint ----------

/**
 * Fetches the first active access point for the guard's community.
 * Used as a default when logging access -- guards can override if needed.
 */
export function useGuardAccessPoint() {
  const { communityId } = useAuth();

  return useQuery({
    queryKey: ['guard-access-point', communityId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('access_points')
        .select('id, name, code, access_point_type')
        .eq('community_id', communityId!)
        .eq('status', 'active')
        .is('deleted_at', null)
        .order('name', { ascending: true })
        .limit(1)
        .single();

      if (error) throw error;
      return data;
    },
    enabled: !!communityId,
  });
}

// ---------- useVerifyQR ----------

// TODO: QR_HMAC_SECRET must be configured in edge function env vars for production use

export function useVerifyQR() {
  return useMutation({
    mutationFn: async (payload: string) => {
      const { data, error } = await supabase.functions.invoke('verify-qr', {
        body: { qr_payload: payload },
      });

      if (error) {
        throw new Error(error.message ?? 'Error al verificar el codigo QR');
      }

      return data as {
        valid: boolean;
        data?: {
          invitation_id?: string;
          qr_code_id?: string;
          visitor_name?: string;
          community_id?: string;
        };
        error?: string;
      };
    },
  });
}

// ---------- useBlacklistCheck ----------

interface BlacklistCheckParams {
  communityId: string;
  personName?: string;
  personDocument?: string;
  plateNormalized?: string;
}

interface BlacklistResult {
  is_blocked: boolean;
  blacklist_id: string;
  reason: string;
  protocol: string;
}

export function useBlacklistCheck(params: BlacklistCheckParams) {
  return useQuery({
    queryKey: ['blacklist-check', params],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('is_blacklisted', {
        p_community_id: params.communityId,
        p_person_name: params.personName ?? undefined,
        p_person_document: params.personDocument ?? undefined,
        p_plate_normalized: params.plateNormalized ?? undefined,
      });

      if (error) throw error;

      const result = (data as BlacklistResult[] | null)?.[0] ?? {
        is_blocked: false,
        blacklist_id: '',
        reason: '',
        protocol: '',
      };
      return result;
    },
    enabled: !!(params.personName || params.personDocument || params.plateNormalized),
  });
}

// ---------- useManualCheckIn ----------

interface ManualCheckInInput {
  person_name: string;
  person_type?: string;
  person_document?: string;
  vehicle_plate?: string;
  plate_detected?: string;
  direction: string;
  method: string;
  decision: string;
  photo_url?: string;
  photo_vehicle_url?: string;
  guard_notes?: string;
  unit_id?: string;
  access_point_id?: string;
}

export function useManualCheckIn() {
  const { communityId, guardId } = useAuth();
  const queryClient = useQueryClient();
  const { data: accessPoint } = useGuardAccessPoint();

  return useMutation({
    mutationFn: async (input: ManualCheckInInput) => {
      const apId = input.access_point_id ?? accessPoint?.id;
      if (!apId) {
        throw new Error('No hay punto de acceso configurado para esta comunidad');
      }

      const { data, error } = await supabase
        .from('access_logs')
        .insert({
          community_id: communityId!,
          processed_by: guardId,
          access_point_id: apId,
          person_name: input.person_name,
          person_type: input.person_type ?? 'visitor',
          person_document: input.person_document,
          plate_number: input.vehicle_plate,
          plate_detected: input.plate_detected,
          direction: input.direction,
          method: input.method,
          decision: input.decision as 'allowed' | 'denied' | 'blocked' | 'pending',
          photo_url: input.photo_url,
          photo_vehicle_url: input.photo_vehicle_url,
          guard_notes: input.guard_notes,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys['access-logs']._def });
    },
  });
}

// ---------- useLogAccess ----------

interface LogAccessInput {
  invitation_id?: string;
  qr_code_id?: string;
  person_name: string;
  person_type?: string;
  direction: string;
  method: string;
  decision: string;
  photo_url?: string;
  guard_notes?: string;
  access_point_id?: string;
}

export function useLogAccess() {
  const { communityId, guardId } = useAuth();
  const queryClient = useQueryClient();
  const { data: accessPoint } = useGuardAccessPoint();

  return useMutation({
    mutationFn: async (input: LogAccessInput) => {
      const apId = input.access_point_id ?? accessPoint?.id;
      if (!apId) {
        throw new Error('No hay punto de acceso configurado para esta comunidad');
      }

      // 1. Insert the access log
      const { data, error } = await supabase
        .from('access_logs')
        .insert({
          community_id: communityId!,
          processed_by: guardId,
          access_point_id: apId,
          invitation_id: input.invitation_id,
          qr_code_id: input.qr_code_id,
          person_name: input.person_name,
          person_type: input.person_type ?? 'visitor',
          direction: input.direction,
          method: input.method,
          decision: input.decision as 'allowed' | 'denied' | 'blocked' | 'pending',
          photo_url: input.photo_url,
          guard_notes: input.guard_notes,
        })
        .select()
        .single();

      if (error) throw error;

      // 2. Burn single-use QR code on entry
      if (input.qr_code_id && input.direction === 'entry') {
        await supabase.rpc('burn_qr_code', {
          p_qr_id: input.qr_code_id,
          p_guard_id: guardId ?? undefined,
          p_access_point_id: apId,
        });
      }

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys['access-logs']._def });
      queryClient.invalidateQueries({ queryKey: queryKeys.visitors._def });
    },
  });
}

// ---------- useTodayAccessLogs ----------

export function useTodayAccessLogs() {
  const { communityId } = useAuth();

  // Get today's midnight in ISO format
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayISO = todayStart.toISOString();

  return useQuery({
    queryKey: queryKeys['access-logs'].today(communityId!).queryKey,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('access_logs')
        .select(
          'id, person_name, person_type, direction, method, decision, logged_at, plate_number, guard_notes, photo_url'
        )
        .eq('community_id', communityId!)
        .gte('logged_at', todayISO)
        .order('logged_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      return data;
    },
    enabled: !!communityId,
  });
}

// ---------- useExpectedVisitorsRealtime ----------

/**
 * Fetches expected visitors for guards with real-time updates.
 * Shows approved/pending invitations for today that haven't been cancelled.
 * Includes real-time subscriptions to invitations and access_logs tables.
 */
export function useExpectedVisitorsRealtime() {
  const { communityId } = useAuth();

  const query = useQuery({
    queryKey: [...queryKeys.visitors.active(communityId!).queryKey, 'guard-queue'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('invitations')
        .select('*, units(unit_number), residents!invitations_created_by_resident_id_fkey(first_name, paternal_surname)')
        .eq('community_id', communityId!)
        .in('status', ['approved', 'pending'])
        .is('cancelled_at', null)
        .is('deleted_at', null)
        .gte('valid_until', new Date().toISOString())
        .lte('valid_from', new Date().toISOString())
        .order('valid_from', { ascending: true });

      if (error) throw error;
      return data;
    },
    enabled: !!communityId,
    refetchInterval: 60_000, // Fallback polling every 60s
  });

  // Real-time: new invitations or status changes
  useRealtimeSubscription({
    channelName: `guard-visitor-queue-${communityId}`,
    table: 'invitations',
    event: '*',
    queryKeys: [
      [...queryKeys.visitors.active(communityId!).queryKey, 'guard-queue'],
      queryKeys.visitors._def,
    ],
    enabled: !!communityId,
  });

  // Real-time: access log entries (someone checked in/out)
  useRealtimeSubscription({
    channelName: `guard-access-logs-${communityId}`,
    table: 'access_logs',
    event: 'INSERT',
    queryKeys: [
      [...queryKeys.visitors.active(communityId!).queryKey, 'guard-queue'],
      queryKeys['access-logs']._def,
    ],
    enabled: !!communityId,
  });

  return query;
}
