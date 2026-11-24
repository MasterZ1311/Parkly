/**
 * Parkly Brand Design Tokens & Official Color Palette
 * Derived directly from the brand identity logo:
 * - Deep Midnight Navy: #0A1425 (The 'P' letterform & vehicle silhouette)
 * - Vibrant Crimson Red: #EF010C (The location pin marker & key interaction accent)
 * - Pure White & Crisp Slate: #FFFFFF & #F8FAFC (The clean backdrop & high-contrast text)
 */

export const parklyPalette = {
  // Brand Colors
  brand: {
    navy: '#0A1425',
    navyDark: '#050B14',
    navySurface: '#111D33',
    navyElevated: '#162238',
    navyBorder: '#263957',
    red: '#EF010C',
    redHover: '#DC2626',
    redLight: '#FEE2E2',
    redMuted: 'rgba(239, 1, 12, 0.12)',
    white: '#FFFFFF',
  },

  // Semantic Scale
  navy: {
    950: '#050B14',
    900: '#0A1425', // Core Brand Navy
    800: '#111D33', // Surfaces & Cards
    700: '#162238', // Elevated Cards
    600: '#1D2D47', // Interactive Elements
    500: '#263957', // Borders & Dividers
  },

  red: {
    50: '#FEF2F2',
    100: '#FEE2E2',
    200: '#FECACA',
    500: '#EF010C', // Core Brand Red
    600: '#DC2626',
    700: '#B91C1C',
    glow: 'rgba(239, 1, 12, 0.25)',
  },

  slate: {
    50: '#F8FAFC',
    100: '#F1F5F9',
    200: '#E2E8F0',
    400: '#94A3B8',
    500: '#64748B',
    600: '#475569',
  },

  status: {
    available: '#10B981', // Green for vacant spots
    warning: '#F59E0B',   // Amber for limited capacity/surge
    occupied: '#EF010C',  // Brand Red for booked/unavailable
    ev: '#3B82F6',        // Electric Blue for EV chargers
  },
} as const;

export type ParklyPalette = typeof parklyPalette;
