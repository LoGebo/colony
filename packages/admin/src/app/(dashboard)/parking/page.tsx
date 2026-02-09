'use client';

export const dynamic = 'force-dynamic';

import { useState, useMemo } from 'react';
import { type ColumnDef } from '@tanstack/react-table';
import { DataTable } from '@/components/ui/DataTable';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import {
  useParkingSpots,
  useParkingReservations,
  useCreateParkingSpot,
  useAssignParkingSpot,
  useUnassignParkingSpot,
  type ParkingSpotRow,
  type ParkingReservationRow,
} from '@/hooks/useParking';
import { useAuth } from '@/hooks/useAuth';
import { useUnits } from '@/hooks/useUnits';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';

/* ------------------------------------------------------------------ */
/*  Status helpers                                                     */
/* ------------------------------------------------------------------ */

const SPOT_TYPE_LABELS: Record<string, string> = {
  assigned: 'Asignado',
  visitor: 'Visitante',
  commercial: 'Comercial',
  disabled: 'Discapacitado',
  loading: 'Carga',
  reserved: 'Reservado',
};

const SPOT_TYPE_VARIANTS: Record<string, 'warning' | 'success' | 'danger' | 'neutral'> = {
  assigned: 'neutral',
  visitor: 'warning',
  commercial: 'success',
  disabled: 'danger',
  loading: 'warning',
  reserved: 'neutral',
};

const STATUS_LABELS: Record<string, string> = {
  available: 'Disponible',
  occupied: 'Ocupado',
  reserved: 'Reservado',
  maintenance: 'Mantenimiento',
  blocked: 'Bloqueado',
};

const STATUS_VARIANTS: Record<string, 'warning' | 'success' | 'danger' | 'neutral'> = {
  available: 'success',
  occupied: 'neutral',
  reserved: 'warning',
  maintenance: 'warning',
  blocked: 'danger',
};

/* ------------------------------------------------------------------ */
/*  Create Spot Form                                                  */
/* ------------------------------------------------------------------ */

function CreateSpotForm({ onClose }: { onClose: () => void }) {
  const createSpot = useCreateParkingSpot();
  const [form, setForm] = useState({
    spot_number: '',
    spot_type: 'assigned',
    floor_level: '',
    zone: '',
    is_covered: false,
    is_handicap: false,
    monthly_rate: '',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.spot_number.trim()) return;
    createSpot.mutate(
      {
        spot_number: form.spot_number.trim(),
        spot_type: form.spot_type,
        floor_level: form.floor_level.trim() || undefined,
        zone: form.zone.trim() || undefined,
        is_covered: form.is_covered,
        is_handicap: form.is_handicap,
        monthly_rate: form.monthly_rate ? parseFloat(form.monthly_rate) : undefined,
      },
      {
        onSuccess: () => {
          onClose();
          setForm({
            spot_number: '',
            spot_type: 'assigned',
            floor_level: '',
            zone: '',
            is_covered: false,
            is_handicap: false,
            monthly_rate: '',
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
        <h3 className="text-lg font-semibold text-gray-900">Nuevo Espacio</h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Numero <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              value={form.spot_number}
              onChange={(e) => setForm({ ...form, spot_number: e.target.value })}
              className={inputClass}
              placeholder="A-101"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Tipo</label>
            <select
              value={form.spot_type}
              onChange={(e) => setForm({ ...form, spot_type: e.target.value })}
              className={inputClass}
            >
              <option value="assigned">Asignado</option>
              <option value="visitor">Visitante</option>
              <option value="commercial">Comercial</option>
              <option value="disabled">Discapacitado</option>
              <option value="loading">Carga</option>
              <option value="reserved">Reservado</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Piso</label>
            <input
              type="text"
              value={form.floor_level}
              onChange={(e) => setForm({ ...form, floor_level: e.target.value })}
              className={inputClass}
              placeholder="Sotano 1, PB, etc."
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Zona</label>
            <input
              type="text"
              value={form.zone}
              onChange={(e) => setForm({ ...form, zone: e.target.value })}
              className={inputClass}
              placeholder="A, B, Norte, etc."
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Cuota Mensual</label>
            <input
              type="number"
              step="0.01"
              value={form.monthly_rate}
              onChange={(e) => setForm({ ...form, monthly_rate: e.target.value })}
              className={inputClass}
              placeholder="0.00"
            />
          </div>
          <div className="flex items-center gap-4 pt-6">
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={form.is_covered}
                onChange={(e) => setForm({ ...form, is_covered: e.target.checked })}
                className="h-4 w-4 rounded border-gray-300 text-indigo-600"
              />
              Techado
            </label>
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={form.is_handicap}
                onChange={(e) => setForm({ ...form, is_handicap: e.target.checked })}
                className="h-4 w-4 rounded border-gray-300 text-indigo-600"
              />
              Discapacitado
            </label>
          </div>
        </div>
        <div className="flex gap-2">
          <Button type="submit" isLoading={createSpot.isPending}>
            Crear Espacio
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
/*  Assignment Form                                                   */
/* ------------------------------------------------------------------ */

function AssignmentForm({
  spotId,
  onClose,
}: {
  spotId: string;
  onClose: () => void;
}) {
  const { communityId } = useAuth();
  const assignSpot = useAssignParkingSpot();
  const { data: unitsData } = useUnits();
  const units = unitsData?.data ?? [];
  const [form, setForm] = useState({
    unit_id: '',
    assignment_type: 'ownership',
    start_date: new Date().toISOString().split('T')[0],
    end_date: '',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.unit_id) return;
    assignSpot.mutate(
      {
        parking_spot_id: spotId,
        unit_id: form.unit_id,
        assignment_type: form.assignment_type,
        start_date: form.start_date,
        end_date: form.end_date || undefined,
      },
      {
        onSuccess: () => {
          onClose();
        },
      }
    );
  };

  const inputClass =
    'w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500';

  return (
    <div className="mt-2 rounded-lg border border-gray-200 bg-gray-50 p-4">
      <form onSubmit={handleSubmit} className="space-y-3">
        <h4 className="text-sm font-semibold text-gray-900">Asignar a Unidad</h4>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
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
            <label className="mb-1 block text-sm font-medium text-gray-700">Tipo</label>
            <select
              value={form.assignment_type}
              onChange={(e) => setForm({ ...form, assignment_type: e.target.value })}
              className={inputClass}
            >
              <option value="ownership">Propiedad</option>
              <option value="rental">Renta</option>
              <option value="temporary">Temporal</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Inicio</label>
            <input
              type="date"
              value={form.start_date}
              onChange={(e) => setForm({ ...form, start_date: e.target.value })}
              className={inputClass}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Fin (opcional)</label>
            <input
              type="date"
              value={form.end_date}
              onChange={(e) => setForm({ ...form, end_date: e.target.value })}
              className={inputClass}
            />
          </div>
        </div>
        <div className="flex gap-2">
          <Button type="submit" isLoading={assignSpot.isPending} size="sm">
            Asignar
          </Button>
          <Button type="button" variant="secondary" size="sm" onClick={onClose}>
            Cancelar
          </Button>
        </div>
      </form>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main Page                                                          */
/* ------------------------------------------------------------------ */

export default function ParkingPage() {
  const [typeFilter, setTypeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [assigningSpotId, setAssigningSpotId] = useState<string | null>(null);

  const { data: spots, isLoading: spotsLoading } = useParkingSpots(
    typeFilter || undefined,
    statusFilter || undefined
  );
  const { data: reservations } = useParkingReservations();
  const unassignSpot = useUnassignParkingSpot();

  const spotColumns = useMemo<ColumnDef<ParkingSpotRow, unknown>[]>(
    () => [
      {
        accessorKey: 'spot_number',
        header: 'Numero',
        cell: ({ row }) => (
          <span className="font-semibold text-gray-900">{row.original.spot_number}</span>
        ),
      },
      {
        accessorKey: 'spot_type',
        header: 'Tipo',
        cell: ({ row }) => (
          <Badge variant={SPOT_TYPE_VARIANTS[row.original.spot_type] ?? 'neutral'}>
            {SPOT_TYPE_LABELS[row.original.spot_type] ?? row.original.spot_type}
          </Badge>
        ),
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
        accessorKey: 'zone',
        header: 'Zona',
        cell: ({ row }) => row.original.zone ?? '-',
      },
      {
        accessorKey: 'floor_level',
        header: 'Piso',
        cell: ({ row }) => row.original.floor_level ?? '-',
      },
      {
        id: 'features',
        header: 'Caracteristicas',
        cell: ({ row }) => (
          <div className="flex gap-2 text-sm">
            {row.original.is_covered && (
              <span className="text-gray-600" title="Techado">🏠</span>
            )}
            {row.original.is_handicap && (
              <span className="text-blue-600" title="Discapacitado">♿</span>
            )}
          </div>
        ),
      },
      {
        id: 'assignment',
        header: 'Asignacion',
        cell: ({ row }) => {
          const assignment = row.original.parking_assignments?.[0];
          if (assignment) {
            return (
              <span className="text-sm text-gray-900">
                {assignment.units?.unit_number ?? 'Unidad desconocida'}
              </span>
            );
          }
          return <span className="text-sm text-gray-400">Sin asignar</span>;
        },
      },
      {
        accessorKey: 'monthly_rate',
        header: 'Cuota',
        cell: ({ row }) =>
          row.original.monthly_rate ? `$${row.original.monthly_rate.toFixed(2)}` : '-',
      },
      {
        id: 'actions',
        header: '',
        cell: ({ row }) => {
          const assignment = row.original.parking_assignments?.[0];
          if (assignment) {
            return (
              <Button
                size="sm"
                variant="secondary"
                onClick={() => {
                  if (
                    confirm(
                      `¿Desasignar estacionamiento ${row.original.spot_number} de ${assignment.units?.unit_number}?`
                    )
                  ) {
                    unassignSpot.mutate({
                      assignmentId: assignment.id,
                      spotId: row.original.id,
                    });
                  }
                }}
              >
                Desasignar
              </Button>
            );
          }
          return (
            <Button
              size="sm"
              onClick={() => setAssigningSpotId(row.original.id)}
            >
              Asignar
            </Button>
          );
        },
      },
    ],
    [unassignSpot]
  );

  const todayReservations = useMemo(() => {
    if (!reservations) return [];
    const now = new Date();
    return reservations.filter((r) => {
      const from = parseISO(r.reserved_from);
      const until = parseISO(r.reserved_until);
      return from <= now && now <= until;
    });
  }, [reservations]);

  const reservationColumns = useMemo<ColumnDef<ParkingReservationRow, unknown>[]>(
    () => [
      {
        accessorKey: 'parking_spots.spot_number',
        header: 'Espacio',
        cell: ({ row }) => row.original.parking_spots?.spot_number ?? '-',
      },
      {
        accessorKey: 'visitor_name',
        header: 'Visitante',
      },
      {
        accessorKey: 'vehicle_plate',
        header: 'Placa',
      },
      {
        accessorKey: 'reserved_from',
        header: 'Desde',
        cell: ({ row }) =>
          format(parseISO(row.original.reserved_from), 'dd/MM HH:mm', { locale: es }),
      },
      {
        accessorKey: 'reserved_until',
        header: 'Hasta',
        cell: ({ row }) =>
          format(parseISO(row.original.reserved_until), 'dd/MM HH:mm', { locale: es }),
      },
      {
        accessorKey: 'status',
        header: 'Estado',
        cell: ({ row }) => (
          <Badge variant={row.original.status === 'completed' ? 'success' : 'warning'}>
            {row.original.status}
          </Badge>
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
          <h1 className="text-2xl font-bold text-gray-900">Estacionamiento</h1>
          {spots && <Badge variant="neutral">{spots.length}</Badge>}
        </div>
        <Button onClick={() => setShowCreateForm(!showCreateForm)}>
          {showCreateForm ? 'Cerrar' : '+ Nuevo Espacio'}
        </Button>
      </div>

      {/* Create form */}
      {showCreateForm && <CreateSpotForm onClose={() => setShowCreateForm(false)} />}

      {/* Filter bar */}
      <div className="flex items-center gap-3">
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
        >
          <option value="">Todos los tipos</option>
          <option value="assigned">Asignado</option>
          <option value="visitor">Visitante</option>
          <option value="commercial">Comercial</option>
          <option value="disabled">Discapacitado</option>
          <option value="loading">Carga</option>
          <option value="reserved">Reservado</option>
        </select>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
        >
          <option value="">Todos los estados</option>
          <option value="available">Disponible</option>
          <option value="occupied">Ocupado</option>
          <option value="reserved">Reservado</option>
          <option value="maintenance">Mantenimiento</option>
          <option value="blocked">Bloqueado</option>
        </select>
      </div>

      {/* Spots table */}
      <Card>
        <h2 className="mb-4 text-lg font-semibold text-gray-900">Inventario</h2>
        <DataTable columns={spotColumns} data={spots ?? []} isLoading={spotsLoading} />
        {assigningSpotId && (
          <AssignmentForm
            spotId={assigningSpotId}
            onClose={() => setAssigningSpotId(null)}
          />
        )}
      </Card>

      {/* Today's reservations */}
      {todayReservations.length > 0 && (
        <Card>
          <h2 className="mb-4 text-lg font-semibold text-gray-900">
            Reservaciones de Hoy ({todayReservations.length})
          </h2>
          <DataTable
            columns={reservationColumns}
            data={todayReservations}
            isLoading={false}
          />
        </Card>
      )}
    </div>
  );
}
