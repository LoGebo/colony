'use client';

export const dynamic = 'force-dynamic';

import { useState, useMemo } from 'react';
import { useFeeStructures, useChargePreview, useGenerateCharges } from '@/hooks/useCharges';
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
        previews,
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
            <p className="mt-2 text-sm text-red-600">
              Esta accion no se puede deshacer.
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
