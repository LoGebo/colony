'use client';

export const dynamic = 'force-dynamic';

import { useState, useMemo } from 'react';
import { useUnitBalances } from '@/hooks/useCharges';
import { BalanceReportTable } from '@/components/financial/BalanceReportTable';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { formatCurrency } from '@/lib/formatters';
import { exportToExcel } from '@/lib/export';

/**
 * Balance reports page.
 * Shows unit-by-unit balance report with sorting, filtering, and Excel export.
 */
export default function BalanceReportsPage() {
  const { data: balances, isLoading } = useUnitBalances();
  const [searchTerm, setSearchTerm] = useState('');

  // Filter by unit_number search
  const filteredData = useMemo(() => {
    if (!balances) return [];
    if (!searchTerm.trim()) return balances;
    const term = searchTerm.toLowerCase();
    return balances.filter(
      (b) =>
        b.unit_number?.toLowerCase().includes(term) ||
        b.building?.toLowerCase().includes(term)
    );
  }, [balances, searchTerm]);

  // Summary stats
  const stats = useMemo(() => {
    if (!balances || balances.length === 0) {
      return { total: 0, pendingBalance: 0, upToDate: 0, delinquent: 0 };
    }
    const pendingBalance = balances.reduce((sum, b) => sum + (Number(b.total_receivable) || 0), 0);
    const delinquent = balances.filter(
      (b) => (Number(b.total_receivable) || 0) > 0 && (Number(b.days_overdue) || 0) > 0
    ).length;

    return {
      total: balances.length,
      pendingBalance,
      upToDate: balances.length - delinquent,
      delinquent,
    };
  }, [balances]);

  function handleExport() {
    if (!filteredData || filteredData.length === 0) return;
    const exportData = filteredData.map((row) => ({
      Unidad: row.unit_number ?? '',
      Edificio: row.building ?? '',
      'Total Cargos': Number(row.total_charges) || 0,
      'Total Pagos': Number(row.total_payments) || 0,
      Saldo: Number(row.total_receivable) || 0,
      'Dias Vencido': Number(row.days_overdue) || 0,
      'Ultimo Pago': row.last_payment_date ?? '',
    }));
    exportToExcel(exportData, 'reporte-saldos', 'Saldos por Unidad');
  }

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Reportes de Saldos</h1>
          <p className="mt-1 text-sm text-gray-500">
            Balance por unidad con detalle de cargos, pagos y morosidad
          </p>
        </div>
        <Button
          variant="secondary"
          size="md"
          onClick={handleExport}
          disabled={!filteredData || filteredData.length === 0}
        >
          <svg
            className="mr-2 h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3"
            />
          </svg>
          Exportar a Excel
        </Button>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
        <Card padding="p-4">
          <p className="text-sm font-medium text-gray-500">Total Unidades</p>
          <p className="mt-1 text-2xl font-bold text-gray-900">{stats.total}</p>
        </Card>
        <Card padding="p-4">
          <p className="text-sm font-medium text-gray-500">Total Saldo Pendiente</p>
          <p className="mt-1 text-2xl font-bold text-red-600">
            {formatCurrency(stats.pendingBalance)}
          </p>
        </Card>
        <Card padding="p-4">
          <p className="text-sm font-medium text-gray-500">Unidades al Dia</p>
          <p className="mt-1 text-2xl font-bold text-green-600">{stats.upToDate}</p>
        </Card>
        <Card padding="p-4">
          <p className="text-sm font-medium text-gray-500">Unidades Morosas</p>
          <p className="mt-1 text-2xl font-bold text-red-600">{stats.delinquent}</p>
        </Card>
      </div>

      {/* Search filter */}
      <div className="flex items-center gap-3">
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Buscar por unidad o edificio..."
          className="w-full max-w-sm rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
        />
        {searchTerm && (
          <span className="text-sm text-gray-500">
            {filteredData.length} de {balances?.length ?? 0} unidades
          </span>
        )}
      </div>

      {/* Balance table */}
      <BalanceReportTable data={filteredData} isLoading={isLoading} />
    </div>
  );
}
