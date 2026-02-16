'use client';

export const dynamic = 'force-dynamic';

import { useState, useCallback } from 'react';
import Link from 'next/link';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import {
  useAmenities,
  useCreateAmenity,
  useUpdateAmenity,
  type AmenityRow,
} from '@/hooks/useAmenities';

/* ------------------------------------------------------------------ */
/*  Label maps                                                        */
/* ------------------------------------------------------------------ */

const amenityTypeLabel: Record<string, string> = {
  pool: 'Alberca',
  gym: 'Gimnasio',
  salon: 'Salon',
  rooftop: 'Rooftop',
  bbq: 'Asador',
  court: 'Cancha',
  room: 'Sala',
  parking: 'Estacionamiento',
  other: 'Otro',
};

const amenityTypeVariant: Record<string, 'success' | 'info' | 'warning' | 'neutral' | 'danger'> = {
  pool: 'info',
  gym: 'success',
  salon: 'warning',
  rooftop: 'info',
  bbq: 'warning',
  court: 'info',
  room: 'success',
  parking: 'neutral',
  other: 'neutral',
};

const AMENITY_TYPES = ['pool', 'gym', 'salon', 'rooftop', 'bbq', 'court', 'room', 'parking', 'other'];

/* ------------------------------------------------------------------ */
/*  Amenity card component                                            */
/* ------------------------------------------------------------------ */

function AmenityCard({
  amenity,
  onToggleActive,
}: {
  amenity: AmenityRow;
  onToggleActive: (id: string, active: boolean) => void;
}) {
  return (
    <Card className="flex flex-col justify-between">
      <div>
        <div className="flex items-start justify-between">
          <h3 className="text-lg font-semibold text-gray-900">{amenity.name}</h3>
          <Badge variant={amenityTypeVariant[amenity.amenity_type ?? ''] ?? 'neutral'}>
            {amenityTypeLabel[amenity.amenity_type ?? ''] ?? amenity.amenity_type ?? 'N/A'}
          </Badge>
        </div>
        {amenity.description && (
          <p className="mt-2 line-clamp-2 text-sm text-gray-600">{amenity.description}</p>
        )}
        <div className="mt-3 space-y-1 text-sm text-gray-500">
          {amenity.location && <p>Ubicacion: {amenity.location}</p>}
          {amenity.capacity != null && <p>Capacidad: {amenity.capacity} personas</p>}
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {amenity.requires_reservation && (
            <Badge variant="info">Reservable</Badge>
          )}
        </div>
      </div>
      <div className="mt-4 flex items-center justify-between border-t border-gray-100 pt-4">
        <label className="flex items-center gap-2 text-sm text-gray-600">
          <input
            type="checkbox"
            checked={amenity.status === 'active'}
            onChange={(e) => onToggleActive(amenity.id, e.target.checked)}
            className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
          />
          {amenity.status === 'active' ? 'Activa' : 'Inactiva'}
        </label>
        <Link
          href={`/operations/amenities/${amenity.id}`}
          className="text-sm font-medium text-indigo-600 hover:text-indigo-800"
        >
          Ver detalle
        </Link>
      </div>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/*  Page component                                                    */
/* ------------------------------------------------------------------ */

export default function AmenitiesPage() {
  const [showCreateForm, setShowCreateForm] = useState(false);

  // Form state
  const [formName, setFormName] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formType, setFormType] = useState('other');
  const [formLocation, setFormLocation] = useState('');
  const [formCapacity, setFormCapacity] = useState('');
  const [formReservable, setFormReservable] = useState(true);

  const { data: amenities, isLoading } = useAmenities();
  const createAmenity = useCreateAmenity();
  const updateAmenity = useUpdateAmenity();

  const resetForm = useCallback(() => {
    setFormName('');
    setFormDescription('');
    setFormType('other');
    setFormLocation('');
    setFormCapacity('');
    setFormReservable(true);
  }, []);

  const handleCreate = useCallback(() => {
    if (!formName) return;
    createAmenity.mutate(
      {
        name: formName,
        description: formDescription || undefined,
        amenity_type: formType,
        location: formLocation || undefined,
        capacity: formCapacity ? parseInt(formCapacity, 10) : undefined,
        requires_reservation: formReservable,
      },
      {
        onSuccess: () => {
          resetForm();
          setShowCreateForm(false);
        },
      }
    );
  }, [formName, formDescription, formType, formLocation, formCapacity, formReservable, createAmenity, resetForm]);

  const handleToggleActive = useCallback(
    (id: string, active: boolean) => {
      updateAmenity.mutate({ id, status: active ? 'active' : 'inactive' });
    },
    [updateAmenity]
  );

  if (isLoading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-gray-900">Amenidades</h1>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-48 animate-pulse rounded-xl bg-gray-100" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-gray-900">Amenidades</h1>
          {amenities && (
            <Badge variant="neutral">{amenities.length}</Badge>
          )}
        </div>
        <Button onClick={() => setShowCreateForm(!showCreateForm)}>
          {showCreateForm ? 'Cancelar' : 'Nueva Amenidad'}
        </Button>
      </div>

      {/* Create form */}
      {showCreateForm && (
        <Card>
          <h3 className="mb-4 text-lg font-semibold text-gray-900">
            Nueva amenidad
          </h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Nombre *
              </label>
              <input
                type="text"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="Nombre de la amenidad"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Tipo
              </label>
              <select
                value={formType}
                onChange={(e) => setFormType(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              >
                {AMENITY_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {amenityTypeLabel[t]}
                  </option>
                ))}
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Descripcion
              </label>
              <textarea
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
                rows={2}
                placeholder="Descripcion opcional..."
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Ubicacion
              </label>
              <input
                type="text"
                value={formLocation}
                onChange={(e) => setFormLocation(e.target.value)}
                placeholder="Ej: Area comun, Planta baja..."
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Capacidad
              </label>
              <input
                type="number"
                value={formCapacity}
                onChange={(e) => setFormCapacity(e.target.value)}
                min="1"
                placeholder="Numero de personas"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
            <div className="flex items-end gap-6">
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={formReservable}
                  onChange={(e) => setFormReservable(e.target.checked)}
                  className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                />
                Requiere reservacion
              </label>
            </div>
            <div className="flex justify-end gap-3 sm:col-span-2">
              <Button
                variant="secondary"
                onClick={() => {
                  resetForm();
                  setShowCreateForm(false);
                }}
              >
                Cancelar
              </Button>
              <Button
                onClick={handleCreate}
                disabled={!formName}
                isLoading={createAmenity.isPending}
              >
                Crear
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* Amenity cards grid */}
      {amenities && amenities.length === 0 ? (
        <Card>
          <div className="py-8 text-center text-sm text-gray-500">
            No hay amenidades registradas. Crea la primera con el boton de arriba.
          </div>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {amenities?.map((amenity) => (
            <AmenityCard
              key={amenity.id}
              amenity={amenity}
              onToggleActive={handleToggleActive}
            />
          ))}
        </div>
      )}
    </div>
  );
}
