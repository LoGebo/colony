import React, { type PropsWithChildren } from 'react';
import { StyleSheet, type ViewStyle } from 'react-native';
import { BlurView } from 'expo-blur';
import { colors, borderRadius } from '@/theme';

type GlassVariant = 'standard' | 'enhanced' | 'dense' | 'tabBar';

interface GlassCardProps {
  variant?: GlassVariant;
  style?: ViewStyle;
}

const variantMap: Record<GlassVariant, { bg: string; intensity: number }> = {
  standard: { bg: colors.glass, intensity: 20 },
  enhanced: { bg: colors.glassEnhanced, intensity: 20 },
  dense: { bg: colors.glassDense, intensity: 20 },
  tabBar: { bg: colors.glassTabBar, intensity: 15 },
};

export function GlassCard({ variant = 'standard', style, children }: PropsWithChildren<GlassCardProps>) {
  const config = variantMap[variant];

  return (
    <BlurView
      intensity={config.intensity}
      tint="light"
      style={[
        styles.base,
        { backgroundColor: config.bg },
        style,
      ]}
    >
      {children}
    </BlurView>
  );
}

const styles = StyleSheet.create({
  base: {
    borderWidth: 1,
    borderColor: colors.glassBorder,
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
  },
});
