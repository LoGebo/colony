'use client';

export const dynamic = 'force-dynamic';

import { useState } from 'react';
import { usePaymentIntents, useFailedWebhooks } from '@/hooks/useStripePayments';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { formatCurrency, formatDate } from '@/lib/formatters';
import { exportToExcel } from '@/lib/export';

const STATUS_OPTIONS = [
  { key: 'all', label: 'Todos' },
  { key: 'succeeded', label: 'Exitosos' },
  { key: 'requires_action', label: 'Pendientes' },
  { key: 'processing', label: 'Procesando' },
  { key: 'failed', label: 'Fallidos' },
  { key: 'canceled', label: 'Cancelados' },
];

function getStatusBadge(status: string) {
  switch (status) {
    case 'succeeded':
      return { bg: 'bg-green-100', text: 'text-green-800', label: 'Exitoso' };
    case 'requires_action':
      return { bg: 'bg-yellow-100', text: 'text-yellow-800', label: 'Pendiente' };
    case 'processing':
      return { bg: 'bg-blue-100', text: 'text-blue-800', label: 'Procesando' };
    case 'failed':
      return { bg: 'bg-red-100', text: 'text-red-800', label: 'Fallido' };
    case 'canceled':
      return { bg: 'bg-gray-100', text: 'text-gray-800', label: 'Cancelado' };
    case 'requires_payment_method':
      return { bg: 'bg-orange-100', text: 'text-orange-800', label: 'Requiere Metodo' };
    default:
      return { bg: 'bg-gray-100', text: 'text-gray-800', label: status };
  }
}

function getMethodLabel(method: string) {
  switch (method) {
    case 'card':
      return 'Tarjeta';
    case 'oxxo':
      return 'OXXO';
    case 'spei':
      return 'SPEI';
    default:
      return method;
  }
}

export default function StripePaymentsPage() {
  const [statusFilter, setStatusFilter] = useState('all');
  const { data: paymentIntents, isLoading } = usePaymentIntents(statusFilter);
  const { data: failedWebhooks, isLoading: webhooksLoading } = useFailedWebhooks();

  function handleExport() {
    if (!paymentIntents || paymentIntents.length === 0) return;
    const exportData = paymentIntents.map((pi) => ({
      'Stripe ID': pi.stripe_payment_intent_id,
      Unidad: pi.unit_number ?? '',
      Edificio: pi.building ?? '',
      Monto: Number(pi.amount),
      Moneda: pi.currency,
      Metodo: getMethodLabel(pi.payment_method_type),
      Estado: getStatusBadge(pi.status).label,
      Fecha: pi.created_at,
    }));
    exportToExcel(exportData, 'pagos-stripe', 'Payment Intents');
  }

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Pagos Stripe</h1>
          <p className="mt-1 text-sm text-gray-500">
            Seguimiento de PaymentIntents y alertas de webhooks fallidos
          </p>
        </div>
        <Button
          variant="secondary"
          size="md"
          onClick={handleExport}
          disabled={!paymentIntents || paymentIntents.length === 0}
        >
          <svg
            className="mr-2 h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3"
            />
          </svg>
          Exportar Excel
        </Button>
      </div>

      {/* Failed Webhook Alerts */}
      {!webhooksLoading && failedWebhooks && failedWebhooks.length > 0 && (
        <Card>
          <div className="mb-3 flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-red-500" />
            <h2 className="text-base font-semibold text-red-700">
              Webhooks Fallidos ({failedWebhooks.length})
            </h2>
          </div>
          <div className="max-h-48 space-y-2 overflow-y-auto">
            {failedWebhooks.map((wh) => (
              <div
                key={wh.id}
                className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-red-800">
                    {wh.event_type}
                  </p>
                  <p className="truncate text-xs text-red-600">
                    {wh.error_message ?? 'Error desconocido'}
                  </p>
                </div>
                <span className="whitespace-nowrap text-xs text-red-500">
                  {formatDate(wh.created_at)}
                </span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Status Filter Pills */}
      <div className="flex flex-wrap gap-2">
        {STATUS_OPTIONS.map((opt) => (
          <button
            key={opt.key}
            onClick={() => setStatusFilter(opt.key)}
            className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
              statusFilter === opt.key
                ? 'bg-indigo-600 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* Payment Intents Table */}
      <Card>
        <h2 className="mb-4 text-lg font-semibold text-gray-900">Payment Intents</h2>
        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-12 animate-pulse rounded bg-gray-100" />
            ))}
          </div>
        ) : !paymentIntents || paymentIntents.length === 0 ? (
          <p className="py-6 text-center text-sm text-gray-500">
            No se encontraron payment intents.
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
                    Unidad
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    Metodo
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">
                    Monto
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-medium uppercase tracking-wider text-gray-500">
                    Estado
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    Stripe ID
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {paymentIntents.map((pi) => {
                  const badge = getStatusBadge(pi.status);
                  return (
                    <tr key={pi.id} className="hover:bg-gray-50">
                      <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-500">
                        {formatDate(pi.created_at)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-900">
                        {pi.unit_number ?? '—'}
                        {pi.building && (
                          <span className="ml-1 text-gray-400">({pi.building})</span>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-500">
                        {getMethodLabel(pi.payment_method_type)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-right text-sm font-medium text-gray-900">
                        {formatCurrency(Number(pi.amount))}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-center">
                        <span
                          className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${badge.bg} ${badge.text}`}
                        >
                          {badge.label}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-xs font-mono text-gray-400">
                        {pi.stripe_payment_intent_id.slice(0, 20)}...
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
