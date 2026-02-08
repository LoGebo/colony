'use client';

export const dynamic = 'force-dynamic';

import { useState, useMemo } from 'react';
import { type ColumnDef } from '@tanstack/react-table';
import { useTransactionSummary } from '@/hooks/useFinancials';
import { DataTable } from '@/components/ui/DataTable';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { formatCurrency, formatPercent } from '@/lib/formatters';
import { exportToExcel } from '@/lib/export';

interface MonthlyRow {
  month: string;
  monthNum: number;
  income: number;
  expense: number;
  balance: number;
  margin: number;
}

const columns: ColumnDef<MonthlyRow, unknown>[] = [
  {
    accessorKey: 'month',
    header: 'Mes',
  },
  {
    accessorKey: 'income',
    header: 'Ingresos',
    cell: ({ getValue }) => formatCurrency(getValue() as number),
  },
  {
    accessorKey: 'expense',
    header: 'Egresos',
    cell: ({ getValue }) => formatCurrency(getValue() as number),
  },
  {
    accessorKey: 'balance',
    header: 'Balance',
    cell: ({ getValue }) => {
      const val = getValue() as number;
      return (
        <span className={val >= 0 ? 'text-green-600' : 'text-red-600'}>
          {formatCurrency(val)}
        </span>
      );
    },
  },
  {
    accessorKey: 'margin',
    header: '% Margen',
    cell: ({ getValue }) => {
      const val = getValue() as number;
      return (
        <span className={val >= 0 ? 'text-green-600' : 'text-red-600'}>
          {formatPercent(val)}
        </span>
      );
    },
  },
];

export default function FinancialReportsPage() {
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState(currentYear);

  const { data: monthlyData, isLoading } = useTransactionSummary(selectedYear);

  // Compute totals row
  const totals = useMemo(() => {
    if (!monthlyData) return null;
    const totalIncome = monthlyData.reduce((sum, r) => sum + r.income, 0);
    const totalExpense = monthlyData.reduce((sum, r) => sum + r.expense, 0);
    return {
      income: totalIncome,
      expense: totalExpense,
      balance: totalIncome - totalExpense,
      margin: totalIncome > 0
        ? ((totalIncome - totalExpense) / totalIncome) * 100
        : 0,
    };
  }, [monthlyData]);

  const yearOptions = useMemo(() => {
    const years: number[] = [];
    for (let y = currentYear; y >= currentYear - 4; y--) {
      years.push(y);
    }
    return years;
  }, [currentYear]);

  function handleExport() {
    if (!monthlyData) return;
    const exportData = monthlyData.map((row) => ({
      Mes: row.month,
      Ingresos: row.income,
      Egresos: row.expense,
      Balance: row.balance,
      'Margen %': Number(row.margin.toFixed(1)),
    }));
    exportToExcel(exportData, `reporte-financiero-${selectedYear}`, 'Ingresos vs Egresos');
  }

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Reportes Financieros</h1>
          <p className="mt-1 text-sm text-gray-500">
            Analisis de ingresos vs egresos por mes
          </p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(Number(e.target.value))}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          >
            {yearOptions.map((year) => (
              <option key={year} value={year}>
                {year}
              </option>
            ))}
          </select>
          <Button
            variant="secondary"
            size="md"
            onClick={handleExport}
            disabled={!monthlyData || monthlyData.length === 0}
          >
            <svg className="mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
            </svg>
            Exportar Excel
          </Button>
        </div>
      </div>

      {/* Income vs Expense Table */}
      <Card>
        <h2 className="mb-4 text-lg font-semibold text-gray-900">
          Ingresos vs Egresos - {selectedYear}
        </h2>
        <DataTable
          columns={columns}
          data={monthlyData ?? []}
          isLoading={isLoading}
        />
        {/* Totals row */}
        {totals && !isLoading && (
          <div className="mt-4 flex gap-6 rounded-lg bg-gray-50 px-4 py-3">
            <div>
              <span className="text-xs font-medium uppercase text-gray-500">Total Ingresos</span>
              <p className="text-sm font-semibold text-gray-900">{formatCurrency(totals.income)}</p>
            </div>
            <div>
              <span className="text-xs font-medium uppercase text-gray-500">Total Egresos</span>
              <p className="text-sm font-semibold text-gray-900">{formatCurrency(totals.expense)}</p>
            </div>
            <div>
              <span className="text-xs font-medium uppercase text-gray-500">Balance Neto</span>
              <p className={`text-sm font-semibold ${totals.balance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {formatCurrency(totals.balance)}
              </p>
            </div>
            <div>
              <span className="text-xs font-medium uppercase text-gray-500">Margen Promedio</span>
              <p className={`text-sm font-semibold ${totals.margin >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {formatPercent(totals.margin)}
              </p>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
