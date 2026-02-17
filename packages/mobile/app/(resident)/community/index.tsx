import { useState, useCallback, useMemo, useRef, memo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  FlatList,
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

function getChannelName(channelData: { id: string; name: string; icon?: string | null } | null): string {
  if (!channelData) return '';
  return channelData.name;
}

// ---- Type for a single post from usePosts ----
type PostItem = {
  id: string;
  title: string | null;
  content: string;
  post_type: string;
  media_urls: unknown;
  poll_options: unknown;
  poll_ends_at: string | null;
  poll_results: unknown;
  reaction_counts: unknown;
  comment_count: number | null;
  view_count: number | null;
  is_pinned: boolean;
  created_at: string;
  channels: { id: string; name: string; icon: string | null } | null;
  residents: {
    id: string;
    first_name: string;
    paternal_surname: string;
    photo_url: string | null;
  } | null;
};

// ---- MediaThumbnails sub-component ----
function MediaThumbnails({ mediaUrls }: { mediaUrls: string[] }) {
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
}

// ---- PollOptions sub-component ----
function PollOptions({ post }: { post: PostItem }) {
  const { pollOptions, optionVotes, totalVotes, maxVotes, isPollExpired } = useMemo(() => {
    const opts = (post.poll_options ?? []) as { text: string }[];
    const results = (post.poll_results ?? {}) as Record<string, number>;
    const votes = opts.map((_, i) => results[String(i)] ?? 0);
    const total = votes.reduce((sum, v) => sum + v, 0);
    const max = Math.max(...votes, 0);
    const expired = !!post.poll_ends_at && new Date(post.poll_ends_at) < new Date();
    return { pollOptions: opts, optionVotes: votes, totalVotes: total, maxVotes: max, isPollExpired: expired };
  }, [post.poll_options, post.poll_results, post.poll_ends_at]);

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
            </View>
          </View>
        );
      })}
      <Text style={styles.pollFooter}>
        {totalVotes} vote{totalVotes !== 1 ? 's' : ''}
        {isPollExpired ? '  ·  Ended' : ''}
      </Text>
    </View>
  );
}

// ---- Memoized PostCard component ----
interface PostCardProps {
  post: PostItem;
  isLiked: boolean;
  onToggleLike: (postId: string) => void;
  onNavigateToPost: (postId: string) => void;
}

const PostCard = memo(
  function PostCard({ post, isLiked, onToggleLike, onNavigateToPost }: PostCardProps) {
    const author = post.residents;
    const channel = post.channels;
    const authorName = author
      ? `${author.first_name} ${author.paternal_surname}`
      : 'Unknown';
    const reactionCounts = (post.reaction_counts ?? {}) as Record<string, number>;
    const likeCount = reactionCounts['like'] ?? 0;
    const mediaUrls = (post.media_urls ?? []) as string[];

    return (
      <TouchableOpacity
        style={styles.postCard}
        activeOpacity={0.7}
        onPress={() => onNavigateToPost(post.id)}
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
        {mediaUrls.length > 0 && <MediaThumbnails mediaUrls={mediaUrls} />}

        {/* Poll */}
        {post.post_type === 'poll' && <PollOptions post={post} />}

        {/* Reaction bar */}
        <View style={styles.reactionBar}>
          <View style={styles.reactionLeft}>
            <TouchableOpacity
              style={styles.reactionButton}
              onPress={(e) => {
                e.stopPropagation();
                onToggleLike(post.id);
              }}
            >
              <Ionicons
                name={isLiked ? 'heart' : 'heart-outline'}
                size={20}
                color={isLiked ? '#F43F5E' : colors.textCaption}
              />
              <Text
                style={[
                  styles.reactionCount,
                  isLiked && styles.reactionCountActive,
                ]}
              >
                {likeCount}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.reactionButton}
              onPress={(e) => {
                e.stopPropagation();
                onNavigateToPost(post.id);
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
  },
  (prevProps, nextProps) => {
    // Value-compare reaction_counts instead of reference equality.
    // Optimistic updates create new objects, so === always fails.
    const prevLike = ((prevProps.post.reaction_counts ?? {}) as Record<string, number>)['like'] ?? 0;
    const nextLike = ((nextProps.post.reaction_counts ?? {}) as Record<string, number>)['like'] ?? 0;

    return (
      prevProps.post.id === nextProps.post.id &&
      prevLike === nextLike &&
      prevProps.post.comment_count === nextProps.post.comment_count &&
      prevProps.post.view_count === nextProps.post.view_count &&
      prevProps.post.is_pinned === nextProps.post.is_pinned &&
      prevProps.post.poll_results === nextProps.post.poll_results &&
      prevProps.isLiked === nextProps.isLiked &&
      prevProps.onToggleLike === nextProps.onToggleLike &&
      prevProps.onNavigateToPost === nextProps.onNavigateToPost
    );
  }
);

// ---- Separator between post cards ----
function PostSeparator() {
  return <View style={styles.postSeparator} />;
}

// ---- Empty state component ----
function ListEmpty() {
  return (
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
  );
}

// ---- Main screen component ----
export default function CommunityIndexScreen() {
  const router = useRouter();
  const [selectedChannel, setSelectedChannel] = useState<string | null>(null);
  const { data: channels } = useChannels();
  const { data: posts, isLoading, refetch } = usePosts(selectedChannel);
  const toggleReaction = useToggleReaction();
  const { data: myLikedPosts } = useMyPostReactions();

  // ── Stable like-toggle callback via refs ──────────────────────
  // Refs prevent the callback from changing identity on every render,
  // which would cascade re-renders through FlatList → PostCard.
  const toggleRef = useRef(toggleReaction);
  toggleRef.current = toggleReaction;
  const myLikedRef = useRef(myLikedPosts);
  myLikedRef.current = myLikedPosts;
  const pendingLikes = useRef(new Set<string>());

  const handleToggleLike = useCallback(
    (postId: string) => {
      // Block concurrent mutations on the same post (prevents race conditions)
      if (pendingLikes.current.has(postId)) return;
      pendingLikes.current.add(postId);

      const isLiked = myLikedRef.current?.has(postId) ?? false;
      toggleRef.current.mutate(
        { postId, reactionType: 'like', isLiked },
        { onSettled: () => pendingLikes.current.delete(postId) },
      );
    },
    [] // Stable – reads from refs, never changes identity
  );

  const handleNavigateToPost = useCallback(
    (postId: string) => {
      router.push(`/(resident)/community/post/${postId}`);
    },
    [router]
  );

  const keyExtractor = useCallback((item: PostItem) => item.id, []);

  const renderItem = useCallback(
    ({ item }: { item: PostItem }) => (
      <PostCard
        post={item}
        isLiked={myLikedPosts?.has(item.id) ?? false}
        onToggleLike={handleToggleLike}
        onNavigateToPost={handleNavigateToPost}
      />
    ),
    [myLikedPosts, handleToggleLike, handleNavigateToPost]
  );

  const refreshControl = useMemo(
    () => (
      <RefreshControl
        refreshing={false}
        onRefresh={refetch}
        tintColor={colors.primary}
      />
    ),
    [refetch]
  );

  const listEmptyComponent = useMemo(
    () => (isLoading ? (
      <View style={styles.centerMessage}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    ) : (
      <ListEmpty />
    )),
    [isLoading]
  );

  const postData = useMemo(() => (posts ?? []) as PostItem[], [posts]);

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
      <FlatList
        data={postData}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={refreshControl}
        ListEmptyComponent={listEmptyComponent}
        ItemSeparatorComponent={PostSeparator}
        removeClippedSubviews={true}
        maxToRenderPerBatch={10}
      />

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
  // FlatList
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing['3xl'],
    paddingBottom: spacing.bottomNavClearance + 20,
    flexGrow: 1,
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
  // Post separator (replaces gap in postsList)
  postSeparator: {
    height: spacing['3xl'],
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
  pollFooter: {
    fontFamily: fonts.medium,
    fontSize: 11,
    color: colors.textCaption,
    textAlign: 'center',
    marginTop: spacing.sm,
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
