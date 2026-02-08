import {
  useQuery,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query';
import { queryKeys } from '@upoe/shared';
import { supabase } from '@/lib/supabase';
import { useAuth } from './useAuth';

// ---------- useMyVehicles ----------

export function useMyVehicles() {
  const { residentId } = useAuth();

  return useQuery({
    queryKey: queryKeys.vehicles.list(residentId!).queryKey,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('vehicles')
        .select('id, plate_number, plate_state, make, model, color, year, status, access_enabled')
        .eq('resident_id', residentId!)
        .is('deleted_at', null)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: !!residentId,
  });
}

// ---------- useCreateVehicle ----------

interface CreateVehicleInput {
  plate_number: string;
  plate_state: string;
  make?: string;
  model?: string;
  color?: string;
  year?: number;
}

export function useCreateVehicle() {
  const { residentId, communityId } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateVehicleInput) => {
      const { data, error } = await supabase
        .from('vehicles')
        .insert({
          community_id: communityId!,
          resident_id: residentId!,
          plate_number: input.plate_number.toUpperCase(),
          plate_state: input.plate_state,
          make: input.make ?? undefined,
          model: input.model ?? undefined,
          color: input.color ?? undefined,
          year: input.year ?? undefined,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.vehicles._def });
    },
  });
}

// ---------- useUpdateVehicle ----------

interface UpdateVehicleInput {
  id: string;
  make?: string;
  model?: string;
  color?: string;
  year?: number;
}

export function useUpdateVehicle() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: UpdateVehicleInput) => {
      const { id, ...fields } = input;
      const updatePayload: Record<string, unknown> = {};

      if (fields.make !== undefined) updatePayload.make = fields.make;
      if (fields.model !== undefined) updatePayload.model = fields.model;
      if (fields.color !== undefined) updatePayload.color = fields.color;
      if (fields.year !== undefined) updatePayload.year = fields.year;

      const { error } = await supabase
        .from('vehicles')
        .update(updatePayload)
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.vehicles._def });
    },
  });
}

// ---------- useDeleteVehicle ----------

export function useDeleteVehicle() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (vehicleId: string) => {
      const { error } = await supabase
        .from('vehicles')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', vehicleId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.vehicles._def });
    },
  });
}
