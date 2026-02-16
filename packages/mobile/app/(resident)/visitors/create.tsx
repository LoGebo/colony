import { useState, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
  Modal,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker, {
  type DateTimePickerEvent,
} from '@react-native-community/datetimepicker';
import { useCreateInvitation } from '@/hooks/useVisitors';
import { useResidentUnit } from '@/hooks/useOccupancy';
import { AmbientBackground } from '@/components/ui/AmbientBackground';
import { GlassCard } from '@/components/ui/GlassCard';
import { colors, fonts, spacing, borderRadius, shadows } from '@/theme';

type InvitationType = 'single_use' | 'recurring' | 'event' | 'vehicle_preauth';

const TYPE_OPTIONS: {
  key: InvitationType;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
}[] = [
  { key: 'single_use', label: 'One-time', icon: 'person-outline' },
  { key: 'recurring', label: 'Recurring', icon: 'calendar-outline' },
  { key: 'event', label: 'Event', icon: 'sparkles-outline' },
];

const DAY_PILLS = [
  { label: 'M', value: 1 },
  { label: 'T', value: 2 },
  { label: 'W', value: 3 },
  { label: 'T', value: 4 },
  { label: 'F', value: 5 },
  { label: 'S', value: 6 },
  { label: 'S', value: 0 },
];

// ── Picker field identifiers ──

type PickerField =
  | 'validFromDate'
  | 'validFromTime'
  | 'validUntilDate'
  | 'validUntilTime'
  | 'recurringStartTime'
  | 'recurringEndTime';

// ── Helpers ──

function formatDateDisplay(date: Date): string {
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatTimeDisplay(date: Date): string {
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

function padTime(d: Date): string {
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:00`;
}

// ── Component ──

export default function CreateInvitationScreen() {
  const router = useRouter();
  const createMutation = useCreateInvitation();
  const { unitId } = useResidentUnit();

  // Form state
  const [invitationType, setInvitationType] = useState<InvitationType>('single_use');
  const [visitorName, setVisitorName] = useState('');
  const [phone, setPhone] = useState('');
  const [vehiclePlate, setVehiclePlate] = useState('');
  const [showVehicle, setShowVehicle] = useState(false);

  // Date/time state (with setters)
  const [validFrom, setValidFrom] = useState(() => new Date());
  const [validUntil, setValidUntil] = useState(() => {
    const d = new Date();
    d.setHours(d.getHours() + 8);
    return d;
  });

  // Recurring state (with setters)
  const [recurringDays, setRecurringDays] = useState<number[]>([]);
  const [recurringStartTime, setRecurringStartTime] = useState(() => {
    const d = new Date();
    d.setHours(8, 0, 0, 0);
    return d;
  });
  const [recurringEndTime, setRecurringEndTime] = useState(() => {
    const d = new Date();
    d.setHours(20, 0, 0, 0);
    return d;
  });

  // Picker visibility state
  const [activePickerField, setActivePickerField] = useState<PickerField | null>(null);
  const [showIOSModal, setShowIOSModal] = useState(false);

  // ── Picker helpers ──

  const getPickerMode = (field: PickerField): 'date' | 'time' => {
    if (field.endsWith('Date')) return 'date';
    return 'time';
  };

  const getPickerValue = (field: PickerField): Date => {
    switch (field) {
      case 'validFromDate':
      case 'validFromTime':
        return validFrom;
      case 'validUntilDate':
      case 'validUntilTime':
        return validUntil;
      case 'recurringStartTime':
        return recurringStartTime;
      case 'recurringEndTime':
        return recurringEndTime;
    }
  };

  const applyPickerChange = useCallback(
    (field: PickerField, selectedDate: Date) => {
      switch (field) {
        case 'validFromDate': {
          const updated = new Date(validFrom);
          updated.setFullYear(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate());
          setValidFrom(updated);
          break;
        }
        case 'validFromTime': {
          const updated = new Date(validFrom);
          updated.setHours(selectedDate.getHours(), selectedDate.getMinutes(), 0, 0);
          setValidFrom(updated);
          break;
        }
        case 'validUntilDate': {
          const updated = new Date(validUntil);
          updated.setFullYear(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate());
          setValidUntil(updated);
          break;
        }
        case 'validUntilTime': {
          const updated = new Date(validUntil);
          updated.setHours(selectedDate.getHours(), selectedDate.getMinutes(), 0, 0);
          setValidUntil(updated);
          break;
        }
        case 'recurringStartTime':
          setRecurringStartTime(selectedDate);
          break;
        case 'recurringEndTime':
          setRecurringEndTime(selectedDate);
          break;
      }
    },
    [validFrom, validUntil],
  );

  const openPicker = useCallback((field: PickerField) => {
    setActivePickerField(field);
    if (Platform.OS === 'ios') {
      setShowIOSModal(true);
    }
  }, []);

  const closePicker = useCallback(() => {
    setActivePickerField(null);
    setShowIOSModal(false);
  }, []);

  const handlePickerChange = useCallback(
    (event: DateTimePickerEvent, selectedDate?: Date) => {
      if (!activePickerField) return;

      if (Platform.OS === 'android') {
        // Android: picker dismisses itself on set or dismiss
        setActivePickerField(null);
        if (event.type === 'set' && selectedDate) {
          applyPickerChange(activePickerField, selectedDate);
        }
      } else {
        // iOS: picker stays open until user taps "Done"
        if (selectedDate) {
          applyPickerChange(activePickerField, selectedDate);
        }
      }
    },
    [activePickerField, applyPickerChange],
  );

  // ── Day toggle ──

  const toggleDay = useCallback((day: number) => {
    setRecurringDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day],
    );
  }, []);

  // ── Submit ──

  const handleSubmit = async () => {
    if (!visitorName.trim()) {
      Alert.alert('Required', 'Please enter the visitor name.');
      return;
    }

    if (invitationType === 'recurring' && recurringDays.length === 0) {
      Alert.alert('Required', 'Please select at least one day for recurring access.');
      return;
    }

    try {
      await createMutation.mutateAsync({
        visitor_name: visitorName.trim(),
        invitation_type: invitationType,
        valid_from: validFrom.toISOString(),
        valid_until: invitationType !== 'recurring' ? validUntil.toISOString() : undefined,
        visitor_phone: phone.trim() || undefined,
        vehicle_plate: showVehicle && vehiclePlate.trim() ? vehiclePlate.trim() : undefined,
        recurring_days: invitationType === 'recurring' ? recurringDays : undefined,
        recurring_start_time:
          invitationType === 'recurring' ? padTime(recurringStartTime) : undefined,
        recurring_end_time:
          invitationType === 'recurring' ? padTime(recurringEndTime) : undefined,
        unit_id: unitId ?? undefined,
      });

      if (Platform.OS === 'web') {
        window.alert('Invitation created successfully.');
        router.back();
      } else {
        Alert.alert('Success', 'Invitation created successfully.', [
          { text: 'OK', onPress: () => router.back() },
        ]);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to create invitation.';
      if (Platform.OS === 'web') {
        window.alert(message);
      } else {
        Alert.alert('Error', message);
      }
    }
  };

  // ── Determine if a particular button is the "active" picker ──

  const isFieldActive = (field: PickerField): boolean => activePickerField === field;

  // ── Render ──

  return (
    <View style={styles.container}>
      <AmbientBackground />

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Ionicons name="chevron-back" size={20} color={colors.textBody} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Create Invitation</Text>
        </View>
      </View>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={0}
      >
        <ScrollView
          style={styles.flex}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Invitation Type Selector */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Invitation Type</Text>
            <View style={styles.typeGrid}>
              {TYPE_OPTIONS.map((opt) => {
                const isActive = invitationType === opt.key;
                return (
                  <TouchableOpacity
                    key={opt.key}
                    style={[styles.typeCard, isActive && styles.typeCardActive]}
                    onPress={() => setInvitationType(opt.key)}
                    activeOpacity={0.7}
                  >
                    <Ionicons
                      name={opt.icon}
                      size={20}
                      color={isActive ? colors.primary : colors.textCaption}
                    />
                    <Text style={[styles.typeLabel, isActive && styles.typeLabelActive]}>
                      {opt.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* Guest Info */}
          <View style={styles.section}>
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Guest Name</Text>
              <View style={styles.inputWrapper}>
                <Ionicons
                  name="person-outline"
                  size={20}
                  color={colors.textDisabled}
                  style={styles.inputIcon}
                />
                <TextInput
                  style={styles.input}
                  placeholder="e.g. Michael Smith"
                  placeholderTextColor={colors.textDisabled}
                  value={visitorName}
                  onChangeText={setVisitorName}
                  autoCapitalize="words"
                />
              </View>
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Phone Number</Text>
              <View style={styles.inputWrapper}>
                <Ionicons
                  name="call-outline"
                  size={20}
                  color={colors.textDisabled}
                  style={styles.inputIcon}
                />
                <TextInput
                  style={styles.input}
                  placeholder="+1 (555) 000-0000"
                  placeholderTextColor={colors.textDisabled}
                  value={phone}
                  onChangeText={setPhone}
                  keyboardType="phone-pad"
                />
              </View>
            </View>
          </View>

          {/* Date/Time for non-recurring */}
          {invitationType !== 'recurring' && (
            <View style={styles.section}>
              <View style={styles.dateRow}>
                {/* Valid From */}
                <View style={styles.dateField}>
                  <Text style={styles.fieldLabel}>Valid From</Text>
                  <TouchableOpacity
                    style={[
                      styles.dateButton,
                      isFieldActive('validFromDate') && styles.dateButtonActive,
                    ]}
                    onPress={() => openPicker('validFromDate')}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="calendar-outline" size={16} color={colors.textCaption} />
                    <Text style={styles.dateButtonText}>{formatDateDisplay(validFrom)}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.dateButton,
                      isFieldActive('validFromTime') && styles.dateButtonActive,
                    ]}
                    onPress={() => openPicker('validFromTime')}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="time-outline" size={16} color={colors.textCaption} />
                    <Text style={styles.dateButtonText}>{formatTimeDisplay(validFrom)}</Text>
                  </TouchableOpacity>
                </View>

                {/* Valid Until */}
                <View style={styles.dateField}>
                  <Text style={styles.fieldLabel}>Valid Until</Text>
                  <TouchableOpacity
                    style={[
                      styles.dateButton,
                      isFieldActive('validUntilDate') && styles.dateButtonActive,
                    ]}
                    onPress={() => openPicker('validUntilDate')}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="calendar-outline" size={16} color={colors.textCaption} />
                    <Text style={styles.dateButtonText}>{formatDateDisplay(validUntil)}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.dateButton,
                      isFieldActive('validUntilTime') && styles.dateButtonActive,
                    ]}
                    onPress={() => openPicker('validUntilTime')}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="time-outline" size={16} color={colors.textCaption} />
                    <Text style={styles.dateButtonText}>{formatTimeDisplay(validUntil)}</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          )}

          {/* Recurring Options */}
          {invitationType === 'recurring' && (
            <View style={styles.section}>
              <Text style={styles.fieldLabel}>Select Days</Text>
              <View style={styles.dayPillsRow}>
                {DAY_PILLS.map((day, idx) => {
                  const isActive = recurringDays.includes(day.value);
                  return (
                    <TouchableOpacity
                      key={`day-${idx}-${day.value}`}
                      style={[styles.dayPill, isActive && styles.dayPillActive]}
                      onPress={() => toggleDay(day.value)}
                    >
                      <Text
                        style={[styles.dayPillText, isActive && styles.dayPillTextActive]}
                      >
                        {day.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <View style={styles.timeRangeRow}>
                <View style={styles.dateField}>
                  <Text style={styles.fieldLabel}>From</Text>
                  <TouchableOpacity
                    style={[
                      styles.timeInput,
                      isFieldActive('recurringStartTime') && styles.dateButtonActive,
                    ]}
                    onPress={() => openPicker('recurringStartTime')}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.timeInputText}>
                      {formatTimeDisplay(recurringStartTime)}
                    </Text>
                  </TouchableOpacity>
                </View>
                <View style={styles.dateField}>
                  <Text style={styles.fieldLabel}>Until</Text>
                  <TouchableOpacity
                    style={[
                      styles.timeInput,
                      isFieldActive('recurringEndTime') && styles.dateButtonActive,
                    ]}
                    onPress={() => openPicker('recurringEndTime')}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.timeInputText}>
                      {formatTimeDisplay(recurringEndTime)}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          )}

          {/* Vehicle Access Toggle */}
          <GlassCard style={styles.vehicleCard}>
            <View style={styles.vehicleHeader}>
              <View style={styles.vehicleHeaderLeft}>
                <View style={styles.vehicleIconBox}>
                  <Ionicons name="car-outline" size={20} color={colors.primary} />
                </View>
                <View>
                  <Text style={styles.vehicleTitle}>Vehicle Access</Text>
                  <Text style={styles.vehicleSubtitle}>Register vehicle details</Text>
                </View>
              </View>
              <TouchableOpacity
                style={[styles.toggle, showVehicle && styles.toggleActive]}
                onPress={() => setShowVehicle(!showVehicle)}
                activeOpacity={0.8}
              >
                <View style={[styles.toggleThumb, showVehicle && styles.toggleThumbActive]} />
              </TouchableOpacity>
            </View>

            {showVehicle && (
              <View style={styles.vehicleFields}>
                <View style={styles.vehicleInputWrapper}>
                  <TextInput
                    style={styles.vehicleInput}
                    placeholder="License Plate"
                    placeholderTextColor={colors.textDisabled}
                    value={vehiclePlate}
                    onChangeText={setVehiclePlate}
                    autoCapitalize="characters"
                  />
                </View>
              </View>
            )}
          </GlassCard>

          {/* Security Preview */}
          <View style={styles.securityPreview}>
            <View style={styles.securityHeader}>
              <View style={styles.securityHeaderLeft}>
                <Ionicons name="shield-checkmark" size={24} color={colors.teal} />
                <Text style={styles.securityBrand}>Secure LuminaPass</Text>
              </View>
              <View style={styles.securityDot} />
            </View>

            <View style={styles.qrPlaceholder}>
              <Ionicons name="qr-code-outline" size={80} color="rgba(15,23,42,0.15)" />
              <Text style={styles.qrPlaceholderText}>Preview available on save</Text>
            </View>

            <View style={styles.hmacSection}>
              <Text style={styles.hmacLabel}>Security Signature (HMAC)</Text>
              <View style={styles.hmacCodeBox}>
                <Text style={styles.hmacCode}>
                  sha256:7f2e9a1b0c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f...
                </Text>
              </View>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Submit Button */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.submitButton, createMutation.isPending && styles.submitButtonDisabled]}
          onPress={handleSubmit}
          disabled={createMutation.isPending}
          activeOpacity={0.9}
        >
          {createMutation.isPending ? (
            <ActivityIndicator color={colors.textOnDark} />
          ) : (
            <>
              <Text style={styles.submitButtonText}>Generate Invitation</Text>
              <Ionicons name="arrow-forward" size={20} color={colors.textOnDark} />
            </>
          )}
        </TouchableOpacity>
      </View>

      {/* ── Android Native Picker (renders as dialog automatically) ── */}
      {Platform.OS === 'android' && activePickerField != null && (
        <DateTimePicker
          value={getPickerValue(activePickerField)}
          mode={getPickerMode(activePickerField)}
          is24Hour
          display="default"
          onChange={handlePickerChange}
        />
      )}

      {/* ── iOS Modal Picker ── */}
      {Platform.OS === 'ios' && (
        <Modal
          visible={showIOSModal && activePickerField != null}
          transparent
          animationType="slide"
          onRequestClose={closePicker}
        >
          <View style={styles.iosModalBackdrop}>
            <TouchableOpacity
              style={styles.iosModalBackdropTouchable}
              activeOpacity={1}
              onPress={closePicker}
            />
            <View style={styles.iosPickerContainer}>
              <View style={styles.iosPickerHeader}>
                <TouchableOpacity onPress={closePicker}>
                  <Text style={styles.iosPickerDone}>Done</Text>
                </TouchableOpacity>
              </View>
              {activePickerField != null && (
                <DateTimePicker
                  value={getPickerValue(activePickerField)}
                  mode={getPickerMode(activePickerField)}
                  is24Hour
                  display="spinner"
                  onChange={handlePickerChange}
                  style={styles.iosPicker}
                />
              )}
            </View>
          </View>
        </Modal>
      )}

      {/* ── Web Picker Fallback ── */}
      {Platform.OS === 'web' && activePickerField != null && (
        <Modal
          visible={true}
          transparent
          animationType="fade"
          onRequestClose={closePicker}
        >
          <View style={styles.iosModalBackdrop}>
            <TouchableOpacity
              style={styles.iosModalBackdropTouchable}
              activeOpacity={1}
              onPress={closePicker}
            />
            <View style={styles.webPickerContainer}>
              <View style={styles.iosPickerHeader}>
                <Text style={styles.webPickerTitle}>
                  {getPickerMode(activePickerField) === 'date' ? 'Select Date' : 'Select Time'}
                </Text>
                <TouchableOpacity onPress={closePicker}>
                  <Text style={styles.iosPickerDone}>Done</Text>
                </TouchableOpacity>
              </View>
              <View style={styles.webPickerBody}>
                {getPickerMode(activePickerField) === 'date' ? (
                  <TextInput
                    style={styles.webDateInput}
                    value={(() => {
                      const d = getPickerValue(activePickerField);
                      const y = d.getFullYear();
                      const m = String(d.getMonth() + 1).padStart(2, '0');
                      const day = String(d.getDate()).padStart(2, '0');
                      return `${y}-${m}-${day}`;
                    })()}
                    onChangeText={(text) => {
                      const parts = text.split('-');
                      if (parts.length === 3) {
                        const date = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
                        if (!isNaN(date.getTime())) {
                          applyPickerChange(activePickerField!, date);
                        }
                      }
                    }}
                    placeholder="YYYY-MM-DD"
                    placeholderTextColor={colors.textDisabled}
                    keyboardType="default"
                  />
                ) : (
                  <TextInput
                    style={styles.webDateInput}
                    value={formatTimeDisplay(getPickerValue(activePickerField))}
                    onChangeText={(text) => {
                      const parts = text.split(':');
                      if (parts.length === 2) {
                        const h = Number(parts[0]);
                        const m = Number(parts[1]);
                        if (!isNaN(h) && !isNaN(m) && h >= 0 && h < 24 && m >= 0 && m < 60) {
                          const date = new Date(getPickerValue(activePickerField!));
                          date.setHours(h, m, 0, 0);
                          applyPickerChange(activePickerField!, date);
                        }
                      }
                    }}
                    placeholder="HH:MM"
                    placeholderTextColor={colors.textDisabled}
                    keyboardType="default"
                  />
                )}
              </View>
            </View>
          </View>
        </Modal>
      )}
    </View>
  );
}

// ── Styles ──

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  flex: {
    flex: 1,
  },
  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: spacing.safeAreaTop,
    paddingHorizontal: spacing.pagePaddingX,
    paddingBottom: spacing.xl,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xl,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.full,
    backgroundColor: colors.glass,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.glassBorder,
  },
  headerTitle: {
    fontFamily: fonts.bold,
    fontSize: 20,
    color: colors.textPrimary,
    letterSpacing: -0.5,
  },
  // Scroll
  scrollContent: {
    paddingHorizontal: spacing.pagePaddingX,
    paddingBottom: 180,
    gap: spacing['3xl'],
  },
  // Section
  section: {
    gap: spacing.xl,
  },
  sectionLabel: {
    fontFamily: fonts.bold,
    fontSize: 11,
    color: colors.textCaption,
    textTransform: 'uppercase',
    letterSpacing: 2,
  },
  // Type Selector
  typeGrid: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  typeCard: {
    flex: 1,
    height: 80,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
  },
  typeCardActive: {
    borderColor: 'rgba(37,99,235,0.2)',
    backgroundColor: 'rgba(239,246,255,0.5)',
  },
  typeLabel: {
    fontFamily: fonts.bold,
    fontSize: 11,
    color: colors.textMuted,
  },
  typeLabelActive: {
    color: colors.textSecondary,
  },
  // Input fields
  fieldGroup: {
    gap: spacing.xs,
  },
  fieldLabel: {
    fontFamily: fonts.bold,
    fontSize: 11,
    color: colors.textCaption,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginLeft: 4,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.xl,
    height: 56,
  },
  inputIcon: {
    marginRight: spacing.lg,
  },
  input: {
    flex: 1,
    fontFamily: fonts.medium,
    fontSize: 15,
    color: colors.textPrimary,
    height: '100%',
  },
  // Date/Time
  dateRow: {
    flexDirection: 'row',
    gap: spacing.xl,
  },
  dateField: {
    flex: 1,
    gap: spacing.md,
  },
  dateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.xl,
    height: 44,
  },
  dateButtonActive: {
    borderColor: colors.primary,
    borderWidth: 1.5,
  },
  dateButtonText: {
    fontFamily: fonts.medium,
    fontSize: 13,
    color: colors.textPrimary,
  },
  // Recurring
  dayPillsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  dayPill: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: colors.borderMedium,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },
  dayPillActive: {
    backgroundColor: colors.dark,
    borderColor: colors.dark,
  },
  dayPillText: {
    fontFamily: fonts.bold,
    fontSize: 12,
    color: colors.textBody,
  },
  dayPillTextActive: {
    color: colors.textOnDark,
  },
  timeRangeRow: {
    flexDirection: 'row',
    gap: spacing.xl,
  },
  timeInput: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.xl,
    height: 56,
    justifyContent: 'center',
  },
  timeInputText: {
    fontFamily: fonts.medium,
    fontSize: 15,
    color: colors.textPrimary,
  },
  // Vehicle
  vehicleCard: {
    borderRadius: borderRadius['3xl'],
    padding: spacing.cardPadding,
  },
  vehicleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  vehicleHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
  },
  vehicleIconBox: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.md,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  vehicleTitle: {
    fontFamily: fonts.bold,
    fontSize: 14,
    color: colors.textSecondary,
  },
  vehicleSubtitle: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: colors.textCaption,
  },
  // Toggle
  toggle: {
    width: 44,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.borderMedium,
    justifyContent: 'center',
    paddingHorizontal: 2,
  },
  toggleActive: {
    backgroundColor: colors.primary,
  },
  toggleThumb: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.surface,
  },
  toggleThumbActive: {
    alignSelf: 'flex-end',
  },
  vehicleFields: {
    marginTop: spacing.xl,
    gap: spacing.lg,
  },
  vehicleInputWrapper: {
    backgroundColor: 'rgba(248,250,252,0.5)',
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.xl,
    height: 48,
    justifyContent: 'center',
  },
  vehicleInput: {
    fontFamily: fonts.bold,
    fontSize: 14,
    color: colors.textPrimary,
  },
  // Security Preview
  securityPreview: {
    backgroundColor: colors.dark,
    borderRadius: borderRadius['4xl'],
    padding: spacing['3xl'],
    ...shadows.darkGlow,
  },
  securityHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing['3xl'],
  },
  securityHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
  },
  securityBrand: {
    fontFamily: fonts.bold,
    fontSize: 14,
    color: colors.textOnDark,
    letterSpacing: -0.3,
  },
  securityDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.teal,
  },
  qrPlaceholder: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    marginBottom: spacing.xl,
  },
  qrPlaceholderText: {
    fontFamily: fonts.medium,
    fontSize: 10,
    color: colors.textCaption,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: spacing.md,
  },
  hmacSection: {
    gap: spacing.xs,
  },
  hmacLabel: {
    fontFamily: fonts.bold,
    fontSize: 10,
    color: colors.textCaption,
    textTransform: 'uppercase',
    letterSpacing: 2,
  },
  hmacCodeBox: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: borderRadius.sm,
    padding: spacing.md,
  },
  hmacCode: {
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontSize: 11,
    color: 'rgba(204,251,241,0.6)',
  },
  // Footer
  footer: {
    position: 'absolute',
    bottom: spacing.bottomNavClearance,
    left: 0,
    right: 0,
    paddingHorizontal: spacing.pagePaddingX,
    zIndex: 20,
  },
  submitButton: {
    height: 64,
    backgroundColor: colors.primary,
    borderRadius: borderRadius.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.lg,
    ...shadows.blueGlow,
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    fontFamily: fonts.bold,
    fontSize: 18,
    color: colors.textOnDark,
  },
  // iOS Modal Picker
  iosModalBackdrop: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  iosModalBackdropTouchable: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  iosPickerContainer: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    paddingBottom: spacing.safeAreaBottom,
  },
  iosPickerHeader: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingHorizontal: spacing.pagePaddingX,
    paddingVertical: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  iosPickerDone: {
    fontFamily: fonts.bold,
    fontSize: 16,
    color: colors.primary,
  },
  iosPicker: {
    height: 216,
  },
  // Web Picker Fallback
  webPickerContainer: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    paddingBottom: spacing['3xl'],
  },
  webPickerTitle: {
    fontFamily: fonts.bold,
    fontSize: 16,
    color: colors.textPrimary,
    flex: 1,
  },
  webPickerBody: {
    paddingHorizontal: spacing.pagePaddingX,
    paddingVertical: spacing['3xl'],
    alignItems: 'center',
  },
  webDateInput: {
    width: '100%',
    height: 56,
    backgroundColor: colors.border,
    borderRadius: borderRadius.lg,
    paddingHorizontal: spacing.xl,
    fontFamily: fonts.bold,
    fontSize: 20,
    color: colors.textPrimary,
    textAlign: 'center',
  },
});
