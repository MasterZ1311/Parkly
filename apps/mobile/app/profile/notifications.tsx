import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Switch,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { type NotificationPreferencesPayload } from '../../src/api/client';
import { useDriverStore } from '../../src/store/driver.store';
import { colors, theme } from '../../src/constants/theme';
import { ENTER_FADE_UP, PressScale, triggerHaptic } from '../../src/components/Motion';
import {
  getNotificationPermissionStatus,
  registerForPushNotificationsAsync,
  sendTestLocalNotification,
} from '../../src/services/notifications';
import { classifyApiError } from '../../src/utils/apiErrors';

const PREF_ROWS: Array<{
  key: keyof NotificationPreferencesPayload;
  title: string;
  desc: string;
  icon: keyof typeof Ionicons.glyphMap;
}> = [
  {
    key: 'bookingReminders',
    title: 'Checkout Window Reminders',
    desc: 'Notify 15 minutes before reservation end time so you can extend in one tap.',
    icon: 'alarm-outline',
  },
  {
    key: 'gateAlerts',
    title: 'Entry & Exit Barrier Alerts',
    desc: 'Instant alerts when security attendants scan your QR pass at the boom barrier.',
    icon: 'shield-checkmark-outline',
  },
  {
    key: 'paymentReceipts',
    title: 'UPI & Refund Receipts',
    desc: 'Transaction capture and refund settlement notices from Razorpay/UPI.',
    icon: 'receipt-outline',
  },
  {
    key: 'promoOffers',
    title: 'Chennai Corridor Passes',
    desc: 'Monthly EV charging bundles and commuter pass offers.',
    icon: 'pricetag-outline',
  },
];

export default function NotificationPrefsScreen() {
  const { notificationPrefs, prefsLoading, loadNotificationPrefs, saveNotificationPrefs } =
    useDriverStore();
  const [permStatus, setPermStatus] = useState<string>('checking');
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [testingPush, setTestingPush] = useState(false);
  const insets = useSafeAreaInsets();

  useFocusEffect(
    useCallback(() => {
      loadNotificationPrefs().catch(() => {});
      getNotificationPermissionStatus()
        .then((status) => setPermStatus(status))
        .catch(() => setPermStatus('unsupported'));
    }, [loadNotificationPrefs]),
  );

  const handleToggle = async (key: keyof NotificationPreferencesPayload, nextVal: boolean) => {
    const previous = { ...notificationPrefs };
    const updated = { ...notificationPrefs, [key]: nextVal };
    setSavingKey(key);
    triggerHaptic('selection');
    try {
      await saveNotificationPrefs(updated);
    } catch (err) {
      await saveNotificationPrefs(previous).catch(() => {});
      const classified = classifyApiError(err, 'Could not sync notification preference.');
      Alert.alert('Preference Sync Error', classified.message);
    } finally {
      setSavingKey(null);
    }
  };

  const handleEnableDevicePush = async () => {
    setTestingPush(true);
    try {
      const reg = await registerForPushNotificationsAsync(true);
      const status = await getNotificationPermissionStatus();
      setPermStatus(status);
      if (!reg.granted) {
        Alert.alert(
          'Permission Required',
          'Enable notifications for Parkly in Android Settings to receive gate and checkout alerts.',
        );
        return;
      }
      const sent = await sendTestLocalNotification();
      triggerHaptic('success');
      Alert.alert(
        'Notifications Configured',
        sent
          ? `Device registered (${reg.platform})${reg.registeredOnServer ? ' & synced with Parkly backend' : ''}. A local preview alert was scheduled.`
          : `Device permission granted (${reg.platform}).`,
      );
    } finally {
      setTestingPush(false);
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar style="light" backgroundColor={colors.navy} />

      <View style={[styles.appBar, { paddingTop: Math.max(insets.top + 8, 16) }]}>
        <PressScale
          style={styles.iconButton}
          contentStyle={styles.iconButtonContent}
          rippleColor={colors.rippleLight}
          onPress={() => router.back()}
          accessibilityLabel="Go back"
        >
          <Ionicons name="arrow-back" size={20} color={colors.white} />
        </PressScale>
        <Text style={styles.appBarTitle}>Notification Preferences</Text>
        <View style={{ width: 48 }} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: Math.max(insets.bottom + 24, 36) },
        ]}
      >
        <Animated.View entering={ENTER_FADE_UP} style={{ gap: 14 }}>
          <View style={styles.statusCard}>
            <View style={styles.statusRow}>
              <View style={styles.statusIconBox}>
                <Ionicons
                  name={permStatus === 'granted' ? 'notifications' : 'notifications-off-outline'}
                  size={22}
                  color={permStatus === 'granted' ? colors.success : colors.warning}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.statusTitle}>Device Push Permission</Text>
                <Text style={styles.statusSub}>
                  Current OS status: {permStatus.toUpperCase()}
                </Text>
              </View>
            </View>

            <PressScale
              style={[styles.primaryBtn, testingPush && { opacity: 0.65 }]}
              contentStyle={styles.btnInner}
              rippleColor={colors.rippleLight}
              onPress={handleEnableDevicePush}
              disabled={testingPush}
            >
              {testingPush ? (
                <ActivityIndicator color={colors.white} />
              ) : (
                <>
                  <Ionicons name="paper-plane-outline" size={17} color={colors.white} />
                  <Text style={styles.primaryBtnText}>Sync Device &amp; Test Alert</Text>
                </>
              )}
            </PressScale>
          </View>

          <View style={styles.card}>
            {PREF_ROWS.map((row, idx) => (
              <View
                key={row.key}
                style={[styles.prefRow, idx === PREF_ROWS.length - 1 && { borderBottomWidth: 0 }]}
              >
                <View style={styles.prefIcon}>
                  <Ionicons name={row.icon} size={19} color={colors.navy} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.prefTitle}>{row.title}</Text>
                  <Text style={styles.prefDesc}>{row.desc}</Text>
                </View>
                <Switch
                  value={notificationPrefs[row.key]}
                  disabled={prefsLoading || savingKey === row.key}
                  onValueChange={(next) => handleToggle(row.key, next)}
                  trackColor={{ false: colors.borderStrong, true: colors.primary }}
                  thumbColor={colors.white}
                />
              </View>
            ))}
          </View>
        </Animated.View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  appBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingBottom: 12,
    backgroundColor: colors.navy,
  },
  iconButton: { width: 48, height: 48, borderRadius: 12, overflow: 'hidden' },
  iconButtonContent: { width: 48, height: 48, justifyContent: 'center', alignItems: 'center' },
  appBarTitle: { color: colors.white, fontSize: 17.5, fontWeight: '800' },
  scrollContent: { padding: 16 },
  statusCard: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    gap: 14,
    ...theme.elevation.card,
  },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  statusIconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: colors.cardElevated,
    borderWidth: 1,
    borderColor: colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  statusTitle: { color: colors.navy, fontSize: 15.5, fontWeight: '800' },
  statusSub: { color: colors.textMuted, fontSize: 12.5, fontWeight: '700', marginTop: 2 },
  primaryBtn: { backgroundColor: colors.primary, borderRadius: 12, overflow: 'hidden' },
  btnInner: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  primaryBtnText: { color: colors.white, fontSize: 14.5, fontWeight: '800' },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
    ...theme.elevation.card,
  },
  prefRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.cardElevated,
  },
  prefIcon: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: colors.cardElevated,
    justifyContent: 'center',
    alignItems: 'center',
  },
  prefTitle: { color: colors.navy, fontSize: 14.5, fontWeight: '800', marginBottom: 2 },
  prefDesc: { color: colors.textMuted, fontSize: 12, lineHeight: 17 },
});
