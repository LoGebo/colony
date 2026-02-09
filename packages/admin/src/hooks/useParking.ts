'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@upoe/shared';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from './useAuth';
import { toast } from 'sonner';

/* ------------------------------------------------------------------ */
/*  Types                                                             */
/* ------------------------------------------------------------------ */

export interface ParkingSpotRow {
  id: string;
  spot_number: string;
  spot_type: string;
  status: string;
  floor_level: string | null;
  zone: string | null;
  is_covered: boolean;
  is_handicap: boolean;
  monthly_rate: number | null;
  parking_assignments: {
    id: string;
    unit_id: string;
    assignment_type: string;
    start_date: string;
    end_date: string | null;
    units: { unit_number: string } | null;
  }[];
}

export interface ParkingReservationRow {
  id: string;
  spot_id: string;
  visitor_name: string;
  vehicle_plate: string;
  status: string;
  reserved_from: string;
  reserved_until: string;
  checked_in_at: string | null;
  checked_out_at: string | null;
  parking_spots: { spot_number: string } | null;
}

export interface ParkingViolationRow {
  id: string;
  violation_type: string;
  description: string | null;
  spot_id: string | null;
  vehicle_plate: string | null;
  reported_by: string | null;
  status: string;
  fine_amount: number | null;
  reported_at: string;
  parking_spots: { spot_number: string } | null;
}

export interface CreateParkingSpotInput {
  spot_number: string;
  spot_type: string;
  floor_level?: string;
  zone?: string;
  is_covered?: boolean;
  is_handicap?: boolean;
  monthly_rate?: number;
}

export interface UpdateParkingSpotInput {
  id: string;
  spot_number?: string;
  spot_type?: string;
  status?: string;
  floor_level?: string;
  zone?: string;
  is_covered?: boolean;
  is_handicap?: boolean;
  monthly_rate?: number;
}

export interface AssignParkingSpotInput {
  parking_spot_id: string;
  unit_id: string;
  assignment_type: string;
  start_date: string;
  end_date?: string;
}

export interface UpdateParkingViolationInput {
  id: string;
  status?: string;
  fine_amount?: number;
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
          'id, spot_number, spot_type, status, floor_level, zone, is_covered, is_handicap, monthly_rate, parking_assignments(id, unit_id, assignment_type, start_date, end_date, units(unit_number))'
        )
        .eq('community_id', communityId!)
        .order('spot_number', { ascending: true });

      if (typeFilter) {
        query = query.eq('spot_type', typeFilter as never);
      }
      if (statusFilter) {
        query = query.eq('status', statusFilter as never);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as unknown as ParkingSpotRow[];
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
          'id, spot_id, visitor_name, vehicle_plate, status, reserved_from, reserved_until, checked_in_at, checked_out_at, parking_spots(spot_number)'
        )
        .eq('community_id', communityId!)
        .order('reserved_from', { ascending: false });

      if (error) throw error;
      return (data ?? []) as unknown as ParkingReservationRow[];
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
          'id, violation_type, description, spot_id, vehicle_plate, reported_by, status, fine_amount, reported_at, parking_spots(spot_number)'
        )
        .eq('community_id', communityId!)
        .order('reported_at', { ascending: false });

      if (statusFilter) {
        query = query.eq('status', statusFilter as never);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as unknown as ParkingViolationRow[];
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
          floor_level: input.floor_level ?? null,
          zone: input.zone ?? null,
          is_covered: input.is_covered ?? false,
          is_handicap: input.is_handicap ?? false,
          monthly_rate: input.monthly_rate ?? null,
          status: 'available',
        } as never)
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
      toast.error(`Error al crear estacionamiento: ${error.message}`);
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
        .update(updates as never)
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
      toast.error(`Error al actualizar estacionamiento: ${error.message}`);
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
          start_date: input.start_date,
          end_date: input.end_date ?? null,
        } as never);

      if (assignError) throw assignError;

      // Update spot status to occupied
      const { error: updateError } = await supabase
        .from('parking_spots')
        .update({ status: 'occupied' } as never)
        .eq('id', input.parking_spot_id);

      if (updateError) throw updateError;
    },
    onSuccess: () => {
      toast.success('Estacionamiento asignado');
      queryClient.invalidateQueries({ queryKey: queryKeys.parking._def });
    },
    onError: (error: Error) => {
      toast.error(`Error al asignar estacionamiento: ${error.message}`);
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
        .update({ status: 'available' } as never)
        .eq('id', spotId);

      if (updateError) throw updateError;
    },
    onSuccess: () => {
      toast.success('Estacionamiento desasignado');
      queryClient.invalidateQueries({ queryKey: queryKeys.parking._def });
    },
    onError: (error: Error) => {
      toast.error(`Error al desasignar estacionamiento: ${error.message}`);
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
        .update(updates as never)
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
      toast.error(`Error al actualizar infraccion: ${error.message}`);
    },
  });
}
