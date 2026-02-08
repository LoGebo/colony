'use client';

export const dynamic = 'force-dynamic';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { ResidentForm } from '@/components/residents/ResidentForm';
import { useResident, useUpdateResident, useDeactivateResident } from '@/hooks/useResidents';
import { formatDate } from '@/lib/formatters';

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

const occupancyTypeLabel: Record<string, string> = {
  owner: 'Propietario',
  tenant: 'Inquilino',
  authorized: 'Autorizado',
  employee: 'Empleado',
};

export default function ResidentDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const [isEditing, setIsEditing] = useState(false);

  const { data: resident, isLoading } = useResident(id);
  const updateResident = useUpdateResident();
  const deactivateResident = useDeactivateResident();

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-48 animate-pulse rounded bg-gray-200" />
        <div className="h-64 animate-pulse rounded-xl bg-gray-100" />
      </div>
    );
  }

  if (!resident) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Residente no encontrado</p>
        <Link href="/residents" className="mt-2 inline-block text-indigo-600 hover:text-indigo-800">
          Volver a Residentes
        </Link>
      </div>
    );
  }

  const fullName = [resident.first_name, resident.paternal_surname, resident.maternal_surname]
    .filter(Boolean)
    .join(' ');

  const status = resident.onboarding_status;
  const occupancies = (resident.occupancies ?? []).filter(
    (o: { status: string; deleted_at: string | null }) => o.status === 'active' && !o.deleted_at
  );

  const handleDeactivate = () => {
    if (window.confirm(`Desactivar a ${fullName}? Esta accion cambiara su estado a inactivo.`)) {
      deactivateResident.mutate(id);
    }
  };

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-sm text-gray-500">
        <Link href="/residents" className="hover:text-indigo-600">Residentes</Link>
        <span>/</span>
        <span className="text-gray-900">{fullName}</span>
      </nav>

      {/* Profile card */}
      <Card>
        {isEditing ? (
          <ResidentForm
            resident={{
              first_name: resident.first_name,
              paternal_surname: resident.paternal_surname,
              maternal_surname: resident.maternal_surname,
              email: resident.email,
              phone: resident.phone,
            }}
            onSubmit={(formData) => {
              updateResident.mutate(
                { id, ...formData },
                { onSuccess: () => setIsEditing(false) }
              );
            }}
            onCancel={() => setIsEditing(false)}
            isLoading={updateResident.isPending}
          />
        ) : (
          <div>
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-xl font-bold text-gray-900">{fullName}</h2>
                <p className="mt-1 text-sm text-gray-500">{resident.email}</p>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={statusVariant[status] ?? 'neutral'}>
                  {statusLabel[status] ?? status}
                </Badge>
              </div>
            </div>

            <dl className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <dt className="text-sm font-medium text-gray-500">Nombre</dt>
                <dd className="mt-1 text-sm text-gray-900">{resident.first_name}</dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">Apellido Paterno</dt>
                <dd className="mt-1 text-sm text-gray-900">{resident.paternal_surname}</dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">Apellido Materno</dt>
                <dd className="mt-1 text-sm text-gray-900">{resident.maternal_surname || '-'}</dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">Telefono</dt>
                <dd className="mt-1 text-sm text-gray-900">{resident.phone || '-'}</dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">Fecha de Registro</dt>
                <dd className="mt-1 text-sm text-gray-900">{formatDate(resident.created_at)}</dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">ID Usuario</dt>
                <dd className="mt-1 text-sm text-gray-900 font-mono">
                  {resident.user_id ? resident.user_id.slice(0, 8) + '...' : 'Pendiente'}
                </dd>
              </div>
            </dl>

            <div className="mt-6 flex gap-3">
              <Button onClick={() => setIsEditing(true)}>Editar</Button>
              {status !== 'inactive' && (
                <Button
                  variant="danger"
                  onClick={handleDeactivate}
                  isLoading={deactivateResident.isPending}
                >
                  Desactivar
                </Button>
              )}
            </div>
          </div>
        )}
      </Card>

      {/* Occupancy section (read-only) */}
      <Card>
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Unidades Asignadas</h3>
        {occupancies.length === 0 ? (
          <p className="text-sm text-gray-500">No tiene unidades asignadas.</p>
        ) : (
          <div className="overflow-hidden rounded-lg border border-gray-200">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    Unidad
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    Tipo de Ocupacion
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    Fecha Inicio
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {occupancies.map((occ: { id: string; occupancy_type: string; start_date: string; units: { unit_number: string; id: string } | null }) => (
                  <tr key={occ.id}>
                    <td className="whitespace-nowrap px-4 py-3 text-sm">
                      {occ.units ? (
                        <Link
                          href={`/units/${occ.units.id}`}
                          className="font-medium text-indigo-600 hover:text-indigo-800"
                        >
                          {occ.units.unit_number}
                        </Link>
                      ) : (
                        '-'
                      )}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm">
                      <Badge variant="info">
                        {occupancyTypeLabel[occ.occupancy_type] ?? occ.occupancy_type}
                      </Badge>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-900">
                      {formatDate(occ.start_date)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="mt-3 text-xs text-gray-400">
          Para editar asignaciones, visita la pagina de detalle de la unidad.
        </p>
      </Card>
    </div>
  );
}
