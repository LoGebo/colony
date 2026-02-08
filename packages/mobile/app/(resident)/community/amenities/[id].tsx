import { useState, useCallback } from 'react';
import { View, Text, ScrollView, Image, Pressable } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useAmenityDetail } from '@/hooks/useReservations';
import { AvailabilityCalendar } from '@/components/amenities/AvailabilityCalendar';
import { TimeSlotPicker } from '@/components/amenities/TimeSlotPicker';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { SectionCard } from '@/components/ui/Card';
import { formatCurrency } from '@/lib/dates';

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

export default function AmenityDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { data: amenity, isLoading, error } = useAmenityDetail(id ?? '');

  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<{
    start: string;
    end: string;
  } | null>(null);

  const handleDateSelect = useCallback((date: string) => {
    setSelectedDate(date);
    setSelectedSlot(null); // Reset slot when date changes
  }, []);

  const handleSlotSelect = useCallback(
    (slot: { start: string; end: string }) => {
      setSelectedSlot(slot);
    },
    []
  );

  const handleReserve = useCallback(() => {
    if (!selectedDate || !selectedSlot || !id) return;

    router.push({
      pathname: '/(resident)/community/amenities/reserve',
      params: {
        amenity_id: id,
        date: selectedDate,
        start: selectedSlot.start,
        end: selectedSlot.end,
      },
    });
  }, [selectedDate, selectedSlot, id, router]);

  if (isLoading) {
    return <LoadingSpinner message="Cargando amenidad..." />;
  }

  if (error || !amenity) {
    return <EmptyState message="Amenidad no encontrada" />;
  }

  const photoUrl = (amenity.photo_urls as string[] | null)?.[0] ?? null;
  const typeLabel =
    AMENITY_TYPE_LABELS[amenity.amenity_type] ?? amenity.amenity_type;
  const hasRate =
    amenity.hourly_rate != null && (amenity.hourly_rate as number) > 0;
  const hasDeposit =
    amenity.deposit_amount != null && (amenity.deposit_amount as number) > 0;

  return (
    <View className="flex-1 bg-gray-50">
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: 100 }}
      >
        {/* Back button */}
        <View className="px-4 pt-4 pb-2">
          <Pressable
            onPress={() => router.back()}
            className="mb-2 active:opacity-70"
          >
            <Text className="text-blue-600 text-base">Volver</Text>
          </Pressable>
        </View>

        {/* Hero photo */}
        {photoUrl ? (
          <Image
            source={{ uri: photoUrl }}
            className="w-full h-52"
            resizeMode="cover"
          />
        ) : (
          <View className="w-full h-52 bg-gray-200 items-center justify-center">
            <Text className="text-5xl">{"🏢"}</Text>
          </View>
        )}

        {/* Details */}
        <View className="px-4 pt-4">
          <Text className="text-xl font-bold text-gray-900 mb-1">
            {amenity.name}
          </Text>

          <View className="flex-row items-center flex-wrap gap-2 mb-3">
            <View className="bg-blue-100 rounded-full px-2.5 py-0.5">
              <Text className="text-xs text-blue-800 font-medium">
                {typeLabel}
              </Text>
            </View>
            {amenity.location ? (
              <Text className="text-sm text-gray-500">{amenity.location}</Text>
            ) : null}
          </View>

          {amenity.description ? (
            <Text className="text-sm text-gray-600 leading-5 mb-3">
              {amenity.description}
            </Text>
          ) : null}

          {/* Info row */}
          <View className="flex-row flex-wrap gap-3 mb-4">
            {amenity.capacity ? (
              <SectionCard className="flex-1 min-w-[100px]">
                <Text className="text-xs text-gray-500">Capacidad</Text>
                <Text className="text-lg font-bold text-gray-900">
                  {amenity.capacity}
                </Text>
              </SectionCard>
            ) : null}
            {hasRate ? (
              <SectionCard className="flex-1 min-w-[100px]">
                <Text className="text-xs text-gray-500">Tarifa por hora</Text>
                <Text className="text-lg font-bold text-green-700">
                  {formatCurrency(amenity.hourly_rate as number)}
                </Text>
              </SectionCard>
            ) : null}
            {hasDeposit ? (
              <SectionCard className="flex-1 min-w-[100px]">
                <Text className="text-xs text-gray-500">Deposito</Text>
                <Text className="text-lg font-bold text-amber-700">
                  {formatCurrency(amenity.deposit_amount as number)}
                </Text>
              </SectionCard>
            ) : null}
          </View>

          {/* Free use or reservation */}
          {!amenity.requires_reservation ? (
            <View className="bg-green-50 rounded-xl p-4 mb-4">
              <Text className="text-green-800 font-medium text-sm">
                Uso libre - sin reservacion necesaria
              </Text>
              <Text className="text-green-600 text-xs mt-1">
                Esta amenidad esta disponible para todos los residentes sin
                necesidad de reservar.
              </Text>
            </View>
          ) : (
            <>
              {/* Calendar */}
              <Text className="text-base font-semibold text-gray-900 mb-2">
                Disponibilidad
              </Text>
              <AvailabilityCalendar
                amenityId={amenity.id}
                selectedDate={selectedDate}
                onDateSelect={handleDateSelect}
              />

              {/* Time slots */}
              {selectedDate ? (
                <TimeSlotPicker
                  amenityId={amenity.id}
                  date={selectedDate}
                  onSlotSelect={handleSlotSelect}
                />
              ) : (
                <View className="mt-3 py-3">
                  <Text className="text-sm text-gray-400 text-center italic">
                    Selecciona una fecha para ver horarios disponibles
                  </Text>
                </View>
              )}
            </>
          )}
        </View>
      </ScrollView>

      {/* Reserve button - fixed at bottom */}
      {amenity.requires_reservation && selectedSlot ? (
        <View className="absolute bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-4 py-4">
          <Pressable
            onPress={handleReserve}
            className="bg-blue-600 rounded-xl py-3.5 items-center active:opacity-80"
          >
            <Text className="text-white font-bold text-base">Reservar</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}
