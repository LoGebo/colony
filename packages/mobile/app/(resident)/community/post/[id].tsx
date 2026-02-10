import { useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Image,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import {
  usePostDetail,
  usePostComments,
  useToggleReaction,
  useCreateComment,
  useVotePoll,
} from '@/hooks/usePosts';
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

function getInitials(
  firstName?: string | null,
  surname?: string | null
): string {
  const f = (firstName ?? '').charAt(0).toUpperCase();
  const s = (surname ?? '').charAt(0).toUpperCase();
  return f + s || '?';
}

export default function PostDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: post, isLoading: postLoading } = usePostDetail(id!);
  const { data: comments, isLoading: commentsLoading } = usePostComments(id!);
  const toggleReaction = useToggleReaction();
  const createComment = useCreateComment();
  const votePoll = useVotePoll();

  const [commentText, setCommentText] = useState('');
  const [replyTo, setReplyTo] = useState<string | null>(null);

  const handleSendComment = useCallback(() => {
    if (!commentText.trim() || !id) return;
    createComment.mutate(
      {
        post_id: id,
        content: commentText.trim(),
        parent_comment_id: replyTo ?? undefined,
      },
      {
        onSuccess: () => {
          setCommentText('');
          setReplyTo(null);
        },
      }
    );
  }, [commentText, id, replyTo, createComment]);

  const handleToggleLike = useCallback(() => {
    if (!id) return;
    toggleReaction.mutate({ postId: id, reactionType: 'like' });
  }, [id, toggleReaction]);

  const handleVote = useCallback(
    (optionIndex: number) => {
      if (!id) return;
      votePoll.mutate({ postId: id, optionIndex });
    },
    [id, votePoll]
  );

  if (postLoading || !post) {
    return (
      <View style={styles.container}>
        <AmbientBackground />
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <Ionicons name="chevron-back" size={20} color={colors.textBody} />
          </TouchableOpacity>
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </View>
    );
  }

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
  const reactionCounts = (post.reaction_counts ?? {}) as Record<string, number>;
  const likeCount = reactionCounts['like'] ?? 0;
  const mediaUrls = (post.media_urls ?? []) as string[];
  const pollOptions = (post.poll_options ?? []) as { text: string }[];
  const pollResults = (post.poll_results ?? {}) as Record<string, number>;
  const optionVotes = pollOptions.map((_, i) => pollResults[String(i)] ?? 0);
  const totalVotes = optionVotes.reduce((sum, v) => sum + v, 0);
  const maxVotes = Math.max(...optionVotes, 0);

  // Organize comments into threads
  const rootComments = (comments ?? []).filter(
    (c) => !c.parent_comment_id
  );
  const childComments = (comments ?? []).filter(
    (c) => !!c.parent_comment_id
  );

  const getChildrenOf = (parentId: string) =>
    childComments.filter((c) => c.parent_comment_id === parentId);

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
        <Text style={styles.headerTitle}>Post</Text>
        <View style={styles.headerSpacer} />
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
        >
          {/* Post Card */}
          <View style={styles.postCard}>
            {/* Pinned */}
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
                    { backgroundColor: getAvatarColor(authorName) },
                  ]}
                >
                  <Text style={styles.avatarInitials}>
                    {getInitials(author?.first_name, author?.paternal_surname)}
                  </Text>
                </View>
              )}
              <View style={styles.authorInfo}>
                <Text style={styles.authorName}>{authorName}</Text>
                <Text style={styles.authorMeta}>
                  {channel?.name ?? ''}
                  {channel ? ' - ' : ''}
                  {formatRelative(post.created_at)}
                </Text>
              </View>
            </View>

            {/* Title */}
            {post.title && (
              <Text style={styles.postTitle}>{post.title}</Text>
            )}

            {/* Content */}
            <Text style={styles.postContent}>{post.content}</Text>

            {/* Media */}
            {mediaUrls.length > 0 && (
              <View style={styles.mediaSection}>
                {mediaUrls.map((url, index) => (
                  <View key={index} style={styles.mediaItem}>
                    <Image
                      source={{ uri: url }}
                      style={styles.mediaImage}
                      resizeMode="cover"
                    />
                  </View>
                ))}
              </View>
            )}

            {/* Poll */}
            {post.post_type === 'poll' && pollOptions.length > 0 && (
              <View style={styles.pollContainer}>
                {pollOptions.map((option, index) => {
                  const votes = optionVotes[index];
                  const percentage =
                    totalVotes > 0
                      ? Math.round((votes / totalVotes) * 100)
                      : 0;
                  const isLeading = votes > 0 && votes === maxVotes;

                  return (
                    <TouchableOpacity
                      key={index}
                      style={styles.pollOption}
                      onPress={() => handleVote(index)}
                    >
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
                            isLeading
                              ? styles.pollBarFillLeading
                              : styles.pollBarFillDefault,
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
                    </TouchableOpacity>
                  );
                })}
                <Text style={styles.pollTotalVotes}>
                  {totalVotes} vote{totalVotes !== 1 ? 's' : ''}
                </Text>
              </View>
            )}

            {/* Reaction bar */}
            <View style={styles.reactionBar}>
              <View style={styles.reactionLeft}>
                <TouchableOpacity
                  style={styles.reactionButton}
                  onPress={handleToggleLike}
                >
                  <Ionicons
                    name={likeCount > 0 ? 'heart' : 'heart-outline'}
                    size={22}
                    color={likeCount > 0 ? '#F43F5E' : colors.textCaption}
                  />
                  <Text
                    style={[
                      styles.reactionCount,
                      likeCount > 0 && styles.reactionCountActive,
                    ]}
                  >
                    {likeCount}
                  </Text>
                </TouchableOpacity>
                <View style={styles.reactionButton}>
                  <Ionicons
                    name="chatbubble-outline"
                    size={22}
                    color={colors.primary}
                  />
                  <Text style={[styles.reactionCount, styles.reactionCountBlue]}>
                    {post.comment_count ?? 0}
                  </Text>
                </View>
                <View style={styles.reactionButton}>
                  <Ionicons
                    name="eye-outline"
                    size={22}
                    color={colors.textCaption}
                  />
                  <Text style={styles.reactionCount}>
                    {post.view_count ?? 0}
                  </Text>
                </View>
              </View>
            </View>
          </View>

          {/* Comments Section */}
          <View style={styles.commentsSection}>
            <Text style={styles.commentsTitle}>
              Comments ({(comments ?? []).length})
            </Text>

            {commentsLoading ? (
              <ActivityIndicator
                size="small"
                color={colors.primary}
                style={styles.commentsLoader}
              />
            ) : (comments ?? []).length === 0 ? (
              <View style={styles.noComments}>
                <Ionicons
                  name="chatbubble-ellipses-outline"
                  size={32}
                  color={colors.textDisabled}
                />
                <Text style={styles.noCommentsText}>
                  No comments yet. Be the first!
                </Text>
              </View>
            ) : (
              <View style={styles.commentsList}>
                {rootComments.map((comment) => {
                  const cAuthor = comment.residents as {
                    id: string;
                    first_name: string;
                    paternal_surname: string;
                    photo_url: string | null;
                  } | null;
                  const cName = cAuthor
                    ? `${cAuthor.first_name} ${cAuthor.paternal_surname}`
                    : 'Unknown';
                  const children = getChildrenOf(comment.id);

                  return (
                    <View key={comment.id}>
                      {/* Root comment */}
                      <View style={styles.commentItem}>
                        {cAuthor?.photo_url ? (
                          <Image
                            source={{ uri: cAuthor.photo_url }}
                            style={styles.commentAvatar}
                          />
                        ) : (
                          <View
                            style={[
                              styles.commentAvatarPlaceholder,
                              { backgroundColor: getAvatarColor(cName) },
                            ]}
                          >
                            <Text style={styles.commentAvatarInitials}>
                              {getInitials(
                                cAuthor?.first_name,
                                cAuthor?.paternal_surname
                              )}
                            </Text>
                          </View>
                        )}
                        <View style={styles.commentBubble}>
                          <Text style={styles.commentAuthor}>{cName}</Text>
                          <Text style={styles.commentContent}>
                            {comment.content}
                          </Text>
                          <View style={styles.commentFooter}>
                            <Text style={styles.commentTime}>
                              {formatRelative(comment.created_at)}
                            </Text>
                            <TouchableOpacity
                              onPress={() => setReplyTo(comment.id)}
                            >
                              <Text style={styles.commentReply}>Reply</Text>
                            </TouchableOpacity>
                          </View>
                        </View>
                      </View>

                      {/* Child comments */}
                      {children.map((child) => {
                        const childAuthor = child.residents as {
                          id: string;
                          first_name: string;
                          paternal_surname: string;
                          photo_url: string | null;
                        } | null;
                        const childName = childAuthor
                          ? `${childAuthor.first_name} ${childAuthor.paternal_surname}`
                          : 'Unknown';

                        return (
                          <View
                            key={child.id}
                            style={styles.childCommentItem}
                          >
                            {childAuthor?.photo_url ? (
                              <Image
                                source={{ uri: childAuthor.photo_url }}
                                style={styles.commentAvatar}
                              />
                            ) : (
                              <View
                                style={[
                                  styles.commentAvatarPlaceholder,
                                  {
                                    backgroundColor:
                                      getAvatarColor(childName),
                                  },
                                ]}
                              >
                                <Text style={styles.commentAvatarInitials}>
                                  {getInitials(
                                    childAuthor?.first_name,
                                    childAuthor?.paternal_surname
                                  )}
                                </Text>
                              </View>
                            )}
                            <View style={styles.commentBubble}>
                              <Text style={styles.commentAuthor}>
                                {childName}
                              </Text>
                              <Text style={styles.commentContent}>
                                {child.content}
                              </Text>
                              <Text style={styles.commentTime}>
                                {formatRelative(child.created_at)}
                              </Text>
                            </View>
                          </View>
                        );
                      })}
                    </View>
                  );
                })}
              </View>
            )}
          </View>
        </ScrollView>

        {/* Comment Input */}
        {!post.is_locked && (
          <View style={styles.commentInputContainer}>
            {replyTo && (
              <View style={styles.replyIndicator}>
                <Text style={styles.replyIndicatorText}>
                  Replying to comment
                </Text>
                <TouchableOpacity onPress={() => setReplyTo(null)}>
                  <Ionicons
                    name="close-circle"
                    size={16}
                    color={colors.textCaption}
                  />
                </TouchableOpacity>
              </View>
            )}
            <View style={styles.commentInputRow}>
              <TextInput
                style={styles.commentInput}
                placeholder="Write a comment..."
                placeholderTextColor={colors.textCaption}
                value={commentText}
                onChangeText={setCommentText}
                multiline
                maxLength={1000}
              />
              <TouchableOpacity
                style={[
                  styles.sendButton,
                  !commentText.trim() && styles.sendButtonDisabled,
                ]}
                onPress={handleSendComment}
                disabled={!commentText.trim() || createComment.isPending}
              >
                {createComment.isPending ? (
                  <ActivityIndicator size="small" color={colors.textOnDark} />
                ) : (
                  <Ionicons name="send" size={18} color={colors.textOnDark} />
                )}
              </TouchableOpacity>
            </View>
          </View>
        )}
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
    paddingTop: spacing.safeAreaTop,
    paddingHorizontal: spacing.pagePaddingX,
    paddingBottom: spacing.xl,
    gap: spacing.lg,
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
    flex: 1,
    fontFamily: fonts.bold,
    fontSize: 18,
    color: colors.textPrimary,
  },
  headerSpacer: {
    width: 40,
  },
  // Loading
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
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
    paddingBottom: spacing['3xl'],
  },
  // Post Card
  postCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius['2xl'],
    padding: spacing.cardPadding,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing['3xl'],
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
    fontSize: 18,
    color: colors.textPrimary,
    marginBottom: spacing.md,
  },
  postContent: {
    fontFamily: fonts.medium,
    fontSize: 15,
    color: colors.textSecondary,
    lineHeight: 24,
    marginBottom: spacing.xl,
  },
  // Media
  mediaSection: {
    gap: spacing.md,
    marginBottom: spacing.xl,
  },
  mediaItem: {
    borderRadius: borderRadius.xl,
    overflow: 'hidden',
    aspectRatio: 4 / 3,
  },
  mediaImage: {
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
  pollTotalVotes: {
    fontFamily: fonts.medium,
    fontSize: 12,
    color: colors.textCaption,
    textAlign: 'center',
    marginTop: spacing.md,
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
    gap: spacing['3xl'],
  },
  reactionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  reactionCount: {
    fontFamily: fonts.bold,
    fontSize: 13,
    color: colors.textCaption,
  },
  reactionCountActive: {
    color: '#F43F5E',
  },
  reactionCountBlue: {
    color: colors.primary,
  },
  // Comments section
  commentsSection: {
    marginBottom: spacing['3xl'],
  },
  commentsTitle: {
    fontFamily: fonts.bold,
    fontSize: 16,
    color: colors.textPrimary,
    marginBottom: spacing.xl,
  },
  commentsLoader: {
    paddingVertical: spacing['3xl'],
  },
  noComments: {
    alignItems: 'center',
    paddingVertical: spacing['4xl'],
    gap: spacing.md,
  },
  noCommentsText: {
    fontFamily: fonts.medium,
    fontSize: 14,
    color: colors.textCaption,
  },
  commentsList: {
    gap: spacing.xl,
  },
  commentItem: {
    flexDirection: 'row',
    gap: spacing.lg,
    marginBottom: spacing.lg,
  },
  childCommentItem: {
    flexDirection: 'row',
    gap: spacing.lg,
    marginLeft: 40,
    marginBottom: spacing.lg,
    paddingLeft: spacing.xl,
    borderLeftWidth: 2,
    borderLeftColor: colors.border,
  },
  commentAvatar: {
    width: 28,
    height: 28,
    borderRadius: borderRadius.full,
  },
  commentAvatarPlaceholder: {
    width: 28,
    height: 28,
    borderRadius: borderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  commentAvatarInitials: {
    fontFamily: fonts.bold,
    fontSize: 10,
    color: colors.textOnDark,
  },
  commentBubble: {
    flex: 1,
    backgroundColor: colors.border,
    borderRadius: borderRadius.lg,
    borderTopLeftRadius: 0,
    padding: spacing.lg,
  },
  commentAuthor: {
    fontFamily: fonts.black,
    fontSize: 11,
    color: colors.textPrimary,
    marginBottom: 2,
  },
  commentContent: {
    fontFamily: fonts.regular,
    fontSize: 13,
    color: colors.textBody,
    lineHeight: 20,
  },
  commentFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xl,
    marginTop: spacing.md,
  },
  commentTime: {
    fontFamily: fonts.medium,
    fontSize: 11,
    color: colors.textCaption,
    marginTop: spacing.xs,
  },
  commentReply: {
    fontFamily: fonts.bold,
    fontSize: 11,
    color: colors.primary,
  },
  // Comment Input
  commentInputContainer: {
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingHorizontal: spacing.pagePaddingX,
    paddingTop: spacing.lg,
    paddingBottom: spacing.safeAreaBottom,
  },
  replyIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.primaryLight,
    borderRadius: borderRadius.sm,
    marginBottom: spacing.md,
  },
  replyIndicatorText: {
    fontFamily: fonts.medium,
    fontSize: 12,
    color: colors.primary,
  },
  commentInputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.lg,
  },
  commentInput: {
    flex: 1,
    minHeight: 40,
    maxHeight: 100,
    backgroundColor: colors.border,
    borderRadius: borderRadius.xl,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.lg,
    fontFamily: fonts.medium,
    fontSize: 14,
    color: colors.textPrimary,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.full,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: colors.textDisabled,
  },
});
