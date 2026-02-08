'use client';

export const dynamic = 'force-dynamic';

import { useState, useMemo, useCallback } from 'react';
import Link from 'next/link';
import { type ColumnDef } from '@tanstack/react-table';
import { DataTable } from '@/components/ui/DataTable';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ResidentForm } from '@/components/residents/ResidentForm';
import { useResidents, useCreateResident, useDeactivateResident } from '@/hooks/useResidents';
import { formatDate } from '@/lib/formatters';

type Resident = {
  id: string;
  first_name: string;
  paternal_surname: string;
  maternal_surname: string | null;
  email: string;
  phone: string | null;
  onboarding_status: string;
  user_id: string | null;
  created_at: string;
};

const statusVariant: Record<string, 'success' | 'info' | 'neutral' | 'warning' | 'danger'> = {
  active: 'success',
  invited: 'info',
  registered: 'info',
  verified: 'success',
  inactive: 'neutral',
  suspended: 'danger',
};

const statusLabel: Record<string, string> = {
  active: 'Activo',
  invited: 'Invitado',
  registered: 'Registrado',
  verified: 'Verificado',
  inactive: 'Inactivo',
  suspended: 'Suspendido',
};

export default function ResidentsPage() {
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: 20 });
  const [showCreateForm, setShowCreateForm] = useState(false);

  const { data, isLoading } = useResidents(debouncedSearch || undefined, pagination.pageIndex, pagination.pageSize);
  const createResident = useCreateResident();
  const deactivateResident = useDeactivateResident();

  // Debounced search
  const handleSearchChange = useCallback((value: string) => {
    setSearch(value);
    const timeout = setTimeout(() => {
      setDebouncedSearch(value);
      setPagination((prev) => ({ ...prev, pageIndex: 0 }));
    }, 300);
    return () => clearTimeout(timeout);
  }, []);

  const handleDeactivate = useCallback((id: string, name: string) => {
    if (window.confirm(`Desactivar a ${name}? Esta accion cambiara su estado a inactivo.`)) {
      deactivateResident.mutate(id);
    }
  }, [deactivateResident]);

  const columns = useMemo<ColumnDef<Resident, unknown>[]>(
    () => [
      {
        accessorKey: 'full_name',
        header: 'Nombre Completo',
        cell: ({ row }) => {
          const r = row.original;
          const fullName = [r.first_name, r.paternal_surname, r.maternal_surname]
            .filter(Boolean)
            .join(' ');
          return (
            <Link
              href={`/residents/${r.id}`}
              className="font-medium text-indigo-600 hover:text-indigo-800"
            >
              {fullName}
            </Link>
          );
        },
      },
      {
        accessorKey: 'email',
        header: 'Email',
      },
      {
        accessorKey: 'phone',
        header: 'Telefono',
        cell: ({ row }) => row.original.phone || '-',
      },
      {
        accessorKey: 'onboarding_status',
        header: 'Estado',
        cell: ({ row }) => {
          const status = row.original.onboarding_status;
          return (
            <Badge variant={statusVariant[status] ?? 'neutral'}>
              {statusLabel[status] ?? status}
            </Badge>
          );
        },
      },
      {
        accessorKey: 'created_at',
        header: 'Fecha Registro',
        cell: ({ row }) => formatDate(row.original.created_at),
      },
      {
        id: 'actions',
        header: 'Acciones',
        cell: ({ row }) => {
          const r = row.original;
          const fullName = [r.first_name, r.paternal_surname].join(' ');
          return (
            <div className="flex items-center gap-2">
              <Link
                href={`/residents/${r.id}`}
                className="text-sm text-indigo-600 hover:text-indigo-800"
              >
                Editar
              </Link>
              {r.onboarding_status !== 'inactive' && (
                <button
                  onClick={() => handleDeactivate(r.id, fullName)}
                  className="text-sm text-red-600 hover:text-red-800"
                >
                  Desactivar
                </button>
              )}
            </div>
          );
        },
      },
    ],
    [handleDeactivate]
  );

  const pageCount = Math.ceil((data?.count ?? 0) / pagination.pageSize);

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-gray-900">Residentes</h1>
          {data?.count != null && (
            <Badge variant="neutral">{data.count}</Badge>
          )}
        </div>
        <div className="flex items-center gap-3">
          <Link href="/residents/invite">
            <Button variant="secondary">Invitar Residente</Button>
          </Link>
          <Button onClick={() => setShowCreateForm(true)}>
            Nuevo Residente
          </Button>
        </div>
      </div>

      {/* Search bar */}
      <div>
        <input
          type="text"
          value={search}
          onChange={(e) => handleSearchChange(e.target.value)}
          placeholder="Buscar por nombre o email..."
          className="w-full max-w-md rounded-lg border border-gray-300 px-4 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
        />
      </div>

      {/* Create form slide-out */}
      {showCreateForm && (
        <Card>
          <ResidentForm
            onSubmit={(formData) => {
              createResident.mutate(formData, {
                onSuccess: () => setShowCreateForm(false),
              });
            }}
            onCancel={() => setShowCreateForm(false)}
            isLoading={createResident.isPending}
          />
        </Card>
      )}

      {/* Resident data table */}
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
