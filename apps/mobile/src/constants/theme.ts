/**
 * Parkly Mobile Design System Tokens
 * Sunlight-ready daylight operational palette paired with deep Harbor Navy
 * navigation bars and Signal Crimson primary CTAs.
 */

export const colors = {
  // Brand & Actions
  primary: '#D90410',         // High-contrast Signal Crimson CTA
  primaryDark: '#B8030D',
  brandAccent: '#EF010C',     // Parkly Pin Crimson
  primaryLight: '#FEF2F2',
  primaryBorder: '#FECACA',

  // Harbor Navy Chrome
  navy: '#0B1628',
  navyDark: '#060E1B',
  navySurface: '#14243D',
  navyElevated: '#1A2D4A',
  navyBorder: '#243A5E',

  // Daylight Surfaces
  background: '#F7F6F2',
  surface: '#FFFFFF',
  card: '#FFFFFF',
  cardElevated: '#F1EFE9',
  surfaceMuted: '#EFECE4',
  border: '#DFDDD4',
  borderStrong: '#C9C5B9',

  // Typography Ink
  text: '#0B1628',
  textSecondary: '#334155',
  textMuted: '#5A6678',
  white: '#FFFFFF',

  // Semantic States
  success: '#0F766E',
  successLight: '#ECFDF5',
  successBorder: '#A7F3D0',

  warning: '#B45309',
  warningLight: '#FFFBEB',
  warningBorder: '#FDE68A',

  danger: '#B91C1C',
  dangerLight: '#FEF2F2',
  dangerBorder: '#FECACA',

  info: '#0369A1',
  infoLight: '#F0F9FF',
  infoBorder: '#BAE6FD',

  // Android Material Ripple tints
  rippleDark: 'rgba(11, 22, 40, 0.10)',
  rippleLight: 'rgba(255, 255, 255, 0.22)',
};

export const theme = {
  colors,
  spacing: {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
  },
  borderRadius: {
    sm: 8,
    md: 12,
    lg: 16,
    full: 9999,
  },
  elevation: {
    card: {
      shadowColor: '#0B1628',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.05,
      shadowRadius: 3,
      elevation: 1,
    },
    sheet: {
      shadowColor: '#0B1628',
      shadowOffset: { width: 0, height: -4 },
      shadowOpacity: 0.12,
      shadowRadius: 12,
      elevation: 8,
    },
  },
};
