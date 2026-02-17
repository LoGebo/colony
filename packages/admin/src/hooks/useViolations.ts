'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@upoe/shared';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from './useAuth';

/* ------------------------------------------------------------------ */
/*  Types                                                             */
/* ------------------------------------------------------------------ */

export interface ViolationRow {
  id: string;
  violation_number: string;
  description: string;
  severity: string;
  status: string;
  occurred_at: string;
  reported_at: string;
  offense_number: number;
  location: string | null;
  photo_urls: string[] | null;
  video_urls: string[] | null;
  witness_names: string[] | null;
  unit_id: string;
  resident_id: string | null;
  violation_type_id: string;
  resolution_notes: string | null;
  resolved_at: string | null;
  units: { unit_number: string } | null;
  violation_types: { name: string; category: string } | null;
}

export interface ViolationDetailRow {
  id: string;
  violation_number: string;
  description: string;
  severity: string;
  status: string;
  occurred_at: string;
  reported_at: string;
  offense_number: number;
  location: string | null;
  photo_urls: string[] | null;
  video_urls: string[] | null;
  witness_names: string[] | null;
  unit_id: string;
  resident_id: string | null;
  violation_type_id: string;
  resolution_notes: string | null;
  resolved_at: string | null;
  units: { unit_number: string } | null;
  violation_types: { name: string; category: string; default_severity: string } | null;
  residents: { first_name: string; paternal_surname: string } | null;
}

export interface ViolationFilters {
  severity?: string;
  status?: string;
  violationTypeId?: string;
  page: number;
  pageSize: number;
}

export interface SanctionRow {
  id: string;
  sanction_type: string;
  description: string;
  fine_amount: number | null;
  status: string;
  issued_at: string;
  notification_method: string | null;
  notified_at: string | null;
  suspended_amenities: string[] | null;
  suspension_start: string | null;
  suspension_end: string | null;
}

export interface AppealRow {
  id: string;
  appeal_reason: string;
  status: string;
  decision: string | null;
  hearing_date: string | null;
  hearing_notes: string | null;
  decided_at: string | null;
  supporting_documents: string[] | null;
  fine_reduced_to: number | null;
  sanction_modified_to: string | null;
}

export interface ViolationType {
  id: string;
  name: string;
  category: string;
  description: string;
  default_severity: string;
}

/* ------------------------------------------------------------------ */
/*  Queries                                                           */
/* ------------------------------------------------------------------ */

/**
 * Paginated violations list with filters.
 */
export function useViolations(filters: ViolationFilters) {
  const { communityId } = useAuth();
  const { severity, status, violationTypeId, page, pageSize } = filters;

  return useQuery({
    queryKey: [
      ...queryKeys.violations.list(communityId!).queryKey,
      { severity, status, violationTypeId, page, pageSize },
    ],
    queryFn: async () => {
      const supabase = createClient();
      let query = supabase
        .from('violations')
        .select(
          'id, violation_number, description, severity, status, occurred_at, reported_at, offense_number, location, photo_urls, units!inner(unit_number), violation_types!inner(name, category)',
          { count: 'exact' }
        )
        .eq('community_id', communityId!)
        .is('deleted_at', null)
        .order('occurred_at', { ascending: false });

      if (severity) query = query.eq('severity', severity as any);
      if (status) query = query.eq('status', status);
      if (violationTypeId) query = query.eq('violation_type_id', violationTypeId);

      const from = page * pageSize;
      query = query.range(from, from + pageSize - 1);

      const { data, error, count } = await query;
      if (error) throw error;
      return { data: (data ?? []) as ViolationRow[], count: count ?? 0 };
    },
    enabled: !!communityId,
  });
}

/**
 * Single violation with full data.
 */
export function useViolationDetail(id: string) {
  return useQuery({
    queryKey: queryKeys.violations.detail(id).queryKey,
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('violations')
        .select(
          '*, units(unit_number), violation_types(name, category, default_severity), residents(first_name, paternal_surname)'
        )
        .eq('id', id)
        .single();

      if (error) throw error;
      return data as ViolationDetailRow;
    },
    enabled: !!id,
  });
}

/**
 * Sanctions for a specific violation.
 */
export function useViolationSanctions(violationId: string) {
  return useQuery({
    queryKey: queryKeys.violations.sanctions(violationId).queryKey,
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('violation_sanctions')
        .select('*')
        .eq('violation_id', violationId)
        .order('issued_at', { ascending: false });

      if (error) throw error;
      return (data ?? []) as SanctionRow[];
    },
    enabled: !!violationId,
  });
}

/**
 * Appeals for a specific violation.
 */
export function useViolationAppeals(violationId: string) {
  return useQuery({
    queryKey: queryKeys.violations.appeals(violationId).queryKey,
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('violation_appeals')
        .select('*')
        .eq('violation_id', violationId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return (data ?? []) as AppealRow[];
    },
    enabled: !!violationId,
  });
}

/**
 * Active violation types for the community.
 */
export function useViolationTypes() {
  const { communityId } = useAuth();

  return useQuery({
    queryKey: queryKeys.violations.types(communityId!).queryKey,
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('violation_types')
        .select('id, name, category, description, default_severity')
        .eq('community_id', communityId!)
        .eq('is_active', true)
        .is('deleted_at', null)
        .order('name');

      if (error) throw error;
      return (data ?? []) as ViolationType[];
    },
    enabled: !!communityId,
  });
}

/* ------------------------------------------------------------------ */
/*  Mutations                                                         */
/* ------------------------------------------------------------------ */

/**
 * Create a new violation record.
 */
export function useCreateViolation() {
  const { communityId, user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: {
      unit_id: string;
      violation_type_id: string;
      description: string;
      severity: string;
      occurred_at: string;
      resident_id?: string;
      location?: string;
      photo_urls?: string[];
      video_urls?: string[];
      witness_names?: string[];
    }) => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('violations')
        .insert({
          community_id: communityId!,
          violation_number: `VIOL-${Date.now()}`,
          ...payload,
          severity: payload.severity as any,
        } as any)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.violations.list(communityId!).queryKey });
    },
  });
}

/**
 * Create a sanction for a violation.
 */
export function useCreateSanction() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: {
      violation_id: string;
      sanction_type: string;
      description: string;
      fine_amount?: number;
      suspension_start?: string;
      suspension_end?: string;
      suspended_amenities?: string[];
    }) => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('violation_sanctions')
        .insert({
          ...payload,
          sanction_type: payload.sanction_type as any,
          issued_by: user!.id,
        } as any)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.violations.sanctions(variables.violation_id).queryKey,
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.violations.detail(variables.violation_id).queryKey,
      });
    },
  });
}

/**
 * Update violation status.
 */
export function useUpdateViolationStatus() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: {
      id: string;
      status: string;
      resolution_notes?: string;
    }) => {
      const supabase = createClient();
      const updateData: Record<string, unknown> = {
        status: payload.status,
        resolved_by: user!.id,
      };

      if (payload.resolution_notes) {
        updateData.resolution_notes = payload.resolution_notes;
      }

      if (payload.status === 'closed') {
        updateData.resolved_at = new Date().toISOString();
      }

      const { data, error } = await supabase
        .from('violations')
        .update(updateData)
        .eq('id', payload.id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.violations.detail(variables.id).queryKey,
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.violations.list._def,
      });
    },
  });
}

/**
 * Resolve an appeal.
 */
export function useResolveAppeal() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: {
      id: string;
      violationId: string;
      decision: string;
      hearing_notes?: string;
      fine_reduced_to?: number;
      sanction_modified_to?: string;
    }) => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('violation_appeals')
        .update({
          decision: payload.decision,
          decided_at: new Date().toISOString(),
          decided_by: user!.id,
          hearing_notes: payload.hearing_notes,
          fine_reduced_to: payload.fine_reduced_to,
          sanction_modified_to: payload.sanction_modified_to,
        })
        .eq('id', payload.id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.violations.appeals(variables.violationId).queryKey,
      });
    },
  });
}
