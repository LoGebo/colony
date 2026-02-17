import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/hooks/useAuth';
import { showAlert } from '@/lib/alert';
import { AmbientBackground } from '@/components/ui/AmbientBackground';
import { colors, fonts, spacing, borderRadius, shadows } from '@/theme';

interface SettingsItemProps {
  icon: keyof typeof Ionicons.glyphMap;
  iconBg: string;
  iconColor: string;
  title: string;
  subtitle: string;
  onPress?: () => void;
  showChevron?: boolean;
}

function SettingsItem({ icon, iconBg, iconColor, title, subtitle, onPress, showChevron = true }: SettingsItemProps) {
  return (
    <TouchableOpacity style={styles.settingsItem} onPress={onPress} activeOpacity={0.7}>
      <View style={[styles.settingsIconBox, { backgroundColor: iconBg }]}>
        <Ionicons name={icon} size={18} color={iconColor} />
      </View>
      <View style={styles.settingsItemContent}>
        <Text style={styles.settingsItemTitle}>{title}</Text>
        <Text style={styles.settingsItemSubtitle}>{subtitle}</Text>
      </View>
      {showChevron && (
        <Ionicons name="chevron-forward" size={18} color={colors.textDisabled} />
      )}
    </TouchableOpacity>
  );
}

export default function AdminSettings() {
  const router = useRouter();
  const { signOut, user } = useAuth();

  const handleSignOut = () => {
    showAlert(
      'Sign Out',
      'Are you sure you want to sign out of the admin panel?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Sign Out', style: 'destructive', onPress: () => signOut() },
      ],
    );
  };

  const adminEmail = user?.email ?? '';

  return (
    <View style={styles.container}>
      <AmbientBackground />

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Settings</Text>
        <Text style={styles.headerSubtitle}>{adminEmail}</Text>
      </View>

      {/* Content */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Community Core Section */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>COMMUNITY CORE</Text>
          <View style={styles.settingsGroup}>
            <SettingsItem
              icon="document-text-outline"
              iconBg={colors.primaryLight}
              iconColor={colors.primary}
              title="Internal Policies"
              subtitle="Quiet hours, pet rules, noise levels"
            />
            <View style={styles.settingsDivider} />
            <SettingsItem
              icon="time-outline"
              iconBg={colors.tealLight}
              iconColor={colors.tealDark}
              title="Operating Hours"
              subtitle="Gate and amenity access windows"
            />
            <View style={styles.settingsDivider} />
            <SettingsItem
              icon="people-outline"
              iconBg={colors.indigoBg}
              iconColor={colors.indigo}
              title="Resident Management"
              subtitle="Onboarding, unit mapping, directory"
              onPress={() => router.push('/(admin)/manage')}
            />
          </View>
        </View>

        {/* Finance & Assets Section */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>FINANCE & ASSETS</Text>
          <View style={styles.settingsGroup}>
            <SettingsItem
              icon="card-outline"
              iconBg={colors.successBg}
              iconColor={colors.successText}
              title="Payment Verification"
              subtitle="Approve transfers and receipts"
            />
            <View style={styles.settingsDivider} />
            <SettingsItem
              icon="leaf-outline"
              iconBg={colors.warningBg}
              iconColor={colors.warningText}
              title="Amenity Settings"
              subtitle="Schedules, fees, and booking rules"
            />
            <View style={styles.settingsDivider} />
            <SettingsItem
              icon="notifications-outline"
              iconBg={colors.dangerBg}
              iconColor={colors.danger}
              title="Maintenance Alerts"
              subtitle="Urgent tickets notifications"
            />
          </View>
        </View>

        {/* System & Comms Section */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>SYSTEM & COMMS</Text>
          <View style={styles.settingsGroup}>
            <SettingsItem
              icon="mail-outline"
              iconBg={colors.primaryLight}
              iconColor={colors.primary}
              title="Email Templates"
              subtitle="Welcome emails, invoice notices"
            />
            <View style={styles.settingsDivider} />
            <SettingsItem
              icon="shield-checkmark-outline"
              iconBg={colors.indigoBg}
              iconColor={colors.indigo}
              title="Social Moderation"
              subtitle="Filter keywords, block users"
            />
          </View>
        </View>

        {/* Sign Out */}
        <TouchableOpacity style={styles.signOutButton} onPress={handleSignOut} activeOpacity={0.8}>
          <Text style={styles.signOutText}>Logout of Admin Panel</Text>
        </TouchableOpacity>
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
    paddingTop: spacing.safeAreaTop,
    paddingHorizontal: spacing.pagePaddingX,
    paddingBottom: spacing.xl,
    zIndex: 20,
  },
  headerTitle: {
    fontFamily: fonts.bold,
    fontSize: 24,
    color: colors.textPrimary,
    letterSpacing: -0.5,
  },
  headerSubtitle: {
    fontFamily: fonts.medium,
    fontSize: 13,
    color: colors.textMuted,
    marginTop: spacing.xs,
  },
  // ScrollView
  scrollView: {
    flex: 1,
    zIndex: 10,
  },
  scrollContent: {
    paddingHorizontal: spacing.pagePaddingX,
    paddingBottom: spacing.bottomNavClearance,
    gap: spacing['3xl'],
  },
  // Sections
  section: {
    gap: spacing.md,
  },
  sectionLabel: {
    fontFamily: fonts.bold,
    fontSize: 11,
    color: colors.textCaption,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    marginLeft: 4,
  },
  // Settings Group
  settingsGroup: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius['2xl'],
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.sm,
  },
  settingsItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
    padding: spacing.xl,
  },
  settingsIconBox: {
    width: 36,
    height: 36,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  settingsItemContent: {
    flex: 1,
  },
  settingsItemTitle: {
    fontFamily: fonts.bold,
    fontSize: 14,
    color: colors.textPrimary,
  },
  settingsItemSubtitle: {
    fontFamily: fonts.medium,
    fontSize: 11,
    color: colors.textCaption,
    marginTop: 1,
  },
  settingsDivider: {
    height: 1,
    backgroundColor: colors.border,
    marginLeft: 64,
  },
  // Sign Out
  signOutButton: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    paddingVertical: spacing.xl,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.sm,
  },
  signOutText: {
    fontFamily: fonts.bold,
    fontSize: 14,
    color: colors.danger,
  },
});
