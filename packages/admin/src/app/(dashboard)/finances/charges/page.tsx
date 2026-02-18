'use client';

export const dynamic = 'force-dynamic';

import { useState, useMemo } from 'react';
import { useFeeStructures, useChargePreview, useGenerateCharges, useChargeRuns } from '@/hooks/useCharges';
import { ChargePreviewTable } from '@/components/financial/ChargePreviewTable';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { formatCurrency } from '@/lib/formatters';

// ── Month names for default description ────────────────────────────

const monthNames = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

/**
 * Charge generation page with two-step workflow:
 * 1. Preview: select fee structure, date, description -> view preview table
 * 2. Confirm: review total, confirm via modal, generate charges
 * 3. History: view past charge runs with duplicate prevention
 */
export default function ChargesPage() {
  const now = new Date();
  const defaultDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
  const defaultDescription = `Cuota de mantenimiento ${monthNames[now.getMonth()]} ${now.getFullYear()}`;

  // Form state
  const [selectedFeeId, setSelectedFeeId] = useState<string>('');
  const [chargeDate, setChargeDate] = useState(defaultDate);
  const [description, setDescription] = useState(defaultDescription);
  const [showPreview, setShowPreview] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  // Queries
  const { data: feeStructures, isLoading: feesLoading } = useFeeStructures();
  const {
    data: previews,
    isLoading: previewLoading,
    isFetching: previewFetching,
  } = useChargePreview(showPreview ? selectedFeeId : null);
  const { data: chargeRuns, isLoading: runsLoading } = useChargeRuns();

  const generateMutation = useGenerateCharges();

  // Preview total
  const total = useMemo(
    () => (previews ?? []).reduce((sum, p) => sum + p.calculated_amount, 0),
    [previews]
  );

  const chargeableCount = useMemo(
    () => (previews ?? []).filter((p) => p.calculated_amount > 0).length,
    [previews]
  );

  function handlePreview() {
    if (!selectedFeeId) return;
    setShowPreview(true);
  }

  function handleGenerate() {
    if (!previews || previews.length === 0) return;
    generateMutation.mutate(
      {
        feeStructureId: selectedFeeId,
        chargeDate,
        description,
      },
      {
        onSuccess: () => {
          setShowConfirmModal(false);
          setShowPreview(false);
          setSelectedFeeId('');
        },
      }
    );
  }

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Generacion de Cargos</h1>
        <p className="mt-1 text-sm text-gray-500">
          Generar cargos mensuales de mantenimiento para todas las unidades
        </p>
      </div>

      {/* Step 1: Configuration */}
      <Card>
        <h2 className="mb-4 text-lg font-semibold text-gray-900">
          1. Configuracion del Cargo
        </h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {/* Fee structure selector */}
          <div>
            <label
              htmlFor="fee-structure"
              className="mb-1 block text-sm font-medium text-gray-700"
            >
              Estructura de Cuota
            </label>
            <select
              id="fee-structure"
              value={selectedFeeId}
              onChange={(e) => {
                setSelectedFeeId(e.target.value);
                setShowPreview(false);
              }}
              disabled={feesLoading}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
              <option value="">
                {feesLoading ? 'Cargando...' : 'Seleccionar estructura'}
              </option>
              {(feeStructures ?? []).map((fs) => (
                <option key={fs.id} value={fs.id}>
                  {fs.name} ({formatCurrency(fs.base_amount)})
                </option>
              ))}
            </select>
          </div>

          {/* Charge date */}
          <div>
            <label
              htmlFor="charge-date"
              className="mb-1 block text-sm font-medium text-gray-700"
            >
              Fecha del Cargo
            </label>
            <input
              id="charge-date"
              type="date"
              value={chargeDate}
              onChange={(e) => setChargeDate(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          {/* Description */}
          <div>
            <label
              htmlFor="description"
              className="mb-1 block text-sm font-medium text-gray-700"
            >
              Descripcion
            </label>
            <input
              id="description"
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>
        </div>

        <div className="mt-4">
          <Button
            onClick={handlePreview}
            disabled={!selectedFeeId || previewFetching}
            isLoading={previewFetching}
          >
            Vista Previa
          </Button>
        </div>
      </Card>

      {/* Step 2: Preview table */}
      {showPreview && (
        <Card>
          <h2 className="mb-4 text-lg font-semibold text-gray-900">
            2. Vista Previa de Cargos
          </h2>
          <ChargePreviewTable
            previews={previews ?? []}
            isLoading={previewLoading}
          />

          {/* Generate button */}
          {previews && previews.length > 0 && !previewLoading && (
            <div className="mt-4 flex justify-end">
              <Button onClick={() => setShowConfirmModal(true)}>
                Generar Cargos
              </Button>
            </div>
          )}
        </Card>
      )}

      {/* Charge Run History */}
      <Card>
        <h2 className="mb-4 text-lg font-semibold text-gray-900">
          Historial de Corridas de Cargos
        </h2>
        {runsLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-12 animate-pulse rounded bg-gray-100" />
            ))}
          </div>
        ) : !chargeRuns || chargeRuns.length === 0 ? (
          <p className="py-6 text-center text-sm text-gray-500">
            No se han generado cargos aun.
          </p>
        ) : (
          <div className="overflow-hidden rounded-lg border border-gray-200">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    Fecha
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    Periodo
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    Cuota
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">
                    Unidades
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">
                    Total
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-medium uppercase tracking-wider text-gray-500">
                    Estado
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {chargeRuns.map((run) => (
                  <tr key={run.id} className="hover:bg-gray-50">
                    <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-500">
                      {new Date(run.created_at).toLocaleDateString('es-MX', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-900">
                      {new Date(run.period_start + 'T00:00:00').toLocaleDateString('es-MX', {
                        month: 'long',
                        year: 'numeric',
                      })}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-500">
                      {run.fee_structure_name}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right text-sm text-gray-500">
                      {run.units_charged}
                      {run.units_skipped > 0 && (
                        <span className="ml-1 text-amber-600">
                          ({run.units_skipped} omitidos)
                        </span>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right text-sm font-medium text-gray-900">
                      {formatCurrency(run.total_amount)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-center">
                      <span
                        className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${
                          run.status === 'completed'
                            ? 'bg-green-100 text-green-800'
                            : 'bg-red-100 text-red-800'
                        }`}
                      >
                        {run.status === 'completed' ? 'Completado' : 'Revertido'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Confirmation modal */}
      {showConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="mx-4 w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
            <h3 className="text-lg font-semibold text-gray-900">
              Confirmar Generacion de Cargos
            </h3>
            <p className="mt-3 text-sm text-gray-600">
              Se generaran <strong>{chargeableCount} cargos</strong> por un
              total de <strong>{formatCurrency(total)}</strong>.
            </p>
            <p className="mt-2 text-sm text-amber-600">
              Si ya se generaron cargos para este periodo y estructura, la operacion sera rechazada automaticamente.
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <Button
                variant="secondary"
                onClick={() => setShowConfirmModal(false)}
                disabled={generateMutation.isPending}
              >
                Cancelar
              </Button>
              <Button
                onClick={handleGenerate}
                isLoading={generateMutation.isPending}
                disabled={generateMutation.isPending}
              >
                Confirmar
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
