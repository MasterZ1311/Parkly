# 📱 Parkly Driver Mobile App (`apps/mobile`)

> **Stack**: Expo SDK 54 · React Native `0.79.1` · React `19.0.0` (exact pin) · Expo Router v6 · Zustand

---

## Prerequisites & Version Constraint

Expo SDK 54's bundled native Android/iOS renderer (`react-native-renderer 19.0.0`) requires **React `19.0.0`** cleanly aligned. Dependencies in `package.json` lock `react` and `react-dom` to compatible `19.0.x` releases—use `19.0.0` when developing with Expo Go 54.

---

## Running on Android Studio Emulator (Recommended)

```bash
# 1. Start Android Studio AVD (e.g. Pixel 6 / Android 14 API 34) and verify ADB connection
adb devices

# 2. Forward Metro port (8081) and optionally API Gateway port (4000) to the emulator
adb reverse tcp:8081 tcp:8081
adb reverse tcp:4000 tcp:4000

# 3. Install mobile dependencies (first time only)
cd apps/mobile
npm install --legacy-peer-deps

# 4. Launch Metro Bundler and press 'a' to open in Android Emulator
npx expo start --clear
```

---

## Environment Configuration & Data Source Mode

- **API Endpoint**: Set `EXPO_PUBLIC_API_URL` in `apps/mobile/.env` when connecting to a hosted or non-localhost backend (on Android Emulator, `adb reverse tcp:4000 tcp:4000` allows querying `http://localhost:4000/api/v1` directly).
- **Local vs Live Backend**: By default (`EXPO_PUBLIC_LIVE_API` unset or `false`), the mobile app runs against a built-in stateful Chennai parking dataset (T Nagar, Anna Nagar, Adyar, Velachery, OMR, Mylapore) supporting search, AI Concierge recommendations, OTP login, vehicle management, and Entry Gate QR passes. Set `EXPO_PUBLIC_LIVE_API=true` to route traffic to live microservices.

---

## Useful Documentation

- 📸 [Mobile App Emulator Walkthrough & Screenshots](../../docs/09_MOBILE_APP_DEMO_WALKTHROUGH.md)
- 🎬 [Animated Product Demo GIF Showcase](../../docs/10_DEMO_GIF_AND_LAUNCH_SHOWCASE.md)
- 🎨 [Parkly Brand Palette & Design Tokens](../../BRANDING_AND_COLOR_PALETTE.md)
