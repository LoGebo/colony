import { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Alert,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import { AmbientBackground } from '@/components/ui/AmbientBackground';
import { colors, fonts, spacing, borderRadius, shadows } from '@/theme';

export default function GuardSettingsScreen() {
  const router = useRouter();
  const { signOut, user } = useAuth();
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);

  const firstName = user?.user_metadata?.first_name ?? 'Guard';
  const lastName = user?.user_metadata?.last_name ?? '';
  const email = user?.email ?? '';

  const confirmSignOut = () => {
    if (Platform.OS === 'web') {
      if (window.confirm('Are you sure you want to sign out?')) signOut();
    } else {
      Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Sign Out', style: 'destructive', onPress: () => signOut() },
      ]);
    }
  };

  const confirmDeleteAccount = () => {
    if (Platform.OS === 'web') {
      if (
        window.confirm(
          'This will permanently delete your account and all associated data. This action cannot be undone. Are you sure?',
        )
      ) {
        deleteAccount();
      }
    } else {
      Alert.alert(
        'Delete Account',
        'This will permanently delete your account and all associated data. This action cannot be undone.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Delete My Account',
            style: 'destructive',
            onPress: () => {
              Alert.alert(
                'Are you absolutely sure?',
                'You will lose access to your guard account and all personal data.',
                [
                  { text: 'Keep Account', style: 'cancel' },
                  { text: 'Yes, Delete', style: 'destructive', onPress: deleteAccount },
                ],
              );
            },
          },
        ],
      );
    }
  };

  const deleteAccount = async () => {
    setIsDeletingAccount(true);
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase.rpc as any)('delete_own_account');
      if (error) throw error;
      await signOut();
    } catch (err: any) {
      const message =
        err?.message ?? 'Something went wrong. Please try again or contact support.';
      if (Platform.OS === 'web') {
        window.alert(message);
      } else {
        Alert.alert('Error', message);
      }
    } finally {
      setIsDeletingAccount(false);
    }
  };

  return (
    <View style={styles.container}>
      <AmbientBackground />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={20} color={colors.textBody} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Settings</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Profile Card */}
        <View style={styles.profileCard}>
          <View style={styles.profileAvatar}>
            <Ionicons name="shield" size={24} color={colors.primary} />
          </View>
          <View style={styles.profileInfo}>
            <Text style={styles.profileName}>
              {firstName} {lastName}
            </Text>
            <Text style={styles.profileRole}>Guard</Text>
            {email ? <Text style={styles.profileEmail}>{email}</Text> : null}
          </View>
        </View>

        {/* Sign Out Button */}
        <TouchableOpacity
          style={styles.signOutButton}
          onPress={confirmSignOut}
          activeOpacity={0.7}
        >
          <Ionicons name="log-out-outline" size={20} color={colors.danger} />
          <Text style={styles.signOutText}>Log Out</Text>
        </TouchableOpacity>

        {/* Delete Account */}
        <TouchableOpacity
          style={styles.deleteAccountButton}
          onPress={confirmDeleteAccount}
          disabled={isDeletingAccount}
          activeOpacity={0.7}
        >
          <Text style={styles.deleteAccountText}>
            {isDeletingAccount ? 'Deleting...' : 'Delete Account'}
          </Text>
        </TouchableOpacity>

        {/* Version */}
        <Text style={styles.versionText}>Colony v1.0.0</Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
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

  // Scroll
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: spacing.pagePaddingX,
    paddingTop: spacing['3xl'],
    paddingBottom: spacing.bottomNavClearance,
  },

  // Profile Card
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: borderRadius['2xl'],
    padding: spacing.cardPadding,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing['4xl'],
    ...shadows.sm,
  },
  profileAvatar: {
    width: 56,
    height: 56,
    borderRadius: borderRadius.full,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileInfo: {
    flex: 1,
    marginLeft: spacing.xl,
  },
  profileName: {
    fontFamily: fonts.bold,
    fontSize: 18,
    color: colors.textPrimary,
  },
  profileRole: {
    fontFamily: fonts.bold,
    fontSize: 12,
    color: colors.primary,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginTop: 2,
  },
  profileEmail: {
    fontFamily: fonts.medium,
    fontSize: 13,
    color: colors.textMuted,
    marginTop: 2,
  },

  // Sign Out
  signOutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    height: 56,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.xl,
    borderWidth: 1,
    borderColor: colors.dangerBgLight,
    marginTop: spacing.xl,
    ...shadows.sm,
  },
  signOutText: {
    fontFamily: fonts.bold,
    fontSize: 15,
    color: colors.danger,
  },

  // Delete Account
  deleteAccountButton: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xl,
    marginTop: spacing.lg,
  },
  deleteAccountText: {
    fontFamily: fonts.medium,
    fontSize: 13,
    color: colors.textCaption,
    textDecorationLine: 'underline',
  },

  // Version
  versionText: {
    textAlign: 'center',
    fontFamily: fonts.bold,
    fontSize: 10,
    color: colors.textDisabled,
    textTransform: 'uppercase',
    letterSpacing: 2,
    marginTop: spacing.md,
    marginBottom: spacing['4xl'],
  },
});
