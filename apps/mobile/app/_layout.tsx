import React, { useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { Stack, router, ErrorBoundaryProps } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import * as SplashScreen from 'expo-splash-screen';
import * as Notifications from 'expo-notifications';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useReducedMotion } from 'react-native-reanimated';
import { useAuthStore } from '../src/store/auth.store';
import { colors, theme } from '../src/constants/theme';
import { PressScale } from '../src/components/Motion';
import { configureNotifications } from '../src/services/notifications';

SplashScreen.preventAutoHideAsync().catch(() => {});

export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  return (
    <ScrollView style={ebStyles.container} contentContainerStyle={ebStyles.content}>
      <StatusBar style="dark" backgroundColor={colors.background} />
      <View style={ebStyles.card}>
        <View style={ebStyles.iconBox}>
          <Ionicons name="warning-outline" size={32} color={colors.danger} />
        </View>
        <Text style={ebStyles.meta}>MOBILE RECOVERY</Text>
        <Text style={ebStyles.title}>Screen Encountered an Error</Text>
        <Text style={ebStyles.subtitle}>
          A temporary rendering issue interrupted this screen. Your reservations and offline passes remain safe.
        </Text>

        <View style={ebStyles.errorBox}>
          <Text style={ebStyles.errorText} numberOfLines={4}>
            {error?.message || 'Unexpected application error'}
          </Text>
        </View>

        <View style={ebStyles.actions}>
          <PressScale
            style={ebStyles.primaryBtn}
            contentStyle={ebStyles.btnInner}
            rippleColor={colors.rippleLight}
            onPress={retry}
          >
            <Ionicons name="refresh" size={18} color={colors.white} />
            <Text style={ebStyles.primaryBtnText}>Retry Screen</Text>
          </PressScale>
          <PressScale
            style={ebStyles.outlineBtn}
            contentStyle={ebStyles.btnInner}
            onPress={() => router.replace('/(tabs)/home')}
          >
            <Ionicons name="home-outline" size={18} color={colors.navy} />
            <Text style={ebStyles.outlineBtnText}>Return to Find Parking</Text>
          </PressScale>
        </View>
      </View>
    </ScrollView>
  );
}

export default function RootLayout() {
  const { loadUser } = useAuthStore();
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    configureNotifications();
    loadUser();

    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data as
        | { bookingId?: string; route?: string }
        | undefined;
      if (data?.bookingId) {
        router.push({ pathname: '/booking/[id]', params: { id: data.bookingId } });
      } else if (data?.route) {
        router.push(data.route as '/(tabs)/bookings');
      }
    });

    const timer = setTimeout(() => {
      SplashScreen.hideAsync().catch(() => {});
    }, 250);

    return () => {
      clearTimeout(timer);
      sub.remove();
    };
  }, [loadUser]);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <StatusBar style="light" backgroundColor={colors.navy} />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: colors.navy },
          headerTintColor: colors.white,
          headerTitleStyle: { fontWeight: '700', color: colors.white },
          contentStyle: { backgroundColor: colors.background },
          animation: reducedMotion ? 'fade' : 'default',
        }}
      >
        <Stack.Screen name="(auth)" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="space/[id]" options={{ title: 'Space Details', headerShown: false }} />
        <Stack.Screen name="booking/[id]" options={{ title: 'Booking Details', headerShown: false }} />
        <Stack.Screen name="booking/create" options={{ title: 'Confirm Booking', headerShown: false }} />
        <Stack.Screen name="booking/payment-failed" options={{ title: 'Payment Failed', headerShown: false }} />
        <Stack.Screen name="booking/expired" options={{ title: 'Reservation Expired', headerShown: false }} />
        <Stack.Screen name="profile/vehicles" options={{ title: 'My Vehicles', headerShown: false }} />
        <Stack.Screen name="profile/driver-kyc" options={{ title: 'Driver KYC & RC Verification', headerShown: false }} />
        <Stack.Screen name="profile/saved-places" options={{ title: 'Saved Places', headerShown: false }} />
        <Stack.Screen name="profile/notifications" options={{ title: 'Notification Preferences', headerShown: false }} />
        <Stack.Screen name="profile/payment-methods" options={{ title: 'UPI & Payment Methods', headerShown: false }} />
        <Stack.Screen name="host/spaces" options={{ title: 'Rent Out Private Space', headerShown: false }} />
        <Stack.Screen name="host/kyc" options={{ title: 'Host KYC & Plot Proof', headerShown: false }} />
        <Stack.Screen name="status/[type]" options={{ title: 'Service Notice', headerShown: false }} />
        <Stack.Screen name="legal" options={{ title: 'Terms & DPDPA Privacy', headerShown: false }} />
        <Stack.Screen name="support" options={{ title: 'Chennai Help Center', headerShown: false }} />
      </Stack>
    </GestureHandlerRootView>
  );
}

const ebStyles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { flexGrow: 1, justifyContent: 'center', padding: 20 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 24,
    alignItems: 'center',
    ...theme.elevation.card,
  },
  iconBox: {
    width: 64,
    height: 64,
    borderRadius: 16,
    backgroundColor: colors.dangerLight,
    borderWidth: 1,
    borderColor: colors.dangerBorder,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 14,
  },
  meta: { color: colors.danger, fontSize: 11, fontWeight: '800', letterSpacing: 1, marginBottom: 6 },
  title: { color: colors.navy, fontSize: 21, fontWeight: '800', textAlign: 'center', marginBottom: 8 },
  subtitle: { color: colors.textSecondary, fontSize: 14, lineHeight: 20, textAlign: 'center', marginBottom: 16 },
  errorBox: {
    width: '100%',
    backgroundColor: colors.cardElevated,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
    marginBottom: 20,
  },
  errorText: { color: colors.danger, fontSize: 12, fontWeight: '600' },
  actions: { width: '100%', gap: 10 },
  primaryBtn: { backgroundColor: colors.primary, borderRadius: 12, overflow: 'hidden' },
  outlineBtn: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    overflow: 'hidden',
  },
  btnInner: { minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  primaryBtnText: { color: colors.white, fontSize: 15, fontWeight: '800' },
  outlineBtnText: { color: colors.navy, fontSize: 14.5, fontWeight: '700' },
});
