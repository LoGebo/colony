'use client';

import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { formatCurrency, formatDate } from '@/lib/formatters';

// ── Types ──────────────────────────────────────────────────────────

interface PaymentProof {
  id: string;
  proof_type: string;
  amount: number;
  payment_date: string;
  reference_number: string | null;
  bank_name: string | null;
  document_url: string;
  submitter_notes: string | null;
  submitted_at: string;
  units: {
    unit_number: string;
    building: string | null;
  };
}

interface PaymentProofCardProps {
  proof: PaymentProof;
  onApprove: (id: string) => void;
  onReject: (id: string, reason: string) => void;
  isSelected: boolean;
  onToggleSelect: (id: string) => void;
  isLoading: boolean;
}

// ── Proof type labels ──────────────────────────────────────────────

const proofTypeLabels: Record<string, string> = {
  transfer: 'Transferencia',
  deposit: 'Deposito',
  cash: 'Efectivo',
  check: 'Cheque',
  card: 'Tarjeta',
  other: 'Otro',
};

// ── Component ──────────────────────────────────────────────────────

/**
 * Card displaying a single payment proof in the approval queue.
 * Supports selection for bulk operations and individual approve/reject.
 */
export function PaymentProofCard({
  proof,
  onApprove,
  onReject,
  isSelected,
  onToggleSelect,
  isLoading,
}: PaymentProofCardProps) {
  function handleReject() {
    const reason = window.prompt('Motivo del rechazo:');
    if (reason && reason.trim()) {
      onReject(proof.id, reason.trim());
    }
  }

  const unitLabel = proof.units.building
    ? `${proof.units.unit_number} - ${proof.units.building}`
    : proof.units.unit_number;

  return (
    <div
      className={`rounded-lg border p-4 transition ${
        isSelected
          ? 'border-indigo-300 bg-indigo-50'
          : 'border-gray-200 bg-white'
      }`}
    >
      <div className="flex items-start gap-4">
        {/* Checkbox for bulk selection */}
        <div className="flex pt-1">
          <input
            type="checkbox"
            checked={isSelected}
            onChange={() => onToggleSelect(proof.id)}
            className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
          />
        </div>

        {/* Proof details */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-gray-900">
                {unitLabel}
              </h3>
              <span className="text-lg font-bold text-gray-900">
                {formatCurrency(proof.amount)}
              </span>
            </div>
            <Badge variant="info">
              {proofTypeLabels[proof.proof_type] ?? proof.proof_type}
            </Badge>
          </div>

          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-500">
            <span>Fecha de pago: {formatDate(proof.payment_date)}</span>
            {proof.reference_number && (
              <span>Ref: {proof.reference_number}</span>
            )}
            {proof.bank_name && <span>Banco: {proof.bank_name}</span>}
            <span>Enviado: {formatDate(proof.submitted_at)}</span>
          </div>

          {proof.submitter_notes && (
            <p className="mt-2 text-sm italic text-gray-600">
              &ldquo;{proof.submitter_notes}&rdquo;
            </p>
          )}

          {/* Actions */}
          <div className="mt-3 flex items-center gap-3">
            <a
              href={proof.document_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm font-medium text-indigo-600 hover:text-indigo-500"
            >
              Ver comprobante
            </a>
            <div className="flex-1" />
            <Button
              variant="danger"
              size="sm"
              onClick={handleReject}
              disabled={isLoading}
            >
              Rechazar
            </Button>
            <Button
              size="sm"
              onClick={() => onApprove(proof.id)}
              disabled={isLoading}
              isLoading={isLoading}
              className="bg-green-600 hover:bg-green-700 focus:ring-green-500"
            >
              Aprobar
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
