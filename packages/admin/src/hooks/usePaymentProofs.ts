'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { queryKeys } from '@upoe/shared';
import { toastError } from '@/lib/toast-error';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from './useAuth';

// ── Types ──────────────────────────────────────────────────────────

interface PendingProof {
  id: string;
  proof_type: string;
  amount: number;
  payment_date: string;
  reference_number: string | null;
  bank_name: string | null;
  document_url: string;
  submitter_notes: string | null;
  submitted_at: string;
  status: string;
  units: {
    unit_number: string;
    building: string | null;
  };
}

// ── Query: Pending payment proofs ──────────────────────────────────

/**
 * Fetch all pending payment proofs for the current community.
 * Ordered by submitted_at ascending (oldest first) so admins
 * process the longest-waiting proofs first.
 */
export function usePendingProofs() {
  const { communityId } = useAuth();

  return useQuery({
    queryKey: [...queryKeys.financials.paymentProofs(communityId!).queryKey, 'pending'],
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('payment_proofs')
        .select(`
          id,
          proof_type,
          amount,
          payment_date,
          reference_number,
          bank_name,
          document_url,
          submitter_notes,
          submitted_at,
          status,
          units!inner(unit_number, building)
        `)
        .eq('community_id', communityId!)
        .eq('status', 'pending')
        .is('deleted_at', null)
        .order('submitted_at', { ascending: true });

      if (error) throw error;
      return (data ?? []) as unknown as PendingProof[];
    },
    enabled: !!communityId,
  });
}

// ── Mutation: Approve a single payment proof ───────────────────────

/**
 * Approve a payment proof by setting status to 'approved'.
 * The database trigger `on_payment_proof_approved` will call
 * `record_payment` to create double-entry ledger entries.
 */
export function useApprovePaymentProof() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (proofId: string) => {
      const supabase = createClient();
      const { error } = await supabase
        .from('payment_proofs')
        .update({
          status: 'approved' as const,
          reviewed_by: user!.id,
          reviewed_at: new Date().toISOString(),
        })
        .eq('id', proofId);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Comprobante aprobado');
      queryClient.invalidateQueries({ queryKey: queryKeys.financials.paymentProofs._def });
      queryClient.invalidateQueries({ queryKey: queryKeys.financials.unitBalances._def });
    },
    onError: (error: Error) => {
      toastError('Error al aprobar', error);
    },
  });
}

// ── Mutation: Reject a single payment proof ────────────────────────

/**
 * Reject a payment proof with a mandatory reason.
 */
export function useRejectPaymentProof() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ proofId, reason }: { proofId: string; reason: string }) => {
      const supabase = createClient();
      const { error } = await supabase
        .from('payment_proofs')
        .update({
          status: 'rejected' as const,
          reviewed_by: user!.id,
          reviewed_at: new Date().toISOString(),
          rejection_reason: reason,
        })
        .eq('id', proofId);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Comprobante rechazado');
      queryClient.invalidateQueries({ queryKey: queryKeys.financials.paymentProofs._def });
      queryClient.invalidateQueries({ queryKey: queryKeys.financials.unitBalances._def });
    },
    onError: (error: Error) => {
      toastError('Error al rechazar', error);
    },
  });
}

// ── Mutation: Bulk approve payment proofs ──────────────────────────

/**
 * Approve multiple payment proofs in parallel via Promise.allSettled.
 * Reports individual failures while succeeding for others.
 */
export function useBulkApproveProofs() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (proofIds: string[]) => {
      const supabase = createClient();
      const now = new Date().toISOString();

      const results = await Promise.allSettled(
        proofIds.map(async (proofId) => {
          const { error } = await supabase
            .from('payment_proofs')
            .update({
              status: 'approved' as const,
              reviewed_by: user!.id,
              reviewed_at: now,
            })
            .eq('id', proofId);

          if (error) throw error;
          return proofId;
        })
      );

      const fulfilled = results.filter((r) => r.status === 'fulfilled').length;
      const rejected = results.filter((r) => r.status === 'rejected').length;

      return { fulfilled, rejected, total: proofIds.length };
    },
    onSuccess: ({ fulfilled, rejected }) => {
      if (rejected === 0) {
        toast.success(`${fulfilled} comprobantes aprobados`);
      } else {
        toast.success(`${fulfilled} comprobantes aprobados`);
        toast.error(`${rejected} comprobantes fallaron al aprobar`);
      }
      queryClient.invalidateQueries({ queryKey: queryKeys.financials.paymentProofs._def });
      queryClient.invalidateQueries({ queryKey: queryKeys.financials.unitBalances._def });
    },
    onError: (error: Error) => {
      toastError('Error en aprobacion masiva', error);
    },
  });
}
