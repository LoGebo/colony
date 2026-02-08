'use client';

export const dynamic = 'force-dynamic';

import { useState, useCallback } from 'react';
import {
  usePendingProofs,
  useApprovePaymentProof,
  useRejectPaymentProof,
  useBulkApproveProofs,
} from '@/hooks/usePaymentProofs';
import { PaymentProofCard } from '@/components/financial/PaymentProofCard';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';

/**
 * Payment proof approval queue page.
 * Admins review submitted payment proofs, approve/reject individually
 * or use bulk selection to approve multiple at once.
 */
export default function ApprovalsPage() {
  const { data: proofs, isLoading, error, refetch } = usePendingProofs();
  const approveMutation = useApprovePaymentProof();
  const rejectMutation = useRejectPaymentProof();
  const bulkApproveMutation = useBulkApproveProofs();

  const [selected, setSelected] = useState<Set<string>>(new Set());

  const handleToggleSelect = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const handleSelectAll = useCallback(() => {
    if (!proofs) return;
    if (selected.size === proofs.length) {
      // Deselect all
      setSelected(new Set());
    } else {
      // Select all
      setSelected(new Set(proofs.map((p) => p.id)));
    }
  }, [proofs, selected.size]);

  const handleApprove = useCallback(
    (id: string) => {
      approveMutation.mutate(id, {
        onSuccess: () => {
          setSelected((prev) => {
            const next = new Set(prev);
            next.delete(id);
            return next;
          });
        },
      });
    },
    [approveMutation]
  );

  const handleReject = useCallback(
    (id: string, reason: string) => {
      rejectMutation.mutate(
        { proofId: id, reason },
        {
          onSuccess: () => {
            setSelected((prev) => {
              const next = new Set(prev);
              next.delete(id);
              return next;
            });
          },
        }
      );
    },
    [rejectMutation]
  );

  const handleBulkApprove = useCallback(() => {
    const ids = Array.from(selected);
    if (ids.length === 0) return;
    bulkApproveMutation.mutate(ids, {
      onSuccess: () => setSelected(new Set()),
    });
  }, [selected, bulkApproveMutation]);

  const isMutating =
    approveMutation.isPending ||
    rejectMutation.isPending ||
    bulkApproveMutation.isPending;

  const allSelected = proofs && proofs.length > 0 && selected.size === proofs.length;

  // ── Loading state ────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <h1 className="text-3xl font-bold text-gray-900">Cola de Aprobaciones</h1>
        </div>
        <div className="space-y-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="h-28 animate-pulse rounded-lg border border-gray-200 bg-gray-100"
            />
          ))}
        </div>
      </div>
    );
  }

  // ── Error state ──────────────────────────────────────────────────
  if (error) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold text-gray-900">Cola de Aprobaciones</h1>
        <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-center">
          <p className="text-sm text-red-700">
            Error al cargar comprobantes: {(error as Error).message}
          </p>
          <Button variant="secondary" size="sm" className="mt-3" onClick={() => refetch()}>
            Reintentar
          </Button>
        </div>
      </div>
    );
  }

  // ── Empty state ──────────────────────────────────────────────────
  if (!proofs || proofs.length === 0) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold text-gray-900">Cola de Aprobaciones</h1>
        <div className="rounded-lg border border-gray-200 bg-white p-12 text-center">
          <svg
            className="mx-auto h-12 w-12 text-green-400"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <p className="mt-4 text-sm font-medium text-gray-900">
            No hay comprobantes pendientes
          </p>
          <p className="mt-1 text-sm text-gray-500">
            Todos los comprobantes han sido revisados.
          </p>
        </div>
      </div>
    );
  }

  // ── Main view ────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-center gap-3">
        <h1 className="text-3xl font-bold text-gray-900">Cola de Aprobaciones</h1>
        <Badge variant="warning">{proofs.length} pendientes</Badge>
      </div>

      {/* Bulk action bar */}
      {selected.size > 0 && (
        <div className="flex items-center gap-3 rounded-lg border border-indigo-200 bg-indigo-50 px-4 py-3">
          <span className="text-sm font-medium text-indigo-700">
            {selected.size} seleccionados
          </span>
          <Button
            size="sm"
            onClick={handleBulkApprove}
            isLoading={bulkApproveMutation.isPending}
            disabled={isMutating}
            className="bg-green-600 hover:bg-green-700 focus:ring-green-500"
          >
            Aprobar seleccionados ({selected.size})
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleSelectAll}
            disabled={isMutating}
          >
            {allSelected ? 'Deseleccionar' : 'Seleccionar todos'}
          </Button>
        </div>
      )}

      {/* Select all toggle (when none selected) */}
      {selected.size === 0 && proofs.length > 1 && (
        <div className="flex justify-end">
          <Button variant="ghost" size="sm" onClick={handleSelectAll}>
            Seleccionar todos
          </Button>
        </div>
      )}

      {/* Proof cards */}
      <div className="space-y-3">
        {proofs.map((proof) => (
          <PaymentProofCard
            key={proof.id}
            proof={proof}
            onApprove={handleApprove}
            onReject={handleReject}
            isSelected={selected.has(proof.id)}
            onToggleSelect={handleToggleSelect}
            isLoading={isMutating}
          />
        ))}
      </div>
    </div>
  );
}
