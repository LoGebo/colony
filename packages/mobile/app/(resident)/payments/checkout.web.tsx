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
import { useRouter, useLocalSearchParams, useNavigation } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, CardElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@upoe/shared';
import { useResidentUnit } from '@/hooks/useOccupancy';
import { useUnitBalance, useCreatePaymentIntent, pendingOxxoQueryKey, type BankTransferDetails } from '@/hooks/usePayments';
import { useResidentProfile } from '@/hooks/useProfile';
import { useAuth } from '@/hooks/useAuth';
import { useRealtimeSubscription } from '@/hooks/useRealtimeSubscription';
import { formatCurrency } from '@/lib/dates';
import { AmbientBackground } from '@/components/ui/AmbientBackground';
import { colors, fonts, spacing, borderRadius, shadows } from '@/theme';

// ---------- Stripe Web Setup ----------

const stripePromise = loadStripe(process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY!);

// ---------- Types ----------

type PaymentState = 'idle' | 'creating' | 'presenting' | 'processing' | 'success' | 'failed' | 'timeout' | 'voucher_generated' | 'spei_instructions';

// ---------- Helpers ----------

function generateUUID(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

// ---------- Card Element Styles ----------

const CARD_ELEMENT_OPTIONS = {
  style: {
    base: {
      fontSize: '16px',
      fontFamily: 'system-ui, -apple-system, sans-serif',
      color: '#1a1a2e',
      '::placeholder': { color: '#a0a0b0' },
    },
    invalid: { color: '#e53e3e' },
  },
};

// ---------- Inner Checkout (inside Elements provider) ----------

function CheckoutInner() {
  const router = useRouter();
  const { paymentMethodType, enableInstallments } = useLocalSearchParams<{ paymentMethodType?: string; enableInstallments?: string }>();
  const isOxxo = paymentMethodType === 'oxxo';
  const isSpei = paymentMethodType === 'spei';
  const isMsi = enableInstallments === 'true';
  const queryClient = useQueryClient();
  const stripe = useStripe();
  const elements = useElements();
  const { unitId, unitNumber, isLoading: unitLoading } = useResidentUnit();
  const { data: balance, isLoading: balanceLoading } = useUnitBalance(unitId ?? undefined);
  const createPaymentIntent = useCreatePaymentIntent();
  const { data: profile } = useResidentProfile();
  const { user } = useAuth();
  const navigation = useNavigation();

  // ---------- State ----------

  const [paymentState, setPaymentState] = useState<PaymentState>('idle');
  const [selectedAmount, setSelectedAmount] = useState<number | null>(null);
  const [customAmount, setCustomAmount] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [stripePaymentIntentId, setStripePaymentIntentId] = useState<string | null>(null);
  const [paidAmount, setPaidAmount] = useState<number>(0);
  const [bankTransfer, setBankTransfer] = useState<BankTransferDetails | null>(null);
  const activeAmountRef = useRef<number | null>(null);

  // ---------- Disable gesture back during payment ----------

  useEffect(() => {
    const isProcessing = paymentState === 'creating' || paymentState === 'presenting' || paymentState === 'processing';
    navigation.setOptions({ gestureEnabled: !isProcessing });
  }, [paymentState, navigation]);

  // ---------- Derived ----------

  const currentBalance = balance?.current_balance ?? 0;

  const quickAmounts = [
    { label: 'Full Balance', value: currentBalance },
    { label: '50%', value: Math.ceil((currentBalance / 2) * 100) / 100 },
  ];

  const parsedCustom = customAmount ? parseFloat(customAmount) : null;
  const activeAmount = selectedAmount ?? (parsedCustom !== null && !isNaN(parsedCustom) ? parsedCustom : null);
  const isValidAmount = activeAmount !== null && !isNaN(activeAmount) && activeAmount >= 10 && activeAmount <= currentBalance;

  activeAmountRef.current = activeAmount;

  // ---------- Realtime Subscription ----------

  const handleRealtimeEvent = useCallback((payload: { new: { status: string } | null }) => {
    if (payload.new?.status === 'succeeded') {
      setPaymentState('success');
    } else if (payload.new?.status === 'failed' || payload.new?.status === 'canceled') {
      setPaymentState('failed');
      setErrorMessage('Payment was not completed. Please try again.');
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
      queryClient.invalidateQueries({ queryKey: queryKeys.payments._def });
    }, 5_000);
    return () => clearTimeout(timer);
  }, [paymentState]);

  // ---------- handlePay ----------

  const handlePay = useCallback(async () => {
    if (!activeAmountRef.current || !unitId || !unitNumber || !stripe) return;
    const amount = activeAmountRef.current;
    setErrorMessage(null);
    setPaymentState('creating');
    setPaidAmount(amount);

    try {
      const idempotencyKey = generateUUID();
      const result = await createPaymentIntent.mutateAsync({
        unit_id: unitId,
        amount,
        description: isSpei
          ? `Pago SPEI - ${unitNumber}`
          : isOxxo
            ? `Pago OXXO - ${unitNumber}`
            : `Pago de mantenimiento - ${unitNumber}`,
        idempotency_key: idempotencyKey,
        payment_method_type: isSpei ? 'spei' : isOxxo ? 'oxxo' : 'card',
        enable_installments: isMsi ? true : undefined,
      });

      setStripePaymentIntentId(result.paymentIntentId);

      // --- OXXO Flow (Web) ---
      if (isOxxo) {
        const fullName = profile?.first_name && profile?.paternal_surname
          ? `${profile.first_name} ${profile.paternal_surname}`
          : (user?.email ?? 'Residente');
        const email = user?.email ?? '';

        if (!email) {
          setPaymentState('failed');
          setErrorMessage('OXXO payments require an email address.');
          return;
        }

        setPaymentState('presenting');
        const { error: oxxoError } = await stripe.confirmOxxoPayment(
          result.clientSecret,
          {
            payment_method: {
              billing_details: { name: fullName, email },
            },
          },
        );

        if (oxxoError) {
          setPaymentState('failed');
          setErrorMessage(oxxoError.message ?? 'OXXO payment failed');
          return;
        }

        setPaymentState('voucher_generated');
        queryClient.invalidateQueries({ queryKey: pendingOxxoQueryKey(unitId ?? undefined) });
        return;
      }

      // --- SPEI Flow ---
      if (isSpei) {
        if (result.bankTransfer) {
          setBankTransfer(result.bankTransfer);
        }
        setPaymentState('spei_instructions');
        return;
      }

      // --- Card Flow (Web) ---
      if (!elements) return;
      const cardElement = elements.getElement(CardElement);
      if (!cardElement) {
        setPaymentState('failed');
        setErrorMessage('Card input not ready. Please try again.');
        return;
      }

      setPaymentState('presenting');
      const { error: confirmError } = await stripe.confirmCardPayment(
        result.clientSecret,
        { payment_method: { card: cardElement } },
      );

      if (confirmError) {
        if (confirmError.type === 'validation_error') {
          setPaymentState('idle');
          return;
        }
        setPaymentState('failed');
        setErrorMessage(confirmError.message ?? 'Card payment failed');
        return;
      }

      setPaymentState('processing');
    } catch (err: unknown) {
      setPaymentState('failed');
      setErrorMessage(err instanceof Error ? err.message : 'An unexpected error occurred');
    }
  }, [unitId, unitNumber, createPaymentIntent, stripe, elements, isOxxo, isSpei, isMsi, profile, user]);

  // ---------- handleRetry ----------

  const handleRetry = useCallback(() => {
    setPaymentState('idle');
    setErrorMessage(null);
    setStripePaymentIntentId(null);
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
          <Text style={styles.headerTitle}>{isSpei ? 'SPEI Transfer' : isOxxo ? 'Pay with OXXO' : 'Pay with Card'}</Text>
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
          <View style={styles.successIconCircle}>
            <Ionicons name="checkmark" size={48} color={colors.textOnDark} />
          </View>
          <Text style={styles.successTitle}>
            {paymentState === 'timeout' ? 'Payment Submitted' : 'Payment Successful'}
          </Text>
          <Text style={styles.successAmount}>{formatCurrency(paidAmount)}</Text>
          {paymentState === 'timeout' && (
            <Text style={styles.successSubtitle}>
              Your payment is being processed. Your balance will update shortly.
            </Text>
          )}
          <TouchableOpacity style={styles.successButton} onPress={() => router.back()}>
            <Text style={styles.successButtonText}>Done</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // ---------- Render: Voucher Generated ----------

  if (paymentState === 'voucher_generated') {
    return (
      <View style={styles.container}>
        <AmbientBackground />
        <View style={styles.successContainer}>
          <View style={[styles.successIconCircle, { backgroundColor: colors.primary }]}>
            <Ionicons name="receipt-outline" size={40} color={colors.textOnDark} />
          </View>
          <Text style={styles.successTitle}>Voucher Generado</Text>
          <Text style={styles.successAmount}>{formatCurrency(paidAmount)}</Text>
          <Text style={styles.successSubtitle}>
            Presenta el voucher en cualquier OXXO para completar tu pago. El voucher expira en 48 horas.
          </Text>
          <TouchableOpacity style={styles.successButton} onPress={() => router.back()}>
            <Text style={styles.successButtonText}>Volver a Pagos</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // ---------- Render: SPEI Instructions ----------

  if (paymentState === 'spei_instructions' && bankTransfer) {
    return (
      <View style={styles.container}>
        <AmbientBackground />
        <View style={styles.successContainer}>
          <View style={[styles.successIconCircle, { backgroundColor: colors.primary }]}>
            <Ionicons name="business-outline" size={40} color={colors.textOnDark} />
          </View>
          <Text style={styles.successTitle}>Transferencia SPEI</Text>
          <Text style={styles.successAmount}>{formatCurrency(paidAmount)}</Text>
          <View style={styles.speiDetailsCard}>
            {bankTransfer.clabe && (
              <View style={styles.speiRow}>
                <Text style={styles.speiLabel}>CLABE</Text>
                <Text style={styles.speiValue} selectable>{bankTransfer.clabe}</Text>
              </View>
            )}
            {bankTransfer.bankName && (
              <View style={styles.speiRow}>
                <Text style={styles.speiLabel}>Banco</Text>
                <Text style={styles.speiValue}>{bankTransfer.bankName}</Text>
              </View>
            )}
            {bankTransfer.reference && (
              <View style={styles.speiRow}>
                <Text style={styles.speiLabel}>Referencia</Text>
                <Text style={styles.speiValue} selectable>{bankTransfer.reference}</Text>
              </View>
            )}
          </View>
          <Text style={styles.successSubtitle}>
            Realiza la transferencia desde tu banca en linea. Tu pago se acreditara en 1-3 dias habiles.
          </Text>
          <TouchableOpacity style={styles.successButton} onPress={() => router.back()}>
            <Text style={styles.successButtonText}>Volver a Pagos</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // ---------- Render: Main Checkout ----------

  const isProcessing = paymentState === 'creating' || paymentState === 'presenting' || paymentState === 'processing';
  const isCard = !isOxxo && !isSpei;

  return (
    <View style={styles.container}>
      <AmbientBackground />

      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={[styles.backButton, isProcessing && styles.backButtonDisabled]}
          disabled={isProcessing}
        >
          <Ionicons name="chevron-back" size={24} color={isProcessing ? colors.textDisabled : colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{isSpei ? 'SPEI Transfer' : isOxxo ? 'Pay with OXXO' : isMsi ? 'Pay in Installments' : 'Pay with Card'}</Text>
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

          <View style={styles.chipRow}>
            {quickAmounts
              .filter((q) => q.value > 0)
              .map((q) => (
                <TouchableOpacity
                  key={q.label}
                  style={[styles.chip, selectedAmount === q.value && styles.chipSelected]}
                  onPress={() => { setSelectedAmount(q.value); setCustomAmount(''); }}
                >
                  <Text style={[styles.chipText, selectedAmount === q.value && styles.chipTextSelected]}>{q.label}</Text>
                  <Text style={[styles.chipAmount, selectedAmount === q.value && styles.chipAmountSelected]}>{formatCurrency(q.value)}</Text>
                </TouchableOpacity>
              ))}
          </View>

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

        {/* Stripe Card Element (web) — only for card payments */}
        {isCard && (
          <View style={styles.cardElementContainer}>
            <Text style={styles.cardElementLabel}>Card Details</Text>
            <View style={styles.cardElementWrapper}>
              <CardElement options={CARD_ELEMENT_OPTIONS} />
            </View>
          </View>
        )}

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

      {/* Pay Button */}
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
              {isValidAmount
                ? (isSpei ? `Transfer ${formatCurrency(activeAmount!)}` : isOxxo ? `Generar Voucher ${formatCurrency(activeAmount!)}` : `Pay ${formatCurrency(activeAmount!)}`)
                : 'Select an amount'}
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

// ---------- Wrapper: loads Stripe Elements ----------

export default function CheckoutScreen() {
  return (
    <Elements stripe={stripePromise}>
      <CheckoutInner />
    </Elements>
  );
}

// ---------- Styles ----------

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    paddingTop: spacing.safeAreaTop,
    paddingHorizontal: spacing.pagePaddingX,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
  },
  headerTitle: { fontFamily: fonts.bold, fontSize: 24, color: colors.textPrimary, letterSpacing: -0.5 },
  backButton: {
    width: 40, height: 40, borderRadius: borderRadius.full,
    backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: colors.border,
  },
  backButtonDisabled: { opacity: 0.4 },
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scrollView: { flex: 1 },
  scrollContent: { paddingHorizontal: spacing.pagePaddingX, paddingTop: spacing['3xl'], paddingBottom: 140 },
  balanceSection: { marginBottom: spacing['4xl'] },
  balanceSectionLabel: { fontFamily: fonts.medium, fontSize: 14, color: colors.textMuted, marginBottom: spacing.md },
  balanceSectionAmount: { fontFamily: fonts.bold, fontSize: 32, color: colors.textPrimary, letterSpacing: -0.5 },
  amountSection: { marginBottom: spacing['3xl'] },
  amountSectionTitle: { fontFamily: fonts.bold, fontSize: 16, color: colors.textPrimary, marginBottom: spacing.xl },
  chipRow: { flexDirection: 'row', gap: spacing.lg, marginBottom: spacing['3xl'] },
  chip: {
    flex: 1, paddingVertical: spacing.xl, paddingHorizontal: spacing.lg,
    backgroundColor: colors.surface, borderRadius: borderRadius.lg,
    borderWidth: 1, borderColor: colors.border, alignItems: 'center',
  },
  chipSelected: { backgroundColor: colors.primaryLightAlt, borderColor: colors.primary },
  chipText: { fontFamily: fonts.medium, fontSize: 13, color: colors.textMuted, marginBottom: spacing.xs },
  chipTextSelected: { color: colors.primary },
  chipAmount: { fontFamily: fonts.bold, fontSize: 15, color: colors.textPrimary },
  chipAmountSelected: { color: colors.primary },
  customAmountContainer: { marginBottom: spacing.xl },
  customAmountLabel: { fontFamily: fonts.medium, fontSize: 13, color: colors.textMuted, marginBottom: spacing.lg },
  customAmountInputRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.surface, borderRadius: borderRadius.lg,
    borderWidth: 1, borderColor: colors.borderMedium,
    paddingHorizontal: spacing.xl, height: spacing.inputHeight,
  },
  currencyPrefix: { fontFamily: fonts.bold, fontSize: 18, color: colors.textPrimary, marginRight: spacing.md },
  customAmountInput: { flex: 1, fontFamily: fonts.medium, fontSize: 18, color: colors.textPrimary, padding: 0 },
  currencySuffix: { fontFamily: fonts.medium, fontSize: 14, color: colors.textMuted, marginLeft: spacing.md },
  amountError: { fontFamily: fonts.medium, fontSize: 12, color: colors.danger, marginTop: spacing.md },
  // Card Element (web only)
  cardElementContainer: { marginBottom: spacing['3xl'] },
  cardElementLabel: { fontFamily: fonts.bold, fontSize: 16, color: colors.textPrimary, marginBottom: spacing.xl },
  cardElementWrapper: {
    backgroundColor: colors.surface, borderRadius: borderRadius.lg,
    borderWidth: 1, borderColor: colors.borderMedium,
    paddingHorizontal: spacing.xl, paddingVertical: 14,
  },
  errorBanner: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.lg,
    padding: spacing.xl, backgroundColor: colors.dangerBgLight,
    borderRadius: borderRadius.lg, marginTop: spacing.xl,
  },
  errorText: { fontFamily: fonts.medium, fontSize: 13, color: colors.danger, flex: 1 },
  processingBanner: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.lg,
    padding: spacing.xl, backgroundColor: colors.primaryLight,
    borderRadius: borderRadius.lg, marginTop: spacing.xl,
  },
  processingText: { fontFamily: fonts.medium, fontSize: 13, color: colors.primary, flex: 1 },
  payButtonContainer: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    paddingHorizontal: spacing.pagePaddingX,
    paddingBottom: spacing.bottomNavClearance + 16,
    paddingTop: spacing.xl, backgroundColor: colors.background,
  },
  payButton: {
    height: spacing.buttonHeight, backgroundColor: colors.primary,
    borderRadius: borderRadius.lg, alignItems: 'center', justifyContent: 'center',
    ...shadows.blueGlow,
  },
  payButtonDisabled: {
    backgroundColor: colors.textDisabled,
    shadowColor: undefined, shadowOffset: undefined, shadowOpacity: undefined, shadowRadius: undefined, elevation: 0,
  },
  payButtonText: { fontFamily: fonts.bold, fontSize: 16, color: colors.textOnDark },
  retryLink: { alignItems: 'center', paddingTop: spacing.lg },
  retryLinkText: { fontFamily: fonts.medium, fontSize: 14, color: colors.primary },
  successContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.pagePaddingX },
  successIconCircle: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: colors.success, alignItems: 'center', justifyContent: 'center',
    marginBottom: spacing['3xl'],
  },
  successTitle: { fontFamily: fonts.bold, fontSize: 24, color: colors.textPrimary, marginBottom: spacing.lg },
  successAmount: { fontFamily: fonts.bold, fontSize: 36, color: colors.success, letterSpacing: -0.5, marginBottom: spacing.xl },
  successSubtitle: {
    fontFamily: fonts.medium, fontSize: 14, color: colors.textMuted,
    textAlign: 'center', marginBottom: spacing['3xl'], paddingHorizontal: spacing['3xl'],
  },
  successButton: {
    height: spacing.buttonHeight, paddingHorizontal: 48,
    backgroundColor: colors.primary, borderRadius: borderRadius.lg,
    alignItems: 'center', justifyContent: 'center', ...shadows.blueGlow,
  },
  successButtonText: { fontFamily: fonts.bold, fontSize: 16, color: colors.textOnDark },
  speiDetailsCard: {
    backgroundColor: colors.surface, borderRadius: borderRadius.xl,
    borderWidth: 1, borderColor: colors.border,
    padding: spacing['3xl'], width: '100%', marginBottom: spacing['3xl'],
    ...shadows.sm,
  },
  speiRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start',
    paddingVertical: spacing.lg, borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  speiLabel: { fontFamily: fonts.medium, fontSize: 13, color: colors.textMuted, marginRight: spacing.xl },
  speiValue: { fontFamily: fonts.bold, fontSize: 14, color: colors.textPrimary, flex: 1, textAlign: 'right' },
});
