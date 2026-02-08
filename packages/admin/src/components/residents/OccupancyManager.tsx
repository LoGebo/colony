'use client';

import { useState } from 'react';
import { useCreateOccupancy, useRemoveOccupancy } from '@/hooks/useOccupancies';
import { useResidents } from '@/hooks/useResidents';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';

interface Occupancy {
  id: string;
  occupancy_type: string;
  start_date: string;
  end_date: string | null;
  status: string;
  notes: string | null;
  residents: {
    id: string;
    first_name: string;
    paternal_surname: string;
    maternal_surname: string | null;
    email: string | null;
    phone: string | null;
  };
}

interface OccupancyManagerProps {
  unitId: string;
  occupancies: Occupancy[];
}

const OCCUPANCY_TYPE_LABELS: Record<string, string> = {
  owner: 'Propietario',
  tenant: 'Inquilino',
  authorized: 'Autorizado',
  employee: 'Empleado',
};

const OCCUPANCY_TYPE_VARIANT: Record<string, 'success' | 'info' | 'warning' | 'neutral'> = {
  owner: 'success',
  tenant: 'info',
  authorized: 'warning',
  employee: 'neutral',
};

export function OccupancyManager({ unitId, occupancies }: OccupancyManagerProps) {
  const [showAssignForm, setShowAssignForm] = useState(false);
  const [selectedResidentId, setSelectedResidentId] = useState('');
  const [occupancyType, setOccupancyType] = useState<'owner' | 'tenant' | 'authorized' | 'employee'>('tenant');
  const [confirmRemoveId, setConfirmRemoveId] = useState<string | null>(null);

  const createOccupancy = useCreateOccupancy();
  const removeOccupancy = useRemoveOccupancy();
  const { data: residentsData } = useResidents('', 0, 100);

  const activeOccupancies = occupancies.filter((o) => o.status === 'active');

  const assignedResidentIds = new Set(activeOccupancies.map((o) => o.residents.id));
  const availableResidents = (residentsData?.data ?? []).filter(
    (r) => !assignedResidentIds.has(r.id)
  );

  const handleAssign = () => {
    if (!selectedResidentId) return;
    createOccupancy.mutate(
      { unit_id: unitId, resident_id: selectedResidentId, occupancy_type: occupancyType },
      {
        onSuccess: () => {
          setShowAssignForm(false);
          setSelectedResidentId('');
          setOccupancyType('tenant');
        },
      }
    );
  };

  const handleRemove = (occupancyId: string) => {
    removeOccupancy.mutate(
      { occupancy_id: occupancyId, unit_id: unitId },
      { onSuccess: () => setConfirmRemoveId(null) }
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900">Ocupantes</h3>
        <Button size="sm" onClick={() => setShowAssignForm(!showAssignForm)}>
          {showAssignForm ? 'Cancelar' : 'Asignar residente'}
        </Button>
      </div>

      {/* Assign form */}
      {showAssignForm && (
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Residente</label>
            <select
              value={selectedResidentId}
              onChange={(e) => setSelectedResidentId(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            >
              <option value="">Seleccionar residente...</option>
              {availableResidents.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.first_name} {r.paternal_surname} {r.maternal_surname ?? ''} — {r.email ?? 'sin email'}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Tipo de ocupancia</label>
            <select
              value={occupancyType}
              onChange={(e) => setOccupancyType(e.target.value as typeof occupancyType)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            >
              <option value="owner">Propietario</option>
              <option value="tenant">Inquilino</option>
              <option value="authorized">Autorizado</option>
              <option value="employee">Empleado</option>
            </select>
          </div>
          <Button
            size="sm"
            onClick={handleAssign}
            isLoading={createOccupancy.isPending}
            disabled={!selectedResidentId}
          >
            Asignar
          </Button>
        </div>
      )}

      {/* Active occupancies list */}
      {activeOccupancies.length === 0 ? (
        <p className="text-sm text-gray-500">No hay ocupantes asignados a esta unidad.</p>
      ) : (
        <div className="space-y-2">
          {activeOccupancies.map((occ) => (
            <div
              key={occ.id}
              className="flex items-center justify-between rounded-lg border border-gray-200 bg-white p-3"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gray-100 text-sm font-medium text-gray-700">
                  {occ.residents.first_name.charAt(0)}
                  {occ.residents.paternal_surname.charAt(0)}
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900">
                    {occ.residents.first_name} {occ.residents.paternal_surname}{' '}
                    {occ.residents.maternal_surname ?? ''}
                  </p>
                  <div className="flex items-center gap-2 text-xs text-gray-500">
                    <span>{occ.residents.email ?? occ.residents.phone ?? 'Sin contacto'}</span>
                    <Badge variant={OCCUPANCY_TYPE_VARIANT[occ.occupancy_type] ?? 'neutral'}>
                      {OCCUPANCY_TYPE_LABELS[occ.occupancy_type] ?? occ.occupancy_type}
                    </Badge>
                  </div>
                </div>
              </div>

              {confirmRemoveId === occ.id ? (
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="danger"
                    onClick={() => handleRemove(occ.id)}
                    isLoading={removeOccupancy.isPending}
                  >
                    Confirmar
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setConfirmRemoveId(null)}>
                    No
                  </Button>
                </div>
              ) : (
                <Button size="sm" variant="ghost" onClick={() => setConfirmRemoveId(occ.id)}>
                  Remover
                </Button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
