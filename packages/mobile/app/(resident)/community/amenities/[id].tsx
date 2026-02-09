import { useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Linking,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import {
  useAmenityDetail,
  useAmenityReservations,
  parseTstzrange,
} from '@/hooks/useReservations';
import { AmbientBackground } from '@/components/ui/AmbientBackground';
import { GlassCard } from '@/components/ui/GlassCard';
import { colors, fonts, spacing, borderRadius, shadows, typography } from '@/theme';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

// ---------- Type config ----------

type AmenityTypeKey = 'pool' | 'gym' | 'court' | 'salon' | 'bbq_area' | 'playground' | 'cinema' | 'default';

const TYPE_CONFIG: Record<AmenityTypeKey, {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  gradientColors: [string, string];
}> = {
  pool: { icon: 'water-outline', label: 'Pool', gradientColors: ['#2563EB', '#38BDF8'] },
  gym: { icon: 'fitness-outline', label: 'Gym', gradientColors: ['#7C3AED', '#A78BFA'] },
  court: { icon: 'tennisball-outline', label: 'Court', gradientColors: ['#059669', '#34D399'] },
  salon: { icon: 'people-outline', label: 'Salon', gradientColors: ['#DB2777', '#F472B6'] },
  bbq_area: { icon: 'flame-outline', label: 'Grill', gradientColors: ['#EA580C', '#FB923C'] },
  playground: { icon: 'happy-outline', label: 'Playground', gradientColors: ['#CA8A04', '#FACC15'] },
  cinema: { icon: 'film-outline', label: 'Cinema', gradientColors: ['#4338CA', '#818CF8'] },
  default: { icon: 'grid-outline', label: 'Other', gradientColors: ['#475569', '#94A3B8'] },
};

function getTypeConfig(amenityType: string | null | undefined) {
  const key = (amenityType ?? 'default') as AmenityTypeKey;
  return TYPE_CONFIG[key] ?? TYPE_CONFIG.default;
}

// ---------- Day name helpers ----------
const SHORT_DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;

function getStatusColor(status: string) {
  switch (status) {
    case 'confirmed':
      return { bg: colors.successBg, text: colors.successText };
    case 'pending':
      return { bg: colors.warningBg, text: colors.warningText };
    default:
      return { bg: colors.border, text: colors.textCaption };
  }
}

export default function AmenityDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: amenity, isLoading } = useAmenityDetail(id ?? '');

  const currentMonth = useMemo(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  }, []);

  const { data: reservations } = useAmenityReservations(id ?? '', currentMonth);
  const config = getTypeConfig(amenity?.amenity_type);

  // Parse schedule JSON
  const schedule = useMemo(() => {
    if (!amenity?.schedule) return null;
    try {
      if (typeof amenity.schedule === 'string') {
        return JSON.parse(amenity.schedule) as Record<string, { open: string; close: string }>;
      }
      return amenity.schedule as Record<string, { open: string; close: string }>;
    } catch {
      return null;
    }
  }, [amenity?.schedule]);

  // Group reservations by date
  const reservationsByDate = useMemo(() => {
    if (!reservations) return {};
    const grouped: Record<string, Array<{
      id: string;
      start: Date;
      end: Date;
      status: string;
      residentName: string;
    }>> = {};

    for (const r of reservations) {
      try {
        const { start, end } = parseTstzrange(r.reserved_range as string);
        const dateKey = format(start, 'yyyy-MM-dd');
        const resident = r.residents as { first_name: string; paternal_surname: string } | null;
        const residentName = resident
          ? `${resident.first_name} ${resident.paternal_surname}`
          : 'Resident';

        if (!grouped[dateKey]) grouped[dateKey] = [];
        grouped[dateKey].push({
          id: r.id,
          start,
          end,
          status: r.status as string,
          residentName,
        });
      } catch {
        // skip invalid ranges
      }
    }

    // Sort each day's reservations by start time
    for (const key of Object.keys(grouped)) {
      grouped[key].sort((a, b) => a.start.getTime() - b.start.getTime());
    }

    return grouped;
  }, [reservations]);

  const sortedDates = useMemo(
    () => Object.keys(reservationsByDate).sort(),
    [reservationsByDate]
  );

  if (isLoading || !amenity) {
    return (
      <View style={styles.container}>
        <AmbientBackground />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <AmbientBackground />

      {/* Header with back button */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={20} color={colors.textBody} />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {amenity.name}
        </Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero image gradient */}
        <View style={styles.heroWrapper}>
          <LinearGradient
            colors={config.gradientColors}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.heroGradient}
          >
            <Ionicons name={config.icon as any} size={64} color="rgba(255,255,255,0.5)" />
          </LinearGradient>
          <View style={styles.heroOverlay}>
            <View style={styles.capacityBadge}>
              <Ionicons name="people-outline" size={10} color={colors.textOnDark} />
              <Text style={styles.capacityBadgeText}>Capacity: {amenity.capacity ?? '--'}</Text>
            </View>
            <Text style={styles.heroTitle}>{amenity.name}</Text>
          </View>
        </View>

        {/* Info cards row */}
        <View style={styles.infoRow}>
          <GlassCard style={styles.infoCard}>
            <Text style={styles.infoLabel}>Hourly Rate</Text>
            <View style={styles.infoValueRow}>
              <Text style={styles.infoValue}>
                ${amenity.hourly_rate != null ? Number(amenity.hourly_rate).toFixed(0) : '0'}
              </Text>
              <Text style={styles.infoValueUnit}>/hr</Text>
            </View>
          </GlassCard>
          <GlassCard style={styles.infoCard}>
            <Text style={styles.infoLabel}>Deposit</Text>
            <View style={styles.infoValueRow}>
              <Text style={styles.infoValue}>
                ${amenity.deposit_amount != null ? Number(amenity.deposit_amount).toFixed(0) : '0'}
              </Text>
              <Text style={styles.infoValueUnit}>ref.</Text>
            </View>
          </GlassCard>
        </View>

        {/* Details section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Details</Text>
          <View style={styles.detailCard}>
            {/* Type */}
            <View style={styles.detailRow}>
              <View style={styles.detailIconBox}>
                <Ionicons name={config.icon as any} size={16} color={colors.primary} />
              </View>
              <View style={styles.detailTextGroup}>
                <Text style={styles.detailLabel}>Type</Text>
                <Text style={styles.detailValue}>{config.label}</Text>
              </View>
            </View>

            {/* Location */}
            {amenity.location && (
              <View style={styles.detailRow}>
                <View style={styles.detailIconBox}>
                  <Ionicons name="location-outline" size={16} color={colors.primary} />
                </View>
                <View style={styles.detailTextGroup}>
                  <Text style={styles.detailLabel}>Location</Text>
                  <Text style={styles.detailValue}>{amenity.location}</Text>
                </View>
              </View>
            )}

            {/* Capacity */}
            <View style={styles.detailRow}>
              <View style={styles.detailIconBox}>
                <Ionicons name="people-outline" size={16} color={colors.primary} />
              </View>
              <View style={styles.detailTextGroup}>
                <Text style={styles.detailLabel}>Capacity</Text>
                <Text style={styles.detailValue}>{amenity.capacity ?? 'Unlimited'} people</Text>
              </View>
            </View>

            {/* Status */}
            <View style={styles.detailRow}>
              <View style={styles.detailIconBox}>
                <Ionicons name="checkmark-circle-outline" size={16} color={colors.success} />
              </View>
              <View style={styles.detailTextGroup}>
                <Text style={styles.detailLabel}>Status</Text>
                <Text style={[styles.detailValue, { color: colors.successText }]}>
                  {amenity.status === 'active' ? 'Available' : (amenity.status ?? 'Unknown')}
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* Description */}
        {amenity.description && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Description</Text>
            <View style={styles.descriptionCard}>
              <Text style={styles.descriptionText}>{amenity.description}</Text>
            </View>
          </View>
        )}

        {/* Schedule */}
        {schedule && Object.keys(schedule).length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Schedule</Text>
            <View style={styles.scheduleCard}>
              {Object.entries(schedule).map(([dayKey, times]) => {
                // dayKey could be a number (0-6) or a day name
                const dayIndex = parseInt(dayKey, 10);
                const dayName = !isNaN(dayIndex)
                  ? SHORT_DAYS[dayIndex] ?? dayKey
                  : dayKey;
                return (
                  <View key={dayKey} style={styles.scheduleRow}>
                    <Text style={styles.scheduleDay}>{dayName}</Text>
                    <Text style={styles.scheduleTime}>
                      {times.open} - {times.close}
                    </Text>
                  </View>
                );
              })}
            </View>
          </View>
        )}

        {/* Rules link */}
        {amenity.rules_document_url && (
          <View style={styles.section}>
            <TouchableOpacity
              style={styles.rulesButton}
              onPress={() => {
                if (amenity.rules_document_url) {
                  Linking.openURL(amenity.rules_document_url);
                }
              }}
            >
              <Ionicons name="document-text-outline" size={20} color={colors.primary} />
              <Text style={styles.rulesButtonText}>View Rules & Policies</Text>
              <Ionicons name="open-outline" size={16} color={colors.primary} />
            </TouchableOpacity>
          </View>
        )}

        {/* Reservations calendar */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            Reservations -{' '}
            {format(new Date(), 'MMMM yyyy', { locale: es })}
          </Text>
          {sortedDates.length === 0 ? (
            <View style={styles.emptyReservations}>
              <Ionicons name="calendar-outline" size={32} color={colors.textDisabled} />
              <Text style={styles.emptyReservationsText}>
                No reservations this month
              </Text>
            </View>
          ) : (
            <View style={styles.reservationsContainer}>
              {sortedDates.map((dateKey) => {
                const dateObj = new Date(dateKey + 'T12:00:00');
                const dayLabel = format(dateObj, 'EEE, dd MMM', { locale: es });
                const items = reservationsByDate[dateKey];

                return (
                  <View key={dateKey} style={styles.reservationDateGroup}>
                    <Text style={styles.reservationDateLabel}>{dayLabel}</Text>
                    {items.map((item) => {
                      const statusColor = getStatusColor(item.status);
                      return (
                        <View key={item.id} style={styles.reservationSlot}>
                          <View style={styles.reservationTimeCol}>
                            <Text style={styles.reservationTime}>
                              {format(item.start, 'HH:mm')}
                            </Text>
                            <Text style={styles.reservationTimeDash}>-</Text>
                            <Text style={styles.reservationTime}>
                              {format(item.end, 'HH:mm')}
                            </Text>
                          </View>
                          <View style={styles.reservationSlotBody}>
                            <Text style={styles.reservationResident} numberOfLines={1}>
                              {item.residentName}
                            </Text>
                            <View style={[styles.statusBadge, { backgroundColor: statusColor.bg }]}>
                              <Text style={[styles.statusBadgeText, { color: statusColor.text }]}>
                                {item.status.toUpperCase()}
                              </Text>
                            </View>
                          </View>
                        </View>
                      );
                    })}
                  </View>
                );
              })}
            </View>
          )}
        </View>
      </ScrollView>

      {/* Reserve CTA */}
      {amenity.requires_reservation && (
        <View style={styles.ctaContainer}>
          <TouchableOpacity
            style={styles.ctaButton}
            activeOpacity={0.9}
            onPress={() =>
              router.push({
                pathname: '/(resident)/community/amenities/reserve',
                params: { amenityId: amenity.id },
              })
            }
          >
            <Text style={styles.ctaButtonText}>
              Book for ${amenity.hourly_rate != null ? Number(amenity.hourly_rate).toFixed(2) : '0.00'}
            </Text>
            <Ionicons name="chevron-forward" size={20} color="rgba(255,255,255,0.5)" />
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
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
    flex: 1,
    ...typography.title1,
    color: colors.textPrimary,
  },
  headerSpacer: {
    width: 40,
  },

  // Scroll
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: spacing.bottomNavClearance + 80,
  },

  // Hero
  heroWrapper: {
    marginHorizontal: spacing.pagePaddingX,
    height: 192,
    borderRadius: borderRadius['3xl'],
    overflow: 'hidden',
    marginBottom: spacing.xl,
    ...shadows.xl,
  },
  heroGradient: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroOverlay: {
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
  heroTitle: {
    fontFamily: fonts.bold,
    fontSize: 20,
    color: colors.textOnDark,
  },

  // Info cards
  infoRow: {
    flexDirection: 'row',
    gap: spacing.lg,
    marginHorizontal: spacing.pagePaddingX,
    marginBottom: spacing['3xl'],
  },
  infoCard: {
    flex: 1,
    padding: spacing.xl,
    borderRadius: borderRadius.lg,
  },
  infoLabel: {
    ...typography.microLabel,
    color: colors.textCaption,
    marginBottom: spacing.xs,
  },
  infoValueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 2,
  },
  infoValue: {
    fontFamily: fonts.bold,
    fontSize: 20,
    color: colors.textPrimary,
  },
  infoValueUnit: {
    fontFamily: fonts.medium,
    fontSize: 12,
    color: colors.textCaption,
  },

  // Sections
  section: {
    marginHorizontal: spacing.pagePaddingX,
    marginBottom: spacing['3xl'],
  },
  sectionTitle: {
    fontFamily: fonts.bold,
    fontSize: 14,
    color: colors.textPrimary,
    marginBottom: spacing.xl,
  },

  // Detail card
  detailCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius['2xl'],
    padding: spacing.cardPadding,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.xl,
    ...shadows.sm,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xl,
  },
  detailIconBox: {
    width: 36,
    height: 36,
    borderRadius: borderRadius.md,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  detailTextGroup: {
    flex: 1,
  },
  detailLabel: {
    fontFamily: fonts.medium,
    fontSize: 11,
    color: colors.textCaption,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  detailValue: {
    fontFamily: fonts.bold,
    fontSize: 14,
    color: colors.textPrimary,
    marginTop: 1,
  },

  // Description
  descriptionCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius['2xl'],
    padding: spacing.cardPadding,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.sm,
  },
  descriptionText: {
    fontFamily: fonts.medium,
    fontSize: 14,
    color: colors.textBody,
    lineHeight: 22,
  },

  // Schedule
  scheduleCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius['2xl'],
    padding: spacing.cardPadding,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.lg,
    ...shadows.sm,
  },
  scheduleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  scheduleDay: {
    fontFamily: fonts.bold,
    fontSize: 13,
    color: colors.textPrimary,
  },
  scheduleTime: {
    fontFamily: fonts.medium,
    fontSize: 13,
    color: colors.textBody,
  },

  // Rules
  rulesButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
    backgroundColor: colors.primaryLight,
    padding: spacing.xl,
    borderRadius: borderRadius.lg,
  },
  rulesButtonText: {
    flex: 1,
    fontFamily: fonts.bold,
    fontSize: 14,
    color: colors.primary,
  },

  // Reservations
  emptyReservations: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing['4xl'],
    gap: spacing.lg,
  },
  emptyReservationsText: {
    fontFamily: fonts.medium,
    fontSize: 14,
    color: colors.textMuted,
  },
  reservationsContainer: {
    gap: spacing.xl,
  },
  reservationDateGroup: {
    gap: spacing.md,
  },
  reservationDateLabel: {
    fontFamily: fonts.bold,
    fontSize: 12,
    color: colors.textCaption,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: spacing.xs,
  },
  reservationSlot: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.xl,
    alignItems: 'center',
  },
  reservationTimeCol: {
    alignItems: 'center',
    width: 52,
  },
  reservationTime: {
    fontFamily: fonts.bold,
    fontSize: 13,
    color: colors.textPrimary,
  },
  reservationTimeDash: {
    fontFamily: fonts.medium,
    fontSize: 10,
    color: colors.textCaption,
  },
  reservationSlotBody: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  reservationResident: {
    fontFamily: fonts.medium,
    fontSize: 13,
    color: colors.textBody,
    flex: 1,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: borderRadius.sm,
  },
  statusBadgeText: {
    fontFamily: fonts.bold,
    fontSize: 9,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  // CTA
  ctaContainer: {
    position: 'absolute',
    bottom: spacing.bottomNavClearance,
    left: 0,
    right: 0,
    paddingHorizontal: spacing.pagePaddingX,
  },
  ctaButton: {
    height: 56,
    backgroundColor: colors.dark,
    borderRadius: borderRadius.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.lg,
    ...shadows.darkGlow,
  },
  ctaButtonText: {
    fontFamily: fonts.bold,
    fontSize: 16,
    color: colors.textOnDark,
  },
});
