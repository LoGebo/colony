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
  useProviderList,
  useCreateProvider,
  useExpiringDocuments,
  type ProviderRow,
} from '@/hooks/useProviders';
import { useAuth } from '@/hooks/useAuth';

/* ------------------------------------------------------------------ */
/*  Status helpers                                                     */
/* ------------------------------------------------------------------ */

const STATUS_LABELS: Record<string, string> = {
  pending_approval: 'Pendiente',
  active: 'Activo',
  suspended: 'Suspendido',
  inactive: 'Inactivo',
};

const STATUS_VARIANTS: Record<string, 'warning' | 'success' | 'danger' | 'neutral'> = {
  pending_approval: 'warning',
  active: 'success',
  suspended: 'danger',
  inactive: 'neutral',
};

function StarRating({ rating }: { rating: number | null }) {
  if (rating == null) return <span className="text-sm text-gray-400">-</span>;
  const full = Math.round(rating);
  return (
    <span className="text-sm text-yellow-500" title={`${rating.toFixed(1)}/5`}>
      {'★'.repeat(full)}
      {'☆'.repeat(5 - full)}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/*  Create Provider Form                                               */
/* ------------------------------------------------------------------ */

function CreateProviderForm({ onClose }: { onClose: () => void }) {
  const createProvider = useCreateProvider();
  const [form, setForm] = useState({
    company_name: '',
    contact_name: '',
    contact_email: '',
    contact_phone: '',
    specialty: '',
    tax_id: '',
    address: '',
    notes: '',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.company_name.trim()) return;
    createProvider.mutate(
      {
        company_name: form.company_name.trim(),
        contact_name: form.contact_name.trim() || undefined,
        contact_email: form.contact_email.trim() || undefined,
        contact_phone: form.contact_phone.trim() || undefined,
        specialty: form.specialty.trim() || undefined,
        tax_id: form.tax_id.trim() || undefined,
        address: form.address.trim() || undefined,
        notes: form.notes.trim() || undefined,
      },
      {
        onSuccess: () => {
          onClose();
          setForm({
            company_name: '',
            contact_name: '',
            contact_email: '',
            contact_phone: '',
            specialty: '',
            tax_id: '',
            address: '',
            notes: '',
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
        <h3 className="text-lg font-semibold text-gray-900">Nuevo Proveedor</h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Empresa <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              value={form.company_name}
              onChange={(e) => setForm({ ...form, company_name: e.target.value })}
              className={inputClass}
              placeholder="Nombre de la empresa"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Contacto</label>
            <input
              type="text"
              value={form.contact_name}
              onChange={(e) => setForm({ ...form, contact_name: e.target.value })}
              className={inputClass}
              placeholder="Nombre del contacto"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Email</label>
            <input
              type="email"
              value={form.contact_email}
              onChange={(e) => setForm({ ...form, contact_email: e.target.value })}
              className={inputClass}
              placeholder="email@empresa.com"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Telefono</label>
            <input
              type="tel"
              value={form.contact_phone}
              onChange={(e) => setForm({ ...form, contact_phone: e.target.value })}
              className={inputClass}
              placeholder="+52 ..."
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Especialidad</label>
            <input
              type="text"
              value={form.specialty}
              onChange={(e) => setForm({ ...form, specialty: e.target.value })}
              className={inputClass}
              placeholder="Electricidad, plomeria, etc."
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">RFC</label>
            <input
              type="text"
              value={form.tax_id}
              onChange={(e) => setForm({ ...form, tax_id: e.target.value })}
              className={inputClass}
              placeholder="RFC del proveedor"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="mb-1 block text-sm font-medium text-gray-700">Direccion</label>
            <input
              type="text"
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
              className={inputClass}
              placeholder="Direccion de la empresa"
            />
          </div>
          <div className="sm:col-span-2 lg:col-span-3">
            <label className="mb-1 block text-sm font-medium text-gray-700">Notas</label>
            <textarea
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              className={inputClass}
              rows={2}
              placeholder="Notas adicionales..."
            />
          </div>
        </div>
        <div className="flex gap-2">
          <Button type="submit" isLoading={createProvider.isPending}>
            Crear Proveedor
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

export default function ProvidersPage() {
  const { communityId } = useAuth();
  const [statusFilter, setStatusFilter] = useState('');
  const [showCreateForm, setShowCreateForm] = useState(false);

  const { data: providers, isLoading } = useProviderList(communityId, statusFilter || undefined);
  const { data: expiringDocs } = useExpiringDocuments(communityId);

  const columns = useMemo<ColumnDef<ProviderRow, unknown>[]>(
    () => [
      {
        accessorKey: 'company_name',
        header: 'Empresa',
        cell: ({ row }) => (
          <Link
            href={`/providers/${row.original.id}`}
            className="font-medium text-indigo-600 hover:text-indigo-800"
          >
            {row.original.company_name}
          </Link>
        ),
      },
      {
        accessorKey: 'contact_name',
        header: 'Contacto',
        cell: ({ row }) => row.original.contact_name ?? '-',
      },
      {
        accessorKey: 'contact_email',
        header: 'Email',
        cell: ({ row }) => (
          <span className="text-sm text-gray-600">{row.original.contact_email ?? '-'}</span>
        ),
      },
      {
        accessorKey: 'specialty',
        header: 'Especialidad',
        cell: ({ row }) => row.original.specialty ?? '-',
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
        accessorKey: 'total_work_orders',
        header: 'Ordenes',
        cell: ({ row }) => row.original.total_work_orders,
      },
      {
        accessorKey: 'average_rating',
        header: 'Calificacion',
        cell: ({ row }) => <StarRating rating={row.original.average_rating} />,
      },
      {
        id: 'actions',
        header: '',
        cell: ({ row }) => (
          <Link
            href={`/providers/${row.original.id}`}
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
      {/* Expiring documents alert */}
      {expiringDocs && expiringDocs.length > 0 && (
        <div className="rounded-lg border border-yellow-200 bg-yellow-50 px-4 py-3">
          <div className="flex items-center gap-2">
            <svg className="h-5 w-5 text-yellow-600" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
            </svg>
            <span className="text-sm font-medium text-yellow-800">
              {expiringDocs.length} documento{expiringDocs.length !== 1 ? 's' : ''} por vencer en los proximos 30 dias
            </span>
          </div>
        </div>
      )}

      {/* Page header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-gray-900">Proveedores</h1>
          {providers && (
            <Badge variant="neutral">{providers.length}</Badge>
          )}
        </div>
        <Button onClick={() => setShowCreateForm(!showCreateForm)}>
          {showCreateForm ? 'Cerrar' : '+ Nuevo Proveedor'}
        </Button>
      </div>

      {/* Create form */}
      {showCreateForm && (
        <CreateProviderForm onClose={() => setShowCreateForm(false)} />
      )}

      {/* Filter bar */}
      <div className="flex items-center gap-3">
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
        >
          <option value="">Todos los estados</option>
          <option value="pending_approval">Pendiente</option>
          <option value="active">Activo</option>
          <option value="suspended">Suspendido</option>
          <option value="inactive">Inactivo</option>
        </select>
      </div>

      {/* DataTable */}
      <DataTable
        columns={columns}
        data={providers ?? []}
        isLoading={isLoading}
      />
    </div>
  );
}
