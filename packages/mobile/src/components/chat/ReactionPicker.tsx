import React from 'react';
import { View, TouchableOpacity, Text, StyleSheet } from 'react-native';
import { colors, borderRadius, shadows, spacing } from '@/theme';

const REACTIONS = [
  { emoji: '\u2764\uFE0F', key: 'heart' },
  { emoji: '\uD83D\uDC4D', key: 'thumbs_up' },
  { emoji: '\uD83D\uDE02', key: 'laugh' },
  { emoji: '\uD83D\uDE2E', key: 'wow' },
  { emoji: '\uD83D\uDE22', key: 'sad' },
  { emoji: '\uD83D\uDE4F', key: 'pray' },
];

interface ReactionPickerProps {
  onSelect: (reaction: string) => void;
  visible: boolean;
}

export const ReactionPicker = React.memo(function ReactionPicker({
  onSelect,
  visible,
}: ReactionPickerProps) {
  if (!visible) return null;

  return (
    <View style={styles.container}>
      {REACTIONS.map((r) => (
        <TouchableOpacity
          key={r.key}
          style={styles.button}
          onPress={() => onSelect(r.key)}
          activeOpacity={0.7}
        >
          <Text style={styles.emoji}>{r.emoji}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: borderRadius['3xl'],
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: spacing.xs,
    ...shadows.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  button: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: borderRadius.full,
  },
  emoji: {
    fontSize: 22,
  },
});
