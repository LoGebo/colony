'use client';

export const dynamic = 'force-dynamic';

import { useState, useMemo } from 'react';
import { type ColumnDef } from '@tanstack/react-table';
import { DataTable } from '@/components/ui/DataTable';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import {
  useParkingViolations,
  useUpdateParkingViolation,
  type ParkingViolationRow,
} from '@/hooks/useParking';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';

/* ------------------------------------------------------------------ */
/*  Status helpers                                                     */
/* ------------------------------------------------------------------ */

const VIOLATION_TYPE_LABELS: Record<string, string> = {
  unauthorized_parking: 'Estacionamiento no autorizado',
  double_parking: 'Doble fila',
  blocking: 'Bloqueo',
  overstay: 'Tiempo excedido',
  wrong_spot: 'Lugar incorrecto',
  other: 'Otro',
};

const STATUS_LABELS: Record<string, string> = {
  reported: 'Reportado',
  warned: 'Advertido',
  fined: 'Multado',
  resolved: 'Resuelto',
  dismissed: 'Descartado',
};

const STATUS_VARIANTS: Record<string, 'warning' | 'success' | 'danger' | 'neutral'> = {
  reported: 'warning',
  warned: 'warning',
  fined: 'danger',
  resolved: 'success',
  dismissed: 'neutral',
};

/* ------------------------------------------------------------------ */
/*  Main Page                                                          */
/* ------------------------------------------------------------------ */

export default function ViolationsPage() {
  const [statusFilter, setStatusFilter] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ status: '' });

  const { data: violations, isLoading } = useParkingViolations(statusFilter || undefined);
  const updateViolation = useUpdateParkingViolation();

  const handleEdit = (violation: ParkingViolationRow) => {
    setEditingId(violation.id);
    setEditForm({
      status: violation.status,
    });
  };

  const handleSave = (id: string) => {
    const updates: { status?: string } = {};
    if (editForm.status) updates.status = editForm.status;

    updateViolation.mutate(
      { id, ...updates },
      {
        onSuccess: () => {
          setEditingId(null);
        },
      }
    );
  };

  const columns = useMemo<ColumnDef<ParkingViolationRow, unknown>[]>(
    () => [
      {
        accessorKey: 'observed_at',
        header: 'Fecha',
        cell: ({ row }) =>
          format(parseISO(row.original.observed_at), 'dd/MM/yyyy HH:mm', { locale: es }),
      },
      {
        accessorKey: 'violation_type',
        header: 'Tipo',
        cell: ({ row }) =>
          VIOLATION_TYPE_LABELS[row.original.violation_type] ?? row.original.violation_type,
      },
      {
        accessorKey: 'description',
        header: 'Descripcion',
        cell: ({ row }) => (
          <span className="max-w-xs truncate text-sm text-gray-600">
            {row.original.description ?? '-'}
          </span>
        ),
      },
      {
        accessorKey: 'parking_spots.spot_number',
        header: 'Espacio',
        cell: ({ row }) => row.original.parking_spots?.spot_number ?? '-',
      },
      {
        accessorKey: 'vehicle_plates',
        header: 'Placa',
        cell: ({ row }) => (
          <span className="font-mono text-sm">{row.original.vehicle_plates ?? '-'}</span>
        ),
      },
      {
        accessorKey: 'status',
        header: 'Estado',
        cell: ({ row }) => {
          if (editingId === row.original.id) {
            return (
              <select
                value={editForm.status}
                onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}
                className="rounded border border-gray-300 px-2 py-1 text-sm"
              >
                <option value="reported">Reportado</option>
                <option value="warned">Advertido</option>
                <option value="fined">Multado</option>
                <option value="resolved">Resuelto</option>
                <option value="dismissed">Descartado</option>
              </select>
            );
          }
          return (
            <Badge variant={STATUS_VARIANTS[row.original.status] ?? 'neutral'}>
              {STATUS_LABELS[row.original.status] ?? row.original.status}
            </Badge>
          );
        },
      },
      {
        id: 'actions',
        header: '',
        cell: ({ row }) => {
          if (editingId === row.original.id) {
            return (
              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={() => handleSave(row.original.id)}
                  isLoading={updateViolation.isPending}
                >
                  Guardar
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => setEditingId(null)}
                >
                  Cancelar
                </Button>
              </div>
            );
          }
          return (
            <Button size="sm" variant="secondary" onClick={() => handleEdit(row.original)}>
              Editar
            </Button>
          );
        },
      },
    ],
    [editingId, editForm, updateViolation]
  );

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-gray-900">Infracciones de Estacionamiento</h1>
          {violations && <Badge variant="neutral">{violations.length}</Badge>}
        </div>
      </div>

      {/* Filter bar */}
      <div className="flex items-center gap-3">
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
        >
          <option value="">Todos los estados</option>
          <option value="reported">Reportado</option>
          <option value="warned">Advertido</option>
          <option value="fined">Multado</option>
          <option value="resolved">Resuelto</option>
          <option value="dismissed">Descartado</option>
        </select>
      </div>

      {/* DataTable */}
      <DataTable columns={columns} data={violations ?? []} isLoading={isLoading} />
    </div>
  );
}
