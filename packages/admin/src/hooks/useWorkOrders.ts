'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@upoe/shared';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from './useAuth';
import { toast } from 'sonner';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export interface WorkOrderRow {
  id: string;
  work_order_number: string;
  title: string;
  status: string;
  provider_id: string;
  unit_id: string | null;
  scheduled_date: string | null;
  estimated_cost: number | null;
  actual_cost: number | null;
  rating: number | null;
  created_at: string;
  providers: { company_name: string } | null;
  units: { unit_number: string } | null;
}

export interface WorkOrderDetail {
  id: string;
  work_order_number: string;
  title: string;
  description: string;
  category: string | null;
  status: string;
  provider_id: string;
  unit_id: string | null;
  location_description: string | null;
  requested_date: string | null;
  scheduled_date: string | null;
  scheduled_time_start: string | null;
  scheduled_time_end: string | null;
  completed_date: string | null;
  estimated_cost: number | null;
  actual_cost: number | null;
  currency: string;
  rating: number | null;
  rating_notes: string | null;
  admin_notes: string | null;
  provider_notes: string | null;
  completion_notes: string | null;
  created_at: string;
  providers: { company_name: string } | null;
  units: { unit_number: string } | null;
}

/* ------------------------------------------------------------------ */
/*  Valid status transitions                                           */
/* ------------------------------------------------------------------ */

export const WORK_ORDER_TRANSITIONS: Record<string, string[]> = {
  draft: ['submitted', 'cancelled'],
  submitted: ['approved', 'cancelled'],
  approved: ['scheduled', 'cancelled'],
  scheduled: ['in_progress', 'cancelled'],
  in_progress: ['completed', 'cancelled'],
  completed: [],
  cancelled: [],
};

/* ------------------------------------------------------------------ */
/*  1. useWorkOrderList                                                */
/* ------------------------------------------------------------------ */

const WORK_ORDER_SELECT =
  'id, work_order_number, title, status, provider_id, unit_id, scheduled_date, estimated_cost, actual_cost, rating, created_at, providers(company_name), units(unit_number)';

export function useWorkOrderList(communityId: string | undefined, statusFilter?: string) {
  return useQuery({
    queryKey: [
      ...queryKeys['work-orders'].list(communityId!).queryKey,
      { statusFilter },
    ],
    queryFn: async () => {
      const supabase = createClient();
      let query = supabase
        .from('provider_work_orders')
        .select(WORK_ORDER_SELECT)
        .eq('community_id', communityId!)
        .is('deleted_at', null)
        .order('created_at', { ascending: false });

      if (statusFilter) {
        query = query.eq('status', statusFilter as never);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as unknown as WorkOrderRow[];
    },
    enabled: !!communityId,
  });
}

/* ------------------------------------------------------------------ */
/*  2. useWorkOrderDetail                                              */
/* ------------------------------------------------------------------ */

export function useWorkOrderDetail(id: string | undefined) {
  return useQuery({
    queryKey: queryKeys['work-orders'].detail(id!).queryKey,
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('provider_work_orders')
        .select(
          '*, providers(company_name), units(unit_number)'
        )
        .eq('id', id!)
        .is('deleted_at', null)
        .single();

      if (error) throw error;
      return data as unknown as WorkOrderDetail;
    },
    enabled: !!id,
  });
}

/* ------------------------------------------------------------------ */
/*  3. useCreateWorkOrder                                              */
/* ------------------------------------------------------------------ */

interface CreateWorkOrderInput {
  provider_id: string;
  title: string;
  description: string;
  category?: string;
  unit_id?: string;
  location_description?: string;
  requested_date?: string;
  estimated_cost?: number;
}

export function useCreateWorkOrder() {
  const { communityId } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateWorkOrderInput) => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('provider_work_orders')
        .insert({
          community_id: communityId!,
          provider_id: input.provider_id,
          title: input.title,
          description: input.description,
          category: input.category ?? null,
          unit_id: input.unit_id ?? null,
          location_description: input.location_description ?? null,
          requested_date: input.requested_date ?? null,
          estimated_cost: input.estimated_cost ?? null,
          status: 'draft' as never,
        } as never)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success('Orden de trabajo creada');
      queryClient.invalidateQueries({ queryKey: queryKeys['work-orders']._def });
    },
    onError: (error: Error) => {
      toast.error(`Error al crear orden: ${error.message}`);
    },
  });
}

/* ------------------------------------------------------------------ */
/*  4. useUpdateWorkOrder                                              */
/* ------------------------------------------------------------------ */

interface UpdateWorkOrderInput {
  id: string;
  [key: string]: unknown;
}

export function useUpdateWorkOrder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...updates }: UpdateWorkOrderInput) => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('provider_work_orders')
        .update(updates as never)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success('Orden de trabajo actualizada');
      queryClient.invalidateQueries({ queryKey: queryKeys['work-orders']._def });
    },
    onError: (error: Error) => {
      toast.error(`Error al actualizar orden: ${error.message}`);
    },
  });
}

/* ------------------------------------------------------------------ */
/*  5. useRateWorkOrder                                                */
/* ------------------------------------------------------------------ */

export function useRateWorkOrder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      rating,
      rating_notes,
    }: {
      id: string;
      rating: number;
      rating_notes?: string;
    }) => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('provider_work_orders')
        .update({
          rating,
          rating_notes: rating_notes ?? null,
        } as never)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success('Calificacion guardada');
      queryClient.invalidateQueries({ queryKey: queryKeys['work-orders']._def });
      queryClient.invalidateQueries({ queryKey: queryKeys.providers._def });
    },
    onError: (error: Error) => {
      toast.error(`Error al calificar: ${error.message}`);
    },
  });
}

/* ------------------------------------------------------------------ */
/*  6. useWorkOrdersByProvider                                         */
/* ------------------------------------------------------------------ */

export function useWorkOrdersByProvider(providerId: string | undefined) {
  return useQuery({
    queryKey: queryKeys['work-orders'].byProvider(providerId!).queryKey,
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('provider_work_orders')
        .select(WORK_ORDER_SELECT)
        .eq('provider_id', providerId!)
        .is('deleted_at', null)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return (data ?? []) as unknown as WorkOrderRow[];
    },
    enabled: !!providerId,
  });
}
