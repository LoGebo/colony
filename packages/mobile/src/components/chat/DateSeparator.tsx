import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { isToday, isYesterday, parseISO, format } from 'date-fns';
import { es } from 'date-fns/locale';
import { colors, fonts, spacing } from '@/theme';

interface DateSeparatorProps {
  date: string;
}

function getLabel(dateStr: string): string {
  const d = parseISO(dateStr);
  if (isToday(d)) return 'Hoy';
  if (isYesterday(d)) return 'Ayer';
  return format(d, 'dd MMM yyyy', { locale: es });
}

export const DateSeparator = React.memo(function DateSeparator({
  date,
}: DateSeparatorProps) {
  return (
    <View style={styles.container}>
      <View style={styles.pill}>
        <Text style={styles.text}>{getLabel(date)}</Text>
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
  },
  pill: {
    backgroundColor: 'rgba(148,163,184,0.15)',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 4,
  },
  text: {
    fontFamily: fonts.bold,
    fontSize: 11,
    color: colors.textMuted,
    textTransform: 'capitalize',
  },
});
