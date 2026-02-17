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

export interface ElectionRow {
  id: string;
  election_number: string;
  title: string;
  election_type: string;
  status: string;
  opens_at: string;
  closes_at: string;
  quorum_required: number;
  total_coefficient_voted: number;
  quorum_met: boolean;
  created_at: string;
}

export interface ElectionDetail {
  id: string;
  election_number: string;
  title: string;
  description: string | null;
  election_type: string;
  status: string;
  opens_at: string;
  closes_at: string;
  quorum_required: number;
  total_coefficient_voted: number;
  quorum_met: boolean;
  created_at: string;
}

export interface ElectionOption {
  id: string;
  election_id: string;
  title: string;
  description: string | null;
  display_order: number;
  votes_count: number;
  coefficient_total: number;
}

export interface AssemblyRow {
  id: string;
  assembly_number: string;
  title: string;
  assembly_type: string;
  status: string;
  scheduled_date: string;
  scheduled_time: string | null;
  location: string | null;
  quorum_met: boolean;
  quorum_percentage: number | null;
  quorum_coefficient_present: number | null;
}

export interface AssemblyDetail {
  id: string;
  assembly_number: string;
  title: string;
  assembly_type: string;
  status: string;
  scheduled_date: string;
  scheduled_time: string | null;
  location: string | null;
  quorum_met: boolean;
  quorum_percentage: number | null;
  quorum_coefficient_present: number | null;
  created_at: string;
}

export interface AssemblyAttendanceRow {
  id: string;
  assembly_id: string;
  unit_id: string;
  attendee_type: string;
  attendee_name: string | null;
  coefficient: number;
  is_proxy: boolean;
  checked_in_at: string;
  units: {
    unit_number: string;
  };
}

export interface AssemblyAgreementRow {
  id: string;
  assembly_id: string;
  agreement_number: number;
  title: string;
  description: string;
  approved: boolean | null;
  action_required: boolean;
  action_description: string | null;
  action_due_date: string | null;
  action_responsible: string | null;
  action_completed_at: string | null;
  display_order: number;
}

export interface AssemblyQuorumResult {
  total_coefficient: number;
  present_coefficient: number;
  percentage: number;
  quorum_met: boolean;
  required_for_convocatoria_1: boolean;
  required_for_convocatoria_2: boolean;
  required_for_convocatoria_3: boolean;
}

interface ElectionFilters {
  status?: string;
  page: number;
  pageSize: number;
}

interface AssemblyFilters {
  status?: string;
  page: number;
  pageSize: number;
}

/* ------------------------------------------------------------------ */
/*  Elections Queries & Mutations                                    */
/* ------------------------------------------------------------------ */

/**
 * Paginated election list with status filter.
 */
export function useElections(filters: ElectionFilters) {
  const { communityId } = useAuth();
  const { status, page, pageSize } = filters;

  return useQuery({
    queryKey: [
      ...queryKeys.elections.list(communityId!).queryKey,
      { status, page, pageSize },
    ],
    queryFn: async () => {
      const supabase = createClient();
      let query = supabase
        .from('elections')
        .select(
          'id, election_number, title, election_type, status, opens_at, closes_at, quorum_required, total_coefficient_voted, quorum_met, created_at',
          { count: 'exact' }
        )
        .eq('community_id', communityId!)
        .order('created_at', { ascending: false });

      if (status) {
        query = query.eq('status', status as any);
      }

      const from = page * pageSize;
      query = query.range(from, from + pageSize - 1);

      const { data, error, count } = await query;
      if (error) throw error;
      return { data: (data ?? []) as ElectionRow[], count: count ?? 0 };
    },
    enabled: !!communityId,
  });
}

/**
 * Single election detail with its options.
 */
export function useElectionDetail(id: string) {
  return useQuery({
    queryKey: queryKeys.elections.detail(id).queryKey,
    queryFn: async () => {
      const supabase = createClient();

      // Fetch election
      const { data: election, error: electionError } = await supabase
        .from('elections')
        .select('*')
        .eq('id', id)
        .single();

      if (electionError) throw electionError;

      // Fetch options
      const { data: options, error: optionsError } = await supabase
        .from('election_options')
        .select('*')
        .eq('election_id', id)
        .order('display_order');

      if (optionsError) throw optionsError;

      return {
        election: election as ElectionDetail,
        options: (options ?? []) as ElectionOption[],
      };
    },
    enabled: !!id,
  });
}

/**
 * Create a new election with options.
 */
export function useCreateElection() {
  const { communityId } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: {
      title: string;
      description?: string;
      election_type: string;
      opens_at: string;
      closes_at: string;
      options: Array<{ title: string; description?: string }>;
    }) => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      // Step 1: Insert election
      const { data: election, error: electionError } = await supabase
        .from('elections')
        .insert({
          community_id: communityId!,
          election_number: `ELEC-${Date.now()}`,
          title: input.title,
          description: input.description || null,
          election_type: input.election_type as any,
          opens_at: input.opens_at,
          closes_at: input.closes_at,
          created_by: user!.id,
        })
        .select()
        .single();

      if (electionError) throw electionError;

      // Step 2: Batch insert options
      const optionsToInsert = input.options.map((opt, idx) => ({
        election_id: election.id,
        title: opt.title,
        description: opt.description || null,
        display_order: idx + 1,
      }));

      const { error: optionsError } = await supabase
        .from('election_options')
        .insert(optionsToInsert);

      if (optionsError) throw optionsError;

      return election;
    },
    onSuccess: () => {
      toast.success('Elección creada exitosamente');
      queryClient.invalidateQueries({
        queryKey: queryKeys.elections._def,
      });
    },
    onError: (error: Error) => {
      toastError('Error al crear elección', error);
    },
  });
}

/**
 * Update election status (open/close voting).
 */
export function useUpdateElectionStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: 'open' | 'closed' }) => {
      const supabase = createClient();
      const { error } = await supabase
        .from('elections')
        .update({ status })
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: (_, { id, status }) => {
      const message = status === 'open' ? 'Votación abierta' : 'Votación cerrada';
      toast.success(message);
      queryClient.invalidateQueries({
        queryKey: queryKeys.elections.detail(id).queryKey,
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.elections._def,
      });
    },
    onError: (error: Error) => {
      toastError('Error al actualizar estado', error);
    },
  });
}

/* ------------------------------------------------------------------ */
/*  Assemblies Queries & Mutations                                   */
/* ------------------------------------------------------------------ */

/**
 * Paginated assembly list with status filter.
 */
export function useAssemblies(filters: AssemblyFilters) {
  const { communityId } = useAuth();
  const { status, page, pageSize } = filters;

  return useQuery({
    queryKey: [
      ...queryKeys.assemblies.list(communityId!).queryKey,
      { status, page, pageSize },
    ],
    queryFn: async () => {
      const supabase = createClient();
      let query = supabase
        .from('assemblies')
        .select(
          'id, assembly_number, title, assembly_type, status, scheduled_date, scheduled_time, location, quorum_met, quorum_percentage, quorum_coefficient_present',
          { count: 'exact' }
        )
        .eq('community_id', communityId!)
        .order('scheduled_date', { ascending: false });

      if (status) {
        query = query.eq('status', status as any);
      }

      const from = page * pageSize;
      query = query.range(from, from + pageSize - 1);

      const { data, error, count } = await query;
      if (error) throw error;
      return { data: (data ?? []) as AssemblyRow[], count: count ?? 0 };
    },
    enabled: !!communityId,
  });
}

/**
 * Single assembly detail with attendance and agreements.
 */
export function useAssemblyDetail(id: string) {
  return useQuery({
    queryKey: queryKeys.assemblies.detail(id).queryKey,
    queryFn: async () => {
      const supabase = createClient();

      // Fetch assembly
      const { data: assembly, error: assemblyError } = await supabase
        .from('assemblies')
        .select('*')
        .eq('id', id)
        .single();

      if (assemblyError) throw assemblyError;

      // Fetch attendance with unit info
      const { data: attendance, error: attendanceError } = await supabase
        .from('assembly_attendance')
        .select('*, units!inner(unit_number)')
        .eq('assembly_id', id)
        .order('checked_in_at', { ascending: false });

      if (attendanceError) throw attendanceError;

      // Fetch agreements
      const { data: agreements, error: agreementsError } = await supabase
        .from('assembly_agreements')
        .select('*')
        .eq('assembly_id', id)
        .order('agreement_number');

      if (agreementsError) throw agreementsError;

      return {
        assembly: assembly as AssemblyDetail,
        attendance: (attendance ?? []) as AssemblyAttendanceRow[],
        agreements: (agreements ?? []) as AssemblyAgreementRow[],
      };
    },
    enabled: !!id,
  });
}

/**
 * Calculate real-time assembly quorum via RPC.
 */
export function useAssemblyQuorum(assemblyId: string) {
  return useQuery({
    queryKey: [...queryKeys.assemblies.attendance(assemblyId).queryKey, 'quorum'],
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .rpc('calculate_assembly_quorum', { p_assembly_id: assemblyId });

      if (error) throw error;
      // RPC with RETURN QUERY returns an array; extract the first row
      const row = Array.isArray(data) ? data[0] : data;
      return {
        total_coefficient: Number(row.total_coefficient),
        present_coefficient: Number(row.present_coefficient),
        percentage: Number(row.percentage),
        quorum_met: row.quorum_met,
        required_for_convocatoria_1: row.required_for_convocatoria_1,
        required_for_convocatoria_2: row.required_for_convocatoria_2,
        required_for_convocatoria_3: row.required_for_convocatoria_3,
      } as AssemblyQuorumResult;
    },
    enabled: !!assemblyId,
  });
}

/**
 * Add an attendee to an assembly.
 */
export function useAddAttendee() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: {
      assembly_id: string;
      unit_id: string;
      attendee_type: string;
      coefficient: number;
      attendee_name?: string;
      is_proxy?: boolean;
      proxy_grantor_id?: string;
    }) => {
      const supabase = createClient();
      const { error } = await supabase
        .from('assembly_attendance')
        .insert({
          assembly_id: input.assembly_id,
          unit_id: input.unit_id,
          attendee_type: input.attendee_type as any,
          coefficient: input.coefficient,
          attendee_name: input.attendee_name || null,
          is_proxy: input.is_proxy ?? false,
          proxy_grantor_id: input.proxy_grantor_id || null,
        });

      if (error) throw error;
    },
    onSuccess: (_, { assembly_id }) => {
      toast.success('Asistente registrado');
      queryClient.invalidateQueries({
        queryKey: queryKeys.assemblies.detail(assembly_id).queryKey,
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.assemblies.attendance(assembly_id).queryKey,
      });
    },
    onError: (error: Error) => {
      toastError('Error al registrar asistente', error);
    },
  });
}

/**
 * Add an agreement to an assembly.
 */
export function useAddAgreement() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: {
      assembly_id: string;
      agreement_number: number;
      title: string;
      description: string;
      display_order: number;
      action_required?: boolean;
      action_description?: string;
      action_due_date?: string;
      action_responsible?: string;
    }) => {
      const supabase = createClient();
      const { error } = await supabase
        .from('assembly_agreements')
        .insert({
          assembly_id: input.assembly_id,
          agreement_number: input.agreement_number,
          title: input.title,
          description: input.description,
          display_order: input.display_order,
          action_required: input.action_required ?? false,
          action_description: input.action_description || null,
          action_due_date: input.action_due_date || null,
          action_responsible: input.action_responsible || null,
        });

      if (error) throw error;
    },
    onSuccess: (_, { assembly_id }) => {
      toast.success('Acuerdo registrado');
      queryClient.invalidateQueries({
        queryKey: queryKeys.assemblies.detail(assembly_id).queryKey,
      });
    },
    onError: (error: Error) => {
      toastError('Error al registrar acuerdo', error);
    },
  });
}
