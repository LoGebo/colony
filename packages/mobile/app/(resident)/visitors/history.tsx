import { useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useVisitorHistory } from '@/hooks/useVisitors';
import { formatDate, formatTime, isExpired, DAY_LABELS } from '@/lib/dates';
import { AmbientBackground } from '@/components/ui/AmbientBackground';
import { colors, fonts, spacing, borderRadius, shadows } from '@/theme';

type HistoryInvitation = {
  id: string;
  visitor_name: string;
  invitation_type: string;
  status: string;
  valid_from: string | null;
  valid_until: string | null;
  visitor_phone: string | null;
  vehicle_plate: string | null;
  recurring_days: number[] | null;
  recurring_start_time: string | null;
  recurring_end_time: string | null;
  cancelled_at: string | null;
  created_at: string;
  times_used: number | null;
  max_uses: number | null;
  qr_codes: { id: string; status: string }[] | null;
  units: { unit_number: string } | null;
};

function getStatusBadge(invitation: HistoryInvitation) {
  if (invitation.cancelled_at) {
    return { label: 'CANCELLED', bg: colors.dangerBg, color: colors.dangerText };
  }
  if (invitation.times_used && invitation.max_uses && invitation.times_used >= invitation.max_uses) {
    return { label: 'USED', bg: colors.successBg, color: colors.successText };
  }
  if (invitation.status === 'approved' && invitation.valid_until && isExpired(invitation.valid_until)) {
    return { label: 'EXPIRED', bg: 'rgba(226,232,240,0.5)', color: colors.textMuted };
  }
  if (invitation.status === 'approved') {
    return { label: 'ACTIVE', bg: colors.successBg, color: colors.successText };
  }
  if (invitation.status === 'pending') {
    return { label: 'PENDING', bg: colors.warningBg, color: colors.warningText };
  }
  if (invitation.status === 'cancelled') {
    return { label: 'CANCELLED', bg: colors.dangerBg, color: colors.dangerText };
  }
  return { label: invitation.status?.toUpperCase() ?? 'UNKNOWN', bg: colors.border, color: colors.textCaption };
}

function getTypeIcon(type: string): { name: keyof typeof Ionicons.glyphMap; bg: string; color: string } {
  switch (type) {
    case 'recurring':
      return { name: 'repeat-outline', bg: colors.tealLight, color: colors.tealDark };
    case 'event':
      return { name: 'sparkles-outline', bg: colors.warningBgLight, color: colors.warningText };
    case 'vehicle_preauth':
      return { name: 'car-outline', bg: colors.indigoBg, color: colors.indigo };
    default:
      return { name: 'person-outline', bg: colors.primaryLight, color: colors.primary };
  }
}

function getTypeLabel(type: string): string {
  switch (type) {
    case 'single_use': return 'One-time Access';
    case 'recurring': return 'Recurring Access';
    case 'event': return 'Event Access';
    case 'vehicle_preauth': return 'Vehicle Pre-auth';
    default: return type;
  }
}

/** Group invitations by date for timeline display */
function groupByDate(items: HistoryInvitation[]): { title: string; data: HistoryInvitation[] }[] {
  const map = new Map<string, HistoryInvitation[]>();

  for (const item of items) {
    const dateStr = item.created_at ? item.created_at.slice(0, 10) : 'unknown';
    const group = map.get(dateStr);
    if (group) {
      group.push(item);
    } else {
      map.set(dateStr, [item]);
    }
  }

  const today = new Date().toISOString().slice(0, 10);
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);

  return Array.from(map.entries()).map(([dateStr, data]) => {
    let title: string;
    if (dateStr === today) {
      title = 'Today';
    } else if (dateStr === yesterday) {
      title = 'Yesterday';
    } else {
      title = formatDate(dateStr);
    }
    return { title, data };
  });
}

export default function VisitorHistoryScreen() {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const { data, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage, refetch } =
    useVisitorHistory(20);

  const allInvitations = useMemo(() => {
    if (!data?.pages) return [];
    return data.pages.flatMap((page) => page.data) as HistoryInvitation[];
  }, [data]);

  const filtered = useMemo(() => {
    if (!search.trim()) return allInvitations;
    const lower = search.toLowerCase();
    return allInvitations.filter(
      (inv) => inv.visitor_name?.toLowerCase().includes(lower)
    );
  }, [allInvitations, search]);

  const groupedData = useMemo(() => groupByDate(filtered), [filtered]);

  // Flatten groups into a list with section headers for FlatList
  const flatData = useMemo(() => {
    const items: ({ type: 'header'; title: string; id: string } | { type: 'item'; invitation: HistoryInvitation; id: string })[] = [];
    for (const group of groupedData) {
      items.push({ type: 'header', title: group.title, id: `header-${group.title}` });
      for (const inv of group.data) {
        items.push({ type: 'item', invitation: inv, id: inv.id });
      }
    }
    return items;
  }, [groupedData]);

  const handleLoadMore = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const renderItem = useCallback(
    ({ item }: { item: (typeof flatData)[number] }) => {
      if (item.type === 'header') {
        return (
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionHeaderText}>{item.title}</Text>
          </View>
        );
      }

      const inv = item.invitation;
      const badge = getStatusBadge(inv);
      const iconConfig = getTypeIcon(inv.invitation_type);
      const isCancelled = !!inv.cancelled_at;
      const isExpiredStatus = badge.label === 'EXPIRED';
      const dimmed = isCancelled || isExpiredStatus;

      return (
        <TouchableOpacity
          style={styles.timelineRow}
          onPress={() => router.push(`/(resident)/visitors/${inv.id}`)}
          activeOpacity={0.7}
        >
          {/* Timeline dot */}
          <View
            style={[
              styles.timelineDot,
              { backgroundColor: dimmed ? colors.border : iconConfig.bg },
            ]}
          >
            <Ionicons
              name={iconConfig.name as any}
              size={20}
              color={dimmed ? colors.textCaption : iconConfig.color}
            />
          </View>

          {/* Card */}
          <View style={[styles.historyCard, dimmed && styles.historyCardDimmed]}>
            <View style={styles.cardTopRow}>
              <Text style={styles.cardName}>{inv.visitor_name}</Text>
              <View style={[styles.statusBadge, { backgroundColor: badge.bg }]}>
                <Text style={[styles.statusBadgeText, { color: badge.color }]}>{badge.label}</Text>
              </View>
            </View>

            <Text style={styles.cardSubtitle}>
              {inv.units?.unit_number ? `Unit ${inv.units.unit_number} \u2022 ` : ''}
              {getTypeLabel(inv.invitation_type)}
            </Text>

            {/* Recurring days */}
            {inv.invitation_type === 'recurring' && Array.isArray(inv.recurring_days) && inv.recurring_days.length > 0 && (
              <View style={styles.recurringRow}>
                {inv.recurring_days.map((day: number) => (
                  <View key={day} style={styles.miniDayPill}>
                    <Text style={styles.miniDayPillText}>{(DAY_LABELS[day] ?? '').slice(0, 3)}</Text>
                  </View>
                ))}
              </View>
            )}

            {/* Date info */}
            <View style={styles.dateInfoRow}>
              {inv.valid_from && (
                <View style={styles.dateInfoItem}>
                  <Ionicons name="calendar-outline" size={12} color={colors.textCaption} />
                  <Text style={styles.dateInfoText}>{formatDate(inv.valid_from)}</Text>
                </View>
              )}
              {inv.recurring_start_time && (
                <View style={styles.dateInfoItem}>
                  <Ionicons name="time-outline" size={12} color={colors.textCaption} />
                  <Text style={styles.dateInfoText}>
                    {formatTime(inv.recurring_start_time)}
                    {inv.recurring_end_time ? ` - ${formatTime(inv.recurring_end_time)}` : ''}
                  </Text>
                </View>
              )}
              {inv.vehicle_plate && (
                <View style={styles.dateInfoItem}>
                  <Ionicons name="car-outline" size={12} color={colors.textCaption} />
                  <Text style={styles.dateInfoText}>{inv.vehicle_plate}</Text>
                </View>
              )}
            </View>
          </View>
        </TouchableOpacity>
      );
    },
    [router]
  );

  return (
    <View style={styles.container}>
      <AmbientBackground />

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Ionicons name="chevron-back" size={20} color={colors.textBody} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Visitor History</Text>
          <View style={styles.headerSpacer} />
        </View>

        {/* Sub-navigation tabs */}
        <View style={styles.subNav}>
          <TouchableOpacity
            style={styles.subNavTab}
            onPress={() => router.replace('/(resident)/visitors/create')}
          >
            <Text style={styles.subNavTabText}>New</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.subNavTab}
            onPress={() => router.replace('/(resident)/visitors/')}
          >
            <Text style={styles.subNavTabText}>Active</Text>
          </TouchableOpacity>
          <View style={[styles.subNavTab, styles.subNavTabActive]}>
            <Text style={styles.subNavTabTextActive}>History</Text>
          </View>
        </View>
      </View>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <View style={styles.searchBar}>
          <Ionicons name="search-outline" size={18} color={colors.textCaption} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search visitor name..."
            placeholderTextColor={colors.textCaption}
            value={search}
            onChangeText={setSearch}
          />
          <Ionicons name="calendar-outline" size={18} color={colors.textCaption} />
        </View>
      </View>

      {/* Content */}
      {isLoading ? (
        <View style={styles.centerMessage}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : flatData.length === 0 ? (
        <View style={styles.centerMessage}>
          <Ionicons name="time-outline" size={48} color={colors.textDisabled} />
          <Text style={styles.emptyTitle}>No visitor history</Text>
          <Text style={styles.emptySubtitle}>
            {search ? 'No results match your search.' : 'Your visitor history will appear here.'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={flatData}
          renderItem={renderItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.5}
          refreshControl={
            <RefreshControl refreshing={false} onRefresh={() => refetch()} tintColor={colors.primary} />
          }
          ListFooterComponent={
            isFetchingNextPage ? (
              <View style={styles.loadingMore}>
                <ActivityIndicator size="small" color={colors.primary} />
                <Text style={styles.loadingMoreText}>Loading more...</Text>
              </View>
            ) : null
          }
        />
      )}
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
    backgroundColor: colors.glass,
    borderBottomWidth: 0,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
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
  },
  headerTitle: {
    fontFamily: fonts.bold,
    fontSize: 18,
    color: colors.textPrimary,
  },
  headerSpacer: {
    width: 40,
  },
  // Sub-navigation
  subNav: {
    flexDirection: 'row',
    backgroundColor: 'rgba(226,232,240,0.5)',
    borderRadius: borderRadius.md,
    padding: 4,
    marginTop: spacing.xl,
  },
  subNavTab: {
    flex: 1,
    paddingVertical: spacing.md,
    alignItems: 'center',
    borderRadius: borderRadius.sm,
  },
  subNavTabActive: {
    backgroundColor: colors.surface,
    ...shadows.sm,
  },
  subNavTabText: {
    fontFamily: fonts.bold,
    fontSize: 12,
    color: colors.textMuted,
  },
  subNavTabTextActive: {
    fontFamily: fonts.bold,
    fontSize: 12,
    color: colors.textPrimary,
  },
  // Search
  searchContainer: {
    paddingHorizontal: spacing.pagePaddingX,
    paddingTop: spacing.xl,
    paddingBottom: spacing.xl,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(226,232,240,0.4)',
    borderRadius: borderRadius.lg,
    paddingHorizontal: spacing.xl,
    height: 48,
    gap: spacing.md,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  searchInput: {
    flex: 1,
    fontFamily: fonts.medium,
    fontSize: 14,
    color: colors.textPrimary,
    height: '100%',
  },
  // List
  listContent: {
    paddingHorizontal: spacing.pagePaddingX,
    paddingBottom: spacing.bottomNavClearance + 20,
  },
  // Section Headers
  sectionHeader: {
    marginTop: spacing['3xl'],
    marginBottom: spacing.xl,
  },
  sectionHeaderText: {
    fontFamily: fonts.bold,
    fontSize: 11,
    color: colors.textCaption,
    textTransform: 'uppercase',
    letterSpacing: 2,
  },
  // Timeline items
  timelineRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.xl,
    marginBottom: spacing.xl,
  },
  timelineDot: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  historyCard: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.xl,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.sm,
  },
  historyCardDimmed: {
    opacity: 0.7,
  },
  cardTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  cardName: {
    fontFamily: fonts.bold,
    fontSize: 14,
    color: colors.textPrimary,
    flex: 1,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: borderRadius.full,
    marginLeft: spacing.md,
  },
  statusBadgeText: {
    fontFamily: fonts.bold,
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  cardSubtitle: {
    fontFamily: fonts.medium,
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 2,
  },
  recurringRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginTop: spacing.md,
  },
  miniDayPill: {
    paddingHorizontal: spacing.md,
    paddingVertical: 2,
    backgroundColor: colors.surface,
    borderRadius: spacing.xs,
    borderWidth: 1,
    borderColor: colors.borderMedium,
  },
  miniDayPillText: {
    fontFamily: fonts.bold,
    fontSize: 10,
    color: colors.textBody,
  },
  dateInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xl,
    marginTop: spacing.lg,
  },
  dateInfoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  dateInfoText: {
    fontFamily: fonts.medium,
    fontSize: 11,
    color: colors.textCaption,
  },
  // Empty State
  centerMessage: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.pagePaddingX,
    gap: spacing.lg,
  },
  emptyTitle: {
    fontFamily: fonts.bold,
    fontSize: 18,
    color: colors.textSecondary,
  },
  emptySubtitle: {
    fontFamily: fonts.medium,
    fontSize: 14,
    color: colors.textMuted,
    textAlign: 'center',
  },
  // Loading more
  loadingMore: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing['3xl'],
    gap: spacing.md,
  },
  loadingMoreText: {
    fontFamily: fonts.medium,
    fontSize: 13,
    color: colors.textCaption,
  },
});
