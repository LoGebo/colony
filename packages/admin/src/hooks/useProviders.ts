'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@upoe/shared';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from './useAuth';
import { toast } from 'sonner';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export interface ProviderRow {
  id: string;
  company_name: string;
  contact_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  specialty: string | null;
  status: string;
  total_work_orders: number;
  average_rating: number | null;
  created_at: string;
}

export interface ProviderDocumentRow {
  id: string;
  document_type: string;
  document_number: string | null;
  issued_by: string | null;
  issue_date: string | null;
  expiry_date: string | null;
  status: string;
  file_url: string | null;
  notes: string | null;
  created_at: string;
}

export interface ProviderPersonnelRow {
  id: string;
  first_name: string;
  last_name: string;
  document_type: string | null;
  document_number: string | null;
  phone: string | null;
  photo_url: string | null;
  is_active: boolean;
  created_at: string;
}

export interface ProviderScheduleRow {
  id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  effective_from: string | null;
  effective_until: string | null;
  is_active: boolean;
  notes: string | null;
}

/* ------------------------------------------------------------------ */
/*  1. useProviderList                                                 */
/* ------------------------------------------------------------------ */

export function useProviderList(communityId: string | undefined, statusFilter?: string) {
  return useQuery({
    queryKey: [
      ...queryKeys.providers.list(communityId!).queryKey,
      { statusFilter },
    ],
    queryFn: async () => {
      const supabase = createClient();
      let query = supabase
        .from('providers')
        .select(
          'id, company_name, contact_name, contact_email, contact_phone, specialty, status, total_work_orders, average_rating, created_at'
        )
        .eq('community_id', communityId!)
        .order('company_name', { ascending: true });

      if (statusFilter) {
        query = query.eq('status', statusFilter as never);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as unknown as ProviderRow[];
    },
    enabled: !!communityId,
  });
}

/* ------------------------------------------------------------------ */
/*  2. useProviderDetail                                               */
/* ------------------------------------------------------------------ */

export function useProviderDetail(id: string | undefined) {
  return useQuery({
    queryKey: queryKeys.providers.detail(id!).queryKey,
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('providers')
        .select('*')
        .eq('id', id!)
        .single();

      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });
}

/* ------------------------------------------------------------------ */
/*  3. useCreateProvider                                                */
/* ------------------------------------------------------------------ */

interface CreateProviderInput {
  company_name: string;
  contact_name?: string;
  contact_email?: string;
  contact_phone?: string;
  specialty?: string;
  tax_id?: string;
  address?: string;
  notes?: string;
}

export function useCreateProvider() {
  const { communityId } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateProviderInput) => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('providers')
        .insert({
          community_id: communityId!,
          company_name: input.company_name,
          contact_name: input.contact_name ?? null,
          contact_email: input.contact_email ?? null,
          contact_phone: input.contact_phone ?? null,
          specialty: input.specialty ?? null,
          tax_id: input.tax_id ?? null,
          address: input.address ?? null,
          notes: input.notes ?? null,
          status: 'pending_approval' as never,
        } as never)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success('Proveedor creado exitosamente');
      queryClient.invalidateQueries({ queryKey: queryKeys.providers._def });
    },
    onError: (error: Error) => {
      toast.error(`Error al crear proveedor: ${error.message}`);
    },
  });
}

/* ------------------------------------------------------------------ */
/*  4. useUpdateProvider                                                */
/* ------------------------------------------------------------------ */

interface UpdateProviderInput {
  id: string;
  [key: string]: unknown;
}

export function useUpdateProvider() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...updates }: UpdateProviderInput) => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('providers')
        .update(updates as never)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success('Proveedor actualizado');
      queryClient.invalidateQueries({ queryKey: queryKeys.providers._def });
    },
    onError: (error: Error) => {
      toast.error(`Error al actualizar proveedor: ${error.message}`);
    },
  });
}

/* ------------------------------------------------------------------ */
/*  5. useProviderDocuments                                            */
/* ------------------------------------------------------------------ */

export function useProviderDocuments(providerId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.providers.documents(providerId!).queryKey,
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('provider_documents')
        .select(
          'id, document_type, document_number, issued_by, issue_date, expiry_date, status, file_url, notes, created_at'
        )
        .eq('provider_id', providerId!)
        .order('expiry_date', { ascending: true });

      if (error) throw error;
      return (data ?? []) as unknown as ProviderDocumentRow[];
    },
    enabled: !!providerId,
  });
}

/* ------------------------------------------------------------------ */
/*  6. useCreateProviderDocument                                       */
/* ------------------------------------------------------------------ */

interface CreateProviderDocumentInput {
  provider_id: string;
  document_type: string;
  document_number?: string;
  issued_by?: string;
  issue_date?: string;
  expiry_date?: string;
  notes?: string;
}

export function useCreateProviderDocument() {
  const { communityId } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateProviderDocumentInput) => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('provider_documents')
        .insert({
          provider_id: input.provider_id,
          community_id: communityId!,
          document_type: input.document_type,
          document_number: input.document_number ?? null,
          issued_by: input.issued_by ?? null,
          issue_date: input.issue_date ?? null,
          expiry_date: input.expiry_date ?? null,
          status: 'pending_verification' as never,
          notes: input.notes ?? null,
        } as never)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_data, variables) => {
      toast.success('Documento agregado');
      queryClient.invalidateQueries({
        queryKey: queryKeys.providers.documents(variables.provider_id).queryKey,
      });
    },
    onError: (error: Error) => {
      toast.error(`Error al agregar documento: ${error.message}`);
    },
  });
}

/* ------------------------------------------------------------------ */
/*  7. useUpdateProviderDocument                                       */
/* ------------------------------------------------------------------ */

interface UpdateProviderDocumentInput {
  id: string;
  provider_id: string;
  [key: string]: unknown;
}

export function useUpdateProviderDocument() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, provider_id, ...updates }: UpdateProviderDocumentInput) => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('provider_documents')
        .update(updates as never)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return { ...data, provider_id };
    },
    onSuccess: (_data, variables) => {
      toast.success('Documento actualizado');
      queryClient.invalidateQueries({
        queryKey: queryKeys.providers.documents(variables.provider_id).queryKey,
      });
    },
    onError: (error: Error) => {
      toast.error(`Error al actualizar documento: ${error.message}`);
    },
  });
}

/* ------------------------------------------------------------------ */
/*  8. useProviderPersonnel                                            */
/* ------------------------------------------------------------------ */

export function useProviderPersonnel(providerId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.providers.personnel(providerId!).queryKey,
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('provider_personnel')
        .select(
          'id, first_name, last_name, document_type, document_number, phone, photo_url, is_active, created_at'
        )
        .eq('provider_id', providerId!)
        .order('last_name', { ascending: true });

      if (error) throw error;
      return (data ?? []) as unknown as ProviderPersonnelRow[];
    },
    enabled: !!providerId,
  });
}

/* ------------------------------------------------------------------ */
/*  9. useCreateProviderPersonnel                                      */
/* ------------------------------------------------------------------ */

interface CreateProviderPersonnelInput {
  provider_id: string;
  first_name: string;
  last_name: string;
  document_type?: string;
  document_number?: string;
  phone?: string;
}

export function useCreateProviderPersonnel() {
  const { communityId } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateProviderPersonnelInput) => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('provider_personnel')
        .insert({
          provider_id: input.provider_id,
          community_id: communityId!,
          first_name: input.first_name,
          last_name: input.last_name,
          document_type: input.document_type ?? null,
          document_number: input.document_number ?? null,
          phone: input.phone ?? null,
        } as never)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_data, variables) => {
      toast.success('Personal agregado');
      queryClient.invalidateQueries({
        queryKey: queryKeys.providers.personnel(variables.provider_id).queryKey,
      });
    },
    onError: (error: Error) => {
      toast.error(`Error al agregar personal: ${error.message}`);
    },
  });
}

/* ------------------------------------------------------------------ */
/*  10. useTogglePersonnelActive                                       */
/* ------------------------------------------------------------------ */

export function useTogglePersonnelActive() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      provider_id,
      is_active,
    }: {
      id: string;
      provider_id: string;
      is_active: boolean;
    }) => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('provider_personnel')
        .update({ is_active: !is_active } as never)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return { ...data, provider_id };
    },
    onSuccess: (_data, variables) => {
      toast.success(variables.is_active ? 'Personal desactivado' : 'Personal activado');
      queryClient.invalidateQueries({
        queryKey: queryKeys.providers.personnel(variables.provider_id).queryKey,
      });
    },
    onError: (error: Error) => {
      toast.error(`Error al cambiar estado: ${error.message}`);
    },
  });
}

/* ------------------------------------------------------------------ */
/*  11. useProviderSchedules                                           */
/* ------------------------------------------------------------------ */

export function useProviderSchedules(providerId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.providers.schedules(providerId!).queryKey,
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('provider_access_schedules')
        .select(
          'id, day_of_week, start_time, end_time, effective_from, effective_until, is_active, notes'
        )
        .eq('provider_id', providerId!)
        .order('day_of_week', { ascending: true })
        .order('start_time', { ascending: true });

      if (error) throw error;
      return (data ?? []) as unknown as ProviderScheduleRow[];
    },
    enabled: !!providerId,
  });
}

/* ------------------------------------------------------------------ */
/*  12. useCreateProviderSchedule                                      */
/* ------------------------------------------------------------------ */

interface CreateProviderScheduleInput {
  provider_id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  effective_from?: string;
  effective_until?: string;
}

export function useCreateProviderSchedule() {
  const { communityId } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateProviderScheduleInput) => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('provider_access_schedules')
        .insert({
          provider_id: input.provider_id,
          community_id: communityId!,
          day_of_week: input.day_of_week,
          start_time: input.start_time,
          end_time: input.end_time,
          effective_from: input.effective_from ?? null,
          effective_until: input.effective_until ?? null,
        } as never)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_data, variables) => {
      toast.success('Horario agregado');
      queryClient.invalidateQueries({
        queryKey: queryKeys.providers.schedules(variables.provider_id).queryKey,
      });
    },
    onError: (error: Error) => {
      toast.error(`Error al agregar horario: ${error.message}`);
    },
  });
}

/* ------------------------------------------------------------------ */
/*  13. useDeleteProviderSchedule                                      */
/* ------------------------------------------------------------------ */

export function useDeleteProviderSchedule() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, provider_id }: { id: string; provider_id: string }) => {
      const supabase = createClient();
      const { error } = await supabase
        .from('provider_access_schedules')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: (_data, variables) => {
      toast.success('Horario eliminado');
      queryClient.invalidateQueries({
        queryKey: queryKeys.providers.schedules(variables.provider_id).queryKey,
      });
    },
    onError: (error: Error) => {
      toast.error(`Error al eliminar horario: ${error.message}`);
    },
  });
}

/* ------------------------------------------------------------------ */
/*  14. useExpiringDocuments                                           */
/* ------------------------------------------------------------------ */

export function useExpiringDocuments(communityId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.providers.expiringDocs(communityId!).queryKey,
    queryFn: async () => {
      const supabase = createClient();
      const thirtyDaysFromNow = new Date();
      thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
      const cutoff = thirtyDaysFromNow.toISOString().split('T')[0];

      const { data, error } = await supabase
        .from('provider_documents')
        .select(
          'id, document_type, expiry_date, status, provider_id, providers!inner(company_name)'
        )
        .eq('providers.community_id', communityId!)
        .lte('expiry_date', cutoff)
        .neq('status', 'rejected' as never)
        .order('expiry_date', { ascending: true });

      if (error) throw error;
      return data ?? [];
    },
    enabled: !!communityId,
  });
}
