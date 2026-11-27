# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Parkly platform operations administrators, trust & safety reviewers, and Chennai city mobility / GCC governance analysts overseeing host verifications, dispute arbitration, user management, live bookings, corridor carbon impact, system alerts, and audit trails.

## Product Purpose

Provide a high-clarity city command desk to approve or reject pending host parking spaces, run AI-mediated dispute resolutions, audit corridor cruising/CO2 abatement telemetry, filter users and reservations, and act on live operational alerts.

## Positioning

Combines two-sided marketplace moderation (KYC verification + AI arbitration) with urban Chennai mobility telemetry (CMDA/GCC corridor cruising relief and CO2 abatement) in a cohesive precision interface.

## Operating Context

Operations staff monitor high-density tables, Recharts zone performance analytics, multi-tab verification/dispute queues, filterable audit logs, and platform threshold settings in `apps/admin-portal` under strict Nginx CSP enforcement.

## Capabilities and Constraints

- Preserve all React Router routes (`/`, `/verifications`, `/users`, `/bookings`, `/city-analytics`, `/alerts`, `/audit-logs`, `/settings`, and 404 fallback), `adminApi` calls, and `useAdminData` hook interfaces.
- Keep all Stage D database/API contracts intact without changing backend routes or fabricating new endpoints.
- Self-host/bundle fonts cleanly to comply with `apps/admin-portal/nginx.conf` `Content-Security-Policy` headers.
- Preserve INR (`₹`), Chennai corridor (`Panagal Park`, `Roundtana`, `Madhya Kailash`, `Lattice Bridge`), and GCC/CMDA domain terminology.

## Brand Commitments

- Adopt the shared brighter, high-contrast visual direction and typography system spanning Parkly's web portals and mobile app.
- Refresh the portal favicon and SVG app mark consistently alongside the Parkly Crimson (`#EF010C`) operational accent system.

## Evidence on Hand

- Existing Vite + React 18 views (`Overview`, `Verifications`, `UsersPage`, `BookingsAdmin`, `CityAnalytics`, `Alerts`, `AuditLogs`, `Settings`, `NotFound`), `useMetrics`/`useUsers`/`useAllBookings`/`useVerifications` hooks, and `public/logo.png`.

## Product Principles

1. **Signal Over Noise**: Severity badges, status states, and pending review counts stand out cleanly via disciplined contrast and tabular typography.
2. **Audit-Grade Legibility**: Tables, timestamps, booking IDs, and dispute resolution notes remain effortless to scan and verify.
3. **Calm Precision Under Load**: High-density admin workflows stay structured, keyboard-accessible, and faithful to live API feedback.

## Accessibility & Inclusion

- High-contrast text, crisp focus outlines, responsive sidebar navigation on narrower viewports, semantic table headers, and `prefers-reduced-motion` support.
