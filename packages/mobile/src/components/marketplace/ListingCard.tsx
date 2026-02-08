import { View, Text, Pressable, Image } from 'react-native';
import { useRouter } from 'expo-router';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import { useAuth } from '@/hooks/useAuth';

const CATEGORY_LABELS: Record<string, { label: string; bg: string; text: string }> = {
  sale: { label: 'Venta', bg: 'bg-blue-100', text: 'text-blue-800' },
  service: { label: 'Servicio', bg: 'bg-purple-100', text: 'text-purple-800' },
  rental: { label: 'Renta', bg: 'bg-teal-100', text: 'text-teal-800' },
  wanted: { label: 'Buscado', bg: 'bg-orange-100', text: 'text-orange-800' },
};

const STATUS_STYLES: Record<string, { label: string; bg: string; text: string }> = {
  pending: { label: 'En revision', bg: 'bg-yellow-100', text: 'text-yellow-800' },
  approved: { label: 'Aprobado', bg: 'bg-green-100', text: 'text-green-800' },
  rejected: { label: 'Rechazado', bg: 'bg-red-100', text: 'text-red-800' },
  in_review: { label: 'En revision', bg: 'bg-yellow-100', text: 'text-yellow-800' },
  flagged: { label: 'Marcado', bg: 'bg-red-100', text: 'text-red-800' },
};

interface Seller {
  id: string;
  first_name: string;
  paternal_surname: string;
  photo_url: string | null;
  phone: string | null;
}

interface ListingData {
  id: string;
  category: string;
  title: string;
  description: string;
  price: number | null;
  price_negotiable: boolean;
  image_urls: string[] | null;
  moderation_status: string;
  is_sold: boolean;
  created_at: string;
  seller_id: string;
  residents: Seller | Seller[] | null;
}

interface ListingCardProps {
  listing: ListingData;
  showStatus?: boolean;
}

export function ListingCard({ listing, showStatus }: ListingCardProps) {
  const router = useRouter();
  const { residentId } = useAuth();

  const seller = Array.isArray(listing.residents)
    ? listing.residents[0]
    : listing.residents;

  const category = CATEGORY_LABELS[listing.category] ?? {
    label: listing.category,
    bg: 'bg-gray-100',
    text: 'text-gray-700',
  };

  const isMine = listing.seller_id === residentId;
  const shouldShowStatus = showStatus || isMine;

  const timeAgo = formatDistanceToNow(new Date(listing.created_at), {
    addSuffix: true,
    locale: es,
  });

  const formatPrice = (price: number | null) => {
    if (price === null || price === 0) return 'Gratis';
    return `$${price.toLocaleString('es-MX', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
  };

  const handlePress = () => {
    router.push(`/(resident)/more/marketplace/${listing.id}`);
  };

  const firstImage = listing.image_urls?.[0] ?? null;

  return (
    <Pressable
      onPress={handlePress}
      className="bg-white rounded-xl overflow-hidden shadow-sm active:opacity-90 flex-1"
    >
      {/* Image */}
      {firstImage ? (
        <Image
          source={{ uri: firstImage }}
          className="w-full h-32 bg-gray-200"
          resizeMode="cover"
        />
      ) : (
        <View className="w-full h-32 bg-gray-100 items-center justify-center">
          <Text className="text-3xl">{'🏷️'}</Text>
        </View>
      )}

      {/* Sold overlay */}
      {listing.is_sold ? (
        <View className="absolute top-0 left-0 right-0 h-32 bg-black/50 items-center justify-center">
          <Text className="text-white font-bold text-lg">VENDIDO</Text>
        </View>
      ) : null}

      {/* Content */}
      <View className="p-2.5">
        {/* Category badge */}
        <View className="flex-row items-center gap-1.5 mb-1">
          <View className={`${category.bg} rounded-full px-2 py-0.5`}>
            <Text className={`${category.text} text-xs font-medium`}>{category.label}</Text>
          </View>
          {listing.price_negotiable ? (
            <View className="bg-gray-100 rounded-full px-1.5 py-0.5">
              <Text className="text-gray-600 text-xs">Negociable</Text>
            </View>
          ) : null}
        </View>

        {/* Title */}
        <Text className="text-sm font-semibold text-gray-900 mb-0.5" numberOfLines={2}>
          {listing.title}
        </Text>

        {/* Price */}
        <Text className="text-base font-bold text-blue-600 mb-1">
          {formatPrice(listing.price)}
        </Text>

        {/* Seller + time */}
        <View className="flex-row items-center justify-between">
          <Text className="text-xs text-gray-500" numberOfLines={1}>
            {seller ? `${seller.first_name} ${seller.paternal_surname}` : 'Vendedor'}
          </Text>
          <Text className="text-xs text-gray-400">{timeAgo}</Text>
        </View>

        {/* Moderation status badge (for seller's own listings) */}
        {shouldShowStatus && listing.moderation_status !== 'approved' ? (
          <View className="mt-1.5">
            <View
              className={`${
                (STATUS_STYLES[listing.moderation_status] ?? STATUS_STYLES.pending).bg
              } rounded-full px-2 py-0.5 self-start`}
            >
              <Text
                className={`${
                  (STATUS_STYLES[listing.moderation_status] ?? STATUS_STYLES.pending).text
                } text-xs font-medium`}
              >
                {(STATUS_STYLES[listing.moderation_status] ?? STATUS_STYLES.pending).label}
              </Text>
            </View>
          </View>
        ) : null}
      </View>
    </Pressable>
  );
}
