import { useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Image,
  Animated,
  Dimensions,
} from 'react-native';
import { showAlert } from '@/lib/alert';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useChannels, useCreatePost } from '@/hooks/usePosts';
import { useAuth } from '@/hooks/useAuth';
import { pickAndUploadImage } from '@/lib/upload';
import { AmbientBackground } from '@/components/ui/AmbientBackground';
import { colors, fonts, spacing, borderRadius, shadows } from '@/theme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

type PostType = 'text' | 'photo' | 'poll';

interface PollOption {
  text: string;
}

export default function CreatePostScreen() {
  const router = useRouter();
  const { user, communityId } = useAuth();
  const { data: channels } = useChannels();
  const createPostMutation = useCreatePost();
  const pollSlideAnim = useRef(new Animated.Value(0)).current;

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
  const [showTitle, setShowTitle] = useState(false);

  const selectedChannel = (channels ?? []).find(
    (c) => c.id === selectedChannelId
  );

  // User display info
  const firstName = user?.user_metadata?.first_name ?? '';
  const lastName = user?.user_metadata?.paternal_surname ?? '';
  const displayName = `${firstName} ${lastName}`.trim() || 'You';
  const avatarUrl = user?.user_metadata?.avatar_url;
  const initials = `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase() || 'U';

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
        // Auto-switch to photo mode when an image is added
        if (postType !== 'photo') {
          setPostType('photo');
        }
      }
    } finally {
      setIsUploading(false);
    }
  }, [communityId, postType]);

  const handleRemoveImage = useCallback((index: number) => {
    setMediaUrls((prev) => {
      const next = prev.filter((_, i) => i !== index);
      return next;
    });
  }, []);

  const handleTogglePoll = useCallback(() => {
    if (postType === 'poll') {
      // Animate out, then switch
      Animated.timing(pollSlideAnim, {
        toValue: 0,
        duration: 250,
        useNativeDriver: false,
      }).start(() => setPostType('text'));
    } else {
      setPostType('poll');
      Animated.timing(pollSlideAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: false,
      }).start();
    }
  }, [postType, pollSlideAnim]);

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
          showAlert('Error', error.message || 'Failed to create post');
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

  // Poll section animated height
  const pollHeight = pollSlideAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1],
  });

  return (
    <View style={styles.container}>
      <AmbientBackground />

      {/* ─── Header ─── */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="chevron-back" size={22} color={colors.textPrimary} />
        </TouchableOpacity>

        <Text style={styles.headerTitle}>Create Post</Text>

        <TouchableOpacity
          style={[styles.postButton, !canSubmit() && styles.postButtonDisabled]}
          onPress={handleSubmit}
          disabled={!canSubmit() || createPostMutation.isPending}
        >
          {createPostMutation.isPending ? (
            <ActivityIndicator size="small" color={colors.textOnDark} />
          ) : (
            <Text
              style={[
                styles.postButtonText,
                !canSubmit() && styles.postButtonTextDisabled,
              ]}
            >
              Post
            </Text>
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
          {/* ─── User Identity Row ─── */}
          <View style={styles.identityRow}>
            {avatarUrl ? (
              <Image source={{ uri: avatarUrl }} style={styles.avatar} />
            ) : (
              <View style={styles.avatarFallback}>
                <Text style={styles.avatarInitials}>{initials}</Text>
              </View>
            )}

            <View style={styles.identityInfo}>
              <Text style={styles.userName}>{displayName}</Text>

              {/* Channel chip */}
              <TouchableOpacity
                style={styles.channelChip}
                onPress={() => setShowChannelPicker(!showChannelPicker)}
                activeOpacity={0.7}
              >
                <Ionicons
                  name="globe-outline"
                  size={12}
                  color={selectedChannel ? colors.primary : colors.textCaption}
                />
                <Text
                  style={[
                    styles.channelChipText,
                    selectedChannel && styles.channelChipTextActive,
                  ]}
                  numberOfLines={1}
                >
                  {selectedChannel?.name ?? 'Select channel'}
                </Text>
                <Ionicons
                  name="chevron-down"
                  size={12}
                  color={selectedChannel ? colors.primary : colors.textCaption}
                />
              </TouchableOpacity>
            </View>
          </View>

          {/* ─── Channel Dropdown ─── */}
          {showChannelPicker && (
            <View style={styles.channelDropdown}>
              {(channels ?? []).map((channel) => (
                <TouchableOpacity
                  key={channel.id}
                  style={[
                    styles.channelDropdownItem,
                    selectedChannelId === channel.id &&
                      styles.channelDropdownItemActive,
                  ]}
                  onPress={() => {
                    setSelectedChannelId(channel.id);
                    setShowChannelPicker(false);
                  }}
                >
                  <Ionicons
                    name="chatbubble-outline"
                    size={16}
                    color={
                      selectedChannelId === channel.id
                        ? colors.primary
                        : colors.textMuted
                    }
                  />
                  <Text
                    style={[
                      styles.channelDropdownText,
                      selectedChannelId === channel.id &&
                        styles.channelDropdownTextActive,
                    ]}
                  >
                    {channel.name}
                  </Text>
                  {selectedChannelId === channel.id && (
                    <Ionicons
                      name="checkmark-circle"
                      size={18}
                      color={colors.primary}
                      style={styles.channelCheckmark}
                    />
                  )}
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* ─── Optional Title ─── */}
          {showTitle ? (
            <View style={styles.titleContainer}>
              <TextInput
                style={styles.titleInput}
                placeholder="Title (optional)"
                placeholderTextColor={colors.textCaption}
                value={title}
                onChangeText={setTitle}
                maxLength={200}
                autoFocus
              />
              <TouchableOpacity
                style={styles.titleDismiss}
                onPress={() => {
                  setShowTitle(false);
                  setTitle('');
                }}
              >
                <Ionicons name="close" size={16} color={colors.textCaption} />
              </TouchableOpacity>
            </View>
          ) : null}

          {/* ─── Main Content Area ─── */}
          <TextInput
            style={styles.contentInput}
            placeholder="What's on your mind?"
            placeholderTextColor={colors.textCaption}
            value={content}
            onChangeText={setContent}
            multiline
            textAlignVertical="top"
            maxLength={5000}
            scrollEnabled={false}
          />

          {/* ─── Photo Grid ─── */}
          {mediaUrls.length > 0 && (
            <View style={styles.photoGrid}>
              {mediaUrls.map((url, index) => (
                <View
                  key={index}
                  style={[
                    styles.photoItem,
                    mediaUrls.length === 1 && styles.photoItemSingle,
                  ]}
                >
                  <Image
                    source={{ uri: url }}
                    style={styles.photoImage}
                    resizeMode="cover"
                  />
                  <TouchableOpacity
                    style={styles.photoRemove}
                    onPress={() => handleRemoveImage(index)}
                  >
                    <View style={styles.photoRemoveCircle}>
                      <Ionicons name="close" size={14} color={colors.surface} />
                    </View>
                  </TouchableOpacity>
                </View>
              ))}

              {/* Add more photos button */}
              {isUploading ? (
                <View style={styles.photoAddMore}>
                  <ActivityIndicator size="small" color={colors.primary} />
                </View>
              ) : (
                <TouchableOpacity
                  style={styles.photoAddMore}
                  onPress={handlePickImage}
                >
                  <Ionicons name="add" size={28} color={colors.primary} />
                </TouchableOpacity>
              )}
            </View>
          )}

          {/* ─── Poll Section ─── */}
          {postType === 'poll' && (
            <Animated.View
              style={[
                styles.pollSection,
                {
                  opacity: pollSlideAnim,
                  transform: [
                    {
                      translateY: pollSlideAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [20, 0],
                      }),
                    },
                  ],
                },
              ]}
            >
              <View style={styles.pollHeader}>
                <Ionicons
                  name="stats-chart"
                  size={16}
                  color={colors.primary}
                />
                <Text style={styles.pollHeaderText}>Poll Options</Text>
              </View>

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
                          name="close-circle"
                          size={20}
                          color={colors.textDisabled}
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
                      size={18}
                      color={colors.primary}
                    />
                    <Text style={styles.addOptionText}>Add option</Text>
                  </TouchableOpacity>
                )}
              </View>

              {/* Poll Duration */}
              <View style={styles.pollDurationSection}>
                <Text style={styles.pollDurationLabel}>
                  Duration
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
            </Animated.View>
          )}
        </ScrollView>

        {/* ─── Bottom Attachment Bar ─── */}
        <View style={styles.attachmentBar}>
          <View style={styles.attachmentBarInner}>
            <Text style={styles.attachmentBarLabel}>Add to your post</Text>

            <View style={styles.attachmentActions}>
              {/* Title toggle */}
              <TouchableOpacity
                style={[
                  styles.attachmentButton,
                  showTitle && styles.attachmentButtonActive,
                ]}
                onPress={() => setShowTitle(!showTitle)}
              >
                <Ionicons
                  name="text"
                  size={22}
                  color={showTitle ? colors.primary : colors.textMuted}
                />
              </TouchableOpacity>

              {/* Photo */}
              <TouchableOpacity
                style={[
                  styles.attachmentButton,
                  mediaUrls.length > 0 && styles.attachmentButtonActive,
                ]}
                onPress={handlePickImage}
                disabled={isUploading || postType === 'poll'}
              >
                {isUploading ? (
                  <ActivityIndicator size="small" color={colors.success} />
                ) : (
                  <Ionicons
                    name="image"
                    size={22}
                    color={
                      postType === 'poll'
                        ? colors.textDisabled
                        : mediaUrls.length > 0
                        ? colors.success
                        : colors.success
                    }
                  />
                )}
              </TouchableOpacity>

              {/* Poll */}
              <TouchableOpacity
                style={[
                  styles.attachmentButton,
                  postType === 'poll' && styles.attachmentButtonActive,
                ]}
                onPress={handleTogglePoll}
                disabled={mediaUrls.length > 0}
              >
                <Ionicons
                  name="stats-chart"
                  size={22}
                  color={
                    mediaUrls.length > 0
                      ? colors.textDisabled
                      : postType === 'poll'
                      ? colors.warning
                      : colors.warning
                  }
                />
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

// ─── Styles ────────────────────────────────

const AVATAR_SIZE = 44;
const PHOTO_GAP = 8;
const PHOTO_COLS = 3;
const PHOTO_SIZE =
  (SCREEN_WIDTH - spacing.pagePaddingX * 2 - PHOTO_GAP * (PHOTO_COLS - 1) - PHOTO_GAP) /
  PHOTO_COLS;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },

  // ── Header ──
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: spacing.safeAreaTop,
    paddingHorizontal: spacing.pagePaddingX,
    paddingBottom: spacing.lg,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: borderRadius.full,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontFamily: fonts.bold,
    fontSize: 18,
    color: colors.textPrimary,
    flex: 1,
    textAlign: 'center',
    marginHorizontal: spacing.lg,
  },
  postButton: {
    paddingHorizontal: 22,
    height: 36,
    borderRadius: borderRadius.full,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.blueGlow,
  },
  postButtonDisabled: {
    backgroundColor: colors.primaryLightAlt,
    shadowOpacity: 0,
    elevation: 0,
  },
  postButtonText: {
    fontFamily: fonts.bold,
    fontSize: 14,
    color: colors.textOnDark,
  },
  postButtonTextDisabled: {
    color: colors.textCaption,
  },

  // ── Keyboard / Scroll ──
  keyboardView: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: spacing.pagePaddingX,
    paddingBottom: 20,
  },

  // ── Identity Row (Facebook-style) ──
  identityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: spacing.xl,
    paddingBottom: spacing.md,
  },
  avatar: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
    backgroundColor: colors.border,
  },
  avatarFallback: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitials: {
    fontFamily: fonts.bold,
    fontSize: 16,
    color: colors.textOnDark,
  },
  identityInfo: {
    marginLeft: spacing.lg,
    flex: 1,
  },
  userName: {
    fontFamily: fonts.bold,
    fontSize: 16,
    color: colors.textPrimary,
    marginBottom: 3,
  },

  // ── Channel Chip ──
  channelChip: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 4,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    backgroundColor: colors.background,
    borderRadius: borderRadius.sm,
    borderWidth: 1,
    borderColor: colors.borderMedium,
  },
  channelChipText: {
    fontFamily: fonts.medium,
    fontSize: 12,
    color: colors.textCaption,
    maxWidth: 140,
  },
  channelChipTextActive: {
    color: colors.primary,
    fontFamily: fonts.bold,
  },

  // ── Channel Dropdown ──
  channelDropdown: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    marginBottom: spacing.md,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.borderMedium,
    ...shadows.md,
  },
  channelDropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
    paddingHorizontal: spacing.xl,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  channelDropdownItemActive: {
    backgroundColor: colors.primaryLight,
  },
  channelDropdownText: {
    flex: 1,
    fontFamily: fonts.medium,
    fontSize: 15,
    color: colors.textBody,
  },
  channelDropdownTextActive: {
    fontFamily: fonts.bold,
    color: colors.primary,
  },
  channelCheckmark: {
    marginLeft: 'auto',
  },

  // ── Title Input ──
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingBottom: spacing.md,
  },
  titleInput: {
    flex: 1,
    fontFamily: fonts.bold,
    fontSize: 20,
    color: colors.textPrimary,
    paddingVertical: spacing.xs,
  },
  titleDismiss: {
    padding: spacing.md,
  },

  // ── Content Input ──
  contentInput: {
    fontFamily: fonts.regular,
    fontSize: 18,
    color: colors.textPrimary,
    lineHeight: 26,
    minHeight: 180,
    paddingTop: spacing.md,
    paddingBottom: spacing.xl,
    textAlignVertical: 'top',
  },

  // ── Photo Grid ──
  photoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: PHOTO_GAP,
    marginBottom: spacing.xl,
  },
  photoItem: {
    width: PHOTO_SIZE,
    height: PHOTO_SIZE,
    borderRadius: borderRadius.md,
    overflow: 'hidden',
    backgroundColor: colors.border,
  },
  photoItemSingle: {
    width: '100%',
    height: 220,
  },
  photoImage: {
    width: '100%',
    height: '100%',
  },
  photoRemove: {
    position: 'absolute',
    top: 6,
    right: 6,
  },
  photoRemoveCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoAddMore: {
    width: PHOTO_SIZE,
    height: PHOTO_SIZE,
    borderRadius: borderRadius.md,
    borderWidth: 1.5,
    borderColor: colors.primaryLightAlt,
    borderStyle: 'dashed',
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // ── Poll Section ──
  pollSection: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.xl,
    marginBottom: spacing.xl,
    borderWidth: 1,
    borderColor: colors.borderMedium,
  },
  pollHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.xl,
  },
  pollHeaderText: {
    fontFamily: fonts.bold,
    fontSize: 14,
    color: colors.primary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  pollOptionsContainer: {
    gap: spacing.lg,
  },
  pollOptionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  pollOptionNumber: {
    width: 26,
    height: 26,
    borderRadius: borderRadius.full,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pollOptionNumberText: {
    fontFamily: fonts.bold,
    fontSize: 12,
    color: colors.primary,
  },
  pollOptionInput: {
    flex: 1,
    height: 44,
    backgroundColor: colors.background,
    borderRadius: borderRadius.md,
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
    gap: spacing.sm,
    height: 44,
    borderRadius: borderRadius.md,
    borderWidth: 1.5,
    borderColor: colors.primaryLightAlt,
    borderStyle: 'dashed',
    backgroundColor: colors.primaryLight,
  },
  addOptionText: {
    fontFamily: fonts.bold,
    fontSize: 13,
    color: colors.primary,
  },

  // ── Poll Duration ──
  pollDurationSection: {
    marginTop: spacing.xl,
    paddingTop: spacing.xl,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  pollDurationLabel: {
    fontFamily: fonts.bold,
    fontSize: 12,
    color: colors.textCaption,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: spacing.lg,
  },
  durationRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  durationPill: {
    flex: 1,
    height: 36,
    borderRadius: borderRadius.full,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  durationPillActive: {
    backgroundColor: colors.dark,
  },
  durationPillText: {
    fontFamily: fonts.bold,
    fontSize: 13,
    color: colors.textMuted,
  },
  durationPillTextActive: {
    color: colors.textOnDark,
  },

  // ── Bottom Attachment Bar ──
  attachmentBar: {
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.borderMedium,
    paddingBottom: spacing.safeAreaBottom,
  },
  attachmentBarInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.pagePaddingX,
    paddingVertical: spacing.lg,
  },
  attachmentBarLabel: {
    fontFamily: fonts.medium,
    fontSize: 14,
    color: colors.textMuted,
  },
  attachmentActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  attachmentButton: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  attachmentButtonActive: {
    backgroundColor: colors.background,
  },
});
