import { useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useVerifyQR } from '@/hooks/useGateOps';
import { AmbientBackground } from '@/components/ui/AmbientBackground';
import { colors, fonts, spacing, borderRadius, shadows } from '@/theme';

export default function ScanScreen() {
  const router = useRouter();
  const verifyQR = useVerifyQR();
  const [isScanning, setIsScanning] = useState(false);

  const handleSimulateScan = useCallback(() => {
    setIsScanning(true);
    // Simulate a QR payload for demo purposes
    const demoPayload = JSON.stringify({
      invitation_id: 'demo-inv-001',
      visitor_name: 'Robert Chen',
      community_id: 'demo',
      signature: 'unsigned',
    });

    verifyQR.mutate(demoPayload, {
      onSuccess: (result) => {
        setIsScanning(false);
        if (result.valid && result.data) {
          router.push({
            pathname: '/(guard)/gate/visitor-result',
            params: {
              valid: 'true',
              visitor_name: result.data.visitor_name ?? 'Unknown',
              invitation_id: result.data.invitation_id ?? '',
              qr_code_id: result.data.qr_code_id ?? '',
              community_id: result.data.community_id ?? '',
            },
          });
        } else {
          router.push({
            pathname: '/(guard)/gate/visitor-result',
            params: {
              valid: 'false',
              error: result.error ?? 'Invalid QR code',
            },
          });
        }
      },
      onError: (error) => {
        setIsScanning(false);
        Alert.alert('Scan Error', error.message);
      },
    });
  }, [verifyQR, router]);

  return (
    <View style={styles.container}>
      <AmbientBackground />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={22} color={colors.textBody} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Access Verification</Text>
        <View style={styles.headerSpacer} />
      </View>

      {/* Camera Placeholder */}
      <View style={styles.cameraView}>
        {/* Dark background simulating camera */}
        <View style={styles.cameraOverlay}>
          {/* Corner brackets */}
          <View style={styles.cornerContainer}>
            <View style={styles.cornerRow}>
              <View style={[styles.corner, styles.cornerTL]} />
              <View style={[styles.corner, styles.cornerTR]} />
            </View>

            {/* Center content */}
            <View style={styles.cameraCenter}>
              {isScanning ? (
                <ActivityIndicator size="large" color="#60A5FA" />
              ) : (
                <>
                  <View style={styles.cameraIconCircle}>
                    <Ionicons name="qr-code-outline" size={40} color="rgba(255,255,255,0.8)" />
                  </View>
                  <Text style={styles.cameraInstruction}>Point at visitor's QR code</Text>
                  <Text style={styles.cameraSub}>Position the QR code within the frame</Text>
                </>
              )}
            </View>

            <View style={styles.cornerRow}>
              <View style={[styles.corner, styles.cornerBL]} />
              <View style={[styles.corner, styles.cornerBR]} />
            </View>
          </View>

          {/* Scanning line */}
          {isScanning && <View style={styles.scanLine} />}
        </View>
      </View>

      {/* Actions */}
      <View style={styles.actions}>
        {/* Simulate Scan Button */}
        <TouchableOpacity
          style={styles.scanButton}
          onPress={handleSimulateScan}
          disabled={isScanning}
          activeOpacity={0.85}
        >
          <Ionicons name="qr-code" size={20} color={colors.textOnDark} />
          <Text style={styles.scanButtonText}>
            {isScanning ? 'Scanning...' : 'Simulate QR Scan'}
          </Text>
        </TouchableOpacity>

        {/* Manual Entry Link */}
        <TouchableOpacity
          style={styles.manualLink}
          onPress={() => router.push('/(guard)/gate/manual-checkin')}
        >
          <Ionicons name="keypad-outline" size={18} color={colors.primary} />
          <Text style={styles.manualLinkText}>Manual Entry Instead</Text>
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

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: spacing.safeAreaTop,
    paddingHorizontal: spacing.pagePaddingX,
    marginBottom: spacing['3xl'],
    zIndex: 20,
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

  // Camera View
  cameraView: {
    flex: 1,
    marginHorizontal: spacing.pagePaddingX,
    marginBottom: spacing['3xl'],
    borderRadius: borderRadius['4xl'],
    overflow: 'hidden',
    ...shadows.xl,
  },
  cameraOverlay: {
    flex: 1,
    backgroundColor: colors.darkGradientFrom,
    position: 'relative',
  },
  cornerContainer: {
    flex: 1,
    padding: spacing['4xl'],
    justifyContent: 'space-between',
  },
  cornerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  corner: {
    width: 40,
    height: 40,
  },
  cornerTL: {
    borderTopWidth: 3,
    borderLeftWidth: 3,
    borderColor: 'rgba(255,255,255,0.5)',
    borderTopLeftRadius: 8,
  },
  cornerTR: {
    borderTopWidth: 3,
    borderRightWidth: 3,
    borderColor: 'rgba(255,255,255,0.5)',
    borderTopRightRadius: 8,
  },
  cornerBL: {
    borderBottomWidth: 3,
    borderLeftWidth: 3,
    borderColor: 'rgba(255,255,255,0.5)',
    borderBottomLeftRadius: 8,
  },
  cornerBR: {
    borderBottomWidth: 3,
    borderRightWidth: 3,
    borderColor: 'rgba(255,255,255,0.5)',
    borderBottomRightRadius: 8,
  },
  cameraCenter: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  cameraIconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xl,
  },
  cameraInstruction: {
    fontFamily: fonts.bold,
    fontSize: 16,
    color: colors.textOnDark,
    textAlign: 'center',
  },
  cameraSub: {
    fontFamily: fonts.medium,
    fontSize: 12,
    color: 'rgba(255,255,255,0.5)',
    textAlign: 'center',
    marginTop: spacing.xs,
  },
  scanLine: {
    position: 'absolute',
    top: '45%',
    left: 48,
    right: 48,
    height: 2,
    backgroundColor: '#60A5FA',
  },

  // Actions
  actions: {
    paddingHorizontal: spacing.pagePaddingX,
    paddingBottom: spacing.bottomNavClearance,
    gap: spacing.xl,
  },
  scanButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.lg,
    height: spacing.buttonHeight,
    backgroundColor: colors.dark,
    borderRadius: borderRadius.xl,
    ...shadows.xl,
  },
  scanButtonText: {
    fontFamily: fonts.bold,
    fontSize: 16,
    color: colors.textOnDark,
  },
  manualLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    height: spacing.smallButtonHeight,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.xl,
    borderWidth: 1,
    borderColor: colors.borderMedium,
  },
  manualLinkText: {
    fontFamily: fonts.bold,
    fontSize: 14,
    color: colors.primary,
  },
});
