// ============================================================
// Parkly Mobile — Offline Indicator Banner
// Informs drivers when device is disconnected or showing cached state.
// ============================================================

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface OfflineBannerProps {
  visible?: boolean;
  message?: string;
}

export function OfflineBanner({
  visible = true,
  message = 'Offline Mode — Showing saved reservations & cached spaces',
}: OfflineBannerProps) {
  if (!visible) return null;

  return (
    <View style={styles.banner}>
      <Ionicons name="cloud-offline" size={16} color="#F59E0B" />
      <Text style={styles.text}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    backgroundColor: '#78350F',
    paddingVertical: 7,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#92400E',
  },
  text: {
    color: '#FDE68A',
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
});

export default OfflineBanner;
