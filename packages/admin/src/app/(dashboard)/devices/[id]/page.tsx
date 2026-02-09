'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@upoe/shared';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import {
  useDeviceDetail,
  useDeviceAssignments,
  useAssignDevice,
  useReturnDevice,
  useReportLost,
} from '@/hooks/useDevices';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { formatDate, formatCurrency } from '@/lib/formatters';

export const dynamic = 'force-dynamic';

/**
 * Device Detail Page with Lifecycle Actions.
 * Displays device info, assignment history, and lifecycle controls.
 * Fulfills AKEY-02 through AKEY-04: device assignment, return, lost tracking.
 */
export default function DeviceDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { communityId } = useAuth();
  const deviceId = params.id as string;

  const { data: device, isLoading } = useDeviceDetail(deviceId);
  const { data: assignments = [] } = useDeviceAssignments(deviceId);

  const [showAssignModal, setShowAssignModal] = useState(false);
  const [showReturnModal, setShowReturnModal] = useState(false);
  const [showLostModal, setShowLostModal] = useState(false);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-12 animate-pulse rounded bg-gray-100" />
        <div className="h-64 animate-pulse rounded-lg bg-gray-100" />
      </div>
    );
  }

  if (!device) {
    return (
      <div className="py-12 text-center text-gray-500">
        <p>Dispositivo no encontrado</p>
      </div>
    );
  }

  const currentAssignment = device.current_assignment_id
    ? assignments.find((a) => a.id === device.current_assignment_id)
    : null;

  // Calculate deposit/fee summary
  const totalDepositsCollected = assignments.reduce(
    (sum, a) => sum + a.deposit_collected,
    0
  );
  const totalDepositsReturned = assignments.reduce(
    (sum, a) => sum + (a.deposit_returned ?? 0),
    0
  );
  const totalFeesCharged = assignments.reduce(
    (sum, a) => sum + (a.replacement_fee_charged ?? 0),
    0
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-gray-900">
              {device.serial_number}
            </h1>
            {device.internal_code && (
              <Badge variant="neutral">{device.internal_code}</Badge>
            )}
            <Badge
              variant={
                device.status === 'in_inventory'
                  ? 'success'
                  : device.status === 'assigned'
                  ? 'info'
                  : device.status === 'lost'
                  ? 'danger'
                  : 'neutral'
              }
            >
              {device.status}
            </Badge>
          </div>
          <p className="mt-1 text-sm text-gray-500">
            {device.access_device_types?.name || 'Dispositivo'}
          </p>
        </div>
        <button
          onClick={() => router.back()}
          className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          Volver
        </button>
      </div>

      {/* Device Info Card */}
      <Card>
        <h2 className="mb-4 text-lg font-semibold text-gray-900">
          Informacion del Dispositivo
        </h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <span className="text-sm font-medium text-gray-700">Numero de Serie:</span>
            <p className="text-sm text-gray-900">{device.serial_number}</p>
          </div>
          <div>
            <span className="text-sm font-medium text-gray-700">Codigo Interno:</span>
            <p className="text-sm text-gray-900">{device.internal_code || '-'}</p>
          </div>
          <div>
            <span className="text-sm font-medium text-gray-700">Tipo:</span>
            <p className="text-sm text-gray-900">
              {device.access_device_types?.name || '-'}
            </p>
          </div>
          <div>
            <span className="text-sm font-medium text-gray-700">Lote:</span>
            <p className="text-sm text-gray-900">{device.batch_number || '-'}</p>
          </div>
          <div>
            <span className="text-sm font-medium text-gray-700">Proveedor:</span>
            <p className="text-sm text-gray-900">{device.vendor || '-'}</p>
          </div>
          <div>
            <span className="text-sm font-medium text-gray-700">Fecha de Compra:</span>
            <p className="text-sm text-gray-900">
              {device.purchased_at ? formatDate(device.purchased_at) : '-'}
            </p>
          </div>
          <div>
            <span className="text-sm font-medium text-gray-700">Estado Cambiado:</span>
            <p className="text-sm text-gray-900">
              {formatDate(device.status_changed_at)}
            </p>
          </div>
          <div>
            <span className="text-sm font-medium text-gray-700">Creado:</span>
            <p className="text-sm text-gray-900">{formatDate(device.created_at)}</p>
          </div>
        </div>
        {device.notes && (
          <div className="mt-4">
            <span className="text-sm font-medium text-gray-700">Notas:</span>
            <p className="mt-1 text-sm text-gray-600">{device.notes}</p>
          </div>
        )}
      </Card>

      {/* Action Buttons */}
      <Card>
        <h2 className="mb-4 text-lg font-semibold text-gray-900">Acciones</h2>
        <div className="flex gap-2">
          {device.status === 'in_inventory' && (
            <button
              onClick={() => setShowAssignModal(true)}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              Asignar
            </button>
          )}
          {device.status === 'assigned' && (
            <>
              <button
                onClick={() => setShowReturnModal(true)}
                className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700"
              >
                Devolver
              </button>
              <button
                onClick={() => setShowLostModal(true)}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
              >
                Reportar Perdido
              </button>
            </>
          )}
          {device.status === 'lost' && (
            <p className="text-sm text-gray-500">
              Dispositivo reportado como perdido. Considere crear reemplazo.
            </p>
          )}
        </div>
      </Card>

      {/* Deposit/Fee Summary */}
      {assignments.length > 0 && (
        <Card className="border-blue-200 bg-blue-50">
          <h3 className="mb-2 text-sm font-semibold text-blue-900">
            Resumen Financiero
          </h3>
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div>
              <span className="text-blue-700">Depositos Recolectados:</span>
              <p className="font-semibold text-blue-900">
                {formatCurrency(totalDepositsCollected)}
              </p>
            </div>
            <div>
              <span className="text-blue-700">Depositos Devueltos:</span>
              <p className="font-semibold text-blue-900">
                {formatCurrency(totalDepositsReturned)}
              </p>
            </div>
            <div>
              <span className="text-blue-700">Cargos por Reemplazo:</span>
              <p className="font-semibold text-blue-900">
                {formatCurrency(totalFeesCharged)}
              </p>
            </div>
          </div>
        </Card>
      )}

      {/* Assignment History */}
      <Card>
        <h2 className="mb-4 text-lg font-semibold text-gray-900">
          Historial de Asignaciones
        </h2>
        {assignments.length === 0 ? (
          <p className="text-sm text-gray-500">
            No hay historial de asignaciones
          </p>
        ) : (
          <div className="overflow-hidden rounded-lg border border-gray-200">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    Unidad
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    Residente
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    Asignado
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    Devuelto
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">
                    Deposito
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">
                    Devuelto
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">
                    Cargo
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {assignments.map((assignment) => (
                  <tr
                    key={assignment.id}
                    className={
                      assignment.id === device.current_assignment_id
                        ? 'bg-blue-50'
                        : ''
                    }
                  >
                    <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-900">
                      {assignment.units?.unit_number || '-'}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-900">
                      {assignment.residents
                        ? `${assignment.residents.first_name} ${assignment.residents.last_name}`
                        : '-'}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-600">
                      {formatDate(assignment.assigned_at)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-600">
                      {assignment.returned_at ? formatDate(assignment.returned_at) : (
                        <Badge variant="info">Actual</Badge>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right text-sm text-gray-900">
                      {formatCurrency(assignment.deposit_collected)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right text-sm text-gray-900">
                      {assignment.deposit_returned
                        ? formatCurrency(assignment.deposit_returned)
                        : '-'}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right text-sm text-gray-900">
                      {assignment.replacement_fee_charged
                        ? formatCurrency(assignment.replacement_fee_charged)
                        : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Modals */}
      {showAssignModal && (
        <AssignDeviceModal
          deviceId={deviceId}
          onClose={() => setShowAssignModal(false)}
        />
      )}
      {showReturnModal && currentAssignment && (
        <ReturnDeviceModal
          deviceId={deviceId}
          assignmentId={currentAssignment.id}
          depositCollected={currentAssignment.deposit_collected}
          onClose={() => setShowReturnModal(false)}
        />
      )}
      {showLostModal && (
        <ReportLostModal
          deviceId={deviceId}
          assignmentId={currentAssignment?.id}
          onClose={() => setShowLostModal(false)}
        />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Modal Components                                                  */
/* ------------------------------------------------------------------ */

interface AssignDeviceModalProps {
  deviceId: string;
  onClose: () => void;
}

function AssignDeviceModal({ deviceId, onClose }: AssignDeviceModalProps) {
  const { communityId } = useAuth();
  const assignDevice = useAssignDevice();
  const [formData, setFormData] = useState({
    unit_id: '',
    resident_id: '',
    deposit_collected: '',
    notes: '',
  });

  // Fetch units
  const { data: units = [] } = useQuery({
    queryKey: [...queryKeys.units.list(communityId!).queryKey],
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('units')
        .select('id, unit_number')
        .eq('community_id', communityId!)
        .is('deleted_at', null)
        .order('unit_number');
      if (error) throw error;
      return data as Array<{ id: string; unit_number: string }>;
    },
    enabled: !!communityId,
  });

  // Fetch residents for selected unit
  const { data: residents = [] } = useQuery({
    queryKey: ['residents-for-unit', formData.unit_id],
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('occupancies')
        .select('residents!inner(id, first_name, last_name)')
        .eq('unit_id', formData.unit_id)
        .is('ended_at', null);
      if (error) throw error;
      return (data?.map((o: unknown) => (o as { residents: { id: string; first_name: string; last_name: string } | null }).residents).filter(Boolean) ?? []) as Array<{
        id: string;
        first_name: string;
        last_name: string;
      }>;
    },
    enabled: !!formData.unit_id,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await assignDevice.mutateAsync({
        device_id: deviceId,
        unit_id: formData.unit_id,
        resident_id: formData.resident_id || undefined,
        deposit_collected: parseFloat(formData.deposit_collected),
        notes: formData.notes || undefined,
      });
      onClose();
    } catch (error) {
      console.error('Failed to assign device:', error);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
        <h2 className="mb-4 text-xl font-semibold text-gray-900">
          Asignar Dispositivo
        </h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Unidad *
            </label>
            <select
              required
              value={formData.unit_id}
              onChange={(e) =>
                setFormData({ ...formData, unit_id: e.target.value, resident_id: '' })
              }
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
            >
              <option value="">Seleccionar...</option>
              {units.map((unit) => (
                <option key={unit.id} value={unit.id}>
                  Unidad {unit.unit_number}
                </option>
              ))}
            </select>
          </div>
          {formData.unit_id && (
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Residente (opcional)
              </label>
              <select
                value={formData.resident_id}
                onChange={(e) =>
                  setFormData({ ...formData, resident_id: e.target.value })
                }
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
              >
                <option value="">Ninguno</option>
                {residents.map((resident) => (
                  <option key={resident.id} value={resident.id}>
                    {resident.first_name} {resident.last_name}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Deposito Recolectado *
            </label>
            <input
              required
              type="number"
              step="0.01"
              value={formData.deposit_collected}
              onChange={(e) =>
                setFormData({ ...formData, deposit_collected: e.target.value })
              }
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Notas
            </label>
            <textarea
              value={formData.notes}
              onChange={(e) =>
                setFormData({ ...formData, notes: e.target.value })
              }
              rows={2}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
            />
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={assignDevice.isPending}
              className="flex-1 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {assignDevice.isPending ? 'Asignando...' : 'Asignar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

interface ReturnDeviceModalProps {
  deviceId: string;
  assignmentId: string;
  depositCollected: number;
  onClose: () => void;
}

function ReturnDeviceModal({
  deviceId,
  assignmentId,
  depositCollected,
  onClose,
}: ReturnDeviceModalProps) {
  const returnDevice = useReturnDevice();
  const [formData, setFormData] = useState({
    deposit_returned: depositCollected.toString(),
    notes: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await returnDevice.mutateAsync({
        device_id: deviceId,
        assignment_id: assignmentId,
        deposit_returned: parseFloat(formData.deposit_returned),
        notes: formData.notes || undefined,
      });
      onClose();
    } catch (error) {
      console.error('Failed to return device:', error);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
        <h2 className="mb-4 text-xl font-semibold text-gray-900">
          Devolver Dispositivo
        </h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="rounded-md bg-blue-50 p-3">
            <p className="text-sm text-blue-800">
              Deposito recolectado: {formatCurrency(depositCollected)}
            </p>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Deposito a Devolver *
            </label>
            <input
              required
              type="number"
              step="0.01"
              value={formData.deposit_returned}
              onChange={(e) =>
                setFormData({ ...formData, deposit_returned: e.target.value })
              }
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Notas
            </label>
            <textarea
              value={formData.notes}
              onChange={(e) =>
                setFormData({ ...formData, notes: e.target.value })
              }
              rows={2}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
            />
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={returnDevice.isPending}
              className="flex-1 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
            >
              {returnDevice.isPending ? 'Procesando...' : 'Devolver'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

interface ReportLostModalProps {
  deviceId: string;
  assignmentId?: string;
  onClose: () => void;
}

function ReportLostModal({ deviceId, assignmentId, onClose }: ReportLostModalProps) {
  const reportLost = useReportLost();
  const [replacementFee, setReplacementFee] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await reportLost.mutateAsync({
        device_id: deviceId,
        assignment_id: assignmentId,
        replacement_fee_charged: replacementFee ? parseFloat(replacementFee) : undefined,
      });
      onClose();
    } catch (error) {
      console.error('Failed to report lost device:', error);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
        <h2 className="mb-4 text-xl font-semibold text-gray-900">
          Reportar Dispositivo Perdido
        </h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="rounded-md bg-amber-50 p-3">
            <p className="text-sm text-amber-800">
              Esta accion marcara el dispositivo como perdido y opcionalmente
              cargara un cargo por reemplazo.
            </p>
          </div>
          {assignmentId && (
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Cargo por Reemplazo (opcional)
              </label>
              <input
                type="number"
                step="0.01"
                value={replacementFee}
                onChange={(e) => setReplacementFee(e.target.value)}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
              />
            </div>
          )}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={reportLost.isPending}
              className="flex-1 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
            >
              {reportLost.isPending ? 'Reportando...' : 'Reportar Perdido'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
