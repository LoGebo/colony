import { View, Text, ScrollView, RefreshControl, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/hooks/useAuth';
import { useResidentUnit } from '@/hooks/useOccupancy';
import { useUnitBalance, useTransactions, usePaymentProofs } from '@/hooks/usePayments';
import { BalanceCard } from '@/components/payments/BalanceCard';
import { TransactionRow } from '@/components/payments/TransactionRow';
import { PaymentProofCard } from '@/components/payments/PaymentProofCard';
import { EmptyState } from '@/components/ui/EmptyState';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { useState, useCallback } from 'react';

export default function PaymentsOverviewScreen() {
  const router = useRouter();
  const { unitId, isLoading: unitLoading } = useResidentUnit();

  const {
    data: balance,
    isLoading: balanceLoading,
    refetch: refetchBalance,
  } = useUnitBalance(unitId ?? undefined);

  const {
    data: txPages,
    isLoading: txLoading,
    refetch: refetchTx,
  } = useTransactions(unitId ?? undefined);

  const {
    data: proofs,
    isLoading: proofsLoading,
    refetch: refetchProofs,
  } = usePaymentProofs(unitId ?? undefined);

  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([refetchBalance(), refetchTx(), refetchProofs()]);
    setRefreshing(false);
  }, [refetchBalance, refetchTx, refetchProofs]);

  if (unitLoading) {
    return <LoadingSpinner message="Cargando pagos..." />;
  }

  if (!unitId) {
    return <EmptyState message="No se encontro unidad asociada" icon="🏠" />;
  }

  const recentTransactions = txPages?.pages.flatMap((p) => p.data).slice(0, 5) ?? [];
  const recentProofs = proofs?.slice(0, 3) ?? [];

  return (
    <ScrollView
      className="flex-1 bg-gray-50"
      contentContainerStyle={{ paddingBottom: 32 }}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      {/* Header */}
      <View className="px-4 pt-4 pb-2">
        <Text className="text-xl font-bold text-gray-900">Pagos</Text>
      </View>

      {/* Balance Card */}
      <View className="px-4 mb-4">
        <BalanceCard balance={balance ?? null} isLoading={balanceLoading} />
      </View>

      {/* Upload Proof Button */}
      <View className="px-4 mb-4">
        <Pressable
          onPress={() => router.push('/(resident)/payments/upload-proof')}
          className="bg-blue-600 rounded-lg px-4 py-3 items-center active:opacity-80"
        >
          <Text className="text-white font-semibold">Subir Comprobante</Text>
        </Pressable>
      </View>

      {/* Recent Proofs */}
      {proofsLoading ? null : recentProofs.length > 0 ? (
        <View className="px-4 mb-4">
          <Text className="text-base font-semibold text-gray-900 mb-2">
            Comprobantes recientes
          </Text>
          {recentProofs.map((proof) => (
            <PaymentProofCard key={proof.id} proof={proof} />
          ))}
        </View>
      ) : null}

      {/* Recent Transactions */}
      <View className="px-4">
        <View className="flex-row items-center justify-between mb-2">
          <Text className="text-base font-semibold text-gray-900">
            Movimientos recientes
          </Text>
          <Pressable
            onPress={() => router.push('/(resident)/payments/history')}
            className="active:opacity-70"
          >
            <Text className="text-blue-600 underline text-sm">Ver historial</Text>
          </Pressable>
        </View>

        {txLoading ? (
          <LoadingSpinner message="Cargando movimientos..." />
        ) : recentTransactions.length > 0 ? (
          <View className="bg-white rounded-xl px-4 shadow-sm">
            {recentTransactions.map((tx) => (
              <TransactionRow key={tx.id} transaction={tx} />
            ))}
          </View>
        ) : (
          <EmptyState message="Sin movimientos registrados" icon="📄" />
        )}
      </View>
    </ScrollView>
  );
}
