// ============================================================
// Parkly Mobile — Offline Indicator Banner
// Informs drivers when device is disconnected or showing cached state.
// ============================================================

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../constants/theme';

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
      <Ionicons name="cloud-offline-outline" size={16} color={colors.warning} />
      <Text style={styles.text} numberOfLines={1}>
        {message}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    backgroundColor: colors.warningLight,
    paddingVertical: 8,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.warningBorder,
  },
  text: {
    color: colors.warning,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
});

export default OfflineBanner;
