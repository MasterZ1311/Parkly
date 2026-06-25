import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useAuthStore } from '../src/store/auth.store';

export default function RootLayout() {
  const { loadUser } = useAuthStore();

  useEffect(() => {
    loadUser();
  }, []);

  return (
    <>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: '#0F172A' },
          headerTintColor: '#38BDF8',
          headerTitleStyle: { fontWeight: 'bold', color: '#F8FAFC' },
          contentStyle: { backgroundColor: '#0F172A' },
        }}
      >
        <Stack.Screen name="(auth)" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="space/[id]" options={{ title: 'Space Details', headerShown: false }} />
        <Stack.Screen name="booking/[id]" options={{ title: 'Booking Details' }} />
        <Stack.Screen name="booking/create" options={{ title: 'Confirm Booking', headerShown: false }} />
      </Stack>
    </>
  );
}
