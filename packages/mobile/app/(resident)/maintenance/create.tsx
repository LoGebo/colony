import { useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  ScrollView,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Image,
  ActivityIndicator,
} from 'react-native';
import { showAlert } from '@/lib/alert';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/hooks/useAuth';
import { useTicketCategories, useCreateTicket } from '@/hooks/useTickets';
import { pickAndUploadImage } from '@/lib/upload';
import { AmbientBackground } from '@/components/ui/AmbientBackground';
import { colors, fonts, spacing, borderRadius, shadows } from '@/theme';

type Priority = 'low' | 'medium' | 'high' | 'urgent';

const PRIORITIES: { key: Priority; label: string }[] = [
  { key: 'low', label: 'Low' },
  { key: 'medium', label: 'Med' },
  { key: 'high', label: 'High' },
  { key: 'urgent', label: 'Urgent' },
];

function getPriorityColors(priority: Priority, active: boolean) {
  if (!active) {
    return { bg: colors.surface, border: colors.border, text: colors.textCaption };
  }
  switch (priority) {
    case 'low':
      return { bg: colors.border, border: colors.borderMedium, text: colors.textBody };
    case 'medium':
      return { bg: colors.primaryLight, border: colors.primary, text: colors.primary };
    case 'high':
      return { bg: colors.orangeBg, border: colors.orange, text: colors.orange };
    case 'urgent':
      return { bg: colors.dangerBg, border: colors.danger, text: colors.danger };
  }
}

function getCategoryIcon(icon: string | null): string {
  if (!icon) return 'construct-outline';
  const iconMap: Record<string, string> = {
    droplet: 'water-outline',
    zap: 'flash-outline',
    layout: 'grid-outline',
    thermometer: 'thermometer-outline',
    wrench: 'construct-outline',
    shield: 'shield-outline',
    wifi: 'wifi-outline',
    key: 'key-outline',
    home: 'home-outline',
    tree: 'leaf-outline',
    'hard-hat': 'hammer-outline',
    paintbrush: 'brush-outline',
    bug: 'bug-outline',
    car: 'car-outline',
  };
  return iconMap[icon] ?? 'construct-outline';
}

export default function CreateTicketScreen() {
  const router = useRouter();
  const { communityId } = useAuth();
  const { data: categories, isLoading: catLoading } = useTicketCategories();
  const createMutation = useCreateTicket();

  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<Priority>('medium');
  const [location, setLocation] = useState('');
  const [photos, setPhotos] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);

  const canSubmit =
    selectedCategoryId !== null &&
    title.trim().length > 0 &&
    description.trim().length > 0 &&
    !createMutation.isPending;

  const handleAddPhoto = useCallback(async () => {
    if (!communityId || photos.length >= 3) return;
    setUploading(true);
    try {
      const path = await pickAndUploadImage('ticket-attachments', communityId, 'tickets');
      if (path) {
        setPhotos((prev) => [...prev, path]);
      }
    } finally {
      setUploading(false);
    }
  }, [communityId, photos.length]);

  const handleRemovePhoto = useCallback((index: number) => {
    setPhotos((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const handleSubmit = async () => {
    if (!canSubmit || !selectedCategoryId) return;

    try {
      await createMutation.mutateAsync({
        title: title.trim(),
        description: description.trim(),
        category_id: selectedCategoryId,
        priority,
        location: location.trim() || undefined,
        photo_paths: photos.length > 0 ? photos : undefined,
      });

      showAlert('Report Created', 'Your maintenance request has been submitted.', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (error: any) {
      showAlert('Error', error?.message ?? 'Something went wrong. Please try again.');
    }
  };

  return (
    <View style={styles.container}>
      <AmbientBackground />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="chevron-back" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>New Report</Text>
        <View style={styles.headerSpacer} />
      </View>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
      >
        <ScrollView
          style={styles.flex}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Category Selector */}
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>CATEGORY</Text>
            {catLoading ? (
              <ActivityIndicator color={colors.primary} style={styles.catLoader} />
            ) : (
              <View style={styles.categoryGrid}>
                {(categories ?? []).map((cat) => {
                  const active = selectedCategoryId === cat.id;
                  return (
                    <TouchableOpacity
                      key={cat.id}
                      style={[
                        styles.categoryCard,
                        active && styles.categoryCardActive,
                        active && cat.color ? { borderColor: cat.color } : {},
                      ]}
                      onPress={() => setSelectedCategoryId(cat.id)}
                    >
                      <View
                        style={[
                          styles.categoryIconBox,
                          {
                            backgroundColor: active
                              ? (cat.color ? `${cat.color}20` : colors.primaryLight)
                              : colors.border,
                          },
                        ]}
                      >
                        <Ionicons
                          name={getCategoryIcon(cat.icon) as any}
                          size={20}
                          color={active ? (cat.color ?? colors.primary) : colors.textCaption}
                        />
                      </View>
                      <Text
                        style={[
                          styles.categoryName,
                          active && { color: cat.color ?? colors.primary },
                        ]}
                        numberOfLines={1}
                      >
                        {cat.name}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}
          </View>

          {/* Title */}
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>TITLE</Text>
            <View style={styles.inputContainer}>
              <TextInput
                style={styles.input}
                value={title}
                onChangeText={setTitle}
                placeholder="Brief summary of the issue"
                placeholderTextColor={colors.textDisabled}
                maxLength={120}
              />
            </View>
          </View>

          {/* Description */}
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>DESCRIPTION</Text>
            <View style={styles.textAreaContainer}>
              <TextInput
                style={styles.textArea}
                value={description}
                onChangeText={setDescription}
                placeholder="What needs attention?"
                placeholderTextColor={colors.textDisabled}
                multiline
                textAlignVertical="top"
                maxLength={2000}
              />
            </View>
          </View>

          {/* Priority */}
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>PRIORITY</Text>
            <View style={styles.priorityRow}>
              {PRIORITIES.map((p) => {
                const active = priority === p.key;
                const pColors = getPriorityColors(p.key, active);
                return (
                  <TouchableOpacity
                    key={p.key}
                    style={[
                      styles.priorityPill,
                      { backgroundColor: pColors.bg, borderColor: pColors.border },
                      active && { borderWidth: 2 },
                    ]}
                    onPress={() => setPriority(p.key)}
                  >
                    <Text
                      style={[
                        styles.priorityText,
                        { color: pColors.text },
                      ]}
                    >
                      {p.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* Location */}
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>LOCATION (OPTIONAL)</Text>
            <View style={styles.inputContainer}>
              <Ionicons name="location-outline" size={20} color={colors.textCaption} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                value={location}
                onChangeText={setLocation}
                placeholder="e.g. Building A, 2nd floor"
                placeholderTextColor={colors.textDisabled}
              />
            </View>
          </View>

          {/* Photos */}
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>PHOTOS (UP TO 3)</Text>
            <View style={styles.photosRow}>
              {photos.map((_, index) => (
                <View key={index} style={styles.photoThumb}>
                  <Ionicons name="image-outline" size={24} color={colors.primary} />
                  <TouchableOpacity
                    style={styles.photoRemove}
                    onPress={() => handleRemovePhoto(index)}
                  >
                    <Ionicons name="close-circle" size={20} color={colors.danger} />
                  </TouchableOpacity>
                </View>
              ))}
              {photos.length < 3 && (
                <TouchableOpacity
                  style={styles.addPhotoButton}
                  onPress={handleAddPhoto}
                  disabled={uploading}
                >
                  {uploading ? (
                    <ActivityIndicator color={colors.primary} size="small" />
                  ) : (
                    <>
                      <Ionicons name="camera-outline" size={22} color={colors.textMuted} />
                      <Text style={styles.addPhotoText}>Add Photo</Text>
                    </>
                  )}
                </TouchableOpacity>
              )}
            </View>
          </View>

          {/* Action Buttons */}
          <View style={styles.actionsRow}>
            <TouchableOpacity
              style={[styles.submitButton, !canSubmit && styles.submitButtonDisabled]}
              onPress={handleSubmit}
              disabled={!canSubmit}
            >
              {createMutation.isPending ? (
                <ActivityIndicator color={colors.textOnDark} />
              ) : (
                <Text style={styles.submitButtonText}>Submit Ticket</Text>
              )}
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
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
  // Header
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
  // Scroll
  scrollContent: {
    paddingHorizontal: spacing.pagePaddingX,
    paddingTop: spacing.xl,
    paddingBottom: spacing.bottomNavClearance + 16,
  },
  // Fields
  fieldGroup: {
    marginBottom: spacing['3xl'],
  },
  fieldLabel: {
    fontFamily: fonts.bold,
    fontSize: 10,
    color: colors.textCaption,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    marginLeft: 4,
    marginBottom: spacing.md,
  },
  // Category Grid
  catLoader: {
    paddingVertical: spacing['3xl'],
  },
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.lg,
  },
  categoryCard: {
    width: '30%',
    flexGrow: 1,
    minWidth: 90,
    alignItems: 'center',
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  categoryCardActive: {
    borderWidth: 2,
    borderColor: colors.primary,
    backgroundColor: colors.primaryLight,
  },
  categoryIconBox: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  categoryName: {
    fontFamily: fonts.bold,
    fontSize: 11,
    color: colors.textBody,
    textAlign: 'center',
  },
  // Inputs
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    height: spacing.inputHeight,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.borderMedium,
    paddingHorizontal: spacing.xl,
  },
  inputIcon: {
    marginRight: spacing.lg,
  },
  input: {
    flex: 1,
    fontFamily: fonts.medium,
    fontSize: 14,
    color: colors.textPrimary,
  },
  textAreaContainer: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.borderMedium,
    padding: spacing.xl,
    minHeight: 128,
  },
  textArea: {
    fontFamily: fonts.medium,
    fontSize: 14,
    color: colors.textPrimary,
    minHeight: 100,
  },
  // Priority
  priorityRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  priorityPill: {
    flex: 1,
    paddingVertical: spacing.lg,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  priorityText: {
    fontFamily: fonts.black,
    fontSize: 10,
    textTransform: 'uppercase',
  },
  // Photos
  photosRow: {
    flexDirection: 'row',
    gap: spacing.lg,
  },
  photoThumb: {
    width: 80,
    height: 80,
    borderRadius: borderRadius.md,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.primaryLightAlt,
    position: 'relative',
  },
  photoRemove: {
    position: 'absolute',
    top: -6,
    right: -6,
  },
  addPhotoButton: {
    width: 80,
    height: 80,
    borderRadius: borderRadius.md,
    backgroundColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
  },
  addPhotoText: {
    fontFamily: fonts.bold,
    fontSize: 9,
    color: colors.textMuted,
  },
  // Actions
  actionsRow: {
    marginTop: spacing.lg,
  },
  submitButton: {
    height: spacing.buttonHeight,
    borderRadius: borderRadius.lg,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.blueGlow,
  },
  submitButtonDisabled: {
    backgroundColor: colors.textDisabled,
    shadowOpacity: 0,
    elevation: 0,
  },
  submitButtonText: {
    fontFamily: fonts.bold,
    fontSize: 16,
    color: colors.textOnDark,
  },
});
