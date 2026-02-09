import { View, Text, TouchableOpacity, ScrollView, StyleSheet, RefreshControl } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import { queryKeys } from '@upoe/shared';
import { formatRelative } from '@/lib/dates';
import { AmbientBackground } from '@/components/ui/AmbientBackground';
import { GlassCard } from '@/components/ui/GlassCard';
import { colors, fonts, spacing, borderRadius, shadows } from '@/theme';

export default function AdminDashboard() {
  const router = useRouter();
  const { user, communityId } = useAuth();

  const firstName = user?.user_metadata?.first_name ?? 'Admin';

  // -- Community branding (inline query) --
  const { data: community } = useQuery({
    queryKey: queryKeys.communities.detail(communityId!).queryKey,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('communities')
        .select('id, name, logo_url')
        .eq('id', communityId!)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!communityId,
  });

  // -- Dashboard stats (inline query) --
  const {
    data: stats,
    refetch: refetchStats,
  } = useQuery({
    queryKey: ['admin-dashboard-stats', communityId],
    queryFn: async () => {
      const [residentsRes, unitsRes, ticketsRes, paymentsRes] = await Promise.all([
        supabase
          .from('residents')
          .select('id', { count: 'exact', head: true })
          .eq('community_id', communityId!),
        supabase
          .from('units')
          .select('id', { count: 'exact', head: true })
          .eq('community_id', communityId!),
        supabase
          .from('tickets')
          .select('id', { count: 'exact', head: true })
          .eq('community_id', communityId!)
          .in('status', ['open', 'in_progress']),
        supabase
          .from('payment_proofs')
          .select('id', { count: 'exact', head: true })
          .eq('community_id', communityId!)
          .eq('status', 'pending'),
      ]);

      return {
        totalResidents: residentsRes.count ?? 0,
        totalUnits: unitsRes.count ?? 0,
        openTickets: ticketsRes.count ?? 0,
        pendingPayments: paymentsRes.count ?? 0,
      };
    },
    enabled: !!communityId,
  });

  // -- Recent activity (inline query) --
  const {
    data: recentActivity,
    refetch: refetchActivity,
  } = useQuery({
    queryKey: ['admin-recent-activity', communityId],
    queryFn: async () => {
      // Fetch latest tickets and announcements for a quick activity feed
      const [ticketsRes, announcementsRes] = await Promise.all([
        supabase
          .from('tickets')
          .select('id, title, status, priority, created_at')
          .eq('community_id', communityId!)
          .order('created_at', { ascending: false })
          .limit(3),
        supabase
          .from('announcements')
          .select('id, title, is_urgent, created_at')
          .eq('community_id', communityId!)
          .order('created_at', { ascending: false })
          .limit(2),
      ]);

      const ticketItems = (ticketsRes.data ?? []).map((t) => ({
        id: `ticket-${t.id}`,
        type: 'ticket' as const,
        title: t.title,
        subtitle: `${t.priority} priority - ${t.status.replace('_', ' ')}`,
        icon: 'construct-outline' as const,
        iconColor: t.priority === 'urgent' ? colors.danger : colors.warning,
        iconBg: t.priority === 'urgent' ? colors.dangerBg : colors.warningBg,
        createdAt: t.created_at,
      }));

      const announcementItems = (announcementsRes.data ?? []).map((a) => ({
        id: `announcement-${a.id}`,
        type: 'announcement' as const,
        title: a.title,
        subtitle: a.is_urgent ? 'Urgent notice' : 'Community notice',
        icon: 'megaphone-outline' as const,
        iconColor: a.is_urgent ? colors.warningText : colors.primary,
        iconBg: a.is_urgent ? colors.warningBg : colors.primaryLightAlt,
        createdAt: a.created_at,
      }));

      return [...ticketItems, ...announcementItems]
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .slice(0, 4);
    },
    enabled: !!communityId,
  });

  const communityName = community?.name ?? 'Community';

  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 18) return 'Good afternoon';
    return 'Good evening';
  })();

  const onRefresh = async () => {
    await Promise.all([refetchStats(), refetchActivity()]);
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
            <Ionicons name="shield-checkmark-outline" size={20} color={colors.textOnDark} />
          </LinearGradient>
          <View>
            <Text style={styles.headerCommunity}>{communityName.toUpperCase()}</Text>
            <Text style={styles.headerRole}>Admin Panel</Text>
          </View>
        </View>
        <View style={styles.adminBadge}>
          <Ionicons name="shield" size={14} color={colors.primary} />
          <Text style={styles.adminBadgeText}>ADMIN</Text>
        </View>
      </View>

      {/* Content */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={false} onRefresh={onRefresh} tintColor={colors.primary} />
        }
      >
        {/* Greeting */}
        <View style={styles.greetingSection}>
          <Text style={styles.greetingTitle}>{greeting}, {firstName}</Text>
          <Text style={styles.greetingSubtitle}>Here is your community overview.</Text>
        </View>

        {/* Stats Cards Row */}
        <View style={styles.statsGrid}>
          <GlassCard style={styles.statCard}>
            <View style={[styles.statIconBox, { backgroundColor: colors.primaryLight }]}>
              <Ionicons name="people-outline" size={18} color={colors.primary} />
            </View>
            <Text style={styles.statValue}>{stats?.totalResidents ?? '-'}</Text>
            <Text style={styles.statLabel}>RESIDENTS</Text>
          </GlassCard>

          <GlassCard style={styles.statCard}>
            <View style={[styles.statIconBox, { backgroundColor: colors.tealLight }]}>
              <Ionicons name="home-outline" size={18} color={colors.tealDark} />
            </View>
            <Text style={styles.statValue}>{stats?.totalUnits ?? '-'}</Text>
            <Text style={styles.statLabel}>UNITS</Text>
          </GlassCard>

          <GlassCard style={styles.statCard}>
            <View style={[styles.statIconBox, { backgroundColor: colors.warningBg }]}>
              <Ionicons name="card-outline" size={18} color={colors.warningText} />
            </View>
            <Text style={styles.statValue}>{stats?.pendingPayments ?? '-'}</Text>
            <Text style={styles.statLabel}>PENDING</Text>
          </GlassCard>

          <GlassCard style={styles.statCard}>
            <View style={[styles.statIconBox, { backgroundColor: colors.dangerBg }]}>
              <Ionicons name="construct-outline" size={18} color={colors.danger} />
            </View>
            <Text style={styles.statValue}>{stats?.openTickets ?? '-'}</Text>
            <Text style={styles.statLabel}>TICKETS</Text>
          </GlassCard>
        </View>

        {/* Quick Actions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>QUICK ACTIONS</Text>
          <View style={styles.quickActionsGrid}>
            <TouchableOpacity
              style={styles.quickAction}
              onPress={() => router.push('/(admin)/manage')}
            >
              <View style={[styles.quickActionIcon, { backgroundColor: colors.primaryLight }]}>
                <Ionicons name="people-outline" size={24} color={colors.primary} />
              </View>
              <Text style={styles.quickActionLabel}>Residents</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.quickAction}
              onPress={() => router.push('/(admin)/manage')}
            >
              <View style={[styles.quickActionIcon, { backgroundColor: colors.successBg }]}>
                <Ionicons name="checkmark-circle-outline" size={24} color={colors.successText} />
              </View>
              <Text style={styles.quickActionLabel}>Payments</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.quickAction}
              onPress={() => router.push('/(admin)/manage')}
            >
              <View style={[styles.quickActionIcon, { backgroundColor: colors.warningBg }]}>
                <Ionicons name="megaphone-outline" size={24} color={colors.warningText} />
              </View>
              <Text style={styles.quickActionLabel}>Announce</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.quickAction}
              onPress={() => router.push('/(admin)/settings')}
            >
              <View style={[styles.quickActionIcon, { backgroundColor: colors.indigoBg }]}>
                <Ionicons name="settings-outline" size={24} color={colors.indigo} />
              </View>
              <Text style={styles.quickActionLabel}>Settings</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Recent Activity */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>RECENT ACTIVITY</Text>
          <View style={styles.activityList}>
            {(!recentActivity || recentActivity.length === 0) && (
              <GlassCard style={styles.activityItem}>
                <View style={styles.activityContent}>
                  <Text style={styles.activityTitle}>No recent activity</Text>
                  <Text style={styles.activityBody}>
                    Check back later for updates from your community.
                  </Text>
                </View>
              </GlassCard>
            )}
            {recentActivity?.map((item) => (
              <GlassCard key={item.id} style={styles.activityItem}>
                <View style={[styles.activityIcon, { backgroundColor: item.iconBg }]}>
                  <Ionicons name={item.icon} size={18} color={item.iconColor} />
                </View>
                <View style={styles.activityContent}>
                  <View style={styles.activityHeader}>
                    <Text style={styles.activityTitle} numberOfLines={1}>
                      {item.title}
                    </Text>
                    <Text style={styles.activityTime}>
                      {formatRelative(item.createdAt)}
                    </Text>
                  </View>
                  <Text style={styles.activityBody} numberOfLines={1}>
                    {item.subtitle}
                  </Text>
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
  headerRole: {
    fontFamily: fonts.bold,
    fontSize: 14,
    color: colors.textSecondary,
  },
  adminBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    backgroundColor: colors.primaryLight,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: colors.primaryLightAlt,
  },
  adminBadgeText: {
    fontFamily: fonts.bold,
    fontSize: 10,
    color: colors.primary,
    letterSpacing: 0.5,
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
  // Stats Grid
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.lg,
    marginBottom: spacing['4xl'],
  },
  statCard: {
    width: '47%',
    flexGrow: 1,
    padding: spacing.xl,
    borderRadius: borderRadius.lg,
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  statIconBox: {
    width: 36,
    height: 36,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statValue: {
    fontFamily: fonts.black,
    fontSize: 24,
    color: colors.textPrimary,
  },
  statLabel: {
    fontFamily: fonts.bold,
    fontSize: 10,
    color: colors.textCaption,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  // Sections
  section: {
    marginBottom: spacing['4xl'],
  },
  sectionTitle: {
    fontFamily: fonts.bold,
    fontSize: 14,
    color: colors.textCaption,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
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
});
