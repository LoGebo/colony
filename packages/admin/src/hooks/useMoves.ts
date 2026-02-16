'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@upoe/shared';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from './useAuth';
import { toast } from 'sonner';

/* ------------------------------------------------------------------ */
/*  Types                                                             */
/* ------------------------------------------------------------------ */

export interface MoveRequestRow {
  id: string;
  move_type: string;
  status: string;
  requested_date: string;
  unit_id: string;
  resident_id: string;
  moving_company_name: string | null;
  resident_notes: string | null;
  all_validations_passed: boolean | null;
  created_at: string;
  units: { unit_number: string } | null;
  residents: { first_name: string; paternal_surname: string } | null;
}

export interface MoveRequestDetail {
  id: string;
  move_type: string;
  status: string;
  requested_date: string;
  unit_id: string;
  resident_id: string;
  moving_company_name: string | null;
  moving_company_phone: string | null;
  resident_notes: string | null;
  all_validations_passed: boolean | null;
  created_at: string;
  updated_at: string;
  units: { unit_number: string } | null;
  residents: { first_name: string; paternal_surname: string } | null;
}

export interface MoveValidationRow {
  id: string;
  validation_type: string;
  status: string;
  checked_at: string | null;
  checked_by: string | null;
  notes: string | null;
  balance_at_check: number | null;
  waiver_reason: string | null;
  waived_by: string | null;
}

export interface MoveDepositRow {
  id: string;
  move_request_id: string;
  amount: number;
  status: string;
  collected_at: string | null;
  refund_amount: number | null;
  deduction_amount: number | null;
  deduction_reason: string | null;
  deposit_type: string | null;
  payment_method: string | null;
}

export interface CreateMoveInput {
  unit_id: string;
  resident_id: string;
  move_type: string;
  requested_date: string;
  moving_company_name?: string;
  moving_company_phone?: string;
  resident_notes?: string;
}

export interface UpdateValidationInput {
  id: string;
  status: string;
  checked_by?: string;
  notes?: string;
}

export interface CreateDepositInput {
  move_request_id: string;
  unit_id: string;
  resident_id: string;
  amount: number;
  collection_date: string;
}

/* ------------------------------------------------------------------ */
/*  Queries                                                           */
/* ------------------------------------------------------------------ */

/**
 * Fetch move requests for the community with optional filters.
 */
export function useMoveList(statusFilter?: string, typeFilter?: string) {
  const { communityId } = useAuth();

  return useQuery({
    queryKey: [...queryKeys.moves.list(communityId!).queryKey, { statusFilter, typeFilter }],
    queryFn: async () => {
      const supabase = createClient();
      let query = supabase
        .from('move_requests')
        .select(
          'id, move_type, status, requested_date, unit_id, resident_id, moving_company_name, resident_notes, all_validations_passed, created_at, units(unit_number), residents(first_name, paternal_surname)'
        )
        .eq('community_id', communityId!)
        .order('created_at', { ascending: false });

      if (statusFilter) {
        query = query.eq('status', statusFilter as never);
      }
      if (typeFilter) {
        query = query.eq('move_type', typeFilter as never);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as unknown as MoveRequestRow[];
    },
    enabled: !!communityId,
  });
}

/**
 * Fetch a single move request with full details.
 */
export function useMoveDetail(id: string) {
  const { communityId } = useAuth();

  return useQuery({
    queryKey: queryKeys.moves.detail(id).queryKey,
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('move_requests')
        .select(
          'id, move_type, status, requested_date, unit_id, resident_id, moving_company_name, moving_company_phone, resident_notes, all_validations_passed, created_at, updated_at, units(unit_number), residents(first_name, paternal_surname)'
        )
        .eq('id', id)
        .eq('community_id', communityId!)
        .single();

      if (error) throw error;
      return data as unknown as MoveRequestDetail;
    },
    enabled: !!communityId && !!id,
  });
}

/**
 * Fetch validation checklist items for a move request.
 */
export function useMoveValidations(moveId: string) {
  return useQuery({
    queryKey: queryKeys.moves.validations(moveId).queryKey,
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('move_validations')
        .select(
          'id, validation_type, status, checked_at, checked_by, notes, balance_at_check, waiver_reason, waived_by'
        )
        .eq('move_request_id', moveId)
        .order('validation_type', { ascending: true });

      if (error) throw error;
      return (data ?? []) as unknown as MoveValidationRow[];
    },
    enabled: !!moveId,
  });
}

/**
 * Fetch deposits for the community.
 */
export function useMoveDeposits(moveRequestId?: string) {
  const { communityId } = useAuth();

  return useQuery({
    queryKey: [...queryKeys.moves.deposits(communityId!).queryKey, { moveRequestId }],
    queryFn: async () => {
      const supabase = createClient();
      let query = supabase
        .from('move_deposits')
        .select(
          'id, move_request_id, amount, status, collected_at, refund_amount, deduction_amount, deduction_reason, deposit_type, payment_method'
        )
        .eq('community_id', communityId!)
        .order('created_at', { ascending: false });

      if (moveRequestId) {
        query = query.eq('move_request_id', moveRequestId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as unknown as MoveDepositRow[];
    },
    enabled: !!communityId,
  });
}

/* ------------------------------------------------------------------ */
/*  Mutations                                                         */
/* ------------------------------------------------------------------ */

/**
 * Create a new move request.
 */
export function useCreateMove() {
  const { communityId } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateMoveInput) => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('move_requests')
        .insert({
          community_id: communityId!,
          unit_id: input.unit_id,
          resident_id: input.resident_id,
          move_type: input.move_type,
          requested_date: input.requested_date,
          moving_company_name: input.moving_company_name ?? null,
          moving_company_phone: input.moving_company_phone ?? null,
          resident_notes: input.resident_notes ?? null,
          status: 'requested',
        } as never)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success('Mudanza creada');
      queryClient.invalidateQueries({ queryKey: queryKeys.moves._def });
    },
    onError: (error: Error) => {
      toast.error(`Error al crear mudanza: ${error.message}`);
    },
  });
}

/**
 * Update a move request status with transition validation.
 */
export function useUpdateMoveStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('move_requests')
        .update({ status } as never)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success('Estado de mudanza actualizado');
      queryClient.invalidateQueries({ queryKey: queryKeys.moves._def });
    },
    onError: (error: Error) => {
      toast.error(`Error al actualizar estado: ${error.message}`);
    },
  });
}

/**
 * Update a move validation item (pass/fail/waive).
 */
export function useUpdateValidation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...updates }: UpdateValidationInput) => {
      const supabase = createClient();
      const payload: Record<string, unknown> = {
        status: updates.status,
      };
      if (updates.checked_by) payload.checked_by = updates.checked_by;
      if (updates.notes !== undefined) payload.notes = updates.notes;
      payload.checked_at = new Date().toISOString();

      const { data, error } = await supabase
        .from('move_validations')
        .update(payload as never)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success('Validacion actualizada');
      queryClient.invalidateQueries({ queryKey: queryKeys.moves._def });
    },
    onError: (error: Error) => {
      toast.error(`Error al actualizar validacion: ${error.message}`);
    },
  });
}

/**
 * Create a deposit for a move request.
 */
export function useCreateDeposit() {
  const { communityId } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateDepositInput) => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('move_deposits')
        .insert({
          move_request_id: input.move_request_id,
          community_id: communityId!,
          unit_id: input.unit_id,
          resident_id: input.resident_id,
          amount: input.amount,
          status: 'collected',
          collected_at: input.collection_date,
          deposit_type: 'move',
        } as never)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success('Deposito registrado');
      queryClient.invalidateQueries({ queryKey: queryKeys.moves._def });
    },
    onError: (error: Error) => {
      toast.error(`Error al registrar deposito: ${error.message}`);
    },
  });
}

/**
 * Process deposit refund with deductions via RPC.
 */
export function useProcessDepositRefund() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: {
      depositId: string;
      deductionAmount: number;
      deductionReason: string;
    }) => {
      const supabase = createClient();
      const { data, error } = await supabase.rpc('process_deposit_refund', {
        p_deposit_id: input.depositId,
        p_deduction_amount: input.deductionAmount,
        p_deduction_reason: input.deductionReason,
      } as never);

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success('Deducciones procesadas');
      queryClient.invalidateQueries({ queryKey: queryKeys.moves._def });
    },
    onError: (error: Error) => {
      toast.error(`Error al procesar deducciones: ${error.message}`);
    },
  });
}

/**
 * Approve a deposit refund via RPC.
 */
export function useApproveDepositRefund() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (depositId: string) => {
      const supabase = createClient();
      const { data, error } = await supabase.rpc('approve_deposit_refund', {
        p_deposit_id: depositId,
      } as never);

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success('Reembolso aprobado');
      queryClient.invalidateQueries({ queryKey: queryKeys.moves._def });
    },
    onError: (error: Error) => {
      toast.error(`Error al aprobar reembolso: ${error.message}`);
    },
  });
}

/**
 * Complete a deposit refund via RPC.
 */
export function useCompleteDepositRefund() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: {
      depositId: string;
      method: string;
      reference: string;
    }) => {
      const supabase = createClient();
      const { data, error } = await supabase.rpc('complete_deposit_refund', {
        p_deposit_id: input.depositId,
        p_method: input.method,
        p_reference: input.reference,
      } as never);

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success('Reembolso completado');
      queryClient.invalidateQueries({ queryKey: queryKeys.moves._def });
    },
    onError: (error: Error) => {
      toast.error(`Error al completar reembolso: ${error.message}`);
    },
  });
}

/**
 * Forfeit a deposit via RPC.
 */
export function useForfeitDeposit() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: { depositId: string; reason: string }) => {
      const supabase = createClient();
      const { data, error } = await supabase.rpc('forfeit_deposit', {
        p_deposit_id: input.depositId,
        p_reason: input.reason,
      } as never);

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success('Deposito retenido');
      queryClient.invalidateQueries({ queryKey: queryKeys.moves._def });
    },
    onError: (error: Error) => {
      toast.error(`Error al retener deposito: ${error.message}`);
    },
  });
}
