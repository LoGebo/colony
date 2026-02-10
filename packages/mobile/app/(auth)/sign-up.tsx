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
import { supabase } from '@/lib/supabase';
import { AmbientBackground } from '@/components/ui/AmbientBackground';
import { colors, fonts, spacing, borderRadius, shadows } from '@/theme';

type RoleOption = 'admin' | 'resident';

export default function SignUpScreen() {
  const router = useRouter();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [selectedRole, setSelectedRole] = useState<RoleOption>('resident');
  const [loading, setLoading] = useState(false);

  const passwordStrength = (() => {
    if (password.length === 0) return 0;
    let s = 0;
    if (password.length >= 6) s++;
    if (password.length >= 8) s++;
    if (/[A-Z]/.test(password) && /[a-z]/.test(password)) s++;
    if (/[0-9!@#$%^&*]/.test(password)) s++;
    return s;
  })();

  const strengthLabel = ['', 'Weak', 'Fair', 'Strong', 'Very Strong'][passwordStrength] ?? '';

  const handleSignUp = async () => {
    if (!firstName || !email || !password) {
      Alert.alert('Error', 'Please fill in all required fields.');
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          first_name: firstName,
          last_name: lastName,
          signup_role: selectedRole === 'admin' ? 'community_admin' : 'resident',
        },
      },
    });
    setLoading(false);
    if (error) {
      Alert.alert('Sign Up Failed', error.message);
    } else {
      router.replace('/');
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

          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>Create Account</Text>
            <Text style={styles.subtitle}>Join your exclusive community network.</Text>
          </View>

          {/* Form */}
          <View style={styles.form}>
            {/* Name Row */}
            <View style={styles.nameRow}>
              <View style={[styles.fieldGroup, styles.flex]}>
                <Text style={styles.label}>FIRST NAME</Text>
                <View style={styles.inputRow}>
                  <TextInput
                    style={styles.input}
                    placeholder="Jane"
                    placeholderTextColor={colors.textDisabled}
                    value={firstName}
                    onChangeText={setFirstName}
                  />
                </View>
              </View>
              <View style={[styles.fieldGroup, styles.flex]}>
                <Text style={styles.label}>LAST NAME</Text>
                <View style={styles.inputRow}>
                  <TextInput
                    style={styles.input}
                    placeholder="Doe"
                    placeholderTextColor={colors.textDisabled}
                    value={lastName}
                    onChangeText={setLastName}
                  />
                </View>
              </View>
            </View>

            {/* Email */}
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

            {/* Password */}
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>CREATE PASSWORD</Text>
              <View style={styles.inputRow}>
                <Ionicons name="lock-closed-outline" size={20} color={colors.textCaption} style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="••••••••"
                  placeholderTextColor={colors.textDisabled}
                  secureTextEntry
                  value={password}
                  onChangeText={setPassword}
                />
              </View>
              {password.length > 0 && (
                <>
                  <View style={styles.strengthRow}>
                    {[1, 2, 3, 4].map((i) => (
                      <View
                        key={i}
                        style={[
                          styles.strengthBar,
                          { backgroundColor: i <= passwordStrength ? colors.success : colors.borderMedium },
                        ]}
                      />
                    ))}
                  </View>
                  <Text style={styles.strengthLabel}>{strengthLabel} password</Text>
                </>
              )}
            </View>

            {/* Role Selector */}
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>I AM A...</Text>
              <View style={styles.roleRow}>
                <TouchableOpacity
                  style={[styles.roleCard, selectedRole === 'admin' && styles.roleCardActive]}
                  onPress={() => setSelectedRole('admin')}
                >
                  <Ionicons
                    name="shield-checkmark-outline"
                    size={24}
                    color={selectedRole === 'admin' ? colors.primary : colors.textCaption}
                  />
                  <Text style={[styles.roleLabel, selectedRole === 'admin' && styles.roleLabelActive]}>
                    Admin
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.roleCard, selectedRole === 'resident' && styles.roleCardActive]}
                  onPress={() => setSelectedRole('resident')}
                >
                  <Ionicons
                    name="home-outline"
                    size={24}
                    color={selectedRole === 'resident' ? colors.primary : colors.textCaption}
                  />
                  <Text style={[styles.roleLabel, selectedRole === 'resident' && styles.roleLabelActive]}>
                    Resident
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Submit */}
            <TouchableOpacity
              style={styles.submitButton}
              onPress={handleSignUp}
              activeOpacity={0.9}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color={colors.textOnDark} />
              ) : (
                <Text style={styles.submitButtonText}>Continue</Text>
              )}
            </TouchableOpacity>
          </View>

          {/* Footer */}
          <View style={styles.footer}>
            <Text style={styles.footerText}>
              By joining, you agree to our{' '}
              <Text style={styles.footerLink}>Terms of Service</Text> and{' '}
              <Text style={styles.footerLink}>Privacy Policy</Text>.
            </Text>
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
  backButton: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.full,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderMedium,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing['4xl'],
    ...shadows.sm,
  },
  header: {
    marginBottom: spacing['4xl'],
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
    gap: spacing.xl,
  },
  nameRow: {
    flexDirection: 'row',
    gap: spacing.xl,
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
  strengthRow: {
    flexDirection: 'row',
    gap: 4,
    marginTop: spacing.md,
    paddingHorizontal: 4,
  },
  strengthBar: {
    flex: 1,
    height: 4,
    borderRadius: 2,
  },
  strengthLabel: {
    fontFamily: fonts.medium,
    fontSize: 12,
    color: colors.textCaption,
    paddingHorizontal: 4,
    marginTop: 4,
  },
  roleRow: {
    flexDirection: 'row',
    gap: spacing.lg,
    marginTop: spacing.md,
  },
  roleCard: {
    flex: 1,
    height: 96,
    backgroundColor: colors.surface,
    borderWidth: 2,
    borderColor: colors.borderMedium,
    borderRadius: borderRadius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
  },
  roleCardActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryLight,
  },
  roleLabel: {
    fontFamily: fonts.bold,
    fontSize: 14,
    color: colors.textCaption,
  },
  roleLabelActive: {
    color: colors.primary,
  },
  submitButton: {
    height: spacing.buttonHeight,
    backgroundColor: colors.primary,
    borderRadius: borderRadius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing['3xl'],
    ...shadows.blueGlow,
  },
  submitButtonText: {
    fontFamily: fonts.bold,
    fontSize: 18,
    color: colors.textOnDark,
  },
  footer: {
    marginTop: spacing['3xl'],
    paddingBottom: spacing.md,
    alignItems: 'center',
  },
  footerText: {
    fontFamily: fonts.medium,
    fontSize: 12,
    color: colors.textCaption,
    textAlign: 'center',
    paddingHorizontal: spacing['4xl'],
  },
  footerLink: {
    color: colors.primary,
    textDecorationLine: 'underline',
  },
});
