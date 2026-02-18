import React, { useState, useRef, useCallback } from 'react';
import {
  View,
  TextInput,
  TouchableOpacity,
  Text,
  StyleSheet,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, fonts, spacing, borderRadius } from '@/theme';

interface ReplyPreview {
  messageId: string;
  senderName: string;
  content: string | null;
}

interface EditPreview {
  messageId: string;
  content: string;
}

interface ChatInputProps {
  onSend: (text: string) => void;
  onAttach: () => void;
  onTyping: () => void;
  replyTo: ReplyPreview | null;
  editingMessage: EditPreview | null;
  onCancelReply: () => void;
  onCancelEdit: () => void;
  onSubmitEdit: (messageId: string, newContent: string) => void;
  disabled?: boolean;
}

export const ChatInput = React.memo(function ChatInput({
  onSend,
  onAttach,
  onTyping,
  replyTo,
  editingMessage,
  onCancelReply,
  onCancelEdit,
  onSubmitEdit,
  disabled,
}: ChatInputProps) {
  const [text, setText] = useState('');
  const inputRef = useRef<TextInput>(null);

  // When editing starts, set text to the message content
  React.useEffect(() => {
    if (editingMessage) {
      setText(editingMessage.content);
      inputRef.current?.focus();
    }
  }, [editingMessage]);

  const handleSend = useCallback(() => {
    const trimmed = text.trim();
    if (!trimmed) return;

    if (editingMessage) {
      onSubmitEdit(editingMessage.messageId, trimmed);
      setText('');
    } else {
      onSend(trimmed);
      setText('');
    }
  }, [text, editingMessage, onSend, onSubmitEdit]);

  const handleChangeText = useCallback(
    (value: string) => {
      setText(value);
      if (value.length > 0) onTyping();
    },
    [onTyping]
  );

  const canSend = text.trim().length > 0;

  return (
    <View style={styles.wrapper}>
      {/* Reply / Edit preview */}
      {(replyTo || editingMessage) && (
        <View style={styles.previewBar}>
          <View style={styles.previewAccent} />
          <View style={styles.previewContent}>
            <Text style={styles.previewLabel}>
              {editingMessage ? 'Editing' : `Replying to ${replyTo?.senderName}`}
            </Text>
            <Text style={styles.previewText} numberOfLines={1}>
              {editingMessage
                ? editingMessage.content
                : replyTo?.content ?? 'Media'}
            </Text>
          </View>
          <TouchableOpacity
            onPress={editingMessage ? onCancelEdit : onCancelReply}
            style={styles.previewClose}
          >
            <Ionicons name="close" size={18} color={colors.textCaption} />
          </TouchableOpacity>
        </View>
      )}

      {/* Input bar */}
      <View style={styles.bar}>
        <TouchableOpacity
          style={styles.attachButton}
          onPress={onAttach}
          activeOpacity={0.7}
          disabled={disabled}
        >
          <Ionicons name="add-circle-outline" size={26} color={colors.primary} />
        </TouchableOpacity>

        <TextInput
          ref={inputRef}
          style={styles.input}
          value={text}
          onChangeText={handleChangeText}
          placeholder="Message..."
          placeholderTextColor={colors.textCaption}
          multiline
          maxLength={2000}
          editable={!disabled}
        />

        <TouchableOpacity
          style={[styles.sendButton, canSend && styles.sendButtonActive]}
          onPress={handleSend}
          disabled={!canSend || disabled}
          activeOpacity={0.7}
        >
          <Ionicons
            name={editingMessage ? 'checkmark' : 'send'}
            size={20}
            color={canSend ? colors.textOnDark : colors.textDisabled}
          />
        </TouchableOpacity>
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  wrapper: {
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingBottom: spacing.bottomNavClearance,
  },
  previewBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    backgroundColor: colors.backgroundAlt,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  previewAccent: {
    width: 3,
    height: 32,
    borderRadius: 2,
    backgroundColor: colors.primary,
    marginRight: spacing.lg,
  },
  previewContent: {
    flex: 1,
    gap: 2,
  },
  previewLabel: {
    fontFamily: fonts.bold,
    fontSize: 11,
    color: colors.primary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  previewText: {
    fontFamily: fonts.medium,
    fontSize: 13,
    color: colors.textMuted,
  },
  previewClose: {
    padding: spacing.md,
  },
  bar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    gap: spacing.md,
  },
  attachButton: {
    paddingBottom: 6,
  },
  input: {
    flex: 1,
    fontFamily: fonts.medium,
    fontSize: 15,
    color: colors.textPrimary,
    maxHeight: 100,
    paddingVertical: Platform.OS === 'ios' ? 10 : 6,
    paddingHorizontal: 14,
    backgroundColor: colors.background,
    borderRadius: borderRadius.xl,
    borderWidth: 1,
    borderColor: colors.borderMedium,
  },
  sendButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.borderMedium,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  sendButtonActive: {
    backgroundColor: colors.primary,
  },
});
