import { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { showAlert } from '@/lib/alert';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { usePendingPackages, useConfirmPickup } from '@/hooks/usePackages';
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
    case 'pending_pickup':
      return { bg: colors.warningBg, color: colors.warningText, label: 'Notified' };
    case 'picked_up':
      return { bg: colors.successBg, color: colors.successText, label: 'Delivered' };
    case 'returned':
      return { bg: colors.border, color: colors.textCaption, label: 'Returned' };
    default:
      return { bg: colors.border, color: colors.textCaption, label: status };
  }
}

interface PackageItem {
  id: string;
  carrier: string | null;
  carrier_other?: string | null;
  tracking_number: string | null;
  recipient_name: string;
  recipient_unit_id: string;
  description: string | null;
  status: string;
  received_at: string | null;
  units: { unit_number: string; building: string | null } | null;
}

export default function PackagesIndexScreen() {
  const router = useRouter();
  const { data: packages, isLoading, refetch, isRefetching } = usePendingPackages();
  const confirmPickup = useConfirmPickup();
  const [filter, setFilter] = useState<FilterType>('all');

  const filtered = useMemo(() => {
    const all = (packages ?? []) as PackageItem[];
    if (filter === 'all') return all;
    if (filter === 'stored')
      return all.filter(
        (p) =>
          p.status === 'received' ||
          p.status === 'stored' ||
          p.status === 'notified' ||
          p.status === 'pending_pickup',
      );
    return all.filter((p) => p.status === 'picked_up');
  }, [packages, filter]);

  const pendingCount = useMemo(
    () =>
      (packages ?? []).filter(
        (p) =>
          (p as PackageItem).status !== 'picked_up' &&
          (p as PackageItem).status !== 'returned',
      ).length,
    [packages],
  );

  const onRefresh = useCallback(async () => {
    await refetch();
  }, [refetch]);

  const handleConfirmPickup = useCallback(
    async (packageId: string, recipientName: string) => {
      const doConfirm = async () => {
        try {
          await confirmPickup.mutateAsync({ packageId });
        } catch (error: any) {
          const msg = error?.message ?? 'Failed to confirm pickup.';
          if (Platform.OS === 'web') {
            window.alert(msg);
          } else {
            showAlert('Error', msg);
          }
        }
      };

      if (Platform.OS === 'web') {
        if (window.confirm(`Confirm package pickup for ${recipientName}?`)) {
          await doConfirm();
        }
      } else {
        showAlert(
          'Confirm Pickup',
          `Confirm package pickup for ${recipientName}?`,
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Confirm', onPress: doConfirm },
          ],
        );
      }
    },
    [confirmPickup],
  );

  const renderPackage = useCallback(
    ({ item }: { item: PackageItem }) => {
      const carrier = getCarrierConfig(item.carrier);
      const status = getStatusStyle(item.status);
      const isDelivered = item.status === 'picked_up';
      const unitDisplay = item.units
        ? `${item.units.unit_number}${item.units.building ? ` - ${item.units.building}` : ''}`
        : '';

      return (
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={() => router.push(`/(guard)/packages/${item.id}`)}
        >
          <GlassCard
            variant={isDelivered ? 'standard' : 'dense'}
            style={{
              ...styles.packageCard,
              ...(isDelivered ? styles.packageCardFaded : {}),
            }}
          >
            <View style={styles.packageHeader}>
              <View style={styles.packageHeaderLeft}>
                <View style={[styles.carrierIcon, { backgroundColor: carrier.bg }]}>
                  <Ionicons name={carrier.icon as any} size={24} color={carrier.color} />
                </View>
                <View style={styles.packageInfo}>
                  <Text style={styles.packageCarrier}>
                    {item.carrier ?? 'Unknown Carrier'}
                  </Text>
                  <Text style={styles.packageTime}>
                    {item.received_at ? formatRelative(item.received_at) : ''}
                  </Text>
                </View>
              </View>
              <View style={[styles.statusBadge, { backgroundColor: status.bg }]}>
                <Text style={[styles.statusBadgeText, { color: status.color }]}>
                  {status.label}
                </Text>
              </View>
            </View>

            <View style={styles.recipientRow}>
              <Ionicons name="person-outline" size={14} color={colors.textCaption} />
              <Text style={styles.recipientName}>{item.recipient_name}</Text>
              {unitDisplay ? (
                <>
                  <Ionicons name="home-outline" size={14} color={colors.textCaption} />
                  <Text style={styles.unitText}>{unitDisplay}</Text>
                </>
              ) : null}
            </View>

            {item.tracking_number && (
              <View style={styles.trackingRow}>
                <Text style={styles.trackingLabel}>TRACKING</Text>
                <Text style={styles.trackingNumber}>{item.tracking_number}</Text>
              </View>
            )}

            {!isDelivered && (
              <View style={styles.actionRow}>
                <TouchableOpacity
                  style={styles.confirmButton}
                  onPress={() => handleConfirmPickup(item.id, item.recipient_name)}
                  disabled={confirmPickup.isPending}
                >
                  <Ionicons name="checkmark-circle-outline" size={18} color={colors.textOnDark} />
                  <Text style={styles.confirmButtonText}>Confirm Pickup</Text>
                </TouchableOpacity>
              </View>
            )}
          </GlassCard>
        </TouchableOpacity>
      );
    },
    [router, handleConfirmPickup, confirmPickup.isPending],
  );

  return (
    <View style={styles.container}>
      <AmbientBackground />

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Packages</Text>
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
                <Text style={styles.summaryLabel}>INCOMING TODAY</Text>
                <Text style={styles.summaryCount}>
                  {pendingCount} Package{pendingCount !== 1 ? 's' : ''} Awaiting
                </Text>
              </View>
            </View>
          </View>
        </View>
      )}

      {/* Filter Pills */}
      <View style={styles.filterRow}>
        <FlatList
          data={FILTERS}
          keyExtractor={(item) => item.key}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterListContent}
          renderItem={({ item: f }) => {
            const active = filter === f.key;
            return (
              <TouchableOpacity
                style={[styles.filterPill, active && styles.filterPillActive]}
                onPress={() => setFilter(f.key)}
              >
                <Text style={[styles.filterText, active && styles.filterTextActive]}>
                  {f.label}
                </Text>
              </TouchableOpacity>
            );
          }}
        />
      </View>

      {/* Package List */}
      {isLoading ? (
        <ActivityIndicator color={colors.primary} style={styles.mainLoader} />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          renderItem={renderPackage}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={onRefresh}
              tintColor={colors.primary}
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Ionicons name="cube-outline" size={48} color={colors.textDisabled} />
              <Text style={styles.emptyText}>No packages found</Text>
            </View>
          }
        />
      )}

      {/* FAB */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => router.push('/(guard)/packages/log')}
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
    marginBottom: spacing.xl,
  },
  headerTitle: {
    fontFamily: fonts.black,
    fontSize: 28,
    color: colors.textPrimary,
    letterSpacing: -0.5,
  },
  summaryCard: {
    marginHorizontal: spacing.pagePaddingX,
    padding: spacing['3xl'],
    borderRadius: borderRadius['4xl'],
    overflow: 'hidden',
    marginBottom: spacing['3xl'],
    backgroundColor: '#4338CA',
    ...shadows.xl,
  },
  summaryOrb: {
    position: 'absolute',
    right: -24,
    bottom: -24,
    width: 128,
    height: 128,
    borderRadius: 64,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  summaryContent: {
    zIndex: 1,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xl,
  },
  summaryIconBox: {
    width: 48,
    height: 48,
    borderRadius: borderRadius.xl,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  summaryLabel: {
    fontFamily: fonts.bold,
    fontSize: 10,
    color: 'rgba(255,255,255,0.7)',
    textTransform: 'uppercase',
    letterSpacing: 1.5,
  },
  summaryCount: {
    fontFamily: fonts.bold,
    fontSize: 20,
    color: colors.textOnDark,
  },
  filterRow: {
    marginBottom: spacing.md,
  },
  filterListContent: {
    paddingHorizontal: spacing.pagePaddingX,
    gap: spacing.lg,
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
  packageCard: {
    padding: spacing['2xl'],
    borderRadius: borderRadius['2xl'],
  },
  packageCardFaded: {
    opacity: 0.6,
  },
  packageHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.lg,
  },
  packageHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xl,
  },
  carrierIcon: {
    width: 48,
    height: 48,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  packageInfo: {
    gap: 2,
  },
  packageCarrier: {
    fontFamily: fonts.bold,
    fontSize: 15,
    color: colors.textPrimary,
  },
  packageTime: {
    fontFamily: fonts.medium,
    fontSize: 12,
    color: colors.textCaption,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: borderRadius.full,
  },
  statusBadgeText: {
    fontFamily: fonts.bold,
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  recipientRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  recipientName: {
    fontFamily: fonts.bold,
    fontSize: 13,
    color: colors.textBody,
    marginRight: spacing.md,
  },
  unitText: {
    fontFamily: fonts.medium,
    fontSize: 12,
    color: colors.textCaption,
  },
  trackingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  trackingLabel: {
    fontFamily: fonts.bold,
    fontSize: 10,
    color: colors.textCaption,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  trackingNumber: {
    fontFamily: fonts.medium,
    fontSize: 12,
    color: colors.textMuted,
  },
  actionRow: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.xl,
    marginTop: spacing.md,
  },
  confirmButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    height: spacing.smallButtonHeight,
    borderRadius: borderRadius.md,
    backgroundColor: colors.dark,
    ...shadows.md,
  },
  confirmButtonText: {
    fontFamily: fonts.bold,
    fontSize: 12,
    color: colors.textOnDark,
    textTransform: 'uppercase',
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
