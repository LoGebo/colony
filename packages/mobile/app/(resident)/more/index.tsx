import { View, Text, TouchableOpacity, ScrollView, StyleSheet, Alert, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useResidentUnit } from '@/hooks/useOccupancy';
import { AmbientBackground } from '@/components/ui/AmbientBackground';
import { supabase } from '@/lib/supabase';
import { colors, fonts, spacing, borderRadius, shadows } from '@/theme';

// ── Section types ──────────────────────────────────────────────
interface MenuItem {
  label: string;
  subtitle: string;
  icon: keyof typeof Ionicons.glyphMap;
  iconBg: string;
  iconColor: string;
  route: string;
}

interface MenuSection {
  title: string;
  items: MenuItem[];
}

// ── Menu configuration ─────────────────────────────────────────
const sections: MenuSection[] = [
  {
    title: 'MY STUFF',
    items: [
      { label: 'Vehicles', subtitle: 'Manage your vehicles', icon: 'car-outline', iconBg: colors.indigoBg, iconColor: colors.indigo, route: '/(resident)/more/vehicles' },
      { label: 'Pets', subtitle: 'Registered pets', icon: 'paw-outline', iconBg: colors.orangeBg, iconColor: colors.orange, route: '/(resident)/more/pets' },
      { label: 'Documents', subtitle: 'Files & signatures', icon: 'document-text-outline', iconBg: colors.primaryLightAlt, iconColor: colors.primary, route: '/(resident)/more/documents' },
    ],
  },
  {
    title: 'SERVICES',
    items: [
      { label: 'Marketplace', subtitle: 'Buy & sell items', icon: 'bag-handle-outline', iconBg: colors.warningBgLight, iconColor: colors.warningText, route: '/(resident)/more/marketplace' },
      { label: 'Packages', subtitle: 'Delivery tracking', icon: 'cube-outline', iconBg: colors.tealLight, iconColor: colors.tealDark, route: '/(resident)/more/packages' },
    ],
  },
  {
    title: 'PREFERENCES',
    items: [
      { label: 'Notifications', subtitle: 'Alert preferences', icon: 'notifications-outline', iconBg: colors.dangerBgLight, iconColor: colors.danger, route: '/(resident)/more/notification-settings' },
    ],
  },
];

// ── Component ──────────────────────────────────────────────────
export default function MoreIndexScreen() {
  const router = useRouter();
  const { signOut, user } = useAuth();
  const { unitNumber } = useResidentUnit();
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);

  const firstName = user?.user_metadata?.first_name ?? 'Resident';
  const lastName = user?.user_metadata?.last_name ?? '';

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
      if (window.confirm('This will permanently delete your account and all associated data. This action cannot be undone. Are you sure?')) {
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
              // Double-confirm for destructive action
              Alert.alert(
                'Are you absolutely sure?',
                'You will lose access to your community, payment history, and all personal data.',
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
      // Call the edge function / RPC that handles account deletion server-side
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase.rpc as any)('delete_own_account');
      if (error) throw error;
      await signOut();
    } catch (err: any) {
      const message = err?.message ?? 'Something went wrong. Please try again or contact support.';
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

      <View style={styles.header}>
        <Text style={styles.headerTitle}>Profile</Text>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Profile Card */}
        <TouchableOpacity
          style={styles.profileCard}
          onPress={() => router.push('/(resident)/more/profile')}
          activeOpacity={0.7}
        >
          <View style={styles.profileAvatar}>
            <Ionicons name="person" size={24} color={colors.textCaption} />
          </View>
          <View style={styles.profileInfo}>
            <Text style={styles.profileName}>{firstName} {lastName}</Text>
            <Text style={styles.profileUnit}>{unitNumber ? `Unit ${unitNumber}` : 'Loading...'}</Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color={colors.textDisabled} />
        </TouchableOpacity>

        {/* Grouped Menu Sections */}
        {sections.map((section) => (
          <View key={section.title} style={styles.section}>
            <Text style={styles.sectionTitle}>{section.title}</Text>
            <View style={styles.sectionCard}>
              {section.items.map((item, idx) => (
                <TouchableOpacity
                  key={item.route}
                  style={[
                    styles.menuItem,
                    idx < section.items.length - 1 && styles.menuItemBorder,
                  ]}
                  onPress={() => router.push(item.route as any)}
                  activeOpacity={0.6}
                >
                  <View style={[styles.menuIcon, { backgroundColor: item.iconBg }]}>
                    <Ionicons name={item.icon} size={20} color={item.iconColor} />
                  </View>
                  <View style={styles.menuText}>
                    <Text style={styles.menuLabel}>{item.label}</Text>
                    <Text style={styles.menuSubtitle}>{item.subtitle}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color={colors.textDisabled} />
                </TouchableOpacity>
              ))}
            </View>
          </View>
        ))}

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

// ── Styles ─────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    paddingTop: spacing.safeAreaTop,
    paddingHorizontal: spacing.pagePaddingX,
  },
  headerTitle: {
    fontFamily: fonts.bold,
    fontSize: 28,
    color: colors.textPrimary,
    letterSpacing: -0.5,
  },
  scrollView: { flex: 1 },
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
    backgroundColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileInfo: { flex: 1, marginLeft: spacing.xl },
  profileName: { fontFamily: fonts.bold, fontSize: 18, color: colors.textPrimary },
  profileUnit: { fontFamily: fonts.medium, fontSize: 14, color: colors.textMuted, marginTop: 2 },

  // Sections
  section: { marginBottom: spacing['3xl'] },
  sectionTitle: {
    fontFamily: fonts.bold,
    fontSize: 11,
    color: colors.textCaption,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    marginBottom: spacing.lg,
    marginLeft: spacing.xs,
  },
  sectionCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
    ...shadows.sm,
  },

  // Menu Items
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.xl,
    gap: spacing.xl,
  },
  menuItemBorder: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  menuIcon: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuText: { flex: 1 },
  menuLabel: { fontFamily: fonts.bold, fontSize: 14, color: colors.textSecondary },
  menuSubtitle: { fontFamily: fonts.medium, fontSize: 12, color: colors.textMuted, marginTop: 1 },

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
  signOutText: { fontFamily: fonts.bold, fontSize: 15, color: colors.danger },

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
