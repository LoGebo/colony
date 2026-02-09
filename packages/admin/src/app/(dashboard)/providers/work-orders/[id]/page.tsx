'use client';

export const dynamic = 'force-dynamic';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import {
  useWorkOrderDetail,
  useUpdateWorkOrder,
  useRateWorkOrder,
  WORK_ORDER_TRANSITIONS,
} from '@/hooks/useWorkOrders';
import { formatDate, formatCurrency } from '@/lib/formatters';

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
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

const TRANSITION_LABELS: Record<string, string> = {
  submitted: 'Enviar',
  approved: 'Aprobar',
  scheduled: 'Programar',
  in_progress: 'Iniciar',
  completed: 'Completar',
  cancelled: 'Cancelar',
};

const TRANSITION_VARIANTS: Record<string, 'primary' | 'secondary' | 'danger'> = {
  submitted: 'primary',
  approved: 'primary',
  scheduled: 'primary',
  in_progress: 'primary',
  completed: 'primary',
  cancelled: 'danger',
};

const inputClass =
  'w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500';

/* ------------------------------------------------------------------ */
/*  Status Transition Controls                                         */
/* ------------------------------------------------------------------ */

function StatusTransitions({
  workOrderId,
  currentStatus,
}: {
  workOrderId: string;
  currentStatus: string;
}) {
  const updateWorkOrder = useUpdateWorkOrder();
  const [showScheduleForm, setShowScheduleForm] = useState(false);
  const [showCompleteForm, setShowCompleteForm] = useState(false);
  const [scheduledDate, setScheduledDate] = useState('');
  const [actualCost, setActualCost] = useState('');
  const [completionNotes, setCompletionNotes] = useState('');

  const transitions = WORK_ORDER_TRANSITIONS[currentStatus] ?? [];

  const handleTransition = (newStatus: string) => {
    if (newStatus === 'scheduled') {
      setShowScheduleForm(true);
      return;
    }
    if (newStatus === 'completed') {
      setShowCompleteForm(true);
      return;
    }
    updateWorkOrder.mutate({ id: workOrderId, status: newStatus });
  };

  const handleSchedule = (e: React.FormEvent) => {
    e.preventDefault();
    updateWorkOrder.mutate(
      {
        id: workOrderId,
        status: 'scheduled',
        scheduled_date: scheduledDate || null,
      },
      { onSuccess: () => setShowScheduleForm(false) }
    );
  };

  const handleComplete = (e: React.FormEvent) => {
    e.preventDefault();
    updateWorkOrder.mutate(
      {
        id: workOrderId,
        status: 'completed',
        completed_date: new Date().toISOString().split('T')[0],
        actual_cost: actualCost ? parseFloat(actualCost) : null,
        completion_notes: completionNotes.trim() || null,
      },
      { onSuccess: () => setShowCompleteForm(false) }
    );
  };

  if (transitions.length === 0) return null;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {transitions.map((next) => (
          <Button
            key={next}
            variant={TRANSITION_VARIANTS[next] ?? 'secondary'}
            size="sm"
            onClick={() => handleTransition(next)}
            isLoading={updateWorkOrder.isPending}
          >
            {TRANSITION_LABELS[next] ?? next}
          </Button>
        ))}
      </div>

      {/* Schedule date form */}
      {showScheduleForm && (
        <Card>
          <form onSubmit={handleSchedule} className="space-y-3">
            <h4 className="font-medium text-gray-900">Programar Orden</h4>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Fecha programada</label>
              <input
                type="date"
                value={scheduledDate}
                onChange={(e) => setScheduledDate(e.target.value)}
                className={inputClass}
              />
            </div>
            <div className="flex gap-2">
              <Button type="submit" size="sm" isLoading={updateWorkOrder.isPending}>
                Confirmar
              </Button>
              <Button type="button" variant="secondary" size="sm" onClick={() => setShowScheduleForm(false)}>
                Cancelar
              </Button>
            </div>
          </form>
        </Card>
      )}

      {/* Complete form */}
      {showCompleteForm && (
        <Card>
          <form onSubmit={handleComplete} className="space-y-3">
            <h4 className="font-medium text-gray-900">Completar Orden</h4>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Costo real (MXN)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={actualCost}
                  onChange={(e) => setActualCost(e.target.value)}
                  className={inputClass}
                  placeholder="0.00"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="mb-1 block text-sm font-medium text-gray-700">Notas de finalizacion</label>
                <textarea
                  value={completionNotes}
                  onChange={(e) => setCompletionNotes(e.target.value)}
                  className={inputClass}
                  rows={2}
                  placeholder="Detalles del trabajo realizado..."
                />
              </div>
            </div>
            <div className="flex gap-2">
              <Button type="submit" size="sm" isLoading={updateWorkOrder.isPending}>
                Completar
              </Button>
              <Button type="button" variant="secondary" size="sm" onClick={() => setShowCompleteForm(false)}>
                Cancelar
              </Button>
            </div>
          </form>
        </Card>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Rating Section                                                     */
/* ------------------------------------------------------------------ */

function RatingSection({
  workOrderId,
  currentRating,
  currentNotes,
}: {
  workOrderId: string;
  currentRating: number | null;
  currentNotes: string | null;
}) {
  const rateWorkOrder = useRateWorkOrder();
  const [rating, setRating] = useState(currentRating ?? 0);
  const [notes, setNotes] = useState(currentNotes ?? '');
  const [hoveredStar, setHoveredStar] = useState(0);

  const handleRate = () => {
    if (rating < 1 || rating > 5) return;
    rateWorkOrder.mutate({
      id: workOrderId,
      rating,
      rating_notes: notes.trim() || undefined,
    });
  };

  return (
    <Card>
      <h3 className="text-lg font-semibold text-gray-900">Calificacion</h3>
      <div className="mt-3 space-y-3">
        {/* Star selector */}
        <div className="flex items-center gap-1">
          {[1, 2, 3, 4, 5].map((star) => (
            <button
              key={star}
              type="button"
              onClick={() => setRating(star)}
              onMouseEnter={() => setHoveredStar(star)}
              onMouseLeave={() => setHoveredStar(0)}
              className="text-2xl transition hover:scale-110"
            >
              <span
                className={
                  star <= (hoveredStar || rating) ? 'text-yellow-400' : 'text-gray-300'
                }
              >
                ★
              </span>
            </button>
          ))}
          {rating > 0 && (
            <span className="ml-2 text-sm text-gray-500">{rating}/5</span>
          )}
        </div>

        {/* Notes */}
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className={inputClass}
          rows={2}
          placeholder="Comentarios sobre el trabajo..."
        />

        <Button
          size="sm"
          onClick={handleRate}
          disabled={rating < 1}
          isLoading={rateWorkOrder.isPending}
        >
          {currentRating ? 'Actualizar Calificacion' : 'Guardar Calificacion'}
        </Button>
      </div>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/*  Notes Section                                                      */
/* ------------------------------------------------------------------ */

function NotesSection({ workOrderId, adminNotes, providerNotes }: {
  workOrderId: string;
  adminNotes: string | null;
  providerNotes: string | null;
}) {
  const updateWorkOrder = useUpdateWorkOrder();
  const [editingAdmin, setEditingAdmin] = useState(false);
  const [editingProvider, setEditingProvider] = useState(false);
  const [adminText, setAdminText] = useState(adminNotes ?? '');
  const [providerText, setProviderText] = useState(providerNotes ?? '');

  const saveAdminNotes = () => {
    updateWorkOrder.mutate(
      { id: workOrderId, admin_notes: adminText.trim() || null },
      { onSuccess: () => setEditingAdmin(false) }
    );
  };

  const saveProviderNotes = () => {
    updateWorkOrder.mutate(
      { id: workOrderId, provider_notes: providerText.trim() || null },
      { onSuccess: () => setEditingProvider(false) }
    );
  };

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <Card>
        <div className="flex items-center justify-between">
          <h4 className="font-medium text-gray-900">Notas Admin</h4>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setEditingAdmin(!editingAdmin)}
          >
            {editingAdmin ? 'Cancelar' : 'Editar'}
          </Button>
        </div>
        {editingAdmin ? (
          <div className="mt-2 space-y-2">
            <textarea
              value={adminText}
              onChange={(e) => setAdminText(e.target.value)}
              className={inputClass}
              rows={3}
            />
            <Button size="sm" onClick={saveAdminNotes} isLoading={updateWorkOrder.isPending}>
              Guardar
            </Button>
          </div>
        ) : (
          <p className="mt-2 whitespace-pre-wrap text-sm text-gray-600">
            {adminNotes || 'Sin notas'}
          </p>
        )}
      </Card>

      <Card>
        <div className="flex items-center justify-between">
          <h4 className="font-medium text-gray-900">Notas Proveedor</h4>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setEditingProvider(!editingProvider)}
          >
            {editingProvider ? 'Cancelar' : 'Editar'}
          </Button>
        </div>
        {editingProvider ? (
          <div className="mt-2 space-y-2">
            <textarea
              value={providerText}
              onChange={(e) => setProviderText(e.target.value)}
              className={inputClass}
              rows={3}
            />
            <Button size="sm" onClick={saveProviderNotes} isLoading={updateWorkOrder.isPending}>
              Guardar
            </Button>
          </div>
        ) : (
          <p className="mt-2 whitespace-pre-wrap text-sm text-gray-600">
            {providerNotes || 'Sin notas'}
          </p>
        )}
      </Card>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main Page                                                          */
/* ------------------------------------------------------------------ */

export default function WorkOrderDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const { data: wo, isLoading } = useWorkOrderDetail(id);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-48 animate-pulse rounded bg-gray-200" />
        <div className="h-64 animate-pulse rounded-lg bg-gray-100" />
      </div>
    );
  }

  if (!wo) {
    return (
      <div className="py-12 text-center">
        <p className="text-gray-500">Orden de trabajo no encontrada</p>
        <Link href="/providers/work-orders" className="mt-2 text-sm text-indigo-600 hover:text-indigo-800">
          Volver a ordenes
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/providers/work-orders" className="text-sm text-gray-500 hover:text-gray-700">
          Ordenes de Trabajo
        </Link>
        <span className="text-gray-400">/</span>
        <h1 className="text-2xl font-bold text-gray-900">{wo.work_order_number}</h1>
        <Badge variant={STATUS_VARIANTS[wo.status] ?? 'neutral'}>
          {STATUS_LABELS[wo.status] ?? wo.status}
        </Badge>
      </div>

      {/* Top section: title + provider + unit */}
      <Card>
        <div className="space-y-3">
          <h2 className="text-xl font-semibold text-gray-900">{wo.title}</h2>
          <div className="flex flex-wrap gap-4 text-sm text-gray-600">
            <div className="flex items-center gap-1">
              <span className="font-medium text-gray-500">Proveedor:</span>
              {wo.providers?.company_name ? (
                <Link
                  href={`/providers/${wo.provider_id}`}
                  className="text-indigo-600 hover:text-indigo-800"
                >
                  {wo.providers.company_name}
                </Link>
              ) : (
                '-'
              )}
            </div>
            {wo.units?.unit_number && (
              <div className="flex items-center gap-1">
                <span className="font-medium text-gray-500">Unidad:</span>
                <span>{wo.units.unit_number}</span>
              </div>
            )}
            {wo.category && (
              <div className="flex items-center gap-1">
                <span className="font-medium text-gray-500">Categoria:</span>
                <span>{wo.category}</span>
              </div>
            )}
          </div>
        </div>
      </Card>

      {/* Status transitions */}
      <StatusTransitions workOrderId={wo.id} currentStatus={wo.status} />

      {/* Detail fields */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Card>
          <h3 className="text-lg font-semibold text-gray-900">Detalle</h3>
          <dl className="mt-3 space-y-3">
            <div>
              <dt className="text-sm font-medium text-gray-500">Descripcion</dt>
              <dd className="mt-1 whitespace-pre-wrap text-sm text-gray-900">{wo.description}</dd>
            </div>
            {wo.location_description && (
              <div>
                <dt className="text-sm font-medium text-gray-500">Ubicacion</dt>
                <dd className="mt-1 text-sm text-gray-900">{wo.location_description}</dd>
              </div>
            )}
            {wo.completion_notes && (
              <div>
                <dt className="text-sm font-medium text-gray-500">Notas de finalizacion</dt>
                <dd className="mt-1 text-sm text-gray-900">{wo.completion_notes}</dd>
              </div>
            )}
          </dl>
        </Card>

        <Card>
          <h3 className="text-lg font-semibold text-gray-900">Fechas y Costos</h3>
          <dl className="mt-3 space-y-3">
            {wo.requested_date && (
              <div className="flex items-center justify-between">
                <dt className="text-sm font-medium text-gray-500">Solicitada</dt>
                <dd className="text-sm text-gray-900">{formatDate(wo.requested_date)}</dd>
              </div>
            )}
            {wo.scheduled_date && (
              <div className="flex items-center justify-between">
                <dt className="text-sm font-medium text-gray-500">Programada</dt>
                <dd className="text-sm text-gray-900">{formatDate(wo.scheduled_date)}</dd>
              </div>
            )}
            {wo.completed_date && (
              <div className="flex items-center justify-between">
                <dt className="text-sm font-medium text-gray-500">Completada</dt>
                <dd className="text-sm text-gray-900">{formatDate(wo.completed_date)}</dd>
              </div>
            )}
            <div className="border-t border-gray-200 pt-3">
              <div className="flex items-center justify-between">
                <dt className="text-sm font-medium text-gray-500">Costo estimado</dt>
                <dd className="text-sm text-gray-900">
                  {wo.estimated_cost != null
                    ? formatCurrency(Number(wo.estimated_cost))
                    : '-'}
                </dd>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-sm font-medium text-gray-500">Costo real</dt>
              <dd className="text-sm font-semibold text-gray-900">
                {wo.actual_cost != null
                  ? formatCurrency(Number(wo.actual_cost))
                  : '-'}
              </dd>
            </div>
            {wo.estimated_cost != null && wo.actual_cost != null && (
              <div className="flex items-center justify-between">
                <dt className="text-sm font-medium text-gray-500">Diferencia</dt>
                <dd
                  className={`text-sm font-semibold ${
                    Number(wo.actual_cost) > Number(wo.estimated_cost)
                      ? 'text-red-600'
                      : 'text-green-600'
                  }`}
                >
                  {formatCurrency(
                    Number(wo.actual_cost) - Number(wo.estimated_cost)
                  )}
                </dd>
              </div>
            )}
            <div className="flex items-center justify-between">
              <dt className="text-sm font-medium text-gray-500">Moneda</dt>
              <dd className="text-sm text-gray-900">{wo.currency}</dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-sm font-medium text-gray-500">Creada</dt>
              <dd className="text-sm text-gray-900">{formatDate(wo.created_at)}</dd>
            </div>
          </dl>
        </Card>
      </div>

      {/* Rating (only when completed) */}
      {wo.status === 'completed' && (
        <RatingSection
          workOrderId={wo.id}
          currentRating={wo.rating}
          currentNotes={wo.rating_notes}
        />
      )}

      {/* Admin and provider notes */}
      <NotesSection
        workOrderId={wo.id}
        adminNotes={wo.admin_notes}
        providerNotes={wo.provider_notes}
      />
    </div>
  );
}
