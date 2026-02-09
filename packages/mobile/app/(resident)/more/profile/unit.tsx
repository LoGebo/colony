import { View, Text, StyleSheet, ActivityIndicator, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/hooks/useAuth';
import { useResidentUnit, useResidentOccupancy } from '@/hooks/useOccupancy';
import { AmbientBackground } from '@/components/ui/AmbientBackground';
import { GlassCard } from '@/components/ui/GlassCard';
import { colors, fonts, spacing, borderRadius, shadows } from '@/theme';

export default function UnitInfoScreen() {
  const router = useRouter();
  const { residentId } = useAuth();
  const { unitNumber, building, floorNumber, isLoading: unitLoading } = useResidentUnit();
  const { data: occupancies, isLoading: occLoading } = useResidentOccupancy(residentId);

  const isLoading = unitLoading || occLoading;
  const primaryOccupancy = occupancies?.find((o) => o.occupancy_type === 'owner') ?? occupancies?.[0];

  const formatOccupancyType = (type: string | undefined): string => {
    if (!type) return 'N/A';
    return type.charAt(0).toUpperCase() + type.slice(1).replace(/_/g, ' ');
  };

  return (
    <View style={styles.container}>
      <AmbientBackground />

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Ionicons name="chevron-back" size={20} color={colors.textBody} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Unit Info</Text>
        </View>
      </View>

      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <View style={styles.content}>
          {/* Unit Card */}
          <GlassCard style={styles.unitCard}>
            <View style={styles.unitIconRow}>
              <View style={styles.unitIconBox}>
                <Ionicons name="business" size={28} color={colors.primary} />
              </View>
              <View style={styles.unitBadge}>
                <Text style={styles.unitBadgeText}>
                  {formatOccupancyType(primaryOccupancy?.occupancy_type)}
                </Text>
              </View>
            </View>

            <Text style={styles.unitNumberLabel}>Unit Number</Text>
            <Text style={styles.unitNumber}>{unitNumber ?? 'N/A'}</Text>
          </GlassCard>

          {/* Details Card */}
          <View style={styles.detailsCard}>
            {/* Building */}
            <View style={styles.detailRow}>
              <View style={styles.detailIconBox}>
                <Ionicons name="location-outline" size={18} color={colors.textCaption} />
              </View>
              <View style={styles.detailTextGroup}>
                <Text style={styles.detailLabel}>Building</Text>
                <Text style={styles.detailValue}>{building ?? 'N/A'}</Text>
              </View>
            </View>

            <View style={styles.detailDivider} />

            {/* Floor */}
            <View style={styles.detailRow}>
              <View style={styles.detailIconBox}>
                <Ionicons name="layers-outline" size={18} color={colors.textCaption} />
              </View>
              <View style={styles.detailTextGroup}>
                <Text style={styles.detailLabel}>Floor</Text>
                <Text style={styles.detailValue}>
                  {floorNumber != null ? `Floor ${floorNumber}` : 'N/A'}
                </Text>
              </View>
            </View>

            <View style={styles.detailDivider} />

            {/* Occupancy Type */}
            <View style={styles.detailRow}>
              <View style={styles.detailIconBox}>
                <Ionicons name="key-outline" size={18} color={colors.textCaption} />
              </View>
              <View style={styles.detailTextGroup}>
                <Text style={styles.detailLabel}>Occupancy Type</Text>
                <Text style={styles.detailValue}>
                  {formatOccupancyType(primaryOccupancy?.occupancy_type)}
                </Text>
              </View>
            </View>

            {/* All Occupancies (if multiple) */}
            {occupancies && occupancies.length > 1 && (
              <>
                <View style={styles.detailDivider} />
                <View style={styles.multiOccHeader}>
                  <Text style={styles.multiOccTitle}>All Occupancies</Text>
                </View>
                {occupancies.map((occ) => {
                  const unit = occ.units as { id: string; unit_number: string; building: string | null; floor_number: number | null } | null;
                  return (
                    <View key={occ.id} style={styles.multiOccRow}>
                      <View style={styles.multiOccDot} />
                      <View style={styles.multiOccInfo}>
                        <Text style={styles.multiOccUnit}>
                          Unit {unit?.unit_number ?? 'N/A'}
                        </Text>
                        <Text style={styles.multiOccType}>
                          {formatOccupancyType(occ.occupancy_type)}
                          {unit?.building ? ` \u2022 ${unit.building}` : ''}
                        </Text>
                      </View>
                    </View>
                  );
                })}
              </>
            )}
          </View>

          {/* Info Note */}
          <View style={styles.infoNote}>
            <Ionicons name="information-circle-outline" size={16} color={colors.textCaption} />
            <Text style={styles.infoNoteText}>
              Unit information is managed by your community administrator. Contact them for any updates.
            </Text>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
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
    fontSize: 20,
    color: colors.textPrimary,
    letterSpacing: -0.5,
  },

  // Content
  content: {
    paddingHorizontal: spacing.pagePaddingX,
    gap: spacing['3xl'],
  },

  // Unit Card
  unitCard: {
    borderRadius: borderRadius['2xl'],
    padding: spacing['3xl'],
    alignItems: 'center',
  },
  unitIconRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    marginBottom: spacing['3xl'],
  },
  unitIconBox: {
    width: 56,
    height: 56,
    borderRadius: borderRadius.lg,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  unitBadge: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    backgroundColor: colors.primaryLightAlt,
    borderRadius: borderRadius.full,
  },
  unitBadgeText: {
    fontFamily: fonts.bold,
    fontSize: 12,
    color: colors.primary,
  },
  unitNumberLabel: {
    fontFamily: fonts.bold,
    fontSize: 10,
    color: colors.textCaption,
    textTransform: 'uppercase',
    letterSpacing: 2,
    marginBottom: spacing.xs,
  },
  unitNumber: {
    fontFamily: fonts.bold,
    fontSize: 40,
    color: colors.textPrimary,
    letterSpacing: -1,
  },

  // Details Card
  detailsCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.xl,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xl,
    padding: spacing.xl,
  },
  detailDivider: {
    height: 1,
    backgroundColor: colors.border,
    marginHorizontal: spacing.xl,
  },
  detailIconBox: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.md,
    backgroundColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  detailTextGroup: {
    flex: 1,
  },
  detailLabel: {
    fontFamily: fonts.medium,
    fontSize: 12,
    color: colors.textCaption,
  },
  detailValue: {
    fontFamily: fonts.bold,
    fontSize: 14,
    color: colors.textSecondary,
  },

  // Multi-occupancy
  multiOccHeader: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xl,
    paddingBottom: spacing.md,
  },
  multiOccTitle: {
    fontFamily: fonts.bold,
    fontSize: 12,
    color: colors.textCaption,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  multiOccRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.lg,
  },
  multiOccDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primary,
  },
  multiOccInfo: {
    flex: 1,
  },
  multiOccUnit: {
    fontFamily: fonts.bold,
    fontSize: 14,
    color: colors.textSecondary,
  },
  multiOccType: {
    fontFamily: fonts.medium,
    fontSize: 12,
    color: colors.textMuted,
  },

  // Info Note
  infoNote: {
    flexDirection: 'row',
    gap: spacing.md,
    paddingHorizontal: spacing.xs,
  },
  infoNoteText: {
    flex: 1,
    fontFamily: fonts.medium,
    fontSize: 12,
    color: colors.textCaption,
    lineHeight: 18,
  },
});
