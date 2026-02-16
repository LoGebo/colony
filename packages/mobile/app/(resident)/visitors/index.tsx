import { useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  FlatList,
  StyleSheet,
  RefreshControl,
  Alert,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useActiveInvitations, useCancelInvitation, useVisitorHistory } from '@/hooks/useVisitors';
import { formatDate, formatTime, isExpired, DAY_LABELS } from '@/lib/dates';
import { AmbientBackground } from '@/components/ui/AmbientBackground';
import { colors, fonts, spacing, borderRadius, shadows } from '@/theme';

type FilterTab = 'active' | 'pending' | 'history';

export default function VisitorsIndexScreen() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<FilterTab>('active');
  const { data: invitations, isLoading, refetch } = useActiveInvitations();
  const cancelMutation = useCancelInvitation();

  // History data
  const [historySearch, setHistorySearch] = useState('');
  const {
    data: historyData,
    isLoading: historyLoading,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    refetch: refetchHistory,
  } = useVisitorHistory(20);

  const allHistory = useMemo(() => {
    if (!historyData?.pages) return [];
    return historyData.pages.flatMap((page) => page.data);
  }, [historyData]);

  const filteredHistory = useMemo(() => {
    if (!historySearch.trim()) return allHistory;
    const lower = historySearch.toLowerCase();
    return allHistory.filter((inv: any) => inv.visitor_name?.toLowerCase().includes(lower));
  }, [allHistory, historySearch]);

  const handleLoadMore = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) fetchNextPage();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const filtered = (invitations ?? []).filter((inv) => {
    if (activeTab === 'active') return inv.status === 'approved';
    if (activeTab === 'pending') return inv.status === 'pending';
    return false;
  });

  const handleCancel = (id: string, name: string) => {
    if (Platform.OS === 'web') {
      if (window.confirm(`Are you sure you want to cancel the invitation for ${name}?`)) {
        cancelMutation.mutate(id);
      }
    } else {
      Alert.alert(
        'Cancel Invitation',
        `Are you sure you want to cancel the invitation for ${name}?`,
        [
          { text: 'No', style: 'cancel' },
          {
            text: 'Yes, Cancel',
            style: 'destructive',
            onPress: () => cancelMutation.mutate(id),
          },
        ]
      );
    }
  };

  const getInvitationIcon = (type: string): { name: keyof typeof Ionicons.glyphMap; bg: string; color: string } => {
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
  };

  const getStatusBadge = (status: string, invitation?: any) => {
    if (invitation?.cancelled_at) {
      return { label: 'CANCELLED', bg: colors.dangerBg, color: colors.dangerText };
    }
    if (invitation?.times_used && invitation?.max_uses && invitation.times_used >= invitation.max_uses) {
      return { label: 'USED', bg: colors.successBg, color: colors.successText };
    }
    if (status === 'approved' && invitation?.valid_until && isExpired(invitation.valid_until)) {
      return { label: 'EXPIRED', bg: 'rgba(226,232,240,0.5)', color: colors.textMuted };
    }
    switch (status) {
      case 'approved':
        return { label: 'ACTIVE', bg: colors.successBg, color: colors.successText };
      case 'pending':
        return { label: 'PENDING', bg: colors.warningBg, color: colors.warningText };
      case 'cancelled':
        return { label: 'CANCELLED', bg: colors.dangerBg, color: colors.dangerText };
      default:
        return { label: status.toUpperCase(), bg: colors.border, color: colors.textCaption };
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'single_use': return 'One-time Access';
      case 'recurring': return 'Recurring Access';
      case 'event': return 'Event Access';
      case 'vehicle_preauth': return 'Vehicle Pre-auth';
      default: return type;
    }
  };

  return (
    <View style={styles.container}>
      <AmbientBackground />

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Ionicons name="chevron-back" size={20} color={colors.textBody} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Invitations</Text>
        </View>
      </View>

      {/* Filter Tabs */}
      <View style={styles.filterContainer}>
        <View style={styles.filterRow}>
          {(['active', 'pending', 'history'] as FilterTab[]).map((tab) => (
            <TouchableOpacity
              key={tab}
              style={[styles.filterTab, activeTab === tab && styles.filterTabActive]}
              onPress={() => setActiveTab(tab)}
            >
              <Text style={[styles.filterTabText, activeTab === tab && styles.filterTabTextActive]}>
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* History Search Bar */}
      {activeTab === 'history' && (
        <View style={styles.searchContainer}>
          <View style={styles.searchBar}>
            <Ionicons name="search-outline" size={18} color={colors.textCaption} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search visitor name..."
              placeholderTextColor={colors.textCaption}
              value={historySearch}
              onChangeText={setHistorySearch}
            />
            {historySearch.length > 0 && (
              <TouchableOpacity onPress={() => setHistorySearch('')}>
                <Ionicons name="close-circle" size={18} color={colors.textCaption} />
              </TouchableOpacity>
            )}
          </View>
        </View>
      )}

      {/* Content: Active/Pending tabs */}
      {activeTab !== 'history' && (
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={false} onRefresh={refetch} tintColor={colors.primary} />}
        >
          {isLoading ? (
            <View style={styles.centerMessage}>
              <ActivityIndicator size="large" color={colors.primary} />
            </View>
          ) : filtered.length === 0 ? (
            <View style={styles.centerMessage}>
              <Ionicons name="people-outline" size={48} color={colors.textDisabled} />
              <Text style={styles.emptyTitle}>No {activeTab} invitations</Text>
              <Text style={styles.emptySubtitle}>Tap the + button to create a new invitation.</Text>
            </View>
          ) : (
            <View style={styles.invitationsList}>
              {filtered.map((invitation) => {
                const iconConfig = getInvitationIcon(invitation.invitation_type);
                const badge = getStatusBadge(invitation.status);
                const recurringDays = Array.isArray(invitation.recurring_days)
                  ? invitation.recurring_days
                  : [];

                return (
                  <View key={invitation.id} style={styles.card}>
                    <View style={styles.cardHeader}>
                      <View style={styles.cardHeaderLeft}>
                        <View style={[styles.cardIcon, { backgroundColor: iconConfig.bg }]}>
                          <Ionicons name={iconConfig.name as any} size={24} color={iconConfig.color} />
                        </View>
                        <View>
                          <Text style={styles.cardName}>{invitation.visitor_name}</Text>
                          <Text style={styles.cardType}>{getTypeLabel(invitation.invitation_type)}</Text>
                        </View>
                      </View>
                      <View style={[styles.statusBadge, { backgroundColor: badge.bg }]}>
                        <Text style={[styles.statusBadgeText, { color: badge.color }]}>{badge.label}</Text>
                      </View>
                    </View>

                    {invitation.invitation_type !== 'recurring' && (
                      <View style={styles.cardInfoRow}>
                        <View style={styles.cardInfoItem}>
                          <Ionicons name="calendar-outline" size={14} color={colors.textCaption} />
                          <Text style={styles.cardInfoText}>
                            {invitation.valid_from ? formatDate(invitation.valid_from) : 'Today'}
                          </Text>
                        </View>
                        {invitation.recurring_start_time && (
                          <View style={styles.cardInfoItem}>
                            <Ionicons name="time-outline" size={14} color={colors.textCaption} />
                            <Text style={styles.cardInfoText}>
                              {formatTime(invitation.recurring_start_time)}
                              {invitation.recurring_end_time ? ` - ${formatTime(invitation.recurring_end_time)}` : ''}
                            </Text>
                          </View>
                        )}
                      </View>
                    )}

                    {invitation.invitation_type === 'recurring' && recurringDays.length > 0 && (
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

                    <View style={styles.cardActions}>
                      <TouchableOpacity
                        style={styles.cardPrimaryAction}
                        onPress={() => router.push(`/(resident)/visitors/${invitation.id}`)}
                      >
                        <Ionicons name="qr-code-outline" size={16} color={colors.textOnDark} />
                        <Text style={styles.cardPrimaryActionText}>
                          {invitation.invitation_type === 'recurring' ? 'View Details' : 'Share QR'}
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.cardSecondaryAction}
                        onPress={() => handleCancel(invitation.id, invitation.visitor_name)}
                      >
                        <Ionicons name="trash-outline" size={20} color={colors.danger} />
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              })}
            </View>
          )}
        </ScrollView>
      )}

      {/* Content: History tab (inline FlatList with pagination) */}
      {activeTab === 'history' && (
        historyLoading ? (
          <View style={styles.centerMessage}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        ) : filteredHistory.length === 0 ? (
          <View style={styles.centerMessage}>
            <Ionicons name="people-outline" size={48} color={colors.textDisabled} />
            <Text style={styles.emptyTitle}>No visitor history</Text>
            <Text style={styles.emptySubtitle}>
              {historySearch ? 'No results match your search.' : 'Your visitor history will appear here.'}
            </Text>
          </View>
        ) : (
          <FlatList
            data={filteredHistory}
            keyExtractor={(item: any) => item.id}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            onEndReached={handleLoadMore}
            onEndReachedThreshold={0.5}
            refreshControl={
              <RefreshControl refreshing={false} onRefresh={() => refetchHistory()} tintColor={colors.primary} />
            }
            renderItem={({ item }: { item: any }) => {
              const badge = getStatusBadge(item.status, item);
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
            }}
            ListFooterComponent={
              isFetchingNextPage ? (
                <View style={styles.loadingMore}>
                  <ActivityIndicator size="small" color={colors.primary} />
                  <Text style={styles.loadingMoreText}>Loading more...</Text>
                </View>
              ) : null
            }
          />
        )
      )}

      {/* FAB */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => router.push('/(resident)/visitors/create')}
        activeOpacity={0.9}
      >
        <Ionicons name="add" size={24} color={colors.textOnDark} />
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
  // Filter
  filterContainer: {
    paddingHorizontal: spacing.pagePaddingX,
    marginBottom: spacing['3xl'],
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
    color: colors.textPrimary,
  },
  // ScrollView
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: spacing.pagePaddingX,
    paddingBottom: spacing.bottomNavClearance + 20,
  },
  // Empty / Loading
  centerMessage: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 80,
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
  // Invitation Cards
  invitationsList: {
    gap: spacing.xl,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius['2xl'],
    padding: spacing.cardPadding,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.xl,
    ...shadows.sm,
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
  // Info Row
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
  // Recurring Days
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
  // Actions
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
  cardSecondaryAction: {
    width: spacing.smallButtonHeight,
    height: spacing.smallButtonHeight,
    backgroundColor: colors.border,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
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
  // Dimmed card
  cardDimmed: {
    opacity: 0.6,
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
  // FAB
  fab: {
    position: 'absolute',
    bottom: spacing.bottomNavClearance + 12,
    right: spacing.pagePaddingX,
    width: 56,
    height: 56,
    borderRadius: borderRadius.full,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.blueGlow,
  },
});
