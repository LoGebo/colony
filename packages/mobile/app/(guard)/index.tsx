import { useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { showAlert } from '@/lib/alert';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/hooks/useAuth';
import { useTodayAccessLogs, useExpectedVisitorsRealtime, useGuardAccessPoint } from '@/hooks/useGateOps';
import { useIncidentList } from '@/hooks/useIncidents';
import { useUnacknowledgedHandovers, useAcknowledgeHandover } from '@/hooks/useHandovers';
import { useActiveEmergencies, useTriggerEmergency } from '@/hooks/useEmergency';
import { usePendingPackages } from '@/hooks/usePackages';
import { formatTime, formatRelative } from '@/lib/dates';
import { AmbientBackground } from '@/components/ui/AmbientBackground';
import { GlassCard } from '@/components/ui/GlassCard';
import { NotificationBell } from '@/components/notifications/NotificationBell';
import { colors, fonts, spacing, borderRadius, shadows } from '@/theme';

export default function GuardDashboard() {
  const router = useRouter();
  const { user, communityId } = useAuth();
  const { data: accessPoint } = useGuardAccessPoint();
  const { data: todayLogs, refetch: refetchLogs } = useTodayAccessLogs();
  const { data: expectedVisitors, refetch: refetchVisitors } = useExpectedVisitorsRealtime();
  const { data: incidents } = useIncidentList(communityId);
  const { data: handovers, refetch: refetchHandovers } = useUnacknowledgedHandovers(communityId);
  const { data: emergencies } = useActiveEmergencies(communityId);
  const { data: pendingPackages } = usePendingPackages();
  const acknowledgeHandover = useAcknowledgeHandover();
  const triggerEmergency = useTriggerEmergency();
  const [refreshing, setRefreshing] = useState(false);
  const scrollRef = useRef<ScrollView>(null);
  const visitorsYRef = useRef(0);

  const guardName = user?.user_metadata?.first_name ?? 'Guard';
  const gateName = accessPoint?.name ?? 'Guard Station';
  const todayEntryCount = todayLogs?.length ?? 0;
  const pendingPackageCount = pendingPackages?.length ?? 0;
  const activeIncidentCount = incidents?.filter((i) => i.status !== 'closed' && i.status !== 'resolved').length ?? 0;
  const emergencyList = (emergencies ?? []) as unknown as Array<{
    id: string;
    emergency_type: string;
    status: string;
    location_description: string | null;
  }>;
  const hasEmergency = emergencyList.length > 0;
  const unacknowledgedHandover = handovers?.[0];

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([refetchLogs(), refetchVisitors(), refetchHandovers()]);
    setRefreshing(false);
  }, [refetchLogs, refetchVisitors, refetchHandovers]);

  const handlePanicPress = useCallback(() => {
    if (Platform.OS === 'web') {
      if (window.confirm('This will trigger an emergency alert for the entire community. Are you sure?')) {
        const type = window.prompt('Enter emergency type: security_threat, fire, or medical', 'security_threat');
        if (type && ['security_threat', 'fire', 'medical'].includes(type)) {
          triggerEmergency.mutate({ emergency_type: type });
        }
      }
    } else {
      showAlert(
        'Emergency Alert',
        'This will trigger an emergency alert for the entire community. Are you sure?',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'TRIGGER EMERGENCY',
            style: 'destructive',
            onPress: () => {
              showAlert(
                'Select Emergency Type',
                '',
                [
                  { text: 'Security Threat', onPress: () => triggerEmergency.mutate({ emergency_type: 'security_threat' }) },
                  { text: 'Fire', onPress: () => triggerEmergency.mutate({ emergency_type: 'fire' }) },
                  { text: 'Medical', onPress: () => triggerEmergency.mutate({ emergency_type: 'medical' }) },
                  { text: 'Cancel', style: 'cancel' },
                ],
              );
            },
          },
        ],
      );
    }
  }, [triggerEmergency]);

  const handleAcknowledge = useCallback(
    (handoverId: string) => {
      acknowledgeHandover.mutate(handoverId);
    },
    [acknowledgeHandover],
  );

  return (
    <View style={styles.container}>
      <AmbientBackground />

      <ScrollView
        ref={scrollRef}
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.headerGate}>{gateName}</Text>
            <Text style={styles.headerTitle}>Guard Dashboard</Text>
          </View>
          <View style={styles.headerRight}>
            <View style={styles.activeBadge}>
              <View style={styles.activeDot} />
              <Text style={styles.activeText}>ACTIVE</Text>
            </View>
            <View style={styles.headerButtons}>
              <NotificationBell href="/(guard)/notifications" />
              <TouchableOpacity
                style={styles.notificationButton}
                onPress={() => router.push('/(guard)/settings')}
              >
                <Ionicons name="settings-outline" size={22} color={colors.textBody} />
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* Emergency Banner */}
        {hasEmergency && emergencyList.map((emergency) => (
          <View key={emergency.id} style={styles.emergencyBanner}>
            <View style={styles.emergencyIconBox}>
              <Ionicons name="warning" size={20} color={colors.danger} />
            </View>
            <View style={styles.emergencyContent}>
              <Text style={styles.emergencyTitle}>ACTIVE EMERGENCY</Text>
              <Text style={styles.emergencyType}>
                {emergency.emergency_type.replace(/_/g, ' ').toUpperCase()}
              </Text>
              {emergency.location_description && (
                <Text style={styles.emergencyLocation}>{emergency.location_description}</Text>
              )}
            </View>
          </View>
        ))}

        {/* Unacknowledged Handover */}
        {unacknowledgedHandover && (
          <TouchableOpacity
            style={styles.handoverBanner}
            onPress={() => handleAcknowledge(unacknowledgedHandover.id)}
            activeOpacity={0.8}
          >
            <View style={styles.handoverIconBox}>
              <Ionicons name="document-text" size={20} color={colors.warningText} />
            </View>
            <View style={styles.handoverContent}>
              <Text style={styles.handoverTitle}>Shift Handover</Text>
              <Text style={styles.handoverBody} numberOfLines={2}>
                {unacknowledgedHandover.notes}
              </Text>
              <Text style={styles.handoverAction}>Tap to acknowledge</Text>
            </View>
          </TouchableOpacity>
        )}

        {/* Arrival Stats Card */}
        <GlassCard style={styles.statsCard}>
          <View style={styles.statsCardHeader}>
            <Text style={styles.statsCardTitle}>Arrival Status</Text>
            <Ionicons name="calendar-outline" size={20} color={colors.primary} />
          </View>
          <View style={styles.statsCardBody}>
            <Text style={styles.statsNumber}>{todayEntryCount}</Text>
            <View style={styles.statsSubInfo}>
              <Text style={styles.statsSubLabel}>Processed</Text>
              <Text style={styles.statsSubHighlight}>
                {expectedVisitors?.length ?? 0} EXPECTED
              </Text>
            </View>
          </View>
          <View style={styles.statsRow}>
            <GlassCard style={styles.miniStat}>
              <Ionicons name="cube-outline" size={18} color={colors.warningText} />
              <Text style={styles.miniStatValue}>{pendingPackageCount}</Text>
              <Text style={styles.miniStatLabel}>Packages</Text>
            </GlassCard>
            <GlassCard style={styles.miniStat}>
              <Ionicons name="alert-circle-outline" size={18} color={colors.danger} />
              <Text style={styles.miniStatValue}>{activeIncidentCount}</Text>
              <Text style={styles.miniStatLabel}>Incidents</Text>
            </GlassCard>
          </View>
        </GlassCard>

        {/* Scanner Action / QR Scan */}
        <TouchableOpacity
          style={styles.scannerCard}
          onPress={() => router.push('/(guard)/gate/scan')}
          activeOpacity={0.95}
        >
          <View style={styles.scannerOverlay}>
            {/* Corner brackets */}
            <View style={styles.scannerCorners}>
              <View style={[styles.corner, styles.cornerTL]} />
              <View style={[styles.corner, styles.cornerTR]} />
            </View>
            <View style={styles.scannerCenter}>
              <View style={styles.scannerIconCircle}>
                <Ionicons name="qr-code-outline" size={28} color={colors.textOnDark} />
              </View>
              <Text style={styles.scannerTitle}>Quick QR Scan</Text>
              <Text style={styles.scannerSubtitle}>Instant Visitor Verification</Text>
            </View>
            <View style={styles.scannerCorners}>
              <View style={[styles.corner, styles.cornerBL]} />
              <View style={[styles.corner, styles.cornerBR]} />
            </View>
          </View>
          {/* Scanning line */}
          <View style={styles.scanLine} />
        </TouchableOpacity>

        {/* Quick Access Grid */}
        <View style={styles.quickGrid}>
          <TouchableOpacity
            style={styles.quickGridItem}
            onPress={() => router.push('/(guard)/gate/manual-checkin')}
          >
            <GlassCard style={styles.quickGridCard}>
              <View style={[styles.quickGridIcon, { backgroundColor: colors.warningBg }]}>
                <Ionicons name="keypad-outline" size={24} color={colors.warningText} />
              </View>
              <Text style={styles.quickGridTitle}>Manual Entry</Text>
              <Text style={styles.quickGridSub}>NO CODE VISITS</Text>
            </GlassCard>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.quickGridItem}
            onPress={() => scrollRef.current?.scrollTo({ y: visitorsYRef.current, animated: true })}
          >
            <GlassCard style={styles.quickGridCard}>
              <View style={[styles.quickGridIcon, { backgroundColor: colors.primaryLight }]}>
                <Ionicons name="list-outline" size={24} color={colors.primary} />
              </View>
              <Text style={styles.quickGridTitle}>Visitor Queue</Text>
              <Text style={styles.quickGridSub}>
                {expectedVisitors?.length ?? 0} WAITING
              </Text>
            </GlassCard>
          </TouchableOpacity>
        </View>

        {/* Expected Visitors */}
        <View
          style={styles.section}
          onLayout={(e) => { visitorsYRef.current = e.nativeEvent.layout.y; }}
        >
          <Text style={styles.sectionTitle}>EXPECTED VISITORS</Text>
          {(expectedVisitors?.length ?? 0) === 0 ? (
            <GlassCard style={styles.emptyCard}>
              <Ionicons name="people-outline" size={32} color={colors.textDisabled} />
              <Text style={styles.emptyText}>No expected visitors right now</Text>
            </GlassCard>
          ) : (
            <View style={styles.visitorList}>
              {expectedVisitors?.map((visitor) => {
                const res = visitor.residents as { first_name?: string; paternal_surname?: string } | null;
                const residentName = res
                  ? `${res.first_name ?? ''} ${res.paternal_surname ?? ''}`.trim()
                  : '';
                const unitNumber = (visitor.units as { unit_number: string } | null)?.unit_number ?? '';
                return (
                  <GlassCard key={visitor.id} style={styles.visitorCard}>
                    <View style={styles.visitorAvatar}>
                      <Ionicons name="person-outline" size={20} color={colors.primary} />
                    </View>
                    <View style={styles.visitorInfo}>
                      <Text style={styles.visitorName}>{visitor.visitor_name}</Text>
                      <Text style={styles.visitorDetail}>
                        Unit {unitNumber} {residentName ? `- ${residentName}` : ''}
                      </Text>
                    </View>
                    <Text style={styles.visitorTime}>
                      {visitor.valid_from ? formatTime(visitor.valid_from) : ''}
                    </Text>
                  </GlassCard>
                );
              })}
            </View>
          )}
        </View>

        {/* Recent Activity / Security Logs */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>SECURITY LOGS</Text>
          {(todayLogs?.length ?? 0) === 0 ? (
            <GlassCard style={styles.emptyCard}>
              <Ionicons name="shield-checkmark-outline" size={32} color={colors.textDisabled} />
              <Text style={styles.emptyText}>No access logs today</Text>
            </GlassCard>
          ) : (
            <View style={styles.logList}>
              {todayLogs?.slice(0, 5).map((log) => (
                <GlassCard key={log.id} style={styles.logCard}>
                  <View style={styles.logAvatarWrap}>
                    <View style={styles.logAvatar}>
                      <Ionicons name="person" size={18} color={colors.textCaption} />
                    </View>
                    <View
                      style={[
                        styles.logBadge,
                        {
                          backgroundColor:
                            log.decision === 'allowed' ? colors.success : colors.danger,
                        },
                      ]}
                    >
                      <Ionicons
                        name={log.decision === 'allowed' ? 'checkmark' : 'close'}
                        size={10}
                        color={colors.textOnDark}
                      />
                    </View>
                  </View>
                  <View style={styles.logContent}>
                    <View style={styles.logTopRow}>
                      <Text style={styles.logName}>{log.person_name}</Text>
                      <Text style={styles.logTime}>
                        {log.logged_at ? formatTime(log.logged_at) : ''}
                      </Text>
                    </View>
                    <Text style={styles.logDetail}>
                      {log.person_type ?? 'visitor'}
                      {log.plate_number ? ` - ${log.plate_number}` : ''}
                    </Text>
                  </View>
                </GlassCard>
              ))}
            </View>
          )}
        </View>

        {/* Security Status Panel */}
        <View style={styles.securityPanel}>
          <View style={styles.securityOrb} />
          <View style={styles.securityRow}>
            <View style={styles.securityIconBox}>
              <Ionicons name="shield-checkmark" size={20} color="#60A5FA" />
            </View>
            <View>
              <Text style={styles.securityTitle}>HMAC Engine Active</Text>
              <Text style={styles.securitySub}>SYSTEM ENCRYPTED</Text>
            </View>
          </View>
          <View style={styles.securityHash}>
            <Text style={styles.securityHashText}>
              HMAC_SHA256: e3b0c44298fc1c149afbf4c8996fb924...
            </Text>
          </View>
        </View>

        {/* Panic Button */}
        <TouchableOpacity
          style={styles.panicButton}
          onPress={handlePanicPress}
          activeOpacity={0.85}
        >
          <Ionicons name="warning" size={24} color={colors.textOnDark} />
          <Text style={styles.panicText}>EMERGENCY ALERT</Text>
        </TouchableOpacity>
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
    paddingBottom: spacing.bottomNavClearance,
  },

  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing['4xl'],
  },
  headerGate: {
    fontFamily: fonts.medium,
    fontSize: 14,
    color: colors.textMuted,
    marginBottom: 2,
  },
  headerTitle: {
    fontFamily: fonts.black,
    fontSize: 24,
    color: colors.textPrimary,
    letterSpacing: -0.5,
  },
  headerRight: {
    alignItems: 'flex-end',
    gap: spacing.md,
  },
  headerButtons: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  activeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 4,
    backgroundColor: 'rgba(16,185,129,0.1)',
    borderRadius: borderRadius.full,
  },
  activeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.success,
  },
  activeText: {
    fontFamily: fonts.bold,
    fontSize: 10,
    color: colors.successText,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  notificationButton: {
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

  // Emergency Banner
  emergencyBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xl,
    padding: spacing.xl,
    backgroundColor: colors.dangerBg,
    borderWidth: 1,
    borderColor: colors.danger,
    borderRadius: borderRadius.xl,
    marginBottom: spacing.xl,
  },
  emergencyIconBox: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.md,
    backgroundColor: 'rgba(239,68,68,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emergencyContent: {
    flex: 1,
  },
  emergencyTitle: {
    fontFamily: fonts.bold,
    fontSize: 10,
    color: colors.danger,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
  },
  emergencyType: {
    fontFamily: fonts.bold,
    fontSize: 14,
    color: colors.dangerText,
    marginTop: 2,
  },
  emergencyLocation: {
    fontFamily: fonts.medium,
    fontSize: 12,
    color: colors.textBody,
    marginTop: 2,
  },

  // Handover Banner
  handoverBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xl,
    padding: spacing.xl,
    backgroundColor: colors.warningBg,
    borderWidth: 1,
    borderColor: colors.borderAmberAccent,
    borderRadius: borderRadius.xl,
    marginBottom: spacing.xl,
  },
  handoverIconBox: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.md,
    backgroundColor: 'rgba(245,158,11,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  handoverContent: {
    flex: 1,
  },
  handoverTitle: {
    fontFamily: fonts.bold,
    fontSize: 14,
    color: colors.textSecondary,
  },
  handoverBody: {
    fontFamily: fonts.medium,
    fontSize: 12,
    color: colors.textBody,
    marginTop: 2,
  },
  handoverAction: {
    fontFamily: fonts.bold,
    fontSize: 10,
    color: colors.warningText,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: spacing.md,
  },

  // Stats Card
  statsCard: {
    padding: spacing['3xl'],
    borderRadius: borderRadius['4xl'],
    marginBottom: spacing['3xl'],
  },
  statsCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  statsCardTitle: {
    fontFamily: fonts.bold,
    fontSize: 16,
    color: colors.textPrimary,
  },
  statsCardBody: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.lg,
    marginBottom: spacing['3xl'],
  },
  statsNumber: {
    fontFamily: fonts.black,
    fontSize: 48,
    color: colors.textPrimary,
    letterSpacing: -2,
    lineHeight: 52,
  },
  statsSubInfo: {
    paddingBottom: 6,
  },
  statsSubLabel: {
    fontFamily: fonts.bold,
    fontSize: 12,
    color: colors.textCaption,
  },
  statsSubHighlight: {
    fontFamily: fonts.black,
    fontSize: 12,
    color: colors.primary,
    letterSpacing: 0.5,
    marginTop: 2,
  },
  statsRow: {
    flexDirection: 'row',
    gap: spacing.lg,
  },
  miniStat: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: borderRadius.lg,
  },
  miniStatValue: {
    fontFamily: fonts.bold,
    fontSize: 16,
    color: colors.textPrimary,
  },
  miniStatLabel: {
    fontFamily: fonts.medium,
    fontSize: 11,
    color: colors.textCaption,
  },

  // Scanner Card
  scannerCard: {
    height: 224,
    backgroundColor: colors.dark,
    borderRadius: borderRadius['4xl'],
    overflow: 'hidden',
    marginBottom: spacing['3xl'],
    ...shadows.xl,
  },
  scannerOverlay: {
    flex: 1,
    padding: spacing['4xl'],
    justifyContent: 'space-between',
  },
  scannerCorners: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  corner: {
    width: 32,
    height: 32,
  },
  cornerTL: {
    borderTopWidth: 2,
    borderLeftWidth: 2,
    borderColor: 'rgba(255,255,255,0.6)',
  },
  cornerTR: {
    borderTopWidth: 2,
    borderRightWidth: 2,
    borderColor: 'rgba(255,255,255,0.6)',
  },
  cornerBL: {
    borderBottomWidth: 2,
    borderLeftWidth: 2,
    borderColor: 'rgba(255,255,255,0.6)',
  },
  cornerBR: {
    borderBottomWidth: 2,
    borderRightWidth: 2,
    borderColor: 'rgba(255,255,255,0.6)',
  },
  scannerCenter: {
    alignItems: 'center',
  },
  scannerIconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  scannerTitle: {
    fontFamily: fonts.bold,
    fontSize: 18,
    color: colors.textOnDark,
  },
  scannerSubtitle: {
    fontFamily: fonts.medium,
    fontSize: 12,
    color: 'rgba(255,255,255,0.6)',
    marginTop: 2,
  },
  scanLine: {
    position: 'absolute',
    top: '35%',
    left: 40,
    right: 40,
    height: 1,
    backgroundColor: '#60A5FA',
  },

  // Quick Grid
  quickGrid: {
    flexDirection: 'row',
    gap: spacing.xl,
    marginBottom: spacing['4xl'],
  },
  quickGridItem: {
    flex: 1,
  },
  quickGridCard: {
    alignItems: 'center',
    gap: spacing.lg,
    padding: spacing['2xl'],
    borderRadius: borderRadius['3xl'],
  },
  quickGridIcon: {
    width: 48,
    height: 48,
    borderRadius: borderRadius.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickGridTitle: {
    fontFamily: fonts.bold,
    fontSize: 14,
    color: colors.textPrimary,
  },
  quickGridSub: {
    fontFamily: fonts.medium,
    fontSize: 10,
    color: colors.textCaption,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
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
    letterSpacing: 2,
    marginBottom: spacing.xl,
  },

  // Visitors
  visitorList: {
    gap: spacing.lg,
  },
  visitorCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xl,
    padding: spacing.xl,
    borderRadius: borderRadius.xl,
  },
  visitorAvatar: {
    width: 44,
    height: 44,
    borderRadius: borderRadius.lg,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  visitorInfo: {
    flex: 1,
  },
  visitorName: {
    fontFamily: fonts.bold,
    fontSize: 14,
    color: colors.textPrimary,
  },
  visitorDetail: {
    fontFamily: fonts.medium,
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 2,
  },
  visitorTime: {
    fontFamily: fonts.bold,
    fontSize: 12,
    color: colors.textCaption,
  },

  // Logs
  logList: {
    gap: spacing.lg,
  },
  logCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xl,
    padding: spacing.xl,
    borderRadius: borderRadius.xl,
  },
  logAvatarWrap: {
    position: 'relative',
  },
  logAvatar: {
    width: 48,
    height: 48,
    borderRadius: borderRadius.lg,
    backgroundColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logBadge: {
    position: 'absolute',
    bottom: -4,
    right: -4,
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logContent: {
    flex: 1,
  },
  logTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  logName: {
    fontFamily: fonts.bold,
    fontSize: 14,
    color: colors.textPrimary,
  },
  logTime: {
    fontFamily: fonts.bold,
    fontSize: 10,
    color: colors.textCaption,
  },
  logDetail: {
    fontFamily: fonts.medium,
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 2,
    textTransform: 'capitalize',
  },

  // Empty State
  emptyCard: {
    alignItems: 'center',
    gap: spacing.lg,
    padding: spacing['4xl'],
    borderRadius: borderRadius.xl,
  },
  emptyText: {
    fontFamily: fonts.medium,
    fontSize: 14,
    color: colors.textMuted,
  },

  // Security Panel
  securityPanel: {
    padding: spacing['2xl'],
    backgroundColor: colors.darkGradientFrom,
    borderRadius: borderRadius['3xl'],
    overflow: 'hidden',
    marginBottom: spacing['3xl'],
  },
  securityOrb: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 128,
    height: 128,
    borderRadius: 64,
    backgroundColor: 'rgba(37,99,235,0.2)',
  },
  securityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xl,
    marginBottom: spacing.xl,
  },
  securityIconBox: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.lg,
    backgroundColor: 'rgba(37,99,235,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  securityTitle: {
    fontFamily: fonts.bold,
    fontSize: 14,
    color: colors.textOnDark,
  },
  securitySub: {
    fontFamily: fonts.medium,
    fontSize: 10,
    color: '#93C5FD',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginTop: 2,
  },
  securityHash: {
    backgroundColor: 'rgba(0,0,0,0.3)',
    padding: spacing.lg,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  securityHashText: {
    fontFamily: fonts.regular,
    fontSize: 9,
    color: colors.textCaption,
  },

  // Panic Button
  panicButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.lg,
    height: spacing.buttonHeight,
    backgroundColor: colors.danger,
    borderRadius: borderRadius.xl,
    marginBottom: spacing['3xl'],
    ...shadows.lg,
  },
  panicText: {
    fontFamily: fonts.bold,
    fontSize: 16,
    color: colors.textOnDark,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
});
