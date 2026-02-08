'use client';

import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@upoe/shared';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from './useAuth';
import { formatMonth } from '@/lib/formatters';

/**
 * Fetch KPI data for a specific month.
 * Returns a single row from kpi_monthly with all financial metrics.
 */
export function useKPIMonthly(year: number, month: number) {
  const { communityId } = useAuth();

  return useQuery({
    queryKey: queryKeys.kpis.summary(communityId!, `${year}-${month}`).queryKey,
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('kpi_monthly')
        .select('*')
        .eq('community_id', communityId!)
        .eq('year', year)
        .eq('month', month)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    enabled: !!communityId,
  });
}

/**
 * Fetch KPI data for a range of months (for chart data).
 * Returns an array of kpi_monthly rows ordered by year, month.
 */
export function useKPIMonthlyRange(year: number, startMonth: number, endMonth: number) {
  const { communityId } = useAuth();

  return useQuery({
    queryKey: ['kpi-monthly-range', communityId, year, startMonth, endMonth],
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('kpi_monthly')
        .select('*')
        .eq('community_id', communityId!)
        .eq('year', year)
        .gte('month', startMonth)
        .lte('month', endMonth)
        .order('month', { ascending: true });

      if (error) throw error;
      return data ?? [];
    },
    enabled: !!communityId,
  });
}

/**
 * Fetch transaction summary grouped by month for a given year.
 * Returns raw transactions which are then grouped client-side.
 */
export function useTransactionSummary(year: number) {
  const { communityId } = useAuth();

  return useQuery({
    queryKey: ['transaction-summary', communityId, year],
    queryFn: async () => {
      const supabase = createClient();
      const startDate = `${year}-01-01`;
      const endDate = `${year}-12-31`;

      const { data, error } = await supabase
        .from('transactions')
        .select('amount, transaction_type, effective_date')
        .eq('community_id', communityId!)
        .eq('status', 'posted')
        .gte('effective_date', startDate)
        .lte('effective_date', endDate);

      if (error) throw error;

      // Group by month
      const monthlyMap = new Map<number, { income: number; expense: number }>();
      for (let m = 1; m <= 12; m++) {
        monthlyMap.set(m, { income: 0, expense: 0 });
      }

      for (const tx of data ?? []) {
        const month = new Date(tx.effective_date).getMonth() + 1;
        const entry = monthlyMap.get(month)!;
        if (tx.transaction_type === 'payment') {
          entry.income += tx.amount;
        } else if (tx.transaction_type === 'charge') {
          entry.expense += tx.amount;
        }
      }

      return Array.from(monthlyMap.entries()).map(([month, totals]) => ({
        month: formatMonth(year, month),
        monthNum: month,
        income: totals.income,
        expense: totals.expense,
        balance: totals.income - totals.expense,
        margin: totals.income > 0
          ? ((totals.income - totals.expense) / totals.income) * 100
          : 0,
      }));
    },
    enabled: !!communityId,
  });
}

/**
 * Fetch expense breakdown by account category for pie chart.
 * Queries ledger_entries joined with accounts where category = 'expense'.
 */
export function useExpenseBreakdown(year: number) {
  const { communityId } = useAuth();

  return useQuery({
    queryKey: ['expense-breakdown', communityId, year],
    queryFn: async () => {
      const supabase = createClient();
      const startDate = `${year}-01-01`;
      const endDate = `${year}-12-31`;

      // Query ledger entries with their account info
      const { data, error } = await supabase
        .from('ledger_entries')
        .select(`
          amount,
          accounts!inner(name, category),
          transactions!inner(effective_date, status)
        `)
        .eq('community_id', communityId!)
        .eq('accounts.category', 'expense')
        .eq('transactions.status', 'posted')
        .gte('transactions.effective_date', startDate)
        .lte('transactions.effective_date', endDate);

      if (error) throw error;

      // Group by account name and sum amounts
      const categoryMap = new Map<string, number>();
      for (const entry of data ?? []) {
        const account = entry.accounts as unknown as { name: string; category: string };
        const name = account.name;
        // Expense entries are typically negative (credit), use absolute value
        const amount = Math.abs(entry.amount);
        categoryMap.set(name, (categoryMap.get(name) ?? 0) + amount);
      }

      return Array.from(categoryMap.entries())
        .map(([name, value]) => ({ name, value }))
        .sort((a, b) => b.value - a.value);
    },
    enabled: !!communityId,
  });
}

/**
 * Fetch delinquent units via the get_delinquent_units RPC.
 */
export function useDelinquentUnits(minDays = 1) {
  const { communityId } = useAuth();

  return useQuery({
    queryKey: ['delinquent-units', communityId, minDays],
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase.rpc('get_delinquent_units', {
        p_community_id: communityId!,
        p_min_days: minDays,
      });

      if (error) throw error;
      return data ?? [];
    },
    enabled: !!communityId,
  });
}
