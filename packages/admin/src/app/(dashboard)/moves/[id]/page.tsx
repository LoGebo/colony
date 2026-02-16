'use client';

export const dynamic = 'force-dynamic';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import {
  useMoveDetail,
  useMoveValidations,
  useMoveDeposits,
  useUpdateMoveStatus,
  useUpdateValidation,
  useCreateDeposit,
  useProcessDepositRefund,
  useApproveDepositRefund,
  useCompleteDepositRefund,
  useForfeitDeposit,
} from '@/hooks/useMoves';
import { useAuth } from '@/hooks/useAuth';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';

/* ------------------------------------------------------------------ */
/*  Status helpers                                                     */
/* ------------------------------------------------------------------ */

const STATUS_LABELS: Record<string, string> = {
  requested: 'Solicitado',
  validating: 'Validando',
  validation_failed: 'Validacion fallida',
  approved: 'Aprobado',
  scheduled: 'Programado',
  in_progress: 'En progreso',
  completed: 'Completado',
  cancelled: 'Cancelado',
};

const VALIDATION_STATUS_LABELS: Record<string, string> = {
  pending: 'Pendiente',
  passed: 'Aprobado',
  failed: 'Rechazado',
  waived: 'Exento',
};

const VALIDATION_STATUS_VARIANTS: Record<string, 'warning' | 'success' | 'danger' | 'neutral'> = {
  pending: 'neutral',
  passed: 'success',
  failed: 'danger',
  waived: 'warning',
};

const DEPOSIT_STATUS_LABELS: Record<string, string> = {
  collected: 'Cobrado',
  held: 'Retenido',
  inspection_pending: 'Inspeccion pendiente',
  deductions_pending: 'Deducciones pendientes',
  refund_pending: 'Reembolso pendiente',
  refunded: 'Reembolsado',
  forfeited: 'Retenido',
};

/* ------------------------------------------------------------------ */
/*  Main Page                                                          */
/* ------------------------------------------------------------------ */

export default function MoveDetailPage() {
  const params = useParams();
  const moveId = params.id as string;
  const { user } = useAuth();

  const { data: move, isLoading } = useMoveDetail(moveId);
  const { data: validations } = useMoveValidations(moveId);
  const { data: deposits } = useMoveDeposits(move?.id);

  const updateStatus = useUpdateMoveStatus();
  const updateValidation = useUpdateValidation();
  const createDeposit = useCreateDeposit();
  const processRefund = useProcessDepositRefund();
  const approveRefund = useApproveDepositRefund();
  const completeRefund = useCompleteDepositRefund();
  const forfeitDeposit = useForfeitDeposit();

  const [validationNotes, setValidationNotes] = useState<Record<string, string>>({});
  const [showDepositForm, setShowDepositForm] = useState(false);
  const [depositForm, setDepositForm] = useState({
    amount: '',
    collection_date: new Date().toISOString().split('T')[0],
  });
  const [showDeductionForm, setShowDeductionForm] = useState(false);
  const [deductionForm, setDeductionForm] = useState({ amount: '', reason: '' });
  const [showRefundForm, setShowRefundForm] = useState(false);
  const [refundForm, setRefundForm] = useState({ method: 'transfer', reference: '' });
  const [forfeitReason, setForfeitReason] = useState('');

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-gray-500">Cargando...</div>
      </div>
    );
  }

  if (!move) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-gray-500">Mudanza no encontrada</div>
      </div>
    );
  }

  const deposit = deposits?.[0];

  const handleStatusChange = (newStatus: string) => {
    if (
      confirm(`¿Cambiar estado de mudanza a "${STATUS_LABELS[newStatus] ?? newStatus}"?`)
    ) {
      updateStatus.mutate({ id: move.id, status: newStatus });
    }
  };

  const handleValidationAction = (
    validationId: string,
    status: 'passed' | 'failed' | 'waived'
  ) => {
    updateValidation.mutate({
      id: validationId,
      status,
      checked_by: user?.id,
      notes: validationNotes[validationId] || undefined,
    });
  };

  const handleCreateDeposit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!depositForm.amount) return;
    createDeposit.mutate(
      {
        move_request_id: move.id,
        unit_id: move.unit_id,
        resident_id: move.resident_id,
        amount: parseFloat(depositForm.amount),
        collection_date: depositForm.collection_date,
      },
      {
        onSuccess: () => {
          setShowDepositForm(false);
          setDepositForm({ amount: '', collection_date: new Date().toISOString().split('T')[0] });
        },
      }
    );
  };

  const handleProcessDeductions = (e: React.FormEvent) => {
    e.preventDefault();
    if (!deposit) return;
    processRefund.mutate(
      {
        depositId: deposit.id,
        deductionAmount: parseFloat(deductionForm.amount) || 0,
        deductionReason: deductionForm.reason || 'Sin deducciones',
      },
      {
        onSuccess: () => {
          setShowDeductionForm(false);
          setDeductionForm({ amount: '', reason: '' });
        },
      }
    );
  };

  const handleCompleteRefund = (e: React.FormEvent) => {
    e.preventDefault();
    if (!deposit || !refundForm.reference) return;
    completeRefund.mutate(
      {
        depositId: deposit.id,
        method: refundForm.method,
        reference: refundForm.reference,
      },
      {
        onSuccess: () => {
          setShowRefundForm(false);
          setRefundForm({ method: 'transfer', reference: '' });
        },
      }
    );
  };

  const handleForfeit = () => {
    if (!deposit || !forfeitReason.trim()) {
      alert('Debe proporcionar un motivo para retener el deposito');
      return;
    }
    if (confirm('¿Retener el deposito completo?')) {
      forfeitDeposit.mutate(
        { depositId: deposit.id, reason: forfeitReason },
        { onSuccess: () => setForfeitReason('') }
      );
    }
  };

  const inputClass =
    'w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">
          Mudanza: {move.units?.unit_number ?? 'Unidad desconocida'}
        </h1>
        <Badge variant={move.status === 'completed' ? 'success' : 'warning'}>
          {STATUS_LABELS[move.status] ?? move.status}
        </Badge>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Left column: Move details + validations */}
        <div className="space-y-6 lg:col-span-2">
          {/* Move info card */}
          <Card>
            <h2 className="mb-4 text-lg font-semibold text-gray-900">Detalles de Mudanza</h2>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Tipo:</span>
                <Badge variant={move.move_type === 'move_in' ? 'success' : 'warning'}>
                  {move.move_type === 'move_in' ? 'Entrada' : 'Salida'}
                </Badge>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Unidad:</span>
                <span className="font-semibold">{move.units?.unit_number ?? '-'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Residente:</span>
                <span>
                  {move.residents
                    ? `${move.residents.first_name} ${move.residents.paternal_surname}`
                    : '-'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Fecha Programada:</span>
                <span>{format(parseISO(move.requested_date), 'dd/MM/yyyy', { locale: es })}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Empresa de Mudanza:</span>
                <span>{move.moving_company_name ?? '-'}</span>
              </div>
              {move.moving_company_phone && (
                <div className="flex justify-between">
                  <span className="text-gray-600">Telefono:</span>
                  <span>{move.moving_company_phone}</span>
                </div>
              )}
              {move.resident_notes && (
                <div>
                  <span className="text-gray-600">Notas:</span>
                  <p className="mt-1 text-gray-900">{move.resident_notes}</p>
                </div>
              )}
            </div>

            {/* Status workflow buttons */}
            <div className="mt-6 flex flex-wrap gap-2">
              {move.status === 'requested' && (
                <Button size="sm" onClick={() => handleStatusChange('validating')}>
                  Iniciar Validacion
                </Button>
              )}
              {move.status === 'validating' && move.all_validations_passed && (
                <Button size="sm" onClick={() => handleStatusChange('approved')}>
                  Aprobar
                </Button>
              )}
              {move.status === 'approved' && (
                <Button size="sm" onClick={() => handleStatusChange('scheduled')}>
                  Programar
                </Button>
              )}
              {move.status === 'scheduled' && (
                <Button size="sm" onClick={() => handleStatusChange('in_progress')}>
                  Iniciar Mudanza
                </Button>
              )}
              {move.status === 'in_progress' && (
                <Button size="sm" onClick={() => handleStatusChange('completed')}>
                  Completar Mudanza
                </Button>
              )}
              {['requested', 'validating', 'approved', 'scheduled'].includes(move.status) && (
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => handleStatusChange('cancelled')}
                >
                  Cancelar
                </Button>
              )}
            </div>
          </Card>

          {/* Validation checklist */}
          <Card>
            <h2 className="mb-4 text-lg font-semibold text-gray-900">Lista de Validaciones</h2>
            {move.all_validations_passed && (
              <div className="mb-4 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
                ✓ Todas las validaciones requeridas han sido aprobadas
              </div>
            )}
            <div className="space-y-3">
              {validations?.map((val) => (
                <div
                  key={val.id}
                  className="rounded-lg border border-gray-200 bg-gray-50 p-4"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-gray-900">
                          {val.validation_type}
                        </span>
                        <Badge variant={VALIDATION_STATUS_VARIANTS[val.status] ?? 'neutral'}>
                          {VALIDATION_STATUS_LABELS[val.status] ?? val.status}
                        </Badge>
                      </div>
                      {val.checked_at && (
                        <p className="mt-1 text-xs text-gray-500">
                          Validado: {format(parseISO(val.checked_at), 'dd/MM/yyyy HH:mm', { locale: es })}
                        </p>
                      )}
                      {val.notes && (
                        <p className="mt-1 text-sm italic text-gray-600">"{val.notes}"</p>
                      )}
                    </div>
                    {val.status === 'pending' && (
                      <div className="ml-4 flex gap-2">
                        <Button
                          size="sm"
                          onClick={() => handleValidationAction(val.id, 'passed')}
                        >
                          Aprobar
                        </Button>
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => handleValidationAction(val.id, 'failed')}
                        >
                          Rechazar
                        </Button>
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => handleValidationAction(val.id, 'waived')}
                        >
                          Eximir
                        </Button>
                      </div>
                    )}
                  </div>
                  {val.status === 'pending' && (
                    <div className="mt-2">
                      <input
                        type="text"
                        placeholder="Notas (opcional)"
                        value={validationNotes[val.id] ?? ''}
                        onChange={(e) =>
                          setValidationNotes({ ...validationNotes, [val.id]: e.target.value })
                        }
                        className={inputClass}
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </Card>
        </div>

        {/* Right column: Deposit management */}
        <div className="space-y-6">
          <Card>
            <h2 className="mb-4 text-lg font-semibold text-gray-900">Deposito de Garantia</h2>
            {!deposit ? (
              <div>
                {!showDepositForm ? (
                  <Button onClick={() => setShowDepositForm(true)}>Registrar Deposito</Button>
                ) : (
                  <form onSubmit={handleCreateDeposit} className="space-y-3">
                    <div>
                      <label className="mb-1 block text-sm font-medium text-gray-700">
                        Monto
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        required
                        value={depositForm.amount}
                        onChange={(e) =>
                          setDepositForm({ ...depositForm, amount: e.target.value })
                        }
                        className={inputClass}
                        placeholder="0.00"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-sm font-medium text-gray-700">
                        Fecha de Cobro
                      </label>
                      <input
                        type="date"
                        required
                        value={depositForm.collection_date}
                        onChange={(e) =>
                          setDepositForm({ ...depositForm, collection_date: e.target.value })
                        }
                        className={inputClass}
                      />
                    </div>
                    <div className="flex gap-2">
                      <Button type="submit" size="sm" isLoading={createDeposit.isPending}>
                        Guardar
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        onClick={() => setShowDepositForm(false)}
                      >
                        Cancelar
                      </Button>
                    </div>
                  </form>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Monto:</span>
                    <span className="font-semibold">
                      ${deposit.amount.toFixed(2)} MXN
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Estado:</span>
                    <Badge variant="warning">
                      {DEPOSIT_STATUS_LABELS[deposit.status] ?? deposit.status}
                    </Badge>
                  </div>
                  {deposit.deduction_amount && (
                    <>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Deducciones:</span>
                        <span className="text-red-600">-${deposit.deduction_amount.toFixed(2)}</span>
                      </div>
                      {deposit.deduction_reason && (
                        <div>
                          <span className="text-gray-600">Motivo:</span>
                          <p className="text-gray-900">{deposit.deduction_reason}</p>
                        </div>
                      )}
                    </>
                  )}
                  {deposit.refund_amount != null && (
                    <div className="flex justify-between border-t border-gray-200 pt-2">
                      <span className="font-semibold text-gray-900">Monto a Reembolsar:</span>
                      <span className="font-bold text-green-600">
                        ${deposit.refund_amount.toFixed(2)}
                      </span>
                    </div>
                  )}
                </div>

                {/* Deposit lifecycle actions */}
                <div className="space-y-3">
                  {(deposit.status === 'collected' || deposit.status === 'inspection_pending') && (
                    <div>
                      {!showDeductionForm ? (
                        <div className="flex gap-2">
                          <Button size="sm" onClick={() => setShowDeductionForm(true)}>
                            Procesar Deducciones
                          </Button>
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() =>
                              processRefund.mutate({
                                depositId: deposit.id,
                                deductionAmount: 0,
                                deductionReason: 'Sin deducciones',
                              })
                            }
                          >
                            Sin Deducciones
                          </Button>
                        </div>
                      ) : (
                        <form onSubmit={handleProcessDeductions} className="space-y-2">
                          <input
                            type="number"
                            step="0.01"
                            placeholder="Monto deduccion"
                            value={deductionForm.amount}
                            onChange={(e) =>
                              setDeductionForm({ ...deductionForm, amount: e.target.value })
                            }
                            className={inputClass}
                          />
                          <textarea
                            placeholder="Motivo de deduccion"
                            required
                            value={deductionForm.reason}
                            onChange={(e) =>
                              setDeductionForm({ ...deductionForm, reason: e.target.value })
                            }
                            className={inputClass}
                            rows={2}
                          />
                          <div className="flex gap-2">
                            <Button type="submit" size="sm" isLoading={processRefund.isPending}>
                              Procesar
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="secondary"
                              onClick={() => setShowDeductionForm(false)}
                            >
                              Cancelar
                            </Button>
                          </div>
                        </form>
                      )}
                    </div>
                  )}

                  {deposit.status === 'refund_pending' && (
                    <Button
                      size="sm"
                      onClick={() => approveRefund.mutate(deposit.id)}
                      isLoading={approveRefund.isPending}
                    >
                      Aprobar Reembolso
                    </Button>
                  )}

                  {(deposit.status === 'refund_pending' || deposit.refund_amount != null) &&
                    deposit.status !== 'refunded' && (
                      <div>
                        {!showRefundForm ? (
                          <Button size="sm" onClick={() => setShowRefundForm(true)}>
                            Completar Reembolso
                          </Button>
                        ) : (
                          <form onSubmit={handleCompleteRefund} className="space-y-2">
                            <select
                              value={refundForm.method}
                              onChange={(e) =>
                                setRefundForm({ ...refundForm, method: e.target.value })
                              }
                              className={inputClass}
                            >
                              <option value="transfer">Transferencia</option>
                              <option value="check">Cheque</option>
                              <option value="cash">Efectivo</option>
                            </select>
                            <input
                              type="text"
                              placeholder="Referencia"
                              required
                              value={refundForm.reference}
                              onChange={(e) =>
                                setRefundForm({ ...refundForm, reference: e.target.value })
                              }
                              className={inputClass}
                            />
                            <div className="flex gap-2">
                              <Button type="submit" size="sm" isLoading={completeRefund.isPending}>
                                Completar
                              </Button>
                              <Button
                                type="button"
                                size="sm"
                                variant="secondary"
                                onClick={() => setShowRefundForm(false)}
                              >
                                Cancelar
                              </Button>
                            </div>
                          </form>
                        )}
                      </div>
                    )}

                  {deposit.status !== 'refunded' && deposit.status !== 'forfeited' && (
                    <div className="border-t border-gray-200 pt-3">
                      <textarea
                        placeholder="Motivo para retener deposito"
                        value={forfeitReason}
                        onChange={(e) => setForfeitReason(e.target.value)}
                        className={inputClass}
                        rows={2}
                      />
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={handleForfeit}
                        isLoading={forfeitDeposit.isPending}
                        className="mt-2"
                      >
                        Retener Deposito
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
