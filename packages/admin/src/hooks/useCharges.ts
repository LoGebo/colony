'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { queryKeys } from '@upoe/shared';
import { toastError } from '@/lib/toast-error';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from './useAuth';

// ── Types ──────────────────────────────────────────────────────────

interface FeeStructure {
  id: string;
  name: string;
  description: string | null;
  base_amount: number;
  calculation_type: string;
  frequency: string;
  coefficient_amount: number | null;
  is_active: boolean;
}

export interface ChargePreviewRow {
  unit_id: string;
  unit_number: string;
  building: string | null;
  coefficient: number;
  unit_type: string;
  calculated_amount: number;
}

interface GenerateChargesInput {
  feeStructureId: string;
  chargeDate: string;
  description: string;
}

export interface ChargeRun {
  id: string;
  fee_structure_id: string;
  period_start: string;
  description: string;
  status: string;
  total_amount: number;
  units_charged: number;
  units_skipped: number;
  created_by: string | null;
  created_at: string;
  fee_structure_name?: string;
}

// ── Query: Active fee structures ───────────────────────────────────

/**
 * Fetch active fee structures for the charge generation dropdown.
 */
export function useFeeStructures() {
  const { communityId } = useAuth();

  return useQuery({
    queryKey: queryKeys.financials.feeStructures(communityId!).queryKey,
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('fee_structures')
        .select('id, name, description, base_amount, calculation_type, frequency, coefficient_amount, is_active')
        .eq('community_id', communityId!)
        .eq('is_active', true)
        .is('deleted_at', null)
        .order('name', { ascending: true });

      if (error) throw error;
      return (data ?? []) as FeeStructure[];
    },
    enabled: !!communityId,
  });
}

// ── Query: Charge preview ──────────────────────────────────────────

/**
 * Preview charge amounts for each unit given a fee structure.
 * Calls `get_unit_fee_amount` RPC for each active unit in the community.
 * Enabled only when a feeStructureId is provided.
 */
export function useChargePreview(feeStructureId: string | null) {
  const { communityId } = useAuth();

  return useQuery({
    queryKey: queryKeys.financials.chargePreview(communityId!, feeStructureId ?? undefined).queryKey,
    queryFn: async () => {
      const supabase = createClient();

      // Step 1: Get all active units in the community
      const { data: units, error: unitsError } = await supabase
        .from('units')
        .select('id, unit_number, building, coefficient, unit_type')
        .eq('community_id', communityId!)
        .eq('status', 'active')
        .is('deleted_at', null)
        .order('unit_number', { ascending: true });

      if (unitsError) throw unitsError;
      if (!units || units.length === 0) return [];

      // Step 2: Calculate fee amount for each unit
      const previews: ChargePreviewRow[] = await Promise.all(
        units.map(async (unit) => {
          const { data: amount, error: feeError } = await supabase.rpc(
            'get_unit_fee_amount',
            {
              p_fee_structure_id: feeStructureId!,
              p_unit_id: unit.id,
            }
          );

          if (feeError) {
            // Fallback: use base_amount if RPC fails
            console.warn(`Fee calculation failed for unit ${unit.unit_number}:`, feeError);
            return {
              unit_id: unit.id,
              unit_number: unit.unit_number,
              building: unit.building,
              coefficient: unit.coefficient,
              unit_type: unit.unit_type,
              calculated_amount: 0,
            };
          }

          return {
            unit_id: unit.id,
            unit_number: unit.unit_number,
            building: unit.building,
            coefficient: unit.coefficient,
            unit_type: unit.unit_type,
            calculated_amount: Number(amount) || 0,
          };
        })
      );

      return previews;
    },
    enabled: !!communityId && !!feeStructureId,
  });
}

// ── Mutation: Generate charges (batch via DB function) ────────────

/**
 * Generate charges for all active units using generate_monthly_charges() DB function.
 * This is an atomic batch operation with duplicate prevention via UNIQUE constraint.
 * Replaces the old approach of N individual record_charge() calls.
 */
export function useGenerateCharges() {
  const { communityId, user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ feeStructureId, chargeDate, description }: GenerateChargesInput) => {
      const supabase = createClient();

      // generate_monthly_charges is deployed via migration; types not yet regenerated
      const { data, error } = await supabase.rpc('generate_monthly_charges' as never, {
        p_community_id: communityId!,
        p_fee_structure_id: feeStructureId,
        p_period_start: chargeDate,
        p_description: description,
        p_created_by: user!.id,
      } as never);

      if (error) {
        // UNIQUE constraint violation = duplicate charge run
        if (error.code === '23505') {
          throw new Error('Ya se generaron cargos para este periodo y estructura de cuota. No se pueden duplicar.');
        }
        throw error;
      }

      // RPC returns TABLE with single row; cast through unknown due to missing generated types
      const result = (Array.isArray(data) ? data[0] : data) as unknown as {
        charge_run_id: string;
        units_charged: number;
        units_skipped: number;
        total_amount: number;
      } | undefined;
      return {
        chargeRunId: result?.charge_run_id ?? '',
        unitsCharged: result?.units_charged ?? 0,
        unitsSkipped: result?.units_skipped ?? 0,
        totalAmount: result?.total_amount ?? 0,
      };
    },
    onSuccess: ({ chargeRunId, unitsCharged, unitsSkipped }, { description }) => {
      if (unitsSkipped === 0) {
        toast.success(`${unitsCharged} cargos generados exitosamente`);
      } else {
        toast.warning(`${unitsCharged} cargos generados, ${unitsSkipped} omitidos`);
      }
      queryClient.invalidateQueries({ queryKey: queryKeys.financials.unitBalances._def });
      queryClient.invalidateQueries({ queryKey: queryKeys.financials.transactionSummary._def });
      queryClient.invalidateQueries({ queryKey: queryKeys.financials.chargePreview._def });
      queryClient.invalidateQueries({ queryKey: queryKeys.financials.chargeRuns._def });

      // Fire-and-forget: notify residents of new charges
      if (chargeRunId && unitsCharged > 0) {
        const supabase = createClient();
        supabase.rpc('notify_charge_run' as never, {
          p_charge_run_id: chargeRunId,
          p_description: description,
        } as never).then(({ error: notifyError }) => {
          if (notifyError) {
            console.warn('Failed to notify residents of new charges:', notifyError);
          }
        });
      }
    },
    onError: (error: Error) => {
      toastError('Error al generar cargos', error);
    },
  });
}

// ── Query: Charge run history ─────────────────────────────────────

/**
 * Fetch charge run history for the community.
 * Joins fee_structures for display name.
 */
export function useChargeRuns() {
  const { communityId } = useAuth();

  return useQuery({
    queryKey: queryKeys.financials.chargeRuns(communityId!).queryKey,
    queryFn: async () => {
      const supabase = createClient();

      // charge_runs not in generated types; cast through unknown
      const { data, error } = await supabase
        .from('charge_runs' as never)
        .select('id, fee_structure_id, period_start, description, status, total_amount, units_charged, units_skipped, created_by, created_at' as never)
        .eq('community_id' as never, communityId! as never)
        .is('deleted_at' as never, null as never)
        .order('created_at' as never, { ascending: false } as never)
        .limit(20);

      if (error) throw error;

      // Enrich with fee structure names
      const runs = (data ?? []) as unknown as ChargeRun[];

      if (runs.length > 0) {
        const feeIds = [...new Set(runs.map((r) => r.fee_structure_id))];
        const { data: feeStructures } = await supabase
          .from('fee_structures')
          .select('id, name')
          .in('id', feeIds);

        const feeMap = new Map((feeStructures ?? []).map((fs) => [fs.id, fs.name]));
        for (const run of runs) {
          run.fee_structure_name = feeMap.get(run.fee_structure_id) ?? 'Unknown';
        }
      }

      return runs;
    },
    enabled: !!communityId,
  });
}

// ── Query: Unit balances ───────────────────────────────────────────

export interface UnitBalance {
  unit_id: string | null;
  unit_number: string | null;
  building: string | null;
  coefficient: number | null;
  floor_number: number | null;
  total_charges: number | null;
  total_payments: number | null;
  total_interest: number | null;
  total_receivable: number | null;
  last_charge_date: string | null;
  last_payment_date: string | null;
  oldest_unpaid_date: string | null;
  days_overdue: number | null;
}

/**
 * Fetch unit balances view for the balance report table.
 */
export function useUnitBalances() {
  const { communityId } = useAuth();

  return useQuery({
    queryKey: queryKeys.financials.unitBalances(communityId!).queryKey,
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('unit_balances')
        .select('*')
        .eq('community_id', communityId!)
        .order('unit_number', { ascending: true });

      if (error) throw error;
      return (data ?? []) as UnitBalance[];
    },
    enabled: !!communityId,
  });
}
