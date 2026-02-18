import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  Pressable,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, fonts, spacing, borderRadius } from '@/theme';

interface Action {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  destructive?: boolean;
}

interface MessageActionSheetProps {
  visible: boolean;
  onClose: () => void;
  actions: Action[];
}

export const MessageActionSheet = React.memo(function MessageActionSheet({
  visible,
  onClose,
  actions,
}: MessageActionSheetProps) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable style={styles.overlay} onPress={onClose}>
        <View style={styles.sheet}>
          {actions.map((action, i) => (
            <TouchableOpacity
              key={i}
              style={[
                styles.action,
                i < actions.length - 1 && styles.actionBorder,
              ]}
              onPress={() => {
                onClose();
                action.onPress();
              }}
              activeOpacity={0.7}
            >
              <Ionicons
                name={action.icon}
                size={20}
                color={action.destructive ? colors.danger : colors.textBody}
              />
              <Text
                style={[
                  styles.actionText,
                  action.destructive && styles.actionTextDestructive,
                ]}
              >
                {action.label}
              </Text>
            </TouchableOpacity>
          ))}
          <TouchableOpacity
            style={styles.cancelButton}
            onPress={onClose}
            activeOpacity={0.7}
          >
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </Pressable>
    </Modal>
  );
});

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: 'flex-end',
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.safeAreaBottom + spacing.xl,
  },
  sheet: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius['2xl'],
    overflow: 'hidden',
  },
  action: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
    paddingVertical: 16,
    paddingHorizontal: spacing.cardPadding,
  },
  actionBorder: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  actionText: {
    fontFamily: fonts.medium,
    fontSize: 16,
    color: colors.textBody,
  },
  actionTextDestructive: {
    color: colors.danger,
  },
  cancelButton: {
    alignItems: 'center',
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: colors.borderMedium,
    backgroundColor: colors.backgroundAlt,
  },
  cancelText: {
    fontFamily: fonts.bold,
    fontSize: 16,
    color: colors.textMuted,
  },
});
