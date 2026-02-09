import { View, Text, FlatList, Pressable, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/hooks/useAuth';
import {
  usePatrolRoutes,
  useActivePatrolLog,
  useStartPatrol,
} from '@/hooks/usePatrol';

export default function PatrolRoutesScreen() {
  const { communityId, guardId } = useAuth();
  const router = useRouter();

  const {
    data: routes,
    isLoading: routesLoading,
    error: routesError,
    refetch,
  } = usePatrolRoutes(communityId);

  const { data: activeLog } = useActivePatrolLog(guardId);
  const startPatrol = useStartPatrol();

  const handleStartPatrol = async (routeId: string) => {
    if (!guardId || !communityId) return;

    try {
      const log = await startPatrol.mutateAsync({
        routeId,
        guardId,
        communityId,
      });
      router.push(`/patrol/${log.id}`);
    } catch {
      // Error is surfaced via mutation state
    }
  };

  if (routesLoading) {
    return (
      <View className="flex-1 bg-gray-50 items-center justify-center">
        <ActivityIndicator size="large" color="#2563eb" />
      </View>
    );
  }

  if (routesError) {
    return (
      <View className="flex-1 bg-gray-50 items-center justify-center px-6">
        <Text className="text-red-600 text-center mb-4">
          Error al cargar rutas: {routesError.message}
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
        <Text className="text-2xl font-bold text-gray-900">Rondas</Text>
        <Text className="text-sm text-gray-500 mt-1">
          Rutas de patrullaje activas
        </Text>
      </View>

      {/* Active patrol banner */}
      {activeLog ? (
        <Pressable
          onPress={() => router.push(`/patrol/${activeLog.id}`)}
          className="bg-blue-50 border-l-4 border-blue-600 mx-4 mt-4 p-4 rounded-r-lg"
        >
          <Text className="text-blue-800 font-semibold">
            Ronda en progreso
          </Text>
          <Text className="text-blue-600 text-sm mt-1">
            {activeLog.checkpoints_visited}/{activeLog.checkpoints_total} puntos
            escaneados - Toca para continuar
          </Text>
        </Pressable>
      ) : null}

      {/* Route list */}
      <FlatList
        data={routes ?? []}
        keyExtractor={(item) => item.id}
        contentContainerClassName="p-4"
        ListEmptyComponent={
          <View className="items-center justify-center py-16">
            <Text className="text-gray-400 text-lg">
              No hay rutas de ronda configuradas
            </Text>
          </View>
        }
        renderItem={({ item }) => {
          const checkpointCount = (
            item.checkpoint_sequence as string[]
          ).length;
          const hasActivePatrol = !!activeLog;

          return (
            <View className="bg-white rounded-xl p-4 mb-3 shadow-sm">
              {/* Route name and duration */}
              <View className="flex-row items-start justify-between mb-2">
                <View className="flex-1 mr-3">
                  <Text className="text-base font-semibold text-gray-900">
                    {item.name}
                  </Text>
                  {item.description ? (
                    <Text className="text-sm text-gray-500 mt-0.5">
                      {item.description}
                    </Text>
                  ) : null}
                </View>
              </View>

              {/* Metadata row */}
              <View className="flex-row items-center gap-3 mb-3">
                <View className="bg-gray-100 rounded-md px-2 py-0.5">
                  <Text className="text-xs text-gray-700 font-medium">
                    {checkpointCount} puntos
                  </Text>
                </View>
                {item.estimated_duration_minutes ? (
                  <View className="bg-gray-100 rounded-md px-2 py-0.5">
                    <Text className="text-xs text-gray-700 font-medium">
                      ~{item.estimated_duration_minutes} min
                    </Text>
                  </View>
                ) : null}
              </View>

              {/* Start button */}
              <Pressable
                onPress={() => handleStartPatrol(item.id)}
                disabled={hasActivePatrol || startPatrol.isPending}
                className={`rounded-lg py-2.5 items-center ${
                  hasActivePatrol
                    ? 'bg-gray-200'
                    : startPatrol.isPending
                      ? 'bg-blue-400'
                      : 'bg-blue-600 active:bg-blue-700'
                }`}
              >
                <Text
                  className={`font-semibold ${
                    hasActivePatrol ? 'text-gray-500' : 'text-white'
                  }`}
                >
                  {startPatrol.isPending
                    ? 'Iniciando...'
                    : hasActivePatrol
                      ? 'Finaliza la ronda activa primero'
                      : 'Iniciar Ronda'}
                </Text>
              </Pressable>

              {/* Start error */}
              {startPatrol.isError ? (
                <Text className="text-red-600 text-xs mt-2 text-center">
                  {startPatrol.error?.message ?? 'Error al iniciar ronda'}
                </Text>
              ) : null}
            </View>
          );
        }}
      />
    </View>
  );
}
