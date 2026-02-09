import { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  TextInput,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useResidentSearch } from '@/hooks/useDirectory';
import { useTodayAccessLogs } from '@/hooks/useGateOps';
import { formatTime, formatRelative } from '@/lib/dates';
import { AmbientBackground } from '@/components/ui/AmbientBackground';
import { GlassCard } from '@/components/ui/GlassCard';
import { colors, fonts, spacing, borderRadius, shadows } from '@/theme';

type ActiveTab = 'residents' | 'logs';

function getDirectionStyle(direction: string) {
  switch (direction) {
    case 'entry':
      return { bg: colors.primaryLight, color: colors.primary, icon: 'log-in-outline' as const, label: 'Entry' };
    case 'exit':
      return { bg: colors.border, color: colors.textCaption, icon: 'log-out-outline' as const, label: 'Exit' };
    default:
      return { bg: colors.border, color: colors.textCaption, icon: 'swap-horizontal-outline' as const, label: direction };
  }
}

function getDecisionStyle(decision: string) {
  switch (decision) {
    case 'allowed':
      return { bg: colors.successBg, color: colors.successText, label: 'Allowed' };
    case 'denied':
      return { bg: colors.dangerBg, color: colors.dangerText, label: 'Denied' };
    case 'blocked':
      return { bg: colors.dangerBg, color: colors.dangerText, label: 'Blocked' };
    default:
      return { bg: colors.warningBg, color: colors.warningText, label: decision };
  }
}

function getMethodIcon(method: string) {
  switch (method) {
    case 'qr_code':
      return 'qr-code-outline';
    case 'nfc':
      return 'wifi-outline';
    case 'manual':
      return 'person-outline';
    case 'lpr':
      return 'car-outline';
    case 'biometric':
      return 'finger-print-outline';
    default:
      return 'shield-outline';
  }
}

interface ResidentItem {
  id: string;
  first_name: string;
  paternal_surname: string;
  maternal_surname: string | null;
  email: string | null;
  phone: string | null;
  occupancies: Array<{
    unit_id: string;
    units: { unit_number: string; building: string | null } | null;
  }>;
}

interface AccessLogItem {
  id: string;
  person_name: string;
  person_type: string;
  direction: string;
  method: string;
  decision: string;
  logged_at: string;
  plate_number: string | null;
  guard_notes: string | null;
}

export default function DirectoryIndexScreen() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<ActiveTab>('residents');
  const [searchQuery, setSearchQuery] = useState('');

  const { data: residents, isLoading: residentsLoading } = useResidentSearch(searchQuery);
  const { data: accessLogs, isLoading: logsLoading } = useTodayAccessLogs();

  const renderResident = useCallback(
    ({ item }: { item: ResidentItem }) => {
      const primaryOccupancy = item.occupancies?.[0];
      const unit = primaryOccupancy?.units;

      return (
        <GlassCard style={styles.residentCard}>
          <View style={styles.residentRow}>
            <View style={styles.residentAvatar}>
              <Ionicons name="person" size={20} color={colors.textOnDark} />
            </View>
            <View style={styles.residentInfo}>
              <Text style={styles.residentName}>
                {item.first_name} {item.paternal_surname}
                {item.maternal_surname ? ` ${item.maternal_surname}` : ''}
              </Text>
              {unit && (
                <Text style={styles.residentUnit}>
                  {unit.unit_number}
                  {unit.building ? ` - ${unit.building}` : ''}
                </Text>
              )}
              {item.phone && (
                <View style={styles.phoneRow}>
                  <Ionicons name="call-outline" size={12} color={colors.primary} />
                  <Text style={styles.phoneText}>{item.phone}</Text>
                </View>
              )}
            </View>
          </View>
        </GlassCard>
      );
    },
    [],
  );

  const renderAccessLog = useCallback(
    ({ item }: { item: AccessLogItem }) => {
      const direction = getDirectionStyle(item.direction);
      const decision = getDecisionStyle(item.decision);
      const isDenied = item.decision === 'denied' || item.decision === 'blocked';

      return (
        <GlassCard style={{ ...styles.logCard, ...(isDenied ? styles.logCardDenied : {}) }}>
          <View style={styles.logRow}>
            <View style={[styles.logIcon, { backgroundColor: direction.bg }]}>
              <Ionicons name={direction.icon} size={24} color={direction.color} />
            </View>
            <View style={styles.logInfo}>
              <View style={styles.logHeader}>
                <Text style={styles.logName}>{item.person_name}</Text>
                <View style={styles.logTimeBadge}>
                  <Text style={styles.logTimeText}>
                    {formatTime(item.logged_at)}
                  </Text>
                </View>
              </View>
              <Text style={styles.logType}>
                {item.person_type ? `${item.person_type.charAt(0).toUpperCase()}${item.person_type.slice(1)}` : ''}
                {item.plate_number ? ` - ${item.plate_number}` : ''}
              </Text>
              <View style={styles.logMethodRow}>
                <Ionicons
                  name={getMethodIcon(item.method) as any}
                  size={12}
                  color={colors.primary}
                />
                <Text style={styles.logMethodText}>
                  {item.method?.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()) ?? 'Unknown'}
                </Text>
              </View>
            </View>
            {isDenied && (
              <View style={[styles.decisionBadge, { backgroundColor: decision.bg }]}>
                <Text style={[styles.decisionBadgeText, { color: decision.color }]}>
                  {decision.label}
                </Text>
              </View>
            )}
          </View>
        </GlassCard>
      );
    },
    [],
  );

  return (
    <View style={styles.container}>
      <AmbientBackground />

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Access Logs</Text>
        <TouchableOpacity
          style={styles.vehicleButton}
          onPress={() => router.push('/(guard)/directory/vehicles')}
        >
          <Ionicons name="car-outline" size={20} color={colors.textBody} />
        </TouchableOpacity>
      </View>

      {/* Search */}
      <View style={styles.searchContainer}>
        <View style={styles.searchBar}>
          <Ionicons name="search-outline" size={18} color={colors.textCaption} />
          <TextInput
            style={styles.searchInput}
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search visitor, unit, or guard..."
            placeholderTextColor={colors.textCaption}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={18} color={colors.textCaption} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Tab Switcher */}
      <View style={styles.tabRow}>
        <TouchableOpacity
          style={[styles.tabPill, activeTab === 'residents' && styles.tabPillActive]}
          onPress={() => setActiveTab('residents')}
        >
          <Text style={[styles.tabText, activeTab === 'residents' && styles.tabTextActive]}>
            Residents
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabPill, activeTab === 'logs' && styles.tabPillActive]}
          onPress={() => setActiveTab('logs')}
        >
          <Text style={[styles.tabText, activeTab === 'logs' && styles.tabTextActive]}>
            Today's Logs
          </Text>
        </TouchableOpacity>
      </View>

      {/* Content */}
      {activeTab === 'residents' ? (
        searchQuery.length < 2 ? (
          <View style={styles.promptState}>
            <Ionicons name="search" size={40} color={colors.textDisabled} />
            <Text style={styles.promptText}>
              Enter at least 2 characters to search residents
            </Text>
          </View>
        ) : residentsLoading ? (
          <ActivityIndicator color={colors.primary} style={styles.mainLoader} />
        ) : (
          <FlatList
            data={(residents ?? []) as ResidentItem[]}
            keyExtractor={(item) => item.id}
            renderItem={renderResident}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={
              <View style={styles.emptyState}>
                <Ionicons name="people-outline" size={40} color={colors.textDisabled} />
                <Text style={styles.emptyText}>No residents found</Text>
              </View>
            }
          />
        )
      ) : logsLoading ? (
        <ActivityIndicator color={colors.primary} style={styles.mainLoader} />
      ) : (
        <FlatList
          data={(accessLogs ?? []) as AccessLogItem[]}
          keyExtractor={(item) => item.id}
          renderItem={renderAccessLog}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Ionicons name="document-text-outline" size={40} color={colors.textDisabled} />
              <Text style={styles.emptyText}>No access logs today</Text>
            </View>
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
  header: {
    paddingTop: spacing.safeAreaTop,
    paddingHorizontal: spacing.pagePaddingX,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.xl,
  },
  headerTitle: {
    fontFamily: fonts.bold,
    fontSize: 20,
    color: colors.textPrimary,
    letterSpacing: -0.5,
  },
  vehicleButton: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.full,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderMedium,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.sm,
  },
  searchContainer: {
    paddingHorizontal: spacing.pagePaddingX,
    marginBottom: spacing.xl,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 48,
    backgroundColor: colors.surfaceMuted,
    borderRadius: borderRadius.xl,
    borderWidth: 1,
    borderColor: colors.borderMedium,
    paddingHorizontal: spacing.xl,
    gap: spacing.md,
  },
  searchInput: {
    flex: 1,
    fontFamily: fonts.medium,
    fontSize: 14,
    color: colors.textPrimary,
  },
  tabRow: {
    flexDirection: 'row',
    gap: spacing.md,
    paddingHorizontal: spacing.pagePaddingX,
    marginBottom: spacing.xl,
  },
  tabPill: {
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.full,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderMedium,
  },
  tabPillActive: {
    backgroundColor: colors.dark,
    borderColor: colors.dark,
  },
  tabText: {
    fontFamily: fonts.bold,
    fontSize: 12,
    color: colors.textMuted,
  },
  tabTextActive: {
    color: colors.textOnDark,
  },
  listContent: {
    paddingHorizontal: spacing.pagePaddingX,
    paddingBottom: spacing.bottomNavClearance + 16,
    gap: spacing.lg,
  },
  residentCard: {
    padding: spacing.xl,
    borderRadius: borderRadius['2xl'],
  },
  residentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xl,
  },
  residentAvatar: {
    width: 44,
    height: 44,
    borderRadius: borderRadius.full,
    backgroundColor: colors.dark,
    alignItems: 'center',
    justifyContent: 'center',
  },
  residentInfo: {
    flex: 1,
  },
  residentName: {
    fontFamily: fonts.bold,
    fontSize: 14,
    color: colors.textPrimary,
  },
  residentUnit: {
    fontFamily: fonts.medium,
    fontSize: 12,
    color: colors.textCaption,
    marginTop: 2,
  },
  phoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  phoneText: {
    fontFamily: fonts.medium,
    fontSize: 12,
    color: colors.primary,
  },
  logCard: {
    padding: spacing.xl,
    borderRadius: borderRadius['3xl'],
  },
  logCardDenied: {
    opacity: 0.7,
  },
  logRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xl,
  },
  logIcon: {
    width: 48,
    height: 48,
    borderRadius: borderRadius.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logInfo: {
    flex: 1,
  },
  logHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  logName: {
    fontFamily: fonts.bold,
    fontSize: 14,
    color: colors.textPrimary,
    flex: 1,
  },
  logTimeBadge: {
    backgroundColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
    marginLeft: spacing.md,
  },
  logTimeText: {
    fontFamily: fonts.bold,
    fontSize: 10,
    color: colors.textCaption,
  },
  logType: {
    fontFamily: fonts.medium,
    fontSize: 12,
    color: colors.textCaption,
    marginTop: 2,
  },
  logMethodRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  logMethodText: {
    fontFamily: fonts.medium,
    fontSize: 10,
    color: colors.primary,
  },
  decisionBadge: {
    paddingHorizontal: spacing.md,
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
  },
  decisionBadgeText: {
    fontFamily: fonts.bold,
    fontSize: 10,
    textTransform: 'uppercase',
  },
  promptState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xl,
    paddingBottom: spacing.bottomNavClearance,
  },
  promptText: {
    fontFamily: fonts.medium,
    fontSize: 14,
    color: colors.textMuted,
    textAlign: 'center',
    paddingHorizontal: spacing['4xl'],
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: spacing['5xl'],
    gap: spacing.lg,
  },
  emptyText: {
    fontFamily: fonts.medium,
    fontSize: 14,
    color: colors.textMuted,
  },
  mainLoader: {
    flex: 1,
    justifyContent: 'center',
  },
});
