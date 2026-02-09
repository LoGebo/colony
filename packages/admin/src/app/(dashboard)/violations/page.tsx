'use client';

export const dynamic = 'force-dynamic';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { type ColumnDef, type PaginationState } from '@tanstack/react-table';
import { DataTable } from '@/components/ui/DataTable';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import {
  useViolations,
  useViolationTypes,
  useCreateViolation,
  type ViolationRow,
} from '@/hooks/useViolations';
import { useUnits } from '@/hooks/useUnits';
import { formatDate } from '@/lib/formatters';

const severityVariant: Record<string, 'info' | 'warning' | 'danger'> = {
  minor: 'info',
  moderate: 'warning',
  serious: 'danger',
  critical: 'danger',
};

const severityLabel: Record<string, string> = {
  minor: 'Menor',
  moderate: 'Moderada',
  serious: 'Grave',
  critical: 'Critica',
};

const statusVariant: Record<string, 'warning' | 'info' | 'success' | 'neutral'> = {
  open: 'warning',
  under_review: 'info',
  resolved: 'success',
  dismissed: 'neutral',
};

const statusLabel: Record<string, string> = {
  open: 'Abierta',
  under_review: 'En revision',
  resolved: 'Resuelta',
  dismissed: 'Desestimada',
};

export default function ViolationsPage() {
  const router = useRouter();

  // Filters
  const [severityFilter, setSeverityFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [violationTypeFilter, setViolationTypeFilter] = useState('');
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 20,
  });

  // Create modal
  const [showCreateModal, setShowCreateModal] = useState(false);

  const { data, isLoading } = useViolations({
    severity: severityFilter || undefined,
    status: statusFilter || undefined,
    violationTypeId: violationTypeFilter || undefined,
    page: pagination.pageIndex,
    pageSize: pagination.pageSize,
  });

  const { data: violationTypes } = useViolationTypes();

  const columns = useMemo<ColumnDef<ViolationRow, unknown>[]>(
    () => [
      {
        accessorKey: 'violation_number',
        header: 'Numero',
        cell: ({ row }) => (
          <span className="font-mono text-xs text-gray-600">
            {row.original.violation_number}
          </span>
        ),
      },
      {
        id: 'unit',
        header: 'Unidad',
        cell: ({ row }) => (
          <span className="font-medium">
            {row.original.units?.unit_number ?? '-'}
          </span>
        ),
      },
      {
        id: 'type',
        header: 'Tipo',
        cell: ({ row }) => (
          <div className="max-w-xs">
            <div className="text-sm font-medium">
              {row.original.violation_types?.name ?? '-'}
            </div>
            <div className="text-xs text-gray-500">
              {row.original.violation_types?.category ?? ''}
            </div>
          </div>
        ),
      },
      {
        accessorKey: 'severity',
        header: 'Severidad',
        cell: ({ row }) => (
          <Badge variant={severityVariant[row.original.severity] ?? 'neutral'}>
            {severityLabel[row.original.severity] ?? row.original.severity}
          </Badge>
        ),
      },
      {
        accessorKey: 'status',
        header: 'Estado',
        cell: ({ row }) => (
          <Badge variant={statusVariant[row.original.status] ?? 'neutral'}>
            {statusLabel[row.original.status] ?? row.original.status}
          </Badge>
        ),
      },
      {
        accessorKey: 'offense_number',
        header: 'Reincidencia',
        cell: ({ row }) => (
          <span
            className={`font-semibold ${
              row.original.offense_number > 1 ? 'text-red-600' : 'text-gray-600'
            }`}
          >
            #{row.original.offense_number}
          </span>
        ),
      },
      {
        accessorKey: 'occurred_at',
        header: 'Fecha',
        cell: ({ row }) => formatDate(row.original.occurred_at),
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
            Infracciones y Sanciones
          </h1>
          {data?.count != null && (
            <Badge variant="neutral">{data.count}</Badge>
          )}
        </div>
        <Button onClick={() => setShowCreateModal(true)}>
          Nueva Infraccion
        </Button>
      </div>

      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-3">
        <select
          value={severityFilter}
          onChange={(e) => {
            setSeverityFilter(e.target.value);
            setPagination((prev) => ({ ...prev, pageIndex: 0 }));
          }}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
        >
          <option value="">Todas las severidades</option>
          <option value="minor">Menor</option>
          <option value="moderate">Moderada</option>
          <option value="serious">Grave</option>
          <option value="critical">Critica</option>
        </select>
        <select
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value);
            setPagination((prev) => ({ ...prev, pageIndex: 0 }));
          }}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
        >
          <option value="">Todos los estados</option>
          <option value="open">Abierta</option>
          <option value="under_review">En revision</option>
          <option value="resolved">Resuelta</option>
          <option value="dismissed">Desestimada</option>
        </select>
        <select
          value={violationTypeFilter}
          onChange={(e) => {
            setViolationTypeFilter(e.target.value);
            setPagination((prev) => ({ ...prev, pageIndex: 0 }));
          }}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
        >
          <option value="">Todos los tipos</option>
          {violationTypes?.map((type) => (
            <option key={type.id} value={type.id}>
              {type.name}
            </option>
          ))}
        </select>
      </div>

      {/* Table */}
      <DataTable
        columns={columns}
        data={data?.data ?? []}
        pageCount={pageCount}
        pagination={pagination}
        onPaginationChange={setPagination}
        isLoading={isLoading}
      />

      {/* Create modal */}
      {showCreateModal && (
        <CreateViolationModal
          onClose={() => setShowCreateModal(false)}
          onSuccess={(id) => {
            setShowCreateModal(false);
            router.push(`/violations/${id}`);
          }}
        />
      )}
    </div>
  );
}

function CreateViolationModal({
  onClose,
  onSuccess,
}: {
  onClose: () => void;
  onSuccess: (id: string) => void;
}) {
  const { data: units } = useUnits('', 0, 1000);
  const { data: violationTypes } = useViolationTypes();
  const createMutation = useCreateViolation();

  const [formData, setFormData] = useState({
    unit_id: '',
    violation_type_id: '',
    severity: '',
    description: '',
    occurred_at: new Date().toISOString().slice(0, 16),
    location: '',
    witness_names: '',
    photo_urls: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const witnessArray = formData.witness_names
      .split(',')
      .map((n) => n.trim())
      .filter(Boolean);
    const photoArray = formData.photo_urls
      .split('\n')
      .map((u) => u.trim())
      .filter(Boolean);

    const result = await createMutation.mutateAsync({
      unit_id: formData.unit_id,
      violation_type_id: formData.violation_type_id,
      severity: formData.severity,
      description: formData.description,
      occurred_at: formData.occurred_at,
      location: formData.location || undefined,
      witness_names: witnessArray.length > 0 ? witnessArray : undefined,
      photo_urls: photoArray.length > 0 ? photoArray : undefined,
    });

    onSuccess(result.id);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <Card className="max-h-[90vh] w-full max-w-2xl overflow-y-auto">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-bold">Nueva Infraccion</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            &times;
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Unidad *
            </label>
            <select
              required
              value={formData.unit_id}
              onChange={(e) =>
                setFormData({ ...formData, unit_id: e.target.value })
              }
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            >
              <option value="">Seleccionar...</option>
              {units?.data.map((unit) => (
                <option key={unit.id} value={unit.id}>
                  {unit.unit_number}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">
              Tipo de Infraccion *
            </label>
            <select
              required
              value={formData.violation_type_id}
              onChange={(e) =>
                setFormData({ ...formData, violation_type_id: e.target.value })
              }
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            >
              <option value="">Seleccionar...</option>
              {violationTypes?.map((type) => (
                <option key={type.id} value={type.id}>
                  {type.name} ({type.category})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">
              Severidad *
            </label>
            <select
              required
              value={formData.severity}
              onChange={(e) =>
                setFormData({ ...formData, severity: e.target.value })
              }
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            >
              <option value="">Seleccionar...</option>
              <option value="minor">Menor</option>
              <option value="moderate">Moderada</option>
              <option value="serious">Grave</option>
              <option value="critical">Critica</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">
              Descripcion *
            </label>
            <textarea
              required
              value={formData.description}
              onChange={(e) =>
                setFormData({ ...formData, description: e.target.value })
              }
              rows={4}
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">
              Fecha y Hora *
            </label>
            <input
              type="datetime-local"
              required
              value={formData.occurred_at}
              onChange={(e) =>
                setFormData({ ...formData, occurred_at: e.target.value })
              }
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">
              Ubicacion
            </label>
            <input
              type="text"
              value={formData.location}
              onChange={(e) =>
                setFormData({ ...formData, location: e.target.value })
              }
              placeholder="Ej: Area comun, jardin trasero..."
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">
              Testigos (separados por comas)
            </label>
            <input
              type="text"
              value={formData.witness_names}
              onChange={(e) =>
                setFormData({ ...formData, witness_names: e.target.value })
              }
              placeholder="Juan Perez, Maria Lopez..."
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">
              URLs de Fotos (una por linea)
            </label>
            <textarea
              value={formData.photo_urls}
              onChange={(e) =>
                setFormData({ ...formData, photo_urls: e.target.value })
              }
              rows={3}
              placeholder="https://..."
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
          </div>

          <div className="flex gap-3">
            <Button
              type="submit"
              variant="primary"
              isLoading={createMutation.isPending}
            >
              Crear Infraccion
            </Button>
            <Button type="button" variant="secondary" onClick={onClose}>
              Cancelar
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
