'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { ColumnDef } from '@tanstack/react-table';
import { useDevices, useDeviceTypes, useCreateDevice, type DeviceRow } from '@/hooks/useDevices';
import { DataTable } from '@/components/ui/DataTable';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { exportToExcel } from '@/lib/export';
import { formatDate } from '@/lib/formatters';

export const dynamic = 'force-dynamic';

type DeviceStatus = 'in_inventory' | 'assigned' | 'lost' | 'damaged' | 'deactivated' | 'retired';

const STATUS_LABELS: Record<DeviceStatus, string> = {
  in_inventory: 'En Inventario',
  assigned: 'Asignado',
  lost: 'Extraviado',
  damaged: 'Danado',
  deactivated: 'Desactivado',
  retired: 'Retirado',
};

/**
 * Device Inventory Management Page.
 * List all access devices with filters and create new devices.
 * Fulfills AKEY-01: Admin can manage access device inventory.
 */
export default function DevicesPage() {
  const router = useRouter();
  const [status, setStatus] = useState<DeviceStatus | undefined>(undefined);
  const [deviceTypeId, setDeviceTypeId] = useState<string | undefined>(undefined);
  const [page, setPage] = useState(0);
  const [showCreateModal, setShowCreateModal] = useState(false);

  const pageSize = 20;

  const { data: deviceTypes = [] } = useDeviceTypes();
  const {
    data: devicesData,
    isLoading,
  } = useDevices({ status, deviceTypeId, page, pageSize });

  const devices = devicesData?.data ?? [];
  const totalCount = devicesData?.count ?? 0;
  const pageCount = Math.ceil(totalCount / pageSize);

  const handleExport = () => {
    if (!devices.length) return;

    const exportData = devices.map((d) => ({
      Serial: d.serial_number,
      Codigo: d.internal_code || '-',
      Tipo: d.access_device_types?.name || '-',
      Estado: STATUS_LABELS[d.status as DeviceStatus] ?? d.status,
      Compra: d.purchased_at ? formatDate(d.purchased_at) : '-',
      Proveedor: d.vendor || '-',
      Lote: d.batch_number || '-',
    }));

    exportToExcel(exportData, 'inventario-dispositivos');
  };

  const columns: ColumnDef<DeviceRow>[] = [
    {
      id: 'serial',
      header: 'Serial',
      accessorKey: 'serial_number',
    },
    {
      id: 'code',
      header: 'Codigo',
      cell: ({ row }) => row.original.internal_code || '-',
    },
    {
      id: 'type',
      header: 'Tipo',
      cell: ({ row }) => row.original.access_device_types?.name || '-',
    },
    {
      id: 'status',
      header: 'Estado',
      cell: ({ row }) => {
        const statusVariantMap: Record<DeviceStatus, 'success' | 'info' | 'danger' | 'warning' | 'neutral'> = {
          in_inventory: 'success',
          assigned: 'info',
          lost: 'danger',
          damaged: 'warning',
          deactivated: 'neutral',
          retired: 'neutral',
        };
        return (
          <Badge variant={statusVariantMap[row.original.status as DeviceStatus]}>
            {STATUS_LABELS[row.original.status as DeviceStatus] ?? row.original.status}
          </Badge>
        );
      },
    },
    {
      id: 'purchase',
      header: 'Compra',
      cell: ({ row }) => (row.original.purchased_at ? formatDate(row.original.purchased_at) : '-'),
    },
    {
      id: 'vendor',
      header: 'Proveedor',
      cell: ({ row }) => row.original.vendor || '-',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Inventario de Dispositivos</h1>
          <p className="mt-1 text-sm text-gray-500">
            Administrar dispositivos de acceso (tags, cards, remotes)
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleExport}
            disabled={!devices.length}
            className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            Exportar
          </button>
          <button
            onClick={() => setShowCreateModal(true)}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            Nuevo Dispositivo
          </button>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <div className="flex gap-4">
          <div className="flex-1">
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Estado
            </label>
            <select
              value={status ?? ''}
              onChange={(e) => {
                setStatus(e.target.value as DeviceStatus || undefined);
                setPage(0);
              }}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
            >
              <option value="">Todos</option>
              <option value="in_inventory">En Inventario</option>
              <option value="assigned">Asignado</option>
              <option value="lost">Perdido</option>
              <option value="damaged">Danado</option>
              <option value="deactivated">Desactivado</option>
              <option value="retired">Retirado</option>
            </select>
          </div>
          <div className="flex-1">
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Tipo de Dispositivo
            </label>
            <select
              value={deviceTypeId ?? ''}
              onChange={(e) => {
                setDeviceTypeId(e.target.value || undefined);
                setPage(0);
              }}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
            >
              <option value="">Todos</option>
              {deviceTypes.map((type) => (
                <option key={type.id} value={type.id}>
                  {type.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </Card>

      {/* Data Table */}
      <DataTable
        columns={columns}
        data={devices}
        pageCount={pageCount}
        pagination={{ pageIndex: page, pageSize }}
        onPaginationChange={(p) => setPage(p.pageIndex)}
        onRowClick={(device) => router.push(`/devices/${device.id}`)}
        isLoading={isLoading}
      />

      {/* Create Device Modal */}
      {showCreateModal && (
        <CreateDeviceModal
          deviceTypes={deviceTypes}
          onClose={() => setShowCreateModal(false)}
        />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Create Device Modal Component                                     */
/* ------------------------------------------------------------------ */

interface CreateDeviceModalProps {
  deviceTypes: Array<{ id: string; name: string }>;
  onClose: () => void;
}

function CreateDeviceModal({ deviceTypes, onClose }: CreateDeviceModalProps) {
  const createDevice = useCreateDevice();
  const [formData, setFormData] = useState({
    device_type_id: '',
    serial_number: '',
    internal_code: '',
    batch_number: '',
    purchased_at: '',
    vendor: '',
    notes: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await createDevice.mutateAsync({
        device_type_id: formData.device_type_id,
        serial_number: formData.serial_number,
        internal_code: formData.internal_code || undefined,
        batch_number: formData.batch_number || undefined,
        purchased_at: formData.purchased_at || undefined,
        vendor: formData.vendor || undefined,
        notes: formData.notes || undefined,
      });
      onClose();
    } catch (error) {
      console.error('Failed to create device:', error);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
        <h2 className="mb-4 text-xl font-semibold text-gray-900">
          Nuevo Dispositivo
        </h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Tipo de Dispositivo *
            </label>
            <select
              required
              value={formData.device_type_id}
              onChange={(e) =>
                setFormData({ ...formData, device_type_id: e.target.value })
              }
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
            >
              <option value="">Seleccionar...</option>
              {deviceTypes.map((type) => (
                <option key={type.id} value={type.id}>
                  {type.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Numero de Serie *
            </label>
            <input
              required
              type="text"
              value={formData.serial_number}
              onChange={(e) =>
                setFormData({ ...formData, serial_number: e.target.value })
              }
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Codigo Interno
            </label>
            <input
              type="text"
              value={formData.internal_code}
              onChange={(e) =>
                setFormData({ ...formData, internal_code: e.target.value })
              }
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Numero de Lote
            </label>
            <input
              type="text"
              value={formData.batch_number}
              onChange={(e) =>
                setFormData({ ...formData, batch_number: e.target.value })
              }
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Fecha de Compra
            </label>
            <input
              type="date"
              value={formData.purchased_at}
              onChange={(e) =>
                setFormData({ ...formData, purchased_at: e.target.value })
              }
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Proveedor
            </label>
            <input
              type="text"
              value={formData.vendor}
              onChange={(e) =>
                setFormData({ ...formData, vendor: e.target.value })
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
              rows={3}
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
              disabled={createDevice.isPending}
              className="flex-1 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {createDevice.isPending ? 'Creando...' : 'Crear'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
