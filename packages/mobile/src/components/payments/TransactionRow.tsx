import React from 'react';
import { View, Text } from 'react-native';
import { formatCurrency, formatDate } from '@/lib/dates';
import type { Transaction } from '@/hooks/usePayments';

interface TransactionRowProps {
  transaction: Transaction;
}

const TYPE_CONFIG: Record<string, { label: string; color: string; sign: string }> = {
  charge: { label: 'Cargo', color: 'text-red-600', sign: '+' },
  payment: { label: 'Pago', color: 'text-green-600', sign: '-' },
  interest: { label: 'Interes', color: 'text-orange-500', sign: '+' },
  adjustment: { label: 'Ajuste', color: 'text-blue-600', sign: '' },
  reversal: { label: 'Reverso', color: 'text-gray-600', sign: '' },
  transfer: { label: 'Transferencia', color: 'text-purple-600', sign: '' },
};

function TransactionRowInner({ transaction }: TransactionRowProps) {
  const config = TYPE_CONFIG[transaction.transaction_type] ?? {
    label: transaction.transaction_type,
    color: 'text-gray-600',
    sign: '',
  };

  return (
    <View className="flex-row items-center py-3 border-b border-gray-100">
      {/* Left: type + description */}
      <View className="flex-1 mr-3">
        <Text className="text-sm font-medium text-gray-900">{config.label}</Text>
        <Text className="text-xs text-gray-500 mt-0.5" numberOfLines={1}>
          {transaction.description}
        </Text>
      </View>

      {/* Right: amount + date */}
      <View className="items-end">
        <Text className={`text-sm font-semibold ${config.color}`}>
          {config.sign}{formatCurrency(transaction.amount, transaction.currency)}
        </Text>
        <Text className="text-xs text-gray-400 mt-0.5">
          {formatDate(transaction.effective_date)}
        </Text>
      </View>
    </View>
  );
}

export const TransactionRow = React.memo(TransactionRowInner);
