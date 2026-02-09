'use client';

import { useState } from 'react';
import { type ColumnDef, type PaginationState } from '@tanstack/react-table';
import { useAuditLogs, useAuditLogsForExport, type AuditLogEntry } from '@/hooks/useAnalytics';
import { DataTable } from '@/components/ui/DataTable';
import { Badge } from '@/components/ui/Badge';
import { exportToCSV } from '@/lib/export';

export const dynamic = 'force-dynamic';

/**
 * Audit trail viewer showing recent administrative actions across
 * governance tables. Supports filtering and CSV export.
 */
export default function AuditTrailPage() {
  // Default to last 30 days
  const today = new Date();
  const thirtyDaysAgo = new Date(today);
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const fmt = (d: Date) => d.toISOString().split('T')[0];

  const [dateFrom, setDateFrom] = useState(fmt(thirtyDaysAgo));
  const [dateTo, setDateTo] = useState(fmt(today));
  const [action, setAction] = useState('');
  const [entityType, setEntityType] = useState('');

  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 20,
  });

  const { data, isLoading } = useAuditLogs({
    dateFrom,
    dateTo,
    action: action || undefined,
    entity_type: entityType || undefined,
    page: pagination.pageIndex,
    pageSize: pagination.pageSize,
  });

  const exportQuery = useAuditLogsForExport({
    dateFrom,
    dateTo,
    action: action || undefined,
    entity_type: entityType || undefined,
  });

  const handleExport = async () => {
    const result = await exportQuery.refetch();
    if (!result.data) {
      alert('No hay datos para exportar');
      return;
    }

    const rows = result.data.map((entry) => ({
      Fecha: new Date(entry.timestamp).toLocaleString('es-MX'),
      Accion: entry.action,
      Tipo: translateEntityType(entry.entity_type),
      Entidad: entry.entity_name,
      ID: entry.id.slice(0, 8),
    }));

    exportToCSV(rows, `auditoria-${dateFrom}-${dateTo}`);
  };

  const columns: ColumnDef<AuditLogEntry>[] = [
    {
      accessorKey: 'timestamp',
      header: 'Fecha/Hora',
      cell: ({ row }) => (
        <span className="text-sm text-gray-900">
          {new Date(row.original.timestamp).toLocaleString('es-MX', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          })}
        </span>
      ),
    },
    {
      accessorKey: 'action',
      header: 'Accion',
      cell: ({ row }) => (
        <Badge variant={row.original.action === 'Creado' ? 'success' : 'info'}>
          {row.original.action}
        </Badge>
      ),
    },
    {
      accessorKey: 'entity_type',
      header: 'Tipo',
      cell: ({ row }) => (
        <span className="text-sm text-gray-700">
          {translateEntityType(row.original.entity_type)}
        </span>
      ),
    },
    {
      accessorKey: 'entity_name',
      header: 'Entidad',
      cell: ({ row }) => (
        <span className="max-w-xs truncate text-sm font-medium text-gray-900">
          {row.original.entity_name}
        </span>
      ),
    },
    {
      accessorKey: 'id',
      header: 'ID',
      cell: ({ row }) => (
        <span className="font-mono text-xs text-gray-500">{row.original.id.slice(0, 8)}</span>
      ),
    },
  ];

  const pageCount = data ? Math.ceil(data.count / pagination.pageSize) : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Registro de Auditoria</h1>
          <p className="mt-1 text-sm text-gray-500">
            Historial de acciones administrativas en el sistema
          </p>
        </div>

        <button
          onClick={handleExport}
          disabled={exportQuery.isFetching}
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50"
        >
          {exportQuery.isFetching ? 'Exportando...' : 'Exportar CSV'}
        </button>
      </div>

      {/* Filters */}
      <div className="grid grid-cols-1 gap-4 rounded-lg border border-gray-200 bg-white p-4 sm:grid-cols-4">
        <div>
          <label htmlFor="dateFrom" className="block text-xs font-medium text-gray-700">
            Desde
          </label>
          <input
            type="date"
            id="dateFrom"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
        </div>

        <div>
          <label htmlFor="dateTo" className="block text-xs font-medium text-gray-700">
            Hasta
          </label>
          <input
            type="date"
            id="dateTo"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
        </div>

        <div>
          <label htmlFor="action" className="block text-xs font-medium text-gray-700">
            Accion
          </label>
          <select
            id="action"
            value={action}
            onChange={(e) => setAction(e.target.value)}
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          >
            <option value="">Todas</option>
            <option value="Creado">Creado</option>
            <option value="Actualizado">Actualizado</option>
          </select>
        </div>

        <div>
          <label htmlFor="entityType" className="block text-xs font-medium text-gray-700">
            Tipo de Entidad
          </label>
          <select
            id="entityType"
            value={entityType}
            onChange={(e) => setEntityType(e.target.value)}
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          >
            <option value="">Todos</option>
            <option value="elections">Elecciones</option>
            <option value="assemblies">Asambleas</option>
            <option value="violations">Infracciones</option>
            <option value="announcements">Avisos</option>
            <option value="tickets">Tickets</option>
          </select>
        </div>
      </div>

      {/* Data Table */}
      {data && data.data.length === 0 && !isLoading ? (
        <div className="flex min-h-[400px] items-center justify-center rounded-lg border border-gray-200 bg-white text-sm text-gray-500">
          No se encontraron registros de auditoria para los filtros seleccionados
        </div>
      ) : (
        <DataTable
          columns={columns}
          data={data?.data ?? []}
          pageCount={pageCount}
          pagination={pagination}
          onPaginationChange={setPagination}
          isLoading={isLoading}
        />
      )}
    </div>
  );
}

/**
 * Translate entity type enum to Spanish display name.
 */
function translateEntityType(type: string): string {
  const translations: Record<string, string> = {
    elections: 'Elecciones',
    assemblies: 'Asambleas',
    violations: 'Infracciones',
    announcements: 'Avisos',
    tickets: 'Tickets',
  };
  return translations[type] ?? type;
}
