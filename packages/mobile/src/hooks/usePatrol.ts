import {
  useQuery,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query';
import { queryKeys } from '@upoe/shared';
import { supabase } from '@/lib/supabase';
import { useAuth } from './useAuth';

// ---------- usePatrolRoutes ----------

/**
 * Fetches active patrol routes for the guard's community.
 */
export function usePatrolRoutes(communityId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.patrols.routes(communityId!).queryKey,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('patrol_routes')
        .select(
          'id, name, description, checkpoint_sequence, estimated_duration_minutes, status'
        )
        .eq('community_id', communityId!)
        .eq('status', 'active')
        .order('name', { ascending: true });

      if (error) throw error;
      return data;
    },
    enabled: !!communityId,
  });
}

// ---------- usePatrolCheckpoints ----------

/**
 * Fetches all patrol checkpoints for the community.
 * Used to resolve checkpoint details by ID (name, NFC serial, GPS coords).
 */
export function usePatrolCheckpoints(communityId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.patrols.checkpoints(communityId!).queryKey,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('patrol_checkpoints')
        .select(
          'id, name, nfc_serial, location_lat, location_lng, location_tolerance_meters, description'
        )
        .eq('community_id', communityId!)
        .order('name', { ascending: true });

      if (error) throw error;
      return data;
    },
    enabled: !!communityId,
  });
}

// ---------- useActivePatrolLog ----------

/**
 * Fetches the guard's currently active (in_progress) patrol log.
 * Returns null if no active patrol.
 */
export function useActivePatrolLog(guardId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.patrols.activeLogs(guardId!).queryKey,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('patrol_logs')
        .select('*')
        .eq('guard_id', guardId!)
        .eq('status', 'in_progress')
        .order('started_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    enabled: !!guardId,
  });
}

// ---------- usePatrolLogDetail ----------

/**
 * Fetches a specific patrol log with its checkpoint logs.
 */
export function usePatrolLogDetail(logId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.patrols.logDetail(logId!).queryKey,
    queryFn: async () => {
      const { data: log, error: logError } = await supabase
        .from('patrol_logs')
        .select(
          'id, route_id, guard_id, status, started_at, completed_at, checkpoints_total, checkpoints_visited, observations'
        )
        .eq('id', logId!)
        .single();

      if (logError) throw logError;

      const { data: checkpointLogs, error: clError } = await supabase
        .from('patrol_checkpoint_logs')
        .select(
          'id, checkpoint_id, nfc_serial_scanned, gps_lat, gps_lng, gps_accuracy_meters, gps_within_tolerance, sequence_order, scanned_at'
        )
        .eq('patrol_log_id', logId!)
        .order('scanned_at', { ascending: true });

      if (clError) throw clError;

      return { log: log!, checkpoint_logs: checkpointLogs ?? [] };
    },
    enabled: !!logId,
  });
}

// ---------- useStartPatrol ----------

/**
 * Mutation to start a new patrol session.
 * Fetches the route to determine total checkpoints, then inserts a patrol_log.
 */
export function useStartPatrol() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: {
      routeId: string;
      guardId: string;
      communityId: string;
    }) => {
      // Fetch route to get checkpoint_sequence length
      const { data: route, error: routeError } = await supabase
        .from('patrol_routes')
        .select('checkpoint_sequence')
        .eq('id', input.routeId)
        .single();

      if (routeError) throw routeError;
      if (!route) throw new Error('Ruta no encontrada');

      const checkpointsTotal = (route.checkpoint_sequence as string[]).length;

      const { data, error } = await supabase
        .from('patrol_logs')
        .insert({
          community_id: input.communityId,
          route_id: input.routeId,
          guard_id: input.guardId,
          checkpoints_total: checkpointsTotal,
          status: 'in_progress',
        } as any)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.patrols._def });
    },
  });
}

// ---------- useScanCheckpoint ----------

/**
 * Mutation to record an NFC checkpoint scan during a patrol.
 * The database trigger `update_patrol_progress` auto-increments checkpoints_visited
 * and auto-completes the patrol when all checkpoints are scanned.
 */
export function useScanCheckpoint() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: {
      patrolLogId: string;
      checkpointId: string;
      nfcSerialScanned: string;
      gpsLat: number | null;
      gpsLng: number | null;
      gpsAccuracyMeters: number | null;
      sequenceOrder: number;
    }) => {
      const { data, error } = await supabase
        .from('patrol_checkpoint_logs')
        .insert({
          patrol_log_id: input.patrolLogId,
          checkpoint_id: input.checkpointId,
          nfc_serial_scanned: input.nfcSerialScanned,
          gps_lat: input.gpsLat,
          gps_lng: input.gpsLng,
          gps_accuracy_meters: input.gpsAccuracyMeters,
          sequence_order: input.sequenceOrder,
        } as any)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.patrols._def });
    },
  });
}

// ---------- useAbandonPatrol ----------

/**
 * Mutation to abandon an in-progress patrol.
 */
export function useAbandonPatrol() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (patrolLogId: string) => {
      const { data, error } = await supabase
        .from('patrol_logs')
        .update({ status: 'abandoned' } as any)
        .eq('id', patrolLogId)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.patrols._def });
    },
  });
}
