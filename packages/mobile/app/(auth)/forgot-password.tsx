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
import { AmbientBackground } from '@/components/ui/AmbientBackground';
import { colors, fonts, spacing, borderRadius, shadows } from '@/theme';

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSend = async () => {
    if (!email) {
      Alert.alert('Error', 'Please enter your email address.');
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email);
    setLoading(false);
    if (error) {
      Alert.alert('Error', error.message);
    } else {
      setSent(true);
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
          {/* Back Button */}
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Ionicons name="chevron-back" size={20} color={colors.textBody} />
          </TouchableOpacity>

          {sent ? (
            /* Success View */
            <View style={styles.successContainer}>
              <View style={styles.successIconContainer}>
                <View style={styles.successIconGlow} />
                <View style={styles.successIcon}>
                  <Ionicons name="checkmark-circle" size={48} color={colors.textOnDark} />
                </View>
              </View>
              <Text style={styles.successTitle}>Check Your Email</Text>
              <Text style={styles.successSubtitle}>
                We've sent a password recovery link to {email}. Check your inbox and follow the instructions.
              </Text>
              <TouchableOpacity
                style={styles.darkButton}
                onPress={() => router.replace('/(auth)/sign-in')}
              >
                <Text style={styles.darkButtonText}>Back to Sign In</Text>
              </TouchableOpacity>
            </View>
          ) : (
            /* Form View */
            <>
              <View style={styles.header}>
                <LinearGradient
                  colors={[colors.gradientStart, colors.gradientEnd]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.headerIcon}
                >
                  <Ionicons name="key-outline" size={24} color={colors.textOnDark} />
                </LinearGradient>
                <Text style={styles.title}>Reset Password</Text>
                <Text style={styles.subtitle}>
                  Enter the email address associated with your account and we'll send you a link to reset your password.
                </Text>
              </View>

              <View style={styles.form}>
                <View style={styles.fieldGroup}>
                  <Text style={styles.label}>EMAIL ADDRESS</Text>
                  <View style={styles.inputRow}>
                    <Ionicons name="mail-outline" size={20} color={colors.textCaption} style={styles.inputIcon} />
                    <TextInput
                      style={styles.input}
                      placeholder="jane@example.com"
                      placeholderTextColor={colors.textDisabled}
                      keyboardType="email-address"
                      autoCapitalize="none"
                      value={email}
                      onChangeText={setEmail}
                    />
                  </View>
                </View>

                <TouchableOpacity
                  style={styles.darkButton}
                  onPress={handleSend}
                  activeOpacity={0.9}
                  disabled={loading}
                >
                  {loading ? (
                    <ActivityIndicator color={colors.textOnDark} />
                  ) : (
                    <>
                      <Text style={styles.darkButtonText}>Send Recovery Link</Text>
                      <Ionicons name="send-outline" size={20} color={colors.textOnDark} style={{ opacity: 0.8 }} />
                    </>
                  )}
                </TouchableOpacity>
              </View>

              {/* Alternative Methods */}
              <View style={styles.altSection}>
                <View style={styles.dividerContainer}>
                  <View style={styles.dividerLine} />
                  <Text style={styles.dividerText}>OTHER METHODS</Text>
                  <View style={styles.dividerLine} />
                </View>

                <TouchableOpacity style={styles.altButton}>
                  <View style={[styles.altIconBox, { backgroundColor: colors.primaryLight }]}>
                    <Ionicons name="phone-portrait-outline" size={18} color={colors.primary} />
                  </View>
                  <View style={styles.flex}>
                    <Text style={styles.altTitle}>Verification via OTP</Text>
                    <Text style={styles.altSubtitle}>PHONE NUMBER</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color={colors.textDisabled} />
                </TouchableOpacity>

                <TouchableOpacity style={styles.altButton}>
                  <View style={[styles.altIconBox, { backgroundColor: colors.tealLight }]}>
                    <Ionicons name="shield-outline" size={18} color={colors.teal} />
                  </View>
                  <View style={styles.flex}>
                    <Text style={styles.altTitle}>Security Questions</Text>
                    <Text style={styles.altSubtitle}>SECRET ANSWERS</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color={colors.textDisabled} />
                </TouchableOpacity>
              </View>

              {/* Footer */}
              <View style={styles.footer}>
                <Text style={styles.footerText}>
                  Still having trouble?{' '}
                  <Text style={styles.footerLink}>Contact Support</Text>
                </Text>
              </View>
            </>
          )}
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
  backButton: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.full,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderMedium,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing['5xl'],
    ...shadows.sm,
  },
  header: {
    marginBottom: spacing['5xl'],
  },
  headerIcon: {
    width: 56,
    height: 56,
    borderRadius: borderRadius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing['3xl'],
    ...shadows.blueGlow,
  },
  title: {
    fontFamily: fonts.bold,
    fontSize: 30,
    color: colors.textPrimary,
    letterSpacing: -0.5,
    marginBottom: spacing.lg,
  },
  subtitle: {
    fontFamily: fonts.medium,
    fontSize: 16,
    color: colors.textMuted,
    lineHeight: 24,
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
  darkButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    height: spacing.buttonHeight,
    backgroundColor: colors.dark,
    borderRadius: borderRadius.lg,
    ...shadows.xl,
  },
  darkButtonText: {
    fontFamily: fonts.bold,
    fontSize: 18,
    color: colors.textOnDark,
  },
  altSection: {
    marginTop: spacing['6xl'],
    gap: spacing.lg,
  },
  dividerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.xl,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.borderMedium,
  },
  dividerText: {
    fontFamily: fonts.bold,
    fontSize: 12,
    color: colors.textCaption,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    paddingHorizontal: spacing.xl,
  },
  altButton: {
    height: spacing.inputHeight,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderMedium,
    borderRadius: borderRadius.lg,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    gap: spacing.xl,
  },
  altIconBox: {
    width: 32,
    height: 32,
    borderRadius: borderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  altTitle: {
    fontFamily: fonts.bold,
    fontSize: 14,
    color: colors.textSecondary,
  },
  altSubtitle: {
    fontFamily: fonts.bold,
    fontSize: 10,
    color: colors.textCaption,
    textTransform: 'uppercase',
  },
  footer: {
    marginTop: 'auto',
    paddingTop: spacing['3xl'],
    alignItems: 'center',
  },
  footerText: {
    fontFamily: fonts.medium,
    fontSize: 14,
    color: colors.textMuted,
  },
  footerLink: {
    fontFamily: fonts.bold,
    color: colors.primary,
  },
  // Success view
  successContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: 80,
  },
  successIconContainer: {
    marginBottom: spacing['4xl'],
    position: 'relative',
  },
  successIconGlow: {
    position: 'absolute',
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: 'rgba(20, 184, 166, 0.2)',
  },
  successIcon: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: colors.teal,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.lg,
  },
  successTitle: {
    fontFamily: fonts.bold,
    fontSize: 30,
    color: colors.textPrimary,
    marginBottom: spacing.xl,
  },
  successSubtitle: {
    fontFamily: fonts.medium,
    fontSize: 16,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 24,
    paddingHorizontal: spacing.xl,
    marginBottom: spacing['5xl'],
  },
});
