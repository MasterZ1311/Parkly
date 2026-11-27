import React from 'react';
import { View, Text, StyleSheet, ScrollView, Linking } from 'react-native';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, theme } from '../src/constants/theme';
import { ENTER_FADE_UP, PressScale } from '../src/components/Motion';

const FAQS = [
  {
    q: 'Entry barrier scanner does not recognize my QR pass',
    a: 'Increase screen brightness and open My Bookings — cached QR tokens work offline even in basement garages with weak signal.',
  },
  {
    q: 'UPI debited after payment timed out',
    a: 'Razorpay automatically voids uncaptured holds. Reversals appear on your GPay, PhonePe, or bank statement within 24–48 hours.',
  },
  {
    q: 'Bay occupied upon arrival at Chennai host lot',
    a: 'Tap Report Issue on your booking pass or ask Driver Concierge to reassign an adjacent bay immediately with full fee protection.',
  },
];

export default function SupportScreen() {
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
        <Text style={styles.headerTitle}>Chennai Help Center</Text>
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
          <Text style={styles.meta}>24/7 CHENNAI DRIVER DESK</Text>
          <Text style={styles.heroTitle}>Gate Pass &amp; Payment Assistance</Text>
          <Text style={styles.heroSub}>
            Immediate troubleshooting for barrier entry, hold expirations, UPI reversals, and parking host disputes.
          </Text>
          <View style={styles.quickRow}>
            <PressScale
              style={styles.primaryBtn}
              contentStyle={styles.btnInner}
              rippleColor={colors.rippleLight}
              haptic="medium"
              onPress={() => router.replace('/(tabs)/concierge')}
            >
              <Ionicons name="chatbubbles-outline" size={18} color={colors.white} />
              <Text style={styles.primaryBtnText}>Ask Driver Concierge</Text>
            </PressScale>
            <PressScale
              style={styles.outlineBtn}
              contentStyle={styles.btnInner}
              haptic="light"
              onPress={() => {
                Linking.openURL('mailto:support@parkly.app?subject=Parkly%20Urgent%20Gate%20Help').catch(() => {});
              }}
            >
              <Ionicons name="mail-outline" size={18} color={colors.navy} />
              <Text style={styles.outlineBtnText}>Email Support</Text>
            </PressScale>
          </View>
        </Animated.View>

        <Text style={styles.sectionLabel}>FREQUENT RECOVERY TOPICS</Text>
        {FAQS.map((item) => (
          <View key={item.q} style={styles.faqCard}>
            <Text style={styles.faqQ}>{item.q}</Text>
            <Text style={styles.faqA}>{item.a}</Text>
          </View>
        ))}

        <PressScale
          style={styles.legalRow}
          contentStyle={styles.legalRowInner}
          onPress={() => router.push('/legal')}
        >
          <Ionicons name="document-text-outline" size={18} color={colors.info} />
          <Text style={styles.legalText}>View Terms &amp; DPDPA Privacy Policy</Text>
          <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
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
  meta: { color: colors.primary, fontSize: 11, fontWeight: '800', letterSpacing: 0.9 },
  heroTitle: { color: colors.navy, fontSize: 18, fontWeight: '800' },
  heroSub: { color: colors.textSecondary, fontSize: 13.5, lineHeight: 19, marginBottom: 6 },
  quickRow: { gap: 10 },
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
  sectionLabel: { color: colors.textMuted, fontSize: 11, fontWeight: '800', letterSpacing: 0.9, marginTop: 4 },
  faqCard: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    gap: 6,
    ...theme.elevation.card,
  },
  faqQ: { color: colors.navy, fontSize: 15, fontWeight: '700' },
  faqA: { color: colors.textSecondary, fontSize: 13.5, lineHeight: 19 },
  legalRow: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  legalRowInner: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    gap: 10,
  },
  legalText: { flex: 1, color: colors.navy, fontSize: 14, fontWeight: '700' },
});
