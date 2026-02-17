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

export interface AmenityRow {
  id: string;
  name: string;
  description: string | null;
  amenity_type: string | null;
  location: string | null;
  capacity: number | null;
  requires_reservation: boolean | null;
  status: string;
  created_at: string;
}

export interface AmenityRule {
  id: string;
  rule_type: string;
  rule_value: Record<string, unknown> | null;
  priority: number | null;
  is_active: boolean | null;
}

export interface AmenityDetail extends AmenityRow {
  amenity_rules: AmenityRule[];
}

export interface ReservationRow {
  id: string;
  reserved_range: string | null;
  status: string;
  created_at: string;
}

export interface CreateAmenityInput {
  name: string;
  description?: string;
  amenity_type: string;
  location?: string;
  capacity?: number;
  requires_reservation: boolean;
}

export interface UpdateAmenityInput {
  id: string;
  name?: string;
  description?: string;
  amenity_type?: string;
  location?: string;
  capacity?: number;
  requires_reservation?: boolean;
  status?: string;
}

export interface CreateAmenityRuleInput {
  amenity_id: string;
  rule_type: string;
  rule_value: Record<string, unknown>;
  priority: number;
  is_active: boolean;
}

export interface UpdateAmenityRuleInput {
  id: string;
  rule_type?: string;
  rule_value?: Record<string, unknown>;
  priority?: number;
  is_active?: boolean;
}

/* ------------------------------------------------------------------ */
/*  Queries                                                           */
/* ------------------------------------------------------------------ */

/**
 * List all amenities for the community.
 */
export function useAmenities() {
  const { communityId } = useAuth();

  return useQuery({
    queryKey: queryKeys.amenities.list(communityId!).queryKey,
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('amenities')
        .select(
          'id, name, description, amenity_type, location, capacity, requires_reservation, status, created_at'
        )
        .eq('community_id', communityId!)
        .is('deleted_at', null)
        .order('name', { ascending: true });

      if (error) throw error;
      return (data ?? []) as AmenityRow[];
    },
    enabled: !!communityId,
  });
}

/**
 * Single amenity detail with rules.
 */
export function useAmenity(id: string) {
  const { communityId } = useAuth();

  return useQuery({
    queryKey: [...queryKeys.amenities.list(communityId!).queryKey, 'detail', id],
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('amenities')
        .select(
          '*, amenity_rules(id, rule_type, rule_value, priority, is_active)'
        )
        .eq('id', id)
        .eq('community_id', communityId!)
        .is('deleted_at', null)
        .single();

      if (error) throw error;
      return data as AmenityDetail;
    },
    enabled: !!communityId && !!id,
  });
}

/**
 * Reservation data for amenity utilization report.
 * Fetches confirmed/completed reservations within a date range.
 */
export function useAmenityUtilization(
  amenityId: string,
  dateFrom: string,
  dateTo: string
) {
  const { communityId } = useAuth();

  return useQuery({
    queryKey: [
      ...queryKeys.amenities.reservations(amenityId).queryKey,
      'utilization',
      { dateFrom, dateTo },
    ],
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('reservations')
        .select('id, reserved_range, status, created_at')
        .eq('amenity_id', amenityId)
        .in('status', ['confirmed', 'completed'])
        .gte('created_at', dateFrom)
        .lte('created_at', dateTo + 'T23:59:59')
        .order('created_at', { ascending: true });

      if (error) throw error;
      return (data ?? []) as ReservationRow[];
    },
    enabled: !!communityId && !!amenityId,
  });
}

/* ------------------------------------------------------------------ */
/*  Mutations                                                         */
/* ------------------------------------------------------------------ */

/**
 * Create a new amenity.
 */
export function useCreateAmenity() {
  const { communityId } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateAmenityInput) => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('amenities')
        .insert({
          community_id: communityId!,
          name: input.name,
          description: input.description || null,
          amenity_type: input.amenity_type as any,
          location: input.location || null,
          capacity: input.capacity ?? null,
          requires_reservation: input.requires_reservation,
          status: 'active',
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success('Amenidad creada exitosamente');
      queryClient.invalidateQueries({ queryKey: queryKeys.amenities._def });
    },
    onError: (error: Error) => {
      toastError('Error al crear amenidad', error);
    },
  });
}

/**
 * Update an existing amenity.
 */
export function useUpdateAmenity() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...updates }: UpdateAmenityInput) => {
      const supabase = createClient();
      // Clean undefined values
      const cleanUpdates: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(updates)) {
        if (value !== undefined) {
          cleanUpdates[key] = value;
        }
      }

      const { data, error } = await supabase
        .from('amenities')
        .update(cleanUpdates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success('Amenidad actualizada');
      queryClient.invalidateQueries({ queryKey: queryKeys.amenities._def });
    },
    onError: (error: Error) => {
      toastError('Error al actualizar amenidad', error);
    },
  });
}

/**
 * Create a rule for an amenity.
 */
export function useCreateAmenityRule() {
  const { communityId } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateAmenityRuleInput) => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('amenity_rules')
        .insert({
          amenity_id: input.amenity_id,
          community_id: communityId!,
          rule_type: input.rule_type as any,
          rule_value: input.rule_value as any,
          priority: input.priority,
          is_active: input.is_active,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success('Regla creada exitosamente');
      queryClient.invalidateQueries({ queryKey: queryKeys.amenities._def });
    },
    onError: (error: Error) => {
      toastError('Error al crear regla', error);
    },
  });
}

/**
 * Update an amenity rule.
 */
export function useUpdateAmenityRule() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...updates }: UpdateAmenityRuleInput) => {
      const supabase = createClient();
      const cleanUpdates: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(updates)) {
        if (value !== undefined) {
          cleanUpdates[key] = value;
        }
      }

      const { error } = await supabase
        .from('amenity_rules')
        .update(cleanUpdates)
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Regla actualizada');
      queryClient.invalidateQueries({ queryKey: queryKeys.amenities._def });
    },
    onError: (error: Error) => {
      toastError('Error al actualizar regla', error);
    },
  });
}
