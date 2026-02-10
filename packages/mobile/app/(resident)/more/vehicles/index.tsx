import { useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  RefreshControl,
  Alert,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useMyVehicles, useDeleteVehicle } from '@/hooks/useVehicles';
import { AmbientBackground } from '@/components/ui/AmbientBackground';
import { GlassCard } from '@/components/ui/GlassCard';
import { colors, fonts, spacing, borderRadius, shadows } from '@/theme';

const COLOR_MAP: Record<string, string> = {
  black: '#1E293B',
  white: '#F8FAFC',
  silver: '#94A3B8',
  gray: '#64748B',
  grey: '#64748B',
  red: '#EF4444',
  blue: '#2563EB',
  green: '#10B981',
  yellow: '#F59E0B',
  orange: '#EA580C',
  purple: '#6366F1',
  brown: '#92400E',
  gold: '#D97706',
  beige: '#D2B48C',
  navy: '#1E3A5F',
  maroon: '#800000',
};

function getColorDot(colorName: string | null): string {
  if (!colorName) return colors.textCaption;
  const lower = colorName.toLowerCase().trim();
  return COLOR_MAP[lower] ?? colors.textCaption;
}

export default function VehiclesScreen() {
  const router = useRouter();
  const { data: vehicles, isLoading, refetch } = useMyVehicles();
  const deleteMutation = useDeleteVehicle();

  const [refreshing, setRefreshing] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

  const handleDelete = (vehicleId: string, plateNumber: string) => {
    const doDelete = async () => {
      setDeletingId(vehicleId);
      try {
        await deleteMutation.mutateAsync(vehicleId);
      } catch (err: any) {
        const msg = err?.message ?? 'Failed to delete vehicle.';
        if (Platform.OS === 'web') {
          window.alert(msg);
        } else {
          Alert.alert('Error', msg);
        }
      } finally {
        setDeletingId(null);
      }
    };

    if (Platform.OS === 'web') {
      if (window.confirm(`Are you sure you want to remove ${plateNumber} from your vehicles?`)) {
        doDelete();
      }
    } else {
      Alert.alert(
        'Delete Vehicle',
        `Are you sure you want to remove ${plateNumber} from your vehicles?`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Delete', style: 'destructive', onPress: doDelete },
        ],
      );
    }
  };

  const getStatusBadge = (status: string | null, accessEnabled: boolean) => {
    if (accessEnabled) {
      return { label: 'Active Access', bg: colors.successBg, color: colors.successText };
    }
    if (status === 'pending') {
      return { label: 'Pending', bg: colors.warningBg, color: colors.warningText };
    }
    if (status === 'suspended') {
      return { label: 'Suspended', bg: colors.dangerBg, color: colors.dangerText };
    }
    return { label: 'Inactive', bg: colors.border, color: colors.textMuted };
  };

  const hasVehicles = vehicles && vehicles.length > 0;

  return (
    <View style={styles.container}>
      <AmbientBackground />

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Ionicons name="chevron-back" size={20} color={colors.textBody} />
          </TouchableOpacity>
          <View>
            <Text style={styles.headerTitle}>Vehicles</Text>
            <Text style={styles.headerSubtitle}>Manage your community access.</Text>
          </View>
        </View>
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => router.push('/(resident)/more/vehicles/create')}
          activeOpacity={0.85}
        >
          <Ionicons name="add" size={22} color={colors.textOnDark} />
        </TouchableOpacity>
      </View>

      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <ScrollView
          style={styles.flex}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={colors.primary}
            />
          }
        >
          {!hasVehicles ? (
            /* Empty State */
            <View style={styles.emptyState}>
              <View style={styles.emptyIconBox}>
                <Ionicons name="car-outline" size={48} color={colors.textDisabled} />
              </View>
              <Text style={styles.emptyTitle}>No vehicles registered</Text>
              <Text style={styles.emptySubtitle}>
                Add your vehicles to enable gate access and speed up entry.
              </Text>
              <TouchableOpacity
                style={styles.emptyAddButton}
                onPress={() => router.push('/(resident)/more/vehicles/create')}
                activeOpacity={0.85}
              >
                <Ionicons name="add" size={20} color={colors.textOnDark} />
                <Text style={styles.emptyAddText}>Add Vehicle</Text>
              </TouchableOpacity>
            </View>
          ) : (
            /* Vehicle Cards */
            <View style={styles.vehicleList}>
              {vehicles.map((vehicle) => {
                const badge = getStatusBadge(vehicle.status, vehicle.access_enabled);
                const isDeleting = deletingId === vehicle.id;
                const details = [vehicle.color, vehicle.year].filter(Boolean).join(' \u2022 ');

                return (
                  <GlassCard key={vehicle.id} style={styles.vehicleCard}>
                    {/* Status Badge */}
                    <View style={styles.statusBadgeContainer}>
                      <View style={[styles.statusBadge, { backgroundColor: badge.bg }]}>
                        <Text style={[styles.statusBadgeText, { color: badge.color }]}>
                          {badge.label}
                        </Text>
                      </View>
                    </View>

                    {/* Vehicle Info */}
                    <View style={styles.vehicleInfoRow}>
                      <View style={styles.vehicleIconBox}>
                        <Ionicons name="car" size={28} color={colors.textCaption} />
                      </View>
                      <View style={styles.vehicleDetails}>
                        <Text style={styles.vehicleName}>
                          {[vehicle.make, vehicle.model].filter(Boolean).join(' ') || 'Vehicle'}
                        </Text>
                        <View style={styles.vehicleMetaRow}>
                          {vehicle.color && (
                            <View style={styles.colorDotRow}>
                              <View
                                style={[
                                  styles.colorDot,
                                  { backgroundColor: getColorDot(vehicle.color) },
                                ]}
                              />
                              <Text style={styles.vehicleMeta}>{vehicle.color}</Text>
                            </View>
                          )}
                          {vehicle.year && (
                            <Text style={styles.vehicleMeta}>
                              {vehicle.color ? ' \u2022 ' : ''}{vehicle.year}
                            </Text>
                          )}
                        </View>
                      </View>
                    </View>

                    {/* Plate & Actions */}
                    <View style={styles.plateSection}>
                      <View>
                        <Text style={styles.plateLabel}>License Plate</Text>
                        <View style={styles.plateRow}>
                          <Text style={styles.plateNumber}>{vehicle.plate_number}</Text>
                          {vehicle.plate_state && (
                            <View style={styles.plateStateBadge}>
                              <Text style={styles.plateStateText}>{vehicle.plate_state}</Text>
                            </View>
                          )}
                        </View>
                      </View>
                      <View style={styles.actionButtons}>
                        <TouchableOpacity
                          style={styles.deleteButton}
                          onPress={() => handleDelete(vehicle.id, vehicle.plate_number)}
                          disabled={isDeleting}
                        >
                          {isDeleting ? (
                            <ActivityIndicator size={16} color={colors.danger} />
                          ) : (
                            <Ionicons name="trash-outline" size={18} color={colors.danger} />
                          )}
                        </TouchableOpacity>
                      </View>
                    </View>
                  </GlassCard>
                );
              })}
            </View>
          )}
        </ScrollView>
      )}
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
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
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
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xl,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.full,
    backgroundColor: colors.glass,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.glassBorder,
  },
  headerTitle: {
    fontFamily: fonts.bold,
    fontSize: 24,
    color: colors.textPrimary,
    letterSpacing: -0.5,
  },
  headerSubtitle: {
    fontFamily: fonts.medium,
    fontSize: 14,
    color: colors.textMuted,
  },
  addButton: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.full,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.blueGlow,
  },

  // Scroll
  scrollContent: {
    paddingHorizontal: spacing.pagePaddingX,
    paddingBottom: spacing.bottomNavClearance + 20,
  },

  // Empty State
  emptyState: {
    alignItems: 'center',
    paddingTop: spacing['6xl'] * 2,
    paddingHorizontal: spacing['4xl'],
  },
  emptyIconBox: {
    width: 96,
    height: 96,
    borderRadius: borderRadius['2xl'],
    backgroundColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing['3xl'],
  },
  emptyTitle: {
    fontFamily: fonts.bold,
    fontSize: 18,
    color: colors.textPrimary,
    marginBottom: spacing.md,
  },
  emptySubtitle: {
    fontFamily: fonts.medium,
    fontSize: 14,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: spacing['3xl'],
  },
  emptyAddButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    height: spacing.buttonHeight,
    paddingHorizontal: spacing['4xl'],
    backgroundColor: colors.primary,
    borderRadius: borderRadius.lg,
    ...shadows.blueGlow,
  },
  emptyAddText: {
    fontFamily: fonts.bold,
    fontSize: 16,
    color: colors.textOnDark,
  },

  // Vehicle List
  vehicleList: {
    gap: spacing.xl,
  },

  // Vehicle Card
  vehicleCard: {
    borderRadius: borderRadius['3xl'],
    padding: spacing.cardPadding,
    overflow: 'hidden',
  },
  statusBadgeContainer: {
    position: 'absolute',
    top: spacing.xl,
    right: spacing.xl,
    zIndex: 1,
  },
  statusBadge: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
  },
  statusBadgeText: {
    fontFamily: fonts.bold,
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },

  // Vehicle Info
  vehicleInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xl,
    marginBottom: spacing.xl,
  },
  vehicleIconBox: {
    width: 56,
    height: 56,
    borderRadius: borderRadius.lg,
    backgroundColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  vehicleDetails: {
    flex: 1,
    paddingRight: 80,
  },
  vehicleName: {
    fontFamily: fonts.bold,
    fontSize: 18,
    color: colors.textPrimary,
  },
  vehicleMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  colorDotRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  colorDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.1)',
  },
  vehicleMeta: {
    fontFamily: fonts.medium,
    fontSize: 14,
    color: colors.textMuted,
  },

  // Plate Section
  plateSection: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.xl,
  },
  plateLabel: {
    fontFamily: fonts.bold,
    fontSize: 10,
    color: colors.textCaption,
    textTransform: 'uppercase',
    letterSpacing: 2,
  },
  plateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginTop: spacing.xs,
  },
  plateNumber: {
    fontFamily: fonts.bold,
    fontSize: 22,
    color: colors.textSecondary,
    letterSpacing: -1,
  },
  plateStateBadge: {
    paddingHorizontal: spacing.md,
    paddingVertical: 2,
    backgroundColor: colors.primaryLight,
    borderRadius: borderRadius.sm,
  },
  plateStateText: {
    fontFamily: fonts.bold,
    fontSize: 10,
    color: colors.primary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  deleteButton: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.full,
    backgroundColor: colors.dangerBgLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
