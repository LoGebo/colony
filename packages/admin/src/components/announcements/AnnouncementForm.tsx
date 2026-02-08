'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import type { CreateAnnouncementInput } from '@/hooks/useAnnouncements';

const SEGMENT_OPTIONS = [
  { value: 'all', label: 'Todos' },
  { value: 'owners', label: 'Propietarios' },
  { value: 'tenants', label: 'Inquilinos' },
  { value: 'building', label: 'Por edificio' },
  { value: 'delinquent', label: 'Morosos' },
  { value: 'role', label: 'Por rol' },
] as const;

const ROLE_OPTIONS = [
  { value: 'resident', label: 'Residente' },
  { value: 'guard', label: 'Guardia' },
  { value: 'manager', label: 'Administrador' },
] as const;

interface AnnouncementFormProps {
  onSubmit: (data: CreateAnnouncementInput) => void;
  onCancel: () => void;
  isSubmitting: boolean;
}

export function AnnouncementForm({
  onSubmit,
  onCancel,
  isSubmitting,
}: AnnouncementFormProps) {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [targetSegment, setTargetSegment] = useState('all');
  const [buildingName, setBuildingName] = useState('');
  const [roleName, setRoleName] = useState('resident');
  const [scheduleDate, setScheduleDate] = useState('');
  const [isUrgent, setIsUrgent] = useState(false);
  const [requiresAcknowledgment, setRequiresAcknowledgment] = useState(false);

  const [touched, setTouched] = useState<Record<string, boolean>>({});

  const handleBlur = (field: string) => {
    setTouched((prev) => ({ ...prev, [field]: true }));
  };

  const isValid =
    title.trim() &&
    body.trim() &&
    (targetSegment !== 'building' || buildingName.trim());

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setTouched({ title: true, body: true, buildingName: true });
    if (!isValid) return;

    let target_criteria: Record<string, unknown> | null = null;
    if (targetSegment === 'building') {
      target_criteria = { building: buildingName.trim() };
    } else if (targetSegment === 'role') {
      target_criteria = { role: roleName };
    }

    onSubmit({
      title: title.trim(),
      body: body.trim(),
      target_segment: targetSegment,
      target_criteria,
      publish_at: scheduleDate || null,
      is_urgent: isUrgent,
      requires_acknowledgment: requiresAcknowledgment,
    });
  };

  const isScheduled = !!scheduleDate;

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <h3 className="text-lg font-semibold text-gray-900">Nuevo Aviso</h3>

      {/* Title */}
      <div>
        <label className="block text-sm font-medium text-gray-700">
          Titulo <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={() => handleBlur('title')}
          className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          placeholder="Titulo del aviso"
        />
        {touched.title && !title.trim() && (
          <p className="mt-1 text-xs text-red-600">Campo requerido</p>
        )}
      </div>

      {/* Body */}
      <div>
        <label className="block text-sm font-medium text-gray-700">
          Contenido <span className="text-red-500">*</span>
        </label>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          onBlur={() => handleBlur('body')}
          rows={5}
          className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          placeholder="Escribe el contenido del aviso..."
        />
        <p className="mt-1 text-xs text-gray-400">
          Puedes usar saltos de linea
        </p>
        {touched.body && !body.trim() && (
          <p className="mt-1 text-xs text-red-600">Campo requerido</p>
        )}
      </div>

      {/* Target Segment */}
      <div>
        <label className="block text-sm font-medium text-gray-700">
          Destinatarios
        </label>
        <select
          value={targetSegment}
          onChange={(e) => setTargetSegment(e.target.value)}
          className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
        >
          {SEGMENT_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      {/* Conditional: Building input */}
      {targetSegment === 'building' && (
        <div>
          <label className="block text-sm font-medium text-gray-700">
            Edificio / Torre <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={buildingName}
            onChange={(e) => setBuildingName(e.target.value)}
            onBlur={() => handleBlur('buildingName')}
            className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            placeholder="Nombre del edificio o torre"
          />
          {touched.buildingName && !buildingName.trim() && (
            <p className="mt-1 text-xs text-red-600">Campo requerido</p>
          )}
        </div>
      )}

      {/* Conditional: Role select */}
      {targetSegment === 'role' && (
        <div>
          <label className="block text-sm font-medium text-gray-700">
            Rol
          </label>
          <select
            value={roleName}
            onChange={(e) => setRoleName(e.target.value)}
            className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          >
            {ROLE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Schedule */}
      <div>
        <label className="block text-sm font-medium text-gray-700">
          Programar publicacion (opcional)
        </label>
        <input
          type="datetime-local"
          value={scheduleDate}
          onChange={(e) => setScheduleDate(e.target.value)}
          className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
        />
        <p className="mt-1 text-xs text-gray-400">
          Dejar vacio para publicar inmediatamente
        </p>
      </div>

      {/* Toggles */}
      <div className="flex items-center gap-6">
        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input
            type="checkbox"
            checked={isUrgent}
            onChange={(e) => setIsUrgent(e.target.checked)}
            className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
          />
          Marcar como urgente
        </label>
        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input
            type="checkbox"
            checked={requiresAcknowledgment}
            onChange={(e) => setRequiresAcknowledgment(e.target.checked)}
            className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
          />
          Requiere confirmacion de lectura
        </label>
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-3 pt-2">
        <Button
          type="button"
          variant="secondary"
          onClick={onCancel}
          disabled={isSubmitting}
        >
          Cancelar
        </Button>
        <Button type="submit" isLoading={isSubmitting} disabled={!isValid}>
          {isScheduled ? 'Programar Aviso' : 'Publicar Aviso'}
        </Button>
      </div>
    </form>
  );
}
