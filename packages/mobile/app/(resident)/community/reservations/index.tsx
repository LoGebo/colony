import { useState, useMemo } from 'react';
import { View, Text, FlatList, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { useMyReservations, parseTstzrange } from '@/hooks/useReservations';
import { StatusBadge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { formatDate, formatTime } from '@/lib/dates';

const RESERVATION_STATUS_VARIANTS: Record<
  string,
  { bg: string; text: string; label: string }
> = {
  confirmed: {
    bg: 'bg-green-100',
    text: 'text-green-800',
    label: 'Confirmada',
  },
  pending: {
    bg: 'bg-yellow-100',
    text: 'text-yellow-800',
    label: 'Pendiente',
  },
  cancelled: {
    bg: 'bg-red-100',
    text: 'text-red-800',
    label: 'Cancelada',
  },
  completed: {
    bg: 'bg-gray-100',
    text: 'text-gray-600',
    label: 'Completada',
  },
  no_show: {
    bg: 'bg-orange-100',
    text: 'text-orange-800',
    label: 'No asistio',
  },
};

type TabKey = 'upcoming' | 'past';

export default function MyReservationsScreen() {
  const router = useRouter();
  const {
    data: reservations,
    isLoading,
    isRefetching,
    refetch,
  } = useMyReservations();

  const [tab, setTab] = useState<TabKey>('upcoming');

  const now = new Date();

  const { upcoming, past } = useMemo(() => {
    const upcomingList: typeof reservations = [];
    const pastList: typeof reservations = [];

    (reservations ?? []).forEach((r) => {
      try {
        const { start } = parseTstzrange(r.reserved_range as string);
        const isFuture = start > now;
        const isActiveStatus = r.status === 'confirmed' || r.status === 'pending';

        if (isFuture && isActiveStatus) {
          upcomingList.push(r);
        } else {
          pastList.push(r);
        }
      } catch {
        pastList.push(r);
      }
    });

    return { upcoming: upcomingList, past: pastList };
  }, [reservations, now]);

  const displayedList = tab === 'upcoming' ? upcoming : past;

  if (isLoading) {
    return <LoadingSpinner message="Cargando reservaciones..." />;
  }

  return (
    <View className="flex-1 bg-gray-50">
      {/* Header */}
      <View className="px-4 pt-4 pb-2">
        <Pressable
          onPress={() => router.back()}
          className="mb-3 active:opacity-70"
        >
          <Text className="text-blue-600 text-base">Volver</Text>
        </Pressable>
        <Text className="text-xl font-bold text-gray-900 mb-3">
          Mis Reservaciones
        </Text>

        {/* Tab selector */}
        <View className="flex-row bg-gray-200 rounded-lg p-0.5 mb-2">
          <Pressable
            onPress={() => setTab('upcoming')}
            className={`flex-1 rounded-md py-2 items-center ${
              tab === 'upcoming' ? 'bg-white shadow-sm' : ''
            }`}
          >
            <Text
              className={`text-sm font-medium ${
                tab === 'upcoming' ? 'text-blue-600' : 'text-gray-500'
              }`}
            >
              Proximas ({upcoming.length})
            </Text>
          </Pressable>
          <Pressable
            onPress={() => setTab('past')}
            className={`flex-1 rounded-md py-2 items-center ${
              tab === 'past' ? 'bg-white shadow-sm' : ''
            }`}
          >
            <Text
              className={`text-sm font-medium ${
                tab === 'past' ? 'text-blue-600' : 'text-gray-500'
              }`}
            >
              Pasadas ({past.length})
            </Text>
          </Pressable>
        </View>
      </View>

      {/* List */}
      <FlatList
        data={displayedList ?? []}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 }}
        renderItem={({ item }) => {
          const amenity = item.amenities as {
            name: string;
            amenity_type: string;
            location: string | null;
            photo_urls: string[] | null;
          } | null;

          let dateLabel = '';
          let timeLabel = '';
          try {
            const { start, end } = parseTstzrange(
              item.reserved_range as string
            );
            dateLabel = formatDate(start.toISOString());
            timeLabel = `${formatTime(start.toISOString())} - ${formatTime(end.toISOString())}`;
          } catch {
            dateLabel = 'Fecha no disponible';
          }

          return (
            <Pressable
              onPress={() =>
                router.push(
                  `/(resident)/community/reservations/${item.id}`
                )
              }
              className="bg-white rounded-xl p-4 mb-3 shadow-sm active:opacity-80"
            >
              <View className="flex-row items-start justify-between mb-2">
                <Text
                  className="text-sm font-semibold text-gray-900 flex-1 mr-2"
                  numberOfLines={1}
                >
                  {amenity?.name ?? 'Amenidad'}
                </Text>
                <StatusBadge
                  status={item.status}
                  variants={RESERVATION_STATUS_VARIANTS}
                />
              </View>

              <Text className="text-sm text-gray-600 mb-0.5">
                {dateLabel}
              </Text>
              <Text className="text-xs text-gray-400">{timeLabel}</Text>

              {amenity?.location ? (
                <Text className="text-xs text-gray-400 mt-1">
                  {amenity.location}
                </Text>
              ) : null}
            </Pressable>
          );
        }}
        refreshing={isRefetching}
        onRefresh={refetch}
        ListEmptyComponent={
          <EmptyState
            message={
              tab === 'upcoming'
                ? 'No tienes reservaciones proximas'
                : 'No tienes reservaciones pasadas'
            }
            icon={"📅"}
          />
        }
      />
    </View>
  );
}
