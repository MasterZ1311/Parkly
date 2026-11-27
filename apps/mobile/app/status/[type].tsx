import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Linking } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { authApi } from '../../src/api/client';
import { useAuthStore } from '../../src/store/auth.store';
import { colors, theme } from '../../src/constants/theme';
import { ENTER_FADE_UP, PressScale } from '../../src/components/Motion';

type StatusType =
  | 'offline'
  | 'maintenance'
  | 'session-expired'
  | 'restricted'
  | 'location-denied'
  | 'server-error';

interface StatusSpec {
  icon: keyof typeof Ionicons.glyphMap;
  eyebrow: string;
  title: string;
  body: string;
  toneBg: string;
  toneBorder: string;
  toneFg: string;
  note: string;
}

const STATUS_SPECS: Record<StatusType, StatusSpec> = {
  offline: {
    icon: 'cloud-offline-outline',
    eyebrow: 'NETWORK DISCONNECTED',
    title: 'You Are Currently Offline',
    body: 'Live bay availability search and UPI checkout need cellular or Wi-Fi data. Any QR gate pass you already booked remains saved offline on this device.',
    toneBg: colors.warningLight,
    toneBorder: colors.warningBorder,
    toneFg: colors.warning,
    note: 'Cached reservations stay accessible under My Bookings even in basement garages.',
  },
  maintenance: {
    icon: 'construct-outline',
    eyebrow: 'HTTP 503 · SCHEDULED WINDOW',
    title: 'Parking Grid Maintenance Active',
    body: 'New bookings are temporarily paused while we upgrade Chennai parking pricing and ledger services. Existing confirmed QR gate passes continue scanning normally.',
    toneBg: colors.warningLight,
    toneBorder: colors.warningBorder,
    toneFg: colors.warning,
    note: 'Normal booking operations resume automatically once gateway checks pass.',
  },
  'session-expired': {
    icon: 'lock-closed-outline',
    eyebrow: 'HTTP 401 · AUTHENTICATION REQUIRED',
    title: 'Your Driver Session Timed Out',
    body: 'For your security, your sign-in token expired or was signed out on another device. Verify with OTP in seconds to resume booking.',
    toneBg: colors.dangerLight,
    toneBorder: colors.dangerBorder,
    toneFg: colors.danger,
    note: 'Your saved Chennai searches remain intact locally.',
  },
  restricted: {
    icon: 'alert-circle-outline',
    eyebrow: 'ACCOUNT COMPLIANCE NOTICE',
    title: 'Driver Account Under Review',
    body: 'New bookings on this account are paused pending support review for repeated no-show or gate dispute flags.',
    toneBg: colors.dangerLight,
    toneBorder: colors.dangerBorder,
    toneFg: colors.danger,
    note: 'Active ongoing parking sessions remain valid until checkout. Reference: #DRV-HOLD-204.',
  },
  'location-denied': {
    icon: 'location-outline',
    eyebrow: 'GPS PERMISSION DISABLED',
    title: 'Enable Location for Nearby Bays',
    body: 'Parkly uses your approximate Chennai coordinates only to sort nearby open bays and measure walking distance.',
    toneBg: colors.infoLight,
    toneBorder: colors.infoBorder,
    toneFg: colors.info,
    note: 'You can always browse parking manually by selecting a Chennai corridor below.',
  },
  'server-error': {
    icon: 'server-outline',
    eyebrow: 'HTTP 500 / 502 · GATEWAY INTERRUPTION',
    title: 'Booking Server Temporarily Unavailable',
    body: 'Our Chennai pricing or booking service experienced an unexpected interruption. No payment was captured for incomplete attempts.',
    toneBg: colors.dangerLight,
    toneBorder: colors.dangerBorder,
    toneFg: colors.danger,
    note: 'Retry the service check below or inspect existing QR gate passes offline.',
  },
};

const CHENNAI_ZONES = ['T Nagar', 'Anna Nagar', 'Adyar', 'Velachery'];

export default function StatusNoticeScreen() {
  const { type } = useLocalSearchParams<{ type?: string }>();
  const resolvedType: StatusType =
    type && type in STATUS_SPECS ? (type as StatusType) : 'offline';
  const spec = STATUS_SPECS[resolvedType];

  const insets = useSafeAreaInsets();
  const { setOfflineStatus } = useAuthStore();
  const [checkMsg, setCheckMsg] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);

  const handleRetryConnection = async () => {
    setChecking(true);
    setCheckMsg(null);
    try {
      await authApi.getMe();
      setOfflineStatus(false);
      setCheckMsg('Connection restored. Redirecting back to Chennai search.');
      router.replace('/(tabs)/home');
    } catch {
      setCheckMsg('Still unable to reach Parkly APIs. You can still view cached passes.');
    } finally {
      setChecking(false);
    }
  };

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
        <View style={[styles.iconCircle, { backgroundColor: spec.toneBg, borderColor: spec.toneBorder }]}>
          <Ionicons name={spec.icon} size={32} color={spec.toneFg} />
        </View>

        <Text style={[styles.meta, { color: spec.toneFg }]}>{spec.eyebrow}</Text>
        <Text style={styles.title}>{spec.title}</Text>
        <Text style={styles.subtitle}>{spec.body}</Text>

        <View style={styles.noteBox}>
          <Text style={styles.noteText}>{spec.note}</Text>
        </View>

        {checkMsg && <Text style={styles.feedbackText}>{checkMsg}</Text>}

        {resolvedType === 'location-denied' && (
          <View style={styles.zoneWrap}>
            <Text style={styles.zoneLabel}>BROWSE BY CHENNAI CORRIDOR</Text>
            <View style={styles.zoneGrid}>
              {CHENNAI_ZONES.map((zone) => (
                <PressScale
                  key={zone}
                  style={styles.zoneChip}
                  contentStyle={styles.zoneChipInner}
                  haptic="selection"
                  onPress={() => router.replace('/(tabs)/home')}
                >
                  <Text style={styles.zoneChipText}>{zone}</Text>
                </PressScale>
              ))}
            </View>
          </View>
        )}

        <View style={styles.actions}>
          {resolvedType === 'session-expired' && (
            <PressScale
              style={styles.primaryBtn}
              contentStyle={styles.btnInner}
              rippleColor={colors.rippleLight}
              haptic="medium"
              onPress={() => router.replace('/(auth)/login')}
            >
              <Ionicons name="key-outline" size={18} color={colors.white} />
              <Text style={styles.primaryBtnText}>Sign In with OTP</Text>
            </PressScale>
          )}

          {resolvedType === 'location-denied' && (
            <PressScale
              style={styles.primaryBtn}
              contentStyle={styles.btnInner}
              rippleColor={colors.rippleLight}
              haptic="medium"
              onPress={() => {
                Linking.openSettings().catch(() => {});
              }}
            >
              <Ionicons name="settings-outline" size={18} color={colors.white} />
              <Text style={styles.primaryBtnText}>Open App Location Settings</Text>
            </PressScale>
          )}

          {(resolvedType === 'offline' || resolvedType === 'maintenance' || resolvedType === 'server-error') && (
            <PressScale
              style={styles.primaryBtn}
              contentStyle={styles.btnInner}
              rippleColor={colors.rippleLight}
              haptic="light"
              disabled={checking}
              onPress={handleRetryConnection}
            >
              <Ionicons name="refresh" size={18} color={colors.white} />
              <Text style={styles.primaryBtnText}>
                {checking ? 'Checking...' : 'Retry Service Check'}
              </Text>
            </PressScale>
          )}

          {resolvedType === 'restricted' && (
            <PressScale
              style={styles.primaryBtn}
              contentStyle={styles.btnInner}
              rippleColor={colors.rippleLight}
              haptic="medium"
              onPress={() => {
                Linking.openURL('mailto:support@parkly.app?subject=Account%20Review%20DRV-HOLD-204').catch(() => {});
              }}
            >
              <Ionicons name="mail-outline" size={18} color={colors.white} />
              <Text style={styles.primaryBtnText}>Appeal Account Notice</Text>
            </PressScale>
          )}

          <PressScale
            style={styles.outlineBtn}
            contentStyle={styles.btnInner}
            haptic="light"
            onPress={() => router.replace('/(tabs)/bookings')}
          >
            <Ionicons name="qr-code-outline" size={18} color={colors.navy} />
            <Text style={styles.outlineBtnText}>View My Gate Passes</Text>
          </PressScale>

          <PressScale
            style={styles.outlineBtn}
            contentStyle={styles.btnInner}
            haptic="light"
            onPress={() => router.replace('/(tabs)/home')}
          >
            <Ionicons name="home-outline" size={18} color={colors.navy} />
            <Text style={styles.outlineBtnText}>Back to Home</Text>
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
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 14,
  },
  meta: { fontSize: 11, fontWeight: '800', letterSpacing: 1, marginBottom: 6, textAlign: 'center' },
  title: { color: colors.navy, fontSize: 22, fontWeight: '800', textAlign: 'center', marginBottom: 8 },
  subtitle: {
    color: colors.textSecondary,
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    marginBottom: 18,
  },
  noteBox: {
    width: '100%',
    backgroundColor: colors.cardElevated,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 13,
    marginBottom: 18,
  },
  noteText: { color: colors.textSecondary, fontSize: 12.5, lineHeight: 18, textAlign: 'center' },
  feedbackText: {
    color: colors.info,
    fontSize: 12.5,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 14,
  },
  zoneWrap: { width: '100%', marginBottom: 18 },
  zoneLabel: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.9,
    marginBottom: 8,
    textAlign: 'center',
  },
  zoneGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center' },
  zoneChip: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: 10,
    overflow: 'hidden',
  },
  zoneChipInner: { minHeight: 48, paddingHorizontal: 14, justifyContent: 'center' },
  zoneChipText: { color: colors.navy, fontSize: 13, fontWeight: '700' },
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
