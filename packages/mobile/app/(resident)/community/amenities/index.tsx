import { View, Text, FlatList, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { useAmenities } from '@/hooks/useReservations';
import { AmenityCard } from '@/components/amenities/AmenityCard';
import { EmptyState } from '@/components/ui/EmptyState';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';

export default function AmenityCatalogScreen() {
  const router = useRouter();
  const { data: amenities, isLoading, isRefetching, refetch } = useAmenities();

  if (isLoading) {
    return <LoadingSpinner message="Cargando amenidades..." />;
  }

  return (
    <View className="flex-1 bg-gray-50">
      {/* Header */}
      <View className="px-4 pt-4 pb-2">
        <View className="flex-row items-center justify-between mb-3">
          <Pressable onPress={() => router.back()} className="active:opacity-70">
            <Text className="text-blue-600 text-base">Volver</Text>
          </Pressable>
          <Pressable
            onPress={() => router.push('/(resident)/community/reservations')}
            className="active:opacity-70"
          >
            <Text className="text-blue-600 text-sm underline">Mis Reservaciones</Text>
          </Pressable>
        </View>
        <Text className="text-xl font-bold text-gray-900 mb-2">Amenidades</Text>
      </View>

      {/* Grid */}
      <FlatList
        data={amenities ?? []}
        keyExtractor={(item) => item.id}
        numColumns={2}
        columnWrapperStyle={{ gap: 12 }}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24, gap: 0 }}
        renderItem={({ item }) => (
          <View style={{ flex: 1 }}>
            <AmenityCard amenity={item} />
          </View>
        )}
        refreshing={isRefetching}
        onRefresh={refetch}
        ListEmptyComponent={
          <EmptyState message="No hay amenidades disponibles" icon={"🏊"} />
        }
      />
    </View>
  );
}
