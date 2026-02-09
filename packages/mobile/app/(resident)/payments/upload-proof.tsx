import { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  ScrollView,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Alert,
  Image,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/hooks/useAuth';
import { useResidentUnit } from '@/hooks/useOccupancy';
import { useUploadPaymentProof } from '@/hooks/usePayments';
import { pickAndUploadImage } from '@/lib/upload';
import { AmbientBackground } from '@/components/ui/AmbientBackground';
import { colors, fonts, spacing, borderRadius, shadows } from '@/theme';

type ProofType = 'transfer' | 'deposit' | 'cash';

const PROOF_TYPES: { key: ProofType; label: string; icon: string }[] = [
  { key: 'transfer', label: 'Transfer', icon: 'swap-horizontal-outline' },
  { key: 'deposit', label: 'Deposit', icon: 'business-outline' },
  { key: 'cash', label: 'Cash', icon: 'cash-outline' },
];

export default function UploadPaymentProofScreen() {
  const router = useRouter();
  const { communityId } = useAuth();
  const { unitId } = useResidentUnit();
  const uploadMutation = useUploadPaymentProof();

  const [amount, setAmount] = useState('');
  const [paymentDate, setPaymentDate] = useState('');
  const [bankName, setBankName] = useState('');
  const [referenceNumber, setReferenceNumber] = useState('');
  const [proofType, setProofType] = useState<ProofType>('transfer');
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const canSubmit =
    amount.trim().length > 0 &&
    paymentDate.trim().length > 0 &&
    photoUrl !== null &&
    unitId !== null &&
    !uploadMutation.isPending;

  const handlePickPhoto = async () => {
    if (!communityId) return;
    setUploading(true);
    try {
      const path = await pickAndUploadImage('payment-proofs', communityId, 'receipt');
      if (path) {
        setPhotoUrl(path);
      }
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async () => {
    if (!canSubmit || !unitId) return;

    const parsedAmount = parseFloat(amount.replace(/,/g, ''));
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      Alert.alert('Invalid Amount', 'Please enter a valid amount greater than 0.');
      return;
    }

    try {
      await uploadMutation.mutateAsync({
        amount: parsedAmount,
        payment_date: paymentDate.trim(),
        reference_number: referenceNumber.trim() || undefined,
        bank_name: bankName.trim() || undefined,
        document_url: photoUrl!,
        proof_type: proofType,
        unit_id: unitId,
      });

      Alert.alert('Receipt Uploaded', 'Your payment proof has been submitted for review.', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (error: any) {
      Alert.alert('Upload Failed', error?.message ?? 'Something went wrong. Please try again.');
    }
  };

  return (
    <View style={styles.container}>
      <AmbientBackground />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="chevron-back" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Upload Receipt</Text>
        <View style={styles.headerSpacer} />
      </View>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
      >
        <ScrollView
          style={styles.flex}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Amount Input */}
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>AMOUNT</Text>
            <View style={styles.inputContainer}>
              <Text style={styles.currencyPrefix}>$</Text>
              <TextInput
                style={styles.amountInput}
                value={amount}
                onChangeText={setAmount}
                placeholder="0.00"
                placeholderTextColor={colors.textDisabled}
                keyboardType="decimal-pad"
              />
            </View>
          </View>

          {/* Payment Date */}
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>PAYMENT DATE</Text>
            <View style={styles.inputContainer}>
              <Ionicons name="calendar-outline" size={20} color={colors.textCaption} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                value={paymentDate}
                onChangeText={setPaymentDate}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={colors.textDisabled}
              />
            </View>
          </View>

          {/* Bank Name (Optional) */}
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>BANK NAME (OPTIONAL)</Text>
            <View style={styles.inputContainer}>
              <Ionicons name="business-outline" size={20} color={colors.textCaption} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                value={bankName}
                onChangeText={setBankName}
                placeholder="e.g. BBVA, Banamex"
                placeholderTextColor={colors.textDisabled}
              />
            </View>
          </View>

          {/* Reference Number (Optional) */}
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>REFERENCE NUMBER (OPTIONAL)</Text>
            <View style={styles.inputContainer}>
              <Ionicons name="document-text-outline" size={20} color={colors.textCaption} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                value={referenceNumber}
                onChangeText={setReferenceNumber}
                placeholder="e.g. TRF-9021"
                placeholderTextColor={colors.textDisabled}
              />
            </View>
          </View>

          {/* Proof Type */}
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>PAYMENT TYPE</Text>
            <View style={styles.proofTypeRow}>
              {PROOF_TYPES.map((pt) => {
                const active = proofType === pt.key;
                return (
                  <TouchableOpacity
                    key={pt.key}
                    style={[styles.proofTypePill, active && styles.proofTypePillActive]}
                    onPress={() => setProofType(pt.key)}
                  >
                    <Ionicons
                      name={pt.icon as any}
                      size={16}
                      color={active ? colors.textOnDark : colors.textMuted}
                    />
                    <Text style={[styles.proofTypeText, active && styles.proofTypeTextActive]}>
                      {pt.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* Photo Upload */}
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>RECEIPT PHOTO</Text>
            {photoUrl ? (
              <View style={styles.photoPreviewContainer}>
                <View style={styles.photoPreview}>
                  <Ionicons name="document-attach-outline" size={32} color={colors.primary} />
                  <Text style={styles.photoPreviewText}>Photo attached</Text>
                </View>
                <TouchableOpacity style={styles.photoChangeButton} onPress={handlePickPhoto}>
                  <Text style={styles.photoChangeText}>Change</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity style={styles.uploadArea} onPress={handlePickPhoto} disabled={uploading}>
                {uploading ? (
                  <ActivityIndicator color={colors.primary} />
                ) : (
                  <>
                    <View style={styles.uploadIconBox}>
                      <Ionicons name="camera-outline" size={28} color={colors.primary} />
                    </View>
                    <Text style={styles.uploadTitle}>Tap to upload</Text>
                    <Text style={styles.uploadSubtitle}>Take a photo or select from gallery</Text>
                  </>
                )}
              </TouchableOpacity>
            )}
          </View>

          {/* Submit */}
          <TouchableOpacity
            style={[styles.submitButton, !canSubmit && styles.submitButtonDisabled]}
            onPress={handleSubmit}
            disabled={!canSubmit}
          >
            {uploadMutation.isPending ? (
              <ActivityIndicator color={colors.textOnDark} />
            ) : (
              <Text style={styles.submitButtonText}>Submit Receipt</Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  flex: {
    flex: 1,
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
  // Scroll
  scrollContent: {
    paddingHorizontal: spacing.pagePaddingX,
    paddingTop: spacing.xl,
    paddingBottom: spacing.bottomNavClearance + 16,
  },
  // Fields
  fieldGroup: {
    marginBottom: spacing['3xl'],
  },
  fieldLabel: {
    fontFamily: fonts.bold,
    fontSize: 10,
    color: colors.textCaption,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    marginLeft: 4,
    marginBottom: spacing.md,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    height: spacing.inputHeight,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.borderMedium,
    paddingHorizontal: spacing.xl,
  },
  inputIcon: {
    marginRight: spacing.lg,
  },
  input: {
    flex: 1,
    fontFamily: fonts.medium,
    fontSize: 14,
    color: colors.textPrimary,
  },
  currencyPrefix: {
    fontFamily: fonts.bold,
    fontSize: 18,
    color: colors.textMuted,
    marginRight: spacing.md,
  },
  amountInput: {
    flex: 1,
    fontFamily: fonts.bold,
    fontSize: 18,
    color: colors.textPrimary,
  },
  // Proof Type
  proofTypeRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  proofTypePill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.lg,
    borderRadius: borderRadius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderMedium,
  },
  proofTypePillActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  proofTypeText: {
    fontFamily: fonts.bold,
    fontSize: 12,
    color: colors.textMuted,
  },
  proofTypeTextActive: {
    color: colors.textOnDark,
  },
  // Upload Area
  uploadArea: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing['4xl'],
    borderRadius: borderRadius.lg,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: colors.borderDashed,
    backgroundColor: colors.surface,
  },
  uploadIconBox: {
    width: 56,
    height: 56,
    borderRadius: borderRadius.full,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  uploadTitle: {
    fontFamily: fonts.bold,
    fontSize: 14,
    color: colors.textSecondary,
  },
  uploadSubtitle: {
    fontFamily: fonts.medium,
    fontSize: 12,
    color: colors.textCaption,
    marginTop: spacing.xs,
  },
  // Photo Preview
  photoPreviewContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.xl,
    backgroundColor: colors.primaryLight,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.primaryLightAlt,
  },
  photoPreview: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
  },
  photoPreviewText: {
    fontFamily: fonts.bold,
    fontSize: 14,
    color: colors.primary,
  },
  photoChangeButton: {
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.sm,
    backgroundColor: colors.primaryLightAlt,
  },
  photoChangeText: {
    fontFamily: fonts.bold,
    fontSize: 12,
    color: colors.primary,
  },
  // Submit
  submitButton: {
    height: spacing.buttonHeight,
    borderRadius: borderRadius.lg,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.lg,
    ...shadows.blueGlow,
  },
  submitButtonDisabled: {
    backgroundColor: colors.textDisabled,
    shadowOpacity: 0,
    elevation: 0,
  },
  submitButtonText: {
    fontFamily: fonts.bold,
    fontSize: 16,
    color: colors.textOnDark,
  },
});
