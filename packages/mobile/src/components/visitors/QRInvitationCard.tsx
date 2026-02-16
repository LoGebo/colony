import React, { forwardRef } from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import QRCode from 'react-native-qrcode-svg';
import { colors, fonts, spacing, borderRadius } from '@/theme';
import { formatDate } from '@/lib/dates';

// ── Types ──────────────────────────────────────────────────────
interface QRInvitationCardProps {
  qrPayload: string;
  visitorName: string;
  communityName: string;
  invitationType: string;
  validFrom?: string | null;
  validUntil?: string | null;
  unitNumber?: string | null;
  vehiclePlate?: string | null;
}

// ── Helpers ────────────────────────────────────────────────────
function getTypeLabel(type: string): { label: string; icon: keyof typeof Ionicons.glyphMap } {
  switch (type) {
    case 'recurring':
      return { label: 'Recurring Access', icon: 'repeat-outline' };
    case 'event':
      return { label: 'Event Access', icon: 'sparkles-outline' };
    case 'vehicle_preauth':
      return { label: 'Vehicle Pre-auth', icon: 'car-outline' };
    default:
      return { label: 'One-time Access', icon: 'person-outline' };
  }
}

// ── Component ──────────────────────────────────────────────────
// Using forwardRef so ViewShot can attach to this view
const QRInvitationCard = forwardRef<View, QRInvitationCardProps>(
  (
    {
      qrPayload,
      visitorName,
      communityName,
      invitationType,
      validFrom,
      validUntil,
      unitNumber,
      vehiclePlate,
    },
    ref,
  ) => {
    const typeInfo = getTypeLabel(invitationType);

    return (
      <View ref={ref} style={styles.card} collapsable={false}>
        {/* ── Top: Dark gradient header ────────────────── */}
        <LinearGradient
          colors={['#0F172A', '#1E293B']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.headerGradient}
        >
          {/* Decorative orbs */}
          <View style={styles.orbTopRight} />
          <View style={styles.orbBottomLeft} />

          {/* Community branding */}
          <View style={styles.headerContent}>
            <View style={styles.brandRow}>
              <LinearGradient
                colors={[colors.gradientStart, colors.gradientEnd]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.brandIcon}
              >
                <Ionicons name="business-outline" size={16} color="#FFFFFF" />
              </LinearGradient>
              <Text style={styles.communityName}>{communityName.toUpperCase()}</Text>
            </View>

            <View style={styles.dividerRow}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerLabel}>VISITOR PASS</Text>
              <View style={styles.dividerLine} />
            </View>
          </View>
        </LinearGradient>

        {/* ── Tear line (notch effect) ─────────────────── */}
        <View style={styles.tearLine}>
          <View style={styles.tearNotchLeft} />
          <View style={styles.tearDashes}>
            {Array.from({ length: 20 }).map((_, i) => (
              <View key={i} style={styles.tearDash} />
            ))}
          </View>
          <View style={styles.tearNotchRight} />
        </View>

        {/* ── Middle: QR code ──────────────────────────── */}
        <View style={styles.qrSection}>
          <View style={styles.qrContainer}>
            <QRCode
              value={qrPayload}
              size={180}
              color="#0F172A"
              backgroundColor="#FFFFFF"
            />
          </View>
          <Text style={styles.scanInstruction}>SCAN AT GATE</Text>
        </View>

        {/* ── Bottom: Visitor details ──────────────────── */}
        <View style={styles.detailsSection}>
          {/* Visitor name (large) */}
          <View style={styles.nameBlock}>
            <Text style={styles.visitorNameLabel}>GUEST</Text>
            <Text style={styles.visitorName} numberOfLines={2}>
              {visitorName}
            </Text>
          </View>

          {/* Detail chips row */}
          <View style={styles.detailsGrid}>
            {/* Access Type */}
            <View style={styles.detailChip}>
              <Ionicons name={typeInfo.icon} size={14} color={colors.primary} />
              <Text style={styles.detailChipText}>{typeInfo.label}</Text>
            </View>

            {/* Unit */}
            {unitNumber && (
              <View style={styles.detailChip}>
                <Ionicons name="home-outline" size={14} color={colors.tealDark} />
                <Text style={styles.detailChipText}>Unit {unitNumber}</Text>
              </View>
            )}

            {/* Vehicle */}
            {vehiclePlate && (
              <View style={styles.detailChip}>
                <Ionicons name="car-outline" size={14} color={colors.indigo} />
                <Text style={styles.detailChipText}>{vehiclePlate}</Text>
              </View>
            )}
          </View>

          {/* Dates row */}
          <View style={styles.datesRow}>
            {validFrom && (
              <View style={styles.dateBlock}>
                <Text style={styles.dateLabel}>VALID FROM</Text>
                <Text style={styles.dateValue}>{formatDate(validFrom)}</Text>
              </View>
            )}
            {validUntil && (
              <View style={styles.dateBlock}>
                <Text style={styles.dateLabel}>VALID UNTIL</Text>
                <Text style={styles.dateValue}>{formatDate(validUntil)}</Text>
              </View>
            )}
          </View>

          {/* Footer branding */}
          <View style={styles.footerBrand}>
            <Ionicons name="shield-checkmark" size={14} color={colors.teal} />
            <Text style={styles.footerBrandText}>Secured by Colony</Text>
          </View>
        </View>
      </View>
    );
  },
);

QRInvitationCard.displayName = 'QRInvitationCard';
export { QRInvitationCard };

// ── Styles ─────────────────────────────────────────────────────
const CARD_WIDTH = 340;

const styles = StyleSheet.create({
  card: {
    width: CARD_WIDTH,
    backgroundColor: '#FFFFFF',
    borderRadius: 28,
    overflow: 'hidden',
    // Shadow for when rendered on-screen (won't show in capture)
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 20 }, shadowOpacity: 0.15, shadowRadius: 30 },
      android: { elevation: 10 },
    }),
  },

  // ── Header ──
  headerGradient: {
    paddingTop: 32,
    paddingBottom: 28,
    paddingHorizontal: 28,
    overflow: 'hidden',
  },
  orbTopRight: {
    position: 'absolute',
    top: -30,
    right: -30,
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(37,99,235,0.12)',
  },
  orbBottomLeft: {
    position: 'absolute',
    bottom: -20,
    left: -20,
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(45,212,191,0.08)',
  },
  headerContent: {
    zIndex: 1,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 16,
  },
  brandIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  communityName: {
    fontFamily: fonts.bold,
    fontSize: 13,
    color: 'rgba(255,255,255,0.85)',
    letterSpacing: 2.5,
    flex: 1,
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  dividerLabel: {
    fontFamily: fonts.black,
    fontSize: 11,
    color: 'rgba(255,255,255,0.5)',
    letterSpacing: 3,
  },

  // ── Tear line ──
  tearLine: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    marginTop: -1,
  },
  tearNotchLeft: {
    width: 16,
    height: 32,
    borderTopRightRadius: 16,
    borderBottomRightRadius: 16,
    backgroundColor: colors.background,
    marginLeft: -1,
  },
  tearDashes: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 5,
    paddingHorizontal: 4,
  },
  tearDash: {
    width: 8,
    height: 1.5,
    backgroundColor: '#E2E8F0',
    borderRadius: 1,
  },
  tearNotchRight: {
    width: 16,
    height: 32,
    borderTopLeftRadius: 16,
    borderBottomLeftRadius: 16,
    backgroundColor: colors.background,
    marginRight: -1,
  },

  // ── QR Section ──
  qrSection: {
    alignItems: 'center',
    paddingTop: 24,
    paddingBottom: 20,
    backgroundColor: '#FFFFFF',
  },
  qrContainer: {
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  scanInstruction: {
    fontFamily: fonts.black,
    fontSize: 10,
    color: '#94A3B8',
    letterSpacing: 4,
    marginTop: 14,
  },

  // ── Details Section ──
  detailsSection: {
    paddingHorizontal: 28,
    paddingBottom: 28,
    backgroundColor: '#FFFFFF',
  },
  nameBlock: {
    marginBottom: 16,
  },
  visitorNameLabel: {
    fontFamily: fonts.bold,
    fontSize: 10,
    color: '#94A3B8',
    letterSpacing: 2,
    marginBottom: 4,
  },
  visitorName: {
    fontFamily: fonts.bold,
    fontSize: 24,
    color: '#0F172A',
    letterSpacing: -0.5,
    lineHeight: 30,
  },

  // Detail chips
  detailsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  detailChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  detailChipText: {
    fontFamily: fonts.bold,
    fontSize: 11,
    color: '#475569',
  },

  // Dates
  datesRow: {
    flexDirection: 'row',
    gap: 20,
    marginBottom: 20,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  dateBlock: {
    flex: 1,
  },
  dateLabel: {
    fontFamily: fonts.bold,
    fontSize: 9,
    color: '#94A3B8',
    letterSpacing: 1.5,
    marginBottom: 4,
  },
  dateValue: {
    fontFamily: fonts.bold,
    fontSize: 14,
    color: '#1E293B',
  },

  // Footer
  footerBrand: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  footerBrandText: {
    fontFamily: fonts.bold,
    fontSize: 11,
    color: '#94A3B8',
    letterSpacing: 0.5,
  },
});
