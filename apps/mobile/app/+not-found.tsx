import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, theme } from '../src/constants/theme';
import { ENTER_FADE_UP, PressScale } from '../src/components/Motion';
import { ParklyBrandBadge } from '../src/components/ParklyBrandBadge';

export default function NotFoundScreen() {
  const insets = useSafeAreaInsets();

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[
        styles.content,
        {
          paddingTop: Math.max(insets.top + 24, 48),
          paddingBottom: Math.max(insets.bottom + 24, 36),
        },
      ]}
    >
      <StatusBar style="dark" backgroundColor={colors.background} />

      <Animated.View entering={ENTER_FADE_UP} style={styles.card}>
        <ParklyBrandBadge size="md" />

        <View style={styles.iconCircle}>
          <Ionicons name="compass-outline" size={32} color={colors.primary} />
        </View>

        <Text style={styles.meta}>DEEP LINK OR ROUTE NOT FOUND</Text>
        <Text style={styles.title}>We Could Not Locate That Parking View</Text>
        <Text style={styles.subtitle}>
          The parking listing, gate pass link, or shared route may have expired, moved, or been removed by its host.
        </Text>

        <View style={styles.actions}>
          <PressScale
            style={styles.primaryBtn}
            contentStyle={styles.btnInner}
            rippleColor={colors.rippleLight}
            haptic="light"
            onPress={() => router.replace('/(tabs)/home')}
          >
            <Ionicons name="search" size={18} color={colors.white} />
            <Text style={styles.primaryBtnText}>Find Chennai Parking</Text>
          </PressScale>

          <PressScale
            style={styles.secondaryBtn}
            contentStyle={styles.btnInner}
            haptic="light"
            onPress={() => router.replace('/(tabs)/bookings')}
          >
            <Ionicons name="qr-code-outline" size={18} color={colors.navy} />
            <Text style={styles.secondaryBtnText}>Open My Gate Passes</Text>
          </PressScale>

          <PressScale
            style={styles.outlineBtn}
            contentStyle={styles.btnInner}
            haptic="light"
            onPress={() => router.replace('/(tabs)/concierge')}
          >
            <Ionicons name="chatbubble-ellipses-outline" size={18} color={colors.navy} />
            <Text style={styles.outlineBtnText}>Ask Driver Concierge</Text>
          </PressScale>
        </View>
      </Animated.View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 20 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 26,
    alignItems: 'center',
    ...theme.elevation.card,
  },
  iconCircle: {
    width: 68,
    height: 68,
    borderRadius: 16,
    backgroundColor: colors.primaryLight,
    borderWidth: 1,
    borderColor: colors.primaryBorder,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 18,
    marginBottom: 14,
  },
  meta: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
    marginBottom: 6,
  },
  title: {
    color: colors.navy,
    fontSize: 22,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    color: colors.textSecondary,
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    marginBottom: 24,
  },
  actions: { width: '100%', gap: 10 },
  primaryBtn: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    overflow: 'hidden',
  },
  secondaryBtn: {
    backgroundColor: colors.cardElevated,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    overflow: 'hidden',
  },
  outlineBtn: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  btnInner: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 16,
  },
  primaryBtnText: { color: colors.white, fontSize: 15, fontWeight: '800' },
  secondaryBtnText: { color: colors.navy, fontSize: 14.5, fontWeight: '700' },
  outlineBtnText: { color: colors.navy, fontSize: 14.5, fontWeight: '700' },
});
