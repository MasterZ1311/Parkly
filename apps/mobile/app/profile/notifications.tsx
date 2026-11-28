import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { type NotificationPreferencesPayload } from '../../src/api/client';
import { useDriverStore, type DriverNotification } from '../../src/store/driver.store';
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

function getNotifVisual(type: string): {
  icon: keyof typeof Ionicons.glyphMap;
  fg: string;
  bg: string;
} {
  switch (type) {
    case 'gate':
      return { icon: 'qr-code-outline', fg: colors.success, bg: colors.successLight };
    case 'payment':
      return { icon: 'card-outline', fg: colors.info, bg: colors.infoLight };
    case 'reminder':
      return { icon: 'alarm-outline', fg: colors.warning, bg: colors.warningLight };
    default:
      return { icon: 'notifications-outline', fg: colors.navy, bg: colors.cardElevated };
  }
}

function formatRelativeTime(iso: string): string {
  const diffMs = Date.now() - Date.parse(iso);
  if (!Number.isFinite(diffMs) || diffMs < 60_000) return 'Just now';
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

export default function NotificationPrefsScreen() {
  const {
    notificationPrefs,
    prefsLoading,
    notifications,
    notificationsLoading,
    unreadCount,
    loadNotificationPrefs,
    saveNotificationPrefs,
    loadNotifications,
    markNotificationRead,
    markAllNotificationsRead,
  } = useDriverStore();

  const [activeTab, setActiveTab] = useState<'inbox' | 'preferences'>('inbox');
  const [permStatus, setPermStatus] = useState<string>('checking');
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [testingPush, setTestingPush] = useState(false);
  const insets = useSafeAreaInsets();

  const refreshAll = useCallback(() => {
    loadNotifications().catch(() => {});
    loadNotificationPrefs().catch(() => {});
    getNotificationPermissionStatus()
      .then((status) => setPermStatus(status))
      .catch(() => setPermStatus('unsupported'));
  }, [loadNotifications, loadNotificationPrefs]);

  useFocusEffect(
    useCallback(() => {
      refreshAll();
    }, [refreshAll]),
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

  const handleOpenNotification = async (item: DriverNotification) => {
    if (!item.read) {
      await markNotificationRead(item.id);
    }
    triggerHaptic('selection');
    if (item.data?.bookingId) {
      router.push({ pathname: '/booking/[id]', params: { id: item.data.bookingId } });
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
        <Text style={styles.appBarTitle}>Notifications</Text>
        <View style={{ width: 48 }} />
      </View>

      <View style={styles.tabs}>
        {(['inbox', 'preferences'] as const).map((tab) => {
          const active = activeTab === tab;
          return (
            <PressScale
              key={tab}
              haptic="selection"
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
              rippleColor={active ? colors.rippleLight : colors.rippleDark}
              style={[styles.tab, active && styles.activeTab]}
              contentStyle={styles.tabInner}
              onPress={() => setActiveTab(tab)}
            >
              <Text style={[styles.tabText, active && styles.activeTabText]}>
                {tab === 'inbox'
                  ? `Inbox${unreadCount > 0 ? ` (${unreadCount})` : ''}`
                  : 'Push & Preferences'}
              </Text>
            </PressScale>
          );
        })}
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={notificationsLoading}
            onRefresh={refreshAll}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: Math.max(insets.bottom + 24, 36) },
        ]}
      >
        {activeTab === 'inbox' ? (
          <Animated.View entering={ENTER_FADE_UP} style={{ gap: 12 }}>
            <View style={styles.inboxToolbar}>
              <Text style={styles.inboxSummary}>
                {unreadCount > 0
                  ? `${unreadCount} unread driver alert${unreadCount === 1 ? '' : 's'}`
                  : 'All driver alerts caught up'}
              </Text>
              {unreadCount > 0 && (
                <PressScale
                  onPress={() => {
                    triggerHaptic('light');
                    void markAllNotificationsRead();
                  }}
                  style={styles.markAllBtn}
                  contentStyle={styles.markAllInner}
                >
                  <Text style={styles.markAllText}>Mark All Read</Text>
                </PressScale>
              )}
            </View>

            {notifications.length === 0 && !notificationsLoading ? (
              <View style={styles.emptyCard}>
                <View style={styles.emptyIconBox}>
                  <Ionicons name="notifications-off-outline" size={30} color={colors.textMuted} />
                </View>
                <Text style={styles.emptyTitle}>No Driver Alerts Yet</Text>
                <Text style={styles.emptySub}>
                  Gate scans, UPI captures, and checkout reminders will appear here as you park across Chennai.
                </Text>
                <PressScale
                  style={styles.outlineBtn}
                  contentStyle={styles.outlineBtnInner}
                  onPress={() => setActiveTab('preferences')}
                >
                  <Text style={styles.outlineBtnText}>Configure Device Push</Text>
                </PressScale>
              </View>
            ) : (
              notifications.map((item) => {
                const visual = getNotifVisual(item.type);
                return (
                  <PressScale
                    key={item.id}
                    style={[styles.notifCard, !item.read && styles.notifCardUnread]}
                    contentStyle={styles.notifInner}
                    onPress={() => void handleOpenNotification(item)}
                  >
                    <View style={[styles.notifIcon, { backgroundColor: visual.bg }]}>
                      <Ionicons name={visual.icon} size={20} color={visual.fg} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <View style={styles.notifTopRow}>
                        <Text style={styles.notifTitle} numberOfLines={1}>
                          {item.title}
                        </Text>
                        {!item.read && <View style={styles.unreadDot} />}
                      </View>
                      <Text style={styles.notifBody}>{item.body}</Text>
                      <View style={styles.notifFooterRow}>
                        <Text style={styles.notifTime}>{formatRelativeTime(item.createdAt)}</Text>
                        {item.data?.bookingId ? (
                          <Text style={styles.notifAction}>Open Gate Pass →</Text>
                        ) : !item.read ? (
                          <Text style={styles.notifAction}>Tap to Mark Read</Text>
                        ) : null}
                      </View>
                    </View>
                  </PressScale>
                );
              })
            )}
          </Animated.View>
        ) : (
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
        )}
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
  tabs: { flexDirection: 'row', paddingHorizontal: 16, paddingTop: 14, gap: 10 },
  tab: {
    flex: 1,
    borderRadius: 10,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  tabInner: { minHeight: 48, alignItems: 'center', justifyContent: 'center' },
  activeTab: { backgroundColor: colors.navy, borderColor: colors.navy },
  tabText: { color: colors.textSecondary, fontSize: 13.5, fontWeight: '700' },
  activeTabText: { color: colors.white },
  scrollContent: { padding: 16 },
  inboxToolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  inboxSummary: {
    color: colors.textMuted,
    fontSize: 12.5,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  markAllBtn: {
    backgroundColor: colors.surface,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    overflow: 'hidden',
  },
  markAllInner: { minHeight: 40, paddingHorizontal: 12, justifyContent: 'center' },
  markAllText: { color: colors.navy, fontSize: 12, fontWeight: '800' },
  emptyCard: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 26,
    alignItems: 'center',
    gap: 10,
    ...theme.elevation.card,
  },
  emptyIconBox: {
    width: 60,
    height: 60,
    borderRadius: 16,
    backgroundColor: colors.cardElevated,
    borderWidth: 1,
    borderColor: colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyTitle: { color: colors.navy, fontSize: 17, fontWeight: '800' },
  emptySub: { color: colors.textSecondary, fontSize: 13, lineHeight: 19, textAlign: 'center' },
  outlineBtn: {
    marginTop: 6,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.cardElevated,
    overflow: 'hidden',
  },
  outlineBtnInner: { minHeight: 48, paddingHorizontal: 18, justifyContent: 'center' },
  outlineBtnText: { color: colors.navy, fontSize: 13.5, fontWeight: '700' },
  notifCard: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
    ...theme.elevation.card,
  },
  notifCardUnread: { borderColor: colors.primaryBorder },
  notifInner: { flexDirection: 'row', gap: 12, padding: 14, alignItems: 'flex-start' },
  notifIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  notifTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  notifTitle: { flex: 1, color: colors.navy, fontSize: 14.5, fontWeight: '800' },
  unreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.primary },
  notifBody: { color: colors.textSecondary, fontSize: 13, lineHeight: 18, marginTop: 4 },
  notifFooterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  notifTime: { color: colors.textMuted, fontSize: 11.5, fontWeight: '600' },
  notifAction: { color: colors.primary, fontSize: 12, fontWeight: '800' },
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
