import React from 'react';
import { View, Text, StyleSheet, ScrollView, Linking } from 'react-native';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, theme } from '../src/constants/theme';
import { ENTER_FADE_UP, PressScale } from '../src/components/Motion';

const SECTIONS = [
  {
    badge: 'DPDPA 2023 COMPLIANCE',
    title: 'Data Minimization & Erasure',
    body: 'Parkly stores only your phone hash, TN vehicle plate reference, and reservation history. You can request full DPDPA right-to-erasure anonymization at any time once active parking sessions are closed.',
  },
  {
    badge: 'PAYMENTS & REFUNDS',
    title: 'UPI Tokenization & Reversals',
    body: 'Card numbers and VPA credentials are processed exclusively via Razorpay Checkout and never stored in plain text on Parkly servers. Timed-out holds trigger automatic gateway reversal within 24–48 hours.',
  },
  {
    badge: 'CHENNAI MARKETPLACE TERMS',
    title: 'Overstay, Entry Gates & Safety',
    body: 'Reservations grant single-vehicle access for the booked bay window. Overstays beyond the 10-minute grace period accrue hourly dynamic surge rates billed before barrier exit.',
  },
];

export default function LegalScreen() {
  const insets = useSafeAreaInsets();

  return (
    <View style={styles.container}>
      <StatusBar style="light" backgroundColor={colors.navy} />

      <View style={[styles.header, { paddingTop: Math.max(insets.top + 8, 18) }]}>
        <PressScale
          style={styles.backBtn}
          contentStyle={styles.backBtnContent}
          rippleColor={colors.rippleLight}
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)/home'))}
          accessibilityLabel="Go back"
        >
          <Ionicons name="arrow-back" size={20} color={colors.white} />
        </PressScale>
        <Text style={styles.headerTitle}>Terms &amp; DPDPA Privacy</Text>
        <View style={{ width: 48 }} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          padding: 18,
          paddingBottom: Math.max(insets.bottom + 24, 36),
          gap: 14,
        }}
      >
        <Animated.View entering={ENTER_FADE_UP} style={styles.heroCard}>
          <View style={styles.heroIcon}>
            <Ionicons name="shield-checkmark-outline" size={24} color={colors.navy} />
          </View>
          <Text style={styles.heroTitle}>ZEUS Technologies · Parkly Chennai</Text>
          <Text style={styles.heroSub}>
            Last updated November 2026 · Aligned with India Digital Personal Data Protection Act (DPDPA) and RBI payment security guidelines.
          </Text>
        </Animated.View>

        {SECTIONS.map((sec) => (
          <View key={sec.title} style={styles.sectionCard}>
            <Text style={styles.sectionBadge}>{sec.badge}</Text>
            <Text style={styles.sectionTitle}>{sec.title}</Text>
            <Text style={styles.sectionBody}>{sec.body}</Text>
          </View>
        ))}

        <PressScale
          style={styles.dpoBtn}
          contentStyle={styles.btnInner}
          rippleColor={colors.rippleLight}
          haptic="medium"
          onPress={() => {
            Linking.openURL('mailto:privacy@parkly.app?subject=DPDPA%20Data%20Erasure%20Request').catch(() => {});
          }}
        >
          <Ionicons name="mail-outline" size={18} color={colors.white} />
          <Text style={styles.dpoBtnText}>Request DPDPA Data Export or Erasure</Text>
        </PressScale>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingBottom: 14,
    backgroundColor: colors.navy,
  },
  backBtn: { borderRadius: 12, backgroundColor: colors.navySurface, overflow: 'hidden' },
  backBtnContent: { width: 48, height: 48, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { color: colors.white, fontSize: 17, fontWeight: '800' },
  heroCard: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 18,
    gap: 8,
    ...theme.elevation.card,
  },
  heroIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: colors.cardElevated,
    borderWidth: 1,
    borderColor: colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  heroTitle: { color: colors.navy, fontSize: 17, fontWeight: '800' },
  heroSub: { color: colors.textSecondary, fontSize: 13.5, lineHeight: 19 },
  sectionCard: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 18,
    gap: 6,
    ...theme.elevation.card,
  },
  sectionBadge: { color: colors.primary, fontSize: 11, fontWeight: '800', letterSpacing: 0.9 },
  sectionTitle: { color: colors.navy, fontSize: 16, fontWeight: '800' },
  sectionBody: { color: colors.textSecondary, fontSize: 13.5, lineHeight: 20 },
  dpoBtn: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    overflow: 'hidden',
    marginTop: 4,
  },
  btnInner: {
    minHeight: 50,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 16,
  },
  dpoBtnText: { color: colors.white, fontSize: 14.5, fontWeight: '800' },
});
