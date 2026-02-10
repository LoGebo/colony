import { useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
  Image,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useChannels, useCreatePost } from '@/hooks/usePosts';
import { useAuth } from '@/hooks/useAuth';
import { pickAndUploadImage } from '@/lib/upload';
import { AmbientBackground } from '@/components/ui/AmbientBackground';
import { colors, fonts, spacing, borderRadius, shadows } from '@/theme';

type PostType = 'text' | 'photo' | 'poll';

interface PollOption {
  text: string;
}

export default function CreatePostScreen() {
  const router = useRouter();
  const { communityId } = useAuth();
  const { data: channels } = useChannels();
  const createPostMutation = useCreatePost();

  const [selectedChannelId, setSelectedChannelId] = useState<string | null>(null);
  const [showChannelPicker, setShowChannelPicker] = useState(false);
  const [postType, setPostType] = useState<PostType>('text');
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [mediaUrls, setMediaUrls] = useState<string[]>([]);
  const [pollOptions, setPollOptions] = useState<PollOption[]>([
    { text: '' },
    { text: '' },
  ]);
  const [pollDays, setPollDays] = useState('7');
  const [isUploading, setIsUploading] = useState(false);

  const selectedChannel = (channels ?? []).find(
    (c) => c.id === selectedChannelId
  );

  const handlePickImage = useCallback(async () => {
    if (!communityId) return;
    setIsUploading(true);
    try {
      const path = await pickAndUploadImage(
        'community-assets',
        communityId,
        'posts'
      );
      if (path) {
        setMediaUrls((prev) => [...prev, path]);
      }
    } finally {
      setIsUploading(false);
    }
  }, [communityId]);

  const handleRemoveImage = useCallback((index: number) => {
    setMediaUrls((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const handleAddPollOption = useCallback(() => {
    if (pollOptions.length >= 6) return;
    setPollOptions((prev) => [...prev, { text: '' }]);
  }, [pollOptions.length]);

  const handleRemovePollOption = useCallback(
    (index: number) => {
      if (pollOptions.length <= 2) return;
      setPollOptions((prev) => prev.filter((_, i) => i !== index));
    },
    [pollOptions.length]
  );

  const handleUpdatePollOption = useCallback(
    (index: number, text: string) => {
      setPollOptions((prev) =>
        prev.map((opt, i) => (i === index ? { text } : opt))
      );
    },
    []
  );

  const canSubmit = () => {
    if (!selectedChannelId || !content.trim()) return false;
    if (postType === 'poll') {
      const validOptions = pollOptions.filter((opt) => opt.text.trim());
      if (validOptions.length < 2) return false;
    }
    return true;
  };

  const handleSubmit = useCallback(async () => {
    if (!canSubmit() || !selectedChannelId) return;

    const pollEndDate = new Date();
    pollEndDate.setDate(pollEndDate.getDate() + (parseInt(pollDays) || 7));

    const validPollOptions = pollOptions.filter((opt) => opt.text.trim());

    createPostMutation.mutate(
      {
        channel_id: selectedChannelId,
        post_type: postType,
        title: title.trim() || undefined,
        content: content.trim(),
        media_urls: postType === 'photo' && mediaUrls.length > 0 ? mediaUrls : undefined,
        poll_options: postType === 'poll' ? validPollOptions : undefined,
        poll_ends_at: postType === 'poll' ? pollEndDate.toISOString() : undefined,
      },
      {
        onSuccess: () => {
          router.back();
        },
        onError: (error) => {
          Alert.alert('Error', error.message || 'Failed to create post');
        },
      }
    );
  }, [
    selectedChannelId,
    postType,
    title,
    content,
    mediaUrls,
    pollOptions,
    pollDays,
    createPostMutation,
    router,
  ]);

  return (
    <View style={styles.container}>
      <AmbientBackground />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Ionicons name="chevron-back" size={20} color={colors.textBody} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>New Post</Text>
        <TouchableOpacity
          style={[styles.submitButton, !canSubmit() && styles.submitButtonDisabled]}
          onPress={handleSubmit}
          disabled={!canSubmit() || createPostMutation.isPending}
        >
          {createPostMutation.isPending ? (
            <ActivityIndicator size="small" color={colors.textOnDark} />
          ) : (
            <Text style={styles.submitButtonText}>Post</Text>
          )}
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={0}
      >
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Channel Selector */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Channel</Text>
            <TouchableOpacity
              style={styles.channelSelector}
              onPress={() => setShowChannelPicker(!showChannelPicker)}
            >
              <Text
                style={[
                  styles.channelSelectorText,
                  !selectedChannel && styles.channelSelectorPlaceholder,
                ]}
              >
                {selectedChannel?.name ?? 'Select a channel'}
              </Text>
              <Ionicons
                name={showChannelPicker ? 'chevron-up' : 'chevron-down'}
                size={18}
                color={colors.textCaption}
              />
            </TouchableOpacity>

            {showChannelPicker && (
              <View style={styles.channelPickerDropdown}>
                {(channels ?? []).map((channel) => (
                  <TouchableOpacity
                    key={channel.id}
                    style={[
                      styles.channelPickerItem,
                      selectedChannelId === channel.id &&
                        styles.channelPickerItemActive,
                    ]}
                    onPress={() => {
                      setSelectedChannelId(channel.id);
                      setShowChannelPicker(false);
                    }}
                  >
                    <Text
                      style={[
                        styles.channelPickerItemText,
                        selectedChannelId === channel.id &&
                          styles.channelPickerItemTextActive,
                      ]}
                    >
                      {channel.name}
                    </Text>
                    {selectedChannelId === channel.id && (
                      <Ionicons
                        name="checkmark"
                        size={18}
                        color={colors.primary}
                      />
                    )}
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>

          {/* Post Type Selector */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Post Type</Text>
            <View style={styles.typeRow}>
              {(
                [
                  { key: 'text', icon: 'document-text-outline', label: 'Text' },
                  { key: 'photo', icon: 'image-outline', label: 'Photo' },
                  { key: 'poll', icon: 'stats-chart-outline', label: 'Poll' },
                ] as { key: PostType; icon: string; label: string }[]
              ).map((type) => (
                <TouchableOpacity
                  key={type.key}
                  style={[
                    styles.typeButton,
                    postType === type.key && styles.typeButtonActive,
                  ]}
                  onPress={() => setPostType(type.key)}
                >
                  <Ionicons
                    name={type.icon as any}
                    size={20}
                    color={
                      postType === type.key
                        ? colors.primary
                        : colors.textCaption
                    }
                  />
                  <Text
                    style={[
                      styles.typeButtonText,
                      postType === type.key && styles.typeButtonTextActive,
                    ]}
                  >
                    {type.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Title (optional) */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>
              Title <Text style={styles.optionalLabel}>(optional)</Text>
            </Text>
            <TextInput
              style={styles.textInput}
              placeholder="Add a title..."
              placeholderTextColor={colors.textCaption}
              value={title}
              onChangeText={setTitle}
              maxLength={200}
            />
          </View>

          {/* Content */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Content</Text>
            <TextInput
              style={[styles.textInput, styles.multilineInput]}
              placeholder="What's on your mind?"
              placeholderTextColor={colors.textCaption}
              value={content}
              onChangeText={setContent}
              multiline
              numberOfLines={6}
              textAlignVertical="top"
              maxLength={5000}
            />
            <Text style={styles.charCount}>
              {content.length}/5000
            </Text>
          </View>

          {/* Photo Upload Area */}
          {postType === 'photo' && (
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Photos</Text>

              {/* Uploaded images */}
              {mediaUrls.length > 0 && (
                <View style={styles.uploadedImagesGrid}>
                  {mediaUrls.map((url, index) => (
                    <View key={index} style={styles.uploadedImageContainer}>
                      <Image
                        source={{ uri: url }}
                        style={styles.uploadedImage}
                        resizeMode="cover"
                      />
                      <TouchableOpacity
                        style={styles.removeImageButton}
                        onPress={() => handleRemoveImage(index)}
                      >
                        <Ionicons
                          name="close-circle"
                          size={24}
                          color={colors.danger}
                        />
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              )}

              {/* Upload button */}
              <TouchableOpacity
                style={styles.uploadArea}
                onPress={handlePickImage}
                disabled={isUploading}
              >
                {isUploading ? (
                  <ActivityIndicator size="small" color={colors.primary} />
                ) : (
                  <>
                    <View style={styles.uploadIcon}>
                      <Ionicons
                        name="cloud-upload-outline"
                        size={28}
                        color={colors.primary}
                      />
                    </View>
                    <Text style={styles.uploadText}>Tap to upload photo</Text>
                    <Text style={styles.uploadHint}>
                      JPG, PNG up to 10MB
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          )}

          {/* Poll Options */}
          {postType === 'poll' && (
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Poll Options</Text>
              <View style={styles.pollOptionsContainer}>
                {pollOptions.map((option, index) => (
                  <View key={index} style={styles.pollOptionRow}>
                    <View style={styles.pollOptionNumber}>
                      <Text style={styles.pollOptionNumberText}>
                        {index + 1}
                      </Text>
                    </View>
                    <TextInput
                      style={styles.pollOptionInput}
                      placeholder={`Option ${index + 1}`}
                      placeholderTextColor={colors.textCaption}
                      value={option.text}
                      onChangeText={(text) =>
                        handleUpdatePollOption(index, text)
                      }
                      maxLength={100}
                    />
                    {pollOptions.length > 2 && (
                      <TouchableOpacity
                        style={styles.pollRemoveButton}
                        onPress={() => handleRemovePollOption(index)}
                      >
                        <Ionicons
                          name="close-circle-outline"
                          size={22}
                          color={colors.textCaption}
                        />
                      </TouchableOpacity>
                    )}
                  </View>
                ))}

                {pollOptions.length < 6 && (
                  <TouchableOpacity
                    style={styles.addOptionButton}
                    onPress={handleAddPollOption}
                  >
                    <Ionicons
                      name="add-circle-outline"
                      size={20}
                      color={colors.primary}
                    />
                    <Text style={styles.addOptionText}>Add Option</Text>
                  </TouchableOpacity>
                )}
              </View>

              {/* Poll Duration */}
              <View style={styles.pollDurationSection}>
                <Text style={styles.sectionLabel}>
                  Poll Duration{' '}
                  <Text style={styles.optionalLabel}>(days)</Text>
                </Text>
                <View style={styles.durationRow}>
                  {['1', '3', '7', '14', '30'].map((days) => (
                    <TouchableOpacity
                      key={days}
                      style={[
                        styles.durationPill,
                        pollDays === days && styles.durationPillActive,
                      ]}
                      onPress={() => setPollDays(days)}
                    >
                      <Text
                        style={[
                          styles.durationPillText,
                          pollDays === days && styles.durationPillTextActive,
                        ]}
                      >
                        {days}d
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            </View>
          )}
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
  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: spacing.safeAreaTop,
    paddingHorizontal: spacing.pagePaddingX,
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
    fontSize: 18,
    color: colors.textPrimary,
  },
  submitButton: {
    paddingHorizontal: 20,
    height: 40,
    borderRadius: borderRadius.full,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.blueGlow,
  },
  submitButtonDisabled: {
    backgroundColor: colors.textDisabled,
    shadowOpacity: 0,
  },
  submitButtonText: {
    fontFamily: fonts.bold,
    fontSize: 14,
    color: colors.textOnDark,
  },
  // Keyboard
  keyboardView: {
    flex: 1,
  },
  // ScrollView
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: spacing.pagePaddingX,
    paddingBottom: spacing.bottomNavClearance + 20,
  },
  // Section
  section: {
    marginBottom: spacing['3xl'],
  },
  sectionLabel: {
    fontFamily: fonts.bold,
    fontSize: 13,
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: spacing.lg,
  },
  optionalLabel: {
    fontFamily: fonts.medium,
    fontSize: 11,
    color: colors.textCaption,
    textTransform: 'lowercase',
    letterSpacing: 0,
  },
  // Channel Selector
  channelSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: spacing.inputHeight,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.borderMedium,
    paddingHorizontal: spacing.xl,
  },
  channelSelectorText: {
    fontFamily: fonts.medium,
    fontSize: 15,
    color: colors.textPrimary,
  },
  channelSelectorPlaceholder: {
    color: colors.textCaption,
  },
  channelPickerDropdown: {
    marginTop: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.borderMedium,
    overflow: 'hidden',
  },
  channelPickerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.xl,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  channelPickerItemActive: {
    backgroundColor: colors.primaryLight,
  },
  channelPickerItemText: {
    fontFamily: fonts.medium,
    fontSize: 15,
    color: colors.textBody,
  },
  channelPickerItemTextActive: {
    fontFamily: fonts.bold,
    color: colors.primary,
  },
  // Type selector
  typeRow: {
    flexDirection: 'row',
    gap: spacing.lg,
  },
  typeButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    height: spacing.smallButtonHeight,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.borderMedium,
  },
  typeButtonActive: {
    backgroundColor: colors.primaryLight,
    borderColor: colors.primary,
  },
  typeButtonText: {
    fontFamily: fonts.bold,
    fontSize: 13,
    color: colors.textCaption,
  },
  typeButtonTextActive: {
    color: colors.primary,
  },
  // Text input
  textInput: {
    height: spacing.inputHeight,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.borderMedium,
    paddingHorizontal: spacing.xl,
    fontFamily: fonts.medium,
    fontSize: 15,
    color: colors.textPrimary,
  },
  multilineInput: {
    height: 160,
    paddingTop: spacing.xl,
    paddingBottom: spacing.xl,
    textAlignVertical: 'top',
  },
  charCount: {
    fontFamily: fonts.medium,
    fontSize: 11,
    color: colors.textCaption,
    textAlign: 'right',
    marginTop: spacing.xs,
  },
  // Upload
  uploadedImagesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.lg,
    marginBottom: spacing.xl,
  },
  uploadedImageContainer: {
    width: 100,
    height: 100,
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
  },
  uploadedImage: {
    width: '100%',
    height: '100%',
  },
  removeImageButton: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.full,
  },
  uploadArea: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing['4xl'],
    backgroundColor: colors.primaryLight,
    borderRadius: borderRadius.lg,
    borderWidth: 2,
    borderColor: colors.primaryLightAlt,
    borderStyle: 'dashed',
  },
  uploadIcon: {
    width: 48,
    height: 48,
    borderRadius: borderRadius.full,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  uploadText: {
    fontFamily: fonts.bold,
    fontSize: 14,
    color: colors.primary,
    marginBottom: 4,
  },
  uploadHint: {
    fontFamily: fonts.medium,
    fontSize: 12,
    color: colors.textCaption,
  },
  // Poll Options
  pollOptionsContainer: {
    gap: spacing.lg,
  },
  pollOptionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
  },
  pollOptionNumber: {
    width: 28,
    height: 28,
    borderRadius: borderRadius.full,
    backgroundColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pollOptionNumberText: {
    fontFamily: fonts.bold,
    fontSize: 12,
    color: colors.textMuted,
  },
  pollOptionInput: {
    flex: 1,
    height: spacing.smallButtonHeight,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.borderMedium,
    paddingHorizontal: spacing.xl,
    fontFamily: fonts.medium,
    fontSize: 14,
    color: colors.textPrimary,
  },
  pollRemoveButton: {
    padding: spacing.xs,
  },
  addOptionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    height: spacing.smallButtonHeight,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.primaryLightAlt,
    borderStyle: 'dashed',
    backgroundColor: colors.primaryLight,
  },
  addOptionText: {
    fontFamily: fonts.bold,
    fontSize: 13,
    color: colors.primary,
  },
  // Poll Duration
  pollDurationSection: {
    marginTop: spacing['3xl'],
  },
  durationRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  durationPill: {
    flex: 1,
    height: 40,
    borderRadius: borderRadius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderMedium,
    alignItems: 'center',
    justifyContent: 'center',
  },
  durationPillActive: {
    backgroundColor: colors.dark,
    borderColor: colors.dark,
  },
  durationPillText: {
    fontFamily: fonts.bold,
    fontSize: 13,
    color: colors.textBody,
  },
  durationPillTextActive: {
    color: colors.textOnDark,
  },
});
