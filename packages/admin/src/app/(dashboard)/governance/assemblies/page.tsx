'use client';

export const dynamic = 'force-dynamic';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { type PaginationState, type ColumnDef } from '@tanstack/react-table';
import { useAssemblies, type AssemblyRow } from '@/hooks/useGovernance';
import { DataTable } from '@/components/ui/DataTable';
import { Badge } from '@/components/ui/Badge';
import { formatDate } from '@/lib/formatters';

const assemblyStatusVariants = {
  scheduled: 'neutral' as const,
  in_progress: 'info' as const,
  completed: 'success' as const,
  cancelled: 'danger' as const,
};

const assemblyTypeVariants = {
  ordinary: 'info' as const,
  extraordinary: 'warning' as const,
};

const assemblyTypeLabels: Record<string, string> = {
  ordinary: 'Ordinaria',
  extraordinary: 'Extraordinaria',
};

const statusLabels: Record<string, string> = {
  scheduled: 'Programada',
  in_progress: 'En Curso',
  completed: 'Completada',
  cancelled: 'Cancelada',
};

export default function AssembliesPage() {
  const router = useRouter();
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 20,
  });
  const [statusFilter, setStatusFilter] = useState<string>('');

  const { data, isLoading } = useAssemblies({
    status: statusFilter,
    page: pagination.pageIndex,
    pageSize: pagination.pageSize,
  });

  const columns: ColumnDef<AssemblyRow>[] = [
    {
      accessorKey: 'assembly_number',
      header: 'Número',
      cell: ({ row }) => (
        <span className="font-medium">{row.original.assembly_number}</span>
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
      accessorKey: 'assembly_type',
      header: 'Tipo',
      cell: ({ row }) => (
        <Badge
          variant={
            assemblyTypeVariants[row.original.assembly_type as keyof typeof assemblyTypeVariants] || 'neutral'
          }
        >
          {assemblyTypeLabels[row.original.assembly_type] || row.original.assembly_type}
        </Badge>
      ),
    },
    {
      accessorKey: 'status',
      header: 'Estado',
      cell: ({ row }) => (
        <Badge
          variant={
            assemblyStatusVariants[row.original.status as keyof typeof assemblyStatusVariants] || 'neutral'
          }
        >
          {statusLabels[row.original.status] || row.original.status}
        </Badge>
      ),
    },
    {
      accessorKey: 'scheduled_date',
      header: 'Fecha',
      cell: ({ row }) => {
        const date = formatDate(row.original.scheduled_date);
        const time = row.original.scheduled_time
          ? ` - ${row.original.scheduled_time}`
          : '';
        return `${date}${time}`;
      },
    },
    {
      accessorKey: 'location',
      header: 'Ubicación',
      cell: ({ row }) => row.original.location || '-',
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
  ];

  const pageCount = data ? Math.ceil(data.count / pagination.pageSize) : 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Asambleas</h1>
          <p className="mt-1 text-sm text-gray-500">
            Gestiona asambleas y acuerdos de la comunidad
          </p>
        </div>
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
          <option value="scheduled">Programada</option>
          <option value="in_progress">En Curso</option>
          <option value="completed">Completada</option>
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
              router.push(`/governance/assemblies/${data.data[rowIndex].id}`);
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
