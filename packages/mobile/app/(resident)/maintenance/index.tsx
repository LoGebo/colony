import { View, Text, FlatList, Pressable, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { useMyTickets } from '@/hooks/useTickets';
import { EmptyState } from '@/components/ui/EmptyState';
import { StatusBadge } from '@/components/ui/Badge';
import { formatRelative } from '@/lib/dates';

const STATUS_VARIANTS: Record<string, { bg: string; text: string; label: string }> = {
  open: { bg: 'bg-blue-100', text: 'text-blue-800', label: 'Abierto' },
  assigned: { bg: 'bg-amber-100', text: 'text-amber-800', label: 'Asignado' },
  in_progress: { bg: 'bg-amber-100', text: 'text-amber-800', label: 'En progreso' },
  pending_parts: { bg: 'bg-purple-100', text: 'text-purple-800', label: 'Esperando piezas' },
  pending_resident: { bg: 'bg-yellow-100', text: 'text-yellow-800', label: 'Esperando residente' },
  resolved: { bg: 'bg-green-100', text: 'text-green-800', label: 'Resuelto' },
  closed: { bg: 'bg-gray-100', text: 'text-gray-600', label: 'Cerrado' },
  cancelled: { bg: 'bg-red-100', text: 'text-red-800', label: 'Cancelado' },
};

const PRIORITY_COLORS: Record<string, string> = {
  low: 'bg-gray-400',
  medium: 'bg-blue-500',
  high: 'bg-orange-500',
  urgent: 'bg-red-500',
};

type TicketItem = {
  id: string;
  title: string;
  status: string;
  priority: string;
  created_at: string;
  ticket_categories: { name: string; icon: string | null; color: string | null } | null;
};

export default function TicketListScreen() {
  const router = useRouter();
  const { data: tickets, isLoading, isRefetching, refetch } = useMyTickets();

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-gray-50">
        <ActivityIndicator size="large" color="#2563eb" />
        <Text className="text-sm text-gray-500 mt-3">Cargando tickets...</Text>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-gray-50">
      {/* Header */}
      <View className="px-4 pt-4 pb-2">
        <View className="flex-row items-center justify-between mb-4">
          <Text className="text-xl font-bold text-gray-900">Mantenimiento</Text>
          <Pressable
            onPress={() => router.push('/(resident)/maintenance/create')}
            className="bg-blue-600 rounded-lg px-4 py-2 active:opacity-80"
          >
            <Text className="text-white font-semibold">+ Nuevo</Text>
          </Pressable>
        </View>
      </View>

      {/* List */}
      <FlatList
        data={(tickets ?? []) as TicketItem[]}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 }}
        renderItem={({ item }) => (
          <Pressable
            onPress={() => router.push(`/(resident)/maintenance/${item.id}`)}
            className="bg-white rounded-xl p-4 mb-3 shadow-sm active:opacity-80"
          >
            <View className="flex-row items-start justify-between mb-2">
              <View className="flex-1 mr-3">
                <Text className="text-base font-semibold text-gray-900" numberOfLines={1}>
                  {item.title}
                </Text>
              </View>
              <StatusBadge status={item.status} variants={STATUS_VARIANTS} />
            </View>

            <View className="flex-row items-center justify-between">
              <View className="flex-row items-center">
                {/* Priority dot */}
                <View
                  className={`w-2.5 h-2.5 rounded-full mr-2 ${PRIORITY_COLORS[item.priority] ?? 'bg-gray-400'}`}
                />
                {/* Category */}
                {item.ticket_categories ? (
                  <Text className="text-sm text-gray-600">
                    {item.ticket_categories.icon ? `${item.ticket_categories.icon} ` : ''}
                    {item.ticket_categories.name}
                  </Text>
                ) : null}
              </View>

              <Text className="text-xs text-gray-400">{formatRelative(item.created_at)}</Text>
            </View>
          </Pressable>
        )}
        refreshing={isRefetching}
        onRefresh={refetch}
        ListEmptyComponent={
          <EmptyState
            message="No tienes tickets de mantenimiento"
            icon="🔧"
          />
        }
      />
    </View>
  );
}
