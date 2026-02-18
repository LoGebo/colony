import { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  TextInput,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useStripe } from '@stripe/stripe-react-native';
import Animated, { FadeIn, FadeInDown, BounceIn } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@upoe/shared';
import { useResidentUnit } from '@/hooks/useOccupancy';
import { useUnitBalance, useCreatePaymentIntent } from '@/hooks/usePayments';
import { useRealtimeSubscription } from '@/hooks/useRealtimeSubscription';
import { formatCurrency } from '@/lib/dates';
import { AmbientBackground } from '@/components/ui/AmbientBackground';
import { colors, fonts, spacing, borderRadius, shadows } from '@/theme';

// ---------- Types ----------

type PaymentState = 'idle' | 'creating' | 'presenting' | 'processing' | 'success' | 'failed' | 'timeout';

// ---------- Helpers ----------

/** Generate a UUID v4. Uses crypto.randomUUID() if available, otherwise falls back to crypto.getRandomValues(). */
function generateUUID(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  // Fallback for Hermes/older React Native
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  bytes[6] = (bytes[6] & 0x0f) | 0x40; // version 4
  bytes[8] = (bytes[8] & 0x3f) | 0x80; // variant 1
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

// ---------- Screen ----------

export default function CheckoutScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { initPaymentSheet, presentPaymentSheet } = useStripe();
  const { unitId, unitNumber, isLoading: unitLoading } = useResidentUnit();
  const { data: balance, isLoading: balanceLoading } = useUnitBalance(unitId ?? undefined);
  const createPaymentIntent = useCreatePaymentIntent();

  // ---------- State ----------

  const [paymentState, setPaymentState] = useState<PaymentState>('idle');
  const [selectedAmount, setSelectedAmount] = useState<number | null>(null);
  const [customAmount, setCustomAmount] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [stripePaymentIntentId, setStripePaymentIntentId] = useState<string | null>(null);
  const [paidAmount, setPaidAmount] = useState<number>(0);

  // Ref to capture activeAmount for async callbacks (avoids stale closures)
  const activeAmountRef = useRef<number | null>(null);

  // ---------- Derived ----------

  const currentBalance = balance?.current_balance ?? 0;

  const quickAmounts = [
    { label: 'Full Balance', value: currentBalance },
    { label: '50%', value: Math.ceil((currentBalance / 2) * 100) / 100 },
  ];

  const parsedCustom = customAmount ? parseFloat(customAmount) : null;
  const activeAmount = selectedAmount ?? (parsedCustom !== null && !isNaN(parsedCustom) ? parsedCustom : null);
  const isValidAmount = activeAmount !== null && !isNaN(activeAmount) && activeAmount >= 10 && activeAmount <= currentBalance;

  // Keep ref in sync
  activeAmountRef.current = activeAmount;

  // ---------- Realtime Subscription ----------

  const handleRealtimeEvent = useCallback((payload: { new: { status: string } | null }) => {
    if (payload.new?.status === 'succeeded') {
      setPaymentState('success');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } else if (payload.new?.status === 'failed' || payload.new?.status === 'canceled') {
      setPaymentState('failed');
      setErrorMessage('Payment was not completed. Please try again.');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  }, []);

  useRealtimeSubscription({
    channelName: `payment-confirmation-${stripePaymentIntentId ?? 'none'}`,
    table: 'payment_intents',
    event: 'UPDATE',
    filter: `stripe_payment_intent_id=eq.${stripePaymentIntentId}`,
    queryKeys: [
      queryKeys.payments.balance(unitId ?? '').queryKey,
      queryKeys.payments.byUnit(unitId ?? '').queryKey,
    ],
    enabled: !!stripePaymentIntentId && paymentState === 'processing',
    onEvent: handleRealtimeEvent,
  });

  // ---------- 10-second timeout fallback ----------

  useEffect(() => {
    if (paymentState !== 'processing') return;
    const timer = setTimeout(() => {
      setPaymentState('timeout');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      queryClient.invalidateQueries({ queryKey: queryKeys.payments._def });
    }, 10_000);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paymentState]);

  // ---------- handlePay ----------

  const handlePay = useCallback(async () => {
    if (!activeAmountRef.current || !unitId || !unitNumber) return;
    const amount = activeAmountRef.current;
    setErrorMessage(null);
    setPaymentState('creating');
    setPaidAmount(amount); // Capture amount now, before any async ops

    try {
      // Step 1: Create PaymentIntent via edge function
      const idempotencyKey = generateUUID();
      const result = await createPaymentIntent.mutateAsync({
        unit_id: unitId,
        amount, // MXN pesos, NOT centavos
        description: `Pago de mantenimiento - ${unitNumber}`,
        idempotency_key: idempotencyKey,
        payment_method_type: 'card',
      });

      setStripePaymentIntentId(result.paymentIntentId);

      // Step 2: Initialize PaymentSheet
      const { error: initError } = await initPaymentSheet({
        merchantDisplayName: 'UPOE Community',
        paymentIntentClientSecret: result.clientSecret,
        customerId: result.customerId,
        returnURL: 'upoe://payment-sheet',
        allowsDelayedPaymentMethods: false,
      });

      if (initError) {
        setPaymentState('failed');
        setErrorMessage(initError.message);
        return;
      }

      // Step 3: Present PaymentSheet
      setPaymentState('presenting');
      const { error: presentError } = await presentPaymentSheet();

      if (presentError) {
        if (presentError.code === 'Canceled') {
          // User cancelled — silent return per UX spec
          setPaymentState('idle');
          return;
        }
        setPaymentState('failed');
        setErrorMessage(presentError.message);
        return;
      }

      // Step 4: PaymentSheet submitted — wait for Realtime confirmation
      setPaymentState('processing');
    } catch (err: unknown) {
      setPaymentState('failed');
      setErrorMessage(err instanceof Error ? err.message : 'An unexpected error occurred');
    }
  }, [unitId, unitNumber, createPaymentIntent, initPaymentSheet, presentPaymentSheet]);

  // ---------- handleRetry ----------

  const handleRetry = useCallback(() => {
    setPaymentState('idle');
    setErrorMessage(null);
    setStripePaymentIntentId(null);
    // Do NOT reset selectedAmount — preserve user's selection
  }, []);

  // ---------- Render: Loading ----------

  if (unitLoading || balanceLoading) {
    return (
      <View style={styles.container}>
        <AmbientBackground />
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="chevron-back" size={24} color={colors.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Pay with Card</Text>
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </View>
    );
  }

  // ---------- Render: Success / Timeout ----------

  if (paymentState === 'success' || paymentState === 'timeout') {
    return (
      <View style={styles.container}>
        <AmbientBackground />
        <View style={styles.successContainer}>
          <Animated.View entering={BounceIn.delay(200)} style={styles.successIconCircle}>
            <Ionicons name="checkmark" size={48} color={colors.textOnDark} />
          </Animated.View>
          <Animated.Text entering={FadeInDown.delay(400)} style={styles.successTitle}>
            {paymentState === 'timeout' ? 'Payment Submitted' : 'Payment Successful'}
          </Animated.Text>
          <Animated.Text entering={FadeInDown.delay(500)} style={styles.successAmount}>
            {formatCurrency(paidAmount)}
          </Animated.Text>
          {paymentState === 'timeout' && (
            <Animated.Text entering={FadeIn.delay(600)} style={styles.successSubtitle}>
              Your payment is being processed. Your balance will update shortly.
            </Animated.Text>
          )}
          <Animated.View entering={FadeIn.delay(700)}>
            <TouchableOpacity style={styles.successButton} onPress={() => router.back()}>
              <Text style={styles.successButtonText}>Done</Text>
            </TouchableOpacity>
          </Animated.View>
        </View>
      </View>
    );
  }

  // ---------- Render: Main Checkout ----------

  const isProcessing = paymentState === 'creating' || paymentState === 'presenting' || paymentState === 'processing';

  return (
    <View style={styles.container}>
      <AmbientBackground />

      {/* Header with back button — disabled during payment */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={[styles.backButton, isProcessing && styles.backButtonDisabled]}
          disabled={isProcessing}
        >
          <Ionicons name="chevron-back" size={24} color={isProcessing ? colors.textDisabled : colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Pay with Card</Text>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Balance Display */}
        <View style={styles.balanceSection}>
          <Text style={styles.balanceSectionLabel}>Outstanding Balance</Text>
          <Text style={styles.balanceSectionAmount}>{formatCurrency(currentBalance)}</Text>
        </View>

        {/* Amount Selection */}
        <View style={styles.amountSection}>
          <Text style={styles.amountSectionTitle}>Select Amount</Text>

          {/* Quick-select chips */}
          <View style={styles.chipRow}>
            {quickAmounts
              .filter((q) => q.value > 0)
              .map((q) => (
                <TouchableOpacity
                  key={q.label}
                  style={[styles.chip, selectedAmount === q.value && styles.chipSelected]}
                  onPress={() => {
                    setSelectedAmount(q.value);
                    setCustomAmount('');
                  }}
                >
                  <Text
                    style={[styles.chipText, selectedAmount === q.value && styles.chipTextSelected]}
                  >
                    {q.label}
                  </Text>
                  <Text
                    style={[
                      styles.chipAmount,
                      selectedAmount === q.value && styles.chipAmountSelected,
                    ]}
                  >
                    {formatCurrency(q.value)}
                  </Text>
                </TouchableOpacity>
              ))}
          </View>

          {/* Custom amount input */}
          <View style={styles.customAmountContainer}>
            <Text style={styles.customAmountLabel}>Or enter custom amount</Text>
            <View style={styles.customAmountInputRow}>
              <Text style={styles.currencyPrefix}>$</Text>
              <TextInput
                style={styles.customAmountInput}
                keyboardType="decimal-pad"
                placeholder="0.00"
                placeholderTextColor={colors.textDisabled}
                value={customAmount}
                onChangeText={(text) => {
                  // Allow only digits and one decimal point
                  const sanitized = text.replace(/[^0-9.]/g, '').replace(/(\..*)\./g, '$1');
                  setCustomAmount(sanitized);
                  setSelectedAmount(null);
                }}
              />
              <Text style={styles.currencySuffix}>MXN</Text>
            </View>
            {customAmount !== '' && parsedCustom !== null && isNaN(parsedCustom) && (
              <Text style={styles.amountError}>Please enter a valid number</Text>
            )}
            {activeAmount !== null && activeAmount < 10 && (
              <Text style={styles.amountError}>Minimum amount is $10.00 MXN</Text>
            )}
            {activeAmount !== null && activeAmount > currentBalance && (
              <Text style={styles.amountError}>Amount exceeds outstanding balance</Text>
            )}
          </View>
        </View>

        {/* Error message */}
        {errorMessage && (
          <View style={styles.errorBanner}>
            <Ionicons name="alert-circle" size={20} color={colors.danger} />
            <Text style={styles.errorText}>{errorMessage}</Text>
          </View>
        )}

        {/* Processing indicator */}
        {paymentState === 'processing' && (
          <View style={styles.processingBanner}>
            <ActivityIndicator size="small" color={colors.primary} />
            <Text style={styles.processingText}>Confirming payment...</Text>
          </View>
        )}
      </ScrollView>

      {/* Pay Button (fixed at bottom) */}
      <View style={styles.payButtonContainer}>
        <TouchableOpacity
          style={[
            styles.payButton,
            (!isValidAmount || !unitId || paymentState !== 'idle') && styles.payButtonDisabled,
          ]}
          onPress={handlePay}
          disabled={!isValidAmount || !unitId || paymentState !== 'idle'}
        >
          {isProcessing ? (
            <ActivityIndicator color={colors.textOnDark} size="small" />
          ) : (
            <Text style={styles.payButtonText}>
              {isValidAmount ? `Pay ${formatCurrency(activeAmount!)}` : 'Select an amount'}
            </Text>
          )}
        </TouchableOpacity>
        {paymentState === 'failed' && (
          <TouchableOpacity style={styles.retryLink} onPress={handleRetry}>
            <Text style={styles.retryLinkText}>Try again</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

// ---------- Styles ----------

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
    gap: spacing.lg,
  },
  headerTitle: {
    fontFamily: fonts.bold,
    fontSize: 24,
    color: colors.textPrimary,
    letterSpacing: -0.5,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.full,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  backButtonDisabled: {
    opacity: 0.4,
  },

  // Loading
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Scroll
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: spacing.pagePaddingX,
    paddingTop: spacing['3xl'],
    paddingBottom: 140,
  },

  // Balance Section
  balanceSection: {
    marginBottom: spacing['4xl'],
  },
  balanceSectionLabel: {
    fontFamily: fonts.medium,
    fontSize: 14,
    color: colors.textMuted,
    marginBottom: spacing.md,
  },
  balanceSectionAmount: {
    fontFamily: fonts.bold,
    fontSize: 32,
    color: colors.textPrimary,
    letterSpacing: -0.5,
  },

  // Amount Section
  amountSection: {
    marginBottom: spacing['3xl'],
  },
  amountSectionTitle: {
    fontFamily: fonts.bold,
    fontSize: 16,
    color: colors.textPrimary,
    marginBottom: spacing.xl,
  },

  // Chips
  chipRow: {
    flexDirection: 'row',
    gap: spacing.lg,
    marginBottom: spacing['3xl'],
  },
  chip: {
    flex: 1,
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  chipSelected: {
    backgroundColor: colors.primaryLightAlt,
    borderColor: colors.primary,
  },
  chipText: {
    fontFamily: fonts.medium,
    fontSize: 13,
    color: colors.textMuted,
    marginBottom: spacing.xs,
  },
  chipTextSelected: {
    color: colors.primary,
  },
  chipAmount: {
    fontFamily: fonts.bold,
    fontSize: 15,
    color: colors.textPrimary,
  },
  chipAmountSelected: {
    color: colors.primary,
  },

  // Custom Amount
  customAmountContainer: {
    marginBottom: spacing.xl,
  },
  customAmountLabel: {
    fontFamily: fonts.medium,
    fontSize: 13,
    color: colors.textMuted,
    marginBottom: spacing.lg,
  },
  customAmountInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.borderMedium,
    paddingHorizontal: spacing.xl,
    height: spacing.inputHeight,
  },
  currencyPrefix: {
    fontFamily: fonts.bold,
    fontSize: 18,
    color: colors.textPrimary,
    marginRight: spacing.md,
  },
  customAmountInput: {
    flex: 1,
    fontFamily: fonts.medium,
    fontSize: 18,
    color: colors.textPrimary,
    padding: 0,
  },
  currencySuffix: {
    fontFamily: fonts.medium,
    fontSize: 14,
    color: colors.textMuted,
    marginLeft: spacing.md,
  },
  amountError: {
    fontFamily: fonts.medium,
    fontSize: 12,
    color: colors.danger,
    marginTop: spacing.md,
  },

  // Error Banner
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
    padding: spacing.xl,
    backgroundColor: colors.dangerBgLight,
    borderRadius: borderRadius.lg,
    marginTop: spacing.xl,
  },
  errorText: {
    fontFamily: fonts.medium,
    fontSize: 13,
    color: colors.danger,
    flex: 1,
  },

  // Processing Banner
  processingBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
    padding: spacing.xl,
    backgroundColor: colors.primaryLight,
    borderRadius: borderRadius.lg,
    marginTop: spacing.xl,
  },
  processingText: {
    fontFamily: fonts.medium,
    fontSize: 13,
    color: colors.primary,
    flex: 1,
  },

  // Pay Button
  payButtonContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: spacing.pagePaddingX,
    paddingBottom: spacing.bottomNavClearance + 16,
    paddingTop: spacing.xl,
    backgroundColor: colors.background,
  },
  payButton: {
    height: spacing.buttonHeight,
    backgroundColor: colors.primary,
    borderRadius: borderRadius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.blueGlow,
  },
  payButtonDisabled: {
    backgroundColor: colors.textDisabled,
    shadowColor: undefined,
    shadowOffset: undefined,
    shadowOpacity: undefined,
    shadowRadius: undefined,
    elevation: 0,
  },
  payButtonText: {
    fontFamily: fonts.bold,
    fontSize: 16,
    color: colors.textOnDark,
  },
  retryLink: {
    alignItems: 'center',
    paddingTop: spacing.lg,
  },
  retryLinkText: {
    fontFamily: fonts.medium,
    fontSize: 14,
    color: colors.primary,
  },

  // Success
  successContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.pagePaddingX,
  },
  successIconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.success,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing['3xl'],
  },
  successTitle: {
    fontFamily: fonts.bold,
    fontSize: 24,
    color: colors.textPrimary,
    marginBottom: spacing.lg,
  },
  successAmount: {
    fontFamily: fonts.bold,
    fontSize: 36,
    color: colors.success,
    letterSpacing: -0.5,
    marginBottom: spacing.xl,
  },
  successSubtitle: {
    fontFamily: fonts.medium,
    fontSize: 14,
    color: colors.textMuted,
    textAlign: 'center',
    marginBottom: spacing['3xl'],
    paddingHorizontal: spacing['3xl'],
  },
  successButton: {
    height: spacing.buttonHeight,
    paddingHorizontal: 48,
    backgroundColor: colors.primary,
    borderRadius: borderRadius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.blueGlow,
  },
  successButtonText: {
    fontFamily: fonts.bold,
    fontSize: 16,
    color: colors.textOnDark,
  },
});
