import { useCallback } from 'react';
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
import { useReceipts, type Receipt } from '@/hooks/usePayments';
import { formatCurrency, formatDate } from '@/lib/dates';
import { AmbientBackground } from '@/components/ui/AmbientBackground';
import { colors, fonts, spacing, borderRadius, shadows } from '@/theme';

function getPaymentMethodLabel(method: string): string {
  switch (method) {
    case 'card':
      return 'Tarjeta';
    case 'oxxo':
      return 'OXXO';
    case 'transfer':
      return 'Transferencia';
    case 'cash':
      return 'Efectivo';
    default:
      return method.charAt(0).toUpperCase() + method.slice(1);
  }
}

function getPaymentMethodIcon(method: string): string {
  switch (method) {
    case 'card':
      return 'card-outline';
    case 'oxxo':
      return 'storefront-outline';
    case 'transfer':
      return 'swap-horizontal-outline';
    case 'cash':
      return 'cash-outline';
    default:
      return 'receipt-outline';
  }
}

export default function ReceiptsScreen() {
  const router = useRouter();
  const { unitId } = useResidentUnit();
  const {
    data: receipts,
    isLoading,
    isRefetching,
    refetch,
  } = useReceipts(unitId ?? undefined);

  const onRefresh = useCallback(async () => {
    await refetch();
  }, [refetch]);

  const renderReceipt = useCallback(({ item }: { item: Receipt }) => {
    return (
      <View style={styles.receiptRow}>
        <View style={styles.receiptIcon}>
          <Ionicons
            name={getPaymentMethodIcon(item.payment_method) as any}
            size={20}
            color={colors.teal}
          />
        </View>
        <View style={styles.receiptInfo}>
          <Text style={styles.receiptNumber}>{item.receipt_number}</Text>
          <Text style={styles.receiptDescription} numberOfLines={1}>
            {item.description}
          </Text>
          <Text style={styles.receiptMeta}>
            {formatDate(item.payment_date)} {'\u2022'} {getPaymentMethodLabel(item.payment_method)}
          </Text>
        </View>
        <View style={styles.receiptAmountBox}>
          <Text style={styles.receiptAmount}>
            {formatCurrency(item.amount)}
          </Text>
        </View>
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
        <Text style={styles.emptyTitle}>No Receipts</Text>
        <Text style={styles.emptySubtitle}>
          Your payment receipts will appear here after each successful payment.
        </Text>
      </View>
    );
  }, [isLoading]);

  return (
    <View style={styles.container}>
      <AmbientBackground />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="chevron-back" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Receipts</Text>
        <View style={styles.headerSpacer} />
      </View>

      {/* Receipt List */}
      {isLoading ? (
        <ActivityIndicator color={colors.primary} style={styles.mainLoader} />
      ) : (
        <FlatList
          data={receipts ?? []}
          keyExtractor={(item) => item.id}
          renderItem={renderReceipt}
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
  // List
  listContent: {
    paddingHorizontal: spacing.pagePaddingX,
    paddingBottom: spacing.bottomNavClearance + 16,
    gap: spacing.lg,
  },
  receiptRow: {
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
  receiptIcon: {
    width: 44,
    height: 44,
    borderRadius: borderRadius.full,
    backgroundColor: colors.tealLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  receiptInfo: {
    flex: 1,
  },
  receiptNumber: {
    fontFamily: fonts.bold,
    fontSize: 14,
    color: colors.textSecondary,
  },
  receiptDescription: {
    fontFamily: fonts.medium,
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 1,
  },
  receiptMeta: {
    fontFamily: fonts.medium,
    fontSize: 11,
    color: colors.textCaption,
    marginTop: 2,
  },
  receiptAmountBox: {
    alignItems: 'flex-end',
  },
  receiptAmount: {
    fontFamily: fonts.bold,
    fontSize: 14,
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
  mainLoader: {
    flex: 1,
    justifyContent: 'center',
  },
});
