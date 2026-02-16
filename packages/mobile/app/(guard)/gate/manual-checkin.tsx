import { useState, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useManualCheckIn } from '@/hooks/useGateOps';
import { AmbientBackground } from '@/components/ui/AmbientBackground';
import { colors, fonts, spacing, borderRadius, shadows } from '@/theme';

const PERSON_TYPES = [
  { key: 'visitor', label: 'Visitor', icon: 'person-outline' as const },
  { key: 'provider', label: 'Provider', icon: 'construct-outline' as const },
  { key: 'delivery', label: 'Delivery', icon: 'cube-outline' as const },
  { key: 'other', label: 'Other', icon: 'ellipsis-horizontal-outline' as const },
];

export default function ManualCheckInScreen() {
  const router = useRouter();
  const manualCheckIn = useManualCheckIn();

  const [personName, setPersonName] = useState('');
  const [personType, setPersonType] = useState('visitor');
  const [vehiclePlate, setVehiclePlate] = useState('');
  const [direction, setDirection] = useState<'entry' | 'exit'>('entry');
  const [guardNotes, setGuardNotes] = useState('');

  const canSubmit = personName.trim().length > 0 && !manualCheckIn.isPending;

  const handleSubmit = useCallback(
    (decision: 'allowed' | 'denied') => {
      if (!personName.trim()) {
        if (Platform.OS === 'web') {
          window.alert('Please enter the visitor name.');
        } else {
          Alert.alert('Required', 'Please enter the visitor name.');
        }
        return;
      }

      manualCheckIn.mutate(
        {
          person_name: personName.trim(),
          person_type: personType,
          vehicle_plate: vehiclePlate.trim() || undefined,
          direction,
          method: 'manual',
          decision,
          guard_notes: guardNotes.trim() || undefined,
        },
        {
          onSuccess: () => {
            const msg = `${personName} has been ${decision === 'allowed' ? 'granted access' : 'denied entry'}.`;
            if (Platform.OS === 'web') {
              window.alert(msg);
              router.replace('/(guard)');
            } else {
              Alert.alert(
                decision === 'allowed' ? 'Entry Logged' : 'Entry Denied',
                msg,
                [{ text: 'OK', onPress: () => router.replace('/(guard)') }],
              );
            }
          },
          onError: (err) => {
            if (Platform.OS === 'web') {
              window.alert(err.message);
            } else {
              Alert.alert('Error', err.message);
            }
          },
        },
      );
    },
    [manualCheckIn, personName, personType, vehiclePlate, direction, guardNotes, router],
  );

  return (
    <View style={styles.container}>
      <AmbientBackground />

      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerRow}>
              <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
                <Ionicons name="chevron-back" size={22} color={colors.textBody} />
              </TouchableOpacity>
              <Text style={styles.headerTitle}>Manual Entry</Text>
              <View style={styles.headerSpacer} />
            </View>
            <View style={styles.headerInfo}>
              <Text style={styles.headerHeading}>Visitor Registration</Text>
              <Text style={styles.headerSubtitle}>
                Create an ad-hoc access record for walk-ins.
              </Text>
            </View>
          </View>

          {/* Form Fields */}
          <View style={styles.formSection}>
            {/* Full Name */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>FULL NAME</Text>
              <View style={styles.inputRow}>
                <Ionicons name="person-outline" size={20} color={colors.textCaption} style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="Visitor's legal name"
                  placeholderTextColor={colors.textDisabled}
                  value={personName}
                  onChangeText={setPersonName}
                  autoCapitalize="words"
                  autoCorrect={false}
                />
              </View>
            </View>

            {/* Person Type Selector */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>VISITOR TYPE</Text>
              <View style={styles.typeGrid}>
                {PERSON_TYPES.map((type) => {
                  const isActive = personType === type.key;
                  return (
                    <TouchableOpacity
                      key={type.key}
                      style={[styles.typeChip, isActive && styles.typeChipActive]}
                      onPress={() => setPersonType(type.key)}
                    >
                      <Ionicons
                        name={type.icon}
                        size={16}
                        color={isActive ? colors.primary : colors.textCaption}
                      />
                      <Text style={[styles.typeChipText, isActive && styles.typeChipTextActive]}>
                        {type.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* Vehicle Plate */}
            <View style={styles.fieldGroup}>
              <View style={styles.labelRow}>
                <Text style={styles.fieldLabel}>VEHICLE PLATE</Text>
                <View style={styles.optionalBadge}>
                  <Text style={styles.optionalText}>OPTIONAL</Text>
                </View>
              </View>
              <View style={styles.inputRow}>
                <Ionicons name="car-outline" size={20} color={colors.textCaption} style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="License Plate (e.g. ABC-123)"
                  placeholderTextColor={colors.textDisabled}
                  value={vehiclePlate}
                  onChangeText={setVehiclePlate}
                  autoCapitalize="characters"
                  autoCorrect={false}
                />
              </View>
            </View>

            {/* Direction Toggle */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>DIRECTION</Text>
              <View style={styles.toggleContainer}>
                <TouchableOpacity
                  style={[styles.toggleOption, direction === 'entry' && styles.toggleOptionActive]}
                  onPress={() => setDirection('entry')}
                >
                  <Ionicons
                    name="log-in-outline"
                    size={18}
                    color={direction === 'entry' ? colors.primary : colors.textCaption}
                  />
                  <Text
                    style={[
                      styles.toggleText,
                      direction === 'entry' && styles.toggleTextActive,
                    ]}
                  >
                    Entry
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.toggleOption, direction === 'exit' && styles.toggleOptionActive]}
                  onPress={() => setDirection('exit')}
                >
                  <Ionicons
                    name="log-out-outline"
                    size={18}
                    color={direction === 'exit' ? colors.primary : colors.textCaption}
                  />
                  <Text
                    style={[
                      styles.toggleText,
                      direction === 'exit' && styles.toggleTextActive,
                    ]}
                  >
                    Exit
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Guard Notes */}
            <View style={styles.fieldGroup}>
              <View style={styles.labelRow}>
                <Text style={styles.fieldLabel}>GUARD NOTES</Text>
                <View style={styles.optionalBadge}>
                  <Text style={styles.optionalText}>OPTIONAL</Text>
                </View>
              </View>
              <View style={styles.textAreaContainer}>
                <TextInput
                  style={styles.textArea}
                  placeholder="Additional observations or notes..."
                  placeholderTextColor={colors.textDisabled}
                  value={guardNotes}
                  onChangeText={setGuardNotes}
                  multiline
                  numberOfLines={3}
                  textAlignVertical="top"
                />
              </View>
            </View>
          </View>

          {/* Submit Buttons */}
          <View style={styles.submitSection}>
            <TouchableOpacity
              style={[styles.submitButton, !canSubmit && styles.submitButtonDisabled]}
              onPress={() => handleSubmit('allowed')}
              disabled={!canSubmit}
              activeOpacity={0.85}
            >
              <Text style={styles.submitButtonText}>Complete Check-in</Text>
              <Ionicons name="checkmark-circle-outline" size={22} color={colors.textOnDark} />
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.denyButton, !canSubmit && styles.denyButtonDisabled]}
              onPress={() => handleSubmit('denied')}
              disabled={!canSubmit}
              activeOpacity={0.85}
            >
              <Text style={styles.denyButtonText}>Deny Entry</Text>
              <Ionicons name="close-circle-outline" size={22} color={colors.danger} />
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  keyboardView: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
    zIndex: 10,
  },
  scrollContent: {
    paddingTop: spacing.safeAreaTop,
    paddingHorizontal: spacing.pagePaddingX,
    paddingBottom: spacing.bottomNavClearance,
  },

  // Header
  header: {
    marginBottom: spacing['4xl'],
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing['3xl'],
  },
  backButton: {
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
  headerTitle: {
    fontFamily: fonts.bold,
    fontSize: 18,
    color: colors.textPrimary,
    letterSpacing: -0.3,
  },
  headerSpacer: {
    width: 40,
  },
  headerInfo: {},
  headerHeading: {
    fontFamily: fonts.black,
    fontSize: 24,
    color: colors.textPrimary,
    letterSpacing: -0.5,
  },
  headerSubtitle: {
    fontFamily: fonts.medium,
    fontSize: 14,
    color: colors.textMuted,
    marginTop: spacing.xs,
  },

  // Form
  formSection: {
    gap: spacing['3xl'],
    marginBottom: spacing['4xl'],
  },
  fieldGroup: {},
  fieldLabel: {
    fontFamily: fonts.bold,
    fontSize: 11,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginLeft: 4,
    marginBottom: spacing.md,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  optionalBadge: {
    paddingHorizontal: spacing.md,
    paddingVertical: 2,
    backgroundColor: colors.borderMedium,
    borderRadius: borderRadius.full,
  },
  optionalText: {
    fontFamily: fonts.bold,
    fontSize: 9,
    color: colors.textMuted,
    textTransform: 'uppercase',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: borderRadius.xl,
    borderWidth: 1,
    borderColor: colors.borderMedium,
    paddingHorizontal: spacing.xl,
    height: spacing.inputHeight,
  },
  inputIcon: {
    marginRight: spacing.lg,
  },
  input: {
    flex: 1,
    fontFamily: fonts.medium,
    fontSize: 16,
    color: colors.textPrimary,
    height: '100%',
  },

  // Type Grid
  typeGrid: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  typeChip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.lg,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.borderMedium,
  },
  typeChipActive: {
    backgroundColor: colors.primaryLight,
    borderColor: colors.primary,
  },
  typeChipText: {
    fontFamily: fonts.bold,
    fontSize: 11,
    color: colors.textCaption,
  },
  typeChipTextActive: {
    color: colors.primary,
  },

  // Toggle
  toggleContainer: {
    flexDirection: 'row',
    gap: spacing.lg,
  },
  toggleOption: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    height: spacing.smallButtonHeight,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.borderMedium,
  },
  toggleOptionActive: {
    backgroundColor: colors.primaryLight,
    borderColor: colors.primary,
  },
  toggleText: {
    fontFamily: fonts.bold,
    fontSize: 14,
    color: colors.textCaption,
  },
  toggleTextActive: {
    color: colors.primary,
  },

  // Text Area
  textAreaContainer: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.xl,
    borderWidth: 1,
    borderColor: colors.borderMedium,
    padding: spacing.xl,
    minHeight: 100,
  },
  textArea: {
    fontFamily: fonts.medium,
    fontSize: 14,
    color: colors.textPrimary,
    lineHeight: 20,
  },

  // Submit
  submitSection: {
    gap: spacing.lg,
    paddingBottom: spacing['3xl'],
  },
  submitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.lg,
    height: spacing.buttonHeight,
    backgroundColor: colors.dark,
    borderRadius: borderRadius.xl,
    ...shadows.xl,
  },
  submitButtonDisabled: {
    backgroundColor: colors.textDisabled,
  },
  submitButtonText: {
    fontFamily: fonts.bold,
    fontSize: 18,
    color: colors.textOnDark,
  },
  denyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.lg,
    height: spacing.buttonHeight,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.xl,
    borderWidth: 1,
    borderColor: colors.dangerBg,
  },
  denyButtonDisabled: {
    opacity: 0.5,
  },
  denyButtonText: {
    fontFamily: fonts.bold,
    fontSize: 16,
    color: colors.danger,
  },
});
