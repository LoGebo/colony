'use client';

export const dynamic = 'force-dynamic';

import { useState, useMemo, useCallback } from 'react';
import { type ColumnDef, type PaginationState } from '@tanstack/react-table';
import { DataTable } from '@/components/ui/DataTable';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import {
  useAccessLogs,
  useAccessPoints,
  useAccessLogsForExport,
  getDefaultDateRange,
  type AccessLogRow,
} from '@/hooks/useAccessLogs';
import { exportToCSV } from '@/lib/export';

/* ------------------------------------------------------------------ */
/*  Label / variant maps                                              */
/* ------------------------------------------------------------------ */

const personTypeLabel: Record<string, string> = {
  resident: 'Residente',
  visitor: 'Visitante',
  provider: 'Proveedor',
  employee: 'Empleado',
  delivery: 'Repartidor',
  other: 'Otro',
};

const personTypeVariant: Record<string, 'success' | 'info' | 'warning' | 'neutral' | 'danger'> = {
  resident: 'success',
  visitor: 'info',
  provider: 'warning',
  employee: 'neutral',
  delivery: 'neutral',
  other: 'neutral',
};

const directionLabel: Record<string, string> = {
  entry: 'Entrada',
  exit: 'Salida',
};

const directionVariant: Record<string, 'success' | 'danger'> = {
  entry: 'success',
  exit: 'danger',
};

const methodLabel: Record<string, string> = {
  qr: 'QR',
  manual: 'Manual',
  plate: 'Placa',
  facial: 'Facial',
  remote: 'Remoto',
};

const decisionVariant: Record<string, 'success' | 'danger'> = {
  allowed: 'success',
  denied: 'danger',
};

/* ------------------------------------------------------------------ */
/*  Date/time formatter                                               */
/* ------------------------------------------------------------------ */

const dateTimeFormatter = new Intl.DateTimeFormat('es-MX', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

function formatDateTime(dateStr: string): string {
  return dateTimeFormatter.format(new Date(dateStr));
}

/* ------------------------------------------------------------------ */
/*  Page component                                                    */
/* ------------------------------------------------------------------ */

export default function AccessLogsPage() {
  const defaults = getDefaultDateRange();
  const [dateFrom, setDateFrom] = useState(defaults.dateFrom);
  const [dateTo, setDateTo] = useState(defaults.dateTo);
  const [accessPointId, setAccessPointId] = useState('');
  const [personType, setPersonType] = useState('');
  const [direction, setDirection] = useState('');
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 20,
  });

  const { data, isLoading } = useAccessLogs({
    dateFrom,
    dateTo,
    accessPointId: accessPointId || undefined,
    personType: personType || undefined,
    direction: direction || undefined,
    page: pagination.pageIndex,
    pageSize: pagination.pageSize,
  });

  const { data: accessPoints } = useAccessPoints();

  const exportFilters = useMemo(
    () => ({
      dateFrom,
      dateTo,
      accessPointId: accessPointId || undefined,
      personType: personType || undefined,
      direction: direction || undefined,
    }),
    [dateFrom, dateTo, accessPointId, personType, direction]
  );
  const { refetch: fetchExportData, isFetching: isExporting } =
    useAccessLogsForExport(exportFilters);

  const handleExport = useCallback(async () => {
    const result = await fetchExportData();
    if (result.data) {
      const rows = result.data.map((log) => ({
        Fecha: formatDateTime(log.logged_at),
        Persona: log.person_name ?? '',
        Tipo: personTypeLabel[log.person_type ?? ''] ?? log.person_type ?? '',
        Acceso: log.access_points?.name ?? '',
        Direccion: directionLabel[log.direction ?? ''] ?? log.direction ?? '',
        Metodo: methodLabel[log.method ?? ''] ?? log.method ?? '',
        Decision: log.decision ?? '',
        'Razon denegacion': log.denial_reason ?? '',
        Placa: log.plate_number ?? '',
        'Notas guardia': log.guard_notes ?? '',
      }));
      exportToCSV(rows, `accesos-${dateFrom}-${dateTo}`);
    }
  }, [fetchExportData, dateFrom, dateTo]);

  const resetPagination = useCallback(() => {
    setPagination((prev) => ({ ...prev, pageIndex: 0 }));
  }, []);

  const columns = useMemo<ColumnDef<AccessLogRow, unknown>[]>(
    () => [
      {
        accessorKey: 'logged_at',
        header: 'Fecha/Hora',
        cell: ({ row }) => (
          <span className="text-sm text-gray-600">
            {formatDateTime(row.original.logged_at)}
          </span>
        ),
      },
      {
        accessorKey: 'person_name',
        header: 'Persona',
        cell: ({ row }) => row.original.person_name ?? '-',
      },
      {
        accessorKey: 'person_type',
        header: 'Tipo',
        cell: ({ row }) => {
          const pt = row.original.person_type;
          return pt ? (
            <Badge variant={personTypeVariant[pt] ?? 'neutral'}>
              {personTypeLabel[pt] ?? pt}
            </Badge>
          ) : (
            '-'
          );
        },
      },
      {
        id: 'access_point',
        header: 'Acceso',
        cell: ({ row }) => row.original.access_points?.name ?? '-',
      },
      {
        accessorKey: 'direction',
        header: 'Direccion',
        cell: ({ row }) => {
          const dir = row.original.direction;
          return dir ? (
            <Badge variant={directionVariant[dir] ?? 'neutral'}>
              {directionLabel[dir] ?? dir}
            </Badge>
          ) : (
            '-'
          );
        },
      },
      {
        accessorKey: 'method',
        header: 'Metodo',
        cell: ({ row }) => {
          const m = row.original.method;
          return m ? (
            <Badge variant="info">{methodLabel[m] ?? m}</Badge>
          ) : (
            '-'
          );
        },
      },
      {
        accessorKey: 'decision',
        header: 'Decision',
        cell: ({ row }) => {
          const d = row.original.decision;
          return d ? (
            <Badge variant={decisionVariant[d] ?? 'neutral'}>
              {d === 'allowed' ? 'Permitido' : d === 'denied' ? 'Denegado' : d}
            </Badge>
          ) : (
            '-'
          );
        },
      },
      {
        accessorKey: 'denial_reason',
        header: 'Razon',
        cell: ({ row }) => (
          <span className="text-xs text-gray-500">
            {row.original.denial_reason ?? '-'}
          </span>
        ),
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
          <h1 className="text-2xl font-bold text-gray-900">Registro de Accesos</h1>
          {data?.count != null && (
            <Badge variant="neutral">{data.count}</Badge>
          )}
        </div>
        <Button
          variant="secondary"
          onClick={handleExport}
          isLoading={isExporting}
          disabled={isExporting}
        >
          Exportar CSV
        </Button>
      </div>

      {/* Filter bar */}
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-600">Desde</label>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => {
              setDateFrom(e.target.value);
              resetPagination();
            }}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-600">Hasta</label>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => {
              setDateTo(e.target.value);
              resetPagination();
            }}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-600">Acceso</label>
          <select
            value={accessPointId}
            onChange={(e) => {
              setAccessPointId(e.target.value);
              resetPagination();
            }}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          >
            <option value="">Todos</option>
            {accessPoints?.map((ap) => (
              <option key={ap.id} value={ap.id}>
                {ap.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-600">Tipo persona</label>
          <select
            value={personType}
            onChange={(e) => {
              setPersonType(e.target.value);
              resetPagination();
            }}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          >
            <option value="">Todos</option>
            <option value="resident">Residente</option>
            <option value="visitor">Visitante</option>
            <option value="provider">Proveedor</option>
            <option value="employee">Empleado</option>
            <option value="delivery">Repartidor</option>
            <option value="other">Otro</option>
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-600">Direccion</label>
          <select
            value={direction}
            onChange={(e) => {
              setDirection(e.target.value);
              resetPagination();
            }}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          >
            <option value="">Todos</option>
            <option value="entry">Entrada</option>
            <option value="exit">Salida</option>
          </select>
        </div>
      </div>

      {/* Data table */}
      <DataTable
        columns={columns}
        data={data?.data ?? []}
        pageCount={pageCount}
        pagination={pagination}
        onPaginationChange={setPagination}
        isLoading={isLoading}
      />
    </div>
  );
}
