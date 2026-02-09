import { useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  TextInput,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useVehicleSearch } from '@/hooks/useDirectory';
import { AmbientBackground } from '@/components/ui/AmbientBackground';
import { GlassCard } from '@/components/ui/GlassCard';
import { colors, fonts, spacing, borderRadius, shadows } from '@/theme';

interface VehicleItem {
  id: string;
  plate_number: string;
  plate_normalized: string;
  plate_state: string | null;
  make: string | null;
  model: string | null;
  year: number | null;
  color: string | null;
  access_enabled: boolean;
  residents: {
    id: string;
    first_name: string;
    paternal_surname: string;
    occupancies: Array<{
      units: { unit_number: string } | null;
    }>;
  } | null;
}

function getColorDot(color: string | null) {
  if (!color) return colors.textCaption;
  const map: Record<string, string> = {
    black: '#1E293B',
    white: '#E2E8F0',
    silver: '#94A3B8',
    gray: '#64748B',
    grey: '#64748B',
    red: '#EF4444',
    blue: '#2563EB',
    green: '#10B981',
    yellow: '#F59E0B',
    orange: '#EA580C',
    brown: '#92400E',
    gold: '#D97706',
    beige: '#D4C5A9',
  };
  return map[color.toLowerCase()] ?? colors.textCaption;
}

export default function VehicleSearchScreen() {
  const router = useRouter();
  const [plate, setPlate] = useState('');
  const { data: vehicles, isLoading } = useVehicleSearch(plate);

  const renderVehicle = useCallback(
    ({ item }: { item: VehicleItem }) => {
      const resident = item.residents;
      const unitNumber =
        resident?.occupancies?.[0]?.units?.unit_number ?? null;

      return (
        <GlassCard style={styles.vehicleCard}>
          {/* Plate Display */}
          <View style={styles.plateBox}>
            <Text style={styles.plateText}>{item.plate_number}</Text>
            {item.plate_state && (
              <Text style={styles.plateState}>{item.plate_state}</Text>
            )}
          </View>

          {/* Vehicle Info */}
          <View style={styles.vehicleInfo}>
            <View style={styles.vehicleRow}>
              {item.color && (
                <View
                  style={[styles.colorDot, { backgroundColor: getColorDot(item.color) }]}
                />
              )}
              <Text style={styles.vehicleDesc}>
                {[item.year, item.make, item.model].filter(Boolean).join(' ') || 'Unknown Vehicle'}
              </Text>
            </View>

            {item.color && (
              <Text style={styles.vehicleColor}>
                {item.color.charAt(0).toUpperCase() + item.color.slice(1)}
              </Text>
            )}
          </View>

          {/* Owner Info */}
          {resident && (
            <View style={styles.ownerSection}>
              <View style={styles.ownerDivider} />
              <View style={styles.ownerRow}>
                <Ionicons name="person-outline" size={16} color={colors.textCaption} />
                <Text style={styles.ownerName}>
                  {resident.first_name} {resident.paternal_surname}
                </Text>
                {unitNumber && (
                  <>
                    <Ionicons name="home-outline" size={14} color={colors.textCaption} />
                    <Text style={styles.ownerUnit}>{unitNumber}</Text>
                  </>
                )}
              </View>
            </View>
          )}

          {/* Access Status */}
          <View style={styles.accessRow}>
            <View
              style={[
                styles.accessBadge,
                item.access_enabled ? styles.accessBadgeEnabled : styles.accessBadgeDisabled,
              ]}
            >
              <Ionicons
                name={item.access_enabled ? 'checkmark-circle' : 'close-circle'}
                size={14}
                color={item.access_enabled ? colors.successText : colors.dangerText}
              />
              <Text
                style={[
                  styles.accessBadgeText,
                  {
                    color: item.access_enabled ? colors.successText : colors.dangerText,
                  },
                ]}
              >
                {item.access_enabled ? 'Access Enabled' : 'Access Disabled'}
              </Text>
            </View>
          </View>
        </GlassCard>
      );
    },
    [],
  );

  return (
    <View style={styles.container}>
      <AmbientBackground />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="chevron-back" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Vehicle Search</Text>
        <View style={styles.headerSpacer} />
      </View>

      {/* Search */}
      <View style={styles.searchContainer}>
        <View style={styles.searchBar}>
          <Ionicons name="car-outline" size={18} color={colors.textCaption} />
          <TextInput
            style={styles.searchInput}
            value={plate}
            onChangeText={setPlate}
            placeholder="Search by plate number..."
            placeholderTextColor={colors.textCaption}
            autoCapitalize="characters"
          />
          {plate.length > 0 && (
            <TouchableOpacity onPress={() => setPlate('')}>
              <Ionicons name="close-circle" size={18} color={colors.textCaption} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Results */}
      {plate.length < 3 ? (
        <View style={styles.promptState}>
          <View style={styles.promptIcon}>
            <Ionicons name="car-sport-outline" size={48} color={colors.textDisabled} />
          </View>
          <Text style={styles.promptTitle}>Search Vehicles</Text>
          <Text style={styles.promptSubtitle}>
            Enter at least 3 characters of a plate number to search registered vehicles
          </Text>
        </View>
      ) : isLoading ? (
        <ActivityIndicator color={colors.primary} style={styles.mainLoader} />
      ) : (
        <FlatList
          data={(vehicles ?? []) as VehicleItem[]}
          keyExtractor={(item) => item.id}
          renderItem={renderVehicle}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Ionicons name="car-outline" size={48} color={colors.textDisabled} />
              <Text style={styles.emptyTitle}>No Vehicles Found</Text>
              <Text style={styles.emptySubtitle}>
                No registered vehicles match "{plate}"
              </Text>
            </View>
          }
        />
      )}
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
  searchContainer: {
    paddingHorizontal: spacing.pagePaddingX,
    marginBottom: spacing['3xl'],
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 48,
    backgroundColor: colors.surfaceMuted,
    borderRadius: borderRadius.xl,
    borderWidth: 1,
    borderColor: colors.borderMedium,
    paddingHorizontal: spacing.xl,
    gap: spacing.md,
  },
  searchInput: {
    flex: 1,
    fontFamily: fonts.medium,
    fontSize: 14,
    color: colors.textPrimary,
  },
  listContent: {
    paddingHorizontal: spacing.pagePaddingX,
    paddingBottom: spacing.bottomNavClearance + 16,
    gap: spacing.xl,
  },
  vehicleCard: {
    padding: spacing['2xl'],
    borderRadius: borderRadius['2xl'],
  },
  plateBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.dark,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.lg,
    marginBottom: spacing.xl,
  },
  plateText: {
    fontFamily: fonts.black,
    fontSize: 20,
    color: colors.textOnDark,
    letterSpacing: 3,
  },
  plateState: {
    fontFamily: fonts.bold,
    fontSize: 10,
    color: colors.textOnDarkMuted,
    textTransform: 'uppercase',
  },
  vehicleInfo: {
    gap: spacing.xs,
    marginBottom: spacing.md,
  },
  vehicleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  colorDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 1,
    borderColor: colors.borderMedium,
  },
  vehicleDesc: {
    fontFamily: fonts.bold,
    fontSize: 15,
    color: colors.textPrimary,
  },
  vehicleColor: {
    fontFamily: fonts.medium,
    fontSize: 12,
    color: colors.textCaption,
    marginLeft: 26,
  },
  ownerSection: {
    marginTop: spacing.md,
  },
  ownerDivider: {
    height: 1,
    backgroundColor: colors.border,
    marginBottom: spacing.lg,
  },
  ownerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  ownerName: {
    fontFamily: fonts.bold,
    fontSize: 13,
    color: colors.textBody,
    marginRight: spacing.md,
  },
  ownerUnit: {
    fontFamily: fonts.medium,
    fontSize: 12,
    color: colors.textCaption,
  },
  accessRow: {
    marginTop: spacing.xl,
  },
  accessBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
  },
  accessBadgeEnabled: {
    backgroundColor: colors.successBg,
  },
  accessBadgeDisabled: {
    backgroundColor: colors.dangerBg,
  },
  accessBadgeText: {
    fontFamily: fonts.bold,
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  promptState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xl,
    paddingBottom: spacing.bottomNavClearance,
  },
  promptIcon: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  promptTitle: {
    fontFamily: fonts.bold,
    fontSize: 18,
    color: colors.textPrimary,
  },
  promptSubtitle: {
    fontFamily: fonts.medium,
    fontSize: 14,
    color: colors.textMuted,
    textAlign: 'center',
    paddingHorizontal: spacing['4xl'],
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: spacing['5xl'],
    gap: spacing.lg,
  },
  emptyTitle: {
    fontFamily: fonts.bold,
    fontSize: 18,
    color: colors.textPrimary,
  },
  emptySubtitle: {
    fontFamily: fonts.medium,
    fontSize: 14,
    color: colors.textMuted,
    textAlign: 'center',
    paddingHorizontal: spacing['4xl'],
  },
  mainLoader: {
    flex: 1,
    justifyContent: 'center',
  },
});
