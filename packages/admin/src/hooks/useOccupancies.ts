'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@upoe/shared';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from './useAuth';
import { toast } from 'sonner';
import { toastError } from '@/lib/toast-error';

// ── Types ──────────────────────────────────────────────────────────

interface CreateOccupancyInput {
  unit_id: string;
  resident_id: string;
  occupancy_type: 'owner' | 'tenant' | 'authorized' | 'employee';
  start_date?: string;
  notes?: string;
}

interface RemoveOccupancyInput {
  occupancy_id: string;
  unit_id: string;
}

// ── Mutation: Create occupancy ──────────────────────────────────────

/**
 * Assign a resident to a unit with a given occupancy type.
 */
export function useCreateOccupancy() {
  const { communityId } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateOccupancyInput) => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('occupancies')
        .insert({
          community_id: communityId!,
          unit_id: input.unit_id,
          resident_id: input.resident_id,
          occupancy_type: input.occupancy_type,
          start_date: input.start_date ?? new Date().toISOString().split('T')[0],
          notes: input.notes ?? null,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      toast.success('Residente asignado a la unidad');
      queryClient.invalidateQueries({ queryKey: queryKeys.units.detail(variables.unit_id).queryKey });
      queryClient.invalidateQueries({ queryKey: queryKeys.occupancies._def });
      queryClient.invalidateQueries({ queryKey: queryKeys.residents._def });
    },
    onError: (error: Error) => {
      toastError('Error al asignar', error);
    },
  });
}

// ── Mutation: Remove occupancy (soft delete) ────────────────────────

/**
 * Remove a resident-unit assignment by setting end_date and status = inactive.
 */
export function useRemoveOccupancy() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ occupancy_id }: RemoveOccupancyInput) => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('occupancies')
        .update({
          end_date: new Date().toISOString().split('T')[0],
          status: 'inactive' as const,
        })
        .eq('id', occupancy_id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      toast.success('Asignacion removida');
      queryClient.invalidateQueries({ queryKey: queryKeys.units.detail(variables.unit_id).queryKey });
      queryClient.invalidateQueries({ queryKey: queryKeys.occupancies._def });
      queryClient.invalidateQueries({ queryKey: queryKeys.residents._def });
    },
    onError: (error: Error) => {
      toastError('Error al remover asignacion', error);
    },
  });
}
