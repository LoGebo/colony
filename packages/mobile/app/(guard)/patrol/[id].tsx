import { useCallback, useMemo } from 'react';
import {
  View,
  Text,
  FlatList,
  Pressable,
  ActivityIndicator,
  Alert,
  RefreshControl,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useAuth } from '@/hooks/useAuth';
import {
  usePatrolLogDetail,
  usePatrolCheckpoints,
  useAbandonPatrol,
} from '@/hooks/usePatrol';
import { PatrolProgress } from '@/components/guard/PatrolProgress';
import { CheckpointCard } from '@/components/guard/CheckpointCard';
import { formatRelative } from '@/lib/dates';

export default function ActivePatrolScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { communityId } = useAuth();
  const router = useRouter();

  const {
    data: patrolDetail,
    isLoading: detailLoading,
    refetch,
    isRefetching,
  } = usePatrolLogDetail(id);

  const { data: allCheckpoints } = usePatrolCheckpoints(communityId);
  const abandonPatrol = useAbandonPatrol();

  const log = patrolDetail?.log;
  const checkpointLogs = patrolDetail?.checkpoint_logs ?? [];

  // Build ordered checkpoint list matching route sequence
  // We need the route's checkpoint_sequence to order them. Since we fetch it
  // indirectly via the log's route_id, we use the checkpoint_logs' sequence_order
  // and fill in unscanned checkpoints from allCheckpoints.
  const scannedCheckpointIds = useMemo(
    () => new Set(checkpointLogs.map((cl) => cl.checkpoint_id)),
    [checkpointLogs]
  );

  const checkpointsMap = useMemo(() => {
    const map = new Map<
      string,
      {
        id: string;
        name: string;
        description: string | null;
        nfc_serial: string | null;
        location_description: string | null;
      }
    >();
    for (const cp of allCheckpoints ?? []) {
      map.set(cp.id, cp);
    }
    return map;
  }, [allCheckpoints]);

  // Build the display list: all checkpoints from checkpoint_logs + unscanned ones
  const displayCheckpoints = useMemo(() => {
    if (!allCheckpoints) return [];

    // Create entries for scanned checkpoints from checkpoint_logs
    const scannedEntries = checkpointLogs.map((cl) => {
      const cp = checkpointsMap.get(cl.checkpoint_id);
      return {
        checkpointId: cl.checkpoint_id,
        name: cp?.name ?? 'Punto desconocido',
        description: cp?.description ?? cp?.location_description ?? undefined,
        scanned: true,
        scannedAt: cl.scanned_at,
        gpsWithinTolerance: cl.gps_within_tolerance,
        sequenceOrder: cl.sequence_order,
      };
    });

    // Add unscanned checkpoints (ones in allCheckpoints for this community not yet scanned)
    // Since we don't have the route's checkpoint_sequence here directly,
    // we show scanned first (ordered by scan time) then unscanned from community checkpoints
    const unscannedEntries = allCheckpoints
      .filter((cp) => !scannedCheckpointIds.has(cp.id))
      .map((cp, idx) => ({
        checkpointId: cp.id,
        name: cp.name,
        description: cp.description ?? cp.location_description ?? undefined,
        scanned: false,
        scannedAt: undefined,
        gpsWithinTolerance: undefined as boolean | null | undefined,
        sequenceOrder: scannedEntries.length + idx,
      }));

    return [...scannedEntries, ...unscannedEntries];
  }, [allCheckpoints, checkpointLogs, checkpointsMap, scannedCheckpointIds]);

  // Find the next unscanned checkpoint
  const nextUnscanned = useMemo(
    () => displayCheckpoints.find((cp) => !cp.scanned),
    [displayCheckpoints]
  );

  const handleScan = useCallback(() => {
    if (!id || !nextUnscanned) return;

    router.push({
      pathname: '/patrol/scan',
      params: {
        patrolLogId: id,
        expectedCheckpointId: nextUnscanned.checkpointId,
        sequenceOrder: String(nextUnscanned.sequenceOrder),
      },
    });
  }, [id, nextUnscanned, router]);

  const handleAbandon = useCallback(() => {
    if (!id) return;

    Alert.alert(
      'Abandonar Ronda',
      'Esta seguro que desea abandonar esta ronda? Esta accion no se puede deshacer.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Abandonar',
          style: 'destructive',
          onPress: async () => {
            try {
              await abandonPatrol.mutateAsync(id);
              router.back();
            } catch {
              // Error surfaced via mutation state
            }
          },
        },
      ]
    );
  }, [id, abandonPatrol, router]);

  if (detailLoading) {
    return (
      <View className="flex-1 bg-gray-50 items-center justify-center">
        <ActivityIndicator size="large" color="#2563eb" />
      </View>
    );
  }

  if (!log) {
    return (
      <View className="flex-1 bg-gray-50 items-center justify-center px-6">
        <Text className="text-gray-500 text-center">
          Registro de ronda no encontrado
        </Text>
        <Pressable
          onPress={() => router.back()}
          className="mt-4 bg-blue-600 rounded-lg px-6 py-3"
        >
          <Text className="text-white font-semibold">Volver</Text>
        </Pressable>
      </View>
    );
  }

  const isCompleted = log.status === 'completed';
  const isAbandoned = log.status === 'abandoned';
  const isActive = log.status === 'in_progress';

  return (
    <View className="flex-1 bg-gray-50">
      {/* Header */}
      <View className="bg-white px-4 pt-14 pb-4 shadow-sm">
        <View className="flex-row items-center justify-between">
          <View>
            <Text className="text-2xl font-bold text-gray-900">
              Ronda Activa
            </Text>
            <Text className="text-sm text-gray-500 mt-0.5">
              Iniciada {formatRelative(log.started_at)}
            </Text>
          </View>
          <Pressable
            onPress={() => router.back()}
            className="bg-gray-100 rounded-lg px-3 py-2"
          >
            <Text className="text-gray-700 font-medium">Volver</Text>
          </Pressable>
        </View>

        {/* Progress bar */}
        <View className="mt-4">
          <PatrolProgress
            checkpointsVisited={log.checkpoints_visited ?? 0}
            checkpointsTotal={log.checkpoints_total ?? 0}
            status={log.status ?? 'in_progress'}
          />
        </View>
      </View>

      {/* Completion banner */}
      {isCompleted && log.completed_at ? (
        <View className="bg-green-50 border-l-4 border-green-600 mx-4 mt-4 p-4 rounded-r-lg">
          <Text className="text-green-800 font-semibold">
            Ronda completada
          </Text>
          <Text className="text-green-600 text-sm mt-1">
            Finalizada {formatRelative(log.completed_at)}
          </Text>
        </View>
      ) : null}

      {/* Checkpoint list */}
      <FlatList
        data={displayCheckpoints}
        keyExtractor={(item) => item.checkpointId}
        contentContainerClassName="p-4"
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={refetch}
            colors={['#2563eb']}
          />
        }
        renderItem={({ item }) => (
          <CheckpointCard
            name={item.name}
            description={item.description}
            scanned={item.scanned}
            scannedAt={item.scannedAt}
            gpsWithinTolerance={item.gpsWithinTolerance}
          />
        )}
        ListFooterComponent={
          <View className="pb-6">
            {/* Scan next button */}
            {isActive && nextUnscanned ? (
              <Pressable
                onPress={handleScan}
                className="bg-blue-600 rounded-xl py-4 items-center mt-2 active:bg-blue-700"
              >
                <Text className="text-white font-bold text-base">
                  Escanear Siguiente
                </Text>
              </Pressable>
            ) : null}

            {/* Abandon button */}
            {isActive ? (
              <Pressable
                onPress={handleAbandon}
                disabled={abandonPatrol.isPending}
                className="bg-red-50 border border-red-200 rounded-xl py-3 items-center mt-3 active:bg-red-100"
              >
                <Text className="text-red-700 font-semibold">
                  {abandonPatrol.isPending
                    ? 'Abandonando...'
                    : 'Abandonar Ronda'}
                </Text>
              </Pressable>
            ) : null}

            {/* Abandon error */}
            {abandonPatrol.isError ? (
              <Text className="text-red-600 text-xs mt-2 text-center">
                {abandonPatrol.error?.message ?? 'Error al abandonar ronda'}
              </Text>
            ) : null}
          </View>
        }
      />
    </View>
  );
}
