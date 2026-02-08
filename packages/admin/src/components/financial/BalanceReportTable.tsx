'use client';

import { useMemo, useState } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  flexRender,
  type ColumnDef,
  type SortingState,
} from '@tanstack/react-table';
import { formatCurrency, formatDate } from '@/lib/formatters';
import type { UnitBalance } from '@/hooks/useCharges';

// ── Types ──────────────────────────────────────────────────────────

interface BalanceReportTableProps {
  data: UnitBalance[];
  isLoading: boolean;
}

// ── Column definitions ─────────────────────────────────────────────

const columns: ColumnDef<UnitBalance, unknown>[] = [
  {
    accessorKey: 'unit_number',
    header: 'Unidad',
    cell: ({ getValue }) => (
      <span className="font-medium">{(getValue() as string) ?? '-'}</span>
    ),
  },
  {
    accessorKey: 'building',
    header: 'Edificio',
    cell: ({ getValue }) => (getValue() as string) ?? '-',
  },
  {
    accessorKey: 'total_charges',
    header: 'Total Cargos',
    cell: ({ getValue }) => formatCurrency(Number(getValue()) || 0),
  },
  {
    accessorKey: 'total_payments',
    header: 'Total Pagos',
    cell: ({ getValue }) => formatCurrency(Number(getValue()) || 0),
  },
  {
    accessorKey: 'total_receivable',
    header: 'Saldo',
    cell: ({ getValue }) => {
      const val = Number(getValue()) || 0;
      return (
        <span className={val > 0 ? 'font-semibold text-red-600' : 'text-green-600'}>
          {formatCurrency(val)}
        </span>
      );
    },
  },
  {
    accessorKey: 'days_overdue',
    header: 'Dias Vencido',
    cell: ({ getValue }) => {
      const val = Number(getValue()) || 0;
      if (val <= 0) return <span className="text-gray-400">0</span>;
      return (
        <span className={val > 30 ? 'font-semibold text-red-600' : 'text-yellow-600'}>
          {val}
        </span>
      );
    },
  },
  {
    accessorKey: 'last_payment_date',
    header: 'Ultimo Pago',
    cell: ({ getValue }) => {
      const val = getValue() as string | null;
      return val ? formatDate(val) : '-';
    },
  },
];

// ── Component ──────────────────────────────────────────────────────

/**
 * Balance report table with sorting and conditional row styling.
 * Units with positive balance (they owe money) and days_overdue > 30
 * get a red background tint.
 */
export function BalanceReportTable({ data, isLoading }: BalanceReportTableProps) {
  const [sorting, setSorting] = useState<SortingState>([]);

  const table = useReactTable({
    data,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  });

  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="h-10 animate-pulse rounded bg-gray-100" />
        ))}
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border border-gray-200">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          {table.getHeaderGroups().map((headerGroup) => (
            <tr key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <th
                  key={header.id}
                  className="cursor-pointer select-none px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500"
                  onClick={header.column.getToggleSortingHandler()}
                >
                  <span className="flex items-center gap-1">
                    {header.isPlaceholder
                      ? null
                      : flexRender(header.column.columnDef.header, header.getContext())}
                    {header.column.getIsSorted() === 'asc' && ' \u2191'}
                    {header.column.getIsSorted() === 'desc' && ' \u2193'}
                  </span>
                </th>
              ))}
            </tr>
          ))}
        </thead>
        <tbody className="divide-y divide-gray-200 bg-white">
          {table.getRowModel().rows.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="px-4 py-8 text-center text-sm text-gray-500">
                Sin datos disponibles
              </td>
            </tr>
          ) : (
            table.getRowModel().rows.map((row) => {
              const balance = Number(row.original.total_receivable) || 0;
              const daysOverdue = Number(row.original.days_overdue) || 0;
              const isDelinquent = balance > 0 && daysOverdue > 30;

              return (
                <tr
                  key={row.id}
                  className={isDelinquent ? 'bg-red-50 hover:bg-red-100' : 'hover:bg-gray-50'}
                >
                  {row.getVisibleCells().map((cell) => (
                    <td
                      key={cell.id}
                      className="whitespace-nowrap px-4 py-3 text-sm text-gray-900"
                    >
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}
