import { useCallback, useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Share,
  Platform,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import QRCode from 'react-native-qrcode-svg';
import { captureRef } from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';
import { useInvitationDetail, useCancelInvitation } from '@/hooks/useVisitors';
import { useAuth } from '@/hooks/useAuth';
import { useCommunityBranding } from '@/hooks/useCommunity';
import { formatDate, formatTime, isExpired, DAY_LABELS } from '@/lib/dates';
import { AmbientBackground } from '@/components/ui/AmbientBackground';
import { ShareableInvitationCard } from '@/components/visitors/ShareableInvitationCard';
import { colors, fonts, spacing, borderRadius, shadows } from '@/theme';

function getStatusBadge(invitation: {
  status: string;
  cancelled_at: string | null;
  valid_until: string | null;
  times_used?: number | null;
  max_uses?: number | null;
}) {
  if (invitation.cancelled_at) {
    return { label: 'CANCELLED', bg: colors.dangerBg, color: colors.dangerText };
  }
  if (invitation.times_used && invitation.max_uses && invitation.times_used >= invitation.max_uses) {
    return { label: 'USED', bg: colors.successBg, color: colors.successText };
  }
  if (invitation.status === 'approved' && invitation.valid_until && isExpired(invitation.valid_until)) {
    return { label: 'EXPIRED', bg: 'rgba(226,232,240,0.5)', color: colors.textMuted };
  }
  if (invitation.status === 'approved') {
    return { label: 'ACTIVE', bg: colors.successBg, color: colors.successText };
  }
  if (invitation.status === 'pending') {
    return { label: 'PENDING', bg: colors.warningBg, color: colors.warningText };
  }
  if (invitation.status === 'cancelled') {
    return { label: 'CANCELLED', bg: colors.dangerBg, color: colors.dangerText };
  }
  return { label: invitation.status?.toUpperCase() ?? 'UNKNOWN', bg: colors.border, color: colors.textCaption };
}

function getTypeConfig(type: string) {
  switch (type) {
    case 'recurring':
      return { label: 'Recurring Access', icon: 'repeat-outline' as const, bg: colors.tealLight, color: colors.tealDark };
    case 'event':
      return { label: 'Event Access', icon: 'sparkles-outline' as const, bg: colors.warningBgLight, color: colors.warningText };
    case 'vehicle_preauth':
      return { label: 'Vehicle Pre-auth', icon: 'car-outline' as const, bg: colors.indigoBg, color: colors.indigo };
    default:
      return { label: 'One-time Access', icon: 'person-outline' as const, bg: colors.primaryLight, color: colors.primary };
  }
}

export default function InvitationDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { communityId } = useAuth();
  const { data: branding } = useCommunityBranding(communityId);
  const { data: invitation, isLoading } = useInvitationDetail(id ?? '');
  const cancelMutation = useCancelInvitation();
  const qrRef = useRef<any>(null);
  const cardRef = useRef<View>(null);
  const [isSharing, setIsSharing] = useState(false);

  const communityName = branding?.name ?? 'Community';

  const qrPayload = (() => {
    if (!invitation) return null;
    const codes = invitation.qr_codes as unknown as { id: string; payload: string; status: string }[] | null;
    if (codes && codes.length > 0) {
      return codes[0].payload;
    }
    return null;
  })();

  const unitNumber = (invitation?.units as { unit_number: string } | null)?.unit_number ?? null;

  // ── Share premium invitation card ──────────────────────────
  const handleShare = useCallback(async () => {
    if (!invitation || !qrPayload || !cardRef.current) return;
    setIsSharing(true);

    try {
      const uri = await captureRef(cardRef, {
        format: 'png',
        quality: 1,
        pixelRatio: 3,
        result: 'tmpfile',
      });

      if (Platform.OS === 'web') {
        // Web: download the image
        const link = document.createElement('a');
        link.href = uri;
        link.download = `invitation-${invitation.visitor_name.replace(/\s+/g, '-')}.png`;
        link.click();
      } else {
        // Mobile: share via native sheet
        const isAvailable = await Sharing.isAvailableAsync();
        if (isAvailable) {
          await Sharing.shareAsync(uri, {
            mimeType: 'image/png',
            dialogTitle: 'Share Invitation',
            UTI: 'public.png',
          });
        } else {
          // Fallback to Share API with text
          await Share.share({
            message: `You're invited! ${invitation.visitor_name}, show this pass at the entrance of ${communityName}.`,
            title: 'Visitor Invitation',
          });
        }
      }
    } catch {
      // Fallback: try QR-only export via SVG ref
      if (qrRef.current) {
        qrRef.current.toDataURL((dataURL: string) => {
          Share.share({
            message: `You're invited to ${communityName}! Visitor: ${invitation.visitor_name}. Show this QR at the gate.`,
            title: 'Visitor Invitation',
            ...(Platform.OS === 'ios' ? { url: `data:image/png;base64,${dataURL}` } : {}),
          });
        });
      }
    } finally {
      setIsSharing(false);
    }
  }, [invitation, qrPayload, communityName]);

  const handleCancel = useCallback(() => {
    if (!invitation) return;
    Alert.alert(
      'Cancel Invitation',
      `Are you sure you want to cancel the invitation for ${invitation.visitor_name}?`,
      [
        { text: 'No', style: 'cancel' },
        {
          text: 'Yes, Cancel',
          style: 'destructive',
          onPress: async () => {
            try {
              await cancelMutation.mutateAsync(invitation.id);
              Alert.alert('Cancelled', 'Invitation has been cancelled.', [
                { text: 'OK', onPress: () => router.back() },
              ]);
            } catch (err: unknown) {
              const message = err instanceof Error ? err.message : 'Failed to cancel invitation.';
              Alert.alert('Error', message);
            }
          },
        },
      ]
    );
  }, [invitation, cancelMutation, router]);

  if (isLoading || !invitation) {
    return (
      <View style={styles.container}>
        <AmbientBackground />
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Ionicons name="chevron-back" size={20} color={colors.textBody} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Invitation Details</Text>
          <View style={styles.headerSpacer} />
        </View>
        <View style={styles.centerMessage}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </View>
    );
  }

  const badge = getStatusBadge(invitation);
  const typeConfig = getTypeConfig(invitation.invitation_type);
  const isCancelled = !!invitation.cancelled_at;
  const isActive = badge.label === 'ACTIVE' || badge.label === 'PENDING';
  const recurringDays = Array.isArray(invitation.recurring_days) ? invitation.recurring_days : [];

  return (
    <View style={styles.container}>
      <AmbientBackground />

      {/* ── Hidden shareable card (rendered off-screen for capture) ── */}
      {qrPayload && (
        <View style={styles.offscreenContainer} pointerEvents="none">
          <ShareableInvitationCard
            ref={cardRef}
            communityName={communityName}
            visitorName={invitation.visitor_name}
            unitNumber={unitNumber}
            validFrom={invitation.valid_from}
            validUntil={invitation.valid_until}
            invitationType={invitation.invitation_type}
            visitorPhone={invitation.visitor_phone}
            vehiclePlate={invitation.vehicle_plate}
            qrPayload={qrPayload}
          />
        </View>
      )}

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={20} color={colors.textBody} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Invitation Details</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        style={styles.flex}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* QR Code Section */}
        <View style={styles.qrSection}>
          <View style={styles.qrHeaderRow}>
            <View style={styles.qrHeaderLeft}>
              <Ionicons name="shield-checkmark" size={24} color={colors.teal} />
              <Text style={styles.qrBrand}>Secure LuminaPass</Text>
            </View>
            <View style={[styles.qrStatusDot, !isActive && styles.qrStatusDotInactive]} />
          </View>

          <View style={styles.qrCodeWrapper}>
            {qrPayload ? (
              <QRCode
                value={qrPayload}
                size={200}
                color={colors.dark}
                backgroundColor={colors.surface}
                getRef={(ref: any) => (qrRef.current = ref)}
              />
            ) : (
              <View style={styles.qrFallback}>
                <Ionicons name="qr-code-outline" size={80} color="rgba(15,23,42,0.15)" />
                <Text style={styles.qrFallbackText}>QR code unavailable</Text>
              </View>
            )}
          </View>

          {qrPayload && (
            <View style={styles.hmacRow}>
              <Text style={styles.hmacLabel}>Security Signature (HMAC)</Text>
              <View style={styles.hmacCodeBox}>
                <Text style={styles.hmacCode} numberOfLines={1}>
                  sha256:{qrPayload.slice(0, 40)}...
                </Text>
              </View>
            </View>
          )}
        </View>

        {/* Visitor Info Card */}
        <View style={styles.infoCard}>
          {/* Name + Status */}
          <View style={styles.infoHeader}>
            <View style={styles.infoHeaderLeft}>
              <View style={[styles.typeIcon, { backgroundColor: typeConfig.bg }]}>
                <Ionicons name={typeConfig.icon as any} size={24} color={typeConfig.color} />
              </View>
              <View style={styles.infoNameGroup}>
                <Text style={styles.infoName}>{invitation.visitor_name}</Text>
                <Text style={styles.infoType}>{typeConfig.label}</Text>
              </View>
            </View>
            <View style={[styles.statusBadge, { backgroundColor: badge.bg }]}>
              <Text style={[styles.statusBadgeText, { color: badge.color }]}>{badge.label}</Text>
            </View>
          </View>

          {/* Details rows */}
          <View style={styles.detailsGrid}>
            {unitNumber && (
              <View style={styles.detailRow}>
                <View style={styles.detailIconBox}>
                  <Ionicons name="home-outline" size={16} color={colors.textCaption} />
                </View>
                <View>
                  <Text style={styles.detailLabel}>Unit</Text>
                  <Text style={styles.detailValue}>{unitNumber}</Text>
                </View>
              </View>
            )}

            {invitation.visitor_phone && (
              <View style={styles.detailRow}>
                <View style={styles.detailIconBox}>
                  <Ionicons name="call-outline" size={16} color={colors.textCaption} />
                </View>
                <View>
                  <Text style={styles.detailLabel}>Phone</Text>
                  <Text style={styles.detailValue}>{invitation.visitor_phone}</Text>
                </View>
              </View>
            )}

            {invitation.valid_from && (
              <View style={styles.detailRow}>
                <View style={styles.detailIconBox}>
                  <Ionicons name="calendar-outline" size={16} color={colors.textCaption} />
                </View>
                <View>
                  <Text style={styles.detailLabel}>Valid From</Text>
                  <Text style={styles.detailValue}>{formatDate(invitation.valid_from)}</Text>
                </View>
              </View>
            )}

            {invitation.valid_until && (
              <View style={styles.detailRow}>
                <View style={styles.detailIconBox}>
                  <Ionicons name="time-outline" size={16} color={colors.textCaption} />
                </View>
                <View>
                  <Text style={styles.detailLabel}>Valid Until</Text>
                  <Text style={styles.detailValue}>{formatDate(invitation.valid_until)}</Text>
                </View>
              </View>
            )}

            {invitation.vehicle_plate && (
              <View style={styles.detailRow}>
                <View style={styles.detailIconBox}>
                  <Ionicons name="car-outline" size={16} color={colors.textCaption} />
                </View>
                <View>
                  <Text style={styles.detailLabel}>Vehicle Plate</Text>
                  <Text style={styles.detailValue}>{invitation.vehicle_plate}</Text>
                </View>
              </View>
            )}
          </View>

          {/* Recurring days */}
          {invitation.invitation_type === 'recurring' && recurringDays.length > 0 && (
            <View style={styles.recurringSection}>
              <Text style={styles.recurringSectionLabel}>Recurring Schedule</Text>
              <View style={styles.recurringDaysRow}>
                {recurringDays.map((day: number) => (
                  <View key={day} style={styles.dayPill}>
                    <Text style={styles.dayPillText}>{(DAY_LABELS[day] ?? '').slice(0, 3)}</Text>
                  </View>
                ))}
              </View>
              {invitation.recurring_start_time && (
                <View style={styles.recurringTimeRow}>
                  <Ionicons name="time-outline" size={14} color={colors.textCaption} />
                  <Text style={styles.recurringTimeText}>
                    {formatTime(invitation.recurring_start_time)}
                    {invitation.recurring_end_time ? ` - ${formatTime(invitation.recurring_end_time)}` : ''}
                  </Text>
                </View>
              )}
            </View>
          )}
        </View>

        {/* Actions */}
        <View style={styles.actionsContainer}>
          {/* Share Invitation Card */}
          <TouchableOpacity
            style={styles.shareButton}
            onPress={handleShare}
            activeOpacity={0.9}
            disabled={isSharing}
          >
            {isSharing ? (
              <ActivityIndicator size="small" color={colors.textOnDark} />
            ) : (
              <>
                <Ionicons name="share-outline" size={20} color={colors.textOnDark} />
                <Text style={styles.shareButtonText}>Share Invitation</Text>
              </>
            )}
          </TouchableOpacity>

          {/* Cancel */}
          {isActive && (
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={handleCancel}
              disabled={cancelMutation.isPending}
              activeOpacity={0.9}
            >
              {cancelMutation.isPending ? (
                <ActivityIndicator size="small" color={colors.danger} />
              ) : (
                <>
                  <Ionicons name="close-circle-outline" size={20} color={colors.danger} />
                  <Text style={styles.cancelButtonText}>Cancel Invitation</Text>
                </>
              )}
            </TouchableOpacity>
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
  flex: {
    flex: 1,
  },

  // Off-screen container for shareable card capture
  offscreenContainer: {
    position: 'absolute',
    top: -9999,
    left: -9999,
    opacity: 1, // Must be visible for capture
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: spacing.safeAreaTop,
    paddingHorizontal: spacing.pagePaddingX,
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
  },
  headerSpacer: {
    width: 40,
  },
  // Scroll
  scrollContent: {
    paddingHorizontal: spacing.pagePaddingX,
    paddingBottom: spacing.bottomNavClearance + 40,
    gap: spacing['3xl'],
  },
  // QR Section
  qrSection: {
    backgroundColor: colors.dark,
    borderRadius: borderRadius['4xl'],
    padding: spacing['3xl'],
    ...shadows.darkGlow,
  },
  qrHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing['3xl'],
  },
  qrHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
  },
  qrBrand: {
    fontFamily: fonts.bold,
    fontSize: 14,
    color: colors.textOnDark,
    letterSpacing: -0.3,
  },
  qrStatusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.teal,
  },
  qrStatusDotInactive: {
    backgroundColor: colors.textCaption,
  },
  qrCodeWrapper: {
    alignItems: 'center',
    paddingVertical: spacing['3xl'],
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    marginBottom: spacing.xl,
  },
  qrFallback: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
  },
  qrFallbackText: {
    fontFamily: fonts.medium,
    fontSize: 12,
    color: colors.textCaption,
    marginTop: spacing.md,
  },
  hmacRow: {
    gap: spacing.xs,
  },
  hmacLabel: {
    fontFamily: fonts.bold,
    fontSize: 10,
    color: colors.textCaption,
    textTransform: 'uppercase',
    letterSpacing: 2,
  },
  hmacCodeBox: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: borderRadius.sm,
    padding: spacing.md,
  },
  hmacCode: {
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontSize: 11,
    color: 'rgba(204,251,241,0.6)',
  },
  // Info Card
  infoCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius['2xl'],
    padding: spacing.cardPadding,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.sm,
  },
  infoHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.xl,
  },
  infoHeaderLeft: {
    flexDirection: 'row',
    gap: spacing.xl,
    flex: 1,
  },
  typeIcon: {
    width: 48,
    height: 48,
    borderRadius: borderRadius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoNameGroup: {
    flex: 1,
  },
  infoName: {
    fontFamily: fonts.bold,
    fontSize: 18,
    color: colors.textPrimary,
  },
  infoType: {
    fontFamily: fonts.medium,
    fontSize: 13,
    color: colors.textMuted,
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: borderRadius.sm,
  },
  statusBadgeText: {
    fontFamily: fonts.bold,
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  // Details
  detailsGrid: {
    gap: spacing.xl,
    paddingTop: spacing.xl,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
  },
  detailIconBox: {
    width: 32,
    height: 32,
    borderRadius: borderRadius.sm,
    backgroundColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  detailLabel: {
    fontFamily: fonts.bold,
    fontSize: 10,
    color: colors.textCaption,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  detailValue: {
    fontFamily: fonts.medium,
    fontSize: 14,
    color: colors.textPrimary,
    marginTop: 1,
  },
  // Recurring
  recurringSection: {
    marginTop: spacing.xl,
    paddingTop: spacing.xl,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    gap: spacing.lg,
  },
  recurringSectionLabel: {
    fontFamily: fonts.bold,
    fontSize: 11,
    color: colors.textCaption,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  recurringDaysRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  dayPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    backgroundColor: colors.surface,
    borderRadius: spacing.sm,
    borderWidth: 1,
    borderColor: colors.borderMedium,
  },
  dayPillText: {
    fontFamily: fonts.bold,
    fontSize: 10,
    color: colors.textBody,
  },
  recurringTimeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  recurringTimeText: {
    fontFamily: fonts.bold,
    fontSize: 13,
    color: colors.textSecondary,
  },
  // Actions
  actionsContainer: {
    gap: spacing.lg,
  },
  shareButton: {
    height: spacing.buttonHeight,
    backgroundColor: colors.dark,
    borderRadius: borderRadius.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    ...shadows.darkGlow,
  },
  shareButtonText: {
    fontFamily: fonts.bold,
    fontSize: 16,
    color: colors.textOnDark,
  },
  cancelButton: {
    height: spacing.smallButtonHeight,
    backgroundColor: colors.dangerBgLight,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.dangerBg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
  },
  cancelButtonText: {
    fontFamily: fonts.bold,
    fontSize: 14,
    color: colors.danger,
  },
  // Loading
  centerMessage: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
