'use client';

export const dynamic = 'force-dynamic';

import { use, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@upoe/shared';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import {
  useAssemblyDetail,
  useAssemblyQuorum,
  useAddAttendee,
  useAddAgreement,
} from '@/hooks/useGovernance';
import { Badge } from '@/components/ui/Badge';
import { formatDate } from '@/lib/formatters';

const assemblyStatusVariants = {
  scheduled: 'neutral' as const,
  in_progress: 'info' as const,
  completed: 'success' as const,
  cancelled: 'danger' as const,
};

const assemblyTypeVariants = {
  ordinary: 'info' as const,
  extraordinary: 'warning' as const,
};

const assemblyTypeLabels: Record<string, string> = {
  ordinary: 'Ordinaria',
  extraordinary: 'Extraordinaria',
};

const statusLabels: Record<string, string> = {
  scheduled: 'Programada',
  in_progress: 'En Curso',
  completed: 'Completada',
  cancelled: 'Cancelada',
};

const attendeeTypeLabels: Record<string, string> = {
  owner: 'Propietario',
  tenant: 'Arrendatario',
  proxy: 'Poder',
};

interface Unit {
  id: string;
  unit_number: string;
  coefficient: number;
}

/**
 * Fetch units for the attendance form selector.
 */
function useUnits() {
  const { communityId } = useAuth();

  return useQuery({
    queryKey: [...queryKeys.units.list(communityId!).queryKey, 'coefficients'],
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('units')
        .select('id, unit_number, coefficient')
        .eq('community_id', communityId!)
        .order('unit_number');

      if (error) throw error;
      return (data ?? []) as Unit[];
    },
    enabled: !!communityId,
  });
}

export default function AssemblyDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const { data, isLoading } = useAssemblyDetail(id);
  const { data: quorumData } = useAssemblyQuorum(id);
  const { data: units } = useUnits();

  const addAttendee = useAddAttendee();
  const addAgreement = useAddAgreement();

  const [showAttendeeForm, setShowAttendeeForm] = useState(false);
  const [attendeeForm, setAttendeeForm] = useState({
    unit_id: '',
    attendee_type: 'owner',
    coefficient: 0,
    attendee_name: '',
    is_proxy: false,
    proxy_grantor_id: '',
  });

  const [showAgreementForm, setShowAgreementForm] = useState(false);
  const [agreementForm, setAgreementForm] = useState({
    title: '',
    description: '',
    action_required: false,
    action_description: '',
    action_due_date: '',
    action_responsible: '',
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-48 animate-pulse rounded bg-gray-200" />
        <div className="h-64 animate-pulse rounded bg-gray-200" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="text-center text-sm text-gray-500">
        Asamblea no encontrada
      </div>
    );
  }

  const { assembly, attendance, agreements } = data;

  const handleUnitChange = (unitId: string) => {
    const selectedUnit = units?.find((u) => u.id === unitId);
    setAttendeeForm((prev) => ({
      ...prev,
      unit_id: unitId,
      coefficient: selectedUnit?.coefficient || 0,
    }));
  };

  const handleAddAttendee = () => {
    if (!attendeeForm.unit_id) {
      alert('Seleccione una unidad');
      return;
    }

    addAttendee.mutate(
      {
        assembly_id: id,
        unit_id: attendeeForm.unit_id,
        attendee_type: attendeeForm.attendee_type,
        coefficient: attendeeForm.coefficient,
        attendee_name: attendeeForm.attendee_name || undefined,
        is_proxy: attendeeForm.is_proxy,
        proxy_grantor_id: attendeeForm.proxy_grantor_id || undefined,
      },
      {
        onSuccess: () => {
          setShowAttendeeForm(false);
          setAttendeeForm({
            unit_id: '',
            attendee_type: 'owner',
            coefficient: 0,
            attendee_name: '',
            is_proxy: false,
            proxy_grantor_id: '',
          });
        },
      }
    );
  };

  const handleAddAgreement = () => {
    if (!agreementForm.title || !agreementForm.description) {
      alert('Complete los campos requeridos');
      return;
    }

    const maxNumber = agreements.reduce(
      (max, a) => Math.max(max, a.agreement_number),
      0
    );

    addAgreement.mutate(
      {
        assembly_id: id,
        agreement_number: maxNumber + 1,
        title: agreementForm.title,
        description: agreementForm.description,
        display_order: maxNumber + 1,
        action_required: agreementForm.action_required,
        action_description: agreementForm.action_description || undefined,
        action_due_date: agreementForm.action_due_date || undefined,
        action_responsible: agreementForm.action_responsible || undefined,
      },
      {
        onSuccess: () => {
          setShowAgreementForm(false);
          setAgreementForm({
            title: '',
            description: '',
            action_required: false,
            action_description: '',
            action_due_date: '',
            action_responsible: '',
          });
        },
      }
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-gray-900">{assembly.title}</h1>
            <Badge
              variant={
                assemblyStatusVariants[assembly.status as keyof typeof assemblyStatusVariants] ||
                'neutral'
              }
            >
              {statusLabels[assembly.status] || assembly.status}
            </Badge>
            <Badge
              variant={
                assemblyTypeVariants[
                  assembly.assembly_type as keyof typeof assemblyTypeVariants
                ] || 'neutral'
              }
            >
              {assemblyTypeLabels[assembly.assembly_type] || assembly.assembly_type}
            </Badge>
          </div>
          <p className="mt-1 text-sm text-gray-500">{assembly.assembly_number}</p>
          <div className="mt-2 flex gap-4 text-sm text-gray-600">
            <span>Fecha: {formatDate(assembly.scheduled_date)}</span>
            {assembly.scheduled_time && <span>Hora: {assembly.scheduled_time}</span>}
            {assembly.location && <span>Ubicación: {assembly.location}</span>}
          </div>
        </div>

        <button
          onClick={() => router.push('/governance/assemblies')}
          className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          Volver
        </button>
      </div>

      {/* Quorum Card */}
      <div className="rounded-lg border border-gray-200 bg-white p-6">
        <h2 className="mb-4 text-lg font-semibold text-gray-900">Quórum</h2>
        {quorumData ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600">
                Coeficiente presente: {quorumData.present_coefficient}% / {quorumData.total_coefficient}%
              </span>
              <Badge variant={quorumData.quorum_met ? 'success' : 'warning'}>
                {quorumData.quorum_met ? 'Alcanzado' : 'Pendiente'}
              </Badge>
            </div>
            <div className="h-4 overflow-hidden rounded-full bg-gray-200">
              <div
                className={`h-full transition-all ${
                  quorumData.quorum_met ? 'bg-green-600' : 'bg-yellow-500'
                }`}
                style={{ width: `${Math.min(quorumData.present_percentage, 100)}%` }}
              />
            </div>
            <p className="text-xs text-gray-500">
              {quorumData.present_percentage.toFixed(1)}% del total
            </p>

            <div className="mt-4 grid grid-cols-3 gap-2 text-xs">
              <div
                className={`rounded border p-2 ${
                  quorumData.convocatoria_1_met
                    ? 'border-green-300 bg-green-50 text-green-800'
                    : 'border-gray-300 bg-gray-50 text-gray-600'
                }`}
              >
                1ª Convocatoria: {quorumData.convocatoria_1_met ? '✓' : '✗'}
              </div>
              <div
                className={`rounded border p-2 ${
                  quorumData.convocatoria_2_met
                    ? 'border-green-300 bg-green-50 text-green-800'
                    : 'border-gray-300 bg-gray-50 text-gray-600'
                }`}
              >
                2ª Convocatoria: {quorumData.convocatoria_2_met ? '✓' : '✗'}
              </div>
              <div
                className={`rounded border p-2 ${
                  quorumData.convocatoria_3_met
                    ? 'border-green-300 bg-green-50 text-green-800'
                    : 'border-gray-300 bg-gray-50 text-gray-600'
                }`}
              >
                3ª Convocatoria: {quorumData.convocatoria_3_met ? '✓' : '✗'}
              </div>
            </div>
          </div>
        ) : (
          <div className="text-sm text-gray-500">Cargando quórum...</div>
        )}
      </div>

      {/* Attendance Card */}
      <div className="rounded-lg border border-gray-200 bg-white p-6">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Asistencia</h2>
            <p className="text-sm text-gray-500">
              {attendance.length} asistentes registrados
            </p>
          </div>
          <button
            onClick={() => setShowAttendeeForm(!showAttendeeForm)}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
          >
            Registrar Asistente
          </button>
        </div>

        {showAttendeeForm && (
          <div className="mb-4 rounded-lg border border-gray-200 bg-gray-50 p-4">
            <h3 className="mb-3 text-sm font-semibold text-gray-900">
              Nuevo Asistente
            </h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-700">
                  Unidad
                </label>
                <select
                  value={attendeeForm.unit_id}
                  onChange={(e) => handleUnitChange(e.target.value)}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                >
                  <option value="">Seleccione...</option>
                  {units?.map((unit) => (
                    <option key={unit.id} value={unit.id}>
                      {unit.unit_number} (Coef: {unit.coefficient}%)
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700">
                  Tipo de Asistente
                </label>
                <select
                  value={attendeeForm.attendee_type}
                  onChange={(e) =>
                    setAttendeeForm({ ...attendeeForm, attendee_type: e.target.value })
                  }
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                >
                  <option value="owner">Propietario</option>
                  <option value="tenant">Arrendatario</option>
                  <option value="proxy">Poder</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700">
                  Nombre (opcional)
                </label>
                <input
                  type="text"
                  value={attendeeForm.attendee_name}
                  onChange={(e) =>
                    setAttendeeForm({ ...attendeeForm, attendee_name: e.target.value })
                  }
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700">
                  Coeficiente
                </label>
                <input
                  type="number"
                  value={attendeeForm.coefficient}
                  onChange={(e) =>
                    setAttendeeForm({
                      ...attendeeForm,
                      coefficient: Number(e.target.value),
                    })
                  }
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                />
              </div>
              <div className="col-span-2">
                <label className="flex items-center gap-2 text-xs font-medium text-gray-700">
                  <input
                    type="checkbox"
                    checked={attendeeForm.is_proxy}
                    onChange={(e) =>
                      setAttendeeForm({ ...attendeeForm, is_proxy: e.target.checked })
                    }
                    className="rounded border-gray-300"
                  />
                  Es poder (proxy)
                </label>
              </div>
            </div>
            <div className="mt-3 flex justify-end gap-2">
              <button
                onClick={() => setShowAttendeeForm(false)}
                className="rounded-md border border-gray-300 px-3 py-1 text-sm text-gray-700 hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                onClick={handleAddAttendee}
                disabled={addAttendee.isPending}
                className="rounded-md bg-indigo-600 px-3 py-1 text-sm text-white hover:bg-indigo-700 disabled:opacity-50"
              >
                {addAttendee.isPending ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Unidad
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Asistente
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Tipo
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Coeficiente
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Llegada
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Es Poder
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {attendance.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-4 py-8 text-center text-sm text-gray-500"
                  >
                    Sin asistentes registrados
                  </td>
                </tr>
              ) : (
                attendance.map((att) => (
                  <tr key={att.id}>
                    <td className="whitespace-nowrap px-4 py-3 text-sm font-medium text-gray-900">
                      {att.units.unit_number}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-900">
                      {att.attendee_name || 'Propietario'}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm">
                      <Badge variant="info">
                        {attendeeTypeLabels[att.attendee_type] || att.attendee_type}
                      </Badge>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-900">
                      {att.coefficient}%
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-500">
                      {formatDate(att.checked_in_at)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm">
                      {att.is_proxy && <Badge variant="warning">Sí</Badge>}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Agreements Card */}
      <div className="rounded-lg border border-gray-200 bg-white p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Acuerdos</h2>
          <button
            onClick={() => setShowAgreementForm(!showAgreementForm)}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
          >
            Agregar Acuerdo
          </button>
        </div>

        {showAgreementForm && (
          <div className="mb-4 rounded-lg border border-gray-200 bg-gray-50 p-4">
            <h3 className="mb-3 text-sm font-semibold text-gray-900">
              Nuevo Acuerdo
            </h3>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-700">
                  Título
                </label>
                <input
                  type="text"
                  value={agreementForm.title}
                  onChange={(e) =>
                    setAgreementForm({ ...agreementForm, title: e.target.value })
                  }
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700">
                  Descripción
                </label>
                <textarea
                  value={agreementForm.description}
                  onChange={(e) =>
                    setAgreementForm({ ...agreementForm, description: e.target.value })
                  }
                  rows={3}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="flex items-center gap-2 text-xs font-medium text-gray-700">
                  <input
                    type="checkbox"
                    checked={agreementForm.action_required}
                    onChange={(e) =>
                      setAgreementForm({
                        ...agreementForm,
                        action_required: e.target.checked,
                      })
                    }
                    className="rounded border-gray-300"
                  />
                  Requiere acción de seguimiento
                </label>
              </div>
              {agreementForm.action_required && (
                <>
                  <div>
                    <label className="block text-xs font-medium text-gray-700">
                      Descripción de la Acción
                    </label>
                    <input
                      type="text"
                      value={agreementForm.action_description}
                      onChange={(e) =>
                        setAgreementForm({
                          ...agreementForm,
                          action_description: e.target.value,
                        })
                      }
                      className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-700">
                        Fecha Límite
                      </label>
                      <input
                        type="date"
                        value={agreementForm.action_due_date}
                        onChange={(e) =>
                          setAgreementForm({
                            ...agreementForm,
                            action_due_date: e.target.value,
                          })
                        }
                        className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700">
                        Responsable
                      </label>
                      <input
                        type="text"
                        value={agreementForm.action_responsible}
                        onChange={(e) =>
                          setAgreementForm({
                            ...agreementForm,
                            action_responsible: e.target.value,
                          })
                        }
                        className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                      />
                    </div>
                  </div>
                </>
              )}
            </div>
            <div className="mt-3 flex justify-end gap-2">
              <button
                onClick={() => setShowAgreementForm(false)}
                className="rounded-md border border-gray-300 px-3 py-1 text-sm text-gray-700 hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                onClick={handleAddAgreement}
                disabled={addAgreement.isPending}
                className="rounded-md bg-indigo-600 px-3 py-1 text-sm text-white hover:bg-indigo-700 disabled:opacity-50"
              >
                {addAgreement.isPending ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </div>
        )}

        <div className="space-y-4">
          {agreements.length === 0 ? (
            <div className="py-8 text-center text-sm text-gray-500">
              Sin acuerdos registrados
            </div>
          ) : (
            agreements.map((agreement) => (
              <div
                key={agreement.id}
                className="rounded-lg border border-gray-200 bg-gray-50 p-4"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-gray-900">
                        #{agreement.agreement_number}: {agreement.title}
                      </span>
                      {agreement.approved !== null && (
                        <Badge variant={agreement.approved ? 'success' : 'danger'}>
                          {agreement.approved ? 'Aprobado' : 'Rechazado'}
                        </Badge>
                      )}
                      {agreement.action_required && (
                        <Badge variant="warning">Acción Requerida</Badge>
                      )}
                    </div>
                    <p className="mt-1 text-sm text-gray-600">
                      {agreement.description}
                    </p>

                    {agreement.action_required && (
                      <div className="mt-3 rounded border border-indigo-200 bg-indigo-50 p-3 text-sm">
                        <div className="font-medium text-indigo-900">
                          Acción de Seguimiento
                        </div>
                        {agreement.action_description && (
                          <p className="mt-1 text-indigo-800">
                            {agreement.action_description}
                          </p>
                        )}
                        <div className="mt-2 flex gap-4 text-xs text-indigo-700">
                          {agreement.action_due_date && (
                            <span>
                              Fecha límite: {formatDate(agreement.action_due_date)}
                            </span>
                          )}
                          {agreement.action_responsible && (
                            <span>Responsable: {agreement.action_responsible}</span>
                          )}
                          {agreement.action_completed_at && (
                            <Badge variant="success">
                              Completado: {formatDate(agreement.action_completed_at)}
                            </Badge>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
