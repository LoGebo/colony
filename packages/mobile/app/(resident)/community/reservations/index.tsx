import { useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import {
  useMyReservations,
  useCancelReservation,
  parseTstzrange,
} from '@/hooks/useReservations';
import { AmbientBackground } from '@/components/ui/AmbientBackground';
import { colors, fonts, spacing, borderRadius, shadows, typography } from '@/theme';
import { format, isBefore } from 'date-fns';
import { es } from 'date-fns/locale';

// ---------- Types ----------

type FilterTab = 'upcoming' | 'past' | 'cancelled';

type AmenityTypeKey = 'pool' | 'gym' | 'court' | 'salon' | 'bbq_area' | 'playground' | 'cinema' | 'default';

const TYPE_ICONS: Record<AmenityTypeKey, keyof typeof Ionicons.glyphMap> = {
  pool: 'water-outline',
  gym: 'fitness-outline',
  court: 'tennisball-outline',
  salon: 'people-outline',
  bbq_area: 'flame-outline',
  playground: 'happy-outline',
  cinema: 'film-outline',
  default: 'grid-outline',
};

function getTypeIcon(type: string | null | undefined): keyof typeof Ionicons.glyphMap {
  const key = (type ?? 'default') as AmenityTypeKey;
  return TYPE_ICONS[key] ?? TYPE_ICONS.default;
}

function getStatusStyle(status: string): { label: string; bg: string; color: string } {
  switch (status) {
    case 'confirmed':
      return { label: 'CONFIRMED', bg: colors.successBg, color: colors.successText };
    case 'pending':
      return { label: 'PENDING', bg: colors.warningBg, color: colors.warningText };
    case 'cancelled':
      return { label: 'CANCELLED', bg: colors.border, color: colors.textCaption };
    default:
      return { label: status.toUpperCase(), bg: colors.border, color: colors.textCaption };
  }
}

export default function MyReservationsScreen() {
  const router = useRouter();
  const { data: reservations, isLoading, refetch } = useMyReservations();
  const cancelMutation = useCancelReservation();
  const [activeTab, setActiveTab] = useState<FilterTab>('upcoming');

  const now = useMemo(() => new Date(), []);

  const filtered = useMemo(() => {
    if (!reservations) return [];

    return reservations.filter((r) => {
      try {
        const { end } = parseTstzrange(r.reserved_range as string);
        const isPast = isBefore(end, now);
        const isCancelled = r.status === 'cancelled';

        if (activeTab === 'cancelled') return isCancelled;
        if (activeTab === 'past') return isPast && !isCancelled;
        // upcoming: not cancelled and not past
        return !isPast && !isCancelled;
      } catch {
        return false;
      }
    });
  }, [reservations, activeTab, now]);

  const handleCancel = useCallback(
    (reservationId: string, amenityName: string) => {
      Alert.alert(
        'Cancel Reservation',
        `Are you sure you want to cancel your reservation at ${amenityName}?`,
        [
          { text: 'No', style: 'cancel' },
          {
            text: 'Yes, Cancel',
            style: 'destructive',
            onPress: () => {
              Alert.prompt
                ? Alert.prompt(
                    'Cancellation Reason',
                    'Optionally provide a reason:',
                    (reason) => {
                      cancelMutation.mutate({ reservationId, reason: reason || undefined });
                    }
                  )
                : cancelMutation.mutate({ reservationId });
            },
          },
        ]
      );
    },
    [cancelMutation]
  );

  const handleReservationPress = useCallback(
    (id: string) => {
      router.push(`/(resident)/community/reservations/${id}`);
    },
    [router]
  );

  return (
    <View style={styles.container}>
      <AmbientBackground />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={20} color={colors.textBody} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>My Reservations</Text>
      </View>

      {/* Filter Tabs */}
      <View style={styles.filterContainer}>
        <View style={styles.filterRow}>
          {(['upcoming', 'past', 'cancelled'] as FilterTab[]).map((tab) => (
            <TouchableOpacity
              key={tab}
              style={[styles.filterTab, activeTab === tab && styles.filterTabActive]}
              onPress={() => setActiveTab(tab)}
            >
              <Text style={[styles.filterTabText, activeTab === tab && styles.filterTabTextActive]}>
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

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
            <Ionicons name="calendar-outline" size={48} color={colors.textDisabled} />
            <Text style={styles.emptyTitle}>No {activeTab} reservations</Text>
            <Text style={styles.emptySubtitle}>
              {activeTab === 'upcoming'
                ? 'Book an amenity to see your upcoming reservations.'
                : `You don't have any ${activeTab} reservations.`}
            </Text>
          </View>
        ) : (
          <View style={styles.cardList}>
            {filtered.map((reservation) => {
              const amenityData = reservation.amenities as {
                name: string;
                amenity_type: string | null;
                location: string | null;
                photo_urls: string[] | null;
              } | null;

              let startDate: Date;
              let endDate: Date;
              try {
                const range = parseTstzrange(reservation.reserved_range as string);
                startDate = range.start;
                endDate = range.end;
              } catch {
                return null;
              }

              const isPast = isBefore(endDate, now);
              const statusStyle = getStatusStyle(reservation.status as string);
              const typeIcon = getTypeIcon(amenityData?.amenity_type);
              const canCancel =
                !isPast &&
                (reservation.status === 'confirmed' || reservation.status === 'pending');

              return (
                <TouchableOpacity
                  key={reservation.id}
                  style={styles.card}
                  onPress={() => handleReservationPress(reservation.id)}
                  activeOpacity={0.85}
                >
                  {/* Card header */}
                  <View style={styles.cardHeader}>
                    <View style={styles.cardHeaderLeft}>
                      <View style={styles.cardIcon}>
                        <Ionicons name={typeIcon as any} size={22} color={colors.primary} />
                      </View>
                      <View style={styles.cardHeaderText}>
                        <Text style={styles.cardName} numberOfLines={1}>
                          {amenityData?.name ?? 'Amenity'}
                        </Text>
                        <Text style={styles.cardType}>
                          {amenityData?.amenity_type
                            ? amenityData.amenity_type.charAt(0).toUpperCase() +
                              amenityData.amenity_type.slice(1).replace('_', ' ')
                            : ''}
                        </Text>
                      </View>
                    </View>
                    <View style={[styles.statusBadge, { backgroundColor: statusStyle.bg }]}>
                      <Text style={[styles.statusBadgeText, { color: statusStyle.color }]}>
                        {statusStyle.label}
                      </Text>
                    </View>
                  </View>

                  {/* Date/Time info */}
                  <View style={styles.cardInfoRow}>
                    <View style={styles.cardInfoItem}>
                      <Ionicons name="calendar-outline" size={14} color={colors.textCaption} />
                      <Text style={styles.cardInfoText}>
                        {format(startDate, 'EEE, dd MMM yyyy', { locale: es })}
                      </Text>
                    </View>
                    <View style={styles.cardInfoItem}>
                      <Ionicons name="time-outline" size={14} color={colors.textCaption} />
                      <Text style={styles.cardInfoText}>
                        {format(startDate, 'HH:mm')} - {format(endDate, 'HH:mm')}
                      </Text>
                    </View>
                  </View>

                  {/* Location */}
                  {amenityData?.location && (
                    <View style={styles.locationRow}>
                      <Ionicons name="location-outline" size={14} color={colors.textCaption} />
                      <Text style={styles.locationText} numberOfLines={1}>
                        {amenityData.location}
                      </Text>
                    </View>
                  )}

                  {/* Cancel action for upcoming */}
                  {canCancel && (
                    <View style={styles.cardActions}>
                      <TouchableOpacity
                        style={styles.viewButton}
                        onPress={() => handleReservationPress(reservation.id)}
                      >
                        <Ionicons name="eye-outline" size={16} color={colors.textOnDark} />
                        <Text style={styles.viewButtonText}>View Details</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.cancelButton}
                        onPress={() =>
                          handleCancel(reservation.id, amenityData?.name ?? 'this amenity')
                        }
                      >
                        <Ionicons name="close-outline" size={20} color={colors.danger} />
                      </TouchableOpacity>
                    </View>
                  )}
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
    alignItems: 'center',
    paddingTop: spacing.safeAreaTop,
    paddingHorizontal: spacing.pagePaddingX,
    paddingBottom: spacing.xl,
    gap: spacing.lg,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.full,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.sm,
  },
  headerTitle: {
    ...typography.title1,
    color: colors.textPrimary,
  },

  // Filter tabs
  filterContainer: {
    paddingHorizontal: spacing.pagePaddingX,
    marginBottom: spacing['3xl'],
  },
  filterRow: {
    flexDirection: 'row',
    backgroundColor: 'rgba(226,232,240,0.5)',
    borderRadius: borderRadius.lg,
    padding: 4,
  },
  filterTab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: borderRadius.md,
  },
  filterTabActive: {
    backgroundColor: colors.surface,
    ...shadows.sm,
  },
  filterTabText: {
    fontFamily: fonts.bold,
    fontSize: 14,
    color: colors.textMuted,
  },
  filterTabTextActive: {
    color: colors.textPrimary,
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

  // Card list
  cardList: {
    gap: spacing.xl,
  },

  // Card
  card: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius['2xl'],
    padding: spacing.cardPadding,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.xl,
    ...shadows.sm,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  cardHeaderLeft: {
    flexDirection: 'row',
    gap: spacing.xl,
    flex: 1,
  },
  cardIcon: {
    width: 48,
    height: 48,
    borderRadius: borderRadius.lg,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardHeaderText: {
    flex: 1,
  },
  cardName: {
    fontFamily: fonts.bold,
    fontSize: 16,
    color: colors.textPrimary,
  },
  cardType: {
    fontFamily: fonts.medium,
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: borderRadius.sm,
  },
  statusBadgeText: {
    fontFamily: fonts.bold,
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  // Info row
  cardInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing['3xl'],
    paddingVertical: spacing.md,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: colors.border,
  },
  cardInfoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  cardInfoText: {
    fontFamily: fonts.bold,
    fontSize: 12,
    color: colors.textSecondary,
  },

  // Location
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

  // Actions
  cardActions: {
    flexDirection: 'row',
    gap: spacing.lg,
  },
  viewButton: {
    flex: 1,
    height: spacing.smallButtonHeight,
    backgroundColor: colors.dark,
    borderRadius: borderRadius.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
  },
  viewButtonText: {
    fontFamily: fonts.bold,
    fontSize: 14,
    color: colors.textOnDark,
  },
  cancelButton: {
    width: spacing.smallButtonHeight,
    height: spacing.smallButtonHeight,
    backgroundColor: colors.border,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
