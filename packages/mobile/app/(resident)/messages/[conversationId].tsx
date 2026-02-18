import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import {
  useMessages,
  useConversations,
  useSendMessage,
  useMarkAsRead,
  useTypingIndicator,
  useMessageActions,
  useMuteConversation,
  useReadPositions,
} from '@/hooks/useChat';
import { useAuth } from '@/hooks/useAuth';
import { pickAndUploadImage } from '@/lib/upload';
import { showAlert } from '@/lib/alert';
import { supabase } from '@/lib/supabase';
import { MessageBubble } from '@/components/chat/MessageBubble';
import { ChatInput } from '@/components/chat/ChatInput';
import { TypingIndicator } from '@/components/chat/TypingIndicator';
import { DateSeparator } from '@/components/chat/DateSeparator';
import { MediaPreview } from '@/components/chat/MediaPreview';
import { MessageActionSheet } from '@/components/chat/MessageActionSheet';
import { AmbientBackground } from '@/components/ui/AmbientBackground';
import { colors, fonts, spacing } from '@/theme';
import type { ChatMessage } from '@/hooks/useChat';

function isSameDay(a: string, b: string): boolean {
  return a.slice(0, 10) === b.slice(0, 10);
}

export default function ChatScreen() {
  const { conversationId } = useLocalSearchParams<{ conversationId: string }>();
  const router = useRouter();
  const { user, communityId } = useAuth();

  // Hooks
  const {
    data: messagesData,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
  } = useMessages(conversationId);
  const { data: conversationList } = useConversations();
  const sendMessage = useSendMessage();
  const { markRead } = useMarkAsRead(conversationId);
  const { typingUsers, sendTyping, stopTyping } = useTypingIndicator(conversationId);
  const { editMessage, deleteMessage, toggleReaction } = useMessageActions(conversationId ?? '');
  const muteConversation = useMuteConversation();
  const { data: lastReadAt } = useReadPositions(conversationId);

  // State
  const [replyTo, setReplyTo] = useState<{
    messageId: string;
    senderName: string;
    content: string | null;
  } | null>(null);
  const [editingMessage, setEditingMessage] = useState<{
    messageId: string;
    content: string;
  } | null>(null);
  const [mediaPreviewUri, setMediaPreviewUri] = useState<string | null>(null);
  const [actionSheet, setActionSheet] = useState<{
    visible: boolean;
    message: ChatMessage | null;
  }>({ visible: false, message: null });

  const flatListRef = useRef<FlatList>(null);
  const actionSheetActionsRef = useRef<any[]>([]);

  // Get conversation info
  const conversationInfo = useMemo(
    () =>
      conversationList?.find((c) => c.conversation_id === conversationId),
    [conversationList, conversationId]
  );

  const headerTitle =
    conversationInfo?.conversation_type === 'direct'
      ? conversationInfo?.other_participant_name ?? 'Chat'
      : conversationInfo?.name ?? 'Group';

  const isGroup =
    conversationInfo?.conversation_type === 'group' ||
    conversationInfo?.conversation_type === 'guard_booth';

  // Flatten messages
  const messages = useMemo(
    () => messagesData?.pages.flat() ?? [],
    [messagesData]
  );

  // Mark as read on mount and when new messages arrive
  useEffect(() => {
    if (messages.length > 0 && user?.id) {
      const latestMsg = messages[0]; // Newest first (inverted)
      if (latestMsg && !latestMsg._optimistic) {
        markRead(latestMsg.id);
      }
    }
  }, [messages, user?.id, markRead]);

  // Sender name for typing
  const senderNameRef = useRef('');
  useEffect(() => {
    if (!user?.id) return;
    supabase
      .from('residents')
      .select('first_name')
      .eq('user_id', user.id)
      .single()
      .then(({ data }) => {
        senderNameRef.current = data?.first_name ?? 'Someone';
      });
  }, [user?.id]);

  // ── Handlers ────────────────────────────────────────────────

  const handleSend = useCallback(
    (text: string) => {
      sendMessage.mutate({
        conversationId: conversationId!,
        content: text,
        replyToMessageId: replyTo?.messageId,
      });
      setReplyTo(null);
      stopTyping();
    },
    [conversationId, sendMessage, replyTo, stopTyping]
  );

  const handleAttach = useCallback(async () => {
    if (!communityId) return;
    const path = await pickAndUploadImage('chat-media', communityId, 'messages');
    if (!path) return;

    // chat-media is a private bucket - use signed URL with 1-year expiry
    const { data: signedData, error: signError } = await supabase.storage
      .from('chat-media')
      .createSignedUrl(path, 60 * 60 * 24 * 365);

    if (signError || !signedData?.signedUrl) {
      console.error('Failed to create signed URL:', signError);
      return;
    }

    sendMessage.mutate({
      conversationId: conversationId!,
      mediaUrls: [signedData.signedUrl],
      mediaTypes: ['image'],
      replyToMessageId: replyTo?.messageId,
    });
    setReplyTo(null);
  }, [conversationId, communityId, sendMessage, replyTo]);

  const handleTyping = useCallback(() => {
    sendTyping(senderNameRef.current);
  }, [sendTyping]);

  const handleLongPress = useCallback((message: ChatMessage) => {
    const isOwn = message.sender_id === user?.id;
    const actions: { label: string; icon: string; onPress: () => void; destructive?: boolean }[] = [
      {
        label: 'Reply',
        icon: 'arrow-undo-outline',
        onPress: () =>
          setReplyTo({
            messageId: message.id,
            senderName: message.sender_name ?? 'Unknown',
            content: message.content,
          }),
      },
      {
        label: 'Copy',
        icon: 'copy-outline',
        onPress: () => {
          if (message.content) Clipboard.setStringAsync(message.content);
        },
      },
    ];

    if (isOwn) {
      actions.push({
        label: 'Edit',
        icon: 'pencil-outline',
        onPress: () =>
          setEditingMessage({
            messageId: message.id,
            content: message.content ?? '',
          }),
      });
      actions.push({
        label: 'Delete',
        icon: 'trash-outline',
        onPress: () => {
          showAlert('Delete Message', 'Are you sure?', [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Delete',
              style: 'destructive',
              onPress: () => deleteMessage.mutate(message.id),
            },
          ]);
        },
        destructive: true,
      });
    }

    setActionSheet({ visible: true, message });
    // Store actions for the action sheet
    actionSheetActionsRef.current = actions;
  }, [user?.id, deleteMessage]);

  const handleReaction = useCallback(
    (messageId: string, reaction: string) => {
      toggleReaction.mutate({ messageId, reaction });
    },
    [toggleReaction]
  );

  const handleSubmitEdit = useCallback(
    (messageId: string, newContent: string) => {
      editMessage.mutate({ messageId, newContent });
      setEditingMessage(null);
    },
    [editMessage]
  );

  const handleLoadMore = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  // ── Render ──────────────────────────────────────────────────

  const renderItem = useCallback(
    ({ item, index }: { item: ChatMessage; index: number }) => {
      const isOwn = item.sender_id === user?.id;
      const prevMsg = messages[index + 1]; // +1 because inverted
      const showSender =
        isGroup && !isOwn && (!prevMsg || prevMsg.sender_id !== item.sender_id);

      // Date separator check
      const showDate =
        !prevMsg || !isSameDay(item.created_at, prevMsg.created_at);

      // Read receipt: own non-optimistic messages read if sent at or before
      // the other participant's last-read position.
      const isRead =
        isOwn && !item._optimistic && !!lastReadAt && item.created_at <= lastReadAt;

      return (
        <React.Fragment key={item.id}>
          <MessageBubble
            message={item}
            isOwn={isOwn}
            isRead={isRead}
            showSender={showSender}
            onLongPress={handleLongPress}
            onReaction={handleReaction}
            onMediaPress={setMediaPreviewUri}
            onReplyPress={() => {}}
            currentUserId={user?.id ?? ''}
          />
          {showDate && <DateSeparator date={item.created_at} />}
        </React.Fragment>
      );
    },
    [user?.id, messages, isGroup, lastReadAt, handleLongPress, handleReaction]
  );

  const keyExtractor = useCallback((item: ChatMessage) => item.id, []);

  return (
    <View style={styles.container}>
      <AmbientBackground />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backButton}
        >
          <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <View style={styles.headerInfo}>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {headerTitle}
          </Text>
          {isGroup && conversationInfo && (
            <Text style={styles.headerSubtitle}>
              {conversationInfo.participant_count} members
            </Text>
          )}
        </View>
        <TouchableOpacity
          style={styles.moreButton}
          onPress={() => {
            if (!conversationInfo) return;
            const isMuted = conversationInfo.is_muted;
            showAlert(
              isMuted ? 'Unmute Conversation' : 'Mute Conversation',
              isMuted
                ? 'You will receive notifications again.'
                : 'You will not receive notifications for this conversation.',
              [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: isMuted ? 'Unmute' : 'Mute',
                  onPress: () =>
                    muteConversation.mutate({
                      conversationId: conversationId!,
                      mute: !isMuted,
                    }),
                },
              ]
            );
          }}
        >
          <Ionicons
            name={conversationInfo?.is_muted ? 'notifications-off-outline' : 'ellipsis-vertical'}
            size={22}
            color={colors.textBody}
          />
        </TouchableOpacity>
      </View>

      {/* Messages */}
      <KeyboardAvoidingView
        style={styles.keyboardAvoid}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={0}
      >
        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        ) : (
          <FlatList
            ref={flatListRef}
            data={messages}
            renderItem={renderItem}
            keyExtractor={keyExtractor}
            inverted
            style={styles.messagesList}
            contentContainerStyle={styles.messagesContent}
            showsVerticalScrollIndicator={false}
            onEndReached={handleLoadMore}
            onEndReachedThreshold={0.3}
            removeClippedSubviews={Platform.OS === 'android'}
            maxToRenderPerBatch={15}
            ListFooterComponent={
              isFetchingNextPage ? (
                <ActivityIndicator
                  size="small"
                  color={colors.primary}
                  style={styles.loadMoreIndicator}
                />
              ) : null
            }
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Ionicons
                  name="chatbubble-outline"
                  size={48}
                  color={colors.textDisabled}
                />
                <Text style={styles.emptyText}>
                  Start the conversation!
                </Text>
              </View>
            }
          />
        )}

        {/* Typing indicator */}
        <TypingIndicator
          names={typingUsers.map((u) => u.name)}
        />

        {/* Input */}
        <ChatInput
          onSend={handleSend}
          onAttach={handleAttach}
          onTyping={handleTyping}
          replyTo={replyTo}
          editingMessage={editingMessage}
          onCancelReply={() => setReplyTo(null)}
          onCancelEdit={() => setEditingMessage(null)}
          onSubmitEdit={handleSubmitEdit}
        />
      </KeyboardAvoidingView>

      {/* Media preview */}
      <MediaPreview
        uri={mediaPreviewUri}
        visible={!!mediaPreviewUri}
        onClose={() => setMediaPreviewUri(null)}
      />

      {/* Action sheet */}
      <MessageActionSheet
        visible={actionSheet.visible}
        onClose={() => setActionSheet({ visible: false, message: null })}
        actions={actionSheetActionsRef.current}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: spacing.safeAreaTop,
    paddingHorizontal: spacing.pagePaddingX,
    paddingBottom: spacing.lg,
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerInfo: {
    flex: 1,
  },
  headerTitle: {
    fontFamily: fonts.bold,
    fontSize: 17,
    color: colors.textPrimary,
  },
  headerSubtitle: {
    fontFamily: fonts.medium,
    fontSize: 12,
    color: colors.textCaption,
  },
  moreButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  keyboardAvoid: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  messagesList: {
    flex: 1,
  },
  messagesContent: {
    paddingVertical: spacing.lg,
    flexGrow: 1,
  },
  loadMoreIndicator: {
    paddingVertical: spacing.xl,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.lg,
    transform: [{ scaleY: -1 }], // Inverted list needs inverted empty state
  },
  emptyText: {
    fontFamily: fonts.medium,
    fontSize: 15,
    color: colors.textMuted,
    transform: [{ scaleY: -1 }],
  },
});
