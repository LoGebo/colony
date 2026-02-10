import { View, Text, TouchableOpacity, ScrollView, StyleSheet, RefreshControl, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useResidentUnit } from '@/hooks/useOccupancy';
import { useUnitBalance, useTransactions, usePaymentProofs } from '@/hooks/usePayments';
import { formatCurrency, formatDate } from '@/lib/dates';
import { AmbientBackground } from '@/components/ui/AmbientBackground';
import { GlassCard } from '@/components/ui/GlassCard';
import { colors, fonts, spacing, borderRadius, shadows } from '@/theme';

export default function PaymentDashboardScreen() {
  const router = useRouter();
  const { unitId } = useResidentUnit();
  const { data: balance, refetch: refetchBalance } = useUnitBalance(unitId ?? undefined);
  const {
    data: transactionPages,
    fetchNextPage,
    hasNextPage,
    refetch: refetchTx,
    isLoading: txLoading,
  } = useTransactions(unitId ?? undefined, 10);
  const { data: proofs, refetch: refetchProofs } = usePaymentProofs(unitId ?? undefined);

  const transactions = transactionPages?.pages.flatMap((p) => p.data) ?? [];
  const pendingProof = proofs?.find((p) => p.status === 'pending');

  const currentBalance = balance?.current_balance ?? 0;
  const daysOverdue = balance?.days_overdue ?? 0;

  const onRefresh = async () => {
    await Promise.all([refetchBalance(), refetchTx(), refetchProofs()]);
  };

  const getTransactionIcon = (type: string): { name: string; bg: string; color: string } => {
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
  };

  return (
    <View style={styles.container}>
      <AmbientBackground />

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Billing</Text>
      </View>

      {/* Content */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={false} onRefresh={onRefresh} tintColor={colors.primary} />}
      >
        {/* Balance Card */}
        <View style={styles.balanceCard}>
          <View style={styles.balanceOrb} />
          <View style={styles.balanceContent}>
            <View style={styles.balanceHeader}>
              <Text style={styles.balanceLabel}>Outstanding Balance</Text>
              {daysOverdue > 0 && (
                <View style={styles.overdueBadge}>
                  <Ionicons name="alert-circle-outline" size={12} color="#F87171" />
                  <Text style={styles.overdueBadgeText}>{daysOverdue} Days Overdue</Text>
                </View>
              )}
            </View>
            <Text style={styles.balanceAmount}>{formatCurrency(currentBalance)}</Text>
            <View style={styles.balanceActions}>
              <TouchableOpacity style={styles.payButton}>
                <Text style={styles.payButtonText}>Pay Now</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.uploadButton}
                onPress={() => router.push('/(resident)/payments/upload-proof')}
              >
                <Ionicons name="cloud-upload-outline" size={20} color={colors.textOnDark} />
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* Upload Receipt Action */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>PAYMENT ACTIONS</Text>
          <TouchableOpacity
            onPress={() => router.push('/(resident)/payments/upload-proof')}
          >
            <GlassCard style={styles.actionCard}>
              <View style={[styles.actionIconBox, { backgroundColor: colors.primaryLightAlt }]}>
                <Ionicons name="document-text-outline" size={20} color={colors.primary} />
              </View>
              <View style={styles.actionTextContainer}>
                <Text style={styles.actionTitle}>Upload Transfer Receipt</Text>
                <Text style={styles.actionSubtitle}>Send bank proof for manual verification</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={colors.textCaption} />
            </GlassCard>
          </TouchableOpacity>
        </View>

        {/* Pending Proof */}
        {pendingProof && (
          <View style={styles.pendingProofCard}>
            <View style={styles.pendingProofHeader}>
              <View style={styles.pendingProofIconBox}>
                <Ionicons name="time-outline" size={20} color={colors.warningText} />
              </View>
              <View style={styles.pendingProofInfo}>
                <Text style={styles.pendingProofTitle}>Receipt Pending</Text>
                <Text style={styles.pendingProofSubtitle}>
                  {pendingProof.payment_date ? formatDate(pendingProof.payment_date) : ''}
                  {pendingProof.reference_number ? ` • Ref ${pendingProof.reference_number}` : ''}
                </Text>
              </View>
              <View style={styles.pendingProofAmount}>
                <Text style={styles.pendingProofAmountText}>{formatCurrency(pendingProof.amount)}</Text>
                <Text style={styles.pendingProofStatus}>Verifying</Text>
              </View>
            </View>
            {/* Progress bar */}
            <View style={styles.progressBarBg}>
              <View style={styles.progressBarFill} />
            </View>
          </View>
        )}

        {/* Transaction History */}
        <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>RECENT ACTIVITY</Text>
            <TouchableOpacity onPress={() => router.push('/(resident)/payments/history')}>
              <Text style={styles.viewAllText}>View All</Text>
            </TouchableOpacity>
          </View>

          {txLoading ? (
            <ActivityIndicator color={colors.primary} style={styles.loadingIndicator} />
          ) : transactions.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="receipt-outline" size={40} color={colors.textDisabled} />
              <Text style={styles.emptyText}>No transactions yet</Text>
            </View>
          ) : (
            <View style={styles.transactionList}>
              {transactions.map((tx, index) => {
                const iconConfig = getTransactionIcon(tx.transaction_type);
                const isPayment = tx.transaction_type === 'payment' || tx.transaction_type === 'adjustment' || tx.transaction_type === 'reversal';
                const isOld = index >= transactions.length - 1;

                return (
                  <View
                    key={tx.id}
                    style={[
                      styles.transactionRow,
                      isOld && styles.transactionRowFaded,
                    ]}
                  >
                    <View style={[styles.txIcon, { backgroundColor: iconConfig.bg }]}>
                      <Ionicons name={iconConfig.name as any} size={20} color={iconConfig.color} />
                    </View>
                    <View style={styles.txInfo}>
                      <Text style={styles.txTitle}>{tx.description}</Text>
                      <Text style={styles.txSubtitle}>
                        {formatDate(tx.effective_date)} • {tx.transaction_type.charAt(0).toUpperCase() + tx.transaction_type.slice(1)}
                      </Text>
                    </View>
                    <Text style={[styles.txAmount, isPayment && styles.txAmountPositive]}>
                      {isPayment ? '+' : '-'}{formatCurrency(Math.abs(tx.amount))}
                    </Text>
                  </View>
                );
              })}

              {hasNextPage && (
                <TouchableOpacity style={styles.loadMoreButton} onPress={() => fetchNextPage()}>
                  <Text style={styles.loadMoreText}>Load more</Text>
                </TouchableOpacity>
              )}
            </View>
          )}
        </View>
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
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerTitle: {
    fontFamily: fonts.bold,
    fontSize: 24,
    color: colors.textPrimary,
    letterSpacing: -0.5,
  },
  // ScrollView
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: spacing.pagePaddingX,
    paddingTop: spacing['3xl'],
    paddingBottom: spacing.bottomNavClearance + 16,
  },
  // Balance Card
  balanceCard: {
    padding: spacing['3xl'],
    backgroundColor: colors.dark,
    borderRadius: borderRadius['3xl'],
    overflow: 'hidden',
    marginBottom: spacing['4xl'],
    ...shadows.xl,
  },
  balanceOrb: {
    position: 'absolute',
    right: -48,
    top: -48,
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: colors.ambientDarkOrb,
  },
  balanceContent: {
    zIndex: 1,
  },
  balanceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 4,
  },
  balanceLabel: {
    fontFamily: fonts.medium,
    fontSize: 14,
    color: colors.textOnDarkMuted,
  },
  overdueBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    backgroundColor: 'rgba(239,68,68,0.2)',
    borderRadius: borderRadius.sm,
  },
  overdueBadgeText: {
    fontFamily: fonts.bold,
    fontSize: 10,
    color: '#F87171',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  balanceAmount: {
    fontFamily: fonts.bold,
    fontSize: 36,
    color: colors.textOnDark,
    letterSpacing: -0.5,
    marginBottom: spacing['3xl'],
  },
  balanceActions: {
    flexDirection: 'row',
    gap: spacing.lg,
  },
  payButton: {
    flex: 1,
    height: spacing.smallButtonHeight,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  payButtonText: {
    fontFamily: fonts.bold,
    fontSize: 14,
    color: colors.textPrimary,
  },
  uploadButton: {
    width: spacing.smallButtonHeight,
    height: spacing.smallButtonHeight,
    backgroundColor: colors.borderDarkInner,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.borderDarkInner,
  },
  // Section
  section: {
    marginBottom: spacing['4xl'],
  },
  sectionTitle: {
    fontFamily: fonts.bold,
    fontSize: 12,
    color: colors.textCaption,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    marginLeft: 4,
    marginBottom: spacing.xl,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginBottom: spacing.xl,
  },
  viewAllText: {
    fontFamily: fonts.bold,
    fontSize: 11,
    color: colors.primary,
    marginBottom: spacing.xl,
  },
  // Action Card
  actionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xl,
    padding: spacing.xl,
    borderRadius: borderRadius.lg,
  },
  actionIconBox: {
    width: 44,
    height: 44,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionTextContainer: {
    flex: 1,
  },
  actionTitle: {
    fontFamily: fonts.bold,
    fontSize: 14,
    color: colors.textSecondary,
  },
  actionSubtitle: {
    fontFamily: fonts.medium,
    fontSize: 12,
    color: colors.textMuted,
  },
  // Pending Proof
  pendingProofCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    borderLeftWidth: 4,
    borderLeftColor: colors.borderAmberAccent,
    padding: spacing.xl,
    marginBottom: spacing['3xl'],
    ...shadows.sm,
  },
  pendingProofHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
    marginBottom: spacing.lg,
  },
  pendingProofIconBox: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.full,
    backgroundColor: colors.warningBgLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pendingProofInfo: {
    flex: 1,
  },
  pendingProofTitle: {
    fontFamily: fonts.bold,
    fontSize: 14,
    color: colors.textSecondary,
  },
  pendingProofSubtitle: {
    fontFamily: fonts.medium,
    fontSize: 11,
    color: colors.textCaption,
  },
  pendingProofAmount: {
    alignItems: 'flex-end',
  },
  pendingProofAmountText: {
    fontFamily: fonts.bold,
    fontSize: 14,
    color: colors.warningText,
  },
  pendingProofStatus: {
    fontFamily: fonts.medium,
    fontSize: 10,
    color: colors.warning,
  },
  progressBarBg: {
    height: 6,
    backgroundColor: colors.border,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    width: '66%',
    backgroundColor: colors.borderAmberAccent,
    borderRadius: 3,
  },
  // Transaction List
  transactionList: {
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
  transactionRowFaded: {
    opacity: 0.6,
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
  },
  txAmount: {
    fontFamily: fonts.bold,
    fontSize: 14,
    color: colors.textPrimary,
  },
  txAmountPositive: {
    color: colors.tealDark,
  },
  loadMoreButton: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
  },
  loadMoreText: {
    fontFamily: fonts.bold,
    fontSize: 12,
    color: colors.primary,
  },
  // Empty
  emptyState: {
    alignItems: 'center',
    paddingVertical: spacing['4xl'],
    gap: spacing.lg,
  },
  emptyText: {
    fontFamily: fonts.medium,
    fontSize: 14,
    color: colors.textMuted,
  },
  loadingIndicator: {
    paddingVertical: spacing['4xl'],
  },
});
