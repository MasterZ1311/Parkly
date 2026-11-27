import { Stack } from 'expo-router';
import { useReducedMotion } from 'react-native-reanimated';

export default function AuthLayout() {
  const reducedMotion = useReducedMotion();

  return (
    <Stack screenOptions={{ headerShown: false, animation: reducedMotion ? 'fade' : 'default' }}>
      <Stack.Screen name="login" />
      <Stack.Screen name="otp" />
    </Stack>
  );
}
