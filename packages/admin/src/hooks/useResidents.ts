'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@upoe/shared';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from './useAuth';
import { toast } from 'sonner';
import { toastError } from '@/lib/toast-error';

/**
 * Fetch paginated list of residents for the admin's community.
 * Supports text search across name and email.
 */
export function useResidents(search?: string, page = 0, pageSize = 20) {
  const { communityId } = useAuth();

  return useQuery({
    queryKey: [...queryKeys.residents.list(communityId!).queryKey, { search, page, pageSize }],
    queryFn: async () => {
      const supabase = createClient();
      let query = supabase
        .from('residents')
        .select(
          'id, first_name, paternal_surname, maternal_surname, email, phone, onboarding_status, user_id, created_at',
          { count: 'exact' }
        )
        .eq('community_id', communityId!)
        .is('deleted_at', null)
        .order('paternal_surname', { ascending: true });

      if (search) {
        query = query.or(
          `first_name.ilike.%${search}%,paternal_surname.ilike.%${search}%,email.ilike.%${search}%`
        );
      }

      const from = page * pageSize;
      const to = from + pageSize - 1;
      query = query.range(from, to);

      const { data, error, count } = await query;
      if (error) throw error;
      return { data: data ?? [], count: count ?? 0 };
    },
    enabled: !!communityId,
  });
}

/**
 * Fetch a single resident with their occupancy assignments and units.
 */
export function useResident(id: string) {
  const { communityId } = useAuth();

  return useQuery({
    queryKey: queryKeys.residents.detail(id).queryKey,
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('residents')
        .select('*, occupancies!occupancies_resident_id_fkey(*, units(*))')
        .eq('id', id)
        .eq('community_id', communityId!)
        .is('deleted_at', null)
        .single();

      if (error) throw error;
      return data;
    },
    enabled: !!communityId && !!id,
  });
}

interface CreateResidentInput {
  first_name: string;
  paternal_surname: string;
  maternal_surname?: string;
  email: string;
  phone?: string;
}

/**
 * Create a new resident in the community.
 * Sets onboarding_status = 'invited' and invited_at = now.
 */
export function useCreateResident() {
  const { communityId } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateResidentInput) => {
      const supabase = createClient();
      const id = crypto.randomUUID();
      const { data, error } = await supabase
        .from('residents')
        .insert({
          id,
          community_id: communityId!,
          first_name: input.first_name,
          paternal_surname: input.paternal_surname,
          maternal_surname: input.maternal_surname ?? null,
          email: input.email,
          phone: input.phone ?? null,
          onboarding_status: 'invited',
          invited_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success('Residente creado exitosamente');
      queryClient.invalidateQueries({ queryKey: queryKeys.residents._def });
    },
    onError: (error: Error) => {
      toastError('Error al crear residente', error);
    },
  });
}

interface UpdateResidentInput {
  id: string;
  first_name?: string;
  paternal_surname?: string;
  maternal_surname?: string;
  email?: string;
  phone?: string;
}

/**
 * Update an existing resident's profile information.
 */
export function useUpdateResident() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...updates }: UpdateResidentInput) => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('residents')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      toast.success('Residente actualizado exitosamente');
      queryClient.invalidateQueries({ queryKey: queryKeys.residents._def });
      queryClient.invalidateQueries({ queryKey: queryKeys.residents.detail(data.id).queryKey });
    },
    onError: (error: Error) => {
      toastError('Error al actualizar residente', error);
    },
  });
}

/**
 * Deactivate a resident by setting onboarding_status = 'inactive'.
 */
export function useDeactivateResident() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('residents')
        .update({ onboarding_status: 'inactive' as const })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success('Residente desactivado');
      queryClient.invalidateQueries({ queryKey: queryKeys.residents._def });
    },
    onError: (error: Error) => {
      toastError('Error al desactivar residente', error);
    },
  });
}
