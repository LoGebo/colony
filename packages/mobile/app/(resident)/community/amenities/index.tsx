import { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useAmenities } from '@/hooks/useReservations';
import { AmbientBackground } from '@/components/ui/AmbientBackground';
import { colors, fonts, spacing, borderRadius, shadows, typography } from '@/theme';

// ---------- Type icon + gradient config ----------

type AmenityTypeKey = 'pool' | 'gym' | 'court' | 'salon' | 'bbq' | 'rooftop' | 'room' | 'parking' | 'other' | 'default';

const TYPE_CONFIG: Record<AmenityTypeKey, {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  gradientColors: [string, string];
}> = {
  pool: {
    icon: 'water-outline',
    label: 'Pool',
    gradientColors: ['#2563EB', '#38BDF8'],
  },
  gym: {
    icon: 'fitness-outline',
    label: 'Gym',
    gradientColors: ['#7C3AED', '#A78BFA'],
  },
  court: {
    icon: 'tennisball-outline',
    label: 'Court',
    gradientColors: ['#059669', '#34D399'],
  },
  salon: {
    icon: 'people-outline',
    label: 'Salon',
    gradientColors: ['#DB2777', '#F472B6'],
  },
  bbq: {
    icon: 'flame-outline',
    label: 'Grill',
    gradientColors: ['#EA580C', '#FB923C'],
  },
  rooftop: {
    icon: 'sunny-outline',
    label: 'Rooftop',
    gradientColors: ['#CA8A04', '#FACC15'],
  },
  room: {
    icon: 'business-outline',
    label: 'Room',
    gradientColors: ['#4338CA', '#818CF8'],
  },
  parking: {
    icon: 'car-outline',
    label: 'Parking',
    gradientColors: ['#64748B', '#94A3B8'],
  },
  other: {
    icon: 'grid-outline',
    label: 'Other',
    gradientColors: ['#475569', '#94A3B8'],
  },
  default: {
    icon: 'grid-outline',
    label: 'Other',
    gradientColors: ['#475569', '#94A3B8'],
  },
};

function getTypeConfig(amenityType: string | null | undefined) {
  const key = (amenityType ?? 'default') as AmenityTypeKey;
  return TYPE_CONFIG[key] ?? TYPE_CONFIG.default;
}

// ---------- Category filter types ----------

const ALL_CATEGORIES: { key: string; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { key: 'all', label: 'All', icon: 'apps-outline' },
  { key: 'pool', label: 'Pool', icon: 'water-outline' },
  { key: 'gym', label: 'Gym', icon: 'fitness-outline' },
  { key: 'court', label: 'Court', icon: 'tennisball-outline' },
  { key: 'salon', label: 'Salon', icon: 'people-outline' },
  { key: 'bbq', label: 'Grill', icon: 'flame-outline' },
  { key: 'rooftop', label: 'Rooftop', icon: 'sunny-outline' },
  { key: 'room', label: 'Room', icon: 'business-outline' },
];

export default function AmenitiesExplorerScreen() {
  const router = useRouter();
  const { data: amenities, isLoading, refetch } = useAmenities();
  const [selectedCategory, setSelectedCategory] = useState('all');

  const filtered = useMemo(() => {
    if (!amenities) return [];
    if (selectedCategory === 'all') return amenities;
    return amenities.filter((a) => a.amenity_type === selectedCategory);
  }, [amenities, selectedCategory]);

  const handleAmenityPress = useCallback(
    (id: string) => {
      router.push(`/(resident)/community/amenities/${id}`);
    },
    [router]
  );

  const handleHistoryPress = useCallback(() => {
    router.push('/(resident)/community/reservations');
  }, [router]);

  return (
    <View style={styles.container}>
      <AmbientBackground />

      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Amenities</Text>
          <Text style={styles.headerSubtitle}>Book spaces for your lifestyle</Text>
        </View>
        <TouchableOpacity style={styles.historyButton} onPress={handleHistoryPress}>
          <Ionicons name="time-outline" size={20} color={colors.textBody} />
        </TouchableOpacity>
      </View>

      {/* Category Filter */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.categoryScroll}
        style={styles.categoryContainer}
      >
        {ALL_CATEGORIES.map((cat) => {
          const isActive = selectedCategory === cat.key;
          return (
            <TouchableOpacity
              key={cat.key}
              style={styles.categoryItem}
              onPress={() => setSelectedCategory(cat.key)}
              activeOpacity={0.7}
            >
              <View
                style={[
                  styles.categoryIconBox,
                  isActive ? styles.categoryIconBoxActive : styles.categoryIconBoxInactive,
                ]}
              >
                <Ionicons
                  name={cat.icon as any}
                  size={24}
                  color={isActive ? colors.primary : colors.textCaption}
                />
              </View>
              <Text
                style={[
                  styles.categoryLabel,
                  isActive ? styles.categoryLabelActive : styles.categoryLabelInactive,
                ]}
              >
                {cat.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Content */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={false} onRefresh={refetch} tintColor={colors.primary} />
        }
      >
        {isLoading ? (
          <View style={styles.centerMessage}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        ) : filtered.length === 0 ? (
          <View style={styles.centerMessage}>
            <Ionicons name="grid-outline" size={48} color={colors.textDisabled} />
            <Text style={styles.emptyTitle}>No amenities found</Text>
            <Text style={styles.emptySubtitle}>
              {selectedCategory === 'all'
                ? 'No amenities are available in your community yet.'
                : 'No amenities match this category.'}
            </Text>
          </View>
        ) : (
          <View style={styles.cardList}>
            {filtered.map((amenity) => {
              const config = getTypeConfig(amenity.amenity_type);
              return (
                <TouchableOpacity
                  key={amenity.id}
                  style={styles.card}
                  onPress={() => handleAmenityPress(amenity.id)}
                  activeOpacity={0.85}
                >
                  {/* Photo placeholder with gradient */}
                  <View style={styles.cardImageWrapper}>
                    <LinearGradient
                      colors={config.gradientColors}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={styles.cardImageGradient}
                    >
                      <Ionicons name={config.icon as any} size={40} color="rgba(255,255,255,0.6)" />
                    </LinearGradient>
                    {/* Overlay info at bottom */}
                    <View style={styles.cardImageOverlay}>
                      <View style={styles.capacityBadge}>
                        <Ionicons name="people-outline" size={10} color={colors.textOnDark} />
                        <Text style={styles.capacityBadgeText}>
                          Capacity: {amenity.capacity ?? '--'}
                        </Text>
                      </View>
                      <Text style={styles.cardImageTitle}>{amenity.name}</Text>
                    </View>
                  </View>

                  {/* Card body */}
                  <View style={styles.cardBody}>
                    {/* Tags row */}
                    <View style={styles.cardTagsRow}>
                      {/* Type badge */}
                      <View style={styles.typeBadge}>
                        <Ionicons name={config.icon as any} size={12} color={colors.primary} />
                        <Text style={styles.typeBadgeText}>{config.label}</Text>
                      </View>

                      {/* Requires reservation */}
                      {amenity.requires_reservation && (
                        <View style={styles.reservationBadge}>
                          <Ionicons name="calendar-outline" size={10} color={colors.tealDark} />
                          <Text style={styles.reservationBadgeText}>Reservation</Text>
                        </View>
                      )}
                    </View>

                    {/* Location */}
                    {amenity.location && (
                      <View style={styles.locationRow}>
                        <Ionicons name="location-outline" size={14} color={colors.textCaption} />
                        <Text style={styles.locationText} numberOfLines={1}>
                          {amenity.location}
                        </Text>
                      </View>
                    )}

                    {/* Rate info */}
                    {amenity.hourly_rate != null && Number(amenity.hourly_rate) > 0 && (
                      <View style={styles.rateRow}>
                        <Text style={styles.rateAmount}>
                          ${Number(amenity.hourly_rate).toFixed(0)}
                        </Text>
                        <Text style={styles.rateUnit}>/hr</Text>
                      </View>
                    )}
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingTop: spacing.safeAreaTop,
    paddingHorizontal: spacing.pagePaddingX,
    paddingBottom: spacing['2xl'],
  },
  headerTitle: {
    ...typography.largeTitle,
    color: colors.textPrimary,
  },
  headerSubtitle: {
    fontFamily: fonts.medium,
    fontSize: 14,
    color: colors.textCaption,
    marginTop: 2,
  },
  historyButton: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.full,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderMedium,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.sm,
  },

  // Category filter
  categoryContainer: {
    flexGrow: 0,
    marginBottom: spacing.md,
  },
  categoryScroll: {
    paddingHorizontal: spacing.pagePaddingX,
    gap: spacing.xl,
    paddingBottom: spacing.xl,
  },
  categoryItem: {
    alignItems: 'center',
    gap: spacing.md,
  },
  categoryIconBox: {
    width: 64,
    height: 64,
    borderRadius: borderRadius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryIconBoxActive: {
    backgroundColor: colors.surface,
    borderWidth: 2,
    borderColor: colors.primary,
    ...shadows.lg,
  },
  categoryIconBoxInactive: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    opacity: 0.5,
  },
  categoryLabel: {
    fontSize: 11,
    fontFamily: fonts.bold,
  },
  categoryLabelActive: {
    color: colors.textPrimary,
  },
  categoryLabelInactive: {
    color: colors.textCaption,
  },

  // Scroll
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: spacing.pagePaddingX,
    paddingBottom: spacing.bottomNavClearance + 20,
  },

  // Empty / Loading
  centerMessage: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 80,
    gap: spacing.lg,
  },
  emptyTitle: {
    fontFamily: fonts.bold,
    fontSize: 18,
    color: colors.textSecondary,
  },
  emptySubtitle: {
    fontFamily: fonts.medium,
    fontSize: 14,
    color: colors.textMuted,
    textAlign: 'center',
  },

  // Card List
  cardList: {
    gap: spacing['2xl'],
  },

  // Card
  card: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius['3xl'],
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.md,
  },
  cardImageWrapper: {
    height: 192,
    position: 'relative',
  },
  cardImageGradient: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardImageOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: spacing.cardPadding,
    paddingBottom: spacing.xl,
  },
  capacityBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: borderRadius.sm,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    alignSelf: 'flex-start',
    marginBottom: 6,
  },
  capacityBadgeText: {
    fontFamily: fonts.bold,
    fontSize: 10,
    color: colors.textOnDark,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  cardImageTitle: {
    fontFamily: fonts.bold,
    fontSize: 20,
    color: colors.textOnDark,
  },

  // Card body
  cardBody: {
    padding: spacing.cardPadding,
    gap: spacing.lg,
  },
  cardTagsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    flexWrap: 'wrap',
  },
  typeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.primaryLight,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: borderRadius.sm,
  },
  typeBadgeText: {
    fontFamily: fonts.bold,
    fontSize: 11,
    color: colors.primary,
  },
  reservationBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.tealLight,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: borderRadius.sm,
  },
  reservationBadgeText: {
    fontFamily: fonts.bold,
    fontSize: 11,
    color: colors.tealDark,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  locationText: {
    fontFamily: fonts.medium,
    fontSize: 13,
    color: colors.textMuted,
    flex: 1,
  },
  rateRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 2,
  },
  rateAmount: {
    fontFamily: fonts.bold,
    fontSize: 20,
    color: colors.textPrimary,
  },
  rateUnit: {
    fontFamily: fonts.medium,
    fontSize: 13,
    color: colors.textCaption,
  },
});
