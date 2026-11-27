import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, theme } from '../../src/constants/theme';
import { ENTER_FADE_UP, PressScale } from '../../src/components/Motion';

export default function BookingExpiredScreen() {
  const { bookingId, spaceName, zone } = useLocalSearchParams<{
    bookingId?: string;
    spaceName?: string;
    zone?: string;
  }>();
  const insets = useSafeAreaInsets();

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[
        styles.content,
        {
          paddingTop: Math.max(insets.top + 16, 36),
          paddingBottom: Math.max(insets.bottom + 24, 36),
        },
      ]}
    >
      <StatusBar style="dark" backgroundColor={colors.background} />

      <PressScale
        onPress={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)/home'))}
        style={styles.backBtn}
        contentStyle={styles.backBtnContent}
        accessibilityLabel="Go back"
      >
        <Ionicons name="arrow-back" size={20} color={colors.navy} />
      </PressScale>

      <Animated.View entering={ENTER_FADE_UP} style={styles.card}>
        <View style={styles.iconCircle}>
          <Ionicons name="hourglass-outline" size={34} color={colors.warning} />
        </View>

        <Text style={styles.meta}>RESERVATION HOLD ELAPSED</Text>
        <Text style={styles.title}>Slot Hold Timed Out</Text>
        <Text style={styles.subtitle}>
          The 15-minute checkout hold for{' '}
          <Text style={{ fontWeight: '800', color: colors.navy }}>
            {spaceName || 'T Nagar Parking Complex'}
          </Text>{' '}
          expired before confirmation, or another driver claimed the final bay.
        </Text>

        <View style={styles.detailCard}>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Reference</Text>
            <Text style={styles.detailValue}>{bookingId || 'HOLD-TIMEOUT'}</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Corridor</Text>
            <Text style={styles.detailValue}>{zone || 'T Nagar · Panagal Park'}</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Authorization Status</Text>
            <Text style={[styles.detailValue, { color: colors.success }]}>No Charge Taken</Text>
          </View>
        </View>

        <View style={styles.actions}>
          <PressScale
            style={styles.primaryBtn}
            contentStyle={styles.btnInner}
            rippleColor={colors.rippleLight}
            haptic="medium"
            onPress={() => router.replace('/(tabs)/map')}
          >
            <Ionicons name="map-outline" size={18} color={colors.white} />
            <Text style={styles.primaryBtnText}>Find Nearest Open Bay</Text>
          </PressScale>

          <PressScale
            style={styles.outlineBtn}
            contentStyle={styles.btnInner}
            haptic="light"
            onPress={() => router.replace('/(tabs)/concierge')}
          >
            <Ionicons name="sparkles-outline" size={18} color={colors.navy} />
            <Text style={styles.outlineBtnText}>Ask Concierge for Alternatives</Text>
          </PressScale>

          <PressScale
            style={styles.outlineBtn}
            contentStyle={styles.btnInner}
            haptic="light"
            onPress={() => router.replace('/(tabs)/home')}
          >
            <Ionicons name="search-outline" size={18} color={colors.navy} />
            <Text style={styles.outlineBtnText}>Back to Search</Text>
          </PressScale>
        </View>
      </Animated.View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { flexGrow: 1, paddingHorizontal: 18 },
  backBtn: {
    alignSelf: 'flex-start',
    borderRadius: 12,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 16,
    overflow: 'hidden',
  },
  backBtnContent: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 24,
    alignItems: 'center',
    ...theme.elevation.card,
  },
  iconCircle: {
    width: 68,
    height: 68,
    borderRadius: 16,
    backgroundColor: colors.warningLight,
    borderWidth: 1,
    borderColor: colors.warningBorder,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 14,
  },
  meta: { color: colors.warning, fontSize: 11, fontWeight: '800', letterSpacing: 1, marginBottom: 6 },
  title: { color: colors.navy, fontSize: 22, fontWeight: '800', textAlign: 'center', marginBottom: 8 },
  subtitle: {
    color: colors.textSecondary,
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    marginBottom: 20,
  },
  detailCard: {
    width: '100%',
    backgroundColor: colors.cardElevated,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    gap: 8,
    marginBottom: 22,
  },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  detailLabel: { color: colors.textMuted, fontSize: 12.5, fontWeight: '600' },
  detailValue: { color: colors.navy, fontSize: 13, fontWeight: '800', fontVariant: ['tabular-nums'] },
  actions: { width: '100%', gap: 10 },
  primaryBtn: { backgroundColor: colors.primary, borderRadius: 12, overflow: 'hidden' },
  outlineBtn: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.borderStrong,
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
  outlineBtnText: { color: colors.navy, fontSize: 14.5, fontWeight: '700' },
});
