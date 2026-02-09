import { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
  type ViewStyle,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useMyTickets } from '@/hooks/useTickets';
import { formatRelative } from '@/lib/dates';
import { AmbientBackground } from '@/components/ui/AmbientBackground';
import { GlassCard } from '@/components/ui/GlassCard';
import { colors, fonts, spacing, borderRadius, shadows } from '@/theme';

type StatusFilter = 'all' | 'open' | 'in_progress' | 'resolved';

const STATUS_FILTERS: { key: StatusFilter; label: string }[] = [
  { key: 'all', label: 'All Tickets' },
  { key: 'open', label: 'Open' },
  { key: 'in_progress', label: 'In Progress' },
  { key: 'resolved', label: 'Resolved' },
];

function getStatusStyle(status: string): { bg: string; color: string; label: string } {
  switch (status) {
    case 'open':
      return { bg: colors.primaryLight, color: colors.primary, label: 'Open' };
    case 'in_progress':
      return { bg: colors.warningBg, color: colors.warningText, label: 'In Progress' };
    case 'resolved':
      return { bg: colors.successBg, color: colors.successText, label: 'Resolved' };
    case 'closed':
      return { bg: colors.border, color: colors.textCaption, label: 'Closed' };
    default:
      return { bg: colors.border, color: colors.textCaption, label: status };
  }
}

function getPriorityStyle(priority: string): { bg: string; color: string; label: string } {
  switch (priority) {
    case 'low':
      return { bg: colors.border, color: colors.textCaption, label: 'Low' };
    case 'medium':
      return { bg: colors.warningBg, color: colors.warningText, label: 'Medium' };
    case 'high':
      return { bg: colors.orangeBg, color: colors.orange, label: 'High' };
    case 'urgent':
      return { bg: colors.dangerBg, color: colors.dangerText, label: 'Urgent' };
    default:
      return { bg: colors.border, color: colors.textCaption, label: priority };
  }
}

function getCategoryIcon(icon: string | null): string {
  if (!icon) return 'construct-outline';
  // Map common Lucide/generic icon names to Ionicons
  const iconMap: Record<string, string> = {
    droplet: 'water-outline',
    zap: 'flash-outline',
    layout: 'grid-outline',
    thermometer: 'thermometer-outline',
    wrench: 'construct-outline',
    shield: 'shield-outline',
    wifi: 'wifi-outline',
    key: 'key-outline',
    home: 'home-outline',
  };
  return iconMap[icon] ?? 'construct-outline';
}

interface Ticket {
  id: string;
  title: string;
  status: string;
  priority: string;
  created_at: string;
  ticket_categories: { name: string; icon: string | null; color: string | null } | null;
}

export default function MaintenanceIndexScreen() {
  const router = useRouter();
  const { data: tickets, refetch, isLoading, isRefetching } = useMyTickets();
  const [activeFilter, setActiveFilter] = useState<StatusFilter>('all');

  const filteredTickets = useMemo(() => {
    const allTickets = (tickets ?? []) as Ticket[];
    if (activeFilter === 'all') return allTickets;
    return allTickets.filter((t) => t.status === activeFilter);
  }, [tickets, activeFilter]);

  const onRefresh = useCallback(async () => {
    await refetch();
  }, [refetch]);

  const renderTicket = useCallback(
    ({ item }: { item: Ticket }) => {
      const category = item.ticket_categories;
      const statusStyle = getStatusStyle(item.status);
      const priorityStyle = getPriorityStyle(item.priority);
      const isResolved = item.status === 'resolved' || item.status === 'closed';

      const cardStyle: ViewStyle = isResolved
        ? { ...styles.ticketCard, ...styles.ticketCardResolved }
        : styles.ticketCard;

      return (
        <TouchableOpacity onPress={() => router.push(`/(resident)/maintenance/${item.id}`)}>
          <GlassCard
            variant={isResolved ? 'standard' : 'dense'}
            style={cardStyle}
          >
            {/* Top Row: Category + Status */}
            <View style={styles.ticketTop}>
              <View style={styles.categoryRow}>
                <View
                  style={[
                    styles.categoryIcon,
                    { backgroundColor: isResolved ? colors.border : (category?.color ? `${category.color}15` : colors.primaryLight) },
                  ]}
                >
                  <Ionicons
                    name={getCategoryIcon(category?.icon ?? null) as any}
                    size={16}
                    color={isResolved ? colors.textCaption : (category?.color ?? colors.primary)}
                  />
                </View>
                <Text style={[styles.categoryLabel, isResolved && styles.textFaded]}>
                  {category?.name ?? 'General'}
                </Text>
              </View>
              <View style={[styles.statusBadge, { backgroundColor: statusStyle.bg }]}>
                <Text style={[styles.statusBadgeText, { color: statusStyle.color }]}>
                  {statusStyle.label}
                </Text>
              </View>
            </View>

            {/* Title */}
            <Text
              style={[styles.ticketTitle, isResolved && styles.ticketTitleResolved]}
              numberOfLines={1}
            >
              {item.title}
            </Text>

            {/* Bottom Row: Date + Priority */}
            <View style={styles.ticketBottom}>
              <Text style={styles.ticketDate}>{formatRelative(item.created_at)}</Text>
              <View style={[styles.priorityBadge, { backgroundColor: priorityStyle.bg }]}>
                <Ionicons
                  name={item.priority === 'high' || item.priority === 'urgent' ? 'alert-circle' : 'information-circle'}
                  size={12}
                  color={priorityStyle.color}
                />
                <Text style={[styles.priorityBadgeText, { color: priorityStyle.color }]}>
                  {priorityStyle.label}
                </Text>
              </View>
            </View>
          </GlassCard>
        </TouchableOpacity>
      );
    },
    [router],
  );

  const renderEmpty = useCallback(() => {
    if (isLoading) return null;
    return (
      <View style={styles.emptyState}>
        <View style={styles.emptyIconBox}>
          <Ionicons name="clipboard-outline" size={40} color={colors.textDisabled} />
        </View>
        <Text style={styles.emptyTitle}>No Active Reports</Text>
        <Text style={styles.emptySubtitle}>
          Everything looks great! If something needs fixing, tap the plus button.
        </Text>
      </View>
    );
  }, [isLoading]);

  return (
    <View style={styles.container}>
      <AmbientBackground />

      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Maintenance</Text>
          <Text style={styles.headerSubtitle}>Community service requests</Text>
        </View>
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => router.push('/(resident)/maintenance/create')}
        >
          <Ionicons name="add" size={22} color={colors.textOnDark} />
        </TouchableOpacity>
      </View>

      {/* Filter Pills */}
      <View style={styles.filterRow}>
        <FlatList
          data={STATUS_FILTERS}
          keyExtractor={(item) => item.key}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterListContent}
          renderItem={({ item: filter }) => {
            const active = activeFilter === filter.key;
            return (
              <TouchableOpacity
                style={[styles.filterPill, active && styles.filterPillActive]}
                onPress={() => setActiveFilter(filter.key)}
              >
                <Text style={[styles.filterText, active && styles.filterTextActive]}>
                  {filter.label}
                </Text>
              </TouchableOpacity>
            );
          }}
        />
      </View>

      {/* Ticket List */}
      {isLoading ? (
        <ActivityIndicator color={colors.primary} style={styles.mainLoader} />
      ) : (
        <FlatList
          data={filteredTickets}
          keyExtractor={(item) => item.id}
          renderItem={renderTicket}
          ListEmptyComponent={renderEmpty}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={onRefresh}
              tintColor={colors.primary}
            />
          }
        />
      )}

      {/* FAB */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => router.push('/(resident)/maintenance/create')}
      >
        <Ionicons name="add" size={28} color={colors.textOnDark} />
      </TouchableOpacity>
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTitle: {
    fontFamily: fonts.black,
    fontSize: 24,
    color: colors.textPrimary,
    letterSpacing: -0.5,
  },
  headerSubtitle: {
    fontFamily: fonts.medium,
    fontSize: 14,
    color: colors.textMuted,
    marginTop: 2,
  },
  addButton: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.full,
    backgroundColor: colors.dark,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.lg,
  },
  // Filter Pills
  filterRow: {
    marginTop: spacing['3xl'],
    marginBottom: spacing.md,
  },
  filterListContent: {
    paddingHorizontal: spacing.pagePaddingX,
    gap: spacing.lg,
  },
  filterPill: {
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.full,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderMedium,
  },
  filterPillActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  filterText: {
    fontFamily: fonts.bold,
    fontSize: 12,
    color: colors.textMuted,
  },
  filterTextActive: {
    color: colors.textOnDark,
  },
  // Ticket List
  listContent: {
    paddingHorizontal: spacing.pagePaddingX,
    paddingTop: spacing.xl,
    paddingBottom: spacing.bottomNavClearance + 16,
    gap: spacing.xl,
  },
  ticketCard: {
    padding: spacing.xl,
    borderRadius: borderRadius.lg,
  },
  ticketCardResolved: {
    opacity: 0.7,
  },
  ticketTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  categoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  categoryIcon: {
    width: 32,
    height: 32,
    borderRadius: borderRadius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryLabel: {
    fontFamily: fonts.black,
    fontSize: 10,
    color: colors.textCaption,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
  },
  textFaded: {
    color: colors.textDisabled,
  },
  statusBadge: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.sm,
  },
  statusBadgeText: {
    fontFamily: fonts.bold,
    fontSize: 10,
    textTransform: 'uppercase',
  },
  ticketTitle: {
    fontFamily: fonts.bold,
    fontSize: 16,
    color: colors.textPrimary,
    marginBottom: spacing.xl,
  },
  ticketTitleResolved: {
    color: colors.textCaption,
    textDecorationLine: 'line-through',
  },
  ticketBottom: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  ticketDate: {
    fontFamily: fonts.medium,
    fontSize: 10,
    color: colors.textCaption,
    fontStyle: 'italic',
  },
  priorityBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  priorityBadgeText: {
    fontFamily: fonts.bold,
    fontSize: 12,
  },
  // Empty
  emptyState: {
    alignItems: 'center',
    paddingVertical: spacing['6xl'] * 1.5,
    gap: spacing.xl,
  },
  emptyIconBox: {
    width: 80,
    height: 80,
    borderRadius: borderRadius.full,
    backgroundColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  emptyTitle: {
    fontFamily: fonts.bold,
    fontSize: 18,
    color: colors.textPrimary,
  },
  emptySubtitle: {
    fontFamily: fonts.medium,
    fontSize: 14,
    color: colors.textMuted,
    textAlign: 'center',
    paddingHorizontal: spacing['4xl'],
  },
  // FAB
  fab: {
    position: 'absolute',
    bottom: spacing.bottomNavClearance + 16,
    right: spacing.pagePaddingX,
    width: 56,
    height: 56,
    borderRadius: borderRadius.full,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.blueGlow,
  },
  mainLoader: {
    flex: 1,
    justifyContent: 'center',
  },
});
