import { View, Text, TouchableOpacity, ScrollView, StyleSheet, Image, RefreshControl } from 'react-native';
import { useRouter, Link } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '@/hooks/useAuth';
import { useCommunityBranding } from '@/hooks/useCommunity';
import { useResidentUnit } from '@/hooks/useOccupancy';
import { useUnitBalance } from '@/hooks/usePayments';
import { useActiveInvitations } from '@/hooks/useVisitors';
import { useAnnouncementFeed } from '@/hooks/useAnnouncements';
import { formatCurrency, formatRelative } from '@/lib/dates';
import { AmbientBackground } from '@/components/ui/AmbientBackground';
import { GlassCard } from '@/components/ui/GlassCard';
import { NotificationBell } from '@/components/notifications/NotificationBell';
import { colors, fonts, spacing, borderRadius, shadows } from '@/theme';

export default function ResidentDashboard() {
  const router = useRouter();
  const { user, communityId } = useAuth();
  const { data: branding } = useCommunityBranding(communityId);
  const { unitId, unitNumber, building } = useResidentUnit();
  const { data: balance, refetch: refetchBalance } = useUnitBalance(unitId ?? undefined);
  const { data: invitations, refetch: refetchInvitations } = useActiveInvitations();
  const { data: announcements, refetch: refetchAnnouncements } = useAnnouncementFeed();

  const firstName = user?.user_metadata?.first_name ?? 'Resident';
  const communityName = branding?.name ?? 'Community';
  const avatarUrl = user?.user_metadata?.avatar_url;
  const activeVisitorCount = invitations?.length ?? 0;
  // announcements are AnnouncementFeedItem[] with nested .announcements object
  const latestAnnouncements = (announcements ?? []).slice(0, 2).map((item) => ({
    id: item.announcements.id,
    title: item.announcements.title,
    body: item.announcements.body,
    is_urgent: item.announcements.is_urgent,
    created_at: item.announcements.created_at,
  }));

  const currentBalance = balance?.current_balance ?? 0;
  const daysOverdue = balance?.days_overdue ?? 0;
  const lastPaymentDate = balance?.last_payment_date;

  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 18) return 'Good afternoon';
    return 'Good evening';
  })();

  const onRefresh = async () => {
    await Promise.all([refetchBalance(), refetchInvitations(), refetchAnnouncements()]);
  };

  return (
    <View style={styles.container}>
      <AmbientBackground />

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <LinearGradient
            colors={[colors.gradientStart, colors.gradientEnd]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.headerLogo}
          >
            <Ionicons name="business-outline" size={20} color={colors.textOnDark} />
          </LinearGradient>
          <View>
            <Text style={styles.headerCommunity}>{communityName.toUpperCase()}</Text>
            <Text style={styles.headerUnit}>
              {unitNumber ? `Unit ${unitNumber}${building ? ` ${building}` : ''}` : 'Loading...'}
            </Text>
          </View>
        </View>
        <View style={styles.headerRight}>
          <NotificationBell />
          <Link href="/(resident)/more/profile" asChild>
            <TouchableOpacity style={styles.headerAvatar}>
              {avatarUrl ? (
                <Image source={{ uri: avatarUrl }} style={styles.avatarImage} />
              ) : (
                <Ionicons name="person" size={18} color={colors.textCaption} />
              )}
            </TouchableOpacity>
          </Link>
        </View>
      </View>

      {/* Content */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={false} onRefresh={onRefresh} tintColor={colors.primary} />}
      >
        {/* Greeting */}
        <View style={styles.greetingSection}>
          <Text style={styles.greetingTitle}>{greeting}, {firstName}</Text>
          <Text style={styles.greetingSubtitle}>Everything looks great in your community today.</Text>
        </View>

        {/* Balance Card */}
        <View style={styles.balanceCard}>
          <View style={styles.balanceOrb} />
          <View style={styles.balanceContent}>
            <View style={styles.balanceHeader}>
              <View>
                {currentBalance < 0 ? (
                  <>
                    <Text style={styles.balanceLabel}>SALDO A FAVOR</Text>
                    <Text style={[styles.balanceAmount, styles.balanceAmountFavor]}>
                      {formatCurrency(Math.abs(currentBalance))}
                    </Text>
                  </>
                ) : currentBalance === 0 ? (
                  <>
                    <Text style={styles.balanceLabel}>BALANCE</Text>
                    <Text style={[styles.balanceAmount, styles.balanceAmountCurrent]}>
                      Al corriente
                    </Text>
                  </>
                ) : (
                  <>
                    <Text style={styles.balanceLabel}>SALDO PENDIENTE</Text>
                    <Text style={styles.balanceAmount}>{formatCurrency(currentBalance)}</Text>
                  </>
                )}
              </View>
              {currentBalance < 0 ? (
                <View style={styles.favorBadge}>
                  <Text style={styles.favorBadgeText}>SALDO A FAVOR</Text>
                </View>
              ) : daysOverdue > 0 ? (
                <View style={styles.overdueBadge}>
                  <Text style={styles.overdueBadgeText}>
                    {daysOverdue} DAYS OVERDUE
                  </Text>
                </View>
              ) : (
                <View style={styles.paidBadge}>
                  <Text style={styles.paidBadgeText}>AL CORRIENTE</Text>
                </View>
              )}
            </View>

            <View style={styles.balanceFooter}>
              <TouchableOpacity
                style={styles.payNowButton}
                onPress={() => router.push('/(resident)/payments')}
              >
                <Text style={styles.payNowText}>Pay Now</Text>
                <Ionicons name="chevron-forward" size={14} color={colors.textOnDark} />
              </TouchableOpacity>
              {lastPaymentDate && (
                <Text style={styles.lastPaidText}>Last paid: {formatRelative(lastPaymentDate)}</Text>
              )}
            </View>
          </View>
        </View>

        {/* Quick Stats Row */}
        <View style={styles.statsRow}>
          <TouchableOpacity
            style={styles.statCardTouchable}
            onPress={() => router.push('/(resident)/visitors')}
            activeOpacity={0.7}
          >
            <GlassCard style={styles.statCard}>
              <View style={[styles.statIconBox, { backgroundColor: colors.tealLightAlt }]}>
                <Ionicons name="people-outline" size={20} color={colors.tealDark} />
              </View>
              <View>
                <Text style={styles.statLabel}>VISITORS</Text>
                <Text style={styles.statValue}>{activeVisitorCount} Active</Text>
              </View>
            </GlassCard>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.statCardTouchable}
            onPress={() => router.push('/(resident)/announcements')}
            activeOpacity={0.7}
          >
            <GlassCard style={styles.statCard}>
              <View style={[styles.statIconBox, { backgroundColor: colors.indigoBg }]}>
                <Ionicons name="notifications-outline" size={20} color={colors.indigo} />
              </View>
              <View>
                <Text style={styles.statLabel}>ALERTS</Text>
                <Text style={styles.statValue}>{latestAnnouncements.length} New</Text>
              </View>
            </GlassCard>
          </TouchableOpacity>
        </View>

        {/* Quick Actions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>QUICK ACTIONS</Text>
          <View style={styles.quickActionsGrid}>
            <TouchableOpacity
              style={styles.quickAction}
              onPress={() => router.push('/(resident)/visitors/create')}
            >
              <View style={[styles.quickActionIcon, { backgroundColor: colors.primaryLight }]}>
                <Ionicons name="person-add-outline" size={24} color={colors.primary} />
              </View>
              <Text style={styles.quickActionLabel}>Invite</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.quickAction}
              onPress={() => router.push('/(resident)/payments')}
            >
              <View style={[styles.quickActionIcon, { backgroundColor: colors.tealLight }]}>
                <Ionicons name="card-outline" size={24} color={colors.tealDark} />
              </View>
              <Text style={styles.quickActionLabel}>Payments</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.quickAction}
              onPress={() => router.push('/(resident)/community')}
            >
              <View style={[styles.quickActionIcon, { backgroundColor: colors.warningBgLight }]}>
                <Ionicons name="chatbubble-ellipses-outline" size={24} color={colors.warningText} />
              </View>
              <Text style={styles.quickActionLabel}>Social</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.quickAction}
              onPress={() => router.push('/(resident)/maintenance')}
            >
              <View style={[styles.quickActionIcon, { backgroundColor: colors.dangerBgLight }]}>
                <Ionicons name="construct-outline" size={24} color={colors.danger} />
              </View>
              <Text style={styles.quickActionLabel}>Report</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.quickAction}
              onPress={() => router.push('/(resident)/community/amenities/')}
            >
              <View style={[styles.quickActionIcon, { backgroundColor: colors.indigoBg }]}>
                <Ionicons name="calendar-outline" size={24} color={colors.indigo} />
              </View>
              <Text style={styles.quickActionLabel}>Amenities</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Recent Activity */}
        <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>RECENT ACTIVITY</Text>
            <TouchableOpacity onPress={() => router.push('/(resident)/announcements')}>
              <Text style={styles.seeAllText}>SEE ALL</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.activityList}>
            {latestAnnouncements.length === 0 && (
              <GlassCard style={styles.activityItem}>
                <View style={styles.activityContent}>
                  <Text style={styles.activityTitle}>No recent activity</Text>
                  <Text style={styles.activityBody}>Check back later for updates from your community.</Text>
                </View>
              </GlassCard>
            )}
            {latestAnnouncements.map((item) => (
              <GlassCard key={item.id} style={styles.activityItem}>
                <View style={[styles.activityIcon, { backgroundColor: colors.primaryLightAlt }]}>
                  <Ionicons
                    name={item.is_urgent ? 'warning-outline' : 'megaphone-outline'}
                    size={18}
                    color={item.is_urgent ? colors.warningText : colors.primary}
                  />
                </View>
                <View style={styles.activityContent}>
                  <View style={styles.activityHeader}>
                    <Text style={styles.activityTitle} numberOfLines={1}>{item.title}</Text>
                    <Text style={styles.activityTime}>{formatRelative(item.created_at)}</Text>
                  </View>
                  <Text style={styles.activityBody} numberOfLines={2}>{item.body}</Text>
                  <TouchableOpacity
                    style={styles.activityLink}
                    onPress={() => router.push(`/(resident)/announcements/${item.id}`)}
                  >
                    <Text style={styles.activityLinkText}>READ FULL NOTICE</Text>
                    <Ionicons name="arrow-forward" size={12} color={colors.primary} />
                  </TouchableOpacity>
                </View>
              </GlassCard>
            ))}
          </View>
        </View>
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
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: spacing.safeAreaTop,
    paddingHorizontal: spacing.pagePaddingX,
    zIndex: 20,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
  },
  headerLogo: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.md,
  },
  headerCommunity: {
    fontFamily: fonts.bold,
    fontSize: 10,
    color: colors.textCaption,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
  },
  headerUnit: {
    fontFamily: fonts.bold,
    fontSize: 14,
    color: colors.textSecondary,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  headerAvatar: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.full,
    borderWidth: 2,
    borderColor: colors.surface,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.border,
    ...shadows.sm,
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  // ScrollView
  scrollView: {
    flex: 1,
    zIndex: 10,
  },
  scrollContent: {
    paddingTop: spacing['3xl'],
    paddingHorizontal: spacing.pagePaddingX,
    paddingBottom: spacing.bottomNavClearance,
  },
  // Greeting
  greetingSection: {
    marginBottom: spacing['3xl'],
  },
  greetingTitle: {
    fontFamily: fonts.bold,
    fontSize: 24,
    color: colors.textPrimary,
    letterSpacing: -0.5,
  },
  greetingSubtitle: {
    fontFamily: fonts.medium,
    fontSize: 14,
    color: colors.textMuted,
    marginTop: spacing.xs,
  },
  // Balance Card
  balanceCard: {
    padding: spacing['3xl'],
    backgroundColor: colors.dark,
    borderRadius: borderRadius['3xl'],
    overflow: 'hidden',
    marginBottom: spacing['3xl'],
    ...shadows.xl,
  },
  balanceOrb: {
    position: 'absolute',
    right: -48,
    bottom: -48,
    width: 192,
    height: 192,
    borderRadius: 96,
    backgroundColor: colors.ambientDarkOrb,
  },
  balanceContent: {
    zIndex: 1,
  },
  balanceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: spacing.lg,
  },
  balanceLabel: {
    fontFamily: fonts.medium,
    fontSize: 12,
    color: colors.textOnDarkMuted,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    marginBottom: spacing.xs,
  },
  balanceAmount: {
    fontFamily: fonts.bold,
    fontSize: 30,
    color: colors.textOnDark,
  },
  overdueBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: colors.warningBgAlpha,
    borderRadius: borderRadius.sm,
    borderWidth: 1,
    borderColor: 'rgba(245,158,11,0.3)',
    flexShrink: 1,
    alignSelf: 'flex-start',
  },
  overdueBadgeText: {
    fontFamily: fonts.bold,
    fontSize: 10,
    color: '#FBBF24',
  },
  paidBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    backgroundColor: 'rgba(16,185,129,0.2)',
    borderRadius: borderRadius.sm,
    borderWidth: 1,
    borderColor: 'rgba(16,185,129,0.3)',
  },
  paidBadgeText: {
    fontFamily: fonts.bold,
    fontSize: 10,
    color: colors.success,
  },
  favorBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    backgroundColor: 'rgba(16,185,129,0.2)',
    borderRadius: borderRadius.sm,
    borderWidth: 1,
    borderColor: 'rgba(16,185,129,0.3)',
    flexShrink: 1,
    alignSelf: 'flex-start' as const,
  },
  favorBadgeText: {
    fontFamily: fonts.bold,
    fontSize: 10,
    color: colors.success,
  },
  balanceAmountFavor: {
    color: colors.success,
  },
  balanceAmountCurrent: {
    fontSize: 24,
    color: colors.success,
  },
  balanceFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing['4xl'],
  },
  payNowButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing['3xl'],
    paddingVertical: 10,
    backgroundColor: colors.primary,
    borderRadius: borderRadius.md,
  },
  payNowText: {
    fontFamily: fonts.bold,
    fontSize: 12,
    color: colors.textOnDark,
  },
  lastPaidText: {
    fontFamily: fonts.medium,
    fontSize: 10,
    color: colors.textOnDarkMuted,
    fontStyle: 'italic',
  },
  // Stats Row
  statsRow: {
    flexDirection: 'row',
    gap: spacing.xl,
    marginBottom: spacing['4xl'],
  },
  statCardTouchable: {
    flex: 1,
  },
  statCard: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
    padding: spacing.xl,
    borderRadius: borderRadius.lg,
  },
  statIconBox: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statLabel: {
    fontFamily: fonts.bold,
    fontSize: 10,
    color: colors.textCaption,
    textTransform: 'uppercase',
  },
  statValue: {
    fontFamily: fonts.bold,
    fontSize: 14,
    color: colors.textSecondary,
  },
  // Sections
  section: {
    marginBottom: spacing['4xl'],
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  sectionTitle: {
    fontFamily: fonts.bold,
    fontSize: 14,
    color: colors.textCaption,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    marginBottom: spacing.xl,
  },
  seeAllText: {
    fontFamily: fonts.bold,
    fontSize: 11,
    color: colors.primary,
    textTransform: 'uppercase',
    marginBottom: spacing.xl,
  },
  // Quick Actions
  quickActionsGrid: {
    flexDirection: 'row',
    gap: spacing.xl,
  },
  quickAction: {
    flex: 1,
    alignItems: 'center',
    gap: spacing.md,
  },
  quickActionIcon: {
    width: 56,
    height: 56,
    borderRadius: borderRadius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.sm,
  },
  quickActionLabel: {
    fontFamily: fonts.bold,
    fontSize: 11,
    color: colors.textBody,
  },
  // Activity
  activityList: {
    gap: spacing.lg,
  },
  activityItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.xl,
    padding: spacing.xl,
    borderRadius: borderRadius.lg,
  },
  activityIcon: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  activityContent: {
    flex: 1,
  },
  activityHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  activityTitle: {
    fontFamily: fonts.bold,
    fontSize: 14,
    color: colors.textSecondary,
    flex: 1,
  },
  activityTime: {
    fontFamily: fonts.medium,
    fontSize: 10,
    color: colors.textCaption,
    marginLeft: spacing.md,
  },
  activityBody: {
    fontFamily: fonts.medium,
    fontSize: 12,
    color: colors.textMuted,
    lineHeight: 18,
    marginTop: 4,
  },
  activityLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: spacing.lg,
  },
  activityLinkText: {
    fontFamily: fonts.bold,
    fontSize: 10,
    color: colors.primary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
});
