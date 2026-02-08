import { useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  Image,
  Pressable,
  TextInput,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMyReservations, useCancelReservation, parseTstzrange } from '@/hooks/useReservations';
import { StatusBadge } from '@/components/ui/Badge';
import { SectionCard } from '@/components/ui/Card';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { formatDate, formatTime, formatDateTime } from '@/lib/dates';

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

export default function ReservationDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { data: reservations, isLoading } = useMyReservations();
  const { mutate: cancelReservation, isPending: isCancelling } =
    useCancelReservation();

  const [showCancelForm, setShowCancelForm] = useState(false);
  const [cancelReason, setCancelReason] = useState('');

  // Find the specific reservation
  const reservation = (reservations ?? []).find((r) => r.id === id);

  const handleCancel = useCallback(() => {
    if (!id) return;

    Alert.alert(
      'Cancelar Reservacion',
      'Esta accion no se puede deshacer. Deseas continuar?',
      [
        { text: 'No', style: 'cancel' },
        {
          text: 'Si, cancelar',
          style: 'destructive',
          onPress: () => {
            cancelReservation(
              {
                reservationId: id,
                reason: cancelReason.trim() || undefined,
              },
              {
                onSuccess: () => {
                  Alert.alert(
                    'Reservacion cancelada',
                    'Tu reservacion ha sido cancelada.',
                    [
                      {
                        text: 'Aceptar',
                        onPress: () => router.back(),
                      },
                    ]
                  );
                },
                onError: (error) => {
                  Alert.alert(
                    'Error',
                    error instanceof Error
                      ? error.message
                      : 'Error al cancelar la reservacion'
                  );
                },
              }
            );
          },
        },
      ]
    );
  }, [id, cancelReason, cancelReservation, router]);

  if (isLoading) {
    return <LoadingSpinner message="Cargando reservacion..." />;
  }

  if (!reservation) {
    return <EmptyState message="Reservacion no encontrada" />;
  }

  const amenity = reservation.amenities as {
    name: string;
    amenity_type: string;
    location: string | null;
    photo_urls: string[] | null;
  } | null;

  let dateLabel = '';
  let timeLabel = '';
  let isFuture = false;
  try {
    const { start, end } = parseTstzrange(reservation.reserved_range as string);
    dateLabel = formatDate(start.toISOString());
    timeLabel = `${formatTime(start.toISOString())} - ${formatTime(end.toISOString())}`;
    isFuture = start > new Date();
  } catch {
    dateLabel = 'Fecha no disponible';
  }

  const canCancel =
    (reservation.status === 'confirmed' || reservation.status === 'pending') &&
    isFuture;
  const isCancelled = reservation.status === 'cancelled';
  const photoUrl = (amenity?.photo_urls as string[] | null)?.[0] ?? null;

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
            Detalle de Reservacion
          </Text>
        </View>

        {/* Photo */}
        {photoUrl ? (
          <Image
            source={{ uri: photoUrl }}
            className="w-full h-44 mx-4 rounded-xl"
            style={{ width: undefined, marginHorizontal: 16 }}
            resizeMode="cover"
          />
        ) : null}

        {/* Info */}
        <View className="px-4 mt-4">
          <SectionCard className="mb-3">
            <View className="flex-row items-start justify-between mb-3">
              <Text className="text-lg font-bold text-gray-900 flex-1 mr-2">
                {amenity?.name ?? 'Amenidad'}
              </Text>
              <StatusBadge
                status={reservation.status}
                variants={RESERVATION_STATUS_VARIANTS}
              />
            </View>

            <View className="mb-2">
              <Text className="text-xs text-gray-500">Fecha</Text>
              <Text className="text-sm font-medium text-gray-900">
                {dateLabel}
              </Text>
            </View>

            <View className="mb-2">
              <Text className="text-xs text-gray-500">Horario</Text>
              <Text className="text-sm font-medium text-gray-900">
                {timeLabel}
              </Text>
            </View>

            {amenity?.location ? (
              <View className="mb-2">
                <Text className="text-xs text-gray-500">Ubicacion</Text>
                <Text className="text-sm text-gray-900">
                  {amenity.location}
                </Text>
              </View>
            ) : null}

            {reservation.notes ? (
              <View className="mb-2 pt-2 border-t border-gray-100">
                <Text className="text-xs text-gray-500">Notas</Text>
                <Text className="text-sm text-gray-600">
                  {reservation.notes}
                </Text>
              </View>
            ) : null}

            <View className="pt-2 border-t border-gray-100">
              <Text className="text-xs text-gray-400">
                Creada: {formatDateTime(reservation.created_at)}
              </Text>
            </View>
          </SectionCard>

          {/* Cancellation info */}
          {isCancelled ? (
            <SectionCard className="mb-3 bg-red-50">
              <Text className="text-sm font-semibold text-red-800 mb-2">
                Cancelada
              </Text>
              {reservation.cancelled_at ? (
                <Text className="text-xs text-red-600 mb-1">
                  Fecha: {formatDateTime(reservation.cancelled_at)}
                </Text>
              ) : null}
              {reservation.cancellation_reason ? (
                <Text className="text-xs text-red-600">
                  Motivo: {reservation.cancellation_reason}
                </Text>
              ) : null}
            </SectionCard>
          ) : null}

          {/* Cancel form */}
          {canCancel ? (
            <View className="mt-2">
              {showCancelForm ? (
                <SectionCard>
                  <Text className="text-sm font-semibold text-gray-900 mb-2">
                    Motivo de cancelacion (opcional)
                  </Text>
                  <TextInput
                    className="border border-gray-300 rounded-lg px-3 py-2.5 bg-gray-50 text-sm text-gray-900 mb-3"
                    placeholder="Describe el motivo..."
                    value={cancelReason}
                    onChangeText={setCancelReason}
                    multiline
                    numberOfLines={2}
                    maxLength={300}
                    textAlignVertical="top"
                  />
                  <View className="flex-row gap-3">
                    <Pressable
                      onPress={() => {
                        setShowCancelForm(false);
                        setCancelReason('');
                      }}
                      className="flex-1 border border-gray-300 rounded-xl py-3 items-center active:opacity-80"
                    >
                      <Text className="text-gray-700 font-medium text-sm">
                        Volver
                      </Text>
                    </Pressable>
                    <Pressable
                      onPress={handleCancel}
                      disabled={isCancelling}
                      className={`flex-1 rounded-xl py-3 items-center ${
                        isCancelling
                          ? 'bg-gray-300'
                          : 'bg-red-600 active:opacity-80'
                      }`}
                    >
                      {isCancelling ? (
                        <ActivityIndicator size="small" color="#ffffff" />
                      ) : (
                        <Text className="text-white font-medium text-sm">
                          Confirmar
                        </Text>
                      )}
                    </Pressable>
                  </View>
                </SectionCard>
              ) : (
                <Pressable
                  onPress={() => setShowCancelForm(true)}
                  className="border border-red-300 bg-red-50 rounded-xl py-3 items-center active:opacity-80"
                >
                  <Text className="text-red-600 font-medium text-sm">
                    Cancelar Reservacion
                  </Text>
                </Pressable>
              )}
            </View>
          ) : null}
        </View>
      </ScrollView>
    </View>
  );
}
