'use client';

export const dynamic = 'force-dynamic';

import { useMemo } from 'react';
import { useDelinquentUnits } from '@/hooks/useFinancials';
import { useUnitBalances } from '@/hooks/useCharges';
import { DataTable } from '@/components/ui/DataTable';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { formatCurrency, formatDate } from '@/lib/formatters';
import { exportToExcel } from '@/lib/export';
import { Button } from '@/components/ui/Button';
import { type ColumnDef } from '@tanstack/react-table';

interface AgingBucket {
  label: string;
  min: number;
  max: number | null;
  count: number;
  amount: number;
  variant: 'warning' | 'danger' | 'info' | 'neutral';
}

export default function DelinquencyPage() {
  const { data: balances, isLoading } = useUnitBalances();

  const delinquentUnits = useMemo(
    () => (balances ?? []).filter((b) => (b.days_overdue ?? 0) > 0),
    [balances]
  );

  // Aging buckets
  const buckets = useMemo<AgingBucket[]>(() => {
    const b30 = delinquentUnits.filter((u) => (u.days_overdue ?? 0) <= 30);
    const b60 = delinquentUnits.filter((u) => (u.days_overdue ?? 0) > 30 && (u.days_overdue ?? 0) <= 60);
    const b90 = delinquentUnits.filter((u) => (u.days_overdue ?? 0) > 60 && (u.days_overdue ?? 0) <= 90);
    const b120 = delinquentUnits.filter((u) => (u.days_overdue ?? 0) > 90);

    const sum = (arr: typeof delinquentUnits) =>
      arr.reduce((s, u) => s + (u.total_receivable ?? 0), 0);

    return [
      { label: '1-30 dias', min: 1, max: 30, count: b30.length, amount: sum(b30), variant: 'info' },
      { label: '31-60 dias', min: 31, max: 60, count: b60.length, amount: sum(b60), variant: 'warning' },
      { label: '61-90 dias', min: 61, max: 90, count: b90.length, amount: sum(b90), variant: 'danger' },
      { label: '90+ dias', min: 91, max: null, count: b120.length, amount: sum(b120), variant: 'danger' },
    ];
  }, [delinquentUnits]);

  const totalDelinquent = delinquentUnits.length;
  const totalAmount = delinquentUnits.reduce((s, u) => s + (u.total_receivable ?? 0), 0);

  const columns = useMemo<ColumnDef<(typeof delinquentUnits)[number]>[]>(
    () => [
      {
        accessorKey: 'unit_number',
        header: 'Unidad',
        cell: ({ getValue }) => <span className="font-medium">{getValue() as string}</span>,
      },
      {
        accessorKey: 'building',
        header: 'Edificio',
        cell: ({ getValue }) => getValue() ?? '—',
      },
      {
        accessorKey: 'total_receivable',
        header: 'Saldo pendiente',
        cell: ({ getValue }) => formatCurrency(Number(getValue()) || 0),
      },
      {
        accessorKey: 'days_overdue',
        header: 'Dias de atraso',
        cell: ({ getValue }) => {
          const days = Number(getValue()) || 0;
          const variant = days > 90 ? 'danger' : days > 60 ? 'danger' : days > 30 ? 'warning' : 'info';
          return <Badge variant={variant}>{days} dias</Badge>;
        },
      },
      {
        accessorKey: 'oldest_unpaid_date',
        header: 'Cargo mas antiguo',
        cell: ({ getValue }) => {
          const v = getValue() as string | null;
          return v ? formatDate(v) : '—';
        },
      },
      {
        accessorKey: 'last_payment_date',
        header: 'Ultimo pago',
        cell: ({ getValue }) => {
          const v = getValue() as string | null;
          return v ? formatDate(v) : 'Sin pagos';
        },
      },
    ],
    []
  );

  const handleExport = () => {
    const rows = delinquentUnits.map((u) => ({
      Unidad: u.unit_number ?? '',
      Edificio: u.building ?? '',
      'Saldo pendiente': u.total_receivable ?? 0,
      'Dias de atraso': u.days_overdue ?? 0,
      'Cargo mas antiguo': u.oldest_unpaid_date ?? '',
      'Ultimo pago': u.last_payment_date ?? '',
    }));
    exportToExcel(rows, 'morosidad', 'Morosidad');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Morosidad</h1>
          <p className="mt-1 text-sm text-gray-500">
            Analisis de antigqedad de saldos por unidad
          </p>
        </div>
        <Button onClick={handleExport} disabled={delinquentUnits.length === 0}>
          Exportar Excel
        </Button>
      </div>

      {/* Summary cards */}
      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <div className="p-4">
            <p className="text-sm text-gray-500">Unidades morosas</p>
            <p className="mt-1 text-2xl font-bold text-gray-900">{totalDelinquent}</p>
          </div>
        </Card>
        <Card>
          <div className="p-4">
            <p className="text-sm text-gray-500">Monto total pendiente</p>
            <p className="mt-1 text-2xl font-bold text-red-600">{formatCurrency(totalAmount)}</p>
          </div>
        </Card>
      </div>

      {/* Aging buckets */}
      <div className="grid gap-4 sm:grid-cols-4">
        {buckets.map((bucket) => (
          <Card key={bucket.label}>
            <div className="p-4">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-gray-700">{bucket.label}</p>
                <Badge variant={bucket.variant}>
                  {bucket.count}
                </Badge>
              </div>
              <p className="mt-2 text-lg font-semibold text-gray-900">
                {formatCurrency(bucket.amount)}
              </p>
            </div>
          </Card>
        ))}
      </div>

      {/* Delinquent units table */}
      <DataTable
        columns={columns}
        data={delinquentUnits}
        isLoading={isLoading}
      />
    </div>
  );
}
