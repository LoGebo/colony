import { View, Text } from 'react-native';
import { StatusBadge } from '@/components/ui/Badge';
import { formatCurrency, formatDate } from '@/lib/dates';
import type { PaymentProof } from '@/hooks/usePayments';

interface PaymentProofCardProps {
  proof: PaymentProof;
}

const PROOF_VARIANTS: Record<string, { bg: string; text: string; label: string }> = {
  pending: { bg: 'bg-yellow-100', text: 'text-yellow-800', label: 'En revision' },
  approved: { bg: 'bg-green-100', text: 'text-green-800', label: 'Aprobado' },
  rejected: { bg: 'bg-red-100', text: 'text-red-800', label: 'Rechazado' },
};

export function PaymentProofCard({ proof }: PaymentProofCardProps) {
  return (
    <View className="bg-white rounded-xl p-4 shadow-sm mb-3">
      {/* Header: amount + status */}
      <View className="flex-row items-center justify-between mb-2">
        <Text className="text-lg font-bold text-gray-900">
          {formatCurrency(proof.amount)}
        </Text>
        <StatusBadge status={proof.status} variants={PROOF_VARIANTS} />
      </View>

      {/* Details */}
      <View className="space-y-1">
        <Text className="text-sm text-gray-600">
          Fecha de pago: {formatDate(proof.payment_date)}
        </Text>
        {proof.reference_number ? (
          <Text className="text-sm text-gray-600">
            Referencia: {proof.reference_number}
          </Text>
        ) : null}
        {proof.bank_name ? (
          <Text className="text-sm text-gray-600">Banco: {proof.bank_name}</Text>
        ) : null}
      </View>

      {/* Rejection reason */}
      {proof.status === 'rejected' && proof.rejection_reason ? (
        <View className="mt-2 bg-red-50 rounded-lg p-3">
          <Text className="text-xs font-medium text-red-700">Motivo de rechazo:</Text>
          <Text className="text-xs text-red-600 mt-0.5">{proof.rejection_reason}</Text>
        </View>
      ) : null}
    </View>
  );
}
