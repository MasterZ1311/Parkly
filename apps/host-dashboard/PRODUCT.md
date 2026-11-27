# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Parking space hosts and commercial/residential facility operators in Chennai, Tamil Nadu managing Bay inventory, dynamic hourly pricing, AI-assisted space verification, reservation tracking, and monthly INR settlements.

## Product Purpose

Give hosts an immediate, daylight-legible operational control surface to list parking spaces, inspect occupancy and revenue trends, run autonomous AI KYC/vision verification checks, and accept, complete, or reject incoming driver reservations.

## Positioning

Purpose-built for Chennai off-street parking operators — uniting live bay occupancy, AI verification audits, INR payout visibility, and Indian vehicle/tariff telemetry in one uncluttered operational desk rather than a generic rental backoffice.

## Operating Context

Hosts work in mixed daylight/indoor booth environments and tablet/desktop browsers (`apps/host-dashboard`) behind an Nginx edge with strict `Content-Security-Policy` rules, checking KPI summary cards, listings modals, booking status actions, Recharts revenue breakdowns, and payout settings.

## Capabilities and Constraints

- Preserve all existing React Router routes (`/`, `/listings`, `/bookings`, `/revenue`, `/settings`, and 404 fallback), `hostApi` endpoints, and `useHostData` hook contracts verbatim.
- Preserve strict Stage D backend/database boundaries; never alter API payloads or fabricate backend capabilities.
- Respect `apps/host-dashboard/nginx.conf` security headers (`font-src 'self' data:`, `style-src 'self' 'unsafe-inline'`, `img-src 'self' data: https:`) via self-hosted/bundled fonts and static assets.
- Currency in INR (`₹`), addresses in Chennai zones (`T Nagar`, `Anna Nagar`, `OMR`, `Adyar`, `Velachery`), Indian license plates (`TN...`), and GST/UPI settlement terminology.

## Brand Commitments

- Transition from the legacy dark navy shell to a cohesive brighter, high-contrast operational visual direction and refined typography system shared across all three Parkly surfaces.
- Preserve Parkly Crimson (`#EF010C`) alongside crisp ink/surface contrast, and refresh the portal favicon and SVG app mark alongside the UI upgrade.

## Evidence on Hand

- Existing Vite + React 18 SPA routes (`Dashboard`, `Listings`, `BookingsPage`, `Revenue`, `Settings`, `NotFound`), `Breadcrumbs`, `useListings`/`useBookings`/`useRevenue` hooks with live API calls + local fallback fixtures, and `public/logo.png` brand mark.
- No fake live backend guarantees: operational charts and fallback records clearly represent fallback/demo state when API responses are absent.

## Product Principles

1. **Instant Daylight Scannability**: Key occupancy, pending actions, and ₹ earnings must read cleanly at a glance without heavy chrome or emoji clutter.
2. **Honest Operational Controls**: Every destructive or verification action keeps clear confirmation, disabled/pending state, and non-blocking inline feedback.
3. **Strict Architectural Preservation**: UI, styling, and interaction polish evolve without breaking API schemas, routing contracts, or CSP compliance.

## Accessibility & Inclusion

- WCAG AA contrast across light/bright surfaces, visible keyboard focus rings, semantic modal markup, and `prefers-reduced-motion` compliance.
