import {
  View,
  Text,
  FlatList,
  Pressable,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/hooks/useAuth';
import { useIncidentList } from '@/hooks/useIncidents';
import { useUnacknowledgedHandovers } from '@/hooks/useHandovers';
import { formatRelative } from '@/lib/dates';

const SEVERITY_COLORS: Record<
  string,
  { bg: string; text: string; label: string }
> = {
  low: { bg: 'bg-green-100', text: 'text-green-700', label: 'Baja' },
  medium: { bg: 'bg-yellow-100', text: 'text-yellow-700', label: 'Media' },
  high: { bg: 'bg-orange-100', text: 'text-orange-700', label: 'Alta' },
  critical: { bg: 'bg-red-100', text: 'text-red-700', label: 'Crítica' },
};

const STATUS_COLORS: Record<
  string,
  { bg: string; text: string; label: string }
> = {
  reported: { bg: 'bg-gray-100', text: 'text-gray-700', label: 'Reportado' },
  acknowledged: {
    bg: 'bg-blue-100',
    text: 'text-blue-700',
    label: 'Reconocido',
  },
  investigating: {
    bg: 'bg-purple-100',
    text: 'text-purple-700',
    label: 'Investigando',
  },
  in_progress: {
    bg: 'bg-indigo-100',
    text: 'text-indigo-700',
    label: 'En Progreso',
  },
  pending_review: {
    bg: 'bg-yellow-100',
    text: 'text-yellow-700',
    label: 'Pendiente',
  },
  resolved: {
    bg: 'bg-green-100',
    text: 'text-green-700',
    label: 'Resuelto',
  },
  closed: { bg: 'bg-gray-100', text: 'text-gray-500', label: 'Cerrado' },
};

export default function IncidentsListScreen() {
  const { communityId } = useAuth();
  const router = useRouter();

  const {
    data: incidents,
    isLoading,
    error,
    refetch,
    isRefetching,
  } = useIncidentList(communityId);

  const { data: unacknowledged } = useUnacknowledgedHandovers(communityId);

  if (isLoading) {
    return (
      <View className="flex-1 bg-gray-50 items-center justify-center">
        <ActivityIndicator size="large" color="#2563eb" />
      </View>
    );
  }

  if (error) {
    return (
      <View className="flex-1 bg-gray-50 items-center justify-center px-6">
        <Text className="text-red-600 text-center mb-4">
          Error al cargar incidentes: {error.message}
        </Text>
        <Pressable
          onPress={() => refetch()}
          className="bg-blue-600 rounded-lg px-6 py-3"
        >
          <Text className="text-white font-semibold">Reintentar</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-gray-50">
      {/* Header */}
      <View className="bg-white px-4 pt-14 pb-4 shadow-sm">
        <View className="flex-row items-center justify-between">
          <View className="flex-1">
            <Text className="text-2xl font-bold text-gray-900">Incidentes</Text>
            <Text className="text-sm text-gray-500 mt-1">
              Reportes de seguridad y emergencias
            </Text>
          </View>
          {/* Handover notes button */}
          <Pressable
            onPress={() => router.push('/incidents/handover')}
            className="bg-blue-600 rounded-lg px-3 py-2 flex-row items-center"
          >
            <Text className="text-white font-semibold text-sm mr-1">
              Notas de Turno
            </Text>
            {unacknowledged && unacknowledged.length > 0 ? (
              <View className="bg-red-500 rounded-full w-5 h-5 items-center justify-center">
                <Text className="text-white text-xs font-bold">
                  {unacknowledged.length}
                </Text>
              </View>
            ) : null}
          </Pressable>
        </View>
      </View>

      {/* Incident list */}
      <FlatList
        data={incidents ?? []}
        keyExtractor={(item) => item.id}
        contentContainerClassName="p-4 pb-24"
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={refetch}
            tintColor="#2563eb"
          />
        }
        ListEmptyComponent={
          <View className="items-center justify-center py-16">
            <Text className="text-gray-400 text-lg">
              No hay incidentes registrados
            </Text>
          </View>
        }
        renderItem={({ item }) => {
          const severityColor =
            SEVERITY_COLORS[item.severity] ?? SEVERITY_COLORS.medium;
          const statusColor =
            STATUS_COLORS[item.status] ?? STATUS_COLORS.reported;

          return (
            <Pressable
              onPress={() => router.push(`/incidents/${item.id}`)}
              className="bg-white rounded-xl p-4 mb-3 shadow-sm active:bg-gray-50"
            >
              {/* Header: incident number + time */}
              <View className="flex-row items-center justify-between mb-2">
                <Text className="text-xs font-mono text-gray-500 uppercase">
                  {item.incident_number}
                </Text>
                <Text className="text-xs text-gray-400">
                  {formatRelative(item.created_at)}
                </Text>
              </View>

              {/* Title */}
              <Text className="text-base font-semibold text-gray-900 mb-1">
                {item.title}
              </Text>

              {/* Location */}
              {item.location_description ? (
                <Text className="text-sm text-gray-600 mb-2">
                  📍 {item.location_description}
                </Text>
              ) : null}

              {/* Badges: severity + status */}
              <View className="flex-row items-center gap-2">
                <View className={`${severityColor.bg} rounded-md px-2 py-0.5`}>
                  <Text className={`${severityColor.text} text-xs font-medium`}>
                    {severityColor.label}
                  </Text>
                </View>
                <View className={`${statusColor.bg} rounded-md px-2 py-0.5`}>
                  <Text className={`${statusColor.text} text-xs font-medium`}>
                    {statusColor.label}
                  </Text>
                </View>
              </View>
            </Pressable>
          );
        }}
      />

      {/* Floating action button - Create incident */}
      <Pressable
        onPress={() => router.push('/incidents/create')}
        className="absolute bottom-6 right-6 bg-blue-600 rounded-full w-14 h-14 items-center justify-center shadow-lg active:bg-blue-700"
        style={{
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.3,
          shadowRadius: 4,
          elevation: 8,
        }}
      >
        <Text className="text-white text-3xl leading-none">+</Text>
      </Pressable>
    </View>
  );
}
