'use client';

import { useQuery } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from './useAuth';

// ── Types ──────────────────────────────────────────────────────────

export interface PaymentIntentRow {
  id: string;
  stripe_payment_intent_id: string;
  unit_id: string;
  amount: number;
  currency: string;
  status: string;
  payment_method_type: string;
  created_at: string;
  unit_number?: string;
  building?: string;
}

export interface WebhookEventRow {
  id: string;
  event_id: string;
  event_type: string;
  status: string;
  error_message: string | null;
  processed_at: string | null;
  created_at: string;
}

export interface CollectionRow {
  payment_method: string;
  count: number;
  total: number;
}

// ── usePaymentIntents ──────────────────────────────────────────────

export function usePaymentIntents(statusFilter?: string) {
  const { communityId } = useAuth();

  return useQuery({
    queryKey: ['payment-intents', communityId, statusFilter],
    queryFn: async () => {
      const supabase = createClient();

      // payment_intents not in generated types; cast through never
      let query = supabase
        .from('payment_intents' as never)
        .select('id, stripe_payment_intent_id, unit_id, amount, currency, status, payment_method_type, created_at' as never)
        .eq('community_id' as never, communityId! as never)
        .is('deleted_at' as never, null as never)
        .order('created_at' as never, { ascending: false } as never)
        .limit(100);

      if (statusFilter && statusFilter !== 'all') {
        query = query.eq('status' as never, statusFilter as never);
      }

      const { data, error } = await query;
      if (error) throw error;

      const rows = (data ?? []) as unknown as PaymentIntentRow[];

      // Enrich with unit info
      if (rows.length > 0) {
        const unitIds = [...new Set(rows.map((r) => r.unit_id))];
        const { data: units } = await supabase
          .from('units')
          .select('id, unit_number, building')
          .in('id', unitIds);

        const unitMap = new Map((units ?? []).map((u) => [u.id, u]));
        for (const row of rows) {
          const unit = unitMap.get(row.unit_id);
          if (unit) {
            row.unit_number = unit.unit_number;
            row.building = unit.building ?? undefined;
          }
        }
      }

      return rows;
    },
    enabled: !!communityId,
  });
}

// ── useFailedWebhooks ──────────────────────────────────────────────

export function useFailedWebhooks() {
  return useQuery({
    queryKey: ['failed-webhooks'],
    queryFn: async () => {
      const supabase = createClient();

      // webhook_events has no community_id (by design) — all admins see all events
      const { data, error } = await supabase
        .from('webhook_events' as never)
        .select('id, event_id, event_type, status, error_message, processed_at, created_at' as never)
        .eq('status' as never, 'failed' as never)
        .order('created_at' as never, { ascending: false } as never)
        .limit(50);

      if (error) throw error;
      return (data ?? []) as unknown as WebhookEventRow[];
    },
  });
}

// ── useCollectionsByMethod ─────────────────────────────────────────

export function useCollectionsByMethod(year: number, month?: number) {
  const { communityId } = useAuth();

  return useQuery({
    queryKey: ['collections-by-method', communityId, year, month],
    queryFn: async () => {
      const supabase = createClient();

      // Query receipts grouped by payment_method
      const startDate = month
        ? `${year}-${String(month).padStart(2, '0')}-01`
        : `${year}-01-01`;
      const endDate = month
        ? new Date(year, month, 0).toISOString().split('T')[0]
        : `${year}-12-31`;

      const { data, error } = await supabase
        .from('receipts' as never)
        .select('payment_method, amount' as never)
        .eq('community_id' as never, communityId! as never)
        .is('deleted_at' as never, null as never)
        .gte('payment_date' as never, startDate as never)
        .lte('payment_date' as never, endDate as never);

      if (error) throw error;

      // Group client-side
      const rawRows = (data ?? []) as unknown as { payment_method: string; amount: number }[];
      const methodMap = new Map<string, { count: number; total: number }>();

      for (const row of rawRows) {
        const method = row.payment_method;
        const existing = methodMap.get(method) ?? { count: 0, total: 0 };
        existing.count += 1;
        existing.total += Number(row.amount);
        methodMap.set(method, existing);
      }

      return Array.from(methodMap.entries())
        .map(([payment_method, { count, total }]) => ({
          payment_method,
          count,
          total,
        }))
        .sort((a, b) => b.total - a.total) as CollectionRow[];
    },
    enabled: !!communityId,
  });
}

// ── useReceiptsForExport ───────────────────────────────────────────

export interface ReceiptExportRow {
  receipt_number: string;
  amount: number;
  currency: string;
  payment_method: string;
  description: string;
  payment_date: string;
  unit_number?: string;
  building?: string;
}

export function useReceiptsForExport(year: number) {
  const { communityId } = useAuth();

  return useQuery({
    queryKey: ['receipts-export', communityId, year],
    queryFn: async () => {
      const supabase = createClient();

      const { data, error } = await supabase
        .from('receipts' as never)
        .select('receipt_number, amount, currency, payment_method, description, payment_date, unit_id' as never)
        .eq('community_id' as never, communityId! as never)
        .is('deleted_at' as never, null as never)
        .gte('payment_date' as never, `${year}-01-01` as never)
        .lte('payment_date' as never, `${year}-12-31` as never)
        .order('payment_date' as never, { ascending: false } as never);

      if (error) throw error;

      const rows = (data ?? []) as unknown as (ReceiptExportRow & { unit_id: string })[];

      // Enrich with unit info
      if (rows.length > 0) {
        const unitIds = [...new Set(rows.map((r) => r.unit_id))];
        const { data: units } = await supabase
          .from('units')
          .select('id, unit_number, building')
          .in('id', unitIds);

        const unitMap = new Map((units ?? []).map((u) => [u.id, u]));
        for (const row of rows) {
          const unit = unitMap.get(row.unit_id);
          if (unit) {
            row.unit_number = unit.unit_number;
            row.building = unit.building ?? undefined;
          }
        }
      }

      return rows as ReceiptExportRow[];
    },
    enabled: !!communityId,
  });
}
