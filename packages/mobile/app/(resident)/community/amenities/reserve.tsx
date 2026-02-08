import { useState, useCallback } from 'react';
import { View, Text, TextInput, Pressable, Alert, ActivityIndicator, ScrollView } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useAmenityDetail, useCreateReservation } from '@/hooks/useReservations';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { SectionCard } from '@/components/ui/Card';
import { formatCurrency, formatDate, formatTime } from '@/lib/dates';

export default function ReserveAmenityScreen() {
  const router = useRouter();
  const { amenity_id, date, start, end } = useLocalSearchParams<{
    amenity_id: string;
    date: string;
    start: string;
    end: string;
  }>();

  const { data: amenity, isLoading: loadingAmenity } = useAmenityDetail(
    amenity_id ?? ''
  );
  const { mutate: createReservation, isPending } = useCreateReservation();

  const [notes, setNotes] = useState('');

  // Calculate hours and cost
  const startDate = start ? new Date(start) : null;
  const endDate = end ? new Date(end) : null;
  const hours =
    startDate && endDate
      ? Math.round(
          (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60)
        )
      : 0;
  const hourlyRate =
    amenity?.hourly_rate != null ? (amenity.hourly_rate as number) : 0;
  const estimatedCost = hours * hourlyRate;
  const hasDeposit =
    amenity?.deposit_amount != null && (amenity.deposit_amount as number) > 0;

  const handleConfirm = useCallback(() => {
    if (!amenity_id || !start || !end) return;

    createReservation(
      {
        amenity_id,
        start_time: new Date(start).toISOString(),
        end_time: new Date(end).toISOString(),
        notes: notes.trim() || undefined,
      },
      {
        onSuccess: () => {
          Alert.alert(
            'Reservacion confirmada',
            'Tu reservacion ha sido creada exitosamente.',
            [
              {
                text: 'Aceptar',
                onPress: () => router.back(),
              },
            ]
          );
        },
        onError: (error) => {
          const message =
            error instanceof Error
              ? error.message
              : 'Error al crear la reservacion';
          Alert.alert('Error', message);
        },
      }
    );
  }, [amenity_id, start, end, notes, createReservation, router]);

  if (loadingAmenity) {
    return <LoadingSpinner message="Cargando detalles..." />;
  }

  if (!amenity || !date || !start || !end) {
    return (
      <View className="flex-1 bg-gray-50 items-center justify-center px-4">
        <Text className="text-gray-400 text-center">
          Informacion de reservacion incompleta
        </Text>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-gray-50">
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: 32 }}
      >
        {/* Header */}
        <View className="px-4 pt-4 pb-2">
          <Pressable
            onPress={() => router.back()}
            className="mb-3 active:opacity-70"
          >
            <Text className="text-blue-600 text-base">Volver</Text>
          </Pressable>
          <Text className="text-xl font-bold text-gray-900">
            Confirmar Reservacion
          </Text>
        </View>

        {/* Summary */}
        <View className="px-4 mt-2">
          <SectionCard className="mb-3">
            <Text className="text-sm font-semibold text-gray-900 mb-3">
              Resumen
            </Text>

            <View className="mb-2">
              <Text className="text-xs text-gray-500">Amenidad</Text>
              <Text className="text-sm font-medium text-gray-900">
                {amenity.name}
              </Text>
            </View>

            <View className="mb-2">
              <Text className="text-xs text-gray-500">Fecha</Text>
              <Text className="text-sm font-medium text-gray-900">
                {formatDate(date)}
              </Text>
            </View>

            <View className="mb-2">
              <Text className="text-xs text-gray-500">Horario</Text>
              <Text className="text-sm font-medium text-gray-900">
                {formatTime(start)} - {formatTime(end)} ({hours}h)
              </Text>
            </View>

            {hourlyRate > 0 ? (
              <View className="mb-2 pt-2 border-t border-gray-100">
                <Text className="text-xs text-gray-500">Costo estimado</Text>
                <Text className="text-lg font-bold text-green-700">
                  {formatCurrency(estimatedCost)}
                </Text>
                <Text className="text-xs text-gray-400">
                  {hours} hora{hours !== 1 ? 's' : ''} x{' '}
                  {formatCurrency(hourlyRate)}/hr
                </Text>
              </View>
            ) : null}
          </SectionCard>

          {/* Deposit notice */}
          {hasDeposit ? (
            <View className="bg-amber-50 rounded-xl p-4 mb-3">
              <Text className="text-amber-800 font-medium text-sm mb-1">
                Deposito requerido
              </Text>
              <Text className="text-amber-700 text-xs">
                Esta amenidad requiere un deposito de{' '}
                {formatCurrency(amenity.deposit_amount as number)} que sera
                devuelto al finalizar el uso.
              </Text>
            </View>
          ) : null}

          {/* Notes */}
          <SectionCard className="mb-4">
            <Text className="text-sm font-semibold text-gray-900 mb-2">
              Notas (opcional)
            </Text>
            <TextInput
              className="border border-gray-300 rounded-lg px-3 py-2.5 bg-gray-50 text-sm text-gray-900"
              placeholder="Notas adicionales para tu reservacion..."
              value={notes}
              onChangeText={setNotes}
              multiline
              numberOfLines={3}
              maxLength={500}
              textAlignVertical="top"
            />
          </SectionCard>

          {/* Confirm button */}
          <Pressable
            onPress={handleConfirm}
            disabled={isPending}
            className={`rounded-xl py-3.5 items-center ${
              isPending ? 'bg-gray-300' : 'bg-blue-600 active:opacity-80'
            }`}
          >
            {isPending ? (
              <ActivityIndicator size="small" color="#ffffff" />
            ) : (
              <Text className="text-white font-bold text-base">
                Confirmar Reservacion
              </Text>
            )}
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}
