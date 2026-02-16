import { useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { usePackageDetail, useConfirmPickup } from '@/hooks/usePackages';
import { formatDateTime, formatRelative } from '@/lib/dates';
import { AmbientBackground } from '@/components/ui/AmbientBackground';
import { GlassCard } from '@/components/ui/GlassCard';
import { colors, fonts, spacing, borderRadius, shadows } from '@/theme';

function getStatusStyle(status: string) {
  switch (status) {
    case 'received':
    case 'stored':
      return { bg: colors.infoBg, color: colors.primary, label: 'Stored' };
    case 'notified':
    case 'pending_pickup':
      return { bg: colors.warningBg, color: colors.warningText, label: 'Notified' };
    case 'picked_up':
      return { bg: colors.successBg, color: colors.successText, label: 'Delivered' };
    case 'returned':
      return { bg: colors.border, color: colors.textCaption, label: 'Returned' };
    default:
      return { bg: colors.border, color: colors.textCaption, label: status };
  }
}

export default function PackageDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: pkg, isLoading } = usePackageDetail(id!);
  const confirmPickup = useConfirmPickup();

  const handleConfirmPickup = useCallback(async () => {
    if (!pkg) return;

    const doConfirm = async () => {
      try {
        await confirmPickup.mutateAsync({ packageId: id! });
        router.back();
      } catch (error: any) {
        const msg = error?.message ?? 'Failed to confirm pickup.';
        if (Platform.OS === 'web') {
          window.alert(msg);
        } else {
          Alert.alert('Error', msg);
        }
      }
    };

    if (Platform.OS === 'web') {
      if (window.confirm(`Confirm package pickup for ${pkg.recipient_name}?`)) {
        await doConfirm();
      }
    } else {
      Alert.alert(
        'Confirm Pickup',
        `Confirm package pickup for ${pkg.recipient_name}?`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Confirm', onPress: doConfirm },
        ],
      );
    }
  }, [pkg, confirmPickup, id, router]);

  if (isLoading || !pkg) {
    return (
      <View style={styles.container}>
        <AmbientBackground />
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="chevron-back" size={24} color={colors.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Package Detail</Text>
          <View style={styles.headerSpacer} />
        </View>
        <ActivityIndicator color={colors.primary} style={styles.loader} />
      </View>
    );
  }

  const status = getStatusStyle(pkg.status);
  const units = pkg.units as { unit_number: string; building: string | null } | null;
  const resident = pkg.residents as {
    first_name: string;
    paternal_surname: string;
    phone: string | null;
  } | null;
  const pickupCodes = (pkg.package_pickup_codes ?? []) as Array<{
    id: string;
    code_type: string;
    code_value: string;
    status: string;
    valid_until: string;
  }>;
  const activeCode = pickupCodes.find((c) => c.status === 'active');
  const isDelivered = pkg.status === 'picked_up';

  return (
    <View style={styles.container}>
      <AmbientBackground />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="chevron-back" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Package Detail</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Status Badge */}
        <View style={styles.statusRow}>
          <View style={[styles.statusBadge, { backgroundColor: status.bg }]}>
            <Text style={[styles.statusBadgeText, { color: status.color }]}>
              {status.label}
            </Text>
          </View>
        </View>

        {/* Main Info Card */}
        <GlassCard style={styles.infoCard}>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>CARRIER</Text>
            <Text style={styles.infoValue}>{pkg.carrier ?? 'Unknown'}</Text>
          </View>
          {pkg.tracking_number && (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>TRACKING #</Text>
              <Text style={styles.infoValue}>{pkg.tracking_number}</Text>
            </View>
          )}
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>RECIPIENT</Text>
            <Text style={styles.infoValue}>{pkg.recipient_name}</Text>
          </View>
          {units && (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>UNIT</Text>
              <Text style={styles.infoValue}>
                {units.unit_number}
                {units.building ? ` - ${units.building}` : ''}
              </Text>
            </View>
          )}
          {resident && (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>RESIDENT</Text>
              <Text style={styles.infoValue}>
                {resident.first_name} {resident.paternal_surname}
              </Text>
            </View>
          )}
          {pkg.description && (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>DESCRIPTION</Text>
              <Text style={styles.infoValue}>{pkg.description}</Text>
            </View>
          )}
          {pkg.received_at && (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>RECEIVED</Text>
              <Text style={styles.infoValue}>{formatDateTime(pkg.received_at)}</Text>
            </View>
          )}
          {pkg.package_count && pkg.package_count > 1 && (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>COUNT</Text>
              <Text style={styles.infoValue}>{pkg.package_count} packages</Text>
            </View>
          )}
          {pkg.is_oversized && (
            <View style={styles.oversizedBadge}>
              <Ionicons name="resize-outline" size={16} color={colors.warningText} />
              <Text style={styles.oversizedText}>Oversized Package</Text>
            </View>
          )}
        </GlassCard>

        {/* Pickup Code */}
        {activeCode && !isDelivered && (
          <GlassCard variant="dense" style={styles.pickupCard}>
            <Text style={styles.pickupLabel}>PICKUP CODE</Text>
            <Text style={styles.pickupCode}>{activeCode.code_value}</Text>
            <Text style={styles.pickupExpiry}>
              Valid until: {formatDateTime(activeCode.valid_until)}
            </Text>
          </GlassCard>
        )}

        {/* Confirm Pickup */}
        {!isDelivered && (
          <TouchableOpacity
            style={styles.confirmButton}
            onPress={handleConfirmPickup}
            disabled={confirmPickup.isPending}
          >
            {confirmPickup.isPending ? (
              <ActivityIndicator color={colors.textOnDark} />
            ) : (
              <>
                <Ionicons name="checkmark-circle-outline" size={20} color={colors.textOnDark} />
                <Text style={styles.confirmButtonText}>Confirm Pickup</Text>
              </>
            )}
          </TouchableOpacity>
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
  loader: {
    flex: 1,
    justifyContent: 'center',
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
  scrollContent: {
    paddingHorizontal: spacing.pagePaddingX,
    paddingTop: spacing.md,
    paddingBottom: spacing.bottomNavClearance + 16,
    gap: spacing['3xl'],
  },
  statusRow: {
    flexDirection: 'row',
  },
  statusBadge: {
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
  },
  statusBadgeText: {
    fontFamily: fonts.bold,
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  infoCard: {
    padding: spacing['2xl'],
    borderRadius: borderRadius['2xl'],
    gap: spacing.xl,
  },
  infoRow: {
    gap: spacing.xs,
  },
  infoLabel: {
    fontFamily: fonts.bold,
    fontSize: 10,
    color: colors.textCaption,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  infoValue: {
    fontFamily: fonts.medium,
    fontSize: 15,
    color: colors.textPrimary,
  },
  oversizedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.warningBg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
  },
  oversizedText: {
    fontFamily: fonts.bold,
    fontSize: 12,
    color: colors.warningText,
  },
  pickupCard: {
    padding: spacing['3xl'],
    borderRadius: borderRadius['2xl'],
    alignItems: 'center',
  },
  pickupLabel: {
    fontFamily: fonts.bold,
    fontSize: 10,
    color: colors.textCaption,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    marginBottom: spacing.md,
  },
  pickupCode: {
    fontFamily: fonts.black,
    fontSize: 36,
    color: colors.textPrimary,
    letterSpacing: 4,
    marginBottom: spacing.md,
  },
  pickupExpiry: {
    fontFamily: fonts.medium,
    fontSize: 12,
    color: colors.textCaption,
  },
  confirmButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    height: spacing.buttonHeight,
    borderRadius: borderRadius.lg,
    backgroundColor: colors.dark,
    ...shadows.darkGlow,
  },
  confirmButtonText: {
    fontFamily: fonts.bold,
    fontSize: 16,
    color: colors.textOnDark,
  },
});
