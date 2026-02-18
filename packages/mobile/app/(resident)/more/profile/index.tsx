import { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Image,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Modal,
} from 'react-native';
import { showAlert } from '@/lib/alert';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/hooks/useAuth';
import { useResidentProfile, useUpdateProfile, useUpdateEmergencyContact } from '@/hooks/useProfile';
import { useResidentUnit } from '@/hooks/useOccupancy';
import { AmbientBackground } from '@/components/ui/AmbientBackground';
import { pickAndUploadImage } from '@/lib/upload';
import { supabase } from '@/lib/supabase';
import { colors, fonts, spacing, borderRadius, shadows } from '@/theme';

interface EmergencyContactForm {
  id?: string;
  contact_name: string;
  phone_primary: string;
  relationship: string;
}

const EMPTY_CONTACT: EmergencyContactForm = {
  contact_name: '',
  phone_primary: '',
  relationship: '',
};

export default function ProfileScreen() {
  const router = useRouter();
  const { communityId, residentId } = useAuth();
  const { data: profile, isLoading: profileLoading } = useResidentProfile();
  const { unitId, unitNumber, building, floorNumber } = useResidentUnit();
  const updateProfile = useUpdateProfile();
  const updateContact = useUpdateEmergencyContact();

  // Phone editing state
  const [phone, setPhone] = useState<string | null>(null);
  const [phoneSecondary, setPhoneSecondary] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  // Emergency contact modal state
  const [showContactModal, setShowContactModal] = useState(false);
  const [contactForm, setContactForm] = useState<EmergencyContactForm>(EMPTY_CONTACT);

  // Stats counts
  const [vehicleCount, setVehicleCount] = useState<number | null>(null);
  const [petCount, setPetCount] = useState<number | null>(null);
  const [docCount, setDocCount] = useState<number | null>(null);

  // Community name
  const [communityName, setCommunityName] = useState<string | null>(null);

  // Housemates (co-residents in the same unit)
  interface Housemate {
    id: string;
    first_name: string;
    paternal_surname: string;
    photo_url: string | null;
    occupancy_type: string;
  }
  const [housemates, setHousemates] = useState<Housemate[]>([]);

  // Fetch stats + community name
  useEffect(() => {
    if (!residentId || !communityId) return;

    supabase
      .from('vehicles')
      .select('id', { count: 'exact', head: true })
      .eq('resident_id', residentId)
      .is('deleted_at', null)
      .then(({ count }) => setVehicleCount(count ?? 0));

    supabase
      .from('pets')
      .select('id', { count: 'exact', head: true })
      .eq('resident_id', residentId)
      .is('deleted_at', null)
      .then(({ count }) => setPetCount(count ?? 0));

    supabase
      .from('documents')
      .select('id', { count: 'exact', head: true })
      .eq('community_id', communityId)
      .then(({ count }) => setDocCount(count ?? 0));

    supabase
      .from('communities')
      .select('name')
      .eq('id', communityId)
      .single()
      .then(({ data }) => setCommunityName(data?.name ?? null));
  }, [residentId, communityId]);

  // Fetch housemates when we know the unit
  useEffect(() => {
    if (!unitId || !residentId) return;

    supabase
      .from('occupancies')
      .select('resident_id, occupancy_type, residents(id, first_name, paternal_surname, photo_url)')
      .eq('unit_id', unitId)
      .eq('status', 'active')
      .is('deleted_at', null)
      .neq('resident_id', residentId)
      .then(({ data }) => {
        if (!data) return;
        const mates = data
          .filter((o: any) => o.residents)
          .map((o: any) => ({
            id: o.residents.id,
            first_name: o.residents.first_name,
            paternal_surname: o.residents.paternal_surname,
            photo_url: o.residents.photo_url,
            occupancy_type: o.occupancy_type,
          }));
        setHousemates(mates);
      });
  }, [unitId, residentId]);

  // Derive display values
  const displayPhone = phone ?? profile?.phone ?? '';
  const displayPhoneSecondary = phoneSecondary ?? profile?.phone_secondary ?? '';
  const fullName = profile
    ? [profile.first_name, profile.paternal_surname, profile.maternal_surname].filter(Boolean).join(' ')
    : '';

  const isVerified =
    profile?.onboarding_status === 'verified' ||
    profile?.onboarding_status === 'active' ||
    profile?.onboarding_status === 'registered';

  const getInitials = useCallback(() => {
    if (!profile) return '';
    const first = profile.first_name?.charAt(0) ?? '';
    const last = profile.paternal_surname?.charAt(0) ?? '';
    return (first + last).toUpperCase();
  }, [profile]);

  const unitInfo = [building, floorNumber != null ? `Floor ${floorNumber}` : null, unitNumber ? `#${unitNumber}` : null]
    .filter(Boolean)
    .join(', ');

  // ── Handlers ──────────────────────────────────────────────────

  const handleChangePhoto = async () => {
    if (!communityId) return;
    setUploadingPhoto(true);
    try {
      const path = await pickAndUploadImage('avatars', communityId, 'profile');
      if (path) {
        await updateProfile.mutateAsync({ photo_url: path });
      }
    } catch (err: any) {
      showAlert('Error', err?.message ?? 'Failed to upload photo.');
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleToggleEditing = () => {
    if (isEditing) {
      setIsEditing(false);
      setPhone(null);
      setPhoneSecondary(null);
    } else {
      setPhone(profile?.phone ?? '');
      setPhoneSecondary(profile?.phone_secondary ?? '');
      setIsEditing(true);
    }
  };

  const handleSave = async () => {
    try {
      const updates: { phone?: string; phone_secondary?: string } = {};
      if (phone !== null && phone !== profile?.phone) updates.phone = phone;
      if (phoneSecondary !== null && phoneSecondary !== profile?.phone_secondary) updates.phone_secondary = phoneSecondary;

      if (Object.keys(updates).length > 0) {
        await updateProfile.mutateAsync(updates);
      }
      setIsEditing(false);
      setPhone(null);
      setPhoneSecondary(null);
      showAlert('Saved', 'Profile updated successfully.');
    } catch (err: any) {
      showAlert('Error', err?.message ?? 'Failed to update profile.');
    }
  };

  const handleOpenAddContact = () => {
    setContactForm(EMPTY_CONTACT);
    setShowContactModal(true);
  };

  const handleOpenEditContact = (contact: { id: string; contact_name: string; phone_primary: string; relationship: string | null }) => {
    setContactForm({
      id: contact.id,
      contact_name: contact.contact_name,
      phone_primary: contact.phone_primary,
      relationship: contact.relationship ?? '',
    });
    setShowContactModal(true);
  };

  const handleSaveContact = async () => {
    if (!contactForm.contact_name.trim()) {
      showAlert('Required', 'Please enter the contact name.');
      return;
    }
    if (!contactForm.phone_primary.trim()) {
      showAlert('Required', 'Please enter a phone number.');
      return;
    }
    try {
      await updateContact.mutateAsync({
        id: contactForm.id,
        contact_name: contactForm.contact_name.trim(),
        phone_primary: contactForm.phone_primary.trim(),
        relationship: contactForm.relationship.trim() || 'other',
      });
      setShowContactModal(false);
      setContactForm(EMPTY_CONTACT);
    } catch (err: any) {
      showAlert('Error', err?.message ?? 'Failed to save contact.');
    }
  };

  // ── Loading ───────────────────────────────────────────────────

  if (profileLoading) {
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
        <View style={styles.headerLeft}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Ionicons name="chevron-back" size={20} color={colors.textBody} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Profile</Text>
        </View>
        <TouchableOpacity style={styles.editButton} onPress={handleToggleEditing}>
          <Ionicons
            name={isEditing ? 'close' : 'create-outline'}
            size={20}
            color={isEditing ? colors.danger : colors.textMuted}
          />
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={0}
      >
        <ScrollView
          style={styles.flex}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* ── Instagram Hero ─────────────────────────────────── */}
          <View style={styles.heroSection}>
            {/* Avatar with ring */}
            <View style={styles.avatarOuter}>
              <View style={styles.avatarRing}>
                <View style={styles.avatarInner}>
                  {profile?.photo_url ? (
                    <Image source={{ uri: profile.photo_url }} style={styles.avatarImage} />
                  ) : (
                    <Text style={styles.avatarInitials}>{getInitials()}</Text>
                  )}
                </View>
              </View>
              <TouchableOpacity
                style={styles.cameraButton}
                onPress={handleChangePhoto}
                disabled={uploadingPhoto}
                activeOpacity={0.8}
              >
                {uploadingPhoto ? (
                  <ActivityIndicator size={12} color={colors.textOnDark} />
                ) : (
                  <Ionicons name="camera" size={14} color={colors.textOnDark} />
                )}
              </TouchableOpacity>
            </View>

            {/* Name + verified badge */}
            <View style={styles.nameRow}>
              <Text style={styles.heroName} numberOfLines={1}>{fullName}</Text>
              {isVerified && (
                <Ionicons name="checkmark-circle" size={18} color={colors.primary} />
              )}
            </View>

            {/* Subtitle */}
            <Text style={styles.heroSubtitle}>
              Resident{unitNumber ? ` \u00B7 ${unitNumber}` : ''}
            </Text>

            {/* Community name */}
            {communityName && (
              <Text style={styles.heroCommunity}>{communityName}</Text>
            )}
          </View>

          {/* ── Stats Row ──────────────────────────────────────── */}
          <View style={styles.statsRow}>
            <TouchableOpacity
              style={styles.statItem}
              onPress={() => router.push('/(resident)/more/vehicles' as any)}
              activeOpacity={0.6}
            >
              <Text style={styles.statNumber}>{vehicleCount ?? '-'}</Text>
              <Text style={styles.statLabel}>Vehicles</Text>
            </TouchableOpacity>

            <View style={styles.statDivider} />

            <TouchableOpacity
              style={styles.statItem}
              onPress={() => router.push('/(resident)/more/pets' as any)}
              activeOpacity={0.6}
            >
              <Text style={styles.statNumber}>{petCount ?? '-'}</Text>
              <Text style={styles.statLabel}>Pets</Text>
            </TouchableOpacity>

            <View style={styles.statDivider} />

            <TouchableOpacity
              style={styles.statItem}
              onPress={() => router.push('/(resident)/more/documents' as any)}
              activeOpacity={0.6}
            >
              <Text style={styles.statNumber}>{docCount ?? '-'}</Text>
              <Text style={styles.statLabel}>Documents</Text>
            </TouchableOpacity>
          </View>

          {/* ── Action Button ──────────────────────────────────── */}
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => router.push('/(resident)/more/profile/unit' as any)}
            activeOpacity={0.7}
          >
            <Ionicons name="home-outline" size={16} color={colors.textSecondary} />
            <Text style={styles.actionButtonText}>My Unit</Text>
          </TouchableOpacity>

          {/* ── Contact Info (read-only) ───────────────────────── */}
          <View style={styles.sectionGroup}>
            <Text style={styles.sectionHeader}>CONTACT INFO</Text>
            <View style={styles.infoCard}>
              {/* Email */}
              <View style={styles.contactRow}>
                <View style={[styles.contactIcon, { backgroundColor: colors.primaryLight }]}>
                  <Ionicons name="mail-outline" size={16} color={colors.primary} />
                </View>
                <Text style={styles.contactText} numberOfLines={1}>
                  {profile?.email ?? 'Not set'}
                </Text>
              </View>

              <View style={styles.contactDivider} />

              {/* Phone */}
              <View style={styles.contactRow}>
                <View style={[styles.contactIcon, { backgroundColor: colors.successBg }]}>
                  <Ionicons name="call-outline" size={16} color={colors.successText} />
                </View>
                <Text style={styles.contactText} numberOfLines={1}>
                  {profile?.phone || 'No phone set'}
                </Text>
              </View>

              {/* Unit Address */}
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

          {/* ── Editable Phone Fields ──────────────────────────── */}
          {isEditing && (
            <View style={styles.sectionGroup}>
              <Text style={styles.sectionHeader}>EDIT PHONE NUMBERS</Text>
              <View style={styles.infoCard}>
                {/* Phone */}
                <View style={styles.editRow}>
                  <View style={styles.editIconBox}>
                    <Ionicons name="call-outline" size={18} color={colors.textCaption} />
                  </View>
                  <View style={styles.editTextGroup}>
                    <Text style={styles.editLabel}>Phone Number</Text>
                    <TextInput
                      style={styles.editInput}
                      value={displayPhone}
                      onChangeText={setPhone}
                      keyboardType="phone-pad"
                      placeholder="+1 (555) 123-4567"
                      placeholderTextColor={colors.textDisabled}
                    />
                  </View>
                </View>

                <View style={styles.editDivider} />

                {/* Phone Secondary */}
                <View style={styles.editRow}>
                  <View style={styles.editIconBox}>
                    <Ionicons name="call-outline" size={18} color={colors.textCaption} />
                  </View>
                  <View style={styles.editTextGroup}>
                    <Text style={styles.editLabel}>Secondary Phone</Text>
                    <TextInput
                      style={styles.editInput}
                      value={displayPhoneSecondary}
                      onChangeText={setPhoneSecondary}
                      keyboardType="phone-pad"
                      placeholder="+1 (555) 000-0000"
                      placeholderTextColor={colors.textDisabled}
                    />
                  </View>
                </View>
              </View>

              {/* Save / Cancel */}
              <TouchableOpacity
                style={[styles.saveButton, updateProfile.isPending && styles.saveButtonDisabled]}
                onPress={handleSave}
                disabled={updateProfile.isPending}
                activeOpacity={0.9}
              >
                {updateProfile.isPending ? (
                  <ActivityIndicator color={colors.textOnDark} />
                ) : (
                  <Text style={styles.saveButtonText}>Save Changes</Text>
                )}
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={handleToggleEditing}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* ── Emergency Contacts ─────────────────────────────── */}
          <View style={styles.sectionGroup}>
            <Text style={styles.sectionHeader}>EMERGENCY CONTACTS</Text>
            <View style={styles.infoCard}>
              {(profile?.emergencyContacts ?? []).map((contact, idx) => (
                <View key={contact.id}>
                  {idx > 0 && <View style={styles.editDivider} />}
                  <TouchableOpacity
                    style={styles.editRow}
                    onPress={() => handleOpenEditContact(contact)}
                  >
                    <View style={styles.emergencyIconBox}>
                      <Ionicons name="heart" size={18} color={colors.danger} />
                    </View>
                    <View style={styles.editTextGroup}>
                      <Text style={styles.editLabel}>
                        {contact.relationship ?? 'Contact'}
                      </Text>
                      <Text style={styles.editValue}>
                        {contact.contact_name}
                      </Text>
                      <Text style={styles.emergencyPhone}>
                        {contact.phone_primary}
                      </Text>
                    </View>
                    <Ionicons name="create-outline" size={18} color={colors.primary} />
                  </TouchableOpacity>
                </View>
              ))}

              {/* Add Contact Button */}
              <View style={styles.addContactContainer}>
                <TouchableOpacity
                  style={styles.addContactButton}
                  onPress={handleOpenAddContact}
                >
                  <Ionicons name="add" size={18} color={colors.textCaption} />
                  <Text style={styles.addContactText}>Add Emergency Contact</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>

          {/* ── Housemates (co-residents) ──────────────────────── */}
          <View style={styles.sectionGroup}>
            <Text style={styles.sectionHeader}>
              {unitNumber ? `WHO LIVES IN ${unitNumber.toUpperCase()}` : 'HOUSEMATES'}
            </Text>
            <View style={styles.infoCard}>
              {/* Current user (self) */}
              <View style={styles.housemateRow}>
                <View style={styles.housemateAvatar}>
                  {profile?.photo_url ? (
                    <Image source={{ uri: profile.photo_url }} style={styles.housemateAvatarImg} />
                  ) : (
                    <Text style={styles.housemateInitials}>{getInitials()}</Text>
                  )}
                </View>
                <View style={styles.housemateInfo}>
                  <Text style={styles.housemateName}>{fullName}</Text>
                  <Text style={styles.housemateRole}>You</Text>
                </View>
                {isVerified && (
                  <Ionicons name="checkmark-circle" size={16} color={colors.primary} />
                )}
              </View>

              {/* Other residents */}
              {housemates.map((mate) => {
                const mateInitials = (
                  (mate.first_name?.charAt(0) ?? '') +
                  (mate.paternal_surname?.charAt(0) ?? '')
                ).toUpperCase();
                const roleLabel =
                  mate.occupancy_type === 'owner' ? 'Owner' :
                  mate.occupancy_type === 'tenant' ? 'Tenant' :
                  mate.occupancy_type === 'authorized' ? 'Authorized' :
                  mate.occupancy_type === 'employee' ? 'Employee' : mate.occupancy_type;
                return (
                  <View key={mate.id}>
                    <View style={styles.editDivider} />
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
                        <Text style={styles.housemateRole}>{roleLabel}</Text>
                      </View>
                    </View>
                  </View>
                );
              })}

              {housemates.length === 0 && (
                <>
                  <View style={styles.editDivider} />
                  <View style={styles.emptyHousemates}>
                    <Ionicons name="people-outline" size={20} color={colors.textDisabled} />
                    <Text style={styles.emptyHousematesText}>
                      You're the only registered resident
                    </Text>
                  </View>
                </>
              )}
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Emergency Contact Modal */}
      <Modal
        visible={showContactModal}
        animationType="slide"
        transparent
        onRequestClose={() => setShowContactModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>
              {contactForm.id ? 'Edit Contact' : 'New Emergency Contact'}
            </Text>

            <View style={styles.modalFields}>
              <View style={styles.modalFieldGroup}>
                <Text style={styles.modalFieldLabel}>Contact Name</Text>
                <View style={styles.modalInputWrapper}>
                  <TextInput
                    style={styles.modalInput}
                    value={contactForm.contact_name}
                    onChangeText={(v) => setContactForm((f) => ({ ...f, contact_name: v }))}
                    placeholder="e.g. Maria Rodriguez"
                    placeholderTextColor={colors.textDisabled}
                    autoCapitalize="words"
                  />
                </View>
              </View>

              <View style={styles.modalFieldGroup}>
                <Text style={styles.modalFieldLabel}>Phone Number</Text>
                <View style={styles.modalInputWrapper}>
                  <TextInput
                    style={styles.modalInput}
                    value={contactForm.phone_primary}
                    onChangeText={(v) => setContactForm((f) => ({ ...f, phone_primary: v }))}
                    placeholder="+1 (555) 000-0000"
                    placeholderTextColor={colors.textDisabled}
                    keyboardType="phone-pad"
                  />
                </View>
              </View>

              <View style={styles.modalFieldGroup}>
                <Text style={styles.modalFieldLabel}>Relationship</Text>
                <View style={styles.modalInputWrapper}>
                  <TextInput
                    style={styles.modalInput}
                    value={contactForm.relationship}
                    onChangeText={(v) => setContactForm((f) => ({ ...f, relationship: v }))}
                    placeholder="e.g. Spouse, Parent, Sibling"
                    placeholderTextColor={colors.textDisabled}
                    autoCapitalize="words"
                  />
                </View>
              </View>
            </View>

            <TouchableOpacity
              style={[styles.modalSaveButton, updateContact.isPending && styles.saveButtonDisabled]}
              onPress={handleSaveContact}
              disabled={updateContact.isPending}
              activeOpacity={0.9}
            >
              {updateContact.isPending ? (
                <ActivityIndicator color={colors.textOnDark} />
              ) : (
                <Text style={styles.modalSaveButtonText}>
                  {contactForm.id ? 'Update Contact' : 'Add Contact'}
                </Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.modalCancelButton}
              onPress={() => setShowContactModal(false)}
            >
              <Text style={styles.modalCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
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
    fontSize: 30,
    color: colors.textPrimary,
    letterSpacing: -0.5,
  },
  editButton: {
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

  // Scroll
  scrollContent: {
    paddingHorizontal: spacing.pagePaddingX,
    paddingBottom: spacing.bottomNavClearance + 20,
    gap: spacing['3xl'],
  },

  // ── Instagram Hero ────────────────────────────────────────
  heroSection: {
    alignItems: 'center',
    paddingTop: spacing.xl,
    paddingBottom: spacing.md,
  },
  avatarOuter: {
    position: 'relative',
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
  cameraButton: {
    position: 'absolute',
    bottom: 0,
    right: -2,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: colors.background,
    ...shadows.md,
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

  // ── Stats Row ─────────────────────────────────────────────
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
  statDivider: {
    width: 1,
    height: 32,
    backgroundColor: colors.border,
  },

  // ── Action Button ─────────────────────────────────────────
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    height: 44,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.borderMedium,
    ...shadows.sm,
  },
  actionButtonText: {
    fontFamily: fonts.bold,
    fontSize: 13,
    color: colors.textSecondary,
  },

  // ── Sections ──────────────────────────────────────────────
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

  // ── Info / Contact Card ───────────────────────────────────
  infoCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.xl,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
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

  // ── Editable rows ─────────────────────────────────────────
  editRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xl,
    padding: spacing.xl,
  },
  editDivider: {
    height: 1,
    backgroundColor: colors.border,
    marginHorizontal: spacing.xl,
  },
  editIconBox: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.md,
    backgroundColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emergencyIconBox: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.md,
    backgroundColor: colors.dangerBgLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  editTextGroup: {
    flex: 1,
  },
  editLabel: {
    fontFamily: fonts.medium,
    fontSize: 12,
    color: colors.textCaption,
  },
  editValue: {
    fontFamily: fonts.bold,
    fontSize: 14,
    color: colors.textSecondary,
  },
  editInput: {
    fontFamily: fonts.bold,
    fontSize: 14,
    color: colors.textPrimary,
    padding: 0,
    margin: 0,
    height: 22,
  },
  emergencyPhone: {
    fontFamily: fonts.medium,
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 2,
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
  emptyHousemates: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.xl,
  },
  emptyHousematesText: {
    fontFamily: fonts.medium,
    fontSize: 13,
    color: colors.textCaption,
  },

  // Add Contact
  addContactContainer: {
    padding: spacing.xl,
  },
  addContactButton: {
    width: '100%',
    height: 44,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
  },
  addContactText: {
    fontFamily: fonts.bold,
    fontSize: 12,
    color: colors.textCaption,
  },

  // Save / Cancel
  saveButton: {
    height: spacing.buttonHeight,
    backgroundColor: colors.primary,
    borderRadius: borderRadius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.blueGlow,
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    fontFamily: fonts.bold,
    fontSize: 18,
    color: colors.textOnDark,
  },
  cancelButton: {
    height: spacing.smallButtonHeight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButtonText: {
    fontFamily: fonts.bold,
    fontSize: 14,
    color: colors.textMuted,
  },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: borderRadius['5xl'],
    borderTopRightRadius: borderRadius['5xl'],
    paddingHorizontal: spacing.pagePaddingX,
    paddingTop: spacing['4xl'],
    paddingBottom: spacing['6xl'],
  },
  modalHandle: {
    width: 48,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.borderMedium,
    alignSelf: 'center',
    marginBottom: spacing['4xl'],
  },
  modalTitle: {
    fontFamily: fonts.bold,
    fontSize: 24,
    color: colors.textPrimary,
    marginBottom: spacing['3xl'],
  },
  modalFields: {
    gap: spacing.xl,
  },
  modalFieldGroup: {
    gap: spacing.xs,
  },
  modalFieldLabel: {
    fontFamily: fonts.bold,
    fontSize: 10,
    color: colors.textCaption,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    marginLeft: 4,
  },
  modalInputWrapper: {
    backgroundColor: colors.border,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.borderMedium,
    paddingHorizontal: spacing.xl,
    height: spacing.inputHeight,
    justifyContent: 'center',
  },
  modalInput: {
    fontFamily: fonts.bold,
    fontSize: 15,
    color: colors.textPrimary,
  },
  modalSaveButton: {
    height: spacing.buttonHeight,
    backgroundColor: colors.primary,
    borderRadius: borderRadius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing['3xl'],
    ...shadows.blueGlow,
  },
  modalSaveButtonText: {
    fontFamily: fonts.bold,
    fontSize: 18,
    color: colors.textOnDark,
  },
  modalCancelButton: {
    height: spacing.smallButtonHeight,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.md,
  },
  modalCancelText: {
    fontFamily: fonts.bold,
    fontSize: 14,
    color: colors.textMuted,
  },
});
