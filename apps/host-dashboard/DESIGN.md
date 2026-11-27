---
name: Parkly — Coromandel Sunlit Ledger
description: Daylight high-contrast operations system uniting Chennai smart parking web portals and Android-first mobile driver flows.
colors:
  primary: "#D90410"
  primary-hover: "#B8030D"
  brand-pin: "#EF010C"
  harbor-navy: "#0B1628"
  harbor-surface: "#14243D"
  limestone-ground: "#F7F6F2"
  paper-surface: "#FFFFFF"
  inset-surface: "#F1EFE9"
  hairline-border: "#DFDDD4"
  hairline-strong: "#C9C5B9"
  ink-primary: "#0B1628"
  ink-secondary: "#334155"
  ink-muted: "#5A6678"
  emerald-available: "#0F766E"
  emerald-soft: "#ECFDF5"
  amber-pending: "#B45309"
  amber-soft: "#FFFBEB"
  cobalt-active: "#0369A1"
  cobalt-soft: "#F0F9FF"
  crimson-soft: "#FEF2F2"
  rail-label: "#7D91AD"
  logout-soft: "#FCA5A5"
  emerald-hover: "#0D615B"
  rail-shadow: "rgba(0, 0, 0, 0.25)"
typography:
  display:
    fontFamily: "'Manrope', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
    fontSize: "26px"
    fontWeight: 800
    lineHeight: 1.18
    letterSpacing: "-0.025em"
  kpi:
    fontFamily: "'JetBrains Mono', 'Manrope', ui-monospace, monospace"
    fontSize: "22px"
    fontWeight: 700
    lineHeight: 1.15
  title-lg:
    fontFamily: "'Manrope', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
    fontSize: "17px"
    fontWeight: 800
    lineHeight: 1.25
  title-md:
    fontFamily: "'Manrope', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
    fontSize: "16px"
    fontWeight: 800
    lineHeight: 1.3
  title:
    fontFamily: "'Manrope', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
    fontSize: "15px"
    fontWeight: 700
    lineHeight: 1.35
  body:
    fontFamily: "'Manrope', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
    fontSize: "13.5px"
    fontWeight: 500
    lineHeight: 1.45
  caption:
    fontFamily: "'Manrope', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
    fontSize: "12.5px"
    fontWeight: 600
    lineHeight: 1.35
  small:
    fontFamily: "'Manrope', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
    fontSize: "12px"
    fontWeight: 600
    lineHeight: 1.35
  label:
    fontFamily: "'JetBrains Mono', 'Manrope', ui-monospace, monospace"
    fontSize: "11px"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "0.06em"
  micro:
    fontFamily: "'JetBrains Mono', 'Manrope', ui-monospace, monospace"
    fontSize: "10px"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "0.09em"
rounded:
  badge: "5px"
  control: "7px"
  nav: "8px"
  card: "10px"
  modal: "12px"
  pill: "999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "20px"
  xl: "36px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.paper-surface}"
    rounded: "{rounded.control}"
    padding: "9px 16px"
    height: "38px"
  button-primary-hover:
    backgroundColor: "{colors.primary-hover}"
  button-outline:
    backgroundColor: "{colors.paper-surface}"
    textColor: "{colors.ink-primary}"
    rounded: "{rounded.control}"
    padding: "9px 16px"
    height: "38px"
  card-panel:
    backgroundColor: "{colors.paper-surface}"
    textColor: "{colors.ink-primary}"
    rounded: "{rounded.card}"
    padding: "20px"
  input-field:
    backgroundColor: "{colors.paper-surface}"
    textColor: "{colors.ink-primary}"
    rounded: "{rounded.control}"
    padding: "9px 12px"
    height: "38px"
---

# Design System: Parkly Host Portal

## Overview

**Creative North Star: "The Coromandel Sunlit Ledger"**

Parkly's interface pairs a sunlit warm-limestone operational canvas (`#F7F6F2`) and crisp paper work cards (`#FFFFFF`) with a committed deep Harbor Navy navigation shell (`#0B1628`) and Parkly Signal Crimson primary actions (`#D90410` CTA, `#EF010C` pin mark). Every view is built for rapid outdoor and booth-lit scanning by Chennai parking hosts checking bay capacity, INR tariffs, AI onboarding audits, and reservations.

Depth comes from 1px architectural hairlines (`#DFDDD4`) and crisp tabular numerals (`JetBrains Mono` / `Manrope`) rather than blurred shadows or decorative chrome. Emoji glyphs are banned across controls, status tags, and headings in favor of a single unified 1.75px vector icon set.

**Key Characteristics:**
- Warm limestone daylight canvas anchored by a fixed 248px dark Harbor Navy navigation rail.
- Self-hosted `Manrope` (with dedicated `U+20B9` Rupee glyph subsets) paired with `JetBrains Mono` tabular figures for INR settlements, TN plates, and bay percentages.
- Accessible WCAG AA text, placeholder (`#5A6678`), and signal-button (`#D90410`) contrast.
- Zero browser `alert`/`confirm`/`prompt` interruptions; every confirmation renders inside focus-restoring Escape-dismissible dialogs.

## Colors

Warm stone paper grounds let deep Harbor Navy chrome and discrete emerald/amber/crimson operational signals read effortlessly without dark-mode glare or flat gray SaaS defaults.

### Primary
- **Signal Crimson CTA** (`#D90410`): Primary buttons, affirmative triggers, and active tab highlights (tuned for >5.2:1 white text contrast).
- **Signal Crimson Hover** (`#B8030D`): Hover and pressed deepen state for primary crimson triggers.
- **Parkly Pin Crimson** (`#EF010C`): Brand pin mark and single active-route navigation indicator dot.

### Secondary
- **Harbor Navy** (`#0B1628`): Sidebar navigation shell, mobile top bar, occupied bay cells, and primary heading ink.
- **Harbor Navy Surface** (`#14243D`): Active rail pill surface framed by subtle white hairline stroke.
- **Bay Emerald** (`#0F766E`): Active occupancy, verified spaces, payout settlements, and AI audit approval states.

### Neutral
- **Limestone Ground** (`#F7F6F2`): Main application backdrop.
- **Paper White** (`#FFFFFF`): Elevated cards, tables, modals, and form fields.
- **Limestone Inset** (`#F1EFE9`): Modal headers/footers, table headers, checkbox rows, and bay track tracks.
- **Hairline Border** (`#DFDDD4`) / **Strong Hairline** (`#C9C5B9`): Structural card/row divisions and interactive input strokes.
- **Ink Muted** (`#5A6678`): Secondary metadata, table headers, timestamps, zero-load labels, and input placeholders.

### Named Rules
**The Restrained Signal Rule.** Reserve Signal Crimson exclusively for primary commitments, active navigation dots, and critical errors so high-priority controls stand out immediately against Limestone Paper and Harbor Navy.

## Typography

**Display Font:** `Manrope`, system sans-serif fallback
**Body Font:** `Manrope`, system sans-serif fallback
**Label/Mono Font:** `JetBrains Mono` paired with `Manrope` Rupee fallback

**Character:** Compact, geometric sans-serif headings with crisp open apertures paired with strictly tabular monospaced figures for currency (`₹`), TN license plates, timestamps, and booking IDs. Both fonts ship locally as static `.woff2` bundles to comply with strict Nginx `'self'` Content Security Policy rules.

### Hierarchy
- **Display** (`800`, `26px`, `1.18`): Page `<h1>` titles (`letter-spacing: -0.025em`) standing cleanly below breadcrumbs without eyebrow kickers.
- **Title** (`700`, `15px–17px`, `1.35`): Card `<h2 className="card-title">` and listing headers.
- **Body** (`500`, `13.5px–14px`, `1.45`): Subtitles, table rows, modal prose, and form values.
- **Label** (`700`, `11px`, `1.2`, uppercase, `0.06em`): Monospace table headers, stat labels, and card metadata captions.

### Named Rules
**The Tabular Ledger Rule.** Set every INR amount, percentage, slot count, booking ID, and Indian license plate with `font-variant-numeric: tabular-nums` (and `--font-mono` where aligned in columns) so values align vertically across rows.

## Layout

Desktop viewports (`> 960px`) use a fixed 248px Harbor Navy sidebar rail beside a flexible main work canvas (`padding: 28px 36px 40px`, max content width `1480px`). KPI metrics flow in 4-column grids (`1180px` -> 2 columns; `600px` -> 1 column) above asymmetric split capacity grids (`1.55fr 1fr`) and full-width tables.

Below `960px`, the rail retracts cleanly off-canvas behind a sticky Harbor Navy top header with a `40×40px` menu button, backdrop scrim, and Escape/route-change drawer dismissal.

## Elevation & Depth

Cards, tables, and summary tiles stay flat at rest on the warm limestone canvas using `1px solid` hairline boundaries (`#DFDDD4`) and minimal crisp `0 1px 2px rgba(11, 22, 40, 0.04)` surface separation. Shadows intensify only for overlaid floating chrome (`modal`: `0 18px 40px rgba(11, 22, 40, 0.16)` with backdrop dim `rgba(11, 22, 40, 0.48)`).

### Named Rules
**The Hairline First Rule.** Convey containment via crisp 1px borders and clean `#F1EFE9` / `#FFFFFF` tonal steps; never wrap rest cards in wide dark glow shadows or 3px accent borders.

## Shapes

Sharp-edged operational geometry: `10px` radius on cards and panels, `7px` on buttons and form inputs, `12px` on modal containers, `5px` on compact status badges and bay capacity stall blocks. Active navigation links use filled dark Harbor Navy pill containers (`8px` radius) marked with a `7px` right-aligned Crimson indicator dot.

## Components

Every component shares unified stroke weights (`1.75px` icons), `140ms ease` state transitions, `:focus-visible` crimson rings, and `@media (prefers-reduced-motion: reduce)` fallbacks.

### Buttons
- **Shape:** Crisp technical rectangle (`7px` radius), `38px` min-height (`30px` small table actions).
- **Primary:** Solid Crimson (`#D90410`), white bold label, darkens to `#B8030D` on hover with subtle `1px` active press.
- **Outline / Secondary:** Paper white (`#FFFFFF`) with `#C9C5B9` border shifting to `#F1EFE9` on hover; outline danger variant uses `#FECACA` stroke with `#B91C1C` text.

### Cards / Containers
- **Corner Style:** Rounded (`10px`) with `1px solid #DFDDD4` border.
- **Background:** `#FFFFFF` over `#F7F6F2` page canvas.
- **Internal Padding:** `20px` standard (`18px 20px` on KPI stat cards).

### Inputs / Fields
- **Style:** `#FFFFFF` fill, `1px solid #C9C5B9` stroke, `7px` radius, `#5A6678` placeholder.
- **Focus:** Stroke deepens to `#0B1628` with `3px rgba(11, 22, 40, 0.28)` ring and `#D90410` caret.

### Navigation
- Dark Harbor Navy sidebar (`#0B1628`) housing geometric vector `ParklyLogoMark` in white tile, muted `#9FB0C7` links transitioning to `#FFFFFF` inside `#14243D` pills with a `7px` `#EF010C` indicator dot when active.

### Bay Capacity Horizon
- Inline 10-cell horizontal slot visualizer pairing dark occupied bays (`#0B1628`), emerald open stalls (`#ECFDF5` / `#0F766E`), and crimson EV holds (`#FEF2F2` / `#B91C1C`) above a tabular count summary.

## Do's and Don'ts

### Do:
- **Do** use self-hosted `.woff2` `Manrope` + `JetBrains Mono` assets under `/fonts/` so strict `'self'` Nginx CSP headers never break font loading.
- **Do** route every dialog through the shared `<Modal>` wrapper with `Escape` closing, backdrop click, and trigger focus restoration.
- **Do** represent status via crisp badges paired with semantic contrast and `1.75px` vector icons.

### Don't:
- **Don't** place kicker/eyebrow labels above `<h1>` page titles or skip `<h2>` heading levels inside cards.
- **Don't** use Unicode emojis anywhere in navigation, stat icons, chips, buttons, or empty states.
- **Don't** add `border-left: 3px` active bars on navigation items or call browser `alert`/`confirm`/`prompt`.
