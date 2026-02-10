import { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useNotificationList, useMarkNotificationRead } from '@/hooks/useNotifications';
import { formatRelative } from '@/lib/dates';
import { AmbientBackground } from '@/components/ui/AmbientBackground';
import { colors, fonts, spacing, borderRadius, shadows } from '@/theme';

type FilterType = 'all' | 'alerts' | 'visits';

const TYPE_CONFIG: Record<string, { icon: string; bg: string; color: string; label: string }> = {
  visitor_arrived: { icon: 'person-add-outline', bg: colors.tealLight, color: colors.teal, label: 'Access Granted' },
  visitor_checked_in: { icon: 'person-add-outline', bg: colors.tealLight, color: colors.teal, label: 'Visitor Check-in' },
  payment_due: { icon: 'card-outline', bg: colors.warningBg, color: colors.warningText, label: 'Payment Due' },
  payment_received: { icon: 'card-outline', bg: colors.successBg, color: colors.successText, label: 'Payment' },
  ticket_created: { icon: 'construct-outline', bg: colors.primaryLight, color: colors.primary, label: 'Ticket' },
  ticket_status_changed: { icon: 'construct-outline', bg: colors.primaryLight, color: colors.primary, label: 'Ticket Update' },
  announcement: { icon: 'megaphone-outline', bg: colors.warningBg, color: colors.warningText, label: 'Announcement' },
  package_arrived: { icon: 'cube-outline', bg: colors.infoBg, color: colors.primary, label: 'Package Arrived' },
  emergency_alert: { icon: 'warning-outline', bg: colors.dangerBg, color: colors.danger, label: 'Emergency' },
  survey_published: { icon: 'clipboard-outline', bg: colors.indigoBg, color: colors.indigo, label: 'Survey' },
  document_published: { icon: 'document-text-outline', bg: colors.primaryLight, color: colors.primary, label: 'Document' },
  social: { icon: 'heart-outline', bg: '#FFE4E6', color: '#E11D48', label: 'Community Feed' },
};

function getTypeConfig(type: string | null) {
  if (!type) return { icon: 'notifications-outline', bg: colors.border, color: colors.textCaption, label: 'Notification' };
  return TYPE_CONFIG[type] ?? { icon: 'notifications-outline', bg: colors.border, color: colors.textCaption, label: 'Notification' };
}

function groupByDate(items: Array<{ id: string; created_at: string; [key: string]: unknown }>) {
  const groups: { title: string; data: typeof items }[] = [];
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  const todayStr = today.toDateString();
  const yesterdayStr = yesterday.toDateString();

  const map = new Map<string, typeof items>();

  for (const item of items) {
    const d = new Date(item.created_at);
    let key: string;
    if (d.toDateString() === todayStr) key = 'Today';
    else if (d.toDateString() === yesterdayStr) key = 'Yesterday';
    else key = 'Earlier';

    const group = map.get(key) ?? [];
    group.push(item);
    map.set(key, group);
  }

  for (const [title, data] of map) {
    groups.push({ title, data });
  }
  return groups;
}

export default function NotificationsScreen() {
  const router = useRouter();
  const { data: notifications, isLoading, refetch } = useNotificationList();
  const markRead = useMarkNotificationRead();
  const [filter, setFilter] = useState<FilterType>('all');
  const [refreshing, setRefreshing] = useState(false);

  const filtered = useMemo(() => {
    if (!notifications) return [];
    if (filter === 'all') return notifications;
    if (filter === 'alerts') {
      return notifications.filter((n) =>
        ['emergency_alert', 'announcement', 'payment_due', 'ticket_status_changed'].includes(n.type ?? '')
      );
    }
    return notifications.filter((n) =>
      ['visitor_arrived', 'visitor_checked_in'].includes(n.type ?? '')
    );
  }, [notifications, filter]);

  const groups = useMemo(() => groupByDate(filtered as any), [filtered]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

  const handleTap = useCallback(
    (notificationId: string) => {
      markRead.mutate(notificationId);
    },
    [markRead],
  );

  const FILTERS: { key: FilterType; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'alerts', label: 'Alerts' },
    { key: 'visits', label: 'Visits' },
  ];

  return (
    <View style={styles.container}>
      <AmbientBackground />

      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Notifications</Text>
          <Text style={styles.headerSubtitle}>Stay updated with your community</Text>
        </View>
        <TouchableOpacity style={styles.markReadButton}>
          <Text style={styles.markReadText}>Mark Read</Text>
        </TouchableOpacity>
      </View>

      {/* Segmented Control */}
      <View style={styles.segmentedControl}>
        {FILTERS.map((f) => {
          const active = filter === f.key;
          return (
            <TouchableOpacity
              key={f.key}
              style={[styles.segment, active && styles.segmentActive]}
              onPress={() => setFilter(f.key)}
            >
              <Text style={[styles.segmentText, active && styles.segmentTextActive]}>{f.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Notification Feed */}
      {isLoading ? (
        <ActivityIndicator color={colors.primary} style={styles.loader} />
      ) : (
        <FlatList
          data={groups}
          keyExtractor={(item) => item.title}
          renderItem={({ item: group }) => (
            <View>
              <Text style={styles.sectionHeader}>{group.title}</Text>
              {group.data.map((notif: any) => {
                const config = getTypeConfig(notif.type);
                const isUnread = !notif.read_at;
                const isOld = group.title !== 'Today';

                return (
                  <TouchableOpacity
                    key={notif.id}
                    style={[styles.notifCard, isOld && styles.notifCardOld]}
                    onPress={() => handleTap(notif.id)}
                    activeOpacity={0.8}
                  >
                    {isUnread && <View style={[styles.unreadBar, { backgroundColor: config.color }]} />}
                    <View style={[styles.notifIcon, { backgroundColor: config.bg }]}>
                      <Ionicons name={config.icon as any} size={24} color={config.color} />
                    </View>
                    <View style={styles.notifContent}>
                      <View style={styles.notifTopRow}>
                        <Text style={[styles.notifTypeLabel, { color: config.color }]}>{config.label}</Text>
                        <Text style={styles.notifTime}>
                          {notif.created_at ? formatRelative(notif.created_at) : ''}
                        </Text>
                      </View>
                      <Text style={styles.notifTitle} numberOfLines={1}>{notif.title}</Text>
                      {notif.body ? (
                        <Text style={styles.notifBody} numberOfLines={2}>{notif.body}</Text>
                      ) : null}
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Ionicons name="notifications-off-outline" size={48} color={colors.textDisabled} />
              <Text style={styles.emptyText}>No notifications yet</Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    paddingTop: spacing.safeAreaTop, paddingHorizontal: spacing.pagePaddingX,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end',
    marginBottom: spacing['3xl'],
  },
  headerTitle: { fontFamily: fonts.bold, fontSize: 28, color: colors.textPrimary, letterSpacing: -0.5 },
  headerSubtitle: { fontFamily: fonts.medium, fontSize: 14, color: colors.textMuted },
  markReadButton: {
    paddingHorizontal: spacing.lg, paddingVertical: spacing.sm,
    backgroundColor: colors.primaryLight, borderRadius: borderRadius.full,
  },
  markReadText: { fontFamily: fonts.bold, fontSize: 13, color: colors.primary },
  segmentedControl: {
    flexDirection: 'row', marginHorizontal: spacing.pagePaddingX,
    padding: 4, backgroundColor: 'rgba(226,232,240,0.5)', borderRadius: borderRadius.xl, marginBottom: spacing['3xl'],
  },
  segment: { flex: 1, paddingVertical: spacing.md, alignItems: 'center', borderRadius: borderRadius.lg },
  segmentActive: { backgroundColor: colors.surface, ...shadows.sm },
  segmentText: { fontFamily: fonts.bold, fontSize: 14, color: colors.textCaption },
  segmentTextActive: { color: colors.textPrimary },
  sectionHeader: {
    fontFamily: fonts.bold, fontSize: 11, color: colors.textCaption,
    textTransform: 'uppercase', letterSpacing: 1.5, marginLeft: 4, marginBottom: spacing.lg, marginTop: spacing.xl,
  },
  notifCard: {
    flexDirection: 'row', alignItems: 'flex-start', gap: spacing.xl,
    backgroundColor: colors.glassEnhanced, borderRadius: borderRadius['2xl'],
    padding: spacing.xl, marginBottom: spacing.lg, borderWidth: 1,
    borderColor: colors.glassBorder, overflow: 'hidden', ...shadows.sm,
  },
  notifCardOld: { opacity: 0.75 },
  unreadBar: {
    position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, borderRadius: 2,
  },
  notifIcon: {
    width: 48, height: 48, borderRadius: borderRadius.xl,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  notifContent: { flex: 1 },
  notifTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 },
  notifTypeLabel: { fontFamily: fonts.bold, fontSize: 11, textTransform: 'uppercase', letterSpacing: -0.3 },
  notifTime: { fontFamily: fonts.medium, fontSize: 10, color: colors.textCaption },
  notifTitle: { fontFamily: fonts.bold, fontSize: 14, color: colors.textPrimary, marginTop: 2 },
  notifBody: { fontFamily: fonts.medium, fontSize: 12, color: colors.textMuted, marginTop: 4, lineHeight: 17 },
  listContent: { paddingHorizontal: spacing.pagePaddingX, paddingBottom: spacing.bottomNavClearance },
  loader: { flex: 1, justifyContent: 'center' },
  emptyState: { alignItems: 'center', paddingVertical: spacing['5xl'], gap: spacing.lg },
  emptyText: { fontFamily: fonts.medium, fontSize: 14, color: colors.textMuted },
});
