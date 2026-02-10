import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/hooks/useAuth';
import { useResidentUnit } from '@/hooks/useOccupancy';
import { AmbientBackground } from '@/components/ui/AmbientBackground';
import { colors, fonts, spacing, borderRadius, shadows } from '@/theme';

interface MenuItemConfig {
  label: string;
  subtitle: string;
  icon: string;
  iconBg: string;
  iconColor: string;
  route: string;
}

const menuItems: MenuItemConfig[] = [
  { label: 'Profile', subtitle: 'Personal information', icon: 'person-outline', iconBg: colors.primaryLight, iconColor: colors.primary, route: '/(resident)/more/profile' },
  { label: 'Vehicles', subtitle: 'Manage your vehicles', icon: 'car-outline', iconBg: colors.indigoBg, iconColor: colors.indigo, route: '/(resident)/more/vehicles' },
  { label: 'Documents', subtitle: 'Files & signatures', icon: 'document-text-outline', iconBg: colors.border, iconColor: colors.textBody, route: '/(resident)/more/documents' },
  { label: 'Marketplace', subtitle: 'Buy & sell items', icon: 'bag-handle-outline', iconBg: colors.warningBgLight, iconColor: colors.warningText, route: '/(resident)/more/marketplace' },
  { label: 'Packages', subtitle: 'Delivery tracking', icon: 'cube-outline', iconBg: colors.tealLight, iconColor: colors.tealDark, route: '/(resident)/more/packages' },
  { label: 'Notifications', subtitle: 'Preferences', icon: 'notifications-outline', iconBg: colors.dangerBgLight, iconColor: colors.danger, route: '/(resident)/more/notification-settings' },
];

export default function MoreIndexScreen() {
  const router = useRouter();
  const { signOut, user } = useAuth();
  const { unitNumber } = useResidentUnit();
  const firstName = user?.user_metadata?.first_name ?? 'Resident';
  const lastName = user?.user_metadata?.last_name ?? '';

  return (
    <View style={styles.container}>
      <AmbientBackground />
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Settings</Text>
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

        {/* Menu Items */}
        <View style={styles.menuList}>
          {menuItems.map((item) => (
            <TouchableOpacity
              key={item.route}
              style={styles.menuItem}
              onPress={() => router.push(item.route as any)}
            >
              <View style={[styles.menuIcon, { backgroundColor: item.iconBg }]}>
                <Ionicons name={item.icon as any} size={20} color={item.iconColor} />
              </View>
              <View style={styles.menuText}>
                <Text style={styles.menuLabel}>{item.label}</Text>
                <Text style={styles.menuSubtitle}>{item.subtitle}</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={colors.textDisabled} />
            </TouchableOpacity>
          ))}
        </View>

        {/* Sign Out */}
        <TouchableOpacity style={styles.signOutButton} onPress={signOut}>
          <Ionicons name="log-out-outline" size={20} color={colors.danger} />
          <Text style={styles.signOutText}>Sign Out</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    paddingTop: spacing.safeAreaTop,
    paddingHorizontal: spacing.pagePaddingX,
  },
  headerTitle: {
    fontFamily: fonts.bold,
    fontSize: 24,
    color: colors.textPrimary,
    letterSpacing: -0.5,
  },
  scrollView: { flex: 1 },
  scrollContent: {
    paddingHorizontal: spacing.pagePaddingX,
    paddingTop: spacing['3xl'],
    paddingBottom: spacing.bottomNavClearance,
  },
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: borderRadius['2xl'],
    padding: spacing.cardPadding,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing['3xl'],
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
  profileUnit: { fontFamily: fonts.medium, fontSize: 14, color: colors.textMuted },
  menuList: { gap: spacing.md },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.xl,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.xl,
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
  menuSubtitle: { fontFamily: fonts.medium, fontSize: 12, color: colors.textMuted },
  signOutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    marginTop: spacing['4xl'],
    paddingVertical: spacing.xl,
  },
  signOutText: { fontFamily: fonts.bold, fontSize: 14, color: colors.danger },
});
