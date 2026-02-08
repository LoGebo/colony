import { View, Text, FlatList, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { useActiveInvitations } from '@/hooks/useVisitors';
import { InvitationCard } from '@/components/visitors/InvitationCard';
import { EmptyState } from '@/components/ui/EmptyState';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';

export default function VisitorsListScreen() {
  const router = useRouter();
  const { data: invitations, isLoading, isRefetching, refetch } = useActiveInvitations();

  if (isLoading) {
    return <LoadingSpinner message="Cargando visitantes..." />;
  }

  return (
    <View className="flex-1 bg-gray-50">
      {/* Header */}
      <View className="px-4 pt-4 pb-2">
        <View className="flex-row items-center justify-between mb-4">
          <Text className="text-xl font-bold text-gray-900">Visitantes</Text>
          <Pressable
            onPress={() => router.push('/(resident)/visitors/history')}
            className="active:opacity-70"
          >
            <Text className="text-blue-600 underline text-sm">Historial</Text>
          </Pressable>
        </View>

        <Pressable
          onPress={() => router.push('/(resident)/visitors/create')}
          className="bg-blue-600 rounded-lg px-4 py-2 items-center active:opacity-80"
        >
          <Text className="text-white font-semibold">Nueva Invitacion</Text>
        </Pressable>
      </View>

      {/* List */}
      <FlatList
        data={invitations ?? []}
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
        ListEmptyComponent={
          <EmptyState message="No tienes visitantes activos" icon="🚪" />
        }
      />
    </View>
  );
}
