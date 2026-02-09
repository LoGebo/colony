import { useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, TextInput, RefreshControl } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import { queryKeys } from '@upoe/shared';
import { AmbientBackground } from '@/components/ui/AmbientBackground';
import { GlassCard } from '@/components/ui/GlassCard';
import { colors, fonts, spacing, borderRadius, shadows } from '@/theme';

type FilterTab = 'residents' | 'units' | 'tickets';

export default function AdminManage() {
  const { communityId } = useAuth();
  const [activeTab, setActiveTab] = useState<FilterTab>('residents');
  const [searchQuery, setSearchQuery] = useState('');

  // -- Residents list (inline query) --
  const {
    data: residents,
    refetch: refetchResidents,
  } = useQuery({
    queryKey: [...queryKeys.residents.list(communityId!).queryKey, 'admin-manage'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('residents')
        .select('id, first_name, paternal_surname, email, phone, onboarding_status, created_at')
        .eq('community_id', communityId!)
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      return data;
    },
    enabled: !!communityId && activeTab === 'residents',
  });

  // -- Units list (inline query) --
  const {
    data: units,
    refetch: refetchUnits,
  } = useQuery({
    queryKey: [...queryKeys.units.list(communityId!).queryKey, 'admin-manage'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('units')
        .select('id, unit_number, building, floor_number, unit_type, status')
        .eq('community_id', communityId!)
        .order('unit_number', { ascending: true })
        .limit(50);
      if (error) throw error;
      return data;
    },
    enabled: !!communityId && activeTab === 'units',
  });

  // -- Open tickets (inline query) --
  const {
    data: tickets,
    refetch: refetchTickets,
  } = useQuery({
    queryKey: [...queryKeys.tickets.list(communityId!).queryKey, 'admin-manage'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tickets')
        .select('id, title, status, priority, created_at')
        .eq('community_id', communityId!)
        .in('status', ['open', 'in_progress'] as never)
        .order('created_at', { ascending: false })
        .limit(30);
      if (error) throw error;
      return data;
    },
    enabled: !!communityId && activeTab === 'tickets',
  });

  const onRefresh = useCallback(async () => {
    if (activeTab === 'residents') await refetchResidents();
    else if (activeTab === 'units') await refetchUnits();
    else await refetchTickets();
  }, [activeTab, refetchResidents, refetchUnits, refetchTickets]);

  // Filter helpers
  const filteredResidents = (residents ?? []).filter((r) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      r.first_name?.toLowerCase().includes(q) ||
      r.paternal_surname?.toLowerCase().includes(q) ||
      r.email?.toLowerCase().includes(q)
    );
  });

  const filteredUnits = (units ?? []).filter((u) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      u.unit_number?.toLowerCase().includes(q) ||
      u.building?.toLowerCase().includes(q)
    );
  });

  const filteredTickets = (tickets ?? []).filter((t) => {
    if (!searchQuery) return true;
    return t.title?.toLowerCase().includes(searchQuery.toLowerCase());
  });

  const getPriorityStyle = (priority: string) => {
    switch (priority) {
      case 'urgent':
        return { bg: colors.dangerBg, text: colors.danger };
      case 'high':
        return { bg: colors.warningBg, text: colors.warningText };
      case 'medium':
        return { bg: colors.warningBg, text: colors.warning };
      default:
        return { bg: colors.primaryLight, text: colors.primary };
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return colors.success;
      case 'active':
        return colors.success;
      case 'occupied':
        return colors.success;
      case 'in_progress':
        return colors.warning;
      default:
        return colors.textCaption;
    }
  };

  return (
    <View style={styles.container}>
      <AmbientBackground />

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Manage</Text>
      </View>

      {/* Search */}
      <View style={styles.searchContainer}>
        <View style={styles.searchBox}>
          <Ionicons name="search" size={18} color={colors.textCaption} />
          <TextInput
            style={styles.searchInput}
            placeholder={`Search ${activeTab}...`}
            placeholderTextColor={colors.textDisabled}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={18} color={colors.textCaption} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Tab Filters */}
      <View style={styles.tabContainer}>
        <View style={styles.tabRow}>
          {(['residents', 'units', 'tickets'] as const).map((tab) => (
            <TouchableOpacity
              key={tab}
              style={[styles.tab, activeTab === tab && styles.tabActive]}
              onPress={() => { setActiveTab(tab); setSearchQuery(''); }}
            >
              <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
                {tab === 'residents' ? 'Residents' : tab === 'units' ? 'Units' : 'Tickets'}
              </Text>
            </TouchableOpacity>
          ))}
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
        {/* Residents Tab */}
        {activeTab === 'residents' && (
          <View style={styles.listContainer}>
            {filteredResidents.length === 0 && (
              <View style={styles.emptyState}>
                <Ionicons name="people-outline" size={40} color={colors.textDisabled} />
                <Text style={styles.emptyText}>No residents found</Text>
              </View>
            )}
            {filteredResidents.map((resident) => (
              <GlassCard key={resident.id} style={styles.listCard}>
                <View style={styles.avatarCircle}>
                  <Text style={styles.avatarInitial}>
                    {(resident.first_name?.[0] ?? '').toUpperCase()}
                    {(resident.paternal_surname?.[0] ?? '').toUpperCase()}
                  </Text>
                </View>
                <View style={styles.listCardContent}>
                  <Text style={styles.listCardTitle}>
                    {resident.first_name} {resident.paternal_surname}
                  </Text>
                  <Text style={styles.listCardSubtitle}>{resident.email ?? 'No email'}</Text>
                  <View style={styles.badgeRow}>
                    <View style={[
                      styles.statusBadge,
                      {
                        backgroundColor:
                          resident.onboarding_status === 'active'
                            ? colors.successBg
                            : colors.warningBg,
                      },
                    ]}>
                      <Text style={[
                        styles.statusBadgeText,
                        {
                          color:
                            resident.onboarding_status === 'active'
                              ? colors.successText
                              : colors.warningText,
                        },
                      ]}>
                        {resident.onboarding_status === 'active' ? 'Active' : 'Pending'}
                      </Text>
                    </View>
                  </View>
                </View>
                <Ionicons name="chevron-forward" size={18} color={colors.textDisabled} />
              </GlassCard>
            ))}
          </View>
        )}

        {/* Units Tab */}
        {activeTab === 'units' && (
          <View style={styles.listContainer}>
            {filteredUnits.length === 0 && (
              <View style={styles.emptyState}>
                <Ionicons name="home-outline" size={40} color={colors.textDisabled} />
                <Text style={styles.emptyText}>No units found</Text>
              </View>
            )}
            {filteredUnits.map((unit) => (
              <GlassCard key={unit.id} style={styles.listCard}>
                <View style={[styles.unitIconBox, { backgroundColor: colors.tealLight }]}>
                  <Ionicons name="home-outline" size={20} color={colors.tealDark} />
                </View>
                <View style={styles.listCardContent}>
                  <View style={styles.listCardRow}>
                    <Text style={styles.listCardTitle}>{unit.unit_number}</Text>
                    <View style={styles.statusDot}>
                      <View style={[
                        styles.dot,
                        { backgroundColor: getStatusColor(unit.status ?? '') },
                      ]} />
                      <Text style={styles.statusDotText}>
                        {unit.status?.replace('_', ' ') ?? 'unknown'}
                      </Text>
                    </View>
                  </View>
                  <Text style={styles.listCardSubtitle}>
                    {[unit.building, unit.floor_number ? `Floor ${unit.floor_number}` : null, unit.unit_type]
                      .filter(Boolean)
                      .join(' - ')}
                  </Text>
                </View>
              </GlassCard>
            ))}
          </View>
        )}

        {/* Tickets Tab */}
        {activeTab === 'tickets' && (
          <View style={styles.listContainer}>
            {filteredTickets.length === 0 && (
              <View style={styles.emptyState}>
                <Ionicons name="construct-outline" size={40} color={colors.textDisabled} />
                <Text style={styles.emptyText}>No open tickets</Text>
              </View>
            )}
            {filteredTickets.map((ticket) => {
              const pStyle = getPriorityStyle(ticket.priority ?? 'low');
              return (
                <GlassCard key={ticket.id} style={styles.ticketCard}>
                  <View style={styles.ticketHeader}>
                    <View style={[styles.priorityBadge, { backgroundColor: pStyle.bg }]}>
                      <Text style={[styles.priorityBadgeText, { color: pStyle.text }]}>
                        {(ticket.priority ?? 'low').toUpperCase()}
                      </Text>
                    </View>
                    <View style={[
                      styles.statusBadge,
                      {
                        backgroundColor:
                          ticket.status === 'in_progress' ? colors.warningBg : colors.border,
                      },
                    ]}>
                      <Text style={[
                        styles.statusBadgeText,
                        {
                          color:
                            ticket.status === 'in_progress' ? colors.warningText : colors.textMuted,
                        },
                      ]}>
                        {ticket.status.replace('_', ' ')}
                      </Text>
                    </View>
                  </View>
                  <Text style={styles.ticketTitle} numberOfLines={2}>{ticket.title}</Text>
                </GlassCard>
              );
            })}
          </View>
        )}
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
    zIndex: 20,
  },
  headerTitle: {
    fontFamily: fonts.bold,
    fontSize: 30,
    color: colors.textPrimary,
    letterSpacing: -0.5,
  },
  // Search
  searchContainer: {
    paddingHorizontal: spacing.pagePaddingX,
    paddingTop: spacing.xl,
    zIndex: 20,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.borderMedium,
    paddingHorizontal: spacing.xl,
    height: 48,
    gap: spacing.md,
  },
  searchInput: {
    flex: 1,
    fontFamily: fonts.medium,
    fontSize: 14,
    color: colors.textPrimary,
  },
  // Tabs
  tabContainer: {
    paddingHorizontal: spacing.pagePaddingX,
    paddingTop: spacing.xl,
    paddingBottom: spacing.lg,
    zIndex: 20,
  },
  tabRow: {
    flexDirection: 'row',
    backgroundColor: 'rgba(226,232,240,0.5)',
    borderRadius: borderRadius.md,
    padding: 4,
  },
  tab: {
    flex: 1,
    paddingVertical: spacing.md,
    alignItems: 'center',
    borderRadius: borderRadius.sm,
  },
  tabActive: {
    backgroundColor: colors.surface,
    ...shadows.sm,
  },
  tabText: {
    fontFamily: fonts.bold,
    fontSize: 13,
    color: colors.textMuted,
  },
  tabTextActive: {
    color: colors.textPrimary,
  },
  // ScrollView
  scrollView: {
    flex: 1,
    zIndex: 10,
  },
  scrollContent: {
    paddingHorizontal: spacing.pagePaddingX,
    paddingBottom: spacing.bottomNavClearance,
  },
  // List
  listContainer: {
    gap: spacing.lg,
  },
  listCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xl,
    padding: spacing.xl,
    borderRadius: borderRadius['2xl'],
  },
  avatarCircle: {
    width: 44,
    height: 44,
    borderRadius: borderRadius.lg,
    backgroundColor: colors.dark,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: {
    fontFamily: fonts.bold,
    fontSize: 14,
    color: colors.textOnDark,
  },
  unitIconBox: {
    width: 44,
    height: 44,
    borderRadius: borderRadius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listCardContent: {
    flex: 1,
  },
  listCardRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  listCardTitle: {
    fontFamily: fonts.bold,
    fontSize: 14,
    color: colors.textPrimary,
  },
  listCardSubtitle: {
    fontFamily: fonts.medium,
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 2,
  },
  badgeRow: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.md,
  },
  statusBadge: {
    paddingHorizontal: spacing.md,
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
  },
  statusBadgeText: {
    fontFamily: fonts.bold,
    fontSize: 10,
    textTransform: 'uppercase',
  },
  statusDot: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusDotText: {
    fontFamily: fonts.medium,
    fontSize: 11,
    color: colors.textMuted,
    textTransform: 'capitalize',
  },
  // Tickets
  ticketCard: {
    padding: spacing.xl,
    borderRadius: borderRadius['2xl'],
    gap: spacing.lg,
  },
  ticketHeader: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  priorityBadge: {
    paddingHorizontal: spacing.md,
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
  },
  priorityBadgeText: {
    fontFamily: fonts.black,
    fontSize: 10,
  },
  ticketTitle: {
    fontFamily: fonts.bold,
    fontSize: 15,
    color: colors.textPrimary,
    lineHeight: 22,
  },
  // Empty
  emptyState: {
    alignItems: 'center',
    paddingVertical: spacing['6xl'],
    gap: spacing.lg,
  },
  emptyText: {
    fontFamily: fonts.medium,
    fontSize: 14,
    color: colors.textMuted,
  },
});
