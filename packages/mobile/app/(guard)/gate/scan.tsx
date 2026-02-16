import { useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useVerifyQR } from '@/hooks/useGateOps';
import { AmbientBackground } from '@/components/ui/AmbientBackground';
import { colors, fonts, spacing, borderRadius, shadows } from '@/theme';

export default function ScanScreen() {
  const router = useRouter();
  const verifyQR = useVerifyQR();
  const [permission, requestPermission] = useCameraPermissions();
  const [isProcessing, setIsProcessing] = useState(false);
  const scannedRef = useRef(false);

  const navigateWithResult = useCallback(
    (result: { valid: boolean; data?: Record<string, any>; error?: string }) => {
      if (result.valid && result.data) {
        router.push({
          pathname: '/(guard)/gate/visitor-result',
          params: {
            valid: 'true',
            visitor_name: result.data.visitor_name ?? 'Unknown',
            invitation_id: result.data.invitation_id ?? '',
            qr_code_id: result.data.qr_code_id ?? '',
            community_id: result.data.community_id ?? '',
            invitation_type: result.data.invitation_type ?? '',
            unit_number: result.data.unit_number ?? '',
            valid_from: result.data.valid_from ?? '',
            valid_until: result.data.valid_until ?? '',
            vehicle_plate: result.data.vehicle_plate ?? '',
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
    [router],
  );

  const handleBarCodeScanned = useCallback(
    ({ data }: { data: string }) => {
      // Scan-once protection: ignore subsequent scans until reset
      if (scannedRef.current || isProcessing) return;
      scannedRef.current = true;
      setIsProcessing(true);

      verifyQR.mutate(data, {
        onSuccess: (result) => {
          setIsProcessing(false);
          navigateWithResult(result);
        },
        onError: (error) => {
          setIsProcessing(false);
          scannedRef.current = false;
          if (Platform.OS === 'web') {
            window.alert(error.message);
          } else {
            Alert.alert('Scan Error', error.message);
          }
        },
      });
    },
    [verifyQR, isProcessing, navigateWithResult],
  );

  // Web fallback: simulate scan since camera doesn't work on web
  const handleSimulateScan = useCallback(() => {
    const demoPayload = JSON.stringify({
      invitation_id: 'demo-inv-001',
      community_id: 'demo',
      created_at: Date.now(),
    });

    setIsProcessing(true);
    verifyQR.mutate(demoPayload, {
      onSuccess: (result) => {
        setIsProcessing(false);
        navigateWithResult(result);
      },
      onError: (error) => {
        setIsProcessing(false);
        if (Platform.OS === 'web') {
          window.alert(error.message);
        } else {
          Alert.alert('Scan Error', error.message);
        }
      },
    });
  }, [verifyQR, navigateWithResult]);

  const handleRescan = useCallback(() => {
    scannedRef.current = false;
    setIsProcessing(false);
  }, []);

  // Permission not yet determined
  if (!permission) {
    return (
      <View style={styles.container}>
        <AmbientBackground />
        <View style={styles.centeredContent}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </View>
    );
  }

  // Permission denied
  if (!permission.granted) {
    return (
      <View style={styles.container}>
        <AmbientBackground />
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Ionicons name="chevron-back" size={22} color={colors.textBody} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Access Verification</Text>
          <View style={styles.headerSpacer} />
        </View>
        <View style={styles.centeredContent}>
          <View style={styles.permissionCard}>
            <View style={styles.permissionIcon}>
              <Ionicons name="camera-outline" size={48} color={colors.textCaption} />
            </View>
            <Text style={styles.permissionTitle}>Camera Permission Required</Text>
            <Text style={styles.permissionDescription}>
              To scan visitor QR codes, please allow camera access.
            </Text>
            <TouchableOpacity
              style={styles.permissionButton}
              onPress={requestPermission}
              activeOpacity={0.85}
            >
              <Ionicons name="camera" size={20} color={colors.textOnDark} />
              <Text style={styles.permissionButtonText}>Grant Camera Access</Text>
            </TouchableOpacity>
          </View>
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

  const isWeb = Platform.OS === 'web';

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

      {/* Camera / Scanner Area */}
      <View style={styles.cameraView}>
        {!isWeb ? (
          <CameraView
            style={StyleSheet.absoluteFill}
            facing="back"
            barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
            onBarcodeScanned={scannedRef.current ? undefined : handleBarCodeScanned}
          />
        ) : (
          <View style={styles.webPlaceholder}>
            <Ionicons name="desktop-outline" size={40} color="rgba(255,255,255,0.5)" />
            <Text style={styles.webPlaceholderText}>
              Camera not available on web
            </Text>
          </View>
        )}

        {/* Overlay with corner brackets */}
        <View style={styles.cameraOverlay} pointerEvents="none">
          <View style={styles.cornerContainer}>
            <View style={styles.cornerRow}>
              <View style={[styles.corner, styles.cornerTL]} />
              <View style={[styles.corner, styles.cornerTR]} />
            </View>

            <View style={styles.cameraCenter}>
              {isProcessing ? (
                <>
                  <ActivityIndicator size="large" color="#60A5FA" />
                  <Text style={styles.cameraInstruction}>Verifying...</Text>
                </>
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
        </View>
      </View>

      {/* Actions */}
      <View style={styles.actions}>
        {/* Re-scan button if already scanned, or Simulate on web */}
        {isWeb ? (
          <TouchableOpacity
            style={styles.scanButton}
            onPress={handleSimulateScan}
            disabled={isProcessing}
            activeOpacity={0.85}
          >
            <Ionicons name="qr-code" size={20} color={colors.textOnDark} />
            <Text style={styles.scanButtonText}>
              {isProcessing ? 'Verifying...' : 'Simulate QR Scan'}
            </Text>
          </TouchableOpacity>
        ) : scannedRef.current ? (
          <TouchableOpacity
            style={styles.scanButton}
            onPress={handleRescan}
            disabled={isProcessing}
            activeOpacity={0.85}
          >
            <Ionicons name="refresh" size={20} color={colors.textOnDark} />
            <Text style={styles.scanButtonText}>Scan Again</Text>
          </TouchableOpacity>
        ) : null}

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

  // Centered content (permission screens)
  centeredContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.pagePaddingX,
    gap: spacing['3xl'],
  },
  permissionCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderMedium,
    borderRadius: borderRadius['4xl'],
    padding: spacing['4xl'],
    alignItems: 'center',
    width: '100%',
    ...shadows.xl,
  },
  permissionIcon: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing['3xl'],
  },
  permissionTitle: {
    fontFamily: fonts.bold,
    fontSize: 18,
    color: colors.textPrimary,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  permissionDescription: {
    fontFamily: fonts.medium,
    fontSize: 14,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: spacing['3xl'],
  },
  permissionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.lg,
    height: spacing.buttonHeight,
    backgroundColor: colors.dark,
    borderRadius: borderRadius.xl,
    paddingHorizontal: spacing['3xl'],
    width: '100%',
    ...shadows.xl,
  },
  permissionButtonText: {
    fontFamily: fonts.bold,
    fontSize: 16,
    color: colors.textOnDark,
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
    ...StyleSheet.absoluteFillObject,
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
    borderColor: 'rgba(255,255,255,0.7)',
    borderTopLeftRadius: 8,
  },
  cornerTR: {
    borderTopWidth: 3,
    borderRightWidth: 3,
    borderColor: 'rgba(255,255,255,0.7)',
    borderTopRightRadius: 8,
  },
  cornerBL: {
    borderBottomWidth: 3,
    borderLeftWidth: 3,
    borderColor: 'rgba(255,255,255,0.7)',
    borderBottomLeftRadius: 8,
  },
  cornerBR: {
    borderBottomWidth: 3,
    borderRightWidth: 3,
    borderColor: 'rgba(255,255,255,0.7)',
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
    backgroundColor: 'rgba(0,0,0,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xl,
  },
  cameraInstruction: {
    fontFamily: fonts.bold,
    fontSize: 16,
    color: colors.textOnDark,
    textAlign: 'center',
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  cameraSub: {
    fontFamily: fonts.medium,
    fontSize: 12,
    color: 'rgba(255,255,255,0.7)',
    textAlign: 'center',
    marginTop: spacing.xs,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },

  // Web placeholder
  webPlaceholder: {
    flex: 1,
    backgroundColor: colors.darkGradientFrom,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.lg,
  },
  webPlaceholderText: {
    fontFamily: fonts.medium,
    fontSize: 14,
    color: 'rgba(255,255,255,0.5)',
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
