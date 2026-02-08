import { View, Text, Image, Pressable } from 'react-native';
import { useRouter } from 'expo-router';

const AMENITY_TYPE_LABELS: Record<string, string> = {
  pool: 'Alberca',
  gym: 'Gimnasio',
  event_hall: 'Salon de eventos',
  bbq_area: 'Area de asador',
  playground: 'Juegos infantiles',
  sports_court: 'Cancha deportiva',
  meeting_room: 'Sala de juntas',
  garden: 'Jardin',
  rooftop: 'Terraza',
  parking: 'Estacionamiento',
  other: 'Otro',
};

interface AmenityCardProps {
  amenity: {
    id: string;
    name: string;
    amenity_type: string;
    location: string | null;
    capacity: number | null;
    photo_urls: string[] | null;
    hourly_rate: number | null;
  };
}

export function AmenityCard({ amenity }: AmenityCardProps) {
  const router = useRouter();
  const photoUrl = amenity.photo_urls?.[0] ?? null;
  const typeLabel = AMENITY_TYPE_LABELS[amenity.amenity_type] ?? amenity.amenity_type;

  return (
    <Pressable
      onPress={() =>
        router.push(`/(resident)/community/amenities/${amenity.id}`)
      }
      className="bg-white rounded-xl overflow-hidden shadow-sm mb-3 active:opacity-80"
    >
      {/* Photo */}
      {photoUrl ? (
        <Image
          source={{ uri: photoUrl }}
          className="w-full h-28"
          resizeMode="cover"
        />
      ) : (
        <View className="w-full h-28 bg-gray-200 items-center justify-center">
          <Text className="text-3xl">{"🏢"}</Text>
        </View>
      )}

      {/* Info */}
      <View className="p-3">
        <Text className="text-sm font-semibold text-gray-900 mb-1" numberOfLines={1}>
          {amenity.name}
        </Text>

        {/* Type badge */}
        <View className="bg-blue-100 rounded-full px-2 py-0.5 self-start mb-1.5">
          <Text className="text-xs text-blue-800 font-medium">{typeLabel}</Text>
        </View>

        {/* Location + Capacity */}
        <View className="flex-row items-center justify-between">
          {amenity.location ? (
            <Text className="text-xs text-gray-500 flex-1" numberOfLines={1}>
              {amenity.location}
            </Text>
          ) : null}
          {amenity.capacity ? (
            <Text className="text-xs text-gray-400 ml-2">
              Cap. {amenity.capacity}
            </Text>
          ) : null}
        </View>

        {/* Rate */}
        {amenity.hourly_rate != null && amenity.hourly_rate > 0 ? (
          <Text className="text-xs text-green-700 font-medium mt-1">
            ${amenity.hourly_rate}/hr
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}
