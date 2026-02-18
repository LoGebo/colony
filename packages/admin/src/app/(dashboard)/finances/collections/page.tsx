'use client';

export const dynamic = 'force-dynamic';

import { useState, useMemo } from 'react';
import { useCollectionsByMethod, useReceiptsForExport } from '@/hooks/useStripePayments';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { formatCurrency } from '@/lib/formatters';
import { exportToExcel } from '@/lib/export';

const MONTH_NAMES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

function getMethodLabel(method: string): string {
  switch (method) {
    case 'card':
      return 'Tarjeta';
    case 'oxxo':
      return 'OXXO';
    case 'transfer':
      return 'Transferencia';
    case 'cash':
      return 'Efectivo';
    default:
      return method.charAt(0).toUpperCase() + method.slice(1);
  }
}

function getMethodColor(method: string): string {
  switch (method) {
    case 'card':
      return 'bg-indigo-500';
    case 'oxxo':
      return 'bg-amber-500';
    case 'transfer':
      return 'bg-teal-500';
    case 'cash':
      return 'bg-green-500';
    default:
      return 'bg-gray-400';
  }
}

export default function CollectionsPage() {
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [selectedMonth, setSelectedMonth] = useState<number | undefined>(currentMonth);

  const { data: collections, isLoading } = useCollectionsByMethod(
    selectedYear,
    selectedMonth
  );
  const { data: receiptsForExport } = useReceiptsForExport(selectedYear);

  const yearOptions = useMemo(() => {
    const years: number[] = [];
    for (let y = currentYear; y >= currentYear - 4; y--) {
      years.push(y);
    }
    return years;
  }, [currentYear]);

  const totalCollected = useMemo(
    () => (collections ?? []).reduce((sum, c) => sum + c.total, 0),
    [collections]
  );

  const totalCount = useMemo(
    () => (collections ?? []).reduce((sum, c) => sum + c.count, 0),
    [collections]
  );

  function handleExportReceipts() {
    if (!receiptsForExport || receiptsForExport.length === 0) return;
    const exportData = receiptsForExport.map((r) => ({
      'Recibo': r.receipt_number,
      'Unidad': r.unit_number ?? '',
      'Edificio': r.building ?? '',
      'Monto': r.amount,
      'Moneda': r.currency,
      'Metodo': getMethodLabel(r.payment_method),
      'Descripcion': r.description,
      'Fecha': r.payment_date,
    }));
    exportToExcel(exportData, `recibos-${selectedYear}`, 'Recibos');
  }

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Reporte de Cobranza</h1>
          <p className="mt-1 text-sm text-gray-500">
            Cobranza por metodo de pago con exportacion de recibos
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
          <select
            value={selectedMonth ?? ''}
            onChange={(e) =>
              setSelectedMonth(e.target.value ? Number(e.target.value) : undefined)
            }
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          >
            <option value="">Todo el anio</option>
            {MONTH_NAMES.map((name, idx) => (
              <option key={idx} value={idx + 1}>
                {name}
              </option>
            ))}
          </select>
          <Button
            variant="secondary"
            size="md"
            onClick={handleExportReceipts}
            disabled={!receiptsForExport || receiptsForExport.length === 0}
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
            Exportar Recibos
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card padding="p-4">
          <p className="text-sm font-medium text-gray-500">Total Cobrado</p>
          <p className="mt-1 text-2xl font-bold text-green-600">
            {formatCurrency(totalCollected)}
          </p>
        </Card>
        <Card padding="p-4">
          <p className="text-sm font-medium text-gray-500">Total Recibos</p>
          <p className="mt-1 text-2xl font-bold text-gray-900">{totalCount}</p>
        </Card>
        <Card padding="p-4">
          <p className="text-sm font-medium text-gray-500">Metodos Activos</p>
          <p className="mt-1 text-2xl font-bold text-gray-900">
            {collections?.length ?? 0}
          </p>
        </Card>
      </div>

      {/* Collection by Method */}
      <Card>
        <h2 className="mb-4 text-lg font-semibold text-gray-900">
          Cobranza por Metodo de Pago
        </h2>
        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-12 animate-pulse rounded bg-gray-100" />
            ))}
          </div>
        ) : !collections || collections.length === 0 ? (
          <p className="py-6 text-center text-sm text-gray-500">
            No hay cobranza registrada en el periodo seleccionado.
          </p>
        ) : (
          <div className="space-y-4">
            {collections.map((c) => {
              const percentage = totalCollected > 0
                ? (c.total / totalCollected) * 100
                : 0;
              return (
                <div key={c.payment_method} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div
                        className={`h-3 w-3 rounded-full ${getMethodColor(c.payment_method)}`}
                      />
                      <span className="text-sm font-medium text-gray-900">
                        {getMethodLabel(c.payment_method)}
                      </span>
                      <span className="text-xs text-gray-400">
                        ({c.count} recibos)
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-bold text-gray-900">
                        {formatCurrency(c.total)}
                      </span>
                      <span className="text-xs font-medium text-gray-500">
                        {percentage.toFixed(1)}%
                      </span>
                    </div>
                  </div>
                  {/* Progress bar */}
                  <div className="h-2 overflow-hidden rounded-full bg-gray-100">
                    <div
                      className={`h-full rounded-full ${getMethodColor(c.payment_method)} transition-all`}
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}
