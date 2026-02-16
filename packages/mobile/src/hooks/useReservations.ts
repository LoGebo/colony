import {
  useQuery,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query';
import { queryKeys } from '@upoe/shared';
import { supabase } from '@/lib/supabase';
import { useAuth } from './useAuth';
import { useResidentUnit } from './useOccupancy';

// ---------- parseTstzrange ----------

/**
 * Parse PostgreSQL tstzrange format into start/end Date objects.
 * Format: ["2026-02-08 10:00:00+00","2026-02-08 12:00:00+00")
 * Strips bracket/paren chars, splits by comma, parses each timestamp.
 */
export function parseTstzrange(range: string): { start: Date; end: Date } {
  // Strip leading [ or ( and trailing ] or )
  const inner = range.replace(/^[\[(\s]+/, '').replace(/[\])\s]+$/, '');
  const parts = inner.split(',');
  const startStr = (parts[0] ?? '').replace(/^["'\s]+/, '').replace(/["'\s]+$/, '');
  const endStr = (parts[1] ?? '').replace(/^["'\s]+/, '').replace(/["'\s]+$/, '');

  return {
    start: new Date(startStr),
    end: new Date(endStr),
  };
}

// ---------- useAmenities ----------

export function useAmenities() {
  const { communityId } = useAuth();

  return useQuery({
    queryKey: queryKeys.amenities.list(communityId!).queryKey,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('amenities')
        .select(
          'id, name, description, amenity_type, location, capacity, photo_urls, requires_reservation, hourly_rate, deposit_amount, rules_document_url, schedule, status'
        )
        .eq('community_id', communityId!)
        .eq('status', 'active' as never)
        .is('deleted_at', null)
        .order('name', { ascending: true });

      if (error) throw error;
      return data;
    },
    enabled: !!communityId,
  });
}

// ---------- useAmenityDetail ----------

export function useAmenityDetail(amenityId: string) {
  return useQuery({
    queryKey: queryKeys.amenities.detail(amenityId).queryKey,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('amenities')
        .select(
          'id, name, description, amenity_type, location, capacity, photo_urls, requires_reservation, hourly_rate, deposit_amount, rules_document_url, schedule, status'
        )
        .eq('id', amenityId)
        .single();

      if (error) throw error;
      return data;
    },
    enabled: !!amenityId,
  });
}

// ---------- useAmenityReservations ----------

export function useAmenityReservations(amenityId: string, month?: string) {
  const { communityId } = useAuth();

  return useQuery({
    queryKey: queryKeys.amenities.reservations(amenityId, month).queryKey,
    queryFn: async () => {
      // Calculate month boundaries
      const baseDate = month ? new Date(`${month}-01T00:00:00Z`) : new Date();
      const year = baseDate.getFullYear();
      const monthIdx = baseDate.getMonth();
      const startOfMonth = new Date(Date.UTC(year, monthIdx, 1)).toISOString();
      const endOfMonth = new Date(Date.UTC(year, monthIdx + 1, 0, 23, 59, 59)).toISOString();

      // Fetch all reservations for the amenity, then filter client-side by month.
      // PostgREST range filtering on tstzrange is unreliable, so we fetch all
      // non-deleted, non-cancelled reservations and filter in JS.
      const { data, error } = await supabase
        .from('reservations')
        .select(
          'id, reserved_range, status, resident_id, residents(first_name, paternal_surname)'
        )
        .eq('amenity_id', amenityId)
        .eq('community_id', communityId!)
        .in('status', ['confirmed' as never, 'pending' as never])
        .is('deleted_at', null);

      if (error) throw error;

      // Filter by month client-side
      const filtered = (data ?? []).filter((r) => {
        try {
          const { start, end } = parseTstzrange(r.reserved_range as string);
          // Reservation overlaps with the month if it starts before month-end
          // AND ends after month-start
          return start <= new Date(endOfMonth) && end >= new Date(startOfMonth);
        } catch {
          return false;
        }
      });

      return filtered;
    },
    enabled: !!communityId && !!amenityId,
  });
}

// ---------- useCreateReservation ----------

export function useCreateReservation() {
  const { residentId } = useAuth();
  const { unitId } = useResidentUnit();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: {
      amenity_id: string;
      start_time: string; // ISO timestamp
      end_time: string; // ISO timestamp
      notes?: string | null;
    }) => {
      if (!unitId) throw new Error('No unit found for current resident. Please contact your administrator.');
      if (!residentId) throw new Error('Resident profile not found. Please sign in again.');

      const { data, error } = await supabase.rpc('create_reservation', {
        p_amenity_id: input.amenity_id,
        p_unit_id: unitId,
        p_resident_id: residentId,
        p_start_time: input.start_time,
        p_end_time: input.end_time,
        p_notes: input.notes || undefined,
      });

      if (error) throw error;
      return data; // Returns reservation UUID
    },
    onSuccess: (_data, variables) => {
      // Invalidate all amenity queries (broad)
      queryClient.invalidateQueries({ queryKey: queryKeys.amenities._def });
      // Explicitly refetch reservations for this amenity (any month)
      queryClient.invalidateQueries({
        queryKey: queryKeys.amenities.reservations(variables.amenity_id).queryKey,
        refetchType: 'all',
      });
    },
  });
}

// ---------- useMyReservations ----------

export function useMyReservations() {
  const { residentId, communityId } = useAuth();

  return useQuery({
    queryKey: queryKeys.amenities.myReservations(residentId!).queryKey,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('reservations')
        .select(
          'id, reserved_range, status, cancelled_at, cancellation_reason, notes, created_at, amenities(name, amenity_type, location, photo_urls)'
        )
        .eq('resident_id', residentId!)
        .eq('community_id', communityId!)
        .is('deleted_at', null)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: !!residentId && !!communityId,
  });
}

// ---------- useCancelReservation ----------

export function useCancelReservation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      reservationId,
      reason,
    }: {
      reservationId: string;
      reason?: string;
    }) => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      const { error } = await supabase
        .from('reservations')
        .update({
          status: 'cancelled' as never,
          cancelled_at: new Date().toISOString(),
          cancelled_by: user!.id,
          cancellation_reason: reason ?? null,
        })
        .eq('id', reservationId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.amenities._def });
    },
  });
}
