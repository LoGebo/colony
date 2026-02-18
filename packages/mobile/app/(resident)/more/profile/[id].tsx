import { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Image,
  ActivityIndicator,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/hooks/useAuth';
import { AmbientBackground } from '@/components/ui/AmbientBackground';
import { supabase } from '@/lib/supabase';
import { colors, fonts, spacing, borderRadius, shadows } from '@/theme';

// ── Types ───────────────────────────────────────────────────────
interface ResidentProfile {
  id: string;
  first_name: string;
  paternal_surname: string;
  maternal_surname: string | null;
  email: string;
  phone: string | null;
  photo_url: string | null;
  onboarding_status: string;
}

interface OccupancyInfo {
  occupancy_type: string;
  unit_number: string;
  building: string | null;
  floor_number: number | null;
}

interface Housemate {
  id: string;
  first_name: string;
  paternal_surname: string;
  photo_url: string | null;
  occupancy_type: string;
}

// ── Component ──────────────────────────────────────────────────
export default function ResidentProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { communityId, residentId: myResidentId } = useAuth();

  const [resident, setResident] = useState<ResidentProfile | null>(null);
  const [occupancy, setOccupancy] = useState<OccupancyInfo | null>(null);
  const [housemates, setHousemates] = useState<Housemate[]>([]);
  const [communityName, setCommunityName] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Stats (only pets — vehicles & documents are private)
  const [petCount, setPetCount] = useState<number | null>(null);

  // Fetch resident data
  useEffect(() => {
    if (!id || !communityId) return;

    const fetchAll = async () => {
      setIsLoading(true);

      // Resident profile
      const { data: res } = await supabase
        .from('residents')
        .select('id, first_name, paternal_surname, maternal_surname, email, phone, photo_url, onboarding_status')
        .eq('id', id)
        .eq('community_id', communityId)
        .is('deleted_at', null)
        .single();

      if (res) setResident(res);

      // Occupancy + unit info
      const { data: occ } = await supabase
        .from('occupancies')
        .select('occupancy_type, units(unit_number, building, floor_number)')
        .eq('resident_id', id)
        .eq('status', 'active')
        .is('deleted_at', null)
        .limit(1)
        .single();

      if (occ) {
        const unit = (occ as any).units;
        setOccupancy({
          occupancy_type: occ.occupancy_type,
          unit_number: unit?.unit_number ?? '',
          building: unit?.building ?? null,
          floor_number: unit?.floor_number ?? null,
        });

        // Housemates in same unit
        if (unit) {
          const { data: unitOcc } = await supabase
            .from('occupancies')
            .select('occupancy_type, units!inner(id), residents(id, first_name, paternal_surname, photo_url)')
            .eq('units.unit_number', unit.unit_number)
            .eq('status', 'active')
            .is('deleted_at', null)
            .neq('resident_id', id);

          if (unitOcc) {
            setHousemates(
              unitOcc
                .filter((o: any) => o.residents)
                .map((o: any) => ({
                  id: o.residents.id,
                  first_name: o.residents.first_name,
                  paternal_surname: o.residents.paternal_surname,
                  photo_url: o.residents.photo_url,
                  occupancy_type: o.occupancy_type,
                })),
            );
          }
        }
      }

      // Stats (only pets — vehicles & documents are private)
      supabase
        .from('pets')
        .select('id', { count: 'exact', head: true })
        .eq('resident_id', id)
        .is('deleted_at', null)
        .then(({ count }) => setPetCount(count ?? 0));

      // Community name
      supabase
        .from('communities')
        .select('name')
        .eq('id', communityId)
        .single()
        .then(({ data }) => setCommunityName(data?.name ?? null));

      setIsLoading(false);
    };

    fetchAll();
  }, [id, communityId]);

  // Derived values
  const fullName = resident
    ? [resident.first_name, resident.paternal_surname, resident.maternal_surname]
        .filter(Boolean)
        .join(' ')
    : '';

  const isVerified =
    resident?.onboarding_status === 'verified' ||
    resident?.onboarding_status === 'active' ||
    resident?.onboarding_status === 'registered';

  const getInitials = useCallback(() => {
    if (!resident) return '';
    return (
      (resident.first_name?.charAt(0) ?? '') +
      (resident.paternal_surname?.charAt(0) ?? '')
    ).toUpperCase();
  }, [resident]);

  const roleLabel =
    occupancy?.occupancy_type === 'owner' ? 'Owner' :
    occupancy?.occupancy_type === 'tenant' ? 'Tenant' :
    occupancy?.occupancy_type === 'authorized' ? 'Authorized' :
    occupancy?.occupancy_type === 'employee' ? 'Employee' :
    'Resident';

  const unitInfo = [
    occupancy?.building,
    occupancy?.floor_number != null ? `Floor ${occupancy.floor_number}` : null,
    occupancy?.unit_number ? `#${occupancy.unit_number}` : null,
  ]
    .filter(Boolean)
    .join(', ');

  const isMe = myResidentId === id;

  // ── Loading ───────────────────────────────────────────────────

  if (isLoading || !resident) {
    return (
      <View style={styles.container}>
        <AmbientBackground />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </View>
    );
  }

  // ── Render ────────────────────────────────────────────────────

  return (
    <View style={styles.container}>
      <AmbientBackground />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={20} color={colors.textBody} />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {resident.first_name}
        </Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        style={styles.flex}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Hero ─────────────────────────────────────────────── */}
        <View style={styles.heroSection}>
          <View style={styles.avatarOuter}>
            <View style={styles.avatarRing}>
              <View style={styles.avatarInner}>
                {resident.photo_url ? (
                  <Image source={{ uri: resident.photo_url }} style={styles.avatarImage} />
                ) : (
                  <Text style={styles.avatarInitials}>{getInitials()}</Text>
                )}
              </View>
            </View>
          </View>

          <View style={styles.nameRow}>
            <Text style={styles.heroName} numberOfLines={1}>{fullName}</Text>
            {isVerified && (
              <Ionicons name="checkmark-circle" size={18} color={colors.primary} />
            )}
          </View>

          <Text style={styles.heroSubtitle}>
            {roleLabel}{occupancy?.unit_number ? ` \u00B7 ${occupancy.unit_number}` : ''}
          </Text>

          {communityName && (
            <Text style={styles.heroCommunity}>{communityName}</Text>
          )}
        </View>

        {/* ── Pets ─────────────────────────────────────────────── */}
        {(petCount ?? 0) > 0 && (
          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>{petCount}</Text>
              <Text style={styles.statLabel}>Pets</Text>
            </View>
          </View>
        )}

        {/* ── Contact Info ─────────────────────────────────────── */}
        <View style={styles.sectionGroup}>
          <Text style={styles.sectionHeader}>CONTACT INFO</Text>
          <View style={styles.infoCard}>
            <View style={styles.contactRow}>
              <View style={[styles.contactIcon, { backgroundColor: colors.primaryLight }]}>
                <Ionicons name="mail-outline" size={16} color={colors.primary} />
              </View>
              <Text style={styles.contactText} numberOfLines={1}>
                {resident.email}
              </Text>
            </View>

            <View style={styles.contactDivider} />

            <View style={styles.contactRow}>
              <View style={[styles.contactIcon, { backgroundColor: colors.successBg }]}>
                <Ionicons name="call-outline" size={16} color={colors.successText} />
              </View>
              <Text style={styles.contactText} numberOfLines={1}>
                {resident.phone || 'No phone set'}
              </Text>
            </View>

            {unitInfo ? (
              <>
                <View style={styles.contactDivider} />
                <View style={styles.contactRow}>
                  <View style={[styles.contactIcon, { backgroundColor: colors.warningBg }]}>
                    <Ionicons name="business-outline" size={16} color={colors.warningText} />
                  </View>
                  <Text style={styles.contactText} numberOfLines={1}>
                    {unitInfo}
                  </Text>
                </View>
              </>
            ) : null}
          </View>
        </View>

        {/* ── Housemates ───────────────────────────────────────── */}
        {(housemates.length > 0 || isMe) && (
          <View style={styles.sectionGroup}>
            <Text style={styles.sectionHeader}>
              {occupancy?.unit_number
                ? `WHO LIVES IN ${occupancy.unit_number.toUpperCase()}`
                : 'HOUSEMATES'}
            </Text>
            <View style={styles.infoCard}>
              {/* This resident */}
              <View style={styles.housemateRow}>
                <View style={styles.housemateAvatar}>
                  {resident.photo_url ? (
                    <Image source={{ uri: resident.photo_url }} style={styles.housemateAvatarImg} />
                  ) : (
                    <Text style={styles.housemateInitials}>{getInitials()}</Text>
                  )}
                </View>
                <View style={styles.housemateInfo}>
                  <Text style={styles.housemateName}>{fullName}</Text>
                  <Text style={styles.housemateRole}>
                    {isMe ? 'You' : roleLabel}
                  </Text>
                </View>
                {isVerified && (
                  <Ionicons name="checkmark-circle" size={16} color={colors.primary} />
                )}
              </View>

              {/* Other residents in same unit */}
              {housemates.map((mate) => {
                const mateInitials = (
                  (mate.first_name?.charAt(0) ?? '') +
                  (mate.paternal_surname?.charAt(0) ?? '')
                ).toUpperCase();
                const mateRole =
                  mate.occupancy_type === 'owner' ? 'Owner' :
                  mate.occupancy_type === 'tenant' ? 'Tenant' :
                  mate.occupancy_type === 'authorized' ? 'Authorized' :
                  mate.occupancy_type === 'employee' ? 'Employee' : mate.occupancy_type;
                const isMateMe = mate.id === myResidentId;

                return (
                  <TouchableOpacity
                    key={mate.id}
                    disabled={isMateMe}
                    onPress={() => {
                      if (!isMateMe) {
                        router.push(`/(resident)/more/profile/${mate.id}` as any);
                      }
                    }}
                    activeOpacity={0.6}
                  >
                    <View style={styles.rowDivider} />
                    <View style={styles.housemateRow}>
                      <View style={styles.housemateAvatar}>
                        {mate.photo_url ? (
                          <Image source={{ uri: mate.photo_url }} style={styles.housemateAvatarImg} />
                        ) : (
                          <Text style={styles.housemateInitials}>{mateInitials}</Text>
                        )}
                      </View>
                      <View style={styles.housemateInfo}>
                        <Text style={styles.housemateName}>
                          {mate.first_name} {mate.paternal_surname}
                        </Text>
                        <Text style={styles.housemateRole}>
                          {isMateMe ? 'You' : mateRole}
                        </Text>
                      </View>
                      {!isMateMe && (
                        <Ionicons name="chevron-forward" size={16} color={colors.textDisabled} />
                      )}
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

// ── Styles ─────────────────────────────────────────────────────
const AVATAR_SIZE = 96;
const RING_SIZE = AVATAR_SIZE + 8;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  flex: { flex: 1 },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: spacing.safeAreaTop,
    paddingHorizontal: spacing.pagePaddingX,
    paddingBottom: spacing.xl,
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
    flex: 1,
    fontFamily: fonts.bold,
    fontSize: 24,
    color: colors.textPrimary,
    letterSpacing: -0.5,
  },
  headerSpacer: { width: 40 },

  // Scroll
  scrollContent: {
    paddingHorizontal: spacing.pagePaddingX,
    paddingBottom: spacing.bottomNavClearance + 20,
    gap: spacing['3xl'],
  },

  // Hero
  heroSection: {
    alignItems: 'center',
    paddingTop: spacing.xl,
    paddingBottom: spacing.md,
  },
  avatarOuter: {
    marginBottom: spacing.xl,
  },
  avatarRing: {
    width: RING_SIZE,
    height: RING_SIZE,
    borderRadius: RING_SIZE / 2,
    padding: 4,
    borderWidth: 2.5,
    borderColor: colors.primary,
  },
  avatarInner: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
    backgroundColor: colors.border,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  avatarInitials: {
    fontFamily: fonts.bold,
    fontSize: 34,
    color: colors.textCaption,
  },

  // Name area
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  heroName: {
    fontFamily: fonts.bold,
    fontSize: 22,
    color: colors.textPrimary,
    letterSpacing: -0.5,
  },
  heroSubtitle: {
    fontFamily: fonts.medium,
    fontSize: 14,
    color: colors.textMuted,
    marginBottom: 2,
  },
  heroCommunity: {
    fontFamily: fonts.medium,
    fontSize: 13,
    color: colors.textCaption,
  },

  // Stats Row
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: borderRadius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: spacing.xl,
    ...shadows.sm,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statNumber: {
    fontFamily: fonts.bold,
    fontSize: 20,
    color: colors.textPrimary,
  },
  statLabel: {
    fontFamily: fonts.medium,
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 2,
  },

  // Sections
  sectionGroup: {
    gap: spacing.lg,
  },
  sectionHeader: {
    fontFamily: fonts.bold,
    fontSize: 11,
    color: colors.textCaption,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    marginLeft: spacing.xs,
  },

  // Info Card
  infoCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.xl,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.sm,
  },
  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.lg + 2,
    gap: spacing.xl,
  },
  contactIcon: {
    width: 34,
    height: 34,
    borderRadius: borderRadius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  contactText: {
    flex: 1,
    fontFamily: fonts.medium,
    fontSize: 14,
    color: colors.textBody,
  },
  contactDivider: {
    height: 1,
    backgroundColor: colors.border,
    marginLeft: 34 + spacing.xl * 2,
  },

  // Housemates
  housemateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xl,
    padding: spacing.xl,
  },
  housemateAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.border,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  housemateAvatarImg: {
    width: '100%',
    height: '100%',
  },
  housemateInitials: {
    fontFamily: fonts.bold,
    fontSize: 14,
    color: colors.textCaption,
  },
  housemateInfo: {
    flex: 1,
  },
  housemateName: {
    fontFamily: fonts.bold,
    fontSize: 14,
    color: colors.textSecondary,
  },
  housemateRole: {
    fontFamily: fonts.medium,
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 1,
  },
  rowDivider: {
    height: 1,
    backgroundColor: colors.border,
    marginHorizontal: spacing.xl,
  },
});
