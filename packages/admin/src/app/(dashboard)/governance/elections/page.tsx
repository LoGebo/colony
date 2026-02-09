'use client';

export const dynamic = 'force-dynamic';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { type PaginationState, type ColumnDef } from '@tanstack/react-table';
import { useElections, type ElectionRow } from '@/hooks/useGovernance';
import { DataTable } from '@/components/ui/DataTable';
import { Badge } from '@/components/ui/Badge';
import { formatDate } from '@/lib/formatters';

const electionStatusVariants = {
  draft: 'neutral' as const,
  open: 'info' as const,
  closed: 'success' as const,
  cancelled: 'danger' as const,
};

const electionTypeVariants = {
  board_election: 'info' as const,
  budget_approval: 'warning' as const,
  rules_amendment: 'neutral' as const,
  general_vote: 'success' as const,
};

const electionTypeLabels: Record<string, string> = {
  board_election: 'Elección de Mesa',
  budget_approval: 'Aprobación Presupuesto',
  rules_amendment: 'Enmienda Reglamento',
  general_vote: 'Votación General',
};

const statusLabels: Record<string, string> = {
  draft: 'Borrador',
  open: 'Abierta',
  closed: 'Cerrada',
  cancelled: 'Cancelada',
};

export default function ElectionsPage() {
  const router = useRouter();
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 20,
  });
  const [statusFilter, setStatusFilter] = useState<string>('');

  const { data, isLoading } = useElections({
    status: statusFilter,
    page: pagination.pageIndex,
    pageSize: pagination.pageSize,
  });

  const columns: ColumnDef<ElectionRow>[] = [
    {
      accessorKey: 'election_number',
      header: 'Número',
      cell: ({ row }) => (
        <span className="font-medium">{row.original.election_number}</span>
      ),
    },
    {
      accessorKey: 'title',
      header: 'Título',
      cell: ({ row }) => (
        <span className="max-w-xs truncate">{row.original.title}</span>
      ),
    },
    {
      accessorKey: 'election_type',
      header: 'Tipo',
      cell: ({ row }) => (
        <Badge
          variant={
            electionTypeVariants[row.original.election_type as keyof typeof electionTypeVariants] || 'neutral'
          }
        >
          {electionTypeLabels[row.original.election_type] || row.original.election_type}
        </Badge>
      ),
    },
    {
      accessorKey: 'status',
      header: 'Estado',
      cell: ({ row }) => (
        <Badge
          variant={
            electionStatusVariants[row.original.status as keyof typeof electionStatusVariants] || 'neutral'
          }
        >
          {statusLabels[row.original.status] || row.original.status}
        </Badge>
      ),
    },
    {
      accessorKey: 'quorum_met',
      header: 'Quórum',
      cell: ({ row }) => (
        <Badge variant={row.original.quorum_met ? 'success' : 'warning'}>
          {row.original.quorum_met ? 'Alcanzado' : 'Pendiente'}
        </Badge>
      ),
    },
    {
      accessorKey: 'opens_at',
      header: 'Apertura',
      cell: ({ row }) => formatDate(row.original.opens_at),
    },
    {
      accessorKey: 'closes_at',
      header: 'Cierre',
      cell: ({ row }) => formatDate(row.original.closes_at),
    },
  ];

  const pageCount = data ? Math.ceil(data.count / pagination.pageSize) : 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Elecciones</h1>
          <p className="mt-1 text-sm text-gray-500">
            Gestiona elecciones y votaciones de la comunidad
          </p>
        </div>
        <button
          onClick={() => router.push('/governance/elections/new')}
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
        >
          Nueva Elección
        </button>
      </div>

      <div className="flex gap-4">
        <select
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value);
            setPagination({ ...pagination, pageIndex: 0 });
          }}
          className="rounded-md border border-gray-300 px-3 py-2 text-sm"
        >
          <option value="">Todos los estados</option>
          <option value="draft">Borrador</option>
          <option value="open">Abierta</option>
          <option value="closed">Cerrada</option>
          <option value="cancelled">Cancelada</option>
        </select>
      </div>

      <div
        className="cursor-pointer"
        onClick={(e) => {
          const target = e.target as HTMLElement;
          const row = target.closest('tr');
          if (row && row.querySelector('td')) {
            const rowIndex = Array.from(row.parentElement?.children || []).indexOf(row) - 1;
            if (rowIndex >= 0 && data?.data[rowIndex]) {
              router.push(`/governance/elections/${data.data[rowIndex].id}`);
            }
          }
        }}
      >
        <DataTable
          columns={columns}
          data={data?.data ?? []}
          pageCount={pageCount}
          pagination={pagination}
          onPaginationChange={setPagination}
          isLoading={isLoading}
        />
      </div>
    </div>
  );
}
