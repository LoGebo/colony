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
import { useMyPets, useDeletePet } from '@/hooks/usePets';
import { AmbientBackground } from '@/components/ui/AmbientBackground';
import { GlassCard } from '@/components/ui/GlassCard';
import { colors, fonts, spacing, borderRadius, shadows } from '@/theme';

const SPECIES_CONFIG: Record<string, { icon: string; bg: string; color: string; label: string }> = {
  dog: { icon: 'paw', bg: colors.orangeBg, color: colors.orange, label: 'Dog' },
  cat: { icon: 'paw', bg: colors.indigoBg, color: colors.indigo, label: 'Cat' },
  bird: { icon: 'leaf', bg: colors.tealLight, color: colors.tealDark, label: 'Bird' },
  fish: { icon: 'water', bg: colors.primaryLight, color: colors.primary, label: 'Fish' },
  reptile: { icon: 'bug', bg: colors.successBg, color: colors.successText, label: 'Reptile' },
  rodent: { icon: 'ellipse', bg: colors.warningBg, color: colors.warningText, label: 'Rodent' },
  other: { icon: 'help-circle', bg: colors.border, color: colors.textMuted, label: 'Other' },
};

function getSpeciesConfig(species: string) {
  return SPECIES_CONFIG[species] ?? SPECIES_CONFIG.other;
}

export default function PetsScreen() {
  const router = useRouter();
  const { data: pets, isLoading, refetch } = useMyPets();
  const deleteMutation = useDeletePet();

  const [refreshing, setRefreshing] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

  const handleDelete = (petId: string, petName: string) => {
    const doDelete = async () => {
      setDeletingId(petId);
      try {
        await deleteMutation.mutateAsync(petId);
      } catch (err: any) {
        const msg = err?.message ?? 'Failed to remove pet.';
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
      if (window.confirm(`Are you sure you want to remove ${petName}?`)) {
        doDelete();
      }
    } else {
      Alert.alert(
        'Remove Pet',
        `Are you sure you want to remove ${petName} from your registered pets?`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Remove', style: 'destructive', onPress: doDelete },
        ],
      );
    }
  };

  const hasPets = pets && pets.length > 0;

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
            <Text style={styles.headerTitle}>Pets</Text>
            <Text style={styles.headerSubtitle}>Registered pets in your unit.</Text>
          </View>
        </View>
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => router.push('/(resident)/more/pets/create')}
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
          {!hasPets ? (
            <View style={styles.emptyState}>
              <View style={styles.emptyIconBox}>
                <Ionicons name="paw-outline" size={48} color={colors.textDisabled} />
              </View>
              <Text style={styles.emptyTitle}>No pets registered</Text>
              <Text style={styles.emptySubtitle}>
                Register your pets to keep your community informed and compliant with regulations.
              </Text>
              <TouchableOpacity
                style={styles.emptyAddButton}
                onPress={() => router.push('/(resident)/more/pets/create')}
                activeOpacity={0.85}
              >
                <Ionicons name="add" size={20} color={colors.textOnDark} />
                <Text style={styles.emptyAddText}>Add Pet</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.petList}>
              {pets.map((pet) => {
                const speciesInfo = getSpeciesConfig(pet.species);
                const isDeleting = deletingId === pet.id;
                const details = [pet.breed, pet.color].filter(Boolean).join(' \u2022 ');

                return (
                  <GlassCard key={pet.id} style={styles.petCard}>
                    {/* Service Animal Badge */}
                    {pet.is_service_animal && (
                      <View style={styles.serviceBadgeContainer}>
                        <View style={[styles.serviceBadge, { backgroundColor: colors.primaryLight }]}>
                          <Text style={[styles.serviceBadgeText, { color: colors.primary }]}>
                            Service Animal
                          </Text>
                        </View>
                      </View>
                    )}

                    {/* Pet Info */}
                    <View style={styles.petInfoRow}>
                      <View style={[styles.petIconBox, { backgroundColor: speciesInfo.bg }]}>
                        <Ionicons name={speciesInfo.icon as any} size={28} color={speciesInfo.color} />
                      </View>
                      <View style={styles.petDetails}>
                        <Text style={styles.petName}>{pet.name}</Text>
                        <Text style={styles.petSpecies}>{speciesInfo.label}</Text>
                        {details ? <Text style={styles.petMeta}>{details}</Text> : null}
                      </View>
                    </View>

                    {/* Extra Info */}
                    {(pet.weight_kg || pet.microchip_number) && (
                      <View style={styles.extraInfoRow}>
                        {pet.weight_kg && (
                          <View style={styles.extraInfoItem}>
                            <Ionicons name="scale-outline" size={14} color={colors.textCaption} />
                            <Text style={styles.extraInfoText}>{pet.weight_kg} kg</Text>
                          </View>
                        )}
                        {pet.microchip_number && (
                          <View style={styles.extraInfoItem}>
                            <Ionicons name="hardware-chip-outline" size={14} color={colors.textCaption} />
                            <Text style={styles.extraInfoText}>Chip: {pet.microchip_number}</Text>
                          </View>
                        )}
                      </View>
                    )}

                    {/* Actions */}
                    <View style={styles.actionsRow}>
                      <TouchableOpacity
                        style={styles.deleteButton}
                        onPress={() => handleDelete(pet.id, pet.name)}
                        disabled={isDeleting}
                      >
                        {isDeleting ? (
                          <ActivityIndicator size={16} color={colors.danger} />
                        ) : (
                          <Ionicons name="trash-outline" size={18} color={colors.danger} />
                        )}
                      </TouchableOpacity>
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

  // Pet List
  petList: {
    gap: spacing.xl,
  },

  // Pet Card
  petCard: {
    borderRadius: borderRadius['3xl'],
    padding: spacing.cardPadding,
    overflow: 'hidden',
  },
  serviceBadgeContainer: {
    position: 'absolute',
    top: spacing.xl,
    right: spacing.xl,
    zIndex: 1,
  },
  serviceBadge: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
  },
  serviceBadgeText: {
    fontFamily: fonts.bold,
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },

  // Pet Info
  petInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xl,
    marginBottom: spacing.xl,
  },
  petIconBox: {
    width: 56,
    height: 56,
    borderRadius: borderRadius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  petDetails: {
    flex: 1,
    paddingRight: 80,
  },
  petName: {
    fontFamily: fonts.bold,
    fontSize: 18,
    color: colors.textPrimary,
  },
  petSpecies: {
    fontFamily: fonts.bold,
    fontSize: 12,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  petMeta: {
    fontFamily: fonts.medium,
    fontSize: 14,
    color: colors.textMuted,
    marginTop: 2,
  },

  // Extra Info
  extraInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing['3xl'],
    paddingVertical: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  extraInfoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  extraInfoText: {
    fontFamily: fonts.bold,
    fontSize: 12,
    color: colors.textSecondary,
  },

  // Actions
  actionsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingTop: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
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
