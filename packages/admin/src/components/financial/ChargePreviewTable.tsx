'use client';

import { useMemo } from 'react';
import { formatCurrency } from '@/lib/formatters';
import type { ChargePreviewRow } from '@/hooks/useCharges';

// ── Types ──────────────────────────────────────────────────────────

interface ChargePreviewTableProps {
  previews: ChargePreviewRow[];
  isLoading: boolean;
}

// ── Unit type labels ───────────────────────────────────────────────

const unitTypeLabels: Record<string, string> = {
  casa: 'Casa',
  departamento: 'Departamento',
  local: 'Local',
  bodega: 'Bodega',
  oficina: 'Oficina',
  terreno: 'Terreno',
  estacionamiento: 'Estacionamiento',
};

// ── Component ──────────────────────────────────────────────────────

/**
 * Table previewing charge amounts per unit before generation.
 * Shows total at the bottom for confirmation.
 */
export function ChargePreviewTable({ previews, isLoading }: ChargePreviewTableProps) {
  const total = useMemo(
    () => previews.reduce((sum, p) => sum + p.calculated_amount, 0),
    [previews]
  );

  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-10 animate-pulse rounded bg-gray-100" />
        ))}
      </div>
    );
  }

  if (previews.length === 0) {
    return (
      <p className="py-6 text-center text-sm text-gray-500">
        No se encontraron unidades activas.
      </p>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border border-gray-200">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
              Unidad
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
              Edificio
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
              Tipo
            </th>
            <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">
              Coeficiente
            </th>
            <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">
              Monto Calculado
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200 bg-white">
          {previews.map((preview) => (
            <tr key={preview.unit_id} className="hover:bg-gray-50">
              <td className="whitespace-nowrap px-4 py-3 text-sm font-medium text-gray-900">
                {preview.unit_number}
              </td>
              <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-500">
                {preview.building ?? '-'}
              </td>
              <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-500">
                {unitTypeLabels[preview.unit_type] ?? preview.unit_type}
              </td>
              <td className="whitespace-nowrap px-4 py-3 text-right text-sm text-gray-500">
                {preview.coefficient.toFixed(4)}
              </td>
              <td className="whitespace-nowrap px-4 py-3 text-right text-sm font-medium text-gray-900">
                {formatCurrency(preview.calculated_amount)}
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot className="bg-gray-50">
          <tr>
            <td
              colSpan={4}
              className="px-4 py-3 text-right text-sm font-semibold text-gray-900"
            >
              Total ({previews.length} unidades)
            </td>
            <td className="px-4 py-3 text-right text-sm font-bold text-gray-900">
              {formatCurrency(total)}
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
