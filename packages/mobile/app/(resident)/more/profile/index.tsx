import { useState, useCallback } from 'react';
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
import { GlassCard } from '@/components/ui/GlassCard';
import { pickAndUploadImage } from '@/lib/upload';
import { colors, fonts, spacing, borderRadius, shadows, typography } from '@/theme';

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
  const { communityId } = useAuth();
  const { data: profile, isLoading: profileLoading } = useResidentProfile();
  const { unitNumber, building, floorNumber } = useResidentUnit();
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

  // Derive display values
  const displayPhone = phone ?? profile?.phone ?? '';
  const displayPhoneSecondary = phoneSecondary ?? profile?.phone_secondary ?? '';
  const fullName = profile
    ? [profile.first_name, profile.paternal_surname, profile.maternal_surname].filter(Boolean).join(' ')
    : '';

  const getInitials = useCallback(() => {
    if (!profile) return '';
    const first = profile.first_name?.charAt(0) ?? '';
    const last = profile.paternal_surname?.charAt(0) ?? '';
    return (first + last).toUpperCase();
  }, [profile]);

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

  const handleStartEditing = () => {
    setPhone(profile?.phone ?? '');
    setPhoneSecondary(profile?.phone_secondary ?? '');
    setIsEditing(true);
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

  // Unit info text
  const unitInfo = [building, floorNumber != null ? `Floor ${floorNumber}` : null, unitNumber ? `#${unitNumber}` : null]
    .filter(Boolean)
    .join(', ');

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
        {!isEditing ? (
          <TouchableOpacity style={styles.settingsButton} onPress={handleStartEditing}>
            <Ionicons name="create-outline" size={20} color={colors.textMuted} />
          </TouchableOpacity>
        ) : null}
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
          {/* User Hero Card */}
          <GlassCard style={styles.heroCard}>
            <View style={styles.heroOrbDecor} />
            <View style={styles.heroContent}>
              <View style={styles.avatarWrapper}>
                <View style={styles.avatarContainer}>
                  {profile?.photo_url ? (
                    <Image source={{ uri: profile.photo_url }} style={styles.avatarImage} />
                  ) : (
                    <Text style={styles.avatarInitials}>{getInitials()}</Text>
                  )}
                </View>
                <TouchableOpacity
                  style={styles.cameraButton}
                  onPress={handleChangePhoto}
                  disabled={uploadingPhoto}
                >
                  {uploadingPhoto ? (
                    <ActivityIndicator size={12} color={colors.textOnDark} />
                  ) : (
                    <Ionicons name="camera" size={14} color={colors.textOnDark} />
                  )}
                </TouchableOpacity>
              </View>
              <View style={styles.heroInfo}>
                <Text style={styles.heroName}>{fullName}</Text>
                <Text style={styles.heroSubtitle}>
                  Resident{unitNumber ? ` \u2022 Unit ${unitNumber}` : ''}
                </Text>
                <View style={styles.badgeRow}>
                  {(profile?.onboarding_status === 'verified' || profile?.onboarding_status === 'active') && (
                    <View style={styles.badgeGreen}>
                      <Text style={styles.badgeGreenText}>Verified</Text>
                    </View>
                  )}
                </View>
              </View>
            </View>
          </GlassCard>

          {/* Personal Details */}
          <View style={styles.sectionGroup}>
            <Text style={styles.sectionHeader}>Personal Details</Text>
            <View style={styles.infoCard}>
              {/* Phone */}
              <TouchableOpacity
                style={styles.infoRow}
                onPress={isEditing ? undefined : handleStartEditing}
                disabled={isEditing}
              >
                <View style={styles.infoIconBox}>
                  <Ionicons name="call-outline" size={18} color={colors.textCaption} />
                </View>
                <View style={styles.infoTextGroup}>
                  <Text style={styles.infoLabel}>Phone Number</Text>
                  {isEditing ? (
                    <TextInput
                      style={styles.infoValueInput}
                      value={displayPhone}
                      onChangeText={setPhone}
                      keyboardType="phone-pad"
                      placeholder="+1 (555) 123-4567"
                      placeholderTextColor={colors.textDisabled}
                    />
                  ) : (
                    <Text style={styles.infoValue}>{displayPhone || 'Not set'}</Text>
                  )}
                </View>
                {!isEditing && (
                  <Ionicons name="chevron-forward" size={16} color={colors.textDisabled} />
                )}
              </TouchableOpacity>

              <View style={styles.infoRowDivider} />

              {/* Phone Secondary */}
              <View style={styles.infoRow}>
                <View style={styles.infoIconBox}>
                  <Ionicons name="call-outline" size={18} color={colors.textCaption} />
                </View>
                <View style={styles.infoTextGroup}>
                  <Text style={styles.infoLabel}>Secondary Phone</Text>
                  {isEditing ? (
                    <TextInput
                      style={styles.infoValueInput}
                      value={displayPhoneSecondary}
                      onChangeText={setPhoneSecondary}
                      keyboardType="phone-pad"
                      placeholder="+1 (555) 000-0000"
                      placeholderTextColor={colors.textDisabled}
                    />
                  ) : (
                    <Text style={styles.infoValue}>{displayPhoneSecondary || 'Not set'}</Text>
                  )}
                </View>
              </View>

              <View style={styles.infoRowDivider} />

              {/* Email (read-only) */}
              <View style={styles.infoRow}>
                <View style={styles.infoIconBox}>
                  <Ionicons name="mail-outline" size={18} color={colors.textCaption} />
                </View>
                <View style={styles.infoTextGroup}>
                  <Text style={styles.infoLabel}>Email Address</Text>
                  <Text style={styles.infoValue}>{profile?.email ?? 'Not set'}</Text>
                </View>
              </View>

              <View style={styles.infoRowDivider} />

              {/* Unit Info */}
              <TouchableOpacity
                style={styles.infoRow}
                onPress={() => router.push('/(resident)/more/profile/unit')}
              >
                <View style={styles.infoIconBox}>
                  <Ionicons name="business-outline" size={18} color={colors.textCaption} />
                </View>
                <View style={styles.infoTextGroup}>
                  <Text style={styles.infoLabel}>Unit Information</Text>
                  <Text style={styles.infoValue}>{unitInfo || 'Loading...'}</Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color={colors.textDisabled} />
              </TouchableOpacity>
            </View>
          </View>

          {/* Emergency Contacts */}
          <View style={styles.sectionGroup}>
            <Text style={styles.sectionHeader}>Emergency Contacts</Text>
            <View style={styles.infoCard}>
              {(profile?.emergencyContacts ?? []).map((contact, idx) => (
                <View key={contact.id}>
                  {idx > 0 && <View style={styles.infoRowDivider} />}
                  <TouchableOpacity
                    style={styles.infoRow}
                    onPress={() => handleOpenEditContact(contact)}
                  >
                    <View style={styles.emergencyIconBox}>
                      <Ionicons name="heart" size={18} color={colors.danger} />
                    </View>
                    <View style={styles.infoTextGroup}>
                      <Text style={styles.infoLabel}>
                        {contact.relationship ?? 'Contact'}
                      </Text>
                      <Text style={styles.infoValue}>
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

          {/* Save Button (visible only when editing) */}
          {isEditing && (
            <View style={styles.saveSection}>
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
                onPress={() => {
                  setIsEditing(false);
                  setPhone(null);
                  setPhoneSecondary(null);
                }}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          )}
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
  settingsButton: {
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

  // Hero Card
  heroCard: {
    borderRadius: borderRadius['2xl'],
    padding: spacing['3xl'],
    overflow: 'hidden',
  },
  heroOrbDecor: {
    position: 'absolute',
    top: -16,
    right: -16,
    width: 128,
    height: 128,
    borderRadius: 64,
    backgroundColor: 'rgba(37,99,235,0.05)',
  },
  heroContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.cardPadding,
  },
  avatarWrapper: {
    position: 'relative',
  },
  avatarContainer: {
    width: 80,
    height: 80,
    borderRadius: borderRadius.xl,
    backgroundColor: colors.border,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.md,
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  avatarInitials: {
    fontFamily: fonts.bold,
    fontSize: 28,
    color: colors.textCaption,
  },
  cameraButton: {
    position: 'absolute',
    bottom: -4,
    right: -4,
    width: 32,
    height: 32,
    borderRadius: borderRadius.full,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.surface,
    ...shadows.lg,
  },
  heroInfo: {
    flex: 1,
  },
  heroName: {
    fontFamily: fonts.bold,
    fontSize: 20,
    color: colors.textPrimary,
    letterSpacing: -0.5,
  },
  heroSubtitle: {
    fontFamily: fonts.medium,
    fontSize: 14,
    color: colors.textMuted,
    marginBottom: spacing.md,
  },
  badgeRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  badgeGreen: {
    paddingHorizontal: spacing.md,
    paddingVertical: 2,
    backgroundColor: colors.successBg,
    borderRadius: borderRadius.sm,
  },
  badgeGreenText: {
    fontFamily: fonts.bold,
    fontSize: 10,
    color: colors.successText,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },

  // Section Group
  sectionGroup: {
    gap: spacing.lg,
  },
  sectionHeader: {
    fontFamily: fonts.bold,
    fontSize: 12,
    color: colors.textCaption,
    textTransform: 'uppercase',
    letterSpacing: 2,
    marginLeft: 4,
  },

  // Info Card
  infoCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.xl,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xl,
    padding: spacing.xl,
  },
  infoRowDivider: {
    height: 1,
    backgroundColor: colors.border,
    marginHorizontal: spacing.xl,
  },
  infoIconBox: {
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
  infoTextGroup: {
    flex: 1,
  },
  infoLabel: {
    fontFamily: fonts.medium,
    fontSize: 12,
    color: colors.textCaption,
  },
  infoValue: {
    fontFamily: fonts.bold,
    fontSize: 14,
    color: colors.textSecondary,
  },
  infoValueInput: {
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

  // Save Section
  saveSection: {
    gap: spacing.lg,
  },
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
