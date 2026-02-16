'use client';

export const dynamic = 'force-dynamic';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { type ColumnDef } from '@tanstack/react-table';
import { DataTable } from '@/components/ui/DataTable';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import {
  useMoveList,
  useCreateMove,
  type MoveRequestRow,
} from '@/hooks/useMoves';
import { useAuth } from '@/hooks/useAuth';
import { useUnits } from '@/hooks/useUnits';
import { useResidents } from '@/hooks/useResidents';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';

/* ------------------------------------------------------------------ */
/*  Status helpers                                                     */
/* ------------------------------------------------------------------ */

const MOVE_TYPE_LABELS: Record<string, string> = {
  move_in: 'Entrada',
  move_out: 'Salida',
};

const MOVE_TYPE_VARIANTS: Record<string, 'success' | 'warning'> = {
  move_in: 'success',
  move_out: 'warning',
};

const STATUS_LABELS: Record<string, string> = {
  requested: 'Solicitado',
  validating: 'Validando',
  validation_failed: 'Validacion fallida',
  approved: 'Aprobado',
  scheduled: 'Programado',
  in_progress: 'En progreso',
  completed: 'Completado',
  cancelled: 'Cancelado',
};

const STATUS_VARIANTS: Record<string, 'warning' | 'success' | 'danger' | 'neutral'> = {
  requested: 'warning',
  validating: 'warning',
  validation_failed: 'danger',
  approved: 'success',
  scheduled: 'success',
  in_progress: 'warning',
  completed: 'success',
  cancelled: 'neutral',
};

/* ------------------------------------------------------------------ */
/*  Create Move Form                                                  */
/* ------------------------------------------------------------------ */

function CreateMoveForm({ onClose }: { onClose: () => void }) {
  const createMove = useCreateMove();
  const { data: unitsData } = useUnits();
  const { data: residentsData } = useResidents();
  const units = unitsData?.data ?? [];
  const residents = residentsData?.data ?? [];
  const [form, setForm] = useState({
    move_type: 'move_in',
    unit_id: '',
    resident_id: '',
    requested_date: new Date().toISOString().split('T')[0],
    moving_company_name: '',
    moving_company_phone: '',
    resident_notes: '',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.unit_id || !form.resident_id) return;
    createMove.mutate(
      {
        move_type: form.move_type,
        unit_id: form.unit_id,
        resident_id: form.resident_id,
        requested_date: form.requested_date,
        moving_company_name: form.moving_company_name.trim() || undefined,
        moving_company_phone: form.moving_company_phone.trim() || undefined,
        resident_notes: form.resident_notes.trim() || undefined,
      },
      {
        onSuccess: () => {
          onClose();
          setForm({
            move_type: 'move_in',
            unit_id: '',
            resident_id: '',
            requested_date: new Date().toISOString().split('T')[0],
            moving_company_name: '',
            moving_company_phone: '',
            resident_notes: '',
          });
        },
      }
    );
  };

  const inputClass =
    'w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500';

  return (
    <Card className="mt-4">
      <form onSubmit={handleSubmit} className="space-y-4">
        <h3 className="text-lg font-semibold text-gray-900">Nueva Mudanza</h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Tipo <span className="text-red-500">*</span>
            </label>
            <div className="flex gap-4">
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  value="move_in"
                  checked={form.move_type === 'move_in'}
                  onChange={(e) => setForm({ ...form, move_type: e.target.value })}
                  className="h-4 w-4 text-indigo-600"
                />
                <span className="text-sm">Entrada</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  value="move_out"
                  checked={form.move_type === 'move_out'}
                  onChange={(e) => setForm({ ...form, move_type: e.target.value })}
                  className="h-4 w-4 text-indigo-600"
                />
                <span className="text-sm">Salida</span>
              </label>
            </div>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Unidad <span className="text-red-500">*</span>
            </label>
            <select
              required
              value={form.unit_id}
              onChange={(e) => setForm({ ...form, unit_id: e.target.value })}
              className={inputClass}
            >
              <option value="">Seleccionar...</option>
              {units?.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.unit_number}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Residente <span className="text-red-500">*</span>
            </label>
            <select
              required
              value={form.resident_id}
              onChange={(e) => setForm({ ...form, resident_id: e.target.value })}
              className={inputClass}
            >
              <option value="">Seleccionar...</option>
              {residents?.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.first_name} {r.paternal_surname}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Fecha Programada <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              required
              value={form.requested_date}
              onChange={(e) => setForm({ ...form, requested_date: e.target.value })}
              className={inputClass}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Empresa de Mudanza</label>
            <input
              type="text"
              value={form.moving_company_name}
              onChange={(e) => setForm({ ...form, moving_company_name: e.target.value })}
              className={inputClass}
              placeholder="Nombre de la empresa"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Telefono de Contacto</label>
            <input
              type="tel"
              value={form.moving_company_phone}
              onChange={(e) => setForm({ ...form, moving_company_phone: e.target.value })}
              className={inputClass}
              placeholder="+52 ..."
            />
          </div>
          <div className="sm:col-span-2 lg:col-span-3">
            <label className="mb-1 block text-sm font-medium text-gray-700">Notas</label>
            <textarea
              value={form.resident_notes}
              onChange={(e) => setForm({ ...form, resident_notes: e.target.value })}
              className={inputClass}
              rows={2}
              placeholder="Notas adicionales..."
            />
          </div>
        </div>
        <div className="flex gap-2">
          <Button type="submit" isLoading={createMove.isPending}>
            Crear Mudanza
          </Button>
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
        </div>
      </form>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/*  Main Page                                                          */
/* ------------------------------------------------------------------ */

export default function MovesPage() {
  const [statusFilter, setStatusFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [showCreateForm, setShowCreateForm] = useState(false);

  const { data: moves, isLoading } = useMoveList(
    statusFilter || undefined,
    typeFilter || undefined
  );

  const columns = useMemo<ColumnDef<MoveRequestRow, unknown>[]>(
    () => [
      {
        accessorKey: 'move_type',
        header: 'Tipo',
        cell: ({ row }) => (
          <Badge variant={MOVE_TYPE_VARIANTS[row.original.move_type] ?? 'neutral'}>
            {MOVE_TYPE_LABELS[row.original.move_type] ?? row.original.move_type}
          </Badge>
        ),
      },
      {
        accessorKey: 'units.unit_number',
        header: 'Unidad',
        cell: ({ row }) => (
          <span className="font-semibold text-gray-900">
            {row.original.units?.unit_number ?? '-'}
          </span>
        ),
      },
      {
        accessorKey: 'residents',
        header: 'Residente',
        cell: ({ row }) => {
          const r = row.original.residents;
          return r ? `${r.first_name} ${r.paternal_surname}` : '-';
        },
      },
      {
        accessorKey: 'status',
        header: 'Estado',
        cell: ({ row }) => (
          <Badge variant={STATUS_VARIANTS[row.original.status] ?? 'neutral'}>
            {STATUS_LABELS[row.original.status] ?? row.original.status}
          </Badge>
        ),
      },
      {
        accessorKey: 'requested_date',
        header: 'Fecha',
        cell: ({ row }) =>
          format(parseISO(row.original.requested_date), 'dd/MM/yyyy', { locale: es }),
      },
      {
        accessorKey: 'moving_company_name',
        header: 'Empresa',
        cell: ({ row }) => (
          <span className="text-sm text-gray-600">
            {row.original.moving_company_name ?? '-'}
          </span>
        ),
      },
      {
        id: 'validations',
        header: 'Validaciones',
        cell: ({ row }) =>
          row.original.all_validations_passed ? (
            <span className="text-green-600" title="Todas aprobadas">
              ✓
            </span>
          ) : (
            <span className="text-red-600" title="Pendientes o rechazadas">
              ✗
            </span>
          ),
      },
      {
        accessorKey: 'created_at',
        header: 'Creado',
        cell: ({ row }) =>
          format(parseISO(row.original.created_at), 'dd/MM/yyyy', { locale: es }),
      },
      {
        id: 'actions',
        header: '',
        cell: ({ row }) => (
          <Link
            href={`/moves/${row.original.id}`}
            className="text-sm text-indigo-600 hover:text-indigo-800"
          >
            Ver
          </Link>
        ),
      },
    ],
    []
  );

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-gray-900">Mudanzas</h1>
          {moves && <Badge variant="neutral">{moves.length}</Badge>}
        </div>
        <Button onClick={() => setShowCreateForm(!showCreateForm)}>
          {showCreateForm ? 'Cerrar' : '+ Nueva Mudanza'}
        </Button>
      </div>

      {/* Create form */}
      {showCreateForm && <CreateMoveForm onClose={() => setShowCreateForm(false)} />}

      {/* Filter bar */}
      <div className="flex items-center gap-3">
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
        >
          <option value="">Todos los tipos</option>
          <option value="move_in">Entrada</option>
          <option value="move_out">Salida</option>
        </select>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
        >
          <option value="">Todos los estados</option>
          <option value="requested">Solicitado</option>
          <option value="validating">Validando</option>
          <option value="validation_failed">Validacion fallida</option>
          <option value="approved">Aprobado</option>
          <option value="scheduled">Programado</option>
          <option value="in_progress">En progreso</option>
          <option value="completed">Completado</option>
          <option value="cancelled">Cancelado</option>
        </select>
      </div>

      {/* DataTable */}
      <DataTable columns={columns} data={moves ?? []} isLoading={isLoading} />
    </div>
  );
}
