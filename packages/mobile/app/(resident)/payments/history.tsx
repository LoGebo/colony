import { useState, useCallback } from 'react';
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
import { useResidentUnit } from '@/hooks/useOccupancy';
import { useTransactions, type Transaction } from '@/hooks/usePayments';
import { formatCurrency, formatDate } from '@/lib/dates';
import { AmbientBackground } from '@/components/ui/AmbientBackground';
import { colors, fonts, spacing, borderRadius, shadows } from '@/theme';

type FilterType = 'all' | 'charge' | 'payment' | 'adjustment';

const FILTERS: { key: FilterType; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'charge', label: 'Charges' },
  { key: 'payment', label: 'Payments' },
  { key: 'adjustment', label: 'Adjustments' },
];

function getTransactionIcon(type: string): { name: string; bg: string; color: string } {
  switch (type) {
    case 'payment':
      return { name: 'arrow-down-outline', bg: colors.tealLight, color: colors.teal };
    case 'charge':
      return { name: 'arrow-up-outline', bg: colors.dangerBgLight, color: colors.danger };
    case 'adjustment':
    case 'reversal':
      return { name: 'sparkles-outline', bg: colors.indigoBg, color: colors.indigo };
    case 'interest':
      return { name: 'trending-up-outline', bg: colors.border, color: colors.textCaption };
    case 'transfer':
      return { name: 'swap-horizontal-outline', bg: colors.border, color: colors.textCaption };
    default:
      return { name: 'swap-horizontal-outline', bg: colors.border, color: colors.textCaption };
  }
}

function getTypeLabel(type: string): string {
  switch (type) {
    case 'payment':
      return 'Payment';
    case 'charge':
      return 'Charge';
    case 'adjustment':
      return 'Adjustment';
    case 'reversal':
      return 'Reversal';
    case 'interest':
      return 'Interest';
    case 'transfer':
      return 'Transfer';
    default:
      return type.charAt(0).toUpperCase() + type.slice(1);
  }
}

function isPositiveTransaction(type: string): boolean {
  return type === 'payment' || type === 'adjustment' || type === 'reversal';
}

export default function TransactionHistoryScreen() {
  const router = useRouter();
  const { unitId } = useResidentUnit();
  const [activeFilter, setActiveFilter] = useState<FilterType>('all');

  const {
    data: pages,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    refetch,
    isLoading,
    isRefetching,
  } = useTransactions(unitId ?? undefined, 20);

  const allTransactions = pages?.pages.flatMap((p) => p.data) ?? [];

  const filteredTransactions = allTransactions.filter((tx) => {
    if (activeFilter === 'all') return true;
    if (activeFilter === 'adjustment') {
      return tx.transaction_type === 'adjustment' || tx.transaction_type === 'reversal';
    }
    return tx.transaction_type === activeFilter;
  });

  const onRefresh = useCallback(async () => {
    await refetch();
  }, [refetch]);

  const onEndReached = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const renderTransaction = useCallback(({ item }: { item: Transaction }) => {
    const iconConfig = getTransactionIcon(item.transaction_type);
    const positive = isPositiveTransaction(item.transaction_type);

    return (
      <View style={styles.transactionRow}>
        <View style={[styles.txIcon, { backgroundColor: iconConfig.bg }]}>
          <Ionicons name={iconConfig.name as any} size={20} color={iconConfig.color} />
        </View>
        <View style={styles.txInfo}>
          <Text style={styles.txTitle} numberOfLines={1}>
            {item.description}
          </Text>
          <Text style={styles.txSubtitle}>
            {formatDate(item.effective_date)} {'\u2022'} {getTypeLabel(item.transaction_type)}
          </Text>
        </View>
        <Text style={[styles.txAmount, positive && styles.txAmountPositive]}>
          {positive ? '+' : '-'}
          {formatCurrency(Math.abs(item.amount), item.currency)}
        </Text>
      </View>
    );
  }, []);

  const renderEmpty = useCallback(() => {
    if (isLoading) return null;
    return (
      <View style={styles.emptyState}>
        <View style={styles.emptyIconBox}>
          <Ionicons name="receipt-outline" size={40} color={colors.textDisabled} />
        </View>
        <Text style={styles.emptyTitle}>No Transactions</Text>
        <Text style={styles.emptySubtitle}>
          {activeFilter === 'all'
            ? 'Your transaction history will appear here.'
            : `No ${activeFilter} transactions found.`}
        </Text>
      </View>
    );
  }, [isLoading, activeFilter]);

  const renderFooter = useCallback(() => {
    if (!hasNextPage) return null;
    if (isFetchingNextPage) {
      return (
        <ActivityIndicator
          color={colors.primary}
          style={styles.footerLoader}
        />
      );
    }
    return (
      <TouchableOpacity style={styles.loadMoreButton} onPress={() => fetchNextPage()}>
        <Text style={styles.loadMoreText}>Load more</Text>
      </TouchableOpacity>
    );
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  return (
    <View style={styles.container}>
      <AmbientBackground />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="chevron-back" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Transaction History</Text>
        <View style={styles.headerSpacer} />
      </View>

      {/* Filter Pills */}
      <View style={styles.filterRow}>
        {FILTERS.map((filter) => {
          const active = activeFilter === filter.key;
          return (
            <TouchableOpacity
              key={filter.key}
              style={[styles.filterPill, active && styles.filterPillActive]}
              onPress={() => setActiveFilter(filter.key)}
            >
              <Text style={[styles.filterText, active && styles.filterTextActive]}>
                {filter.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Transaction List */}
      {isLoading ? (
        <ActivityIndicator color={colors.primary} style={styles.mainLoader} />
      ) : (
        <FlatList
          data={filteredTransactions}
          keyExtractor={(item) => item.id}
          renderItem={renderTransaction}
          ListEmptyComponent={renderEmpty}
          ListFooterComponent={renderFooter}
          onEndReached={onEndReached}
          onEndReachedThreshold={0.3}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching && !isFetchingNextPage}
              onRefresh={onRefresh}
              tintColor={colors.primary}
            />
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: spacing.xl,
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
    fontSize: 18,
    color: colors.textPrimary,
    letterSpacing: -0.5,
  },
  headerSpacer: {
    width: 40,
  },
  // Filter Pills
  filterRow: {
    flexDirection: 'row',
    paddingHorizontal: spacing.pagePaddingX,
    gap: spacing.md,
    marginBottom: spacing.xl,
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
  // List
  listContent: {
    paddingHorizontal: spacing.pagePaddingX,
    paddingBottom: spacing.bottomNavClearance + 16,
    gap: spacing.lg,
  },
  transactionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xl,
    padding: spacing.xl,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.sm,
  },
  txIcon: {
    width: 44,
    height: 44,
    borderRadius: borderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  txInfo: {
    flex: 1,
  },
  txTitle: {
    fontFamily: fonts.bold,
    fontSize: 14,
    color: colors.textSecondary,
  },
  txSubtitle: {
    fontFamily: fonts.medium,
    fontSize: 12,
    color: colors.textCaption,
    marginTop: 2,
  },
  txAmount: {
    fontFamily: fonts.bold,
    fontSize: 14,
    color: colors.textPrimary,
  },
  txAmountPositive: {
    color: colors.tealDark,
  },
  // Empty State
  emptyState: {
    alignItems: 'center',
    paddingVertical: spacing['6xl'],
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
  // Footer
  loadMoreButton: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
  },
  loadMoreText: {
    fontFamily: fonts.bold,
    fontSize: 12,
    color: colors.primary,
  },
  footerLoader: {
    paddingVertical: spacing.xl,
  },
  mainLoader: {
    flex: 1,
    justifyContent: 'center',
  },
});
