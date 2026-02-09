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
import { useAuth } from '@/hooks/useAuth';
import { useIncidentList } from '@/hooks/useIncidents';
import { formatRelative } from '@/lib/dates';
import { AmbientBackground } from '@/components/ui/AmbientBackground';
import { GlassCard } from '@/components/ui/GlassCard';
import { colors, fonts, spacing, borderRadius, shadows } from '@/theme';

type StatusFilter = 'all' | 'open' | 'in_progress' | 'resolved';

const STATUS_FILTERS: { key: StatusFilter; label: string }[] = [
  { key: 'all', label: 'All Alerts' },
  { key: 'open', label: 'Open' },
  { key: 'in_progress', label: 'In Progress' },
  { key: 'resolved', label: 'Resolved' },
];

function getSeverityStyle(severity: string): {
  borderColor: string;
  iconBg: string;
  iconColor: string;
  label: string;
  labelColor: string;
} {
  switch (severity) {
    case 'critical':
      return {
        borderColor: colors.danger,
        iconBg: colors.dangerBg,
        iconColor: colors.dangerText,
        label: 'CRITICAL',
        labelColor: colors.dangerText,
      };
    case 'high':
      return {
        borderColor: colors.orange,
        iconBg: colors.orangeBg,
        iconColor: colors.orange,
        label: 'HIGH',
        labelColor: colors.orange,
      };
    case 'medium':
      return {
        borderColor: colors.warning,
        iconBg: colors.warningBg,
        iconColor: colors.warningText,
        label: 'MEDIUM',
        labelColor: colors.warningText,
      };
    case 'low':
    default:
      return {
        borderColor: colors.borderMedium,
        iconBg: colors.border,
        iconColor: colors.textCaption,
        label: 'LOW',
        labelColor: colors.textCaption,
      };
  }
}

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

function getSeverityIcon(severity: string): string {
  switch (severity) {
    case 'critical':
      return 'alert-circle';
    case 'high':
      return 'warning';
    case 'medium':
      return 'shield-half';
    default:
      return 'information-circle';
  }
}

interface IncidentItem {
  id: string;
  incident_number: string | null;
  title: string;
  severity: string;
  status: string;
  created_at: string;
  location_description: string | null;
}

export default function IncidentsIndexScreen() {
  const router = useRouter();
  const { communityId } = useAuth();
  const { data: incidents, refetch, isLoading, isRefetching } = useIncidentList(communityId);
  const [activeFilter, setActiveFilter] = useState<StatusFilter>('all');

  const filteredIncidents = useMemo(() => {
    const all = (incidents ?? []) as IncidentItem[];
    if (activeFilter === 'all') return all;
    return all.filter((i) => i.status === activeFilter);
  }, [incidents, activeFilter]);

  const activeCount = useMemo(
    () =>
      (incidents ?? []).filter(
        (i) => (i as IncidentItem).status === 'open' || (i as IncidentItem).status === 'in_progress',
      ).length,
    [incidents],
  );

  const onRefresh = useCallback(async () => {
    await refetch();
  }, [refetch]);

  const renderIncident = useCallback(
    ({ item }: { item: IncidentItem }) => {
      const severity = getSeverityStyle(item.severity);
      const status = getStatusStyle(item.status);
      const isCritical = item.severity === 'critical';

      return (
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={() => router.push(`/(guard)/incidents/${item.id}`)}
        >
          <GlassCard
            variant={isCritical ? 'dense' : 'standard'}
            style={{
              ...styles.incidentCard,
              borderLeftWidth: 4,
              borderLeftColor: severity.borderColor,
            }}
          >
            <View style={styles.cardHeader}>
              <View style={styles.cardHeaderLeft}>
                <View style={[styles.severityIcon, { backgroundColor: severity.iconBg }]}>
                  <Ionicons
                    name={getSeverityIcon(item.severity) as any}
                    size={24}
                    color={severity.iconColor}
                  />
                </View>
                <View style={styles.cardTitleGroup}>
                  <Text style={styles.cardTitle} numberOfLines={1}>
                    {item.title}
                  </Text>
                  <Text style={[styles.severityLabel, { color: severity.labelColor }]}>
                    {severity.label}
                    {item.incident_number ? ` - #${item.incident_number}` : ''}
                  </Text>
                </View>
              </View>
              <Text style={styles.cardTime}>{formatRelative(item.created_at)}</Text>
            </View>

            {item.location_description ? (
              <View style={styles.locationRow}>
                <Ionicons name="location-outline" size={14} color={colors.textCaption} />
                <Text style={styles.locationText} numberOfLines={1}>
                  {item.location_description}
                </Text>
              </View>
            ) : null}

            <View style={styles.cardFooter}>
              <View style={[styles.statusBadge, { backgroundColor: status.bg }]}>
                <Text style={[styles.statusBadgeText, { color: status.color }]}>
                  {status.label}
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
          <Ionicons name="shield-checkmark-outline" size={40} color={colors.textDisabled} />
        </View>
        <Text style={styles.emptyTitle}>No Incidents</Text>
        <Text style={styles.emptySubtitle}>
          All clear! Tap the plus button to report an incident.
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
          <View style={styles.headerTitleRow}>
            <Text style={styles.headerTitle}>Security Feed</Text>
            {activeCount > 0 && (
              <View style={styles.activeBadge}>
                <Text style={styles.activeBadgeText}>{activeCount} ACTIVE</Text>
              </View>
            )}
          </View>
          <Text style={styles.headerSubtitle}>Real-time incident monitoring</Text>
        </View>
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

      {/* Incident List */}
      {isLoading ? (
        <ActivityIndicator color={colors.primary} style={styles.mainLoader} />
      ) : (
        <FlatList
          data={filteredIncidents}
          keyExtractor={(item) => item.id}
          renderItem={renderIncident}
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
        onPress={() => router.push('/(guard)/incidents/create')}
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
  header: {
    paddingTop: spacing.safeAreaTop,
    paddingHorizontal: spacing.pagePaddingX,
    marginBottom: spacing.md,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
    marginBottom: 2,
  },
  headerTitle: {
    fontFamily: fonts.black,
    fontSize: 24,
    color: colors.textPrimary,
    letterSpacing: -0.5,
    textTransform: 'uppercase',
  },
  activeBadge: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    backgroundColor: colors.danger,
    borderRadius: borderRadius.sm,
  },
  activeBadgeText: {
    fontFamily: fonts.bold,
    fontSize: 10,
    color: colors.textOnDark,
  },
  headerSubtitle: {
    fontFamily: fonts.medium,
    fontSize: 14,
    color: colors.textMuted,
  },
  filterRow: {
    marginTop: spacing.xl,
    marginBottom: spacing.md,
  },
  filterListContent: {
    paddingHorizontal: spacing.pagePaddingX,
    gap: spacing.md,
  },
  filterPill: {
    paddingHorizontal: spacing['2xl'],
    paddingVertical: spacing.lg,
    borderRadius: borderRadius.xl,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderMedium,
  },
  filterPillActive: {
    backgroundColor: colors.dark,
    borderColor: colors.dark,
  },
  filterText: {
    fontFamily: fonts.bold,
    fontSize: 12,
    color: colors.textMuted,
  },
  filterTextActive: {
    color: colors.textOnDark,
  },
  listContent: {
    paddingHorizontal: spacing.pagePaddingX,
    paddingTop: spacing.xl,
    paddingBottom: spacing.bottomNavClearance + 16,
    gap: spacing.xl,
  },
  incidentCard: {
    padding: spacing['2xl'],
    borderRadius: borderRadius['3xl'],
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.lg,
  },
  cardHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
    flex: 1,
  },
  severityIcon: {
    width: 48,
    height: 48,
    borderRadius: borderRadius.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitleGroup: {
    flex: 1,
  },
  cardTitle: {
    fontFamily: fonts.black,
    fontSize: 16,
    color: colors.textPrimary,
    textTransform: 'uppercase',
    lineHeight: 20,
  },
  severityLabel: {
    fontFamily: fonts.bold,
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginTop: 2,
  },
  cardTime: {
    fontFamily: fonts.bold,
    fontSize: 10,
    color: colors.textCaption,
    marginLeft: spacing.md,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: spacing.lg,
    paddingHorizontal: spacing.xs,
  },
  locationText: {
    fontFamily: fonts.medium,
    fontSize: 12,
    color: colors.textCaption,
    flex: 1,
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  statusBadge: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
  },
  statusBadgeText: {
    fontFamily: fonts.bold,
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
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
  fab: {
    position: 'absolute',
    bottom: spacing.bottomNavClearance + 16,
    right: spacing.pagePaddingX,
    width: 56,
    height: 56,
    borderRadius: borderRadius.full,
    backgroundColor: colors.danger,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.lg,
  },
  mainLoader: {
    flex: 1,
    justifyContent: 'center',
  },
});
