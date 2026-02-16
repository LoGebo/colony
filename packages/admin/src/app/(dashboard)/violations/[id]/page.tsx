'use client';

export const dynamic = 'force-dynamic';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import {
  useViolationDetail,
  useViolationSanctions,
  useViolationAppeals,
  useCreateSanction,
  useUpdateViolationStatus,
  useResolveAppeal,
} from '@/hooks/useViolations';
import { formatDate, formatCurrency } from '@/lib/formatters';

const severityVariant: Record<string, 'info' | 'warning' | 'danger'> = {
  minor: 'info',
  moderate: 'warning',
  major: 'danger',
  severe: 'danger',
};

const severityLabel: Record<string, string> = {
  minor: 'Menor',
  moderate: 'Moderada',
  major: 'Grave',
  severe: 'Critica',
};

const statusVariant: Record<string, 'warning' | 'info' | 'success' | 'neutral'> = {
  reported: 'warning',
  under_review: 'info',
  confirmed: 'info',
  sanctioned: 'danger' as 'warning',
  appealed: 'warning',
  appeal_denied: 'neutral',
  appeal_granted: 'success',
  closed: 'success',
  dismissed: 'neutral',
};

const statusLabel: Record<string, string> = {
  reported: 'Reportada',
  under_review: 'En revision',
  confirmed: 'Confirmada',
  sanctioned: 'Sancionada',
  appealed: 'Apelada',
  appeal_denied: 'Apelacion denegada',
  appeal_granted: 'Apelacion aprobada',
  closed: 'Cerrada',
  dismissed: 'Desestimada',
};

const sanctionTypeVariant: Record<string, 'info' | 'warning' | 'danger'> = {
  verbal_warning: 'info',
  written_warning: 'warning',
  fine: 'danger',
  amenity_suspension: 'danger',
  access_restriction: 'danger',
  legal_action: 'danger',
};

const sanctionTypeLabel: Record<string, string> = {
  verbal_warning: 'Advertencia verbal',
  written_warning: 'Advertencia escrita',
  fine: 'Multa',
  amenity_suspension: 'Suspension de amenidad',
  access_restriction: 'Restriccion de acceso',
  legal_action: 'Accion legal',
};

const appealStatusVariant: Record<string, 'warning' | 'success' | 'danger' | 'info'> = {
  pending: 'warning',
  approved: 'success',
  rejected: 'danger',
  partially_approved: 'info',
};

const appealStatusLabel: Record<string, string> = {
  pending: 'Pendiente',
  approved: 'Aprobada',
  rejected: 'Rechazada',
  partially_approved: 'Parcialmente aprobada',
};

export default function ViolationDetailPage() {
  const params = useParams();
  const router = useRouter();
  const violationId = params.id as string;

  const { data: violation, isLoading } = useViolationDetail(violationId);
  const { data: sanctions } = useViolationSanctions(violationId);
  const { data: appeals } = useViolationAppeals(violationId);
  const updateStatusMutation = useUpdateViolationStatus();

  const [showSanctionForm, setShowSanctionForm] = useState(false);
  const [showResolveModal, setShowResolveModal] = useState(false);

  const handleDismiss = async () => {
    if (confirm('¿Desestimar esta infraccion?')) {
      await updateStatusMutation.mutateAsync({
        id: violationId,
        status: 'dismissed',
      });
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-32 animate-pulse rounded bg-gray-100" />
        ))}
      </div>
    );
  }

  if (!violation) {
    return <div className="text-center text-gray-500">Infraccion no encontrada</div>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-gray-900">
              {violation.violation_number}
            </h1>
            <Badge variant={severityVariant[violation.severity] ?? 'neutral'}>
              {severityLabel[violation.severity] ?? violation.severity}
            </Badge>
            <Badge variant={statusVariant[violation.status] ?? 'neutral'}>
              {statusLabel[violation.status] ?? violation.status}
            </Badge>
          </div>
          <p className="mt-1 text-sm text-gray-500">
            Ocurrido: {formatDate(violation.occurred_at)}
          </p>
        </div>
        <div className="flex gap-2">
          {violation.status !== 'closed' && violation.status !== 'dismissed' && (
            <>
              <Button
                variant="primary"
                size="sm"
                onClick={() => setShowResolveModal(true)}
              >
                Resolver
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={handleDismiss}
                isLoading={updateStatusMutation.isPending}
              >
                Desestimar
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Info Card */}
      <Card>
        <h2 className="mb-4 text-lg font-semibold">Informacion General</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <p className="text-sm text-gray-500">Unidad</p>
            <p className="font-medium">{violation.units?.unit_number ?? '-'}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Tipo de Infraccion</p>
            <p className="font-medium">
              {violation.violation_types?.name ?? '-'}
            </p>
            <p className="text-xs text-gray-500">
              {violation.violation_types?.category ?? ''}
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Residente</p>
            <p className="font-medium">
              {violation.residents
                ? `${violation.residents.first_name} ${violation.residents.paternal_surname}`
                : '-'}
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Reincidencia</p>
            <p
              className={`text-lg font-bold ${
                violation.offense_number > 1 ? 'text-red-600' : 'text-gray-600'
              }`}
            >
              #{violation.offense_number}
              {violation.offense_number > 1 && (
                <span className="ml-2 text-sm font-normal text-red-600">
                  Reincidente
                </span>
              )}
            </p>
          </div>
          <div className="sm:col-span-2">
            <p className="text-sm text-gray-500">Descripcion</p>
            <p className="mt-1">{violation.description}</p>
          </div>
          {violation.location && (
            <div>
              <p className="text-sm text-gray-500">Ubicacion</p>
              <p className="font-medium">{violation.location}</p>
            </div>
          )}
          {violation.witness_names && violation.witness_names.length > 0 && (
            <div>
              <p className="text-sm text-gray-500">Testigos</p>
              <p className="font-medium">
                {violation.witness_names.join(', ')}
              </p>
            </div>
          )}
        </div>
      </Card>

      {/* Evidence Card */}
      <Card>
        <h2 className="mb-4 text-lg font-semibold">Evidencia</h2>
        {!violation.photo_urls?.length && !violation.video_urls?.length ? (
          <p className="text-sm text-gray-500">Sin evidencia</p>
        ) : (
          <div className="space-y-4">
            {violation.photo_urls && violation.photo_urls.length > 0 && (
              <div>
                <p className="mb-2 text-sm font-medium text-gray-700">Fotos</p>
                <div className="grid grid-cols-3 gap-3">
                  {violation.photo_urls.map((url, idx) => (
                    <img
                      key={idx}
                      src={url}
                      alt={`Evidencia ${idx + 1}`}
                      className="h-32 w-full rounded object-cover"
                    />
                  ))}
                </div>
              </div>
            )}
            {violation.video_urls && violation.video_urls.length > 0 && (
              <div>
                <p className="mb-2 text-sm font-medium text-gray-700">Videos</p>
                <div className="space-y-1">
                  {violation.video_urls.map((url, idx) => (
                    <a
                      key={idx}
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block text-sm text-indigo-600 hover:text-indigo-800"
                    >
                      Video {idx + 1}
                    </a>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </Card>

      {/* Sanctions Card */}
      <Card>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Sanciones</h2>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setShowSanctionForm(!showSanctionForm)}
          >
            {showSanctionForm ? 'Cancelar' : 'Aplicar Sancion'}
          </Button>
        </div>

        {showSanctionForm && (
          <SanctionForm
            violationId={violationId}
            onSuccess={() => setShowSanctionForm(false)}
          />
        )}

        {sanctions && sanctions.length > 0 ? (
          <div className="space-y-3">
            {sanctions.map((sanction) => (
              <div
                key={sanction.id}
                className="rounded-lg border border-gray-200 p-4"
              >
                <div className="mb-2 flex items-start justify-between">
                  <div>
                    <Badge
                      variant={
                        sanctionTypeVariant[sanction.sanction_type] ?? 'neutral'
                      }
                    >
                      {sanctionTypeLabel[sanction.sanction_type] ??
                        sanction.sanction_type}
                    </Badge>
                    {sanction.fine_amount && (
                      <span className="ml-2 text-lg font-bold text-gray-900">
                        {formatCurrency(sanction.fine_amount)}
                      </span>
                    )}
                  </div>
                  <span className="text-xs text-gray-500">
                    {formatDate(sanction.issued_at)}
                  </span>
                </div>
                <p className="text-sm text-gray-700">{sanction.description}</p>
                {sanction.sanction_type === 'amenity_suspension' &&
                  sanction.suspension_start &&
                  sanction.suspension_end && (
                    <p className="mt-2 text-xs text-gray-500">
                      Suspension: {formatDate(sanction.suspension_start)} -{' '}
                      {formatDate(sanction.suspension_end)}
                    </p>
                  )}
                {sanction.suspended_amenities &&
                  sanction.suspended_amenities.length > 0 && (
                    <p className="mt-1 text-xs text-gray-500">
                      Amenidades suspendidas:{' '}
                      {sanction.suspended_amenities.join(', ')}
                    </p>
                  )}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-gray-500">No hay sanciones aplicadas</p>
        )}
      </Card>

      {/* Appeals Card */}
      <Card>
        <h2 className="mb-4 text-lg font-semibold">Apelaciones</h2>
        {appeals && appeals.length > 0 ? (
          <div className="space-y-3">
            {appeals.map((appeal) => (
              <AppealItem
                key={appeal.id}
                appeal={appeal}
                violationId={violationId}
              />
            ))}
          </div>
        ) : (
          <p className="text-sm text-gray-500">No hay apelaciones registradas</p>
        )}
      </Card>

      {/* Resolve Modal */}
      {showResolveModal && (
        <ResolveModal
          violationId={violationId}
          onClose={() => setShowResolveModal(false)}
        />
      )}
    </div>
  );
}

function SanctionForm({
  violationId,
  onSuccess,
}: {
  violationId: string;
  onSuccess: () => void;
}) {
  const createMutation = useCreateSanction();
  const [formData, setFormData] = useState({
    sanction_type: '',
    description: '',
    fine_amount: '',
    suspension_start: '',
    suspension_end: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    await createMutation.mutateAsync({
      violation_id: violationId,
      sanction_type: formData.sanction_type,
      description: formData.description,
      fine_amount: formData.fine_amount ? Number(formData.fine_amount) : undefined,
      suspension_start: formData.suspension_start || undefined,
      suspension_end: formData.suspension_end || undefined,
    });

    onSuccess();
    setFormData({
      sanction_type: '',
      description: '',
      fine_amount: '',
      suspension_start: '',
      suspension_end: '',
    });
  };

  return (
    <form onSubmit={handleSubmit} className="mb-4 space-y-3 rounded-lg bg-gray-50 p-4">
      <div>
        <label className="block text-sm font-medium text-gray-700">
          Tipo de Sancion *
        </label>
        <select
          required
          value={formData.sanction_type}
          onChange={(e) =>
            setFormData({ ...formData, sanction_type: e.target.value })
          }
          className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
        >
          <option value="">Seleccionar...</option>
          <option value="verbal_warning">Advertencia verbal</option>
          <option value="written_warning">Advertencia escrita</option>
          <option value="fine">Multa</option>
          <option value="amenity_suspension">Suspension de amenidad</option>
          <option value="access_restriction">Restriccion de acceso</option>
          <option value="legal_action">Accion legal</option>
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
          rows={3}
          className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
        />
      </div>

      {formData.sanction_type === 'fine' && (
        <div>
          <label className="block text-sm font-medium text-gray-700">
            Monto de Multa (MXN)
          </label>
          <input
            type="number"
            value={formData.fine_amount}
            onChange={(e) =>
              setFormData({ ...formData, fine_amount: e.target.value })
            }
            min="0"
            step="0.01"
            className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
          />
        </div>
      )}

      {formData.sanction_type === 'amenity_suspension' && (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Inicio de Suspension
            </label>
            <input
              type="date"
              value={formData.suspension_start}
              onChange={(e) =>
                setFormData({ ...formData, suspension_start: e.target.value })
              }
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Fin de Suspension
            </label>
            <input
              type="date"
              value={formData.suspension_end}
              onChange={(e) =>
                setFormData({ ...formData, suspension_end: e.target.value })
              }
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
          </div>
        </div>
      )}

      <Button type="submit" variant="primary" size="sm" isLoading={createMutation.isPending}>
        Aplicar Sancion
      </Button>
    </form>
  );
}

function AppealItem({
  appeal,
  violationId,
}: {
  appeal: any;
  violationId: string;
}) {
  const [showResolveForm, setShowResolveForm] = useState(false);
  const resolveMutation = useResolveAppeal();
  const [formData, setFormData] = useState({
    decision: '',
    hearing_notes: '',
    fine_reduced_to: '',
  });

  const handleResolve = async (e: React.FormEvent) => {
    e.preventDefault();

    await resolveMutation.mutateAsync({
      id: appeal.id,
      violationId,
      decision: formData.decision,
      hearing_notes: formData.hearing_notes || undefined,
      fine_reduced_to: formData.fine_reduced_to
        ? Number(formData.fine_reduced_to)
        : undefined,
    });

    setShowResolveForm(false);
  };

  return (
    <div className="rounded-lg border border-gray-200 p-4">
      <div className="mb-2 flex items-start justify-between">
        <Badge variant={appealStatusVariant[appeal.status] ?? 'neutral'}>
          {appealStatusLabel[appeal.status] ?? appeal.status}
        </Badge>
        {appeal.status === 'pending' && (
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setShowResolveForm(!showResolveForm)}
          >
            {showResolveForm ? 'Cancelar' : 'Resolver Apelacion'}
          </Button>
        )}
      </div>

      <p className="mb-2 text-sm text-gray-700">
        <span className="font-medium">Razon:</span> {appeal.appeal_reason}
      </p>

      {appeal.hearing_date && (
        <p className="text-xs text-gray-500">
          Audiencia: {formatDate(appeal.hearing_date)}
        </p>
      )}

      {appeal.decision && (
        <div className="mt-2 rounded bg-gray-50 p-2">
          <p className="text-sm font-medium">Decision: {appeal.decision}</p>
          {appeal.hearing_notes && (
            <p className="mt-1 text-xs text-gray-600">{appeal.hearing_notes}</p>
          )}
          {appeal.fine_reduced_to && (
            <p className="mt-1 text-xs text-gray-600">
              Multa reducida a: {formatCurrency(appeal.fine_reduced_to)}
            </p>
          )}
        </div>
      )}

      {showResolveForm && (
        <form onSubmit={handleResolve} className="mt-3 space-y-3 rounded bg-gray-50 p-3">
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Decision *
            </label>
            <select
              required
              value={formData.decision}
              onChange={(e) =>
                setFormData({ ...formData, decision: e.target.value })
              }
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            >
              <option value="">Seleccionar...</option>
              <option value="approved">Aprobada</option>
              <option value="rejected">Rechazada</option>
              <option value="partially_approved">Parcialmente aprobada</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">
              Notas de la Audiencia
            </label>
            <textarea
              value={formData.hearing_notes}
              onChange={(e) =>
                setFormData({ ...formData, hearing_notes: e.target.value })
              }
              rows={3}
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
          </div>

          {formData.decision === 'partially_approved' && (
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Multa Reducida (MXN)
              </label>
              <input
                type="number"
                value={formData.fine_reduced_to}
                onChange={(e) =>
                  setFormData({ ...formData, fine_reduced_to: e.target.value })
                }
                min="0"
                step="0.01"
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              />
            </div>
          )}

          <Button type="submit" variant="primary" size="sm" isLoading={resolveMutation.isPending}>
            Guardar Decision
          </Button>
        </form>
      )}
    </div>
  );
}

function ResolveModal({
  violationId,
  onClose,
}: {
  violationId: string;
  onClose: () => void;
}) {
  const updateMutation = useUpdateViolationStatus();
  const [resolutionNotes, setResolutionNotes] = useState('');

  const handleResolve = async () => {
    await updateMutation.mutateAsync({
      id: violationId,
      status: 'closed',
      resolution_notes: resolutionNotes || undefined,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <Card className="w-full max-w-md">
        <h2 className="mb-4 text-lg font-bold">Resolver Infraccion</h2>

        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700">
            Notas de Resolucion
          </label>
          <textarea
            value={resolutionNotes}
            onChange={(e) => setResolutionNotes(e.target.value)}
            rows={4}
            placeholder="Opcional: detalles de como se resolvio..."
            className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
          />
        </div>

        <div className="flex gap-3">
          <Button
            variant="primary"
            onClick={handleResolve}
            isLoading={updateMutation.isPending}
          >
            Resolver
          </Button>
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
        </div>
      </Card>
    </div>
  );
}
