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

export interface ParkingSpotRow {
  id: string;
  spot_number: string;
  spot_type: string;
  status: string;
  level: string | null;
  section: string | null;
  is_covered: boolean;
  is_electric_vehicle: boolean;
  monthly_fee: number | null;
  parking_assignments: {
    id: string;
    unit_id: string;
    assignment_type: string;
    assigned_from: string;
    assigned_until: string | null;
    units: { unit_number: string } | null;
  }[];
}

export interface ParkingReservationRow {
  id: string;
  parking_spot_id: string;
  visitor_name: string;
  visitor_vehicle_plates: string | null;
  status: string;
  reservation_date: string;
  start_time: string | null;
  end_time: string | null;
  checked_in_at: string | null;
  checked_out_at: string | null;
  parking_spots: { spot_number: string } | null;
}

export interface ParkingViolationRow {
  id: string;
  violation_type: string;
  description: string | null;
  parking_spot_id: string | null;
  vehicle_plates: string | null;
  reported_by: string | null;
  status: string;
  observed_at: string;
  parking_spots: { spot_number: string } | null;
}

export interface CreateParkingSpotInput {
  spot_number: string;
  spot_type: string;
  level?: string;
  section?: string;
  is_covered?: boolean;
  is_electric_vehicle?: boolean;
  monthly_fee?: number;
}

export interface UpdateParkingSpotInput {
  id: string;
  spot_number?: string;
  spot_type?: string;
  status?: string;
  level?: string;
  section?: string;
  is_covered?: boolean;
  is_electric_vehicle?: boolean;
  monthly_fee?: number;
}

export interface AssignParkingSpotInput {
  parking_spot_id: string;
  unit_id: string;
  assignment_type: string;
  assigned_from: string;
  assigned_until?: string;
}

export interface UpdateParkingViolationInput {
  id: string;
  status?: string;
  resolution_notes?: string;
}

/* ------------------------------------------------------------------ */
/*  Queries                                                           */
/* ------------------------------------------------------------------ */

/**
 * Fetch parking spots for the community with optional filters.
 */
export function useParkingSpots(
  typeFilter?: string,
  statusFilter?: string
) {
  const { communityId } = useAuth();

  return useQuery({
    queryKey: [...queryKeys.parking.spots(communityId!).queryKey, { typeFilter, statusFilter }],
    queryFn: async () => {
      const supabase = createClient();
      let query = supabase
        .from('parking_spots')
        .select(
          'id, spot_number, spot_type, status, level, section, is_covered, is_electric_vehicle, monthly_fee, parking_assignments(id, unit_id, assignment_type, assigned_from, assigned_until, units(unit_number))'
        )
        .eq('community_id', communityId!)
        .order('spot_number', { ascending: true });

      if (typeFilter) {
        query = query.eq('spot_type', typeFilter as any);
      }
      if (statusFilter) {
        query = query.eq('status', statusFilter as any);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as ParkingSpotRow[];
    },
    enabled: !!communityId,
  });
}

/**
 * Fetch visitor parking reservations for the community.
 */
export function useParkingReservations() {
  const { communityId } = useAuth();

  return useQuery({
    queryKey: queryKeys.parking.reservations(communityId!).queryKey,
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('parking_reservations')
        .select(
          'id, parking_spot_id, visitor_name, visitor_vehicle_plates, status, reservation_date, start_time, end_time, checked_in_at, checked_out_at, parking_spots(spot_number)'
        )
        .eq('community_id', communityId!)
        .order('reservation_date', { ascending: false });

      if (error) throw error;
      return (data ?? []) as ParkingReservationRow[];
    },
    enabled: !!communityId,
  });
}

/**
 * Fetch parking violations for the community.
 */
export function useParkingViolations(statusFilter?: string) {
  const { communityId } = useAuth();

  return useQuery({
    queryKey: [...queryKeys.parking.violations(communityId!).queryKey, { statusFilter }],
    queryFn: async () => {
      const supabase = createClient();
      let query = supabase
        .from('parking_violations')
        .select(
          'id, violation_type, description, parking_spot_id, vehicle_plates, reported_by, status, observed_at, parking_spots(spot_number)'
        )
        .eq('community_id', communityId!)
        .order('observed_at', { ascending: false });

      if (statusFilter) {
        query = query.eq('status', statusFilter as any);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as ParkingViolationRow[];
    },
    enabled: !!communityId,
  });
}

/* ------------------------------------------------------------------ */
/*  Mutations                                                         */
/* ------------------------------------------------------------------ */

/**
 * Create a new parking spot.
 */
export function useCreateParkingSpot() {
  const { communityId } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateParkingSpotInput) => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('parking_spots')
        .insert({
          community_id: communityId!,
          spot_number: input.spot_number,
          spot_type: input.spot_type,
          level: input.level ?? null,
          section: input.section ?? null,
          is_covered: input.is_covered ?? false,
          is_electric_vehicle: input.is_electric_vehicle ?? false,
          monthly_fee: input.monthly_fee ?? null,
          status: 'available',
        } as any)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success('Estacionamiento creado');
      queryClient.invalidateQueries({ queryKey: queryKeys.parking._def });
    },
    onError: (error: Error) => {
      toastError('Error al crear estacionamiento', error);
    },
  });
}

/**
 * Update an existing parking spot.
 */
export function useUpdateParkingSpot() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...updates }: UpdateParkingSpotInput) => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('parking_spots')
        .update(updates as any)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success('Estacionamiento actualizado');
      queryClient.invalidateQueries({ queryKey: queryKeys.parking._def });
    },
    onError: (error: Error) => {
      toastError('Error al actualizar estacionamiento', error);
    },
  });
}

/**
 * Assign a parking spot to a unit.
 */
export function useAssignParkingSpot() {
  const { communityId } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: AssignParkingSpotInput) => {
      const supabase = createClient();

      // Insert assignment
      const { error: assignError } = await supabase
        .from('parking_assignments')
        .insert({
          parking_spot_id: input.parking_spot_id,
          unit_id: input.unit_id,
          community_id: communityId!,
          assignment_type: input.assignment_type,
          assigned_from: input.assigned_from,
          assigned_until: input.assigned_until ?? null,
        } as any);

      if (assignError) throw assignError;

      // Update spot status to occupied
      const { error: updateError } = await supabase
        .from('parking_spots')
        .update({ status: 'occupied' } as any)
        .eq('id', input.parking_spot_id);

      if (updateError) throw updateError;
    },
    onSuccess: () => {
      toast.success('Estacionamiento asignado');
      queryClient.invalidateQueries({ queryKey: queryKeys.parking._def });
    },
    onError: (error: Error) => {
      toastError('Error al asignar estacionamiento', error);
    },
  });
}

/**
 * Unassign a parking spot (delete assignment and set spot to available).
 */
export function useUnassignParkingSpot() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ assignmentId, spotId }: { assignmentId: string; spotId: string }) => {
      const supabase = createClient();

      // Delete the assignment
      const { error: deleteError } = await supabase
        .from('parking_assignments')
        .delete()
        .eq('id', assignmentId);

      if (deleteError) throw deleteError;

      // Set spot back to available
      const { error: updateError } = await supabase
        .from('parking_spots')
        .update({ status: 'available' } as any)
        .eq('id', spotId);

      if (updateError) throw updateError;
    },
    onSuccess: () => {
      toast.success('Estacionamiento desasignado');
      queryClient.invalidateQueries({ queryKey: queryKeys.parking._def });
    },
    onError: (error: Error) => {
      toastError('Error al desasignar estacionamiento', error);
    },
  });
}

/**
 * Update a parking violation (status change, fine amount).
 */
export function useUpdateParkingViolation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...updates }: UpdateParkingViolationInput) => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('parking_violations')
        .update(updates as any)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success('Infraccion actualizada');
      queryClient.invalidateQueries({ queryKey: queryKeys.parking._def });
    },
    onError: (error: Error) => {
      toastError('Error al actualizar infraccion', error);
    },
  });
}
