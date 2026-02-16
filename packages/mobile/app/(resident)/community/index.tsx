import { useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
  Image,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useChannels, usePosts, useToggleReaction, useMyPostReactions } from '@/hooks/usePosts';
import { formatRelative } from '@/lib/dates';
import { AmbientBackground } from '@/components/ui/AmbientBackground';
import { colors, fonts, spacing, borderRadius, shadows } from '@/theme';

const AVATAR_COLORS = [
  '#2563EB',
  '#7C3AED',
  '#059669',
  '#DC2626',
  '#D97706',
  '#0891B2',
  '#4F46E5',
  '#BE185D',
];

function getAvatarColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

function getInitials(firstName?: string | null, surname?: string | null): string {
  const f = (firstName ?? '').charAt(0).toUpperCase();
  const s = (surname ?? '').charAt(0).toUpperCase();
  return f + s || '?';
}

export default function CommunityIndexScreen() {
  const router = useRouter();
  const [selectedChannel, setSelectedChannel] = useState<string | null>(null);
  const { data: channels } = useChannels();
  const { data: posts, isLoading, refetch } = usePosts(selectedChannel);
  const toggleReaction = useToggleReaction();
  const { data: myLikedPosts } = useMyPostReactions();

  const handleToggleLike = useCallback(
    (postId: string) => {
      toggleReaction.mutate({ postId, reactionType: 'like' });
    },
    [toggleReaction]
  );

  const getChannelName = (channelData: { id: string; name: string; icon?: string | null } | null) => {
    if (!channelData) return '';
    return channelData.name;
  };

  const renderPollOptions = (post: NonNullable<typeof posts>[number]) => {
    const pollOptions = (post.poll_options ?? []) as { text: string }[];
    const pollResults = (post.poll_results ?? {}) as Record<string, number>;
    const optionVotes = pollOptions.map((_, i) => pollResults[String(i)] ?? 0);
    const totalVotes = optionVotes.reduce((sum, v) => sum + v, 0);
    const maxVotes = Math.max(...optionVotes, 0);

    return (
      <View style={styles.pollContainer}>
        {pollOptions.map((option, index) => {
          const votes = optionVotes[index];
          const percentage = totalVotes > 0 ? Math.round((votes / totalVotes) * 100) : 0;
          const isLeading = votes > 0 && votes === maxVotes;

          return (
            <View key={index} style={styles.pollOption}>
              <View style={styles.pollOptionHeader}>
                <Text
                  style={[
                    styles.pollOptionText,
                    isLeading && styles.pollOptionTextLeading,
                  ]}
                >
                  {option.text}
                </Text>
                <Text
                  style={[
                    styles.pollPercentage,
                    isLeading && styles.pollPercentageLeading,
                  ]}
                >
                  {percentage}%
                </Text>
              </View>
              <View style={styles.pollBar}>
                <View
                  style={[
                    styles.pollBarFill,
                    isLeading ? styles.pollBarFillLeading : styles.pollBarFillDefault,
                    { width: `${percentage}%` },
                  ]}
                />
                {isLeading && (
                  <View style={styles.pollCheckContainer}>
                    <Ionicons
                      name="checkmark-circle"
                      size={18}
                      color={colors.primary}
                    />
                  </View>
                )}
              </View>
            </View>
          );
        })}
      </View>
    );
  };

  const renderMediaThumbnails = (mediaUrls: string[]) => {
    if (!mediaUrls || mediaUrls.length === 0) return null;

    return (
      <View style={styles.mediaContainer}>
        {mediaUrls.length === 1 ? (
          <View style={styles.singleMedia}>
            <Image
              source={{ uri: mediaUrls[0] }}
              style={styles.singleMediaImage}
              resizeMode="cover"
            />
          </View>
        ) : (
          <View style={styles.mediaGrid}>
            {mediaUrls.slice(0, 3).map((url, index) => (
              <View key={index} style={styles.mediaGridItem}>
                <Image
                  source={{ uri: url }}
                  style={styles.mediaGridImage}
                  resizeMode="cover"
                />
              </View>
            ))}
          </View>
        )}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <AmbientBackground />

      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Community</Text>
          <Text style={styles.headerSubtitle}>Social Feed</Text>
        </View>
        <TouchableOpacity
          style={styles.amenitiesButton}
          onPress={() => router.push('/(resident)/community/amenities/')}
        >
          <Ionicons name="calendar-outline" size={20} color={colors.primary} />
          <Text style={styles.amenitiesButtonText}>Amenities</Text>
        </TouchableOpacity>
      </View>

      {/* Channel Filter Pills */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.channelFilterContainer}
        contentContainerStyle={styles.channelFilterContent}
      >
        <TouchableOpacity
          style={[
            styles.channelPill,
            !selectedChannel && styles.channelPillActive,
          ]}
          onPress={() => setSelectedChannel(null)}
        >
          <Text
            style={[
              styles.channelPillText,
              !selectedChannel && styles.channelPillTextActive,
            ]}
          >
            All
          </Text>
        </TouchableOpacity>
        {(channels ?? []).map((channel) => (
          <TouchableOpacity
            key={channel.id}
            style={[
              styles.channelPill,
              selectedChannel === channel.id && styles.channelPillActive,
            ]}
            onPress={() =>
              setSelectedChannel(
                selectedChannel === channel.id ? null : channel.id
              )
            }
          >
            <Text
              style={[
                styles.channelPillText,
                selectedChannel === channel.id && styles.channelPillTextActive,
              ]}
            >
              {channel.name}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Posts Feed */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={false}
            onRefresh={refetch}
            tintColor={colors.primary}
          />
        }
      >
        {isLoading ? (
          <View style={styles.centerMessage}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        ) : (posts ?? []).length === 0 ? (
          <View style={styles.centerMessage}>
            <Ionicons
              name="chatbubbles-outline"
              size={48}
              color={colors.textDisabled}
            />
            <Text style={styles.emptyTitle}>No posts yet</Text>
            <Text style={styles.emptySubtitle}>
              Be the first to share something with the community.
            </Text>
          </View>
        ) : (
          <View style={styles.postsList}>
            {(posts ?? []).map((post) => {
              const author = post.residents as {
                id: string;
                first_name: string;
                paternal_surname: string;
                photo_url: string | null;
              } | null;
              const channel = post.channels as {
                id: string;
                name: string;
                icon: string | null;
              } | null;
              const authorName = author
                ? `${author.first_name} ${author.paternal_surname}`
                : 'Unknown';
              const reactionCounts = (post.reaction_counts ?? {}) as Record<
                string,
                number
              >;
              const likeCount = reactionCounts['like'] ?? 0;
              const mediaUrls = (post.media_urls ?? []) as string[];

              return (
                <TouchableOpacity
                  key={post.id}
                  style={styles.postCard}
                  activeOpacity={0.7}
                  onPress={() =>
                    router.push(`/(resident)/community/post/${post.id}`)
                  }
                >
                  {/* Pinned indicator */}
                  {post.is_pinned && (
                    <View style={styles.pinnedBadge}>
                      <Ionicons name="pin" size={12} color={colors.primary} />
                      <Text style={styles.pinnedText}>Pinned</Text>
                    </View>
                  )}

                  {/* Author row */}
                  <View style={styles.authorRow}>
                    {author?.photo_url ? (
                      <Image
                        source={{ uri: author.photo_url }}
                        style={styles.avatar}
                      />
                    ) : (
                      <View
                        style={[
                          styles.avatarPlaceholder,
                          {
                            backgroundColor: getAvatarColor(authorName),
                          },
                        ]}
                      >
                        <Text style={styles.avatarInitials}>
                          {getInitials(
                            author?.first_name,
                            author?.paternal_surname
                          )}
                        </Text>
                      </View>
                    )}
                    <View style={styles.authorInfo}>
                      <Text style={styles.authorName}>{authorName}</Text>
                      <Text style={styles.authorMeta}>
                        {getChannelName(channel)}
                        {channel ? ' - ' : ''}
                        {formatRelative(post.created_at)}
                      </Text>
                    </View>
                  </View>

                  {/* Post content */}
                  {post.title && (
                    <Text style={styles.postTitle}>{post.title}</Text>
                  )}
                  <Text style={styles.postContent} numberOfLines={4}>
                    {post.content}
                  </Text>

                  {/* Media thumbnails */}
                  {mediaUrls.length > 0 && renderMediaThumbnails(mediaUrls)}

                  {/* Poll */}
                  {post.post_type === 'poll' && renderPollOptions(post)}

                  {/* Reaction bar */}
                  <View style={styles.reactionBar}>
                    <View style={styles.reactionLeft}>
                      <TouchableOpacity
                        style={styles.reactionButton}
                        onPress={(e) => {
                          e.stopPropagation();
                          handleToggleLike(post.id);
                        }}
                      >
                        <Ionicons
                          name={myLikedPosts?.has(post.id) ? 'heart' : 'heart-outline'}
                          size={20}
                          color={myLikedPosts?.has(post.id) ? '#F43F5E' : colors.textCaption}
                        />
                        <Text
                          style={[
                            styles.reactionCount,
                            myLikedPosts?.has(post.id) && styles.reactionCountActive,
                          ]}
                        >
                          {likeCount}
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.reactionButton}
                        onPress={(e) => {
                          e.stopPropagation();
                          router.push(`/(resident)/community/post/${post.id}`);
                        }}
                      >
                        <Ionicons
                          name="chatbubble-outline"
                          size={20}
                          color={colors.primary}
                        />
                        <Text style={[styles.reactionCount, styles.reactionCountBlue]}>
                          {post.comment_count ?? 0}
                        </Text>
                      </TouchableOpacity>
                      <View style={styles.reactionButton}>
                        <Ionicons
                          name="eye-outline"
                          size={20}
                          color={colors.textCaption}
                        />
                        <Text style={styles.reactionCount}>
                          {post.view_count ?? 0}
                        </Text>
                      </View>
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        )}
      </ScrollView>

      {/* FAB */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => router.push('/(resident)/community/post/create')}
        activeOpacity={0.9}
      >
        <Ionicons name="add" size={28} color={colors.textOnDark} />
      </TouchableOpacity>
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
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: spacing.safeAreaTop,
    paddingHorizontal: spacing.pagePaddingX,
    paddingBottom: spacing.xl,
  },
  headerTitle: {
    fontFamily: fonts.black,
    fontSize: 24,
    color: colors.textPrimary,
    letterSpacing: -0.5,
  },
  headerSubtitle: {
    fontFamily: fonts.medium,
    fontSize: 12,
    color: colors.textCaption,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
  },
  // Channel filter
  channelFilterContainer: {
    maxHeight: 52,
  },
  channelFilterContent: {
    paddingHorizontal: spacing.pagePaddingX - 8,
    gap: spacing.lg,
    paddingVertical: spacing.sm,
  },
  channelPill: {
    paddingHorizontal: 24,
    height: 40,
    borderRadius: borderRadius.full,
    backgroundColor: colors.glass,
    borderWidth: 1,
    borderColor: colors.borderMedium,
    alignItems: 'center',
    justifyContent: 'center',
  },
  channelPillActive: {
    backgroundColor: colors.dark,
    borderColor: colors.dark,
    ...shadows.darkGlow,
  },
  channelPillText: {
    fontFamily: fonts.bold,
    fontSize: 14,
    color: colors.textBody,
  },
  channelPillTextActive: {
    color: colors.textOnDark,
  },
  // ScrollView
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing['3xl'],
    paddingBottom: spacing.bottomNavClearance + 20,
  },
  // Empty / Loading
  centerMessage: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 80,
    gap: spacing.lg,
  },
  emptyTitle: {
    fontFamily: fonts.bold,
    fontSize: 18,
    color: colors.textSecondary,
  },
  emptySubtitle: {
    fontFamily: fonts.medium,
    fontSize: 14,
    color: colors.textMuted,
    textAlign: 'center',
  },
  // Posts list
  postsList: {
    gap: spacing['3xl'],
  },
  // Post card
  postCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius['2xl'],
    padding: spacing.cardPadding,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.sm,
  },
  // Pinned
  pinnedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: spacing.lg,
  },
  pinnedText: {
    fontFamily: fonts.bold,
    fontSize: 11,
    color: colors.primary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  // Author
  authorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
    marginBottom: spacing.xl,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: colors.border,
  },
  avatarPlaceholder: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitials: {
    fontFamily: fonts.bold,
    fontSize: 14,
    color: colors.textOnDark,
  },
  authorInfo: {
    flex: 1,
  },
  authorName: {
    fontFamily: fonts.black,
    fontSize: 14,
    color: colors.textPrimary,
  },
  authorMeta: {
    fontFamily: fonts.bold,
    fontSize: 10,
    color: colors.textCaption,
    textTransform: 'uppercase',
    letterSpacing: -0.3,
  },
  // Post content
  postTitle: {
    fontFamily: fonts.bold,
    fontSize: 16,
    color: colors.textPrimary,
    marginBottom: spacing.md,
  },
  postContent: {
    fontFamily: fonts.medium,
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 22,
    marginBottom: spacing.xl,
  },
  // Media
  mediaContainer: {
    marginBottom: spacing.xl,
  },
  singleMedia: {
    borderRadius: borderRadius.xl,
    overflow: 'hidden',
    aspectRatio: 4 / 3,
  },
  singleMediaImage: {
    width: '100%',
    height: '100%',
  },
  mediaGrid: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  mediaGridItem: {
    flex: 1,
    height: 128,
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
  },
  mediaGridImage: {
    width: '100%',
    height: '100%',
  },
  // Poll
  pollContainer: {
    gap: spacing.lg,
    marginBottom: spacing.xl,
  },
  pollOption: {
    gap: 4,
  },
  pollOptionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  pollOptionText: {
    fontFamily: fonts.bold,
    fontSize: 12,
    color: colors.textCaption,
  },
  pollOptionTextLeading: {
    color: colors.textSecondary,
  },
  pollPercentage: {
    fontFamily: fonts.bold,
    fontSize: 12,
    color: colors.textCaption,
  },
  pollPercentageLeading: {
    color: colors.primary,
  },
  pollBar: {
    height: 40,
    backgroundColor: colors.border,
    borderRadius: borderRadius.md,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
  },
  pollBarFill: {
    position: 'absolute',
    top: 0,
    left: 0,
    height: '100%',
    borderTopRightRadius: borderRadius.sm,
    borderBottomRightRadius: borderRadius.sm,
  },
  pollBarFillLeading: {
    backgroundColor: 'rgba(37,99,235,0.2)',
    borderRightWidth: 1,
    borderRightColor: colors.primaryLightAlt,
  },
  pollBarFillDefault: {
    backgroundColor: colors.borderMedium,
  },
  pollCheckContainer: {
    position: 'absolute',
    left: spacing.xl,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
  },
  // Reaction bar
  reactionBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: spacing.xl,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  reactionLeft: {
    flexDirection: 'row',
    gap: spacing.xl,
  },
  reactionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  reactionCount: {
    fontFamily: fonts.bold,
    fontSize: 12,
    color: colors.textCaption,
  },
  reactionCountActive: {
    color: '#F43F5E',
  },
  reactionCountBlue: {
    color: colors.primary,
  },
  // Amenities button
  amenitiesButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.xl,
    height: 36,
    borderRadius: borderRadius.full,
    backgroundColor: colors.primaryLight,
    borderWidth: 1,
    borderColor: 'rgba(37,99,235,0.15)',
  },
  amenitiesButtonText: {
    fontFamily: fonts.bold,
    fontSize: 12,
    color: colors.primary,
  },
  // FAB
  fab: {
    position: 'absolute',
    bottom: spacing.bottomNavClearance + 12,
    right: spacing.pagePaddingX,
    width: 56,
    height: 56,
    borderRadius: borderRadius.full,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.blueGlow,
  },
});
