import { Platform } from 'react-native';

// ──────────────────────────────────────
// LUMINA DESIGN SYSTEM — Exact Tokens
// ──────────────────────────────────────

export const colors = {
  // Page backgrounds
  background: '#F1F5F9',
  backgroundAlt: '#F8FAFC',

  // Surfaces
  surface: '#FFFFFF',
  surfaceMuted: 'rgba(255,255,255,0.6)',
  dark: '#1E293B',
  darkGradientFrom: '#0F172A',
  darkGradientTo: '#1E293B',
  darkHover: '#0F172A',

  // Glass panels
  glass: 'rgba(255,255,255,0.7)',
  glassEnhanced: 'rgba(255,255,255,0.75)',
  glassDense: 'rgba(255,255,255,0.8)',
  glassTabBar: 'rgba(255,255,255,0.85)',
  glassBorder: 'rgba(255,255,255,0.5)',

  // Text
  textPrimary: '#0F172A',
  textSecondary: '#1E293B',
  textBody: '#475569',
  textMuted: '#64748B',
  textCaption: '#94A3B8',
  textDisabled: '#CBD5E1',
  textOnDark: '#FFFFFF',
  textOnDarkMuted: '#94A3B8',

  // Accent / Brand
  primary: '#2563EB',
  primaryHover: '#1D4ED8',
  primaryLight: '#EFF6FF',
  primaryLightAlt: '#DBEAFE',
  teal: '#14B8A6',
  tealDark: '#0D9488',
  tealLight: '#F0FDFA',
  tealLightAlt: '#CCFBF1',
  gradientStart: '#2563EB',
  gradientEnd: '#2DD4BF',

  // Status
  success: '#10B981',
  successText: '#047857',
  successBg: '#D1FAE5',
  successBgLight: 'rgba(16,185,129,0.1)',
  warning: '#F59E0B',
  warningText: '#D97706',
  warningBg: '#FEF3C7',
  warningBgLight: '#FFFBEB',
  warningBgAlpha: 'rgba(245,158,11,0.2)',
  danger: '#EF4444',
  dangerText: '#E11D48',
  dangerBg: '#FFE4E6',
  dangerBgLight: '#FFF1F2',
  dangerBgAlpha: 'rgba(239,68,68,0.2)',
  info: '#2563EB',
  infoBg: '#DBEAFE',
  infoBgLight: '#EFF6FF',
  indigo: '#6366F1',
  indigoBg: '#E0E7FF',
  orange: '#EA580C',
  orangeBg: '#FFEDD5',

  // Borders
  border: '#F1F5F9',
  borderMedium: '#E2E8F0',
  borderNav: 'rgba(226,232,240,0.6)',
  borderDashed: '#CBD5E1',
  borderDarkInner: 'rgba(255,255,255,0.1)',
  borderAmberAccent: '#FBBF24',

  // Ambient background
  ambientGradient: 'rgba(191,219,254,0.5)',
  ambientVia: 'rgba(204,251,241,0.3)',
  ambientOrbRight: 'rgba(96,165,250,0.1)',
  ambientOrbLeft: 'rgba(94,234,212,0.1)',
  ambientDarkOrb: 'rgba(59,130,246,0.1)',

  // Overlay
  overlay: 'rgba(0,0,0,0.4)',
} as const;

export const fonts = {
  regular: 'Satoshi-Regular',
  medium: 'Satoshi-Medium',
  bold: 'Satoshi-Bold',
  black: 'Satoshi-Black',
  light: 'Satoshi-Light',
} as const;

export const typography = {
  hero: { fontFamily: fonts.bold, fontSize: 36 },
  largeTitle: { fontFamily: fonts.bold, fontSize: 30 },
  title1: { fontFamily: fonts.bold, fontSize: 24, letterSpacing: -0.5 },
  title2: { fontFamily: fonts.bold, fontSize: 20, letterSpacing: -0.5 },
  headline: { fontFamily: fonts.bold, fontSize: 18 },
  headlineMedium: { fontFamily: fonts.medium, fontSize: 18 },
  bodyLarge: { fontFamily: fonts.medium, fontSize: 16 },
  body: { fontFamily: fonts.medium, fontSize: 14 },
  bodyBold: { fontFamily: fonts.bold, fontSize: 14 },
  caption: { fontFamily: fonts.bold, fontSize: 12 },
  captionMedium: { fontFamily: fonts.medium, fontSize: 12 },
  micro: { fontFamily: fonts.bold, fontSize: 11 },
  microLabel: {
    fontFamily: fonts.bold,
    fontSize: 10,
    textTransform: 'uppercase' as const,
    letterSpacing: 1.5,
  },
  navLabel: {
    fontFamily: fonts.black,
    fontSize: 10,
    textTransform: 'uppercase' as const,
    letterSpacing: -0.5,
  },
  sectionHeader: {
    fontFamily: fonts.bold,
    fontSize: 14,
    textTransform: 'uppercase' as const,
    letterSpacing: 1.5,
    color: '#94A3B8',
  },
  buttonLarge: { fontFamily: fonts.bold, fontSize: 18 },
  buttonSmall: { fontFamily: fonts.bold, fontSize: 12 },
} as const;

export const spacing = {
  xs: 4,
  sm: 6,
  md: 8,
  lg: 12,
  xl: 16,
  '2xl': 20,
  '3xl': 24,
  '4xl': 32,
  '5xl': 40,
  '6xl': 48,
  pagePaddingX: 24,
  safeAreaTop: 56,
  safeAreaBottom: 34,
  bottomNavClearance: 100,
  cardPadding: 20,
  inputHeight: 56,
  buttonHeight: 56,
  smallButtonHeight: 48,
  tinyButtonHeight: 40,
} as const;

export const borderRadius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  '2xl': 24,
  '3xl': 28,
  '4xl': 32,
  '5xl': 40,
  full: 9999,
} as const;

export const shadows = {
  sm: Platform.select({
    ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2 },
    android: { elevation: 1 },
  }),
  md: Platform.select({
    ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 6 },
    android: { elevation: 3 },
  }),
  lg: Platform.select({
    ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.1, shadowRadius: 15 },
    android: { elevation: 5 },
  }),
  xl: Platform.select({
    ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 20 }, shadowOpacity: 0.1, shadowRadius: 25 },
    android: { elevation: 8 },
  }),
  blueGlow: Platform.select({
    ios: { shadowColor: '#2563EB', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.2, shadowRadius: 15 },
    android: { elevation: 8 },
  }),
  darkGlow: Platform.select({
    ios: { shadowColor: '#0F172A', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.1, shadowRadius: 15 },
    android: { elevation: 8 },
  }),
  navShadow: Platform.select({
    ios: { shadowColor: '#000', shadowOffset: { width: 0, height: -10 }, shadowOpacity: 0.05, shadowRadius: 40 },
    android: { elevation: 10 },
  }),
} as const;
