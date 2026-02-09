import { useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Alert,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useLogAccess } from '@/hooks/useGateOps';
import { AmbientBackground } from '@/components/ui/AmbientBackground';
import { GlassCard } from '@/components/ui/GlassCard';
import { colors, fonts, spacing, borderRadius, shadows } from '@/theme';

export default function VisitorResultScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    valid: string;
    visitor_name?: string;
    invitation_id?: string;
    qr_code_id?: string;
    community_id?: string;
    error?: string;
  }>();

  const logAccess = useLogAccess();
  const [actionTaken, setActionTaken] = useState(false);

  const isValid = params.valid === 'true';
  const visitorName = params.visitor_name ?? 'Unknown Visitor';
  const invitationId = params.invitation_id;
  const qrCodeId = params.qr_code_id;
  const errorMessage = params.error;

  const handleAllowEntry = useCallback(() => {
    logAccess.mutate(
      {
        invitation_id: invitationId,
        qr_code_id: qrCodeId,
        person_name: visitorName,
        person_type: 'visitor',
        direction: 'entry',
        method: 'qr_code',
        decision: 'allowed',
      },
      {
        onSuccess: () => {
          setActionTaken(true);
          Alert.alert('Entry Confirmed', `${visitorName} has been granted entry.`, [
            { text: 'OK', onPress: () => router.replace('/(guard)') },
          ]);
        },
        onError: (err) => {
          Alert.alert('Error', err.message);
        },
      },
    );
  }, [logAccess, invitationId, qrCodeId, visitorName, router]);

  const handleDenyEntry = useCallback(() => {
    Alert.alert('Deny Entry', `Are you sure you want to deny entry for ${visitorName}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Deny',
        style: 'destructive',
        onPress: () => {
          logAccess.mutate(
            {
              invitation_id: invitationId,
              qr_code_id: qrCodeId,
              person_name: visitorName,
              person_type: 'visitor',
              direction: 'entry',
              method: 'qr_code',
              decision: 'denied',
            },
            {
              onSuccess: () => {
                setActionTaken(true);
                Alert.alert('Entry Denied', `${visitorName} has been denied entry.`, [
                  { text: 'OK', onPress: () => router.replace('/(guard)') },
                ]);
              },
              onError: (err) => {
                Alert.alert('Error', err.message);
              },
            },
          );
        },
      },
    ]);
  }, [logAccess, invitationId, qrCodeId, visitorName, router]);

  return (
    <View style={styles.container}>
      <AmbientBackground />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Ionicons name="chevron-back" size={22} color={colors.textBody} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Access Verification</Text>
          <View style={styles.headerSpacer} />
        </View>

        {/* Status Indicator */}
        <View style={styles.statusSection}>
          <View
            style={[
              styles.statusOuterCircle,
              { backgroundColor: isValid ? colors.successBg : colors.dangerBg },
            ]}
          >
            <View
              style={[
                styles.statusInnerCircle,
                { backgroundColor: isValid ? colors.success : colors.danger },
              ]}
            >
              <Ionicons
                name={isValid ? 'checkmark' : 'close'}
                size={36}
                color={colors.textOnDark}
              />
            </View>
          </View>
          <View
            style={[
              styles.statusBadge,
              { backgroundColor: isValid ? colors.successBg : colors.dangerBg },
            ]}
          >
            <Text
              style={[
                styles.statusBadgeText,
                { color: isValid ? colors.successText : colors.dangerText },
              ]}
            >
              {isValid ? 'VERIFIED INVITATION' : 'VERIFICATION FAILED'}
            </Text>
          </View>
        </View>

        {/* Visitor Details Card */}
        {isValid ? (
          <GlassCard style={styles.detailsCard}>
            <View style={styles.visitorHeader}>
              <View style={styles.visitorAvatarBox}>
                <View style={styles.visitorAvatar}>
                  <Ionicons name="person" size={28} color={colors.textCaption} />
                </View>
                <View style={styles.visitorAvatarBadge}>
                  <Ionicons name="person" size={10} color={colors.textOnDark} />
                </View>
              </View>
              <View style={styles.visitorHeaderInfo}>
                <Text style={styles.visitorName}>{visitorName}</Text>
                <Text style={styles.visitorType}>Personal Visit</Text>
              </View>
            </View>

            <View style={styles.detailsDivider} />

            <View style={styles.detailsRows}>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>ACCESS UNIT</Text>
                <Text style={styles.detailValue}>Pending verification</Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>METHOD</Text>
                <Text style={styles.detailValue}>QR Code Scan</Text>
              </View>
              {invitationId && (
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>INVITATION</Text>
                  <Text style={styles.detailValueBlue}>
                    {invitationId.slice(0, 8)}...
                  </Text>
                </View>
              )}
            </View>
          </GlassCard>
        ) : (
          <GlassCard style={styles.detailsCard}>
            <View style={styles.errorContent}>
              <Ionicons name="alert-circle" size={32} color={colors.danger} />
              <Text style={styles.errorTitle}>Verification Failed</Text>
              <Text style={styles.errorMessage}>
                {errorMessage ?? 'The QR code could not be verified. It may be expired, invalid, or already used.'}
              </Text>
            </View>
          </GlassCard>
        )}

        {/* Security Signature */}
        <View style={styles.signaturePanel}>
          <View style={styles.signatureHeader}>
            <Ionicons name="shield-checkmark" size={18} color={colors.primary} />
            <Text style={styles.signatureLabel}>SECURITY TOKEN (HMAC)</Text>
          </View>
          <View style={styles.signatureCode}>
            <Text style={styles.signatureText}>
              sha256-{isValid ? '43d9a1f2e3089475c8d203948e2830f8123...4d201' : '0000000000000000000000000000000000000000'}
            </Text>
          </View>
        </View>

        {/* Action Buttons */}
        {!actionTaken && (
          <View style={styles.actionButtons}>
            {isValid ? (
              <>
                <TouchableOpacity
                  style={styles.confirmButton}
                  onPress={handleAllowEntry}
                  disabled={logAccess.isPending}
                  activeOpacity={0.85}
                >
                  <Ionicons name="log-in-outline" size={22} color={colors.textOnDark} />
                  <Text style={styles.confirmButtonText}>Confirm Entry</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.cancelButton}
                  onPress={handleDenyEntry}
                  disabled={logAccess.isPending}
                  activeOpacity={0.85}
                >
                  <Text style={styles.cancelButtonText}>Deny Access</Text>
                </TouchableOpacity>
              </>
            ) : (
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => router.back()}
                activeOpacity={0.85}
              >
                <Text style={styles.cancelButtonText}>Try Again</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollView: {
    flex: 1,
    zIndex: 10,
  },
  scrollContent: {
    paddingTop: spacing.safeAreaTop,
    paddingHorizontal: spacing.pagePaddingX,
    paddingBottom: spacing.safeAreaBottom + spacing['3xl'],
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing['4xl'],
  },
  backButton: {
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
  headerTitle: {
    fontFamily: fonts.bold,
    fontSize: 18,
    color: colors.textPrimary,
    letterSpacing: -0.3,
  },
  headerSpacer: {
    width: 40,
  },

  // Status Indicator
  statusSection: {
    alignItems: 'center',
    marginBottom: spacing['4xl'],
  },
  statusOuterCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xl,
  },
  statusInnerCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.lg,
  },
  statusBadge: {
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
  },
  statusBadgeText: {
    fontFamily: fonts.bold,
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
  },

  // Details Card
  detailsCard: {
    padding: spacing['3xl'],
    borderRadius: borderRadius['4xl'],
    marginBottom: spacing['3xl'],
    ...shadows.xl,
  },
  visitorHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xl,
    marginBottom: spacing['3xl'],
  },
  visitorAvatarBox: {
    position: 'relative',
  },
  visitorAvatar: {
    width: 64,
    height: 64,
    borderRadius: borderRadius.xl,
    backgroundColor: colors.border,
    borderWidth: 2,
    borderColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.md,
  },
  visitorAvatarBadge: {
    position: 'absolute',
    bottom: -4,
    right: -4,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.primary,
    borderWidth: 2,
    borderColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  visitorHeaderInfo: {
    flex: 1,
  },
  visitorName: {
    fontFamily: fonts.bold,
    fontSize: 20,
    color: colors.textPrimary,
  },
  visitorType: {
    fontFamily: fonts.medium,
    fontSize: 14,
    color: colors.textMuted,
    marginTop: 2,
  },
  detailsDivider: {
    height: 1,
    backgroundColor: colors.border,
    marginBottom: spacing.xl,
  },
  detailsRows: {
    gap: spacing.xl,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  detailLabel: {
    fontFamily: fonts.bold,
    fontSize: 10,
    color: colors.textCaption,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
  },
  detailValue: {
    fontFamily: fonts.bold,
    fontSize: 14,
    color: colors.textPrimary,
  },
  detailValueBlue: {
    fontFamily: fonts.bold,
    fontSize: 14,
    color: colors.primary,
  },

  // Error content
  errorContent: {
    alignItems: 'center',
    gap: spacing.lg,
    paddingVertical: spacing['3xl'],
  },
  errorTitle: {
    fontFamily: fonts.bold,
    fontSize: 18,
    color: colors.textPrimary,
  },
  errorMessage: {
    fontFamily: fonts.medium,
    fontSize: 14,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 20,
  },

  // Signature Panel
  signaturePanel: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.xl,
    padding: spacing.xl,
    marginBottom: spacing['4xl'],
  },
  signatureHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
    marginBottom: spacing.lg,
  },
  signatureLabel: {
    fontFamily: fonts.black,
    fontSize: 10,
    color: colors.textCaption,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
  },
  signatureCode: {
    backgroundColor: colors.background,
    padding: spacing.lg,
    borderRadius: borderRadius.md,
  },
  signatureText: {
    fontFamily: fonts.regular,
    fontSize: 10,
    color: colors.textCaption,
    lineHeight: 16,
  },

  // Action Buttons
  actionButtons: {
    gap: spacing.lg,
    paddingBottom: spacing['3xl'],
  },
  confirmButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.lg,
    height: spacing.buttonHeight,
    backgroundColor: colors.dark,
    borderRadius: borderRadius.xl,
    ...shadows.xl,
  },
  confirmButtonText: {
    fontFamily: fonts.bold,
    fontSize: 18,
    color: colors.textOnDark,
  },
  cancelButton: {
    alignItems: 'center',
    justifyContent: 'center',
    height: spacing.buttonHeight,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderMedium,
    borderRadius: borderRadius.xl,
  },
  cancelButtonText: {
    fontFamily: fonts.bold,
    fontSize: 18,
    color: colors.textBody,
  },
});
