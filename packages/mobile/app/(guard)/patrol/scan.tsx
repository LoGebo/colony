import { useState, useCallback, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { showAlert } from '@/lib/alert';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/hooks/useAuth';
import {
  useActivePatrolLog,
  usePatrolCheckpoints,
  useScanCheckpoint,
} from '@/hooks/usePatrol';
import { AmbientBackground } from '@/components/ui/AmbientBackground';
import { colors, fonts, spacing, borderRadius, shadows } from '@/theme';

export default function PatrolScanScreen() {
  const router = useRouter();
  const { communityId, guardId } = useAuth();
  const { data: activePatrol } = useActivePatrolLog(guardId);
  const { data: allCheckpoints } = usePatrolCheckpoints(communityId);
  const scanCheckpoint = useScanCheckpoint();

  const [scanning, setScanning] = useState(false);
  const pulseAnim = useRef(new Animated.Value(1)).current;

  // Pulse animation
  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.15,
          duration: 1200,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1200,
          useNativeDriver: true,
        }),
      ]),
    );
    pulse.start();
    return () => pulse.stop();
  }, [pulseAnim]);

  const handleSimulatedScan = useCallback(async () => {
    if (!activePatrol || !allCheckpoints || allCheckpoints.length === 0) {
      if (Platform.OS === 'web') {
        window.alert('Start a patrol first before scanning checkpoints.');
      } else {
        showAlert('No Active Patrol', 'Start a patrol first before scanning checkpoints.');
      }
      return;
    }

    setScanning(true);

    try {
      // Find the next unscanned checkpoint (simulate NFC scan)
      const visitedCount = activePatrol.checkpoints_visited ?? 0;
      const nextCheckpoint = allCheckpoints[visitedCount % allCheckpoints.length];

      if (!nextCheckpoint) {
        if (Platform.OS === 'web') {
          window.alert('All checkpoints have been scanned.');
        } else {
          showAlert('All Done', 'All checkpoints have been scanned.');
        }
        setScanning(false);
        return;
      }

      await scanCheckpoint.mutateAsync({
        patrolLogId: activePatrol.id,
        checkpointId: nextCheckpoint.id,
        nfcSerialScanned: nextCheckpoint.nfc_serial ?? `SIM-${Date.now()}`,
        gpsLat: nextCheckpoint.location_lat ?? null,
        gpsLng: nextCheckpoint.location_lng ?? null,
        gpsAccuracyMeters: null,
        sequenceOrder: visitedCount + 1,
      });

      if (Platform.OS === 'web') {
        window.alert(`${nextCheckpoint.name} has been recorded.`);
        router.back();
      } else {
        showAlert(
          'Checkpoint Scanned',
          `${nextCheckpoint.name} has been recorded.`,
          [{ text: 'OK', onPress: () => router.back() }],
        );
      }
    } catch (error: any) {
      const msg = error?.message ?? 'Failed to record checkpoint scan.';
      if (Platform.OS === 'web') {
        window.alert(msg);
      } else {
        showAlert('Scan Error', msg);
      }
    } finally {
      setScanning(false);
    }
  }, [activePatrol, allCheckpoints, scanCheckpoint, router]);

  return (
    <View style={styles.container}>
      <AmbientBackground />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="chevron-back" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Scan Checkpoint</Text>
        <View style={styles.headerSpacer} />
      </View>

      {/* NFC Scan Area */}
      <View style={styles.scanArea}>
        <Animated.View
          style={[
            styles.pulseOuter,
            { transform: [{ scale: pulseAnim }] },
          ]}
        />
        <View style={styles.nfcIconBox}>
          <Ionicons name="wifi" size={56} color={colors.primary} />
        </View>
        <Text style={styles.scanInstruction}>
          Hold your device near the NFC tag
        </Text>
        <Text style={styles.scanSubInstruction}>
          Position the back of your phone against the checkpoint tag
        </Text>
      </View>

      {/* Simulated Scan Button */}
      <View style={styles.bottomSection}>
        <View style={styles.infoNote}>
          <Ionicons name="information-circle-outline" size={18} color={colors.textCaption} />
          <Text style={styles.infoNoteText}>
            NFC scanning requires a development build. Use the button below to simulate a scan.
          </Text>
        </View>

        <TouchableOpacity
          style={[styles.simulateButton, scanning && styles.simulateButtonDisabled]}
          onPress={handleSimulatedScan}
          disabled={scanning}
        >
          {scanning ? (
            <ActivityIndicator color={colors.textOnDark} />
          ) : (
            <>
              <Ionicons name="scan" size={20} color={colors.textOnDark} />
              <Text style={styles.simulateButtonText}>Simulate NFC Scan</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
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
    fontSize: 20,
    color: colors.textPrimary,
    letterSpacing: -0.5,
  },
  headerSpacer: {
    width: 40,
  },
  scanArea: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.pagePaddingX,
  },
  pulseOuter: {
    position: 'absolute',
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: colors.primaryLight,
    opacity: 0.5,
  },
  nfcIconBox: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: colors.primaryLightAlt,
    marginBottom: spacing['4xl'],
    ...shadows.lg,
  },
  scanInstruction: {
    fontFamily: fonts.bold,
    fontSize: 18,
    color: colors.textPrimary,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  scanSubInstruction: {
    fontFamily: fonts.medium,
    fontSize: 14,
    color: colors.textMuted,
    textAlign: 'center',
    paddingHorizontal: spacing['4xl'],
    lineHeight: 20,
  },
  bottomSection: {
    paddingHorizontal: spacing.pagePaddingX,
    paddingBottom: spacing.bottomNavClearance + 16,
    gap: spacing.xl,
  },
  infoNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
    padding: spacing.xl,
    backgroundColor: colors.backgroundAlt,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.borderMedium,
  },
  infoNoteText: {
    flex: 1,
    fontFamily: fonts.medium,
    fontSize: 12,
    color: colors.textCaption,
    lineHeight: 16,
  },
  simulateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.lg,
    height: spacing.buttonHeight,
    borderRadius: borderRadius.lg,
    backgroundColor: colors.teal,
    ...shadows.lg,
  },
  simulateButtonDisabled: {
    backgroundColor: colors.textDisabled,
  },
  simulateButtonText: {
    fontFamily: fonts.bold,
    fontSize: 16,
    color: colors.textOnDark,
  },
});
