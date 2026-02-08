import { useCallback, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Image,
  Pressable,
  Alert,
  Dimensions,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  useListingDetail,
  useMarkAsSold,
  useDeleteListing,
  handleContactSeller,
} from '@/hooks/useMarketplace';
import { useAuth } from '@/hooks/useAuth';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const CATEGORY_LABELS: Record<string, string> = {
  sale: 'Venta',
  service: 'Servicio',
  rental: 'Renta',
  wanted: 'Buscado',
};

const STATUS_DISPLAY: Record<string, { label: string; bg: string; text: string }> = {
  pending: { label: 'En revision', bg: 'bg-yellow-100', text: 'text-yellow-800' },
  in_review: { label: 'En revision', bg: 'bg-yellow-100', text: 'text-yellow-800' },
  approved: { label: 'Aprobado', bg: 'bg-green-100', text: 'text-green-800' },
  rejected: { label: 'Rechazado', bg: 'bg-red-100', text: 'text-red-800' },
  flagged: { label: 'Marcado', bg: 'bg-red-100', text: 'text-red-800' },
};

export default function ListingDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { residentId } = useAuth();

  const { data: listing, isLoading } = useListingDetail(id!);
  const { mutate: markAsSold, isPending: markingSold } = useMarkAsSold(id!);
  const { mutate: deleteListing, isPending: deleting } = useDeleteListing();

  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  const seller = listing
    ? Array.isArray(listing.residents)
      ? listing.residents[0]
      : listing.residents
    : null;

  const isMine = listing?.seller_id === residentId;
  const images = listing?.image_urls ?? [];

  const handleScroll = useCallback(
    (event: { nativeEvent: { contentOffset: { x: number } } }) => {
      const offsetX = event.nativeEvent.contentOffset.x;
      const index = Math.round(offsetX / SCREEN_WIDTH);
      setCurrentImageIndex(index);
    },
    [],
  );

  const handleContact = useCallback(async () => {
    if (!seller?.phone || !listing) return;
    try {
      await handleContactSeller(seller.phone, listing.title, listing.id);
    } catch {
      Alert.alert('Error', 'No se pudo abrir la aplicacion de mensajeria');
    }
  }, [seller, listing]);

  const handleMarkSold = useCallback(() => {
    Alert.alert(
      'Marcar como vendido',
      'Tu publicacion se marcara como vendida y dejara de aparecer en el marketplace.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Confirmar',
          onPress: () =>
            markAsSold(undefined, {
              onSuccess: () => {
                Alert.alert('Listo', 'Tu publicacion se ha marcado como vendida');
              },
              onError: (err) => Alert.alert('Error', err.message),
            }),
        },
      ],
    );
  }, [markAsSold]);

  const handleDelete = useCallback(() => {
    Alert.alert(
      'Eliminar publicacion',
      'Esta accion no se puede deshacer. Se eliminara tu publicacion.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: () =>
            deleteListing(id!, {
              onSuccess: () => {
                Alert.alert('Listo', 'Tu publicacion ha sido eliminada', [
                  { text: 'OK', onPress: () => router.back() },
                ]);
              },
              onError: (err) => Alert.alert('Error', err.message),
            }),
        },
      ],
    );
  }, [deleteListing, id, router]);

  const formatPrice = (price: number | null) => {
    if (price === null || price === 0) return 'Gratis';
    return `$${price.toLocaleString('es-MX', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
  };

  if (isLoading) {
    return <LoadingSpinner message="Cargando publicacion..." />;
  }

  if (!listing) {
    return (
      <View className="flex-1 items-center justify-center bg-gray-50">
        <Text className="text-gray-500">Publicacion no encontrada</Text>
      </View>
    );
  }

  const statusInfo = STATUS_DISPLAY[listing.moderation_status] ?? STATUS_DISPLAY.pending;
  const createdAgo = formatDistanceToNow(new Date(listing.created_at), {
    addSuffix: true,
    locale: es,
  });

  return (
    <ScrollView className="flex-1 bg-gray-50">
      {/* Photo gallery */}
      {images.length > 0 ? (
        <View>
          <ScrollView
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onScroll={handleScroll}
            scrollEventThrottle={16}
          >
            {images.map((url, i) => (
              <Image
                key={i}
                source={{ uri: url }}
                style={{ width: SCREEN_WIDTH, height: 280 }}
                className="bg-gray-200"
                resizeMode="cover"
              />
            ))}
          </ScrollView>

          {/* Page indicator dots */}
          {images.length > 1 ? (
            <View className="flex-row items-center justify-center gap-1.5 py-2">
              {images.map((_, i) => (
                <View
                  key={i}
                  className={`w-2 h-2 rounded-full ${
                    i === currentImageIndex ? 'bg-blue-600' : 'bg-gray-300'
                  }`}
                />
              ))}
            </View>
          ) : null}
        </View>
      ) : (
        <View className="h-48 bg-gray-100 items-center justify-center">
          <Text className="text-5xl">{'🏷️'}</Text>
        </View>
      )}

      {/* Sold banner */}
      {listing.is_sold ? (
        <View className="bg-red-500 py-2 items-center">
          <Text className="text-white font-bold text-base">VENDIDO</Text>
        </View>
      ) : null}

      {/* Content */}
      <View className="px-4 pt-4 pb-8">
        {/* Category + negotiable badges */}
        <View className="flex-row items-center gap-2 mb-2">
          <View className="bg-blue-100 rounded-full px-3 py-1">
            <Text className="text-blue-800 text-xs font-medium">
              {CATEGORY_LABELS[listing.category] ?? listing.category}
            </Text>
          </View>
          {listing.price_negotiable ? (
            <View className="bg-gray-100 rounded-full px-2.5 py-1">
              <Text className="text-gray-600 text-xs">Negociable</Text>
            </View>
          ) : null}
        </View>

        {/* Title */}
        <Text className="text-xl font-bold text-gray-900 mb-1">{listing.title}</Text>

        {/* Price */}
        <Text className="text-2xl font-bold text-blue-600 mb-3">
          {formatPrice(listing.price)}
        </Text>

        {/* Moderation status (seller only) */}
        {isMine ? (
          <View className="mb-3">
            <View className={`${statusInfo.bg} rounded-full px-3 py-1 self-start`}>
              <Text className={`${statusInfo.text} text-xs font-medium`}>
                {statusInfo.label}
              </Text>
            </View>
          </View>
        ) : null}

        {/* Description */}
        <View className="bg-white rounded-xl p-4 mb-4 shadow-sm">
          <Text className="text-sm font-medium text-gray-900 mb-2">Descripcion</Text>
          <Text className="text-sm text-gray-700 leading-5">{listing.description}</Text>
        </View>

        {/* Seller section */}
        <View className="bg-white rounded-xl p-4 mb-4 shadow-sm">
          <Text className="text-sm font-medium text-gray-900 mb-3">Vendedor</Text>
          <View className="flex-row items-center gap-3">
            {seller?.photo_url ? (
              <Image
                source={{ uri: seller.photo_url }}
                className="w-10 h-10 rounded-full bg-gray-200"
              />
            ) : (
              <View className="w-10 h-10 rounded-full bg-blue-100 items-center justify-center">
                <Text className="text-blue-600 font-bold text-base">
                  {seller?.first_name?.[0] ?? '?'}
                </Text>
              </View>
            )}
            <Text className="text-sm text-gray-800 font-medium">
              {seller
                ? `${seller.first_name} ${seller.paternal_surname}`
                : 'Vendedor'}
            </Text>
          </View>
        </View>

        {/* Stats section */}
        <View className="bg-white rounded-xl p-4 mb-4 shadow-sm">
          <View className="flex-row justify-between">
            <View className="items-center flex-1">
              <Text className="text-lg font-bold text-gray-900">
                {listing.view_count ?? 0}
              </Text>
              <Text className="text-xs text-gray-500">Vistas</Text>
            </View>
            <View className="items-center flex-1">
              <Text className="text-lg font-bold text-gray-900">
                {listing.inquiry_count ?? 0}
              </Text>
              <Text className="text-xs text-gray-500">Contactos</Text>
            </View>
            <View className="items-center flex-1">
              <Text className="text-xs text-gray-500 text-center">Publicado</Text>
              <Text className="text-xs text-gray-700 text-center">{createdAgo}</Text>
            </View>
          </View>
        </View>

        {/* Contact seller button (not shown if it's your own listing) */}
        {!isMine && !listing.is_sold ? (
          <Pressable
            onPress={handleContact}
            className="bg-green-600 rounded-lg p-4 items-center flex-row justify-center gap-2 mb-4 active:opacity-80"
          >
            <Text className="text-lg">{'💬'}</Text>
            <Text className="text-white font-semibold text-base">
              Contactar por WhatsApp
            </Text>
          </Pressable>
        ) : null}

        {/* Seller actions */}
        {isMine && !listing.is_sold ? (
          <View className="gap-3">
            <Pressable
              onPress={handleMarkSold}
              disabled={markingSold}
              className={`rounded-lg p-4 items-center ${
                markingSold ? 'bg-green-400' : 'bg-green-600 active:opacity-80'
              }`}
            >
              <Text className="text-white font-semibold text-base">
                {markingSold ? 'Marcando...' : 'Marcar como vendido'}
              </Text>
            </Pressable>

            <Pressable
              onPress={handleDelete}
              disabled={deleting}
              className={`rounded-lg p-4 items-center ${
                deleting ? 'bg-red-300' : 'bg-red-100 active:opacity-80'
              }`}
            >
              <Text
                className={`font-semibold text-base ${
                  deleting ? 'text-red-400' : 'text-red-600'
                }`}
              >
                {deleting ? 'Eliminando...' : 'Eliminar publicacion'}
              </Text>
            </Pressable>
          </View>
        ) : null}
      </View>
    </ScrollView>
  );
}
