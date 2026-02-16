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
import { useCreatePet } from '@/hooks/usePets';
import { AmbientBackground } from '@/components/ui/AmbientBackground';
import { colors, fonts, spacing, borderRadius, shadows } from '@/theme';

type Species = 'dog' | 'cat' | 'bird' | 'fish' | 'reptile' | 'rodent' | 'other';

const SPECIES_OPTIONS: { value: Species; label: string; icon: string }[] = [
  { value: 'dog', label: 'Dog', icon: 'paw' },
  { value: 'cat', label: 'Cat', icon: 'paw' },
  { value: 'bird', label: 'Bird', icon: 'leaf' },
  { value: 'fish', label: 'Fish', icon: 'water' },
  { value: 'reptile', label: 'Reptile', icon: 'bug' },
  { value: 'rodent', label: 'Rodent', icon: 'ellipse' },
  { value: 'other', label: 'Other', icon: 'help-circle' },
];

export default function CreatePetScreen() {
  const router = useRouter();
  const createMutation = useCreatePet();

  const [name, setName] = useState('');
  const [species, setSpecies] = useState<Species | null>(null);
  const [breed, setBreed] = useState('');
  const [petColor, setPetColor] = useState('');
  const [weight, setWeight] = useState('');
  const [isServiceAnimal, setIsServiceAnimal] = useState(false);
  const [specialNeeds, setSpecialNeeds] = useState('');

  const isValid = name.trim().length > 0 && species !== null;

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
    if (!name.trim()) {
      showAlert('Required', 'Please enter the pet name.');
      return;
    }
    if (!species) {
      showAlert('Required', 'Please select the species.');
      return;
    }

    const weightNum = weight.trim() ? parseFloat(weight.trim()) : undefined;
    if (weight.trim() && (isNaN(weightNum!) || weightNum! <= 0)) {
      showAlert('Invalid', 'Please enter a valid weight.');
      return;
    }

    try {
      await createMutation.mutateAsync({
        name: name.trim(),
        species,
        breed: breed.trim() || undefined,
        color: petColor.trim() || undefined,
        weight_kg: weightNum,
        is_service_animal: isServiceAnimal,
        special_needs: specialNeeds.trim() || undefined,
      });

      showAlert('Success', 'Pet registered successfully.', () => router.back());
    } catch (err: any) {
      showAlert('Error', err?.message ?? 'Failed to register pet.');
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
          <Text style={styles.headerTitle}>New Pet</Text>
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
          {/* Pet Name */}
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Pet Name *</Text>
            <View style={styles.inputWrapper}>
              <TextInput
                style={styles.inputBold}
                value={name}
                onChangeText={setName}
                placeholder="e.g. Max, Luna"
                placeholderTextColor={colors.textDisabled}
                autoCapitalize="words"
              />
            </View>
          </View>

          {/* Species Selector */}
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Species *</Text>
            <View style={styles.speciesGrid}>
              {SPECIES_OPTIONS.map((opt) => (
                <TouchableOpacity
                  key={opt.value}
                  style={[
                    styles.speciesOption,
                    species === opt.value && styles.speciesOptionActive,
                  ]}
                  onPress={() => setSpecies(opt.value)}
                  activeOpacity={0.7}
                >
                  <Ionicons
                    name={opt.icon as any}
                    size={18}
                    color={species === opt.value ? colors.primary : colors.textMuted}
                  />
                  <Text
                    style={[
                      styles.speciesOptionText,
                      species === opt.value && styles.speciesOptionTextActive,
                    ]}
                  >
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Breed & Color */}
          <View style={styles.twoColRow}>
            <View style={styles.fieldGroupFlex}>
              <Text style={styles.fieldLabel}>Breed</Text>
              <View style={styles.inputWrapper}>
                <TextInput
                  style={styles.inputBold}
                  value={breed}
                  onChangeText={setBreed}
                  placeholder="e.g. Labrador"
                  placeholderTextColor={colors.textDisabled}
                  autoCapitalize="words"
                />
              </View>
            </View>
            <View style={styles.fieldGroupFlex}>
              <Text style={styles.fieldLabel}>Color</Text>
              <View style={styles.inputWrapper}>
                <TextInput
                  style={styles.inputBold}
                  value={petColor}
                  onChangeText={setPetColor}
                  placeholder="e.g. Golden"
                  placeholderTextColor={colors.textDisabled}
                  autoCapitalize="words"
                />
              </View>
            </View>
          </View>

          {/* Weight */}
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Weight (kg)</Text>
            <View style={styles.inputWrapper}>
              <TextInput
                style={styles.inputBold}
                value={weight}
                onChangeText={setWeight}
                placeholder="e.g. 12.5"
                placeholderTextColor={colors.textDisabled}
                keyboardType="decimal-pad"
              />
            </View>
          </View>

          {/* Service Animal Toggle */}
          <TouchableOpacity
            style={styles.toggleRow}
            onPress={() => setIsServiceAnimal(!isServiceAnimal)}
            activeOpacity={0.7}
          >
            <View style={styles.toggleInfo}>
              <Ionicons name="shield-checkmark-outline" size={20} color={colors.primary} />
              <View>
                <Text style={styles.toggleLabel}>Service Animal</Text>
                <Text style={styles.toggleDescription}>Mark if this is a certified service animal</Text>
              </View>
            </View>
            <View style={[styles.toggleSwitch, isServiceAnimal && styles.toggleSwitchActive]}>
              <View style={[styles.toggleKnob, isServiceAnimal && styles.toggleKnobActive]} />
            </View>
          </TouchableOpacity>

          {/* Special Needs */}
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Special Needs / Notes</Text>
            <View style={[styles.inputWrapper, styles.textareaWrapper]}>
              <TextInput
                style={[styles.inputBold, styles.textarea]}
                value={specialNeeds}
                onChangeText={setSpecialNeeds}
                placeholder="Allergies, medications, special care instructions..."
                placeholderTextColor={colors.textDisabled}
                multiline
                numberOfLines={3}
                textAlignVertical="top"
              />
            </View>
          </View>
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
            <Text style={styles.submitButtonText}>Register Pet</Text>
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
  textareaWrapper: {
    height: 100,
    paddingVertical: spacing.lg,
  },
  inputBold: {
    fontFamily: fonts.bold,
    fontSize: 15,
    color: colors.textPrimary,
  },
  textarea: {
    height: '100%',
    fontFamily: fonts.medium,
    fontSize: 14,
  },

  // Species Grid
  speciesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  speciesOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.lg,
    borderRadius: borderRadius.lg,
    backgroundColor: colors.border,
    borderWidth: 1,
    borderColor: colors.borderMedium,
  },
  speciesOptionActive: {
    backgroundColor: colors.primaryLight,
    borderColor: colors.primary,
  },
  speciesOptionText: {
    fontFamily: fonts.bold,
    fontSize: 13,
    color: colors.textMuted,
  },
  speciesOptionTextActive: {
    color: colors.primary,
  },

  // Toggle
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.xl,
  },
  toggleInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
    flex: 1,
  },
  toggleLabel: {
    fontFamily: fonts.bold,
    fontSize: 14,
    color: colors.textPrimary,
  },
  toggleDescription: {
    fontFamily: fonts.medium,
    fontSize: 12,
    color: colors.textMuted,
  },
  toggleSwitch: {
    width: 44,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.borderMedium,
    justifyContent: 'center',
    paddingHorizontal: 2,
  },
  toggleSwitchActive: {
    backgroundColor: colors.primary,
  },
  toggleKnob: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.surface,
  },
  toggleKnobActive: {
    alignSelf: 'flex-end',
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
