import { useState } from 'react';
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
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useCreateVehicle } from '@/hooks/useVehicles';
import { AmbientBackground } from '@/components/ui/AmbientBackground';
import { colors, fonts, spacing, borderRadius, shadows } from '@/theme';

export default function CreateVehicleScreen() {
  const router = useRouter();
  const createMutation = useCreateVehicle();

  // Form state
  const [plateNumber, setPlateNumber] = useState('');
  const [plateState, setPlateState] = useState('');
  const [make, setMake] = useState('');
  const [model, setModel] = useState('');
  const [color, setColor] = useState('');
  const [year, setYear] = useState('');

  const isValid = plateNumber.trim().length > 0 && plateState.trim().length > 0;

  const showAlert = (title: string, message: string, onOk?: () => void) => {
    if (Platform.OS === 'web') {
      window.alert(message);
      onOk?.();
    } else if (onOk) {
      Alert.alert(title, message, [{ text: 'OK', onPress: onOk }]);
    } else {
      Alert.alert(title, message);
    }
  };

  const handleSubmit = async () => {
    if (!plateNumber.trim()) {
      showAlert('Required', 'Please enter the plate number.');
      return;
    }
    if (!plateState.trim()) {
      showAlert('Required', 'Please enter the plate state.');
      return;
    }

    const yearNum = year.trim() ? parseInt(year.trim(), 10) : undefined;
    if (year.trim() && (isNaN(yearNum!) || yearNum! < 1900 || yearNum! > 2100)) {
      showAlert('Invalid', 'Please enter a valid year (1900-2100).');
      return;
    }

    try {
      await createMutation.mutateAsync({
        plate_number: plateNumber.trim().toUpperCase(),
        plate_state: plateState.trim(),
        make: make.trim() || undefined,
        model: model.trim() || undefined,
        color: color.trim() || undefined,
        year: yearNum,
      });

      showAlert('Success', 'Vehicle added successfully.', () => router.back());
    } catch (err: any) {
      showAlert('Error', err?.message ?? 'Failed to add vehicle.');
    }
  };

  return (
    <View style={styles.container}>
      <AmbientBackground />

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Ionicons name="chevron-back" size={20} color={colors.textBody} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>New Vehicle</Text>
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
          {/* Plate Number & Year */}
          <View style={styles.twoColRow}>
            <View style={styles.fieldGroupFlex}>
              <Text style={styles.fieldLabel}>Plate Number *</Text>
              <View style={styles.inputWrapper}>
                <TextInput
                  style={styles.inputBold}
                  value={plateNumber}
                  onChangeText={(v) => setPlateNumber(v.toUpperCase())}
                  placeholder="ABC-1234"
                  placeholderTextColor={colors.textDisabled}
                  autoCapitalize="characters"
                  autoCorrect={false}
                />
              </View>
            </View>
            <View style={styles.fieldGroupFlex}>
              <Text style={styles.fieldLabel}>Year</Text>
              <View style={styles.inputWrapper}>
                <TextInput
                  style={styles.inputBold}
                  value={year}
                  onChangeText={setYear}
                  placeholder="2024"
                  placeholderTextColor={colors.textDisabled}
                  keyboardType="number-pad"
                  maxLength={4}
                />
              </View>
            </View>
          </View>

          {/* Plate State */}
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Plate State *</Text>
            <View style={styles.inputWrapper}>
              <TextInput
                style={styles.inputBold}
                value={plateState}
                onChangeText={setPlateState}
                placeholder="e.g. Jalisco, CDMX"
                placeholderTextColor={colors.textDisabled}
                autoCapitalize="words"
              />
            </View>
          </View>

          {/* Make */}
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Make (Brand)</Text>
            <View style={styles.inputWrapper}>
              <TextInput
                style={styles.inputBold}
                value={make}
                onChangeText={setMake}
                placeholder="e.g. Tesla, BMW, Toyota"
                placeholderTextColor={colors.textDisabled}
                autoCapitalize="words"
              />
            </View>
          </View>

          {/* Model */}
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Model</Text>
            <View style={styles.inputWrapper}>
              <TextInput
                style={styles.inputBold}
                value={model}
                onChangeText={setModel}
                placeholder="e.g. Model 3, X5, Camry"
                placeholderTextColor={colors.textDisabled}
                autoCapitalize="words"
              />
            </View>
          </View>

          {/* Color */}
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Color</Text>
            <View style={styles.inputWrapper}>
              <TextInput
                style={styles.inputBold}
                value={color}
                onChangeText={setColor}
                placeholder="e.g. Midnight Silver"
                placeholderTextColor={colors.textDisabled}
                autoCapitalize="words"
              />
            </View>
          </View>

          {/* Preview Card */}
          {plateNumber.trim().length > 0 && (
            <View style={styles.previewCard}>
              <View style={styles.previewHeader}>
                <Ionicons name="car" size={20} color={colors.textCaption} />
                <Text style={styles.previewTitle}>Preview</Text>
              </View>
              <View style={styles.previewBody}>
                <Text style={styles.previewPlate}>{plateNumber.toUpperCase()}</Text>
                <Text style={styles.previewDetails}>
                  {[make, model, year, color].filter((v) => v.trim()).join(' \u2022 ') || 'Add details above'}
                </Text>
              </View>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Submit Button */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={[
            styles.submitButton,
            !isValid && styles.submitButtonInactive,
            createMutation.isPending && styles.submitButtonInactive,
          ]}
          onPress={handleSubmit}
          disabled={!isValid || createMutation.isPending}
          activeOpacity={0.9}
        >
          {createMutation.isPending ? (
            <ActivityIndicator color={colors.textOnDark} />
          ) : (
            <Text style={styles.submitButtonText}>Add Vehicle</Text>
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
    fontSize: 24,
    color: colors.textPrimary,
    letterSpacing: -0.5,
  },

  // Scroll
  scrollContent: {
    paddingHorizontal: spacing.pagePaddingX,
    paddingBottom: 160,
    gap: spacing.xl,
  },

  // Fields
  twoColRow: {
    flexDirection: 'row',
    gap: spacing.xl,
  },
  fieldGroupFlex: {
    flex: 1,
    gap: spacing.xs,
  },
  fieldGroup: {
    gap: spacing.xs,
  },
  fieldLabel: {
    fontFamily: fonts.bold,
    fontSize: 10,
    color: colors.textCaption,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    marginLeft: 4,
  },
  inputWrapper: {
    backgroundColor: colors.border,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.borderMedium,
    paddingHorizontal: spacing.xl,
    height: spacing.inputHeight,
    justifyContent: 'center',
  },
  inputBold: {
    fontFamily: fonts.bold,
    fontSize: 15,
    color: colors.textPrimary,
  },

  // Preview Card
  previewCard: {
    backgroundColor: colors.dark,
    borderRadius: borderRadius['2xl'],
    padding: spacing.cardPadding,
    marginTop: spacing.md,
    ...shadows.darkGlow,
  },
  previewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.xl,
  },
  previewTitle: {
    fontFamily: fonts.bold,
    fontSize: 12,
    color: colors.textOnDarkMuted,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  previewBody: {
    alignItems: 'center',
    paddingVertical: spacing.lg,
  },
  previewPlate: {
    fontFamily: fonts.bold,
    fontSize: 32,
    color: colors.textOnDark,
    letterSpacing: 2,
    marginBottom: spacing.sm,
  },
  previewDetails: {
    fontFamily: fonts.medium,
    fontSize: 14,
    color: colors.textOnDarkMuted,
  },

  // Footer
  footer: {
    position: 'absolute',
    bottom: spacing.bottomNavClearance,
    left: 0,
    right: 0,
    paddingHorizontal: spacing.pagePaddingX,
  },
  submitButton: {
    height: 64,
    backgroundColor: colors.primary,
    borderRadius: borderRadius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.blueGlow,
  },
  submitButtonInactive: {
    opacity: 0.5,
  },
  submitButtonText: {
    fontFamily: fonts.bold,
    fontSize: 18,
    color: colors.textOnDark,
  },
});
