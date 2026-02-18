import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  StyleSheet,
  Pressable,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { format, parseISO } from 'date-fns';
import { colors, fonts, spacing, borderRadius } from '@/theme';
import { ReactionPicker } from './ReactionPicker';
import type { ChatMessage } from '@/hooks/useChat';

const EMOJI_MAP: Record<string, string> = {
  heart: '\u2764\uFE0F',
  thumbs_up: '\uD83D\uDC4D',
  laugh: '\uD83D\uDE02',
  wow: '\uD83D\uDE2E',
  sad: '\uD83D\uDE22',
  pray: '\uD83D\uDE4F',
};

interface MessageBubbleProps {
  message: ChatMessage;
  isOwn: boolean;
  isRead: boolean;
  showSender: boolean;
  onLongPress: (message: ChatMessage) => void;
  onReaction: (messageId: string, reaction: string) => void;
  onMediaPress: (uri: string) => void;
  onReplyPress: (messageId: string) => void;
  currentUserId: string;
}

export const MessageBubble = React.memo(
  function MessageBubble({
    message,
    isOwn,
    isRead,
    showSender,
    onLongPress,
    onReaction,
    onMediaPress,
    onReplyPress,
    currentUserId,
  }: MessageBubbleProps) {
    const [showReactionPicker, setShowReactionPicker] = useState(false);

    // System message
    if (message.message_type === 'system') {
      return (
        <View style={styles.systemContainer}>
          <Text style={styles.systemText}>
            {message.content ?? ''}
          </Text>
        </View>
      );
    }

    // Deleted message
    if (message.is_deleted) {
      return (
        <View
          style={[
            styles.bubbleContainer,
            isOwn ? styles.ownContainer : styles.otherContainer,
          ]}
        >
          <View
            style={[
              styles.bubble,
              styles.deletedBubble,
              isOwn ? styles.ownBubble : styles.otherBubble,
            ]}
          >
            <Ionicons name="trash-outline" size={14} color={colors.textCaption} />
            <Text style={styles.deletedText}>Message deleted</Text>
          </View>
        </View>
      );
    }

    const time = format(parseISO(message.created_at), 'HH:mm');

    // Group reactions by emoji
    const reactionGroups = (message.reactions ?? []).reduce<
      Record<string, { count: number; hasOwn: boolean }>
    >((acc, r) => {
      if (!acc[r.reaction]) acc[r.reaction] = { count: 0, hasOwn: false };
      acc[r.reaction].count++;
      if (r.user_id === currentUserId) acc[r.reaction].hasOwn = true;
      return acc;
    }, {});

    return (
      <View>
        {/* Reaction picker overlay */}
        {showReactionPicker && (
          <View
            style={[
              styles.reactionPickerWrapper,
              isOwn
                ? styles.reactionPickerRight
                : styles.reactionPickerLeft,
            ]}
          >
            <ReactionPicker
              visible
              onSelect={(reaction) => {
                setShowReactionPicker(false);
                onReaction(message.id, reaction);
              }}
            />
          </View>
        )}

        <Pressable
          style={[
            styles.bubbleContainer,
            isOwn ? styles.ownContainer : styles.otherContainer,
          ]}
          onLongPress={() => {
            setShowReactionPicker(true);
            onLongPress(message);
          }}
          delayLongPress={300}
        >
          <View
            style={[
              styles.bubble,
              isOwn ? styles.ownBubble : styles.otherBubble,
              message._optimistic && styles.optimisticBubble,
            ]}
          >
            {/* Sender name (for group chats) */}
            {showSender && !isOwn && (
              <Text style={styles.senderName}>
                {message.sender_name}
              </Text>
            )}

            {/* Reply preview */}
            {message.reply_to && (
              <TouchableOpacity
                style={styles.replyPreview}
                onPress={() => onReplyPress(message.reply_to!.id)}
                activeOpacity={0.7}
              >
                <View style={styles.replyAccent} />
                <View style={styles.replyContent}>
                  <Text style={styles.replyName}>
                    {message.reply_to.sender_name}
                  </Text>
                  <Text style={styles.replyText} numberOfLines={1}>
                    {message.reply_to.content ?? 'Media'}
                  </Text>
                </View>
              </TouchableOpacity>
            )}

            {/* Media */}
            {message.media_urls && message.media_urls.length > 0 && (
              <View style={styles.mediaContainer}>
                {message.media_urls.map((url, i) => (
                  <TouchableOpacity
                    key={i}
                    onPress={() => onMediaPress(url)}
                    activeOpacity={0.9}
                  >
                    <Image
                      source={{ uri: url }}
                      style={styles.mediaImage}
                      resizeMode="cover"
                    />
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {/* Text content */}
            {message.content && (
              <Text
                style={[
                  styles.messageText,
                  isOwn ? styles.ownText : styles.otherText,
                ]}
              >
                {message.content}
              </Text>
            )}

            {/* Footer: time + edited + read status */}
            <View style={styles.footer}>
              {message.is_edited && (
                <Text style={[styles.editedLabel, isOwn && styles.ownMeta]}>
                  edited
                </Text>
              )}
              <Text style={[styles.time, isOwn && styles.ownMeta]}>
                {time}
              </Text>
              {isOwn && !message._optimistic && (
                <Ionicons
                  name={isRead ? 'checkmark-done' : 'checkmark'}
                  size={14}
                  color={isRead ? '#34D399' : 'rgba(255,255,255,0.5)'}
                />
              )}
              {message._optimistic && (
                <Ionicons
                  name="time-outline"
                  size={12}
                  color="rgba(255,255,255,0.5)"
                />
              )}
            </View>
          </View>
        </Pressable>

        {/* Reaction chips */}
        {Object.keys(reactionGroups).length > 0 && (
          <View
            style={[
              styles.reactionsRow,
              isOwn ? styles.reactionsRight : styles.reactionsLeft,
            ]}
          >
            {Object.entries(reactionGroups).map(([key, val]) => (
              <TouchableOpacity
                key={key}
                style={[
                  styles.reactionChip,
                  val.hasOwn && styles.reactionChipOwn,
                ]}
                onPress={() => onReaction(message.id, key)}
                activeOpacity={0.7}
              >
                <Text style={styles.reactionEmoji}>
                  {EMOJI_MAP[key] ?? key}
                </Text>
                {val.count > 1 && (
                  <Text style={styles.reactionCount}>{val.count}</Text>
                )}
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>
    );
  },
  (prev, next) =>
    prev.message.id === next.message.id &&
    prev.message.content === next.message.content &&
    prev.message.is_edited === next.message.is_edited &&
    prev.message.is_deleted === next.message.is_deleted &&
    prev.message._optimistic === next.message._optimistic &&
    prev.isOwn === next.isOwn &&
    prev.isRead === next.isRead &&
    prev.showSender === next.showSender &&
    JSON.stringify(prev.message.reactions) ===
      JSON.stringify(next.message.reactions)
);

const styles = StyleSheet.create({
  // System message
  systemContainer: {
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing['4xl'],
  },
  systemText: {
    fontFamily: fonts.medium,
    fontSize: 12,
    color: colors.textCaption,
    textAlign: 'center',
  },

  // Bubble layout
  bubbleContainer: {
    paddingHorizontal: spacing.xl,
    paddingVertical: 2,
    maxWidth: '100%',
  },
  ownContainer: {
    alignItems: 'flex-end',
  },
  otherContainer: {
    alignItems: 'flex-start',
  },

  // Bubble styles
  bubble: {
    maxWidth: '78%',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: borderRadius.xl,
  },
  ownBubble: {
    backgroundColor: colors.primary,
    borderBottomRightRadius: 4,
  },
  otherBubble: {
    backgroundColor: colors.surface,
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: colors.border,
  },
  optimisticBubble: {
    opacity: 0.7,
  },
  deletedBubble: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    opacity: 0.6,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.borderMedium,
  },
  deletedText: {
    fontFamily: fonts.medium,
    fontSize: 13,
    color: colors.textCaption,
    fontStyle: 'italic',
  },

  // Sender
  senderName: {
    fontFamily: fonts.bold,
    fontSize: 12,
    color: colors.primary,
    marginBottom: 4,
  },

  // Reply preview
  replyPreview: {
    flexDirection: 'row',
    marginBottom: spacing.md,
    borderRadius: spacing.md,
    backgroundColor: 'rgba(0,0,0,0.06)',
    overflow: 'hidden',
  },
  replyAccent: {
    width: 3,
    backgroundColor: colors.teal,
  },
  replyContent: {
    flex: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  replyName: {
    fontFamily: fonts.bold,
    fontSize: 11,
    color: colors.teal,
  },
  replyText: {
    fontFamily: fonts.medium,
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 1,
  },

  // Media
  mediaContainer: {
    marginBottom: spacing.md,
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
    gap: 4,
  },
  mediaImage: {
    width: 220,
    height: 165,
    borderRadius: borderRadius.md,
  },

  // Text
  messageText: {
    fontFamily: fonts.medium,
    fontSize: 15,
    lineHeight: 21,
  },
  ownText: {
    color: colors.textOnDark,
  },
  otherText: {
    color: colors.textPrimary,
  },

  // Footer
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 4,
    marginTop: 4,
  },
  time: {
    fontFamily: fonts.medium,
    fontSize: 10,
    color: colors.textCaption,
  },
  ownMeta: {
    color: 'rgba(255,255,255,0.6)',
  },
  editedLabel: {
    fontFamily: fonts.medium,
    fontSize: 10,
    color: colors.textCaption,
    fontStyle: 'italic',
  },

  // Reactions
  reactionPickerWrapper: {
    position: 'absolute',
    top: -50,
    zIndex: 10,
  },
  reactionPickerLeft: {
    left: spacing.xl,
  },
  reactionPickerRight: {
    right: spacing.xl,
  },
  reactionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    paddingHorizontal: spacing.xl,
    marginTop: -2,
    marginBottom: 4,
  },
  reactionsLeft: {
    justifyContent: 'flex-start',
  },
  reactionsRight: {
    justifyContent: 'flex-end',
  },
  reactionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: colors.background,
    borderRadius: borderRadius.full,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: colors.borderMedium,
  },
  reactionChipOwn: {
    borderColor: colors.primaryLightAlt,
    backgroundColor: colors.primaryLight,
  },
  reactionEmoji: {
    fontSize: 14,
  },
  reactionCount: {
    fontFamily: fonts.bold,
    fontSize: 11,
    color: colors.textMuted,
  },
});
