import { useState, useCallback, useRef, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  FlatList,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTicketDetail, useAddComment } from '@/hooks/useTickets';
import { formatDate, formatRelative } from '@/lib/dates';
import { AmbientBackground } from '@/components/ui/AmbientBackground';
import { GlassCard } from '@/components/ui/GlassCard';
import { colors, fonts, spacing, borderRadius, shadows } from '@/theme';

function getStatusStyle(status: string): { bg: string; color: string; label: string } {
  switch (status) {
    case 'open':
      return { bg: colors.primaryLight, color: colors.primary, label: 'Open' };
    case 'in_progress':
      return { bg: colors.warningBg, color: colors.warningText, label: 'In Progress' };
    case 'resolved':
      return { bg: colors.successBg, color: colors.successText, label: 'Resolved' };
    case 'closed':
      return { bg: colors.border, color: colors.textCaption, label: 'Closed' };
    default:
      return { bg: colors.border, color: colors.textCaption, label: status };
  }
}

function getPriorityStyle(priority: string): { bg: string; color: string; label: string } {
  switch (priority) {
    case 'low':
      return { bg: colors.border, color: colors.textCaption, label: 'Low' };
    case 'medium':
      return { bg: colors.warningBg, color: colors.warningText, label: 'Medium' };
    case 'high':
      return { bg: colors.orangeBg, color: colors.orange, label: 'High' };
    case 'urgent':
      return { bg: colors.dangerBg, color: colors.dangerText, label: 'Urgent' };
    default:
      return { bg: colors.border, color: colors.textCaption, label: priority };
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
  };
  return iconMap[icon] ?? 'construct-outline';
}

function getStatusLabel(status: string): string {
  switch (status) {
    case 'open': return 'Open';
    case 'in_progress': return 'In Progress';
    case 'resolved': return 'Resolved';
    case 'closed': return 'Closed';
    default: return status;
  }
}

interface TicketComment {
  id: string;
  content: string;
  author_id: string;
  author_role: string;
  is_system: boolean;
  is_internal: boolean;
  photo_urls: string[] | null;
  created_at: string;
  status_from: string | null;
  status_to: string | null;
}

export default function TicketDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: ticket, isLoading } = useTicketDetail(id ?? '');
  const addCommentMutation = useAddComment();

  const [commentText, setCommentText] = useState('');
  const inputRef = useRef<TextInput>(null);

  const comments = useMemo(() => {
    if (!ticket?.ticket_comments) return [];
    const allComments = ticket.ticket_comments as TicketComment[];
    // Filter out internal comments for resident view
    return allComments
      .filter((c) => !c.is_internal)
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
  }, [ticket]);

  const handleSendComment = useCallback(async () => {
    if (!commentText.trim() || !id || addCommentMutation.isPending) return;

    try {
      await addCommentMutation.mutateAsync({
        ticket_id: id,
        content: commentText.trim(),
      });
      setCommentText('');
    } catch (error: any) {
      // Silent fail - user can retry
    }
  }, [commentText, id, addCommentMutation]);

  if (isLoading || !ticket) {
    return (
      <View style={styles.container}>
        <AmbientBackground />
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="chevron-back" size={24} color={colors.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Loading...</Text>
          <View style={styles.headerSpacer} />
        </View>
        <ActivityIndicator color={colors.primary} style={styles.mainLoader} />
      </View>
    );
  }

  const category = ticket.ticket_categories as { name: string; icon: string | null; color: string | null } | null;
  const statusStyle = getStatusStyle(ticket.status);
  const priorityStyle = getPriorityStyle(ticket.priority);

  const renderHeader = () => (
    <View>
      {/* Status + Priority Badges */}
      <View style={styles.badgeRow}>
        <View style={[styles.badge, { backgroundColor: statusStyle.bg }]}>
          <Text style={[styles.badgeText, { color: statusStyle.color }]}>{statusStyle.label}</Text>
        </View>
        <View style={[styles.badge, { backgroundColor: priorityStyle.bg }]}>
          <Text style={[styles.badgeText, { color: priorityStyle.color }]}>
            {priorityStyle.label} Priority
          </Text>
        </View>
      </View>

      {/* Category Tag */}
      {category && (
        <View style={styles.categoryTag}>
          <View
            style={[
              styles.categoryTagIcon,
              { backgroundColor: category.color ? `${category.color}15` : colors.primaryLight },
            ]}
          >
            <Ionicons
              name={getCategoryIcon(category.icon) as any}
              size={14}
              color={category.color ?? colors.primary}
            />
          </View>
          <Text style={styles.categoryTagText}>{category.name}</Text>
        </View>
      )}

      {/* Description */}
      <View style={styles.descriptionSection}>
        <Text style={styles.sectionTitle}>DESCRIPTION</Text>
        <GlassCard style={styles.descriptionCard}>
          <Text style={styles.descriptionText}>{ticket.description}</Text>
        </GlassCard>
      </View>

      {/* Created Date */}
      <View style={styles.metaRow}>
        <Ionicons name="calendar-outline" size={14} color={colors.textCaption} />
        <Text style={styles.metaText}>Created {formatDate(ticket.created_at)}</Text>
      </View>

      {/* Timeline Header */}
      <View style={styles.timelineHeader}>
        <Text style={styles.sectionTitle}>ACTIVITY</Text>
        <Text style={styles.commentCount}>{comments.length} entries</Text>
      </View>
    </View>
  );

  const renderComment = ({ item }: { item: TicketComment }) => {
    // Status change event
    if (item.status_from && item.status_to) {
      return (
        <View style={styles.statusChange}>
          <View style={styles.statusChangeDot} />
          <View style={styles.statusChangeContent}>
            <View style={styles.statusChangeRow}>
              <View style={[styles.statusFromTo, { backgroundColor: getStatusStyle(item.status_from).bg }]}>
                <Text style={[styles.statusFromToText, { color: getStatusStyle(item.status_from).color }]}>
                  {getStatusLabel(item.status_from)}
                </Text>
              </View>
              <Ionicons name="arrow-forward" size={12} color={colors.textCaption} />
              <View style={[styles.statusFromTo, { backgroundColor: getStatusStyle(item.status_to).bg }]}>
                <Text style={[styles.statusFromToText, { color: getStatusStyle(item.status_to).color }]}>
                  {getStatusLabel(item.status_to)}
                </Text>
              </View>
            </View>
            <Text style={styles.statusChangeDate}>{formatRelative(item.created_at)}</Text>
          </View>
        </View>
      );
    }

    // System message
    if (item.is_system) {
      return (
        <View style={styles.systemMessage}>
          <View style={styles.systemDot} />
          <View style={styles.systemContent}>
            <Text style={styles.systemText}>{item.content}</Text>
            <Text style={styles.systemDate}>{formatRelative(item.created_at)}</Text>
          </View>
        </View>
      );
    }

    // User comment
    return (
      <View style={styles.commentItem}>
        <View style={styles.commentAvatar}>
          <Ionicons
            name={item.author_role === 'reporter' ? 'person-outline' : 'build-outline'}
            size={16}
            color={item.author_role === 'reporter' ? colors.primary : colors.teal}
          />
        </View>
        <View style={styles.commentBubble}>
          <View style={styles.commentBubbleHeader}>
            <Text style={styles.commentRole}>
              {item.author_role === 'reporter' ? 'You' : 'Staff'}
            </Text>
            <Text style={styles.commentDate}>{formatRelative(item.created_at)}</Text>
          </View>
          <Text style={styles.commentContent}>{item.content}</Text>
          {item.photo_urls && item.photo_urls.length > 0 && (
            <View style={styles.commentPhotos}>
              <Ionicons name="images-outline" size={14} color={colors.primary} />
              <Text style={styles.commentPhotoCount}>
                {item.photo_urls.length} photo{item.photo_urls.length > 1 ? 's' : ''} attached
              </Text>
            </View>
          )}
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <AmbientBackground />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="chevron-back" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {ticket.title}
        </Text>
        <View style={styles.headerSpacer} />
      </View>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
      >
        {/* Comments Timeline */}
        <FlatList
          data={comments}
          keyExtractor={(item) => item.id}
          renderItem={renderComment}
          ListHeaderComponent={renderHeader}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.emptyTimeline}>
              <Ionicons name="chatbubbles-outline" size={32} color={colors.textDisabled} />
              <Text style={styles.emptyTimelineText}>No activity yet</Text>
            </View>
          }
        />

        {/* Comment Input */}
        <View style={styles.inputBar}>
          <View style={styles.commentInputContainer}>
            <TextInput
              ref={inputRef}
              style={styles.commentInput}
              value={commentText}
              onChangeText={setCommentText}
              placeholder="Add a comment..."
              placeholderTextColor={colors.textDisabled}
              multiline
              maxLength={1000}
            />
          </View>
          <TouchableOpacity
            style={[
              styles.sendButton,
              (!commentText.trim() || addCommentMutation.isPending) && styles.sendButtonDisabled,
            ]}
            onPress={handleSendComment}
            disabled={!commentText.trim() || addCommentMutation.isPending}
          >
            {addCommentMutation.isPending ? (
              <ActivityIndicator color={colors.textOnDark} size="small" />
            ) : (
              <Ionicons name="send" size={18} color={colors.textOnDark} />
            )}
          </TouchableOpacity>
        </View>
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
    flex: 1,
    fontFamily: fonts.bold,
    fontSize: 18,
    color: colors.textPrimary,
    letterSpacing: -0.5,
    textAlign: 'center',
    marginHorizontal: spacing.lg,
  },
  headerSpacer: {
    width: 40,
  },
  mainLoader: {
    flex: 1,
    justifyContent: 'center',
  },
  // Content
  listContent: {
    paddingHorizontal: spacing.pagePaddingX,
    paddingTop: spacing.md,
    paddingBottom: spacing.xl,
  },
  // Badges
  badgeRow: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.xl,
  },
  badge: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.sm,
  },
  badgeText: {
    fontFamily: fonts.bold,
    fontSize: 11,
    textTransform: 'uppercase',
  },
  // Category
  categoryTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing['3xl'],
  },
  categoryTagIcon: {
    width: 28,
    height: 28,
    borderRadius: borderRadius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryTagText: {
    fontFamily: fonts.bold,
    fontSize: 12,
    color: colors.textBody,
  },
  // Description
  descriptionSection: {
    marginBottom: spacing['3xl'],
  },
  sectionTitle: {
    fontFamily: fonts.bold,
    fontSize: 10,
    color: colors.textCaption,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    marginLeft: 4,
    marginBottom: spacing.md,
  },
  descriptionCard: {
    padding: spacing.xl,
    borderRadius: borderRadius.lg,
  },
  descriptionText: {
    fontFamily: fonts.medium,
    fontSize: 14,
    color: colors.textBody,
    lineHeight: 22,
  },
  // Meta
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing['3xl'],
  },
  metaText: {
    fontFamily: fonts.medium,
    fontSize: 12,
    color: colors.textCaption,
  },
  // Timeline
  timelineHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginBottom: spacing.xl,
  },
  commentCount: {
    fontFamily: fonts.medium,
    fontSize: 11,
    color: colors.textCaption,
    marginBottom: spacing.md,
  },
  // Status Change
  statusChange: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.lg,
    marginBottom: spacing.xl,
  },
  statusChangeDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.borderMedium,
    marginTop: 6,
  },
  statusChangeContent: {
    flex: 1,
  },
  statusChangeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.xs,
  },
  statusFromTo: {
    paddingHorizontal: spacing.md,
    paddingVertical: 3,
    borderRadius: borderRadius.sm,
  },
  statusFromToText: {
    fontFamily: fonts.bold,
    fontSize: 10,
    textTransform: 'uppercase',
  },
  statusChangeDate: {
    fontFamily: fonts.medium,
    fontSize: 10,
    color: colors.textCaption,
  },
  // System Message
  systemMessage: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.lg,
    marginBottom: spacing.xl,
  },
  systemDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.border,
    marginTop: 6,
  },
  systemContent: {
    flex: 1,
    backgroundColor: colors.border,
    borderRadius: borderRadius.md,
    padding: spacing.lg,
  },
  systemText: {
    fontFamily: fonts.medium,
    fontSize: 13,
    color: colors.textMuted,
    fontStyle: 'italic',
  },
  systemDate: {
    fontFamily: fonts.medium,
    fontSize: 10,
    color: colors.textCaption,
    marginTop: spacing.xs,
  },
  // User Comment
  commentItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.lg,
    marginBottom: spacing.xl,
  },
  commentAvatar: {
    width: 32,
    height: 32,
    borderRadius: borderRadius.full,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  commentBubble: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
  },
  commentBubbleHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  commentRole: {
    fontFamily: fonts.bold,
    fontSize: 12,
    color: colors.textSecondary,
  },
  commentDate: {
    fontFamily: fonts.medium,
    fontSize: 10,
    color: colors.textCaption,
  },
  commentContent: {
    fontFamily: fonts.medium,
    fontSize: 14,
    color: colors.textBody,
    lineHeight: 20,
  },
  commentPhotos: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  commentPhotoCount: {
    fontFamily: fonts.medium,
    fontSize: 12,
    color: colors.primary,
  },
  // Empty Timeline
  emptyTimeline: {
    alignItems: 'center',
    paddingVertical: spacing['4xl'],
    gap: spacing.md,
  },
  emptyTimelineText: {
    fontFamily: fonts.medium,
    fontSize: 14,
    color: colors.textMuted,
  },
  // Input Bar
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.lg,
    paddingHorizontal: spacing.pagePaddingX,
    paddingVertical: spacing.lg,
    paddingBottom: spacing.safeAreaBottom + spacing.lg,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  commentInputContainer: {
    flex: 1,
    minHeight: 44,
    maxHeight: 100,
    backgroundColor: colors.background,
    borderRadius: borderRadius.lg,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.lg,
    justifyContent: 'center',
  },
  commentInput: {
    fontFamily: fonts.medium,
    fontSize: 14,
    color: colors.textPrimary,
    maxHeight: 80,
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: borderRadius.full,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.sm,
  },
  sendButtonDisabled: {
    backgroundColor: colors.textDisabled,
  },
});
