'use client';

export const dynamic = 'force-dynamic';

import { useAdminUsers, type AdminUser } from '@/hooks/useCommunitySettings';
import { DataTable } from '@/components/ui/DataTable';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { useMemo } from 'react';
import { type ColumnDef } from '@tanstack/react-table';

const ROLE_LABELS: Record<string, string> = {
  resident: 'Residente',
  guard: 'Guardia',
};

const STATUS_LABELS: Record<string, string> = {
  active: 'Activo',
  inactive: 'Inactivo',
  invited: 'Invitado',
  pending_setup: 'Pendiente',
  completed: 'Completado',
};

export default function RolesPage() {
  const { data: users, isLoading } = useAdminUsers();

  const columns = useMemo<ColumnDef<AdminUser>[]>(
    () => [
      {
        accessorKey: 'firstName',
        header: 'Nombre',
        cell: ({ row }) => {
          const u = row.original;
          return (
            <span className="font-medium text-gray-900">
              {u.firstName} {u.paternalSurname} {u.maternalSurname ?? ''}
            </span>
          );
        },
      },
      {
        accessorKey: 'email',
        header: 'Correo',
        cell: ({ getValue }) => getValue() ?? '—',
      },
      {
        accessorKey: 'phone',
        header: 'Telefono',
        cell: ({ getValue }) => getValue() ?? '—',
      },
      {
        accessorKey: 'role',
        header: 'Rol',
        cell: ({ getValue }) => {
          const role = getValue() as string;
          return (
            <Badge variant={role === 'guard' ? 'info' : 'neutral'}>
              {ROLE_LABELS[role] ?? role}
            </Badge>
          );
        },
      },
      {
        accessorKey: 'status',
        header: 'Estado',
        cell: ({ getValue }) => {
          const status = getValue() as string;
          const variant =
            status === 'active' || status === 'completed'
              ? 'success'
              : status === 'inactive'
                ? 'danger'
                : 'warning';
          return (
            <Badge variant={variant}>
              {STATUS_LABELS[status] ?? status}
            </Badge>
          );
        },
      },
    ],
    []
  );

  const residentCount = (users ?? []).filter((u) => u.role === 'resident').length;
  const guardCount = (users ?? []).filter((u) => u.role === 'guard').length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Usuarios y roles</h1>
        <p className="mt-1 text-sm text-gray-500">
          Usuarios registrados con acceso a la aplicacion
        </p>
      </div>

      {/* Info note */}
      <Card>
        <div className="p-4 flex items-start gap-3">
          <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-blue-100 text-blue-600">
            <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                clipRule="evenodd"
              />
            </svg>
          </div>
          <div>
            <p className="text-sm font-medium text-gray-900">Roles administrados por el sistema</p>
            <p className="mt-1 text-sm text-gray-500">
              Los roles se asignan automaticamente al registrarse. Los residentes y guardias
              obtienen su rol cuando su cuenta se vincula con su registro. Para cambios de rol
              avanzados, contacta al soporte tecnico.
            </p>
          </div>
        </div>
      </Card>

      {/* Summary */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <div className="p-4">
            <p className="text-sm text-gray-500">Total usuarios</p>
            <p className="mt-1 text-2xl font-bold text-gray-900">{(users ?? []).length}</p>
          </div>
        </Card>
        <Card>
          <div className="p-4">
            <p className="text-sm text-gray-500">Residentes</p>
            <p className="mt-1 text-2xl font-bold text-gray-900">{residentCount}</p>
          </div>
        </Card>
        <Card>
          <div className="p-4">
            <p className="text-sm text-gray-500">Guardias</p>
            <p className="mt-1 text-2xl font-bold text-gray-900">{guardCount}</p>
          </div>
        </Card>
      </div>

      {/* Users table */}
      <DataTable
        columns={columns}
        data={users ?? []}
        isLoading={isLoading}
      />
    </div>
  );
}
