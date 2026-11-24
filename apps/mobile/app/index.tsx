import React, { useEffect } from 'react';
import { router } from 'expo-router';
import { View, ActivityIndicator } from 'react-native';

export default function Index() {
  useEffect(() => {
    // Navigate smoothly to home once mounted
    const timer = setTimeout(() => {
      router.replace('/(tabs)/home');
    }, 100);
    return () => clearTimeout(timer);
  }, []);

  return (
    <View style={{ flex: 1, backgroundColor: '#0A1425', justifyContent: 'center', alignItems: 'center' }}>
      <ActivityIndicator size="large" color="#38BDF8" />
    </View>
  );
}
