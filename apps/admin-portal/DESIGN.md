---
name: Parkly — Coromandel Sunlit Ledger (Admin Portal)
description: City operations & GCC mobility telemetry command design system aligned with Parkly's daylight ledger.
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
  emerald-verified: "#0F766E"
  emerald-hover: "#0D615B"
  amber-review: "#B45309"
  cobalt-corridor: "#0369A1"
  rail-label: "#7D91AD"
  logout-soft: "#FCA5A5"
  rail-shadow: "rgba(0, 0, 0, 0.25)"
typography:
  display:
    fontFamily: "'Manrope', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
    fontSize: "26px"
    fontWeight: 800
    lineHeight: 1.18
    letterSpacing: "-0.025em"
  headline:
    fontFamily: "'JetBrains Mono', 'Manrope', ui-monospace, monospace"
    fontSize: "24px"
    fontWeight: 700
    lineHeight: 1.15
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
  card-panel:
    backgroundColor: "{colors.paper-surface}"
    textColor: "{colors.ink-primary}"
    rounded: "{rounded.card}"
    padding: "20px"
---

# Design System: Parkly Admin Portal

## Overview

**Creative North Star: "The Coromandel Sunlit Ledger"**

Parkly's Admin Portal shares the exact daylight warm-limestone (`#F7F6F2`), elevated white (`#FFFFFF`), Harbor Navy navigation rail (`#0B1628`), and Signal Crimson (`#D90410` / `#EF010C`) token system as the Host Portal and Android app—extending it for dense multi-tab KYC queues, AI dispute arbitration cards, RBAC user tables, and Chennai GCC corridor mobility analytics.

**Key Characteristics:**
- Split Operations & System sections inside a fixed 248px Harbor Navy sidebar collapsing into an Escape-dismissible drawer below `960px`.
- Monospaced tabular columns (`JetBrains Mono`) paired with `Manrope` typography bundled directly under `/fonts/` to obey strict Nginx `'self'` CSP rules.
- Accessible `<Modal>` dialogs for rejection notes, RBAC role changes, and suspension audit reasons with zero blocking browser prompts.

## Colors

### Primary
- **Signal Crimson CTA** (`#D90410`): Primary queue/analytics triggers and hover deepens (`#B8030D`).
- **Parkly Pin Crimson** (`#EF010C`): Brand pin and single active-route nav indicator dot.

### Secondary
- **Harbor Navy** (`#0B1628`) & **Harbor Navy Surface** (`#14243D`): Command rail shell and table ink.
- **Emerald Verified** (`#0F766E`), **Amber Review** (`#B45309`), and **Cobalt Corridor** (`#0369A1`): Verification, dispute resolution, and corridor alert badges.

### Neutral
- **Limestone Ground** (`#F7F6F2`), **Paper White** (`#FFFFFF`), **Limestone Inset** (`#F1EFE9`), **Hairline** (`#DFDDD4`), **Ink Muted** (`#5A6678`).

### Named Rules
**The Restrained Signal Rule.** Critical crimson badges and borders mark unresolved disputes and critical alerts cleanly; resolved items shift immediately to verified emerald.

## Typography

**Display Font:** `Manrope` (`800`, `26px`, `-0.025em`)
**Body Font:** `Manrope` (`500`, `13.5px`, `1.45`)
**Label/Mono Font:** `JetBrains Mono` (`700`, `11px`, tabular numerals)

### Hierarchy
- **Display**: Page `<h1>` titles (`26px`).
- **Title**: Section `<h2 className="card-title">` (`15px`).
- **Label**: Table headers (`11px`, uppercase) and audit timestamps/IP addresses.

## Layout

Fixed `248px` dark left command rail + fluid main canvas (`max-width: 1480px`), scaling cleanly across 4-column metric rows, dual Recharts zone/carbon panels, and responsive full-width data tables.

## Elevation & Depth

`1px solid #DFDDD4` structural hairlines replace heavy glow cards; floating shadow (`0 18px 40px rgba(11, 22, 40, 0.16)`) is reserved strictly for modals and Recharts tooltips.

## Shapes

Consistent `10px` panels, `7px` form controls/buttons, `5px` semantic badges, `999px` corridor diversion capacity bars.

## Components

Shared buttons, `<Modal>` dialog wrapper with focus restoration, `Corridor Diversion Horizon` relief bars, daylight Recharts grids (`#E5E2D8`), and unified `1.75px` vector SVG icon suite (`Icons.tsx`).

## Do's and Don'ts

### Do:
- **Do** enforce WCAG AA contrast across badges, tables, and placeholders (`#5A6678`).
- **Do** keep `<h1>` -> `<h2>` heading levels sequential across every route card.

### Don't:
- **Don't** render emojis or `window.prompt`/`alert` inside admin workflows.
- **Don't** add `border-left: 3px` active link borders or unstyled dark chart tooltips.
