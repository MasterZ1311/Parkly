import { Redirect } from 'expo-router';

export default function Index() {
  // Direct access to drivers page without authentication requirement
  return <Redirect href="/(tabs)/home" />;
}
