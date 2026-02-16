import React, { forwardRef } from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import QRCode from 'react-native-qrcode-svg';

// ── Design tokens (self-contained for image export) ────────────
const CARD_WIDTH = 440;
const CARD_BG = '#FFFFFF';
const DARK = '#0F172A';
const DARK_SECONDARY = '#1E293B';
const MUTED = '#64748B';
const CAPTION = '#94A3B8';
const DISABLED = '#CBD5E1';
const BORDER = '#F1F5F9';
const PRIMARY = '#2563EB';
const TEAL = '#14B8A6';
const TEAL_DARK = '#0D9488';
const TEAL_LIGHT = '#F0FDFA';

const FONT_BOLD = Platform.OS === 'ios' ? 'Satoshi-Bold' : 'Satoshi-Bold';
const FONT_MEDIUM = Platform.OS === 'ios' ? 'Satoshi-Medium' : 'Satoshi-Medium';
const FONT_BLACK = Platform.OS === 'ios' ? 'Satoshi-Black' : 'Satoshi-Black';

// ── Types ──────────────────────────────────────────────────────
interface ShareableInvitationCardProps {
  communityName: string;
  visitorName: string;
  unitNumber?: string | null;
  validFrom?: string | null;
  validUntil?: string | null;
  invitationType: string;
  visitorPhone?: string | null;
  vehiclePlate?: string | null;
  qrPayload: string;
}

function getTypeLabel(type: string): string {
  switch (type) {
    case 'recurring': return 'Recurring Access';
    case 'event': return 'Event Access';
    case 'vehicle_preauth': return 'Vehicle Pre-auth';
    default: return 'One-time Access';
  }
}

function formatCardDate(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const day = d.getDate();
    const month = months[d.getMonth()];
    const year = d.getFullYear();
    const hours = d.getHours().toString().padStart(2, '0');
    const mins = d.getMinutes().toString().padStart(2, '0');
    return `${day} ${month} ${year}, ${hours}:${mins}`;
  } catch {
    return dateStr;
  }
}

// ── Component ──────────────────────────────────────────────────
export const ShareableInvitationCard = forwardRef<View, ShareableInvitationCardProps>(
  function ShareableInvitationCard(props, ref) {
    const {
      communityName,
      visitorName,
      unitNumber,
      validFrom,
      validUntil,
      invitationType,
      vehiclePlate,
      qrPayload,
    } = props;

    const typeLabel = getTypeLabel(invitationType);

    // Build validity string
    let validityText = '';
    if (validFrom) {
      validityText = formatCardDate(validFrom);
      if (validUntil) {
        // If same day, show only time range
        const from = new Date(validFrom);
        const until = new Date(validUntil);
        if (from.toDateString() === until.toDateString()) {
          const untilHours = until.getHours().toString().padStart(2, '0');
          const untilMins = until.getMinutes().toString().padStart(2, '0');
          validityText += ` - ${untilHours}:${untilMins}`;
        } else {
          validityText += `  \u2192  ${formatCardDate(validUntil)}`;
        }
      }
    }

    return (
      <View ref={ref} style={styles.card} collapsable={false}>
        {/* ── Dark header ─────────────────────────────── */}
        <View style={styles.header}>
          {/* Decorative orbs */}
          <View style={styles.headerOrb1} />
          <View style={styles.headerOrb2} />

          <View style={styles.headerContent}>
            {/* Community branding */}
            <View style={styles.communityBadge}>
              <View style={styles.communityIcon}>
                <Text style={styles.communityIconText}>C</Text>
              </View>
              <Text style={styles.communityName}>{communityName.toUpperCase()}</Text>
            </View>

            {/* Invitation headline */}
            <Text style={styles.headline}>You're Invited</Text>
            <Text style={styles.subheadline}>
              Present this pass at the entrance gate
            </Text>
          </View>
        </View>

        {/* ── QR section ──────────────────────────────── */}
        <View style={styles.qrSection}>
          <View style={styles.qrFrame}>
            {/* Corner accents */}
            <View style={[styles.cornerAccent, styles.cornerTL]} />
            <View style={[styles.cornerAccent, styles.cornerTR]} />
            <View style={[styles.cornerAccent, styles.cornerBL]} />
            <View style={[styles.cornerAccent, styles.cornerBR]} />

            <QRCode
              value={qrPayload}
              size={280}
              color={DARK}
              backgroundColor={CARD_BG}
            />
          </View>
          <Text style={styles.scanInstruction}>SCAN AT GATE ENTRANCE</Text>
        </View>

        {/* ── Divider ─────────────────────────────────── */}
        <View style={styles.dividerRow}>
          <View style={styles.dividerNotchLeft} />
          <View style={styles.dividerLine} />
          <View style={styles.dividerNotchRight} />
        </View>

        {/* ── Visitor details ─────────────────────────── */}
        <View style={styles.detailsSection}>
          {/* Visitor name (hero) */}
          <Text style={styles.visitorName}>{visitorName}</Text>

          {/* Detail pills */}
          <View style={styles.detailsGrid}>
            {unitNumber && (
              <View style={styles.detailPill}>
                <Text style={styles.detailPillIcon}>{'🏠'}</Text>
                <View>
                  <Text style={styles.detailPillLabel}>UNIT</Text>
                  <Text style={styles.detailPillValue}>{unitNumber}</Text>
                </View>
              </View>
            )}

            <View style={styles.detailPill}>
              <Text style={styles.detailPillIcon}>{'🎫'}</Text>
              <View>
                <Text style={styles.detailPillLabel}>ACCESS TYPE</Text>
                <Text style={styles.detailPillValue}>{typeLabel}</Text>
              </View>
            </View>

            {vehiclePlate && (
              <View style={styles.detailPill}>
                <Text style={styles.detailPillIcon}>{'🚗'}</Text>
                <View>
                  <Text style={styles.detailPillLabel}>VEHICLE</Text>
                  <Text style={styles.detailPillValue}>{vehiclePlate}</Text>
                </View>
              </View>
            )}
          </View>

          {/* Validity period */}
          {validityText !== '' && (
            <View style={styles.validityBar}>
              <Text style={styles.validityIcon}>{'📅'}</Text>
              <View style={styles.validityTextGroup}>
                <Text style={styles.validityLabel}>VALID</Text>
                <Text style={styles.validityValue}>{validityText}</Text>
              </View>
            </View>
          )}
        </View>

        {/* ── Footer branding ─────────────────────────── */}
        <View style={styles.footer}>
          <View style={styles.footerLeft}>
            <View style={styles.footerDot} />
            <Text style={styles.footerText}>Verified Access Pass</Text>
          </View>
          <Text style={styles.footerBrand}>Colony</Text>
        </View>
      </View>
    );
  },
);

// ── Styles ─────────────────────────────────────────────────────
const styles = StyleSheet.create({
  card: {
    width: CARD_WIDTH,
    backgroundColor: CARD_BG,
    borderRadius: 28,
    overflow: 'hidden',
  },

  // Header
  header: {
    backgroundColor: DARK,
    paddingTop: 32,
    paddingBottom: 28,
    paddingHorizontal: 28,
    overflow: 'hidden',
  },
  headerOrb1: {
    position: 'absolute',
    top: -40,
    right: -40,
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: 'rgba(37,99,235,0.12)',
  },
  headerOrb2: {
    position: 'absolute',
    bottom: -20,
    left: -20,
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(20,184,166,0.08)',
  },
  headerContent: {
    zIndex: 1,
  },
  communityBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 16,
  },
  communityIcon: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: PRIMARY,
    alignItems: 'center',
    justifyContent: 'center',
  },
  communityIconText: {
    fontFamily: FONT_BLACK,
    fontSize: 14,
    color: '#FFFFFF',
  },
  communityName: {
    fontFamily: FONT_BOLD,
    fontSize: 11,
    color: CAPTION,
    letterSpacing: 2,
  },
  headline: {
    fontFamily: FONT_BLACK,
    fontSize: 28,
    color: '#FFFFFF',
    letterSpacing: -0.5,
  },
  subheadline: {
    fontFamily: FONT_MEDIUM,
    fontSize: 13,
    color: CAPTION,
    marginTop: 4,
  },

  // QR
  qrSection: {
    alignItems: 'center',
    paddingVertical: 28,
    paddingHorizontal: 28,
  },
  qrFrame: {
    padding: 24,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: CARD_BG,
    position: 'relative',
  },
  cornerAccent: {
    position: 'absolute',
    width: 20,
    height: 20,
    borderColor: TEAL,
  },
  cornerTL: {
    top: -1,
    left: -1,
    borderTopWidth: 3,
    borderLeftWidth: 3,
    borderTopLeftRadius: 20,
  },
  cornerTR: {
    top: -1,
    right: -1,
    borderTopWidth: 3,
    borderRightWidth: 3,
    borderTopRightRadius: 20,
  },
  cornerBL: {
    bottom: -1,
    left: -1,
    borderBottomWidth: 3,
    borderLeftWidth: 3,
    borderBottomLeftRadius: 20,
  },
  cornerBR: {
    bottom: -1,
    right: -1,
    borderBottomWidth: 3,
    borderRightWidth: 3,
    borderBottomRightRadius: 20,
  },
  scanInstruction: {
    fontFamily: FONT_BOLD,
    fontSize: 11,
    color: TEAL_DARK,
    letterSpacing: 2.5,
    marginTop: 16,
    textAlign: 'center',
  },

  // Divider (ticket-style tear)
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 0,
  },
  dividerNotchLeft: {
    width: 16,
    height: 32,
    borderTopRightRadius: 16,
    borderBottomRightRadius: 16,
    backgroundColor: BORDER,
    marginLeft: -1,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    borderStyle: 'dashed',
    borderWidth: 1,
    borderColor: DISABLED,
  },
  dividerNotchRight: {
    width: 16,
    height: 32,
    borderTopLeftRadius: 16,
    borderBottomLeftRadius: 16,
    backgroundColor: BORDER,
    marginRight: -1,
  },

  // Details
  detailsSection: {
    paddingHorizontal: 28,
    paddingTop: 20,
    paddingBottom: 24,
  },
  visitorName: {
    fontFamily: FONT_BLACK,
    fontSize: 22,
    color: DARK,
    letterSpacing: -0.5,
    marginBottom: 16,
  },
  detailsGrid: {
    gap: 12,
    marginBottom: 16,
  },
  detailPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: BORDER,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  detailPillIcon: {
    fontSize: 18,
  },
  detailPillLabel: {
    fontFamily: FONT_BOLD,
    fontSize: 9,
    color: CAPTION,
    letterSpacing: 1.5,
  },
  detailPillValue: {
    fontFamily: FONT_BOLD,
    fontSize: 14,
    color: DARK_SECONDARY,
    marginTop: 1,
  },
  validityBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: TEAL_LIGHT,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: 'rgba(20,184,166,0.15)',
  },
  validityIcon: {
    fontSize: 18,
  },
  validityTextGroup: {
    flex: 1,
  },
  validityLabel: {
    fontFamily: FONT_BOLD,
    fontSize: 9,
    color: TEAL_DARK,
    letterSpacing: 1.5,
  },
  validityValue: {
    fontFamily: FONT_BOLD,
    fontSize: 13,
    color: DARK_SECONDARY,
    marginTop: 1,
  },

  // Footer
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 28,
    paddingVertical: 16,
    backgroundColor: BORDER,
  },
  footerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  footerDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: TEAL,
  },
  footerText: {
    fontFamily: FONT_MEDIUM,
    fontSize: 11,
    color: MUTED,
  },
  footerBrand: {
    fontFamily: FONT_BLACK,
    fontSize: 14,
    color: DARK,
    letterSpacing: -0.3,
  },
});
