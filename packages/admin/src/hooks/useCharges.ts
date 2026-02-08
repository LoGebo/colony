'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
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
  previews: ChargePreviewRow[];
}

// ── Query: Active fee structures ───────────────────────────────────

/**
 * Fetch active fee structures for the charge generation dropdown.
 */
export function useFeeStructures() {
  const { communityId } = useAuth();

  return useQuery({
    queryKey: ['fee-structures', communityId],
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
    queryKey: ['charge-preview', communityId, feeStructureId],
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

// ── Mutation: Generate charges ─────────────────────────────────────

/**
 * Generate charges for all units using record_charge RPC.
 * Processes each unit in parallel via Promise.allSettled.
 */
export function useGenerateCharges() {
  const { communityId, user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ feeStructureId, chargeDate, description, previews }: GenerateChargesInput) => {
      const supabase = createClient();

      const results = await Promise.allSettled(
        previews
          .filter((p) => p.calculated_amount > 0)
          .map(async (preview) => {
            // record_charge deployed via migration; types not yet regenerated
            const { data, error } = await supabase.rpc('record_charge' as never, {
              p_community_id: communityId!,
              p_unit_id: preview.unit_id,
              p_amount: preview.calculated_amount,
              p_charge_date: chargeDate,
              p_description: description,
              p_fee_structure_id: feeStructureId,
              p_created_by: user!.id,
            } as never);

            if (error) throw error;
            return data;
          })
      );

      const fulfilled = results.filter((r) => r.status === 'fulfilled').length;
      const rejected = results.filter((r) => r.status === 'rejected').length;

      return { fulfilled, rejected, total: previews.length };
    },
    onSuccess: ({ fulfilled, rejected }) => {
      if (rejected === 0) {
        toast.success(`${fulfilled} cargos generados exitosamente`);
      } else {
        toast.warning(`${fulfilled} cargos generados, ${rejected} fallaron`);
      }
      queryClient.invalidateQueries({ queryKey: ['unit-balances'] });
      queryClient.invalidateQueries({ queryKey: ['transaction-summary'] });
      queryClient.invalidateQueries({ queryKey: ['charge-preview'] });
    },
    onError: (error: Error) => {
      toast.error('Error al generar cargos: ' + error.message);
    },
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
    queryKey: ['unit-balances', communityId],
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
