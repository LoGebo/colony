'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@upoe/shared';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from './useAuth';
import { toast } from 'sonner';
import { toastError } from '@/lib/toast-error';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export interface ProviderRow {
  id: string;
  company_name: string;
  contact_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  specialties: string[] | null;
  status: string;
  total_work_orders: number;
  average_rating: number | null;
  created_at: string;
}

export interface ProviderDocumentRow {
  id: string;
  document_type: string;
  document_number: string | null;
  issuing_authority: string | null;
  issued_at: string | null;
  expires_at: string | null;
  status: string;
  storage_path: string | null;
  file_name: string | null;
  created_at: string;
}

export interface ProviderPersonnelRow {
  id: string;
  first_name: string;
  paternal_surname: string;
  maternal_surname: string | null;
  full_name: string | null;
  ine_number: string | null;
  phone: string | null;
  photo_url: string | null;
  is_authorized: boolean;
  created_at: string;
}

export interface ProviderScheduleRow {
  id: string;
  name: string;
  allowed_days: number[];
  start_time: string;
  end_time: string;
  effective_from: string;
  effective_until: string | null;
  is_active: boolean;
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
          'id, company_name, contact_name, contact_email, contact_phone, specialties, status, total_work_orders, average_rating, created_at'
        )
        .eq('community_id', communityId!)
        .order('company_name', { ascending: true });

      if (statusFilter) {
        query = query.eq('status', statusFilter as any);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as ProviderRow[];
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
  specialties?: string[];
  rfc?: string;
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
          contact_name: input.contact_name || '',
          contact_email: input.contact_email ?? null,
          contact_phone: input.contact_phone || '',
          specialties: input.specialties ?? [],
          rfc: input.rfc ?? null,
          address: input.address ?? null,
          notes: input.notes ?? null,
          status: 'pending_approval',
        } as any)
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
      toastError('Error al crear proveedor', error);
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
        .update(updates as any)
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
      toastError('Error al actualizar proveedor', error);
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
          'id, document_type, document_number, issuing_authority, issued_at, expires_at, status, storage_path, file_name, created_at'
        )
        .eq('provider_id', providerId!)
        .order('expires_at', { ascending: true });

      if (error) throw error;
      return (data ?? []) as ProviderDocumentRow[];
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
  issuing_authority?: string;
  issued_at?: string;
  expires_at?: string;
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
          document_name: input.document_type,
          document_number: input.document_number ?? null,
          issuing_authority: input.issuing_authority ?? null,
          issued_at: input.issued_at ?? null,
          expires_at: input.expires_at ?? null,
          status: 'pending_verification',
          storage_path: '',
          file_name: '',
        } as any)
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
      toastError('Error al agregar documento', error);
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
        .update(updates as any)
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
      toastError('Error al actualizar documento', error);
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
          'id, first_name, paternal_surname, maternal_surname, full_name, ine_number, phone, photo_url, is_authorized, created_at'
        )
        .eq('provider_id', providerId!)
        .order('paternal_surname', { ascending: true });

      if (error) throw error;
      return (data ?? []) as ProviderPersonnelRow[];
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
  paternal_surname: string;
  maternal_surname?: string;
  ine_number?: string;
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
          paternal_surname: input.paternal_surname,
          maternal_surname: input.maternal_surname ?? null,
          ine_number: input.ine_number ?? null,
          phone: input.phone ?? null,
        } as any)
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
      toastError('Error al agregar personal', error);
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
      is_authorized,
    }: {
      id: string;
      provider_id: string;
      is_authorized: boolean;
    }) => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('provider_personnel')
        .update({ is_authorized: !is_authorized } as any)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return { ...data, provider_id };
    },
    onSuccess: (_data, variables) => {
      toast.success(variables.is_authorized ? 'Personal desautorizado' : 'Personal autorizado');
      queryClient.invalidateQueries({
        queryKey: queryKeys.providers.personnel(variables.provider_id).queryKey,
      });
    },
    onError: (error: Error) => {
      toastError('Error al cambiar estado', error);
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
          'id, name, allowed_days, start_time, end_time, effective_from, effective_until, is_active'
        )
        .eq('provider_id', providerId!)
        .order('name', { ascending: true });

      if (error) throw error;
      return (data ?? []) as ProviderScheduleRow[];
    },
    enabled: !!providerId,
  });
}

/* ------------------------------------------------------------------ */
/*  12. useCreateProviderSchedule                                      */
/* ------------------------------------------------------------------ */

interface CreateProviderScheduleInput {
  provider_id: string;
  name: string;
  allowed_days: number[];
  start_time: string;
  end_time: string;
  effective_from: string;
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
          name: input.name,
          allowed_days: input.allowed_days,
          start_time: input.start_time,
          end_time: input.end_time,
          effective_from: input.effective_from,
          effective_until: input.effective_until ?? null,
        } as any)
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
      toastError('Error al agregar horario', error);
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
      toastError('Error al eliminar horario', error);
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
          'id, document_type, expires_at, status, provider_id, providers!inner(company_name)'
        )
        .eq('providers.community_id', communityId!)
        .lte('expires_at', cutoff)
        .neq('status', 'rejected')
        .order('expires_at', { ascending: true });

      if (error) throw error;
      return data ?? [];
    },
    enabled: !!communityId,
  });
}
