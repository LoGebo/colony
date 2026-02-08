'use client';

export const dynamic = 'force-dynamic';

import { use, useState } from 'react';
import Link from 'next/link';
import { useUnit, useUpdateUnit } from '@/hooks/useUnits';
import { OccupancyManager } from '@/components/residents/OccupancyManager';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';

const UNIT_TYPE_LABELS: Record<string, string> = {
  casa: 'Casa',
  departamento: 'Departamento',
  local: 'Local',
  bodega: 'Bodega',
  oficina: 'Oficina',
  terreno: 'Terreno',
  estacionamiento: 'Estacionamiento',
};

export default function UnitDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data: unit, isLoading, error } = useUnit(id);
  const updateUnit = useUpdateUnit();
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({
    unit_number: '',
    building: '',
    area_m2: '',
    floor_number: '',
    coefficient: '',
    address_line: '',
    parking_spaces: '',
  });

  const startEdit = () => {
    if (!unit) return;
    setEditForm({
      unit_number: unit.unit_number,
      building: unit.building ?? '',
      area_m2: unit.area_m2 != null ? String(unit.area_m2) : '',
      floor_number: unit.floor_number != null ? String(unit.floor_number) : '',
      coefficient: String(unit.coefficient),
      address_line: unit.address_line ?? '',
      parking_spaces: String(unit.parking_spaces),
    });
    setIsEditing(true);
  };

  const handleSave = () => {
    updateUnit.mutate(
      {
        id,
        unit_number: editForm.unit_number,
        building: editForm.building || null,
        area_m2: editForm.area_m2 ? Number(editForm.area_m2) : null,
        floor_number: editForm.floor_number ? Number(editForm.floor_number) : null,
        coefficient: Number(editForm.coefficient),
        address_line: editForm.address_line || null,
        parking_spaces: Number(editForm.parking_spaces) || 0,
      },
      { onSuccess: () => setIsEditing(false) }
    );
  };

  // Loading skeleton
  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-48 animate-pulse rounded bg-gray-200" />
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="h-64 animate-pulse rounded-xl bg-gray-200" />
          <div className="h-64 animate-pulse rounded-xl bg-gray-200" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        Error al cargar unidad: {(error as Error).message}
      </div>
    );
  }

  if (!unit) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Unidad no encontrada</p>
        <Link href="/units" className="mt-2 text-sm text-indigo-600 hover:text-indigo-800">
          Volver a unidades
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Breadcrumb + title */}
      <div>
        <Link href="/units" className="text-sm text-gray-500 hover:text-gray-700">
          Unidades
        </Link>
        <span className="mx-2 text-gray-400">/</span>
        <span className="text-sm text-gray-900">{unit.unit_number}</span>
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-gray-900">{unit.unit_number}</h1>
          <Badge variant={unit.status === 'active' ? 'success' : 'danger'}>
            {unit.status === 'active' ? 'Activa' : unit.status}
          </Badge>
        </div>
        {!isEditing && (
          <Button onClick={startEdit}>Editar</Button>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Unit details */}
        <Card>
          <div className="p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Informacion de la unidad</h2>

            {isEditing ? (
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Numero de unidad</label>
                  <input
                    value={editForm.unit_number}
                    onChange={(e) => setEditForm({ ...editForm, unit_number: e.target.value })}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Edificio</label>
                  <input
                    value={editForm.building}
                    onChange={(e) => setEditForm({ ...editForm, building: e.target.value })}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Area (m2)</label>
                    <input
                      type="number"
                      step="0.1"
                      value={editForm.area_m2}
                      onChange={(e) => setEditForm({ ...editForm, area_m2: e.target.value })}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Piso</label>
                    <input
                      type="number"
                      value={editForm.floor_number}
                      onChange={(e) => setEditForm({ ...editForm, floor_number: e.target.value })}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Coeficiente</label>
                    <input
                      type="number"
                      step="0.0001"
                      value={editForm.coefficient}
                      onChange={(e) => setEditForm({ ...editForm, coefficient: e.target.value })}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Cajones</label>
                    <input
                      type="number"
                      value={editForm.parking_spaces}
                      onChange={(e) => setEditForm({ ...editForm, parking_spaces: e.target.value })}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Direccion</label>
                  <input
                    value={editForm.address_line}
                    onChange={(e) => setEditForm({ ...editForm, address_line: e.target.value })}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  />
                </div>
                <div className="flex gap-2 pt-2">
                  <Button onClick={handleSave} isLoading={updateUnit.isPending}>
                    Guardar
                  </Button>
                  <Button variant="ghost" onClick={() => setIsEditing(false)}>
                    Cancelar
                  </Button>
                </div>
              </div>
            ) : (
              <dl className="space-y-3">
                <div className="flex justify-between">
                  <dt className="text-sm text-gray-500">Tipo</dt>
                  <dd className="text-sm font-medium text-gray-900">
                    {UNIT_TYPE_LABELS[unit.unit_type] ?? unit.unit_type}
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-sm text-gray-500">Edificio</dt>
                  <dd className="text-sm font-medium text-gray-900">{unit.building ?? '—'}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-sm text-gray-500">Area</dt>
                  <dd className="text-sm font-medium text-gray-900">
                    {unit.area_m2 != null ? `${unit.area_m2} m2` : '—'}
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-sm text-gray-500">Piso</dt>
                  <dd className="text-sm font-medium text-gray-900">{unit.floor_number ?? '—'}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-sm text-gray-500">Coeficiente</dt>
                  <dd className="text-sm font-medium text-gray-900">{Number(unit.coefficient).toFixed(4)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-sm text-gray-500">Cajones de estacionamiento</dt>
                  <dd className="text-sm font-medium text-gray-900">{unit.parking_spaces}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-sm text-gray-500">Direccion</dt>
                  <dd className="text-sm font-medium text-gray-900">{unit.address_line ?? '—'}</dd>
                </div>
              </dl>
            )}
          </div>
        </Card>

        {/* Occupancy management */}
        <Card>
          <div className="p-6">
            <OccupancyManager
              unitId={id}
              occupancies={unit.occupancies ?? []}
            />
          </div>
        </Card>
      </div>
    </div>
  );
}
