'use client';

import { useEvacuationList } from '@/hooks/useEmergency';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { exportToCSV } from '@/lib/export';

export const dynamic = 'force-dynamic';

/**
 * Evacuation Priority List Page.
 * Generates prioritized list from database RPC (highest floors first).
 * Fulfills AEMRG-03: Admin can generate evacuation priority list.
 */
export default function EvacuationPage() {
  const { data: evacuationList = [], isLoading } = useEvacuationList();

  // Calculate summary stats
  const needsAssistanceCount = evacuationList.filter(
    (item) => item.needs_evacuation_assistance
  ).length;

  const handlePrint = () => {
    window.print();
  };

  const handleExport = () => {
    if (!evacuationList.length) return;

    const exportData = evacuationList.map((item, index) => ({
      Prioridad: index + 1,
      Piso: item.floor_number,
      Unidad: item.unit_number,
      Residente: item.resident_name,
      'Necesita Asistencia': item.needs_evacuation_assistance ? 'Si' : 'No',
      'Dispositivo de Movilidad': item.uses_mobility_device
        ? item.mobility_device_type || 'Si'
        : 'No',
      'Tipo de Necesidad': item.need_type || '-',
      Notas: item.evacuation_notes || '-',
    }));

    exportToCSV(exportData, 'lista-evacuacion');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Lista de Prioridad de Evacuacion
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Orden sugerido para evacuacion de emergencia (pisos altos primero)
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handlePrint}
            disabled={!evacuationList.length}
            className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            Imprimir
          </button>
          <button
            onClick={handleExport}
            disabled={!evacuationList.length}
            className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            Exportar CSV
          </button>
        </div>
      </div>

      {/* Summary */}
      {!isLoading && evacuationList.length > 0 && (
        <Card className="border-blue-200 bg-blue-50">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-blue-900">
                Total de registros: {evacuationList.length}
              </p>
              <p className="text-sm text-blue-800">
                Requieren asistencia: {needsAssistanceCount}
              </p>
            </div>
            <Badge variant="info">
              {Math.round((needsAssistanceCount / evacuationList.length) * 100)}%
              requiere asistencia
            </Badge>
          </div>
        </Card>
      )}

      {/* Evacuation List */}
      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-24 animate-pulse rounded-lg bg-gray-100" />
          ))}
        </div>
      ) : evacuationList.length === 0 ? (
        <Card>
          <div className="py-12 text-center text-gray-500">
            <p>No hay datos de evacuacion disponibles</p>
          </div>
        </Card>
      ) : (
        <div className="space-y-3">
          {evacuationList.map((item, index) => (
            <Card
              key={item.resident_id}
              className={
                item.needs_evacuation_assistance
                  ? 'border-amber-300 bg-amber-50'
                  : ''
              }
            >
              <div className="flex items-center justify-between">
                {/* Left: Priority & Info */}
                <div className="flex items-center gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gray-100 font-bold text-gray-700">
                    {index + 1}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-gray-900">
                        Piso {item.floor_number}, Unidad {item.unit_number}
                      </span>
                      {item.needs_evacuation_assistance && (
                        <Badge variant="warning">Necesita Asistencia</Badge>
                      )}
                    </div>
                    <p className="text-sm text-gray-600">{item.resident_name}</p>
                    {item.evacuation_notes && (
                      <p className="mt-1 text-xs text-gray-500">
                        {item.evacuation_notes}
                      </p>
                    )}
                  </div>
                </div>

                {/* Right: Badges */}
                <div className="flex flex-col items-end gap-1">
                  {item.need_type && (
                    <Badge variant="info">{item.need_type}</Badge>
                  )}
                  {item.uses_mobility_device && (
                    <Badge variant="neutral">
                      {item.mobility_device_type || 'Dispositivo de movilidad'}
                    </Badge>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Print Styles */}
      <style jsx global>{`
        @media print {
          body {
            print-color-adjust: exact;
            -webkit-print-color-adjust: exact;
          }
          .no-print {
            display: none !important;
          }
        }
      `}</style>
    </div>
  );
}
