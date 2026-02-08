'use client';

// Dashboard requires auth state -- skip static prerendering
export const dynamic = 'force-dynamic';

import { useMemo } from 'react';
import { useKPIMonthly, useKPIMonthlyRange, useExpenseBreakdown, useDelinquentUnits } from '@/hooks/useFinancials';
import { KPICard } from '@/components/charts/KPICard';
import { CollectionChart } from '@/components/charts/CollectionChart';
import { DelinquencyChart } from '@/components/charts/DelinquencyChart';
import { ExpenseChart } from '@/components/charts/ExpenseChart';
import { Card } from '@/components/ui/Card';
import { formatCurrency, formatPercent, formatMonth } from '@/lib/formatters';

function SkeletonCard() {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
      <div className="h-4 w-24 animate-pulse rounded bg-gray-200" />
      <div className="mt-3 h-8 w-32 animate-pulse rounded bg-gray-200" />
      <div className="mt-2 h-3 w-20 animate-pulse rounded bg-gray-200" />
    </div>
  );
}

function SkeletonChart() {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
      <div className="h-4 w-40 animate-pulse rounded bg-gray-200" />
      <div className="mt-4 h-[300px] animate-pulse rounded bg-gray-100" />
    </div>
  );
}

export default function DashboardPage() {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;

  // Current month KPIs
  const { data: kpi, isLoading: kpiLoading } = useKPIMonthly(currentYear, currentMonth);

  // Last 12 months of KPI data for charts
  const { data: kpiRange, isLoading: rangeLoading } = useKPIMonthlyRange(
    currentYear,
    1,
    12
  );

  // Expense breakdown for pie chart
  const { data: expenses, isLoading: expensesLoading } = useExpenseBreakdown(currentYear);

  // Delinquent units count
  const { data: delinquentUnits, isLoading: delinquentLoading } = useDelinquentUnits(1);

  // Transform KPI range data for collection chart
  const collectionData = useMemo(() => {
    if (!kpiRange) return [];
    return kpiRange.map((row) => ({
      month: formatMonth(row.year, row.month),
      billed: row.total_billed ?? 0,
      collected: row.total_collected ?? 0,
    }));
  }, [kpiRange]);

  // Transform KPI range data for delinquency chart
  const delinquencyData = useMemo(() => {
    if (!kpiRange) return [];
    return kpiRange.map((row) => ({
      month: formatMonth(row.year, row.month),
      d30: row.units_delinquent_30_days ?? 0,
      d60: row.units_delinquent_60_days ?? 0,
      d90: row.units_delinquent_90_days ?? 0,
    }));
  }, [kpiRange]);

  const isLoading = kpiLoading || rangeLoading || expensesLoading || delinquentLoading;

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Panel Financiero</h1>
        <p className="mt-1 text-sm text-gray-500">
          {formatMonth(currentYear, currentMonth)} {currentYear}
        </p>
      </div>

      {/* KPI Cards Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <KPICard
            title="Total Cobrado"
            value={formatCurrency(kpi?.total_collected ?? 0)}
            icon={
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0 1 15.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 0 1 3 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 0 0-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 0 1-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 0 0 3 15h-.75M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm3 0h.008v.008H18V10.5Zm-12 0h.008v.008H6V10.5Z" />
              </svg>
            }
          />
          <KPICard
            title="Total Facturado"
            value={formatCurrency(kpi?.total_billed ?? 0)}
            icon={
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
              </svg>
            }
          />
          <KPICard
            title="Tasa de Cobranza"
            value={formatPercent(kpi?.collection_rate ?? 0)}
            change={kpi?.collection_rate_change ?? undefined}
            changeLabel="vs mes anterior"
            icon={
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z" />
              </svg>
            }
          />
          <KPICard
            title="Unidades Morosas"
            value={String(delinquentUnits?.length ?? 0)}
            icon={
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
              </svg>
            }
          />
        </div>
      )}

      {/* Charts Row */}
      {isLoading ? (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <SkeletonChart />
          <SkeletonChart />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <Card>
            <h2 className="mb-4 text-lg font-semibold text-gray-900">
              Cobranza Mensual
            </h2>
            <CollectionChart data={collectionData} />
          </Card>
          <Card>
            <h2 className="mb-4 text-lg font-semibold text-gray-900">
              Tendencia de Morosidad
            </h2>
            <DelinquencyChart data={delinquencyData} />
          </Card>
        </div>
      )}

      {/* Expense Breakdown */}
      {isLoading ? (
        <SkeletonChart />
      ) : (
        <Card>
          <h2 className="mb-4 text-lg font-semibold text-gray-900">
            Desglose de Gastos
          </h2>
          <ExpenseChart data={expenses ?? []} />
        </Card>
      )}
    </div>
  );
}
