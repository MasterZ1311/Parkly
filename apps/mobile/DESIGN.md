---
name: Parkly Mobile — Coromandel Sunlit Ledger (Android-First)
description: Sunlight-legible Material-aligned Expo mobile design system powered by Reanimated 4 UI-thread motion and haptics.
colors:
  primary: "#D90410"
  primary-dark: "#B8030D"
  brand-accent: "#EF010C"
  navy: "#0B1628"
  navy-surface: "#14243D"
  background: "#F7F6F2"
  surface: "#FFFFFF"
  surface-muted: "#EFECE4"
  border: "#DFDDD4"
  border-strong: "#C9C5B9"
  text-ink: "#0B1628"
  text-secondary: "#334155"
  text-muted: "#5A6678"
  success: "#0F766E"
  warning: "#B45309"
  danger: "#B91C1C"
  info: "#0369A1"
typography:
  title-lg:
    fontFamily: "System"
    fontSize: "21px"
    fontWeight: 800
    lineHeight: 1.25
  body:
    fontFamily: "System"
    fontSize: "14px"
    fontWeight: 500
    lineHeight: 1.45
  price:
    fontFamily: "System"
    fontSize: "20px"
    fontWeight: 800
    lineHeight: 1.15
  label:
    fontFamily: "System"
    fontSize: "11.5px"
    fontWeight: 800
    lineHeight: 1.2
    letterSpacing: "0.06em"
rounded:
  chip: "10px"
  card: "14px"
  qr: "18px"
  sheet: "20px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
components:
  press-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.surface}"
    rounded: "12px"
    height: "50px"
  card-space:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text-ink}"
    rounded: "{rounded.card}"
    padding: "16px"
---

# Design System: Parkly Mobile

## Overview

**Creative North Star: "The Sunlight Commuter Pass"**

Built Android-first for outdoor Chennai glare and one-handed barrier gate checks, Parkly Mobile brings Coromandel Sunlit Ledger onto Expo SDK 54: warm limestone surfaces (`#F7F6F2`), crisp elevated white cards (`#FFFFFF`), Harbor Navy headers (`#0B1628`), and Signal Crimson CTAs (`#D90410`), animated strictly on the UI thread via `react-native-reanimated` 4, `react-native-gesture-handler`, and `expo-haptics`.

**Key Characteristics:**
- 48dp minimum interactive targets (`PressScale` with Android ripple + 0.97 scale settle in 120ms) and safe-area window insets (`useSafeAreaInsets`) across every custom header and bottom sticky bar.
- Draggable Map bottom sheet driven by `Gesture.Pan()` + `withSpring` (`dampingRatio: 0.8`, `overshootClamping: true`) plus accessible tap header fallback.
- Respects system reduced motion (`useReducedMotion()`, `ReduceMotion.System`) in Stack transitions, press curves, loading skeletons, and chat scrolling.

## Colors

### Primary
- **Signal Crimson** (`#D90410` CTA, `#B8030D` dark press, `#EF010C` map pin badge).

### Secondary
- **Harbor Navy** (`#0B1628`) headers, active chip fills, and primary gate action bars.
- **Bay Emerald** (`#0F766E`) availability pills and live map markers.

### Neutral
- **Limestone Ground** (`#F7F6F2`), **Surface Paper** (`#FFFFFF`), **Hairline** (`#DFDDD4`), **Ink Muted** (`#5A6678`).

### Named Rules
**The Sunlight Legibility Rule.** Avoid low-contrast dark-slate cards in outdoors use; anchor active pricing and QR gate tokens in dark `#0B1628` ink on `#FFFFFF` and `#F7F6F2` surfaces.

## Typography

Platform system Roboto / SF Pro scaled with `tabular-nums` (`fontVariant: ['tabular-nums']`) for ₹ hourly tariffs, countdown windows, OTP cells, and TN plates (`TN01AB1234`), avoiding fragile fixed pixel hacks.

## Layout

Material bottom tab bar (`animation: 'none'`, 5 top-level tabs) respecting bottom safe insets, edge-to-edge Harbor Navy headers, `16px–18px` screen margins, and `10px–12px` card spacing.

## Elevation & Depth

Subtle hairline strokes (`#DFDDD4`) paired with clean Material `elevation: 1` on list cards and `elevation: 8` on the Map draggable sheet.

## Shapes

`14px` listing cards, `10–12px` buttons/inputs/chips, `20px` top corners on interactive bottom sheets, `18px` elevated white frame on scannable gate QR passes.

## Components

- `PressScale`: Shared Reanimated + `Pressable` wrapper supporting `android_ripple`, `.get()`/`.set()` scale animation, optional `expo-haptics`, `minHeight: 48`, and `useReducedMotion()`.
- `SkeletonBlock`: Limestone pulsing shimmer placeholders during search/detail loading.
- `Map Bottom Sheet`: Gesture Handler `Pan` + velocity spring sheet + tap accessibility toggle.

## Do's and Don'ts

### Do:
- **Do** guard every shared-value read/write behind `.get()`/`.set()` and run haptics from worklet handlers only via `scheduleOnRN`.
- **Do** keep `FlatList` row items free of `entering` mount animations so fast scroll virtualization never glitches.

### Don't:
- **Don't** drop below 48dp hit size on interactive mobile controls or omit `useReducedMotion()` fallbacks.
- **Don't** mix legacy `#0A1425` / `#0F172A` / `#38BDF8` dark-mode colors into sunlit screens.
