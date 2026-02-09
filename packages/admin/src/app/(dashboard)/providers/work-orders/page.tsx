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
  useWorkOrderList,
  useCreateWorkOrder,
  type WorkOrderRow,
} from '@/hooks/useWorkOrders';
import { useProviderList } from '@/hooks/useProviders';
import { useUnitOptions } from '@/hooks/useUnits';
import { useAuth } from '@/hooks/useAuth';
import { formatDate, formatCurrency } from '@/lib/formatters';

/* ------------------------------------------------------------------ */
/*  Status helpers                                                     */
/* ------------------------------------------------------------------ */

const STATUS_LABELS: Record<string, string> = {
  draft: 'Borrador',
  submitted: 'Enviada',
  approved: 'Aprobada',
  scheduled: 'Programada',
  in_progress: 'En Progreso',
  completed: 'Completada',
  cancelled: 'Cancelada',
};

const STATUS_VARIANTS: Record<string, 'warning' | 'success' | 'danger' | 'neutral' | 'info'> = {
  draft: 'neutral',
  submitted: 'warning',
  approved: 'info',
  scheduled: 'info',
  in_progress: 'warning',
  completed: 'success',
  cancelled: 'danger',
};

function StarRating({ rating }: { rating: number | null }) {
  if (rating == null) return <span className="text-sm text-gray-400">-</span>;
  return (
    <span className="text-sm text-yellow-500" title={`${rating}/5`}>
      {'★'.repeat(rating)}{'☆'.repeat(5 - rating)}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/*  Create Work Order Form                                             */
/* ------------------------------------------------------------------ */

function CreateWorkOrderForm({ onClose }: { onClose: () => void }) {
  const { communityId } = useAuth();
  const createWorkOrder = useCreateWorkOrder();
  const { data: activeProviders } = useProviderList(communityId, 'active');
  const { data: unitOptions } = useUnitOptions();
  const [form, setForm] = useState({
    provider_id: '',
    title: '',
    description: '',
    category: '',
    unit_id: '',
    requested_date: '',
    estimated_cost: '',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.provider_id || !form.title.trim() || !form.description.trim()) return;
    createWorkOrder.mutate(
      {
        provider_id: form.provider_id,
        title: form.title.trim(),
        description: form.description.trim(),
        category: form.category.trim() || undefined,
        unit_id: form.unit_id || undefined,
        requested_date: form.requested_date || undefined,
        estimated_cost: form.estimated_cost ? parseFloat(form.estimated_cost) : undefined,
      },
      {
        onSuccess: () => {
          onClose();
          setForm({
            provider_id: '',
            title: '',
            description: '',
            category: '',
            unit_id: '',
            requested_date: '',
            estimated_cost: '',
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
        <h3 className="text-lg font-semibold text-gray-900">Nueva Orden de Trabajo</h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Proveedor <span className="text-red-500">*</span>
            </label>
            <select
              required
              value={form.provider_id}
              onChange={(e) => setForm({ ...form, provider_id: e.target.value })}
              className={inputClass}
            >
              <option value="">Seleccionar proveedor...</option>
              {activeProviders?.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.company_name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Titulo <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              className={inputClass}
              placeholder="Titulo de la orden"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Categoria</label>
            <input
              type="text"
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
              className={inputClass}
              placeholder="Plomeria, electricidad, etc."
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Unidad</label>
            <select
              value={form.unit_id}
              onChange={(e) => setForm({ ...form, unit_id: e.target.value })}
              className={inputClass}
            >
              <option value="">Sin unidad especifica</option>
              {unitOptions?.map((u) => (
                <option key={u.value} value={u.value}>
                  {u.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Fecha solicitada</label>
            <input
              type="date"
              value={form.requested_date}
              onChange={(e) => setForm({ ...form, requested_date: e.target.value })}
              className={inputClass}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Costo estimado (MXN)</label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={form.estimated_cost}
              onChange={(e) => setForm({ ...form, estimated_cost: e.target.value })}
              className={inputClass}
              placeholder="0.00"
            />
          </div>
          <div className="sm:col-span-2 lg:col-span-3">
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Descripcion <span className="text-red-500">*</span>
            </label>
            <textarea
              required
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              className={inputClass}
              rows={3}
              placeholder="Describe el trabajo requerido..."
            />
          </div>
        </div>
        <div className="flex gap-2">
          <Button type="submit" isLoading={createWorkOrder.isPending}>
            Crear Orden
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

export default function WorkOrdersPage() {
  const { communityId } = useAuth();
  const [statusFilter, setStatusFilter] = useState('');
  const [showCreateForm, setShowCreateForm] = useState(false);

  const { data: workOrders, isLoading } = useWorkOrderList(
    communityId,
    statusFilter || undefined
  );

  const columns = useMemo<ColumnDef<WorkOrderRow, unknown>[]>(
    () => [
      {
        accessorKey: 'work_order_number',
        header: 'No. Orden',
        cell: ({ row }) => (
          <Link
            href={`/providers/work-orders/${row.original.id}`}
            className="font-mono text-sm font-medium text-indigo-600 hover:text-indigo-800"
          >
            {row.original.work_order_number}
          </Link>
        ),
      },
      {
        accessorKey: 'title',
        header: 'Titulo',
        cell: ({ row }) => (
          <span className="text-sm text-gray-900">{row.original.title}</span>
        ),
      },
      {
        id: 'provider',
        header: 'Proveedor',
        cell: ({ row }) => (
          <span className="text-sm text-gray-600">
            {row.original.providers?.company_name ?? '-'}
          </span>
        ),
      },
      {
        id: 'unit',
        header: 'Unidad',
        cell: ({ row }) => (
          <span className="text-sm text-gray-600">
            {row.original.units?.unit_number ?? '-'}
          </span>
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
        accessorKey: 'scheduled_date',
        header: 'Programada',
        cell: ({ row }) =>
          row.original.scheduled_date ? formatDate(row.original.scheduled_date) : '-',
      },
      {
        accessorKey: 'estimated_cost',
        header: 'Est.',
        cell: ({ row }) =>
          row.original.estimated_cost != null
            ? formatCurrency(Number(row.original.estimated_cost))
            : '-',
      },
      {
        accessorKey: 'actual_cost',
        header: 'Real',
        cell: ({ row }) =>
          row.original.actual_cost != null
            ? formatCurrency(Number(row.original.actual_cost))
            : '-',
      },
      {
        accessorKey: 'rating',
        header: 'Calif.',
        cell: ({ row }) => <StarRating rating={row.original.rating} />,
      },
    ],
    []
  );

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-gray-900">Ordenes de Trabajo</h1>
          {workOrders && (
            <Badge variant="neutral">{workOrders.length}</Badge>
          )}
        </div>
        <Button onClick={() => setShowCreateForm(!showCreateForm)}>
          {showCreateForm ? 'Cerrar' : '+ Nueva Orden'}
        </Button>
      </div>

      {/* Create form */}
      {showCreateForm && (
        <CreateWorkOrderForm onClose={() => setShowCreateForm(false)} />
      )}

      {/* Filter bar */}
      <div className="flex items-center gap-3">
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
        >
          <option value="">Todos los estados</option>
          <option value="draft">Borrador</option>
          <option value="submitted">Enviada</option>
          <option value="approved">Aprobada</option>
          <option value="scheduled">Programada</option>
          <option value="in_progress">En Progreso</option>
          <option value="completed">Completada</option>
          <option value="cancelled">Cancelada</option>
        </select>
      </div>

      {/* DataTable */}
      <DataTable
        columns={columns}
        data={workOrders ?? []}
        isLoading={isLoading}
      />
    </div>
  );
}
