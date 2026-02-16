import { useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  ScrollView,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/hooks/useAuth';
import { useLogPackage } from '@/hooks/usePackages';
import { useUnitSearch } from '@/hooks/useDirectory';
import { AmbientBackground } from '@/components/ui/AmbientBackground';
import { GlassCard } from '@/components/ui/GlassCard';
import { colors, fonts, spacing, borderRadius, shadows } from '@/theme';

const CARRIERS = [
  'Amazon',
  'FedEx',
  'UPS',
  'DHL',
  'USPS',
  'Mercado Libre',
  'Other',
];

export default function LogPackageScreen() {
  const router = useRouter();
  const { communityId } = useAuth();
  const logPackage = useLogPackage();

  const [carrier, setCarrier] = useState('');
  const [trackingNumber, setTrackingNumber] = useState('');
  const [recipientName, setRecipientName] = useState('');
  const [unitQuery, setUnitQuery] = useState('');
  const [selectedUnitId, setSelectedUnitId] = useState<string | null>(null);
  const [selectedUnitLabel, setSelectedUnitLabel] = useState('');
  const [description, setDescription] = useState('');

  const { data: unitResults } = useUnitSearch(unitQuery);

  const canSubmit =
    carrier.length > 0 &&
    recipientName.trim().length > 0 &&
    selectedUnitId !== null &&
    !logPackage.isPending;

  const handleSelectUnit = useCallback(
    (unit: { id: string; unit_number: string; building: string | null }) => {
      setSelectedUnitId(unit.id);
      setSelectedUnitLabel(
        `${unit.unit_number}${unit.building ? ` - ${unit.building}` : ''}`,
      );
      setUnitQuery('');
    },
    [],
  );

  const handleSubmit = async () => {
    if (!canSubmit || !selectedUnitId) return;

    try {
      await logPackage.mutateAsync({
        carrier: carrier.toLowerCase() as any,
        tracking_number: trackingNumber.trim() || undefined,
        recipient_unit_id: selectedUnitId,
        recipient_name: recipientName.trim(),
        description: description.trim() || undefined,
      });

      if (Platform.OS === 'web') {
        window.alert('The package has been registered successfully.');
        router.back();
      } else {
        Alert.alert('Package Logged', 'The package has been registered successfully.', [
          { text: 'OK', onPress: () => router.back() },
        ]);
      }
    } catch (error: any) {
      const msg = error?.message ?? 'Something went wrong. Please try again.';
      if (Platform.OS === 'web') {
        window.alert(msg);
      } else {
        Alert.alert('Error', msg);
      }
    }
  };

  return (
    <View style={styles.container}>
      <AmbientBackground />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="chevron-back" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Log Package</Text>
        <View style={styles.headerSpacer} />
      </View>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
      >
        <ScrollView
          style={styles.flex}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Carrier Selector */}
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>CARRIER</Text>
            <View style={styles.carrierGrid}>
              {CARRIERS.map((c) => {
                const active = carrier === c;
                return (
                  <TouchableOpacity
                    key={c}
                    style={[styles.carrierPill, active && styles.carrierPillActive]}
                    onPress={() => setCarrier(c)}
                  >
                    <Text
                      style={[styles.carrierText, active && styles.carrierTextActive]}
                    >
                      {c}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* Tracking Number */}
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>TRACKING NUMBER (OPTIONAL)</Text>
            <View style={styles.inputContainer}>
              <TextInput
                style={styles.input}
                value={trackingNumber}
                onChangeText={setTrackingNumber}
                placeholder="Enter tracking number"
                placeholderTextColor={colors.textDisabled}
                autoCapitalize="characters"
              />
            </View>
          </View>

          {/* Recipient Name */}
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>RECIPIENT NAME</Text>
            <View style={styles.inputContainer}>
              <Ionicons
                name="person-outline"
                size={20}
                color={colors.textCaption}
                style={styles.inputIcon}
              />
              <TextInput
                style={styles.input}
                value={recipientName}
                onChangeText={setRecipientName}
                placeholder="Name on the package"
                placeholderTextColor={colors.textDisabled}
              />
            </View>
          </View>

          {/* Unit Search */}
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>UNIT</Text>
            {selectedUnitId ? (
              <View style={styles.selectedUnitRow}>
                <View style={styles.selectedUnitBadge}>
                  <Ionicons name="home" size={16} color={colors.primary} />
                  <Text style={styles.selectedUnitText}>{selectedUnitLabel}</Text>
                </View>
                <TouchableOpacity
                  onPress={() => {
                    setSelectedUnitId(null);
                    setSelectedUnitLabel('');
                  }}
                >
                  <Ionicons name="close-circle" size={24} color={colors.textCaption} />
                </TouchableOpacity>
              </View>
            ) : (
              <>
                <View style={styles.inputContainer}>
                  <Ionicons
                    name="search-outline"
                    size={20}
                    color={colors.textCaption}
                    style={styles.inputIcon}
                  />
                  <TextInput
                    style={styles.input}
                    value={unitQuery}
                    onChangeText={setUnitQuery}
                    placeholder="Search by unit number..."
                    placeholderTextColor={colors.textDisabled}
                  />
                </View>
                {(unitResults ?? []).length > 0 && unitQuery.length > 0 && (
                  <View style={styles.unitResults}>
                    {(unitResults ?? []).slice(0, 5).map((unit: any) => (
                      <TouchableOpacity
                        key={unit.id}
                        style={styles.unitResultItem}
                        onPress={() => handleSelectUnit(unit)}
                      >
                        <Ionicons name="home-outline" size={16} color={colors.primary} />
                        <Text style={styles.unitResultText}>
                          {unit.unit_number}
                          {unit.building ? ` - ${unit.building}` : ''}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </>
            )}
          </View>

          {/* Description */}
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>DESCRIPTION (OPTIONAL)</Text>
            <View style={styles.textAreaContainer}>
              <TextInput
                style={styles.textArea}
                value={description}
                onChangeText={setDescription}
                placeholder="Package details, size, condition..."
                placeholderTextColor={colors.textDisabled}
                multiline
                textAlignVertical="top"
                maxLength={500}
              />
            </View>
          </View>

          {/* Submit */}
          <TouchableOpacity
            style={[styles.submitButton, !canSubmit && styles.submitButtonDisabled]}
            onPress={handleSubmit}
            disabled={!canSubmit}
          >
            {logPackage.isPending ? (
              <ActivityIndicator color={colors.textOnDark} />
            ) : (
              <Text style={styles.submitButtonText}>Log Package</Text>
            )}
          </TouchableOpacity>
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
  flex: {
    flex: 1,
  },
  header: {
    paddingTop: spacing.safeAreaTop,
    paddingHorizontal: spacing.pagePaddingX,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: spacing.xl,
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
    fontFamily: fonts.bold,
    fontSize: 20,
    color: colors.textPrimary,
    letterSpacing: -0.5,
  },
  headerSpacer: {
    width: 40,
  },
  scrollContent: {
    paddingHorizontal: spacing.pagePaddingX,
    paddingTop: spacing.xl,
    paddingBottom: spacing.bottomNavClearance + 16,
  },
  fieldGroup: {
    marginBottom: spacing['3xl'],
  },
  fieldLabel: {
    fontFamily: fonts.bold,
    fontSize: 10,
    color: colors.textCaption,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    marginLeft: 4,
    marginBottom: spacing.md,
  },
  carrierGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  carrierPill: {
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.lg,
    borderRadius: borderRadius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  carrierPillActive: {
    borderWidth: 2,
    borderColor: colors.primary,
    backgroundColor: colors.primaryLight,
  },
  carrierText: {
    fontFamily: fonts.bold,
    fontSize: 12,
    color: colors.textBody,
  },
  carrierTextActive: {
    color: colors.primary,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    height: spacing.inputHeight,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.borderMedium,
    paddingHorizontal: spacing.xl,
  },
  inputIcon: {
    marginRight: spacing.lg,
  },
  input: {
    flex: 1,
    fontFamily: fonts.medium,
    fontSize: 14,
    color: colors.textPrimary,
  },
  selectedUnitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: spacing.inputHeight,
    backgroundColor: colors.primaryLight,
    borderRadius: borderRadius.lg,
    borderWidth: 2,
    borderColor: colors.primary,
    paddingHorizontal: spacing.xl,
  },
  selectedUnitBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  selectedUnitText: {
    fontFamily: fonts.bold,
    fontSize: 14,
    color: colors.primary,
  },
  unitResults: {
    marginTop: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.borderMedium,
    overflow: 'hidden',
  },
  unitResultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.xl,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  unitResultText: {
    fontFamily: fonts.medium,
    fontSize: 14,
    color: colors.textPrimary,
  },
  textAreaContainer: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.borderMedium,
    padding: spacing.xl,
    minHeight: 100,
  },
  textArea: {
    fontFamily: fonts.medium,
    fontSize: 14,
    color: colors.textPrimary,
    minHeight: 80,
  },
  submitButton: {
    height: spacing.buttonHeight,
    borderRadius: borderRadius.lg,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.blueGlow,
  },
  submitButtonDisabled: {
    backgroundColor: colors.textDisabled,
    shadowOpacity: 0,
    elevation: 0,
  },
  submitButtonText: {
    fontFamily: fonts.bold,
    fontSize: 16,
    color: colors.textOnDark,
  },
});
