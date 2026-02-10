import { useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  TextInput,
  Alert,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import {
  useAmenityDetail,
  useAmenityReservations,
  useCreateReservation,
  parseTstzrange,
} from '@/hooks/useReservations';
import { AmbientBackground } from '@/components/ui/AmbientBackground';
import { GlassCard } from '@/components/ui/GlassCard';
import { colors, fonts, spacing, borderRadius, shadows, typography } from '@/theme';
import { format, addDays, startOfDay, isSameDay, setHours } from 'date-fns';
import { es } from 'date-fns/locale';

// ---------- Constants ----------

const SHORT_DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;
const START_HOUR = 8;
const END_HOUR = 21;

function generateHourlySlots() {
  const slots: number[] = [];
  for (let h = START_HOUR; h <= END_HOUR; h++) {
    slots.push(h);
  }
  return slots;
}

const HOURLY_SLOTS = generateHourlySlots();

function formatSlotTime(hour: number): string {
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const h = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
  return `${String(h).padStart(2, '0')}:00 ${ampm}`;
}

// ---------- Generate 14-day selection ----------

function generateDays(): Date[] {
  const days: Date[] = [];
  const today = startOfDay(new Date());
  for (let i = 0; i < 14; i++) {
    days.push(addDays(today, i));
  }
  return days;
}

export default function ReserveAmenityScreen() {
  const router = useRouter();
  const { amenityId } = useLocalSearchParams<{ amenityId: string }>();
  const { data: amenity, isLoading: amenityLoading } = useAmenityDetail(amenityId ?? '');
  const createReservation = useCreateReservation();

  const [selectedDate, setSelectedDate] = useState<Date>(startOfDay(new Date()));
  const [selectedStartHour, setSelectedStartHour] = useState<number | null>(null);
  const [selectedEndHour, setSelectedEndHour] = useState<number | null>(null);
  const [notes, setNotes] = useState('');

  const days = useMemo(() => generateDays(), []);

  // Fetch reservations for the selected date's month
  const selectedMonth = useMemo(() => {
    return `${selectedDate.getFullYear()}-${String(selectedDate.getMonth() + 1).padStart(2, '0')}`;
  }, [selectedDate]);

  const { data: existingReservations } = useAmenityReservations(amenityId ?? '', selectedMonth);

  // Which hours are already taken on the selected date?
  const occupiedHours = useMemo(() => {
    if (!existingReservations) return new Set<number>();
    const occupied = new Set<number>();
    for (const r of existingReservations) {
      try {
        const { start, end } = parseTstzrange(r.reserved_range as string);
        if (!isSameDay(start, selectedDate)) continue;
        const startH = start.getHours();
        const endH = end.getHours();
        for (let h = startH; h < endH; h++) {
          occupied.add(h);
        }
      } catch {
        // skip
      }
    }
    return occupied;
  }, [existingReservations, selectedDate]);

  // Handle slot tap - select start, then end
  const handleSlotPress = useCallback(
    (hour: number) => {
      if (occupiedHours.has(hour)) return;

      if (selectedStartHour === null) {
        // First tap - set start
        setSelectedStartHour(hour);
        setSelectedEndHour(hour + 1);
      } else if (selectedEndHour !== null && hour === selectedStartHour) {
        // Tap same start - deselect
        setSelectedStartHour(null);
        setSelectedEndHour(null);
      } else if (hour >= selectedStartHour) {
        // Tap after start - set end (hour+1 since slot represents start of hour)
        setSelectedEndHour(hour + 1);
      } else {
        // Tap before start - reset
        setSelectedStartHour(hour);
        setSelectedEndHour(hour + 1);
      }
    },
    [selectedStartHour, selectedEndHour, occupiedHours]
  );

  // Is a slot selected (within the range)?
  const isSlotSelected = useCallback(
    (hour: number) => {
      if (selectedStartHour === null || selectedEndHour === null) return false;
      return hour >= selectedStartHour && hour < selectedEndHour;
    },
    [selectedStartHour, selectedEndHour]
  );

  // Duration and cost
  const duration =
    selectedStartHour !== null && selectedEndHour !== null
      ? selectedEndHour - selectedStartHour
      : 0;
  const hourlyRate = amenity?.hourly_rate != null ? Number(amenity.hourly_rate) : 0;
  const totalCost = duration * hourlyRate;

  // Count available morning slots
  const availableCount = HOURLY_SLOTS.filter((h) => !occupiedHours.has(h)).length;

  const handleSubmit = useCallback(async () => {
    if (!amenityId || selectedStartHour === null || selectedEndHour === null) return;

    const startTime = setHours(selectedDate, selectedStartHour);
    const endTime = setHours(selectedDate, selectedEndHour);

    try {
      await createReservation.mutateAsync({
        amenity_id: amenityId,
        start_time: startTime.toISOString(),
        end_time: endTime.toISOString(),
        notes: notes.trim() || undefined,
      });

      if (Platform.OS === 'web') {
        window.alert('Your reservation has been successfully created.');
        router.back();
      } else {
        Alert.alert('Reservation Created', 'Your reservation has been successfully created.', [
          { text: 'OK', onPress: () => router.back() },
        ]);
      }
    } catch (error: any) {
      const message = error?.message ?? 'Could not create reservation. Please try again.';
      if (Platform.OS === 'web') {
        window.alert(message);
      } else {
        Alert.alert('Reservation Failed', message);
      }
    }
  }, [amenityId, selectedDate, selectedStartHour, selectedEndHour, notes, createReservation, router]);

  if (amenityLoading || !amenity) {
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

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={20} color={colors.textBody} />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>
          Reserve {amenity.name}
        </Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Date picker */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Select Date</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.daysScroll}
          >
            {days.map((day) => {
              const isActive = isSameDay(day, selectedDate);
              const dayName = SHORT_DAYS[day.getDay()];
              const dayNum = day.getDate();

              return (
                <TouchableOpacity
                  key={day.toISOString()}
                  style={styles.dayItem}
                  onPress={() => {
                    setSelectedDate(day);
                    setSelectedStartHour(null);
                    setSelectedEndHour(null);
                  }}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.dayLabel, isActive && styles.dayLabelActive]}>{dayName}</Text>
                  <View style={[styles.dayCircle, isActive && styles.dayCircleActive]}>
                    <Text style={[styles.dayNumber, isActive && styles.dayNumberActive]}>
                      {dayNum}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {/* Time slots */}
        <View style={styles.section}>
          <View style={styles.sectionTitleRow}>
            <Text style={styles.sectionTitle}>Available Slots</Text>
            <View style={styles.slotCountBadge}>
              <Text style={styles.slotCountText}>{availableCount} AVAILABLE</Text>
            </View>
          </View>
          <View style={styles.slotsGrid}>
            {HOURLY_SLOTS.map((hour) => {
              const isOccupied = occupiedHours.has(hour);
              const isSelected = isSlotSelected(hour);

              return (
                <TouchableOpacity
                  key={hour}
                  style={[
                    styles.slotPill,
                    isSelected && styles.slotPillActive,
                    isOccupied && styles.slotPillDisabled,
                  ]}
                  onPress={() => handleSlotPress(hour)}
                  disabled={isOccupied}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.slotPillText,
                      isSelected && styles.slotPillTextActive,
                      isOccupied && styles.slotPillTextDisabled,
                    ]}
                  >
                    {formatSlotTime(hour)}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Notes */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Notes (optional)</Text>
          <TextInput
            style={styles.notesInput}
            placeholder="Add any special requests..."
            placeholderTextColor={colors.textCaption}
            value={notes}
            onChangeText={setNotes}
            multiline
            numberOfLines={3}
            textAlignVertical="top"
          />
        </View>

        {/* Summary card */}
        {selectedStartHour !== null && selectedEndHour !== null && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Booking Summary</Text>
            <GlassCard variant="enhanced" style={styles.summaryCard}>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Amenity</Text>
                <Text style={styles.summaryValue}>{amenity.name}</Text>
              </View>
              <View style={styles.summaryDivider} />
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Date</Text>
                <Text style={styles.summaryValue}>
                  {format(selectedDate, 'EEE, dd MMM yyyy', { locale: es })}
                </Text>
              </View>
              <View style={styles.summaryDivider} />
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Time</Text>
                <Text style={styles.summaryValue}>
                  {formatSlotTime(selectedStartHour)} - {formatSlotTime(selectedEndHour)}
                </Text>
              </View>
              <View style={styles.summaryDivider} />
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Duration</Text>
                <Text style={styles.summaryValue}>
                  {duration} hour{duration !== 1 ? 's' : ''}
                </Text>
              </View>
              {hourlyRate > 0 && (
                <>
                  <View style={styles.summaryDivider} />
                  <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>Estimated Cost</Text>
                    <Text style={styles.summaryValueBold}>
                      ${totalCost.toFixed(2)}
                    </Text>
                  </View>
                </>
              )}
            </GlassCard>
          </View>
        )}
      </ScrollView>

      {/* Submit CTA */}
      <View style={styles.ctaContainer}>
        <TouchableOpacity
          style={[
            styles.ctaButton,
            (selectedStartHour === null || createReservation.isPending) && styles.ctaButtonDisabled,
          ]}
          activeOpacity={0.9}
          onPress={handleSubmit}
          disabled={selectedStartHour === null || createReservation.isPending}
        >
          {createReservation.isPending ? (
            <ActivityIndicator size="small" color={colors.textOnDark} />
          ) : (
            <>
              <Text style={styles.ctaButtonText}>
                {hourlyRate > 0 && selectedStartHour !== null
                  ? `Book for $${totalCost.toFixed(2)}`
                  : 'Confirm Reservation'}
              </Text>
              <Ionicons name="chevron-forward" size={20} color="rgba(255,255,255,0.5)" />
            </>
          )}
        </TouchableOpacity>
      </View>
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
  sectionTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xl,
  },

  // Day picker
  daysScroll: {
    gap: spacing.xl,
  },
  dayItem: {
    alignItems: 'center',
    gap: spacing.md,
  },
  dayLabel: {
    fontFamily: fonts.bold,
    fontSize: 10,
    color: colors.textCaption,
    textTransform: 'uppercase',
  },
  dayLabelActive: {
    color: colors.textPrimary,
  },
  dayCircle: {
    width: 44,
    height: 44,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: colors.borderMedium,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayCircleActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
    ...shadows.blueGlow,
  },
  dayNumber: {
    fontFamily: fonts.bold,
    fontSize: 14,
    color: colors.textBody,
  },
  dayNumberActive: {
    color: colors.textOnDark,
  },

  // Slot count badge
  slotCountBadge: {
    backgroundColor: colors.primaryLight,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: borderRadius.sm,
  },
  slotCountText: {
    fontFamily: fonts.bold,
    fontSize: 10,
    color: colors.primary,
  },

  // Slots grid
  slotsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.lg,
  },
  slotPill: {
    width: '30.5%',
    height: 40,
    borderWidth: 1,
    borderColor: colors.borderMedium,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  slotPillActive: {
    backgroundColor: colors.dark,
    borderColor: colors.dark,
    ...shadows.md,
  },
  slotPillDisabled: {
    borderColor: colors.border,
    backgroundColor: colors.border,
  },
  slotPillText: {
    fontFamily: fonts.bold,
    fontSize: 12,
    color: colors.textBody,
  },
  slotPillTextActive: {
    color: colors.textOnDark,
  },
  slotPillTextDisabled: {
    color: colors.textDisabled,
  },

  // Notes
  notesInput: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderMedium,
    borderRadius: borderRadius.lg,
    padding: spacing.xl,
    fontFamily: fonts.medium,
    fontSize: 14,
    color: colors.textPrimary,
    minHeight: 80,
  },

  // Summary
  summaryCard: {
    padding: spacing.cardPadding,
    borderRadius: borderRadius['2xl'],
    gap: 0,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.lg,
  },
  summaryLabel: {
    fontFamily: fonts.medium,
    fontSize: 13,
    color: colors.textMuted,
  },
  summaryValue: {
    fontFamily: fonts.bold,
    fontSize: 13,
    color: colors.textPrimary,
  },
  summaryValueBold: {
    fontFamily: fonts.bold,
    fontSize: 16,
    color: colors.textPrimary,
  },
  summaryDivider: {
    height: 1,
    backgroundColor: colors.border,
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
  ctaButtonDisabled: {
    opacity: 0.4,
  },
  ctaButtonText: {
    fontFamily: fonts.bold,
    fontSize: 16,
    color: colors.textOnDark,
  },
});
