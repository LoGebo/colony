'use client';

export const dynamic = 'force-dynamic';

import { useState, useCallback, use } from 'react';
import Link from 'next/link';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { AmenityUtilizationChart } from '@/components/charts/AmenityUtilizationChart';
import {
  useAmenity,
  useUpdateAmenity,
  useAmenityUtilization,
  useCreateAmenityRule,
  useUpdateAmenityRule,
  type AmenityRule,
} from '@/hooks/useAmenities';

/* ------------------------------------------------------------------ */
/*  Label maps                                                        */
/* ------------------------------------------------------------------ */

const amenityTypeLabel: Record<string, string> = {
  pool: 'Alberca',
  gym: 'Gimnasio',
  salon: 'Salon',
  court: 'Cancha',
  bbq: 'Asador',
  playground: 'Area de juegos',
  parking: 'Estacionamiento',
  other: 'Otro',
};

const amenityTypeVariant: Record<string, 'success' | 'info' | 'warning' | 'neutral'> = {
  pool: 'info',
  gym: 'success',
  salon: 'warning',
  court: 'info',
  bbq: 'warning',
  playground: 'success',
  parking: 'neutral',
  other: 'neutral',
};

const ruleTypeLabel: Record<string, string> = {
  max_duration: 'Duracion maxima',
  min_advance: 'Anticipacion minima',
  max_advance: 'Anticipacion maxima',
  max_concurrent: 'Concurrencia maxima',
  blackout_period: 'Periodo bloqueado',
  owner_only: 'Solo propietarios',
  quota_per_period: 'Cuota por periodo',
  min_duration: 'Duracion minima',
  cancellation_deadline: 'Plazo cancelacion',
  require_deposit: 'Requiere deposito',
};

const RULE_TYPES = Object.keys(ruleTypeLabel);
const AMENITY_TYPES = ['pool', 'gym', 'salon', 'court', 'bbq', 'playground', 'parking', 'other'];

/* ------------------------------------------------------------------ */
/*  Default date range for utilization (last 30 days)                 */
/* ------------------------------------------------------------------ */

function getDefaultUtilizationRange() {
  const today = new Date();
  const monthAgo = new Date(today);
  monthAgo.setDate(monthAgo.getDate() - 30);
  const fmt = (d: Date) => d.toISOString().split('T')[0];
  return { dateFrom: fmt(monthAgo), dateTo: fmt(today) };
}

/* ------------------------------------------------------------------ */
/*  Rule row component                                                */
/* ------------------------------------------------------------------ */

function RuleRow({
  rule,
  onToggleActive,
}: {
  rule: AmenityRule;
  onToggleActive: (id: string, active: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-gray-100 px-4 py-3">
      <div>
        <span className="text-sm font-medium text-gray-900">
          {ruleTypeLabel[rule.rule_type] ?? rule.rule_type}
        </span>
        <p className="mt-0.5 text-xs text-gray-500">
          {rule.rule_value ? JSON.stringify(rule.rule_value) : '-'}
        </p>
        <p className="text-xs text-gray-400">Prioridad: {rule.priority ?? '-'}</p>
      </div>
      <label className="flex items-center gap-2 text-sm text-gray-600">
        <input
          type="checkbox"
          checked={rule.is_active ?? false}
          onChange={(e) => onToggleActive(rule.id, e.target.checked)}
          className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
        />
        {rule.is_active ? 'Activa' : 'Inactiva'}
      </label>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Page component                                                    */
/* ------------------------------------------------------------------ */

export default function AmenityDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);

  const { data: amenity, isLoading } = useAmenity(id);
  const updateAmenity = useUpdateAmenity();
  const createRule = useCreateAmenityRule();
  const updateRule = useUpdateAmenityRule();

  // Edit mode
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editType, setEditType] = useState('');
  const [editLocation, setEditLocation] = useState('');
  const [editCapacity, setEditCapacity] = useState('');
  const [editReservable, setEditReservable] = useState(false);
  const [editApproval, setEditApproval] = useState(false);

  // Add rule form
  const [showRuleForm, setShowRuleForm] = useState(false);
  const [ruleType, setRuleType] = useState(RULE_TYPES[0]);
  const [ruleValue, setRuleValue] = useState('');
  const [rulePriority, setRulePriority] = useState('1');
  const [ruleActive, setRuleActive] = useState(true);

  // Utilization date range
  const defaults = getDefaultUtilizationRange();
  const [utilDateFrom, setUtilDateFrom] = useState(defaults.dateFrom);
  const [utilDateTo, setUtilDateTo] = useState(defaults.dateTo);

  const { data: reservations } = useAmenityUtilization(id, utilDateFrom, utilDateTo);

  const startEditing = useCallback(() => {
    if (!amenity) return;
    setEditName(amenity.name);
    setEditDescription(amenity.description ?? '');
    setEditType(amenity.amenity_type ?? 'other');
    setEditLocation(amenity.location ?? '');
    setEditCapacity(amenity.capacity?.toString() ?? '');
    setEditReservable(amenity.is_reservable ?? false);
    setEditApproval(amenity.requires_approval ?? false);
    setIsEditing(true);
  }, [amenity]);

  const handleSaveEdit = useCallback(() => {
    if (!amenity || !editName) return;
    updateAmenity.mutate(
      {
        id: amenity.id,
        name: editName,
        description: editDescription || undefined,
        amenity_type: editType,
        location: editLocation || undefined,
        capacity: editCapacity ? parseInt(editCapacity, 10) : undefined,
        is_reservable: editReservable,
        requires_approval: editApproval,
      },
      { onSuccess: () => setIsEditing(false) }
    );
  }, [amenity, editName, editDescription, editType, editLocation, editCapacity, editReservable, editApproval, updateAmenity]);

  const handleAddRule = useCallback(() => {
    if (!amenity) return;
    let parsedValue: Record<string, unknown>;
    try {
      parsedValue = JSON.parse(ruleValue || '{}');
    } catch {
      parsedValue = { value: ruleValue };
    }

    createRule.mutate(
      {
        amenity_id: amenity.id,
        rule_type: ruleType,
        rule_value: parsedValue,
        priority: parseInt(rulePriority, 10) || 1,
        is_active: ruleActive,
      },
      {
        onSuccess: () => {
          setShowRuleForm(false);
          setRuleType(RULE_TYPES[0]);
          setRuleValue('');
          setRulePriority('1');
          setRuleActive(true);
        },
      }
    );
  }, [amenity, ruleType, ruleValue, rulePriority, ruleActive, createRule]);

  const handleToggleRuleActive = useCallback(
    (ruleId: string, active: boolean) => {
      updateRule.mutate({ id: ruleId, is_active: active });
    },
    [updateRule]
  );

  // Compute utilization summary
  const totalBookings = reservations?.length ?? 0;
  const daysInRange = Math.max(
    1,
    Math.ceil(
      (new Date(utilDateTo).getTime() - new Date(utilDateFrom).getTime()) /
        (1000 * 60 * 60 * 24)
    ) + 1
  );
  const bookingRate = (totalBookings / daysInRange).toFixed(1);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-48 animate-pulse rounded bg-gray-100" />
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="h-64 animate-pulse rounded-xl bg-gray-100" />
          <div className="h-64 animate-pulse rounded-xl bg-gray-100" />
        </div>
      </div>
    );
  }

  if (!amenity) {
    return (
      <div className="space-y-4">
        <Link
          href="/operations/amenities"
          className="text-sm text-indigo-600 hover:text-indigo-800"
        >
          Volver a amenidades
        </Link>
        <p className="text-gray-500">Amenidad no encontrada.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Back link + header */}
      <Link
        href="/operations/amenities"
        className="inline-block text-sm text-indigo-600 hover:text-indigo-800"
      >
        Volver a amenidades
      </Link>

      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-bold text-gray-900">{amenity.name}</h1>
        <Badge variant={amenityTypeVariant[amenity.amenity_type ?? ''] ?? 'neutral'}>
          {amenityTypeLabel[amenity.amenity_type ?? ''] ?? amenity.amenity_type ?? 'N/A'}
        </Badge>
        <Badge variant={amenity.is_active ? 'success' : 'danger'}>
          {amenity.is_active ? 'Activa' : 'Inactiva'}
        </Badge>
      </div>

      {/* Two-column layout */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Left column: details + rules */}
        <div className="space-y-6">
          {/* Details card */}
          <Card>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">Detalles</h2>
              {!isEditing && (
                <Button variant="secondary" size="sm" onClick={startEditing}>
                  Editar
                </Button>
              )}
            </div>

            {isEditing ? (
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-600">Nombre</label>
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-600">Tipo</label>
                  <select
                    value={editType}
                    onChange={(e) => setEditType(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  >
                    {AMENITY_TYPES.map((t) => (
                      <option key={t} value={t}>{amenityTypeLabel[t]}</option>
                    ))}
                  </select>
                </div>
                <div className="sm:col-span-2">
                  <label className="mb-1 block text-xs font-medium text-gray-600">Descripcion</label>
                  <textarea
                    value={editDescription}
                    onChange={(e) => setEditDescription(e.target.value)}
                    rows={2}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-600">Ubicacion</label>
                  <input
                    type="text"
                    value={editLocation}
                    onChange={(e) => setEditLocation(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-600">Capacidad</label>
                  <input
                    type="number"
                    value={editCapacity}
                    onChange={(e) => setEditCapacity(e.target.value)}
                    min="1"
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
                <div className="flex items-end gap-4">
                  <label className="flex items-center gap-2 text-sm text-gray-700">
                    <input
                      type="checkbox"
                      checked={editReservable}
                      onChange={(e) => setEditReservable(e.target.checked)}
                      className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                    />
                    Reservable
                  </label>
                  <label className="flex items-center gap-2 text-sm text-gray-700">
                    <input
                      type="checkbox"
                      checked={editApproval}
                      onChange={(e) => setEditApproval(e.target.checked)}
                      className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                    />
                    Aprobacion
                  </label>
                </div>
                <div className="flex justify-end gap-2 sm:col-span-2">
                  <Button variant="secondary" size="sm" onClick={() => setIsEditing(false)}>
                    Cancelar
                  </Button>
                  <Button
                    size="sm"
                    onClick={handleSaveEdit}
                    disabled={!editName}
                    isLoading={updateAmenity.isPending}
                  >
                    Guardar
                  </Button>
                </div>
              </div>
            ) : (
              <dl className="grid gap-3 sm:grid-cols-2">
                <div>
                  <dt className="text-xs text-gray-500">Descripcion</dt>
                  <dd className="text-sm text-gray-900">{amenity.description || '-'}</dd>
                </div>
                <div>
                  <dt className="text-xs text-gray-500">Ubicacion</dt>
                  <dd className="text-sm text-gray-900">{amenity.location || '-'}</dd>
                </div>
                <div>
                  <dt className="text-xs text-gray-500">Capacidad</dt>
                  <dd className="text-sm text-gray-900">
                    {amenity.capacity != null ? `${amenity.capacity} personas` : '-'}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-gray-500">Tipo</dt>
                  <dd className="text-sm text-gray-900">
                    {amenityTypeLabel[amenity.amenity_type ?? ''] ?? amenity.amenity_type ?? '-'}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-gray-500">Reservable</dt>
                  <dd className="text-sm text-gray-900">{amenity.is_reservable ? 'Si' : 'No'}</dd>
                </div>
                <div>
                  <dt className="text-xs text-gray-500">Requiere aprobacion</dt>
                  <dd className="text-sm text-gray-900">{amenity.requires_approval ? 'Si' : 'No'}</dd>
                </div>
              </dl>
            )}
          </Card>

          {/* Rules card */}
          <Card>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">Reglas</h2>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setShowRuleForm(!showRuleForm)}
              >
                {showRuleForm ? 'Cancelar' : 'Agregar regla'}
              </Button>
            </div>

            {/* Add rule form */}
            {showRuleForm && (
              <div className="mb-4 rounded-lg border border-indigo-200 bg-indigo-50 p-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-gray-600">
                      Tipo de regla
                    </label>
                    <select
                      value={ruleType}
                      onChange={(e) => setRuleType(e.target.value)}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    >
                      {RULE_TYPES.map((rt) => (
                        <option key={rt} value={rt}>
                          {ruleTypeLabel[rt]}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-gray-600">
                      Prioridad
                    </label>
                    <input
                      type="number"
                      value={rulePriority}
                      onChange={(e) => setRulePriority(e.target.value)}
                      min="1"
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="mb-1 block text-xs font-medium text-gray-600">
                      Valor (JSON o texto)
                    </label>
                    <input
                      type="text"
                      value={ruleValue}
                      onChange={(e) => setRuleValue(e.target.value)}
                      placeholder='Ej: {"minutes": 120} o "2 hours"'
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                  </div>
                  <div className="flex items-center gap-4 sm:col-span-2">
                    <label className="flex items-center gap-2 text-sm text-gray-700">
                      <input
                        type="checkbox"
                        checked={ruleActive}
                        onChange={(e) => setRuleActive(e.target.checked)}
                        className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                      />
                      Activa
                    </label>
                    <div className="flex-1" />
                    <Button
                      size="sm"
                      onClick={handleAddRule}
                      isLoading={createRule.isPending}
                    >
                      Agregar
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {/* Existing rules */}
            {amenity.amenity_rules && amenity.amenity_rules.length > 0 ? (
              <div className="space-y-2">
                {amenity.amenity_rules
                  .sort((a, b) => (a.priority ?? 0) - (b.priority ?? 0))
                  .map((rule) => (
                    <RuleRow
                      key={rule.id}
                      rule={rule}
                      onToggleActive={handleToggleRuleActive}
                    />
                  ))}
              </div>
            ) : (
              <p className="text-sm text-gray-400">
                No hay reglas configuradas para esta amenidad.
              </p>
            )}
          </Card>
        </div>

        {/* Right column: utilization */}
        <div className="space-y-6">
          <Card>
            <h2 className="mb-4 text-lg font-semibold text-gray-900">
              Reporte de Utilizacion
            </h2>

            {/* Date range picker */}
            <div className="mb-4 flex flex-wrap items-end gap-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600">Desde</label>
                <input
                  type="date"
                  value={utilDateFrom}
                  onChange={(e) => setUtilDateFrom(e.target.value)}
                  className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600">Hasta</label>
                <input
                  type="date"
                  value={utilDateTo}
                  onChange={(e) => setUtilDateTo(e.target.value)}
                  className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>
            </div>

            {/* Summary KPIs */}
            <div className="mb-4 grid grid-cols-2 gap-4">
              <div className="rounded-lg border border-gray-100 p-4">
                <p className="text-xs text-gray-500">Total reservaciones</p>
                <p className="mt-1 text-2xl font-bold text-gray-900">{totalBookings}</p>
              </div>
              <div className="rounded-lg border border-gray-100 p-4">
                <p className="text-xs text-gray-500">Tasa diaria</p>
                <p className="mt-1 text-2xl font-bold text-gray-900">
                  {bookingRate}
                  <span className="text-sm font-normal text-gray-500"> /dia</span>
                </p>
              </div>
            </div>

            {/* Chart */}
            <AmenityUtilizationChart reservations={reservations ?? []} />
          </Card>
        </div>
      </div>
    </div>
  );
}
