# Parkly Driver Mobile App (`apps/mobile`)

> **Stack**: Expo SDK 54 · React Native `0.81.5` · React `19.1.0` · Expo Router v6 · Zustand · `@maplibre/maplibre-react-native`

---

## Running Locally & Building Native Android

```bash
# 1. Install mobile dependencies (from repo root or inside apps/mobile)
npm --prefix apps/mobile ci --no-audit --no-fund

# 2. Typecheck & run Jest unit/integration tests
npx --prefix apps/mobile tsc --noEmit
npm --prefix apps/mobile test

# 3. Generate native Android project & build Debug APK
cd apps/mobile
npx expo prebuild --platform android --clean
cd android
./gradlew assembleDebug
```

On Windows PowerShell:

```powershell
cd apps/mobile
npx expo prebuild --platform android
cd android
.\gradlew.bat assembleDebug
```

---

## API & Demo Mode Policy

- **API Endpoint**: `EXPO_PUBLIC_API_URL` overrides the gateway URL. Otherwise the client derives the LAN host from Expo `hostUri`, or falls back to `http://10.0.2.2:4000/api/v1` on Android emulators and `http://localhost:4000/api/v1` on iOS/Web.
- **Strict Real Errors by Default**: Requests hit live Parkly microservices (`auth-service`, `search-service`, `booking-service`, `payment-service`, `notification-service`) with honest error/expiry/payment-failure routing (`/booking/payment-failed`, `/booking/expired`, `/status/*`).
- **Opt-In Demo Mode**: Drivers and reviewers without a running local backend can explicitly enable **Demo Mode** from the Login screen toggle (`EXPO_PUBLIC_DEMO_MODE=false` by default).

---

## Native Stack Features

- **Zero-Key Vector Maps**: `@maplibre/maplibre-react-native` + OpenFreeMap vector tiles + live `expo-location` GPS.
- **Two-Step Checkout & UPI Sheet**: `/bookings` -> `/payments/initiate` -> in-app UPI/Razorpay checkout sheet with 15-minute hold countdown -> `/payments/:id/confirm`.
- **Offline QR Gate Passes**: Deterministic vector SVG QR passes (`QrPassSvg`) cached locally for underground garage entry.
- **Driver Garage & Alerts**: `My Vehicles`, `Saved Places`, `Notification Prefs` (`expo-notifications`), and `UPI Methods`.
