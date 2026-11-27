# Product

<!-- impeccable:product-schema 1 -->

## Platform

android

## Users

Daily commuters, shoppers, and EV drivers across Chennai (including two-wheeler, compact, sedan, and SUV owners) searching, navigating to, and reserving verified off-street parking via mobile OTP login.

## Product Purpose

Help drivers rapidly discover available Chennai parking spaces, inspect live probability/pricing/amenities, complete UPI reservations with minimal friction, display crisp scannable gate QR passes, and ask the Chennai Driver Concierge for spot recommendations.

## Positioning

Unifies real-time local discovery (including neighborhood filtering, Chennai corridor prompts, and OpenFreeMap on web / native marker fallback), instant INR + UPI booking, offline-resilient cached QR passes, and conversational Concierge routing in one native-feeling experience.

## Operating Context

Used outdoors in bright Chennai sunlight while preparing to drive or arriving at parking gates (`apps/mobile`, Expo SDK 54, `expo-router ~6`). Drivers switch tabs seamlessly between Search (`home`), Map (`map`), Bookings (`bookings`), Concierge (`concierge`), and Profile (`profile`), plus detail flows (`space/[id]`, `booking/create`, `booking/[id]`).

## Capabilities and Constraints

- Target **Android-first** native ergonomics (Material elevation/surfaces, ripple/scale press physics, crisp edge-to-edge/status bar legibility, 48dp+ touch targets) while keeping iOS and Expo web compatibility intact.
- Motion powered by `react-native-reanimated`, `react-native-worklets`, `react-native-gesture-handler`, and `expo-haptics` matching `animate-expo` UI-thread standards.
- Preserve all `searchApi`, `bookingApi`, `paymentApi`, `pricingApi`, `conciergeApi`, `useAuthStore`, and `cacheGet`/`cacheSet` offline fallback behaviors verbatim.
- Preserve `+91` phone OTP flow, Indian license plate regex validation (`TN01AB1234`), INR pricing + 5% platform fee math, and `OfflineBanner` warnings.

## Brand Commitments

- Unify with the shared brighter, high-contrast Parkly visual world and clear hierarchy across web and mobile (fixing the legacy dark `#0F172A`/`#0A1425`/`#38BDF8` vs `#EF010C` color split).
- Refresh Parkly SVG/iconographic presentation alongside `assets/logo.png` (`app.json` icon/splash/theme harmonized).

## Evidence on Hand

- Expo SDK 54 app with `(auth)/login`, `(auth)/otp`, `(tabs)/{home,map,bookings,concierge,profile}`, `space/[id]`, `booking/create`, `booking/[id]`, `FreeMap.tsx` + `FreeMap.web.tsx`, `OfflineBanner.tsx`, and `assets/{logo.png,icon.png,adaptive-icon.png,splash.png,favicon.png}`.

## Product Principles

1. **Sunlight & Street Readiness**: High-contrast light surfaces and unmistakable active states ensure zero glare strain at parking gates and intersections.
2. **UI-Thread Tactile Fluidity**: Press feedback, filter transitions, card entrances, and sheet drag physics respond smoothly without JS-thread hitching.
3. **Glanceable Reservation Passes**: Gate QR codes, slot badges, timing, and ₹ totals read in under a second—even when offline.

## Accessibility & Inclusion

- System `useReducedMotion()` / `ReduceMotion.System` support across all Reanimated transitions and Stack navigators, >= 48dp hit targets, high-contrast status chips, and readable tabular prices.
