import { View, Text, FlatList } from 'react-native';
import { useResidentUnit } from '@/hooks/useOccupancy';
import { useTransactions } from '@/hooks/usePayments';
import { TransactionRow } from '@/components/payments/TransactionRow';
import { EmptyState } from '@/components/ui/EmptyState';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';

export default function PaymentHistoryScreen() {
  const { unitId } = useResidentUnit();
  const {
    data,
    isLoading,
    isRefetching,
    refetch,
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
  } = useTransactions(unitId ?? undefined);

  const allItems = data?.pages.flatMap((p) => p.data) ?? [];

  if (isLoading) {
    return <LoadingSpinner message="Cargando historial..." />;
  }

  return (
    <View className="flex-1 bg-gray-50">
      <View className="px-4 pt-4 pb-2">
        <Text className="text-xl font-bold text-gray-900">Historial de Pagos</Text>
      </View>

      <FlatList
        data={allItems}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 }}
        renderItem={({ item }) => <TransactionRow transaction={item} />}
        refreshing={isRefetching}
        onRefresh={refetch}
        onEndReached={() => {
          if (hasNextPage && !isFetchingNextPage) {
            fetchNextPage();
          }
        }}
        onEndReachedThreshold={0.5}
        ListEmptyComponent={
          <EmptyState message="Sin movimientos registrados" icon="📄" />
        }
        ListFooterComponent={
          isFetchingNextPage ? <LoadingSpinner message="Cargando mas..." /> : null
        }
      />
    </View>
  );
}
