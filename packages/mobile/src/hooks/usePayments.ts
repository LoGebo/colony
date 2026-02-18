import {
  useQuery,
  useMutation,
  useInfiniteQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { queryKeys } from '@upoe/shared';
import { supabase } from '@/lib/supabase';
import { useAuth } from './useAuth';

// ---------- Types ----------

export interface UnitBalance {
  current_balance: number;
  total_charges: number;
  total_payments: number;
  days_overdue: number;
  last_charge_date: string | null;
  last_payment_date: string | null;
}

export interface Transaction {
  id: string;
  transaction_type: string;
  amount: number;
  currency: string;
  description: string;
  reference_number: string;
  status: string;
  effective_date: string;
  posted_at: string | null;
}

export interface PaymentProof {
  id: string;
  proof_type: string;
  amount: number;
  payment_date: string;
  reference_number: string | null;
  bank_name: string | null;
  document_url: string;
  status: string;
  submitted_at: string;
  reviewed_at: string | null;
  rejection_reason: string | null;
}

// ---------- useUnitBalance ----------

export function useUnitBalance(unitId?: string) {
  return useQuery({
    queryKey: queryKeys.payments.balance(unitId!).queryKey,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_unit_balance', {
        p_unit_id: unitId!,
      });

      if (error) throw error;
      return (data?.[0] as UnitBalance | undefined) ?? null;
    },
    enabled: !!unitId,
  });
}

// ---------- useTransactions ----------

export function useTransactions(unitId?: string, pageSize = 20) {
  return useInfiniteQuery({
    queryKey: queryKeys.payments.byUnit(unitId!).queryKey,
    queryFn: async ({ pageParam = 0 }) => {
      const from = pageParam * pageSize;
      const to = from + pageSize - 1;

      const { data, error, count } = await supabase
        .from('transactions')
        .select(
          'id, transaction_type, amount, currency, description, reference_number, status, effective_date, posted_at',
          { count: 'exact' }
        )
        .eq('unit_id', unitId!)
        .is('deleted_at', null)
        .in('status', ['pending', 'posted'])
        .order('effective_date', { ascending: false })
        .range(from, to);

      if (error) throw error;
      return { data: data ?? [], count: count ?? 0, page: pageParam };
    },
    initialPageParam: 0,
    getNextPageParam: (lastPage) => {
      const nextPage = lastPage.page + 1;
      const totalPages = Math.ceil(lastPage.count / pageSize);
      return nextPage < totalPages ? nextPage : undefined;
    },
    enabled: !!unitId,
  });
}

// ---------- usePaymentProofs ----------

export function usePaymentProofs(unitId?: string) {
  return useQuery({
    queryKey: ['payment-proofs', unitId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('payment_proofs')
        .select(
          'id, proof_type, amount, payment_date, reference_number, bank_name, document_url, status, submitted_at, reviewed_at, rejection_reason'
        )
        .eq('unit_id', unitId!)
        .is('deleted_at', null)
        .order('submitted_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      return data;
    },
    enabled: !!unitId,
  });
}

// ---------- useUploadPaymentProof ----------

interface UploadPaymentProofInput {
  amount: number;
  payment_date: string;
  reference_number?: string;
  bank_name?: string;
  document_url: string;
  proof_type: string;
  unit_id: string;
}

export function useUploadPaymentProof() {
  const { communityId, user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: UploadPaymentProofInput) => {
      const { data, error } = await supabase
        .from('payment_proofs')
        .insert({
          amount: input.amount,
          payment_date: input.payment_date,
          reference_number: input.reference_number,
          bank_name: input.bank_name,
          document_url: input.document_url,
          proof_type: input.proof_type,
          unit_id: input.unit_id,
          community_id: communityId!,
          submitted_by: user!.id,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.payments._def });
      queryClient.invalidateQueries({ queryKey: ['payment-proofs'] });
    },
  });
}

// ---------- CreatePaymentIntent Types ----------

export interface CreatePaymentIntentResponse {
  clientSecret: string;
  paymentIntentId: string;
  customerId: string;
  status: string;
}

export interface CreatePaymentIntentInput {
  unit_id: string;
  amount: number; // MXN pesos (NOT centavos) — edge function converts internally
  description: string;
  idempotency_key: string;
  payment_method_type: 'card';
}

// ---------- useCreatePaymentIntent ----------

/**
 * Calls the create-payment-intent edge function via fetch() with JWT auth.
 * CRITICAL: Uses fetch() directly, NOT supabase.functions.invoke().
 * The latter does not correctly forward the user's JWT for verify_jwt: true
 * edge functions (Pitfall 2 from research).
 *
 * The amount parameter is in MXN pesos (e.g., 500.00), NOT centavos.
 * The edge function handles the conversion to centavos internally.
 */
export function useCreatePaymentIntent() {
  return useMutation({
    mutationFn: async (input: CreatePaymentIntentInput): Promise<CreatePaymentIntentResponse> => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const response = await fetch(
        `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/create-payment-intent`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
            'apikey': process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
          },
          body: JSON.stringify(input),
        }
      );

      if (!response.ok) {
        const err = await response.json().catch(() => ({ error: `HTTP ${response.status}` }));
        throw new Error(err.error ?? `Payment failed (${response.status})`);
      }

      return response.json();
    },
  });
}
