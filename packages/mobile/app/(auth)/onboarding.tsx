import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { AmbientBackground } from '@/components/ui/AmbientBackground';
import { GlassCard } from '@/components/ui/GlassCard';
import { colors, fonts, spacing, borderRadius, shadows } from '@/theme';

const COMMUNITY_TYPES = [
  'Residential Complex',
  'Gated Community',
  'Private Club',
  'Corporate Office',
];

export default function OnboardingScreen() {
  const router = useRouter();
  const { refreshSession } = useAuth();
  const [communityName, setCommunityName] = useState('');
  const [address, setAddress] = useState('');
  const [communityType, setCommunityType] = useState(COMMUNITY_TYPES[0]);
  const [showTypePicker, setShowTypePicker] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleComplete = async () => {
    if (!communityName) {
      Alert.alert('Error', 'Please enter a community name.');
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.rpc('complete_admin_onboarding', {
        p_community_name: communityName,
        p_org_name: communityName,
        p_community_address: address || undefined,
      });
      if (error) throw error;
      await refreshSession();
      router.replace('/');
    } catch (err: any) {
      Alert.alert('Setup Failed', err.message ?? 'Something went wrong.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <AmbientBackground />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.flex}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Header */}
          <View style={styles.headerRow}>
            <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
              <Ionicons name="chevron-back" size={20} color={colors.textBody} />
            </TouchableOpacity>
            {/* Step Dots */}
            <View style={styles.dotsRow}>
              <View style={[styles.dot, styles.dotActive]} />
              <View style={styles.dot} />
              <View style={styles.dot} />
            </View>
            <View style={styles.spacer} />
          </View>

          {/* Content */}
          <View style={styles.content}>
            <View style={styles.iconBox}>
              <Ionicons name="business-outline" size={24} color={colors.warningText} />
            </View>
            <Text style={styles.title}>Setup Organization</Text>
            <Text style={styles.subtitle}>Tell us about the community you manage.</Text>
          </View>

          {/* Form */}
          <View style={styles.form}>
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>COMMUNITY NAME</Text>
              <View style={styles.inputRow}>
                <TextInput
                  style={styles.input}
                  placeholder="e.g. The Highland Towers"
                  placeholderTextColor={colors.textDisabled}
                  value={communityName}
                  onChangeText={setCommunityName}
                />
              </View>
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.label}>ADDRESS / LOCATION</Text>
              <View style={styles.inputRow}>
                <Ionicons name="location-outline" size={20} color={colors.textCaption} style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="Search address..."
                  placeholderTextColor={colors.textDisabled}
                  value={address}
                  onChangeText={setAddress}
                />
              </View>
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.label}>COMMUNITY TYPE</Text>
              <TouchableOpacity
                style={styles.inputRow}
                onPress={() => setShowTypePicker(!showTypePicker)}
              >
                <Text style={styles.selectText}>{communityType}</Text>
                <Ionicons name="chevron-down" size={20} color={colors.textCaption} />
              </TouchableOpacity>
              {showTypePicker && (
                <View style={styles.picker}>
                  {COMMUNITY_TYPES.map((type) => (
                    <TouchableOpacity
                      key={type}
                      style={[
                        styles.pickerItem,
                        communityType === type && styles.pickerItemActive,
                      ]}
                      onPress={() => {
                        setCommunityType(type);
                        setShowTypePicker(false);
                      }}
                    >
                      <Text
                        style={[
                          styles.pickerItemText,
                          communityType === type && styles.pickerItemTextActive,
                        ]}
                      >
                        {type}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>

            {/* Info Card */}
            <GlassCard style={styles.infoCard}>
              <View style={styles.infoRow}>
                <View style={styles.infoIcon}>
                  <Ionicons name="sparkles-outline" size={18} color={colors.primary} />
                </View>
                <View style={styles.flex}>
                  <Text style={styles.infoTitle}>Auto-Configuration</Text>
                  <Text style={styles.infoText}>
                    We'll automatically set up visitor rules and amenity presets based on your selection.
                  </Text>
                </View>
              </View>
            </GlassCard>

            {/* Submit */}
            <TouchableOpacity
              style={styles.submitButton}
              onPress={handleComplete}
              activeOpacity={0.9}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color={colors.textOnDark} />
              ) : (
                <Text style={styles.submitButtonText}>Complete Setup</Text>
              )}
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
  flex: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: spacing.pagePaddingX,
    paddingTop: spacing.safeAreaTop,
    paddingBottom: spacing.safeAreaBottom,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing['4xl'],
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
  dotsRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.textDisabled,
  },
  dotActive: {
    backgroundColor: colors.primary,
  },
  spacer: {
    width: 40,
  },
  content: {
    marginBottom: spacing['4xl'],
  },
  iconBox: {
    width: 48,
    height: 48,
    borderRadius: borderRadius.md,
    backgroundColor: colors.warningBg,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xl,
  },
  title: {
    fontFamily: fonts.bold,
    fontSize: 30,
    color: colors.textPrimary,
    marginBottom: spacing.md,
  },
  subtitle: {
    fontFamily: fonts.medium,
    fontSize: 16,
    color: colors.textMuted,
  },
  form: {
    gap: spacing['3xl'],
  },
  fieldGroup: {
    gap: spacing.xs,
  },
  label: {
    fontFamily: fonts.bold,
    fontSize: 12,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginLeft: 4,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
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
  selectText: {
    flex: 1,
    fontFamily: fonts.medium,
    fontSize: 16,
    color: colors.textPrimary,
  },
  picker: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.borderMedium,
    overflow: 'hidden',
    marginTop: spacing.xs,
  },
  pickerItem: {
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.lg,
  },
  pickerItemActive: {
    backgroundColor: colors.primaryLight,
  },
  pickerItemText: {
    fontFamily: fonts.medium,
    fontSize: 16,
    color: colors.textPrimary,
  },
  pickerItemTextActive: {
    color: colors.primary,
    fontFamily: fonts.bold,
  },
  infoCard: {
    padding: spacing.xl,
    borderRadius: borderRadius.lg,
  },
  infoRow: {
    flexDirection: 'row',
    gap: spacing.xl,
    alignItems: 'flex-start',
  },
  infoIcon: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.full,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoTitle: {
    fontFamily: fonts.bold,
    fontSize: 14,
    color: colors.textPrimary,
  },
  infoText: {
    fontFamily: fonts.medium,
    fontSize: 12,
    color: colors.textMuted,
    lineHeight: 18,
    marginTop: 4,
  },
  submitButton: {
    height: spacing.buttonHeight,
    backgroundColor: colors.dark,
    borderRadius: borderRadius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.xl,
  },
  submitButtonText: {
    fontFamily: fonts.bold,
    fontSize: 18,
    color: colors.textOnDark,
  },
});
