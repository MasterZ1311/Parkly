/**
 * Parkly Mobile Design Theme & Palette
 * Derived directly from the brand identity logo:
 * - Navy Dark: #0A1425
 * - Accent Red: #EF010C
 */

export const colors = {
  // Brand
  primary: '#EF010C',      // Parkly Brand Red
  primaryDark: '#DC2626',
  primaryLight: 'rgba(239, 1, 12, 0.12)',

  navy: '#0A1425',         // Parkly Brand Navy
  navyDark: '#050B14',
  navySurface: '#111D33',
  navyElevated: '#162238',
  navyBorder: '#263957',

  // Backgrounds
  background: '#0A1425',
  card: '#111D33',
  cardElevated: '#162238',
  border: '#263957',

  // Text
  text: '#F8FAFC',
  textSecondary: '#94A3B8',
  textMuted: '#64748B',
  white: '#FFFFFF',

  // Badges & States
  success: '#10B981',
  warning: '#F59E0B',
  danger: '#EF010C',
  info: '#3B82F6',
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
};
