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

function getInvitationIcon(type: string): { name: keyof typeof Ionicons.glyphMap; bg: string; color: string } {
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

  const handleLoadMore = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const renderItem = useCallback(
    ({ item }: { item: HistoryInvitation }) => {
      const badge = getStatusBadge(item);
      const iconConfig = getInvitationIcon(item.invitation_type);
      const isCancelled = !!item.cancelled_at;
      const isExpiredStatus = badge.label === 'EXPIRED';
      const dimmed = isCancelled || isExpiredStatus;
      const recurringDays = Array.isArray(item.recurring_days) ? item.recurring_days : [];

      return (
        <TouchableOpacity
          style={[styles.card, dimmed && styles.cardDimmed]}
          onPress={() => router.push(`/(resident)/visitors/${item.id}`)}
          activeOpacity={0.7}
        >
          {/* Card Header */}
          <View style={styles.cardHeader}>
            <View style={styles.cardHeaderLeft}>
              <View style={[styles.cardIcon, { backgroundColor: iconConfig.bg }]}>
                <Ionicons name={iconConfig.name as any} size={24} color={iconConfig.color} />
              </View>
              <View>
                <Text style={styles.cardName}>{item.visitor_name}</Text>
                <Text style={styles.cardType}>{getTypeLabel(item.invitation_type)}</Text>
              </View>
            </View>
            <View style={[styles.statusBadge, { backgroundColor: badge.bg }]}>
              <Text style={[styles.statusBadgeText, { color: badge.color }]}>{badge.label}</Text>
            </View>
          </View>

          {/* Date/Time Info */}
          {item.invitation_type !== 'recurring' && item.valid_from && (
            <View style={styles.cardInfoRow}>
              <View style={styles.cardInfoItem}>
                <Ionicons name="calendar-outline" size={14} color={colors.textCaption} />
                <Text style={styles.cardInfoText}>{formatDate(item.valid_from)}</Text>
              </View>
              {item.recurring_start_time && (
                <View style={styles.cardInfoItem}>
                  <Ionicons name="time-outline" size={14} color={colors.textCaption} />
                  <Text style={styles.cardInfoText}>
                    {formatTime(item.recurring_start_time)}
                    {item.recurring_end_time ? ` - ${formatTime(item.recurring_end_time)}` : ''}
                  </Text>
                </View>
              )}
            </View>
          )}

          {/* Recurring Days */}
          {item.invitation_type === 'recurring' && recurringDays.length > 0 && (
            <View style={styles.recurringDaysContainer}>
              <View style={styles.recurringDaysRow}>
                {recurringDays.map((day: number) => (
                  <View key={day} style={styles.dayPill}>
                    <Text style={styles.dayPillText}>
                      {(DAY_LABELS[day] ?? '').slice(0, 3)}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* View Details action */}
          <View style={styles.cardActions}>
            <TouchableOpacity
              style={styles.cardPrimaryAction}
              onPress={() => router.push(`/(resident)/visitors/${item.id}`)}
            >
              <Ionicons name="eye-outline" size={16} color={colors.textOnDark} />
              <Text style={styles.cardPrimaryActionText}>View Details</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      );
    },
    [router]
  );

  return (
    <View style={styles.container}>
      <AmbientBackground />

      {/* Header - matches index */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Ionicons name="chevron-back" size={20} color={colors.textBody} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Invitations</Text>
        </View>
      </View>

      {/* Filter Tabs - matches index */}
      <View style={styles.filterContainer}>
        <View style={styles.filterRow}>
          <TouchableOpacity
            style={styles.filterTab}
            onPress={() => router.replace('/(resident)/visitors/')}
          >
            <Text style={styles.filterTabText}>Active</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.filterTab}
            onPress={() => router.replace('/(resident)/visitors/')}
          >
            <Text style={styles.filterTabText}>Pending</Text>
          </TouchableOpacity>
          <View style={[styles.filterTab, styles.filterTabActive]}>
            <Text style={styles.filterTabTextActive}>History</Text>
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
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch('')}>
              <Ionicons name="close-circle" size={18} color={colors.textCaption} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Content */}
      {isLoading ? (
        <View style={styles.centerMessage}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : filtered.length === 0 ? (
        <View style={styles.centerMessage}>
          <Ionicons name="people-outline" size={48} color={colors.textDisabled} />
          <Text style={styles.emptyTitle}>No visitor history</Text>
          <Text style={styles.emptySubtitle}>
            {search ? 'No results match your search.' : 'Your visitor history will appear here.'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
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
  // Header - matches index
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: spacing.safeAreaTop,
    paddingHorizontal: spacing.pagePaddingX,
    paddingBottom: spacing.xl,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.full,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.sm,
  },
  headerTitle: {
    fontFamily: fonts.bold,
    fontSize: 24,
    color: colors.textPrimary,
    letterSpacing: -0.5,
  },
  // Filter - matches index
  filterContainer: {
    paddingHorizontal: spacing.pagePaddingX,
    marginBottom: spacing.md,
  },
  filterRow: {
    flexDirection: 'row',
    backgroundColor: 'rgba(226,232,240,0.5)',
    borderRadius: borderRadius.lg,
    padding: 4,
  },
  filterTab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: borderRadius.md,
  },
  filterTabActive: {
    backgroundColor: colors.surface,
    ...shadows.sm,
  },
  filterTabText: {
    fontFamily: fonts.bold,
    fontSize: 14,
    color: colors.textMuted,
  },
  filterTabTextActive: {
    fontFamily: fonts.bold,
    fontSize: 14,
    color: colors.textPrimary,
  },
  // Search
  searchContainer: {
    paddingHorizontal: spacing.pagePaddingX,
    paddingTop: spacing.lg,
    paddingBottom: spacing.lg,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.xl,
    height: 44,
    gap: spacing.md,
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
    gap: spacing.xl,
  },
  // Cards - matches index design
  card: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius['2xl'],
    padding: spacing.cardPadding,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.xl,
    ...shadows.sm,
  },
  cardDimmed: {
    opacity: 0.6,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  cardHeaderLeft: {
    flexDirection: 'row',
    gap: spacing.xl,
  },
  cardIcon: {
    width: 48,
    height: 48,
    borderRadius: borderRadius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardName: {
    fontFamily: fonts.bold,
    fontSize: 16,
    color: colors.textPrimary,
  },
  cardType: {
    fontFamily: fonts.medium,
    fontSize: 12,
    color: colors.textMuted,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: borderRadius.sm,
  },
  statusBadgeText: {
    fontFamily: fonts.bold,
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  // Info Row - matches index
  cardInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing['3xl'],
    paddingVertical: spacing.md,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: colors.border,
  },
  cardInfoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  cardInfoText: {
    fontFamily: fonts.bold,
    fontSize: 12,
    color: colors.textSecondary,
  },
  // Recurring Days - matches index
  recurringDaysContainer: {
    backgroundColor: colors.border,
    borderRadius: borderRadius.md,
    padding: spacing.lg,
  },
  recurringDaysRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  dayPill: {
    paddingHorizontal: spacing.md,
    paddingVertical: 2,
    backgroundColor: colors.surface,
    borderRadius: spacing.sm,
    borderWidth: 1,
    borderColor: colors.borderMedium,
  },
  dayPillText: {
    fontFamily: fonts.bold,
    fontSize: 10,
    color: colors.textBody,
  },
  // Actions - matches index
  cardActions: {
    flexDirection: 'row',
    gap: spacing.lg,
  },
  cardPrimaryAction: {
    flex: 1,
    height: spacing.smallButtonHeight,
    backgroundColor: colors.dark,
    borderRadius: borderRadius.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
  },
  cardPrimaryActionText: {
    fontFamily: fonts.bold,
    fontSize: 14,
    color: colors.textOnDark,
  },
  // Empty / Loading
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
