'use client';

export const dynamic = 'force-dynamic';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { useUnits } from '@/hooks/useUnits';
import { DataTable } from '@/components/ui/DataTable';
import { Badge } from '@/components/ui/Badge';
import { type ColumnDef } from '@tanstack/react-table';

const UNIT_TYPE_LABELS: Record<string, string> = {
  casa: 'Casa',
  departamento: 'Depto',
  local: 'Local',
  bodega: 'Bodega',
  oficina: 'Oficina',
  terreno: 'Terreno',
  estacionamiento: 'Estac.',
};

export default function UnitsPage() {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const pageSize = 20;

  const { data, isLoading, error } = useUnits(search, page, pageSize);

  const columns = useMemo<ColumnDef<(typeof rows)[number]>[]>(
    () => [
      {
        accessorKey: 'unit_number',
        header: 'Unidad',
        cell: ({ row }) => (
          <Link
            href={`/units/${row.original.id}`}
            className="font-medium text-indigo-600 hover:text-indigo-800"
          >
            {row.original.unit_number}
          </Link>
        ),
      },
      {
        accessorKey: 'building',
        header: 'Edificio',
        cell: ({ getValue }) => getValue() ?? '—',
      },
      {
        accessorKey: 'unit_type',
        header: 'Tipo',
        cell: ({ getValue }) => UNIT_TYPE_LABELS[getValue() as string] ?? getValue(),
      },
      {
        accessorKey: 'area_m2',
        header: 'Area (m2)',
        cell: ({ getValue }) => {
          const v = getValue() as number | null;
          return v != null ? v.toFixed(1) : '—';
        },
      },
      {
        accessorKey: 'coefficient',
        header: 'Coeficiente',
        cell: ({ getValue }) => Number(getValue()).toFixed(4),
      },
      {
        accessorKey: 'floor_number',
        header: 'Piso',
        cell: ({ getValue }) => getValue() ?? '—',
      },
      {
        accessorKey: 'parking_spaces',
        header: 'Cajones',
      },
      {
        accessorKey: 'status',
        header: 'Estado',
        cell: ({ getValue }) => {
          const status = getValue() as string;
          const variant = status === 'active' ? 'success' : status === 'inactive' ? 'danger' : 'neutral';
          return (
            <Badge variant={variant}>
              {status === 'active' ? 'Activa' : status === 'inactive' ? 'Inactiva' : status}
            </Badge>
          );
        },
      },
    ],
    []
  );

  const rows = data?.data ?? [];
  const totalCount = data?.count ?? 0;
  const totalPages = Math.ceil(totalCount / pageSize);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Unidades</h1>
        <p className="mt-1 text-sm text-gray-500">
          Catalogo de unidades de la comunidad
        </p>
      </div>

      {/* Search */}
      <div className="flex items-center gap-4">
        <input
          type="text"
          placeholder="Buscar por numero, edificio..."
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(0);
          }}
          className="w-full max-w-sm rounded-lg border border-gray-300 px-4 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
        />
        <span className="text-sm text-gray-500">
          {totalCount} unidad{totalCount !== 1 ? 'es' : ''}
        </span>
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          Error al cargar unidades: {(error as Error).message}
        </div>
      )}

      {/* Table */}
      <DataTable
        columns={columns}
        data={rows}
        isLoading={isLoading}
        pageCount={totalPages}
        pagination={{ pageIndex: page, pageSize }}
        onPaginationChange={(p) => setPage(p.pageIndex)}
      />
    </div>
  );
}
