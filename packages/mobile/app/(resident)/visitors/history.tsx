import { View, Text, FlatList } from 'react-native';
import { useRouter } from 'expo-router';
import { useVisitorHistory } from '@/hooks/useVisitors';
import { InvitationCard } from '@/components/visitors/InvitationCard';
import { EmptyState } from '@/components/ui/EmptyState';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';

export default function VisitorHistoryScreen() {
  const router = useRouter();
  const {
    data,
    isLoading,
    isRefetching,
    refetch,
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
  } = useVisitorHistory();

  const allItems = data?.pages.flatMap((p) => p.data) ?? [];

  if (isLoading) {
    return <LoadingSpinner message="Cargando historial..." />;
  }

  return (
    <View className="flex-1 bg-gray-50">
      <View className="px-4 pt-4 pb-2">
        <Text className="text-xl font-bold text-gray-900">Historial de Visitantes</Text>
      </View>

      <FlatList
        data={allItems}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 }}
        renderItem={({ item }) => (
          <InvitationCard
            invitation={item}
            onPress={() => router.push(`/(resident)/visitors/${item.id}`)}
          />
        )}
        refreshing={isRefetching}
        onRefresh={refetch}
        onEndReached={() => {
          if (hasNextPage && !isFetchingNextPage) {
            fetchNextPage();
          }
        }}
        onEndReachedThreshold={0.5}
        ListEmptyComponent={
          <EmptyState message="Sin historial de visitantes" icon="📋" />
        }
        ListFooterComponent={
          isFetchingNextPage ? <LoadingSpinner message="Cargando mas..." /> : null
        }
      />
    </View>
  );
}
