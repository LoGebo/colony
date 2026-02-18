import React from 'react';
import { View, Text, TouchableOpacity, Image, StyleSheet } from 'react-native';
import { colors, fonts, spacing, borderRadius } from '@/theme';
import { formatDistanceToNow, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import type { ConversationListItem } from '@/hooks/useChat';

const AVATAR_COLORS = [
  '#2563EB', '#7C3AED', '#059669', '#DC2626',
  '#D97706', '#0891B2', '#4F46E5', '#BE185D',
];

function getAvatarColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

function getInitials(name: string): string {
  const parts = name.split(' ').filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return (name[0] ?? '?').toUpperCase();
}

function formatMessageTime(dateStr: string | null): string {
  if (!dateStr) return '';
  return formatDistanceToNow(parseISO(dateStr), { addSuffix: false, locale: es });
}

interface ConversationRowProps {
  conversation: ConversationListItem;
  onPress: () => void;
  onAvatarPress?: () => void;
  isOnline?: boolean;
}

export const ConversationRow = React.memo(
  function ConversationRow({ conversation, onPress, onAvatarPress, isOnline }: ConversationRowProps) {
    const displayName =
      conversation.conversation_type === 'direct'
        ? conversation.other_participant_name ?? 'Chat'
        : conversation.name ?? 'Group';

    const hasUnread = conversation.unread_count > 0;

    return (
      <TouchableOpacity
        style={styles.container}
        onPress={onPress}
        activeOpacity={0.7}
      >
        {/* Avatar */}
        <TouchableOpacity
          style={styles.avatarContainer}
          activeOpacity={onAvatarPress ? 0.7 : 1}
          onPress={onAvatarPress ?? undefined}
          disabled={!onAvatarPress}
        >
          {conversation.avatar_url ? (
            <Image
              source={{ uri: conversation.avatar_url }}
              style={styles.avatar}
            />
          ) : (
            <View
              style={[
                styles.avatarPlaceholder,
                { backgroundColor: getAvatarColor(displayName) },
              ]}
            >
              <Text style={styles.avatarInitials}>
                {getInitials(displayName)}
              </Text>
            </View>
          )}
          {isOnline && conversation.conversation_type === 'direct' && (
            <View style={styles.onlineDot} />
          )}
        </TouchableOpacity>

        {/* Content */}
        <View style={styles.content}>
          <View style={styles.topRow}>
            <Text
              style={[styles.name, hasUnread && styles.nameUnread]}
              numberOfLines={1}
            >
              {displayName}
            </Text>
            <Text
              style={[styles.time, hasUnread && styles.timeUnread]}
            >
              {formatMessageTime(conversation.last_message_at)}
            </Text>
          </View>
          <View style={styles.bottomRow}>
            <Text
              style={[styles.preview, hasUnread && styles.previewUnread]}
              numberOfLines={1}
            >
              {conversation.last_message_preview ?? 'No messages yet'}
            </Text>
            {hasUnread && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>
                  {conversation.unread_count > 99
                    ? '99+'
                    : conversation.unread_count}
                </Text>
              </View>
            )}
          </View>
        </View>
      </TouchableOpacity>
    );
  },
  (prev, next) =>
    prev.conversation.conversation_id === next.conversation.conversation_id &&
    prev.conversation.unread_count === next.conversation.unread_count &&
    prev.conversation.last_message_preview ===
      next.conversation.last_message_preview &&
    prev.conversation.last_message_at === next.conversation.last_message_at &&
    prev.isOnline === next.isOnline
);

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: spacing.pagePaddingX,
    gap: spacing.lg,
  },
  avatarContainer: {
    position: 'relative',
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: colors.border,
  },
  avatarPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: borderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitials: {
    fontFamily: fonts.bold,
    fontSize: 16,
    color: colors.textOnDark,
  },
  onlineDot: {
    position: 'absolute',
    bottom: 1,
    right: 1,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: colors.success,
    borderWidth: 2,
    borderColor: colors.surface,
  },
  content: {
    flex: 1,
    gap: 4,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  name: {
    fontFamily: fonts.medium,
    fontSize: 15,
    color: colors.textPrimary,
    flex: 1,
    marginRight: spacing.md,
  },
  nameUnread: {
    fontFamily: fonts.bold,
  },
  time: {
    fontFamily: fonts.medium,
    fontSize: 12,
    color: colors.textCaption,
  },
  timeUnread: {
    color: colors.primary,
    fontFamily: fonts.bold,
  },
  bottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  preview: {
    fontFamily: fonts.medium,
    fontSize: 13,
    color: colors.textMuted,
    flex: 1,
    marginRight: spacing.md,
  },
  previewUnread: {
    color: colors.textBody,
    fontFamily: fonts.bold,
  },
  badge: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  badgeText: {
    fontFamily: fonts.bold,
    fontSize: 11,
    color: colors.textOnDark,
  },
});
