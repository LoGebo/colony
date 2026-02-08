'use client';

export const dynamic = 'force-dynamic';

import { useState, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { type ColumnDef, type PaginationState } from '@tanstack/react-table';
import { DataTable } from '@/components/ui/DataTable';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { TicketStatusBadge } from '@/components/tickets/TicketStatusBadge';
import { TicketKanbanBoard } from '@/components/tickets/TicketKanbanBoard';
import { TicketSLAIndicator } from '@/components/tickets/TicketSLAIndicator';
import { useTickets, computeSLAMetrics, type TicketRow } from '@/hooks/useTickets';
import { formatDate } from '@/lib/formatters';

const priorityVariant: Record<string, 'danger' | 'warning' | 'info' | 'neutral'> = {
  urgent: 'danger',
  high: 'danger',
  medium: 'warning',
  low: 'neutral',
};

const priorityLabel: Record<string, string> = {
  urgent: 'Urgente',
  high: 'Alta',
  medium: 'Media',
  low: 'Baja',
};

function formatMinutes(mins: number): string {
  if (mins < 1) return '0m';
  if (mins < 60) return `${Math.round(mins)}m`;
  const hours = Math.floor(mins / 60);
  const remaining = Math.round(mins % 60);
  if (hours < 24) return `${hours}h ${remaining}m`;
  const days = Math.floor(hours / 24);
  const remHours = hours % 24;
  return `${days}d ${remHours}h`;
}

export default function TicketsPage() {
  const router = useRouter();

  // View toggle
  const [viewMode, setViewMode] = useState<'table' | 'kanban'>('table');

  // Filters
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 20,
  });

  const { data, isLoading } = useTickets({
    search: debouncedSearch || undefined,
    status: statusFilter || undefined,
    priority: priorityFilter || undefined,
    page: pagination.pageIndex,
    pageSize: pagination.pageSize,
  });

  // Debounced search
  const handleSearchChange = useCallback((value: string) => {
    setSearch(value);
    const timeout = setTimeout(() => {
      setDebouncedSearch(value);
      setPagination((prev) => ({ ...prev, pageIndex: 0 }));
    }, 300);
    return () => clearTimeout(timeout);
  }, []);

  // SLA metrics computed from current page data
  const slaMetrics = useMemo(
    () => computeSLAMetrics(data?.data ?? []),
    [data?.data]
  );

  const columns = useMemo<ColumnDef<TicketRow, unknown>[]>(
    () => [
      {
        accessorKey: 'id',
        header: 'ID',
        cell: ({ row }) => (
          <span className="font-mono text-xs text-gray-500">
            {row.original.id.slice(0, 8)}
          </span>
        ),
      },
      {
        accessorKey: 'title',
        header: 'Titulo',
        cell: ({ row }) => (
          <Link
            href={`/operations/tickets/${row.original.id}`}
            className="font-medium text-indigo-600 hover:text-indigo-800"
          >
            {row.original.title}
          </Link>
        ),
      },
      {
        id: 'category',
        header: 'Categoria',
        cell: ({ row }) => (
          <span className="text-sm text-gray-600">
            {row.original.ticket_categories?.name ?? '-'}
          </span>
        ),
      },
      {
        accessorKey: 'status',
        header: 'Estado',
        cell: ({ row }) => <TicketStatusBadge status={row.original.status} />,
      },
      {
        accessorKey: 'priority',
        header: 'Prioridad',
        cell: ({ row }) => (
          <Badge variant={priorityVariant[row.original.priority] ?? 'neutral'}>
            {priorityLabel[row.original.priority] ?? row.original.priority}
          </Badge>
        ),
      },
      {
        id: 'reporter',
        header: 'Reportante',
        cell: ({ row }) => {
          const r = row.original.residents;
          return r ? `${r.first_name} ${r.paternal_surname}` : '-';
        },
      },
      {
        id: 'sla',
        header: 'SLA',
        cell: ({ row }) => (
          <TicketSLAIndicator
            responseDueAt={row.original.response_due_at}
            resolutionDueAt={row.original.resolution_due_at}
            responseBreached={row.original.response_breached}
            resolutionBreached={row.original.resolution_breached}
            firstRespondedAt={row.original.first_responded_at}
            resolvedAt={row.original.resolved_at}
          />
        ),
      },
      {
        accessorKey: 'created_at',
        header: 'Creado',
        cell: ({ row }) => formatDate(row.original.created_at),
      },
    ],
    []
  );

  const pageCount = Math.ceil((data?.count ?? 0) / pagination.pageSize);

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-gray-900">
            Tickets de Mantenimiento
          </h1>
          {data?.count != null && (
            <Badge variant="neutral">{data.count}</Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant={viewMode === 'table' ? 'primary' : 'secondary'}
            size="sm"
            onClick={() => setViewMode('table')}
          >
            Tabla
          </Button>
          <Button
            variant={viewMode === 'kanban' ? 'primary' : 'secondary'}
            size="sm"
            onClick={() => setViewMode('kanban')}
          >
            Kanban
          </Button>
        </div>
      </div>

      {/* SLA summary cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <p className="text-sm text-gray-500">Total tickets</p>
          <p className="mt-1 text-2xl font-bold text-gray-900">
            {slaMetrics.total}
          </p>
          <p className="mt-1 text-xs text-gray-400">
            {slaMetrics.openCount} abiertos
          </p>
        </Card>
        <Card>
          <p className="text-sm text-gray-500">Tiempo resp. promedio</p>
          <p className="mt-1 text-2xl font-bold text-gray-900">
            {formatMinutes(slaMetrics.avgResponseMinutes)}
          </p>
        </Card>
        <Card>
          <p className="text-sm text-gray-500">Tiempo resol. promedio</p>
          <p className="mt-1 text-2xl font-bold text-gray-900">
            {formatMinutes(slaMetrics.avgResolutionMinutes)}
          </p>
        </Card>
        <Card>
          <p className="text-sm text-gray-500">Tasa de incumplimiento</p>
          <p className="mt-1 text-2xl font-bold text-gray-900">
            {slaMetrics.responseBreachRate.toFixed(1)}%
          </p>
          <p className="mt-1 text-xs text-gray-400">
            Resolucion: {slaMetrics.resolutionBreachRate.toFixed(1)}%
          </p>
        </Card>
      </div>

      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-3">
        <input
          type="text"
          value={search}
          onChange={(e) => handleSearchChange(e.target.value)}
          placeholder="Buscar por titulo o descripcion..."
          className="w-full max-w-xs rounded-lg border border-gray-300 px-4 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
        />
        <select
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value);
            setPagination((prev) => ({ ...prev, pageIndex: 0 }));
          }}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
        >
          <option value="">Todos los estados</option>
          <option value="open">Abierto</option>
          <option value="assigned">Asignado</option>
          <option value="in_progress">En progreso</option>
          <option value="pending_parts">Pend. refacciones</option>
          <option value="pending_resident">Pend. residente</option>
          <option value="resolved">Resuelto</option>
          <option value="closed">Cerrado</option>
          <option value="cancelled">Cancelado</option>
        </select>
        <select
          value={priorityFilter}
          onChange={(e) => {
            setPriorityFilter(e.target.value);
            setPagination((prev) => ({ ...prev, pageIndex: 0 }));
          }}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
        >
          <option value="">Todas las prioridades</option>
          <option value="low">Baja</option>
          <option value="medium">Media</option>
          <option value="high">Alta</option>
          <option value="urgent">Urgente</option>
        </select>
      </div>

      {/* Table or Kanban view */}
      {viewMode === 'table' ? (
        <DataTable
          columns={columns}
          data={data?.data ?? []}
          pageCount={pageCount}
          pagination={pagination}
          onPaginationChange={setPagination}
          isLoading={isLoading}
        />
      ) : (
        isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div
                key={i}
                className="h-24 animate-pulse rounded bg-gray-100"
              />
            ))}
          </div>
        ) : (
          <TicketKanbanBoard
            tickets={data?.data ?? []}
            onTicketClick={(id) => router.push(`/operations/tickets/${id}`)}
          />
        )
      )}
    </div>
  );
}
