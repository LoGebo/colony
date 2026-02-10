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
import { useMyPackages } from '@/hooks/useMyPackages';
import { formatRelative } from '@/lib/dates';
import { AmbientBackground } from '@/components/ui/AmbientBackground';
import { GlassCard } from '@/components/ui/GlassCard';
import { colors, fonts, spacing, borderRadius, shadows } from '@/theme';

type FilterType = 'all' | 'stored' | 'picked_up';

const FILTERS: { key: FilterType; label: string }[] = [
  { key: 'all', label: 'All Packages' },
  { key: 'stored', label: 'Stored' },
  { key: 'picked_up', label: 'Delivered' },
];

const CARRIER_CONFIG: Record<string, { icon: string; bg: string; color: string }> = {
  amazon: { icon: 'cube-outline', bg: '#FFF7ED', color: '#EA580C' },
  fedex: { icon: 'airplane-outline', bg: '#FAF5FF', color: '#7C3AED' },
  ups: { icon: 'cube-outline', bg: '#FFFBEB', color: '#D97706' },
  dhl: { icon: 'cube-outline', bg: '#FEF2F2', color: '#EF4444' },
  default: { icon: 'cube-outline', bg: colors.primaryLight, color: colors.primary },
};

function getCarrierConfig(carrier: string | null) {
  if (!carrier) return CARRIER_CONFIG.default;
  const key = carrier.toLowerCase();
  return CARRIER_CONFIG[key] ?? CARRIER_CONFIG.default;
}

function getStatusStyle(status: string) {
  switch (status) {
    case 'received':
    case 'stored':
      return { bg: colors.infoBg, color: colors.primary, label: 'Stored' };
    case 'notified':
      return { bg: colors.warningBg, color: colors.warningText, label: 'Notified' };
    case 'picked_up':
      return { bg: colors.successBg, color: colors.successText, label: 'Delivered' };
    case 'returned':
      return { bg: colors.border, color: colors.textCaption, label: 'Returned' };
    default:
      return { bg: colors.border, color: colors.textCaption, label: status };
  }
}

export default function PackagesScreen() {
  const router = useRouter();
  const { data: packages, isLoading, refetch } = useMyPackages();
  const [filter, setFilter] = useState<FilterType>('all');
  const [refreshing, setRefreshing] = useState(false);

  const filtered = useMemo(() => {
    if (!packages) return [];
    if (filter === 'all') return packages;
    if (filter === 'stored') return packages.filter((p) => p.status === 'received' || p.status === 'stored' || p.status === 'notified');
    return packages.filter((p) => p.status === 'picked_up');
  }, [packages, filter]);

  const pendingCount = useMemo(
    () => (packages ?? []).filter((p) => p.status !== 'picked_up' && p.status !== 'returned').length,
    [packages],
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

  const renderPackage = useCallback(({ item }: { item: (typeof filtered)[0] }) => {
    const carrier = getCarrierConfig(item.carrier);
    const status = getStatusStyle(item.status);
    const isDelivered = item.status === 'picked_up';
    const pickupCode = item.package_pickup_codes?.find((c) => c.status === 'active');

    return (
      <View style={[styles.packageCard, isDelivered && styles.packageCardFaded]}>
        <View style={styles.packageHeader}>
          <View style={styles.packageHeaderLeft}>
            <View style={[styles.carrierIcon, { backgroundColor: carrier.bg }]}>
              <Ionicons name={carrier.icon as any} size={24} color={carrier.color} />
            </View>
            <View style={styles.packageInfo}>
              <Text style={styles.packageCarrier}>{item.carrier ?? 'Unknown'}</Text>
              <Text style={styles.packageTime}>
                {item.received_at ? formatRelative(item.received_at) : ''}
              </Text>
            </View>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: status.bg }]}>
            <Text style={[styles.statusBadgeText, { color: status.color }]}>{status.label}</Text>
          </View>
        </View>

        {item.description ? (
          <Text style={styles.packageDescription} numberOfLines={1}>{item.description}</Text>
        ) : null}

        {item.recipient_name ? (
          <Text style={styles.recipientText}>For: {item.recipient_name}</Text>
        ) : null}

        {pickupCode && !isDelivered && (
          <View style={styles.pickupSection}>
            <View style={styles.pickupDivider} />
            <View style={styles.pickupRow}>
              <View>
                <Text style={styles.pickupLabel}>PICKUP CODE</Text>
                <Text style={styles.pickupCode}>{pickupCode.code_value}</Text>
              </View>
              <TouchableOpacity style={styles.qrButton}>
                <Ionicons name="qr-code-outline" size={18} color={colors.textBody} />
                <Text style={styles.qrButtonText}>Show QR</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>
    );
  }, []);

  return (
    <View style={styles.container}>
      <AmbientBackground />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={20} color={colors.textBody} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Packages</Text>
        <View style={styles.spacer} />
      </View>

      {/* Summary Card */}
      {pendingCount > 0 && (
        <View style={styles.summaryCard}>
          <View style={styles.summaryOrb} />
          <View style={styles.summaryContent}>
            <View style={styles.summaryRow}>
              <View style={styles.summaryIconBox}>
                <Ionicons name="cube-outline" size={24} color={colors.textOnDark} />
              </View>
              <View>
                <Text style={styles.summaryLabel}>AWAITING PICKUP</Text>
                <Text style={styles.summaryCount}>{pendingCount} Package{pendingCount !== 1 ? 's' : ''}</Text>
              </View>
            </View>
          </View>
        </View>
      )}

      {/* Filter Pills */}
      <View style={styles.filterRow}>
        {FILTERS.map((f) => {
          const active = filter === f.key;
          return (
            <TouchableOpacity
              key={f.key}
              style={[styles.filterPill, active && styles.filterPillActive]}
              onPress={() => setFilter(f.key)}
            >
              <Text style={[styles.filterPillText, active && styles.filterPillTextActive]}>{f.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Package List */}
      {isLoading ? (
        <ActivityIndicator color={colors.primary} style={styles.loader} />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          renderItem={renderPackage}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Ionicons name="cube-outline" size={48} color={colors.textDisabled} />
              <Text style={styles.emptyText}>No packages found</Text>
            </View>
          }
        />
      )}

      {/* Info Note */}
      <View style={styles.infoNote}>
        <Ionicons name="information-circle-outline" size={18} color={colors.textCaption} />
        <Text style={styles.infoNoteText}>
          Packages are kept in secure storage for up to 48 hours. Please collect promptly.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    paddingTop: spacing.safeAreaTop, paddingHorizontal: spacing.pagePaddingX,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.xl,
  },
  backButton: {
    width: 40, height: 40, borderRadius: borderRadius.full,
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.borderMedium,
    alignItems: 'center', justifyContent: 'center', ...shadows.sm,
  },
  headerTitle: { fontFamily: fonts.bold, fontSize: 20, color: colors.textPrimary, letterSpacing: -0.5 },
  spacer: { width: 40 },
  summaryCard: {
    marginHorizontal: spacing.pagePaddingX, padding: spacing['3xl'],
    backgroundColor: '#4338CA', borderRadius: borderRadius['3xl'],
    overflow: 'hidden', marginBottom: spacing['3xl'], ...shadows.xl,
  },
  summaryOrb: {
    position: 'absolute', right: -24, bottom: -24, width: 128, height: 128,
    borderRadius: 64, backgroundColor: 'rgba(255,255,255,0.1)',
  },
  summaryContent: { zIndex: 1 },
  summaryRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xl },
  summaryIconBox: {
    width: 48, height: 48, borderRadius: borderRadius.xl,
    backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center',
  },
  summaryLabel: {
    fontFamily: fonts.bold, fontSize: 10, color: 'rgba(255,255,255,0.7)',
    textTransform: 'uppercase', letterSpacing: 1.5,
  },
  summaryCount: { fontFamily: fonts.bold, fontSize: 20, color: colors.textOnDark },
  filterRow: {
    flexDirection: 'row', gap: spacing.lg, paddingHorizontal: spacing.pagePaddingX, marginBottom: spacing.xl,
  },
  filterPill: {
    paddingHorizontal: spacing['2xl'], paddingVertical: spacing.lg,
    backgroundColor: colors.surface, borderRadius: borderRadius.xl,
    borderWidth: 1, borderColor: colors.borderMedium,
  },
  filterPillActive: { backgroundColor: colors.dark, borderColor: colors.dark },
  filterPillText: { fontFamily: fonts.bold, fontSize: 12, color: colors.textMuted },
  filterPillTextActive: { color: colors.textOnDark },
  listContent: {
    paddingHorizontal: spacing.pagePaddingX, paddingBottom: spacing.bottomNavClearance, gap: spacing.xl,
  },
  packageCard: {
    backgroundColor: colors.surface, borderRadius: borderRadius['2xl'],
    padding: spacing['2xl'], borderWidth: 1, borderColor: colors.borderMedium, ...shadows.sm,
  },
  packageCardFaded: { opacity: 0.6 },
  packageHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  packageHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: spacing.xl },
  carrierIcon: {
    width: 48, height: 48, borderRadius: borderRadius.md, alignItems: 'center', justifyContent: 'center',
  },
  packageInfo: { gap: 2 },
  packageCarrier: { fontFamily: fonts.bold, fontSize: 15, color: colors.textPrimary },
  packageTime: { fontFamily: fonts.medium, fontSize: 12, color: colors.textCaption },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: borderRadius.full },
  statusBadgeText: { fontFamily: fonts.bold, fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.5 },
  packageDescription: {
    fontFamily: fonts.medium, fontSize: 13, color: colors.textBody, marginTop: spacing.lg,
  },
  recipientText: { fontFamily: fonts.medium, fontSize: 12, color: colors.textCaption, marginTop: spacing.xs },
  pickupSection: { marginTop: spacing.xl },
  pickupDivider: { height: 1, backgroundColor: colors.border, marginBottom: spacing.xl },
  pickupRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  pickupLabel: {
    fontFamily: fonts.bold, fontSize: 10, color: colors.textCaption,
    textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4,
  },
  pickupCode: { fontFamily: fonts.black, fontSize: 20, color: colors.textPrimary, letterSpacing: 2 },
  qrButton: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    height: 40, paddingHorizontal: spacing.xl, backgroundColor: colors.border, borderRadius: borderRadius.md,
  },
  qrButtonText: { fontFamily: fonts.bold, fontSize: 12, color: colors.textBody },
  loader: { flex: 1, justifyContent: 'center' },
  emptyState: { alignItems: 'center', paddingVertical: spacing['5xl'], gap: spacing.lg },
  emptyText: { fontFamily: fonts.medium, fontSize: 14, color: colors.textMuted },
  infoNote: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.lg,
    marginHorizontal: spacing.pagePaddingX, marginBottom: spacing.safeAreaBottom,
    padding: spacing.xl, backgroundColor: colors.backgroundAlt, borderRadius: borderRadius.lg,
    borderWidth: 1, borderColor: colors.borderMedium,
  },
  infoNoteText: { flex: 1, fontFamily: fonts.medium, fontSize: 12, color: colors.textCaption, lineHeight: 16 },
});
