import { useMemo, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { showAlert } from '@/lib/alert';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import {
  useMyReservations,
  useCancelReservation,
  parseTstzrange,
} from '@/hooks/useReservations';
import { AmbientBackground } from '@/components/ui/AmbientBackground';
import { GlassCard } from '@/components/ui/GlassCard';
import { formatDateTime } from '@/lib/dates';
import { colors, fonts, spacing, borderRadius, shadows, typography } from '@/theme';
import { format, isBefore } from 'date-fns';
import { es } from 'date-fns/locale';

// ---------- Helpers ----------

type AmenityTypeKey = 'pool' | 'gym' | 'court' | 'salon' | 'bbq' | 'rooftop' | 'room' | 'parking' | 'other' | 'default';

const TYPE_ICONS: Record<AmenityTypeKey, keyof typeof Ionicons.glyphMap> = {
  pool: 'water-outline',
  gym: 'fitness-outline',
  court: 'tennisball-outline',
  salon: 'people-outline',
  bbq: 'flame-outline',
  rooftop: 'sunny-outline',
  room: 'business-outline',
  parking: 'car-outline',
  other: 'grid-outline',
  default: 'grid-outline',
};

function getTypeIcon(type: string | null | undefined): keyof typeof Ionicons.glyphMap {
  const key = (type ?? 'default') as AmenityTypeKey;
  return TYPE_ICONS[key] ?? TYPE_ICONS.default;
}

function getStatusStyle(status: string): {
  label: string;
  bg: string;
  color: string;
  icon: keyof typeof Ionicons.glyphMap;
} {
  switch (status) {
    case 'confirmed':
      return {
        label: 'CONFIRMED',
        bg: colors.successBg,
        color: colors.successText,
        icon: 'checkmark-circle-outline',
      };
    case 'pending':
      return {
        label: 'PENDING',
        bg: colors.warningBg,
        color: colors.warningText,
        icon: 'time-outline',
      };
    case 'cancelled':
      return {
        label: 'CANCELLED',
        bg: colors.border,
        color: colors.textCaption,
        icon: 'close-circle-outline',
      };
    default:
      return {
        label: status.toUpperCase(),
        bg: colors.border,
        color: colors.textCaption,
        icon: 'ellipsis-horizontal-circle-outline',
      };
  }
}

export default function ReservationDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: allReservations, isLoading } = useMyReservations();
  const cancelMutation = useCancelReservation();

  // Find this specific reservation
  const reservation = useMemo(() => {
    if (!allReservations || !id) return null;
    return allReservations.find((r) => r.id === id) ?? null;
  }, [allReservations, id]);

  // Parse time range
  const timeRange = useMemo(() => {
    if (!reservation?.reserved_range) return null;
    try {
      return parseTstzrange(reservation.reserved_range as string);
    } catch {
      return null;
    }
  }, [reservation?.reserved_range]);

  const isPast = useMemo(() => {
    if (!timeRange) return false;
    return isBefore(timeRange.end, new Date());
  }, [timeRange]);

  const canCancel =
    reservation &&
    !isPast &&
    (reservation.status === 'confirmed' || reservation.status === 'pending');

  const handleCancel = useCallback(() => {
    if (!reservation) return;
    const amenityData = reservation.amenities as { name: string } | null;

    showAlert(
      'Cancel Reservation',
      `Are you sure you want to cancel your reservation at ${amenityData?.name ?? 'this amenity'}?`,
      [
        { text: 'No', style: 'cancel' },
        {
          text: 'Yes, Cancel',
          style: 'destructive',
          onPress: () => {
            cancelMutation.mutate(
              { reservationId: reservation.id },
              {
                onSuccess: () => {
                  showAlert('Cancelled', 'Your reservation has been cancelled.', [
                    { text: 'OK', onPress: () => router.back() },
                  ]);
                },
                onError: (error: any) => {
                  showAlert('Error', error?.message ?? 'Could not cancel reservation.');
                },
              }
            );
          },
        },
      ]
    );
  }, [reservation, cancelMutation, router]);

  if (isLoading) {
    return (
      <View style={styles.container}>
        <AmbientBackground />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </View>
    );
  }

  if (!reservation) {
    return (
      <View style={styles.container}>
        <AmbientBackground />
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Ionicons name="chevron-back" size={20} color={colors.textBody} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Reservation</Text>
        </View>
        <View style={styles.centerMessage}>
          <Ionicons name="alert-circle-outline" size={48} color={colors.textDisabled} />
          <Text style={styles.emptyTitle}>Reservation not found</Text>
        </View>
      </View>
    );
  }

  const amenityData = reservation.amenities as {
    name: string;
    amenity_type: string | null;
    location: string | null;
    photo_urls: string[] | null;
  } | null;

  const statusStyle = getStatusStyle(reservation.status as string);
  const typeIcon = getTypeIcon(amenityData?.amenity_type);
  const duration =
    timeRange
      ? Math.round((timeRange.end.getTime() - timeRange.start.getTime()) / 3600000)
      : 0;

  return (
    <View style={styles.container}>
      <AmbientBackground />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={20} color={colors.textBody} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Reservation Details</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Status banner */}
        <View style={[styles.statusBanner, { backgroundColor: statusStyle.bg }]}>
          <Ionicons name={statusStyle.icon as any} size={20} color={statusStyle.color} />
          <Text style={[styles.statusBannerText, { color: statusStyle.color }]}>
            {statusStyle.label}
          </Text>
        </View>

        {/* Amenity card */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Amenity</Text>
          <View style={styles.amenityCard}>
            <View style={styles.amenityIcon}>
              <Ionicons name={typeIcon as any} size={28} color={colors.primary} />
            </View>
            <View style={styles.amenityInfo}>
              <Text style={styles.amenityName}>{amenityData?.name ?? 'Amenity'}</Text>
              <Text style={styles.amenityType}>
                {amenityData?.amenity_type
                  ? amenityData.amenity_type.charAt(0).toUpperCase() +
                    amenityData.amenity_type.slice(1).replace('_', ' ')
                  : ''}
              </Text>
              {amenityData?.location && (
                <View style={styles.amenityLocationRow}>
                  <Ionicons name="location-outline" size={12} color={colors.textCaption} />
                  <Text style={styles.amenityLocation}>{amenityData.location}</Text>
                </View>
              )}
            </View>
          </View>
        </View>

        {/* Time details */}
        {timeRange && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Date & Time</Text>
            <GlassCard variant="enhanced" style={styles.timeCard}>
              <View style={styles.timeRow}>
                <View style={styles.timeIconBox}>
                  <Ionicons name="calendar-outline" size={18} color={colors.primary} />
                </View>
                <View>
                  <Text style={styles.timeLabel}>Date</Text>
                  <Text style={styles.timeValue}>
                    {format(timeRange.start, 'EEEE, dd MMMM yyyy', { locale: es })}
                  </Text>
                </View>
              </View>
              <View style={styles.timeDivider} />
              <View style={styles.timeRow}>
                <View style={styles.timeIconBox}>
                  <Ionicons name="time-outline" size={18} color={colors.primary} />
                </View>
                <View>
                  <Text style={styles.timeLabel}>Time</Text>
                  <Text style={styles.timeValue}>
                    {format(timeRange.start, 'HH:mm')} - {format(timeRange.end, 'HH:mm')}
                  </Text>
                </View>
              </View>
              <View style={styles.timeDivider} />
              <View style={styles.timeRow}>
                <View style={styles.timeIconBox}>
                  <Ionicons name="hourglass-outline" size={18} color={colors.primary} />
                </View>
                <View>
                  <Text style={styles.timeLabel}>Duration</Text>
                  <Text style={styles.timeValue}>
                    {duration} hour{duration !== 1 ? 's' : ''}
                  </Text>
                </View>
              </View>
            </GlassCard>
          </View>
        )}

        {/* Notes */}
        {reservation.notes && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Notes</Text>
            <View style={styles.notesCard}>
              <Ionicons name="document-text-outline" size={16} color={colors.textCaption} />
              <Text style={styles.notesText}>{reservation.notes}</Text>
            </View>
          </View>
        )}

        {/* Cancellation info */}
        {reservation.status === 'cancelled' && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Cancellation Details</Text>
            <View style={styles.cancellationCard}>
              <Ionicons name="close-circle-outline" size={20} color={colors.danger} />
              <View style={styles.cancellationInfo}>
                {reservation.cancelled_at && (
                  <Text style={styles.cancellationDate}>
                    Cancelled on {formatDateTime(reservation.cancelled_at)}
                  </Text>
                )}
                {reservation.cancellation_reason && (
                  <Text style={styles.cancellationReason}>
                    {reservation.cancellation_reason}
                  </Text>
                )}
                {!reservation.cancellation_reason && (
                  <Text style={styles.cancellationReasonEmpty}>No reason provided</Text>
                )}
              </View>
            </View>
          </View>
        )}

        {/* Created date */}
        {reservation.created_at && (
          <View style={styles.section}>
            <View style={styles.createdRow}>
              <Ionicons name="time-outline" size={14} color={colors.textCaption} />
              <Text style={styles.createdText}>
                Created {formatDateTime(reservation.created_at)}
              </Text>
            </View>
          </View>
        )}
      </ScrollView>

      {/* Cancel button */}
      {canCancel && (
        <View style={styles.ctaContainer}>
          <TouchableOpacity
            style={styles.cancelCtaButton}
            activeOpacity={0.9}
            onPress={handleCancel}
            disabled={cancelMutation.isPending}
          >
            {cancelMutation.isPending ? (
              <ActivityIndicator size="small" color={colors.danger} />
            ) : (
              <>
                <Ionicons name="close-circle-outline" size={20} color={colors.danger} />
                <Text style={styles.cancelCtaText}>Cancel Reservation</Text>
              </>
            )}
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
    ...typography.title2,
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

  // Status banner
  statusBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    marginHorizontal: spacing.pagePaddingX,
    paddingVertical: spacing.lg,
    borderRadius: borderRadius.lg,
    marginBottom: spacing['3xl'],
  },
  statusBannerText: {
    fontFamily: fonts.bold,
    fontSize: 13,
    textTransform: 'uppercase',
    letterSpacing: 1,
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

  // Amenity card
  amenityCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius['2xl'],
    padding: spacing.cardPadding,
    borderWidth: 1,
    borderColor: colors.border,
    flexDirection: 'row',
    gap: spacing.xl,
    alignItems: 'center',
    ...shadows.sm,
  },
  amenityIcon: {
    width: 56,
    height: 56,
    borderRadius: borderRadius.lg,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  amenityInfo: {
    flex: 1,
  },
  amenityName: {
    fontFamily: fonts.bold,
    fontSize: 16,
    color: colors.textPrimary,
  },
  amenityType: {
    fontFamily: fonts.medium,
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 2,
  },
  amenityLocationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  amenityLocation: {
    fontFamily: fonts.medium,
    fontSize: 12,
    color: colors.textCaption,
  },

  // Time card
  timeCard: {
    padding: spacing.cardPadding,
    borderRadius: borderRadius['2xl'],
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xl,
    paddingVertical: spacing.lg,
  },
  timeIconBox: {
    width: 36,
    height: 36,
    borderRadius: borderRadius.md,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  timeLabel: {
    fontFamily: fonts.medium,
    fontSize: 11,
    color: colors.textCaption,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  timeValue: {
    fontFamily: fonts.bold,
    fontSize: 14,
    color: colors.textPrimary,
    marginTop: 2,
  },
  timeDivider: {
    height: 1,
    backgroundColor: colors.border,
    marginLeft: 56,
  },

  // Notes
  notesCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.xl,
    borderWidth: 1,
    borderColor: colors.border,
    flexDirection: 'row',
    gap: spacing.lg,
    ...shadows.sm,
  },
  notesText: {
    fontFamily: fonts.medium,
    fontSize: 14,
    color: colors.textBody,
    flex: 1,
    lineHeight: 22,
  },

  // Cancellation
  cancellationCard: {
    backgroundColor: colors.dangerBgLight,
    borderRadius: borderRadius.lg,
    padding: spacing.xl,
    flexDirection: 'row',
    gap: spacing.lg,
    alignItems: 'flex-start',
  },
  cancellationInfo: {
    flex: 1,
    gap: spacing.sm,
  },
  cancellationDate: {
    fontFamily: fonts.bold,
    fontSize: 12,
    color: colors.textMuted,
  },
  cancellationReason: {
    fontFamily: fonts.medium,
    fontSize: 14,
    color: colors.textBody,
    lineHeight: 20,
  },
  cancellationReasonEmpty: {
    fontFamily: fonts.medium,
    fontSize: 14,
    color: colors.textCaption,
    fontStyle: 'italic',
  },

  // Created
  createdRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  createdText: {
    fontFamily: fonts.medium,
    fontSize: 12,
    color: colors.textCaption,
  },

  // Empty state
  centerMessage: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.lg,
  },
  emptyTitle: {
    fontFamily: fonts.bold,
    fontSize: 18,
    color: colors.textSecondary,
  },

  // Cancel CTA
  ctaContainer: {
    position: 'absolute',
    bottom: spacing.bottomNavClearance,
    left: 0,
    right: 0,
    paddingHorizontal: spacing.pagePaddingX,
  },
  cancelCtaButton: {
    height: 56,
    backgroundColor: colors.dangerBg,
    borderRadius: borderRadius.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.lg,
    borderWidth: 1,
    borderColor: colors.danger,
  },
  cancelCtaText: {
    fontFamily: fonts.bold,
    fontSize: 16,
    color: colors.danger,
  },
});
