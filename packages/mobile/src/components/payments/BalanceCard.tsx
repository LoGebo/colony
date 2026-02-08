import { View, Text } from 'react-native';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { formatCurrency, formatDate } from '@/lib/dates';
import type { UnitBalance } from '@/hooks/usePayments';

interface BalanceCardProps {
  balance: UnitBalance | null;
  isLoading: boolean;
}

export function BalanceCard({ balance, isLoading }: BalanceCardProps) {
  if (isLoading) {
    return (
      <View className="bg-white rounded-2xl p-6 shadow-sm items-center justify-center min-h-[180px]">
        <LoadingSpinner message="Cargando saldo..." />
      </View>
    );
  }

  if (!balance) {
    return (
      <View className="bg-white rounded-2xl p-6 shadow-sm">
        <Text className="text-gray-400 text-center">Sin informacion de saldo</Text>
      </View>
    );
  }

  const isOverdue = balance.current_balance > 0;
  const balanceColor = isOverdue ? 'text-red-600' : 'text-green-600';
  const statusColor = isOverdue ? 'text-red-500' : 'text-green-600';

  return (
    <View className="bg-white rounded-2xl p-6 shadow-sm">
      {/* Main balance */}
      <Text className="text-sm text-gray-500">Saldo actual</Text>
      <Text className={`text-3xl font-bold ${balanceColor} mt-1`}>
        {formatCurrency(balance.current_balance)}
      </Text>

      {/* Status line */}
      <Text className={`text-sm ${statusColor} mt-1`}>
        {balance.days_overdue > 0
          ? `Vencido ${balance.days_overdue} dias`
          : 'Al corriente'}
      </Text>

      {/* Breakdown */}
      <View className="flex-row mt-4 pt-4 border-t border-gray-100">
        <View className="flex-1 items-center">
          <Text className="text-xs text-gray-500">Cargos</Text>
          <Text className="text-sm font-semibold text-gray-900 mt-0.5">
            {formatCurrency(balance.total_charges)}
          </Text>
        </View>
        <View className="flex-1 items-center">
          <Text className="text-xs text-gray-500">Pagos</Text>
          <Text className="text-sm font-semibold text-gray-900 mt-0.5">
            {formatCurrency(balance.total_payments)}
          </Text>
        </View>
        <View className="flex-1 items-center">
          <Text className="text-xs text-gray-500">Vencido</Text>
          <Text className="text-sm font-semibold text-gray-900 mt-0.5">
            {balance.days_overdue > 0 ? `${balance.days_overdue}d` : '-'}
          </Text>
        </View>
      </View>

      {/* Last payment date */}
      {balance.last_payment_date ? (
        <Text className="text-xs text-gray-400 mt-3 text-center">
          Ultimo pago: {formatDate(balance.last_payment_date)}
        </Text>
      ) : null}
    </View>
  );
}
