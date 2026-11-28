import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, RefreshControl } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { bookingApi } from '../../src/api/client';
import { cacheGet, cacheSet, CACHE_KEYS } from '../../src/utils/cache';
import { useAuthStore } from '../../src/store/auth.store';
import { OfflineBanner } from '../../src/components/OfflineBanner';
import { colors, theme } from '../../src/constants/theme';
import { PressScale, SkeletonBlock } from '../../src/components/Motion';
import { createDemoBookings } from '../../src/data/demoFixtures';
import { classifyApiError, type ClassifiedApiError } from '../../src/utils/apiErrors';

export interface BookingListItem {
  id: string;
  spaceId: string;
  spaceName?: string;
  spaceAddress?: string;
  vehiclePlate?: string;
  status: string;
  startTime: string;
  endTime: string;
  totalAmount: number;
  type: string;
}

const STATUS_STYLE: Record<string, { fg: string; bg: string; border: string }> = {
  created: { fg: colors.warning, bg: colors.warningLight, border: colors.warningBorder },
  confirmed: { fg: colors.success, bg: colors.successLight, border: colors.successBorder },
  active: { fg: colors.info, bg: colors.infoLight, border: colors.infoBorder },
  completed: { fg: colors.textSecondary, bg: colors.cardElevated, border: colors.border },
  cancelled: { fg: colors.danger, bg: colors.dangerLight, border: colors.dangerBorder },
  expired: { fg: colors.warning, bg: colors.warningLight, border: colors.warningBorder },
  refunded: { fg: colors.navy, bg: colors.cardElevated, border: colors.border },
};

function normalizeBooking(raw: any): BookingListItem {
  return {
    id: String(raw.id),
    spaceId: String(raw.spaceId || ''),
    spaceName: raw.space?.name || raw.spaceName,
    spaceAddress: raw.space?.address || raw.spaceAddress,
    vehiclePlate: raw.vehicle?.licensePlate || raw.vehiclePlate,
    status: String(raw.status || 'created'),
    startTime: String(raw.startTime || new Date().toISOString()),
    endTime: String(raw.endTime || new Date().toISOString()),
    totalAmount: Number(raw.totalAmount || 0),
    type: String(raw.type || 'instant'),
  };
}

function formatDurationLeft(ms: number): string {
  const totalMins = Math.max(1, Math.ceil(ms / 60_000));
  if (totalMins < 60) return `${totalMins}m`;
  const hrs = Math.floor(totalMins / 60);
  const mins = totalMins % 60;
  return mins > 0 ? `${hrs}h ${mins}m` : `${hrs}h`;
}

function getLiveCountdownInfo(
  item: BookingListItem,
  nowMs: number,
): { text: string; urgent: boolean; fg: string; bg: string; border: string } | null {
  if (item.status === 'created') {
    return {
      text: 'Awaiting UPI authorization · Tap to resume',
      urgent: true,
      fg: colors.warning,
      bg: colors.warningLight,
      border: colors.warningBorder,
    };
  }
  if (!['confirmed', 'active'].includes(item.status)) {
    return null;
  }

  const startMs = Date.parse(item.startTime);
  const endMs = Date.parse(item.endTime);
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs)) {
    return null;
  }

  if (nowMs < startMs) {
    return {
      text: `Starts in ${formatDurationLeft(startMs - nowMs)}`,
      urgent: false,
      fg: colors.info,
      bg: colors.infoLight,
      border: colors.infoBorder,
    };
  }

  if (nowMs <= endMs) {
    const remaining = endMs - nowMs;
    const isSoon = remaining <= 20 * 60_000;
    return {
      text: isSoon
        ? `Ending soon · ${formatDurationLeft(remaining)} left`
        : `Session live · Ends in ${formatDurationLeft(remaining)}`,
      urgent: isSoon,
      fg: isSoon ? colors.danger : colors.success,
      bg: isSoon ? colors.dangerLight : colors.successLight,
      border: isSoon ? colors.dangerBorder : colors.successBorder,
    };
  }

  return {
    text: 'Window elapsed · Check out or extend pass',
    urgent: true,
    fg: colors.warning,
    bg: colors.warningLight,
    border: colors.warningBorder,
  };
}

export default function BookingsScreen() {
  const [bookings, setBookings] = useState<BookingListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [isOfflineData, setIsOfflineData] = useState(false);
  const [listError, setListError] = useState<ClassifiedApiError | null>(null);
  const [activeTab, setActiveTab] = useState<'upcoming' | 'past'>('upcoming');
  const [nowMs, setNowMs] = useState(() => Date.now());
  const isOffline = useAuthStore((s) => s.isOffline);
  const isDemoMode = useAuthStore((s) => s.isDemoMode);

  useEffect(() => {
    const id = setInterval(() => {
      setNowMs(Date.now());
    }, 15_000);
    return () => clearInterval(id);
  }, []);

  const loadBookings = useCallback(async () => {
    setLoading(true);
    setListError(null);

    if (isDemoMode) {
      try {
        const cached = await cacheGet<any[]>(CACHE_KEYS.RECENT_BOOKINGS);
        const list =
          cached && cached.length > 0 ? cached.map(normalizeBooking) : createDemoBookings().map(normalizeBooking);
        await cacheSet(CACHE_KEYS.RECENT_BOOKINGS, list);
        setBookings(list);
        setIsOfflineData(false);
      } finally {
        setLoading(false);
      }
      return;
    }

    try {
      const cached = await cacheGet<any[]>(CACHE_KEYS.RECENT_BOOKINGS);
      if (cached && cached.length > 0) {
        setBookings(cached.map(normalizeBooking));
      }

      const { data } = await bookingApi.list();
      const rawList = data?.data?.bookings || (Array.isArray(data?.data) ? data.data : []);
      const freshBookings = (rawList as any[]).map(normalizeBooking);
      setBookings(freshBookings);
      setIsOfflineData(false);
      await cacheSet(CACHE_KEYS.RECENT_BOOKINGS, freshBookings);
    } catch (err: unknown) {
      const classified = classifyApiError(err, 'Unable to load bookings right now.');

      if (classified.kind === 'session-expired') {
        router.replace('/status/session-expired');
        return;
      }
      if (classified.kind === 'maintenance') {
        router.replace('/status/maintenance');
        return;
      }
      if (classified.kind === 'server-error') {
        router.replace('/status/server-error');
        return;
      }

      if (classified.kind === 'offline') {
        const cached = await cacheGet<any[]>(CACHE_KEYS.RECENT_BOOKINGS);
        if (cached && cached.length > 0) {
          setBookings(cached.map(normalizeBooking));
          setIsOfflineData(true);
          return;
        }
      }

      setBookings([]);
      setIsOfflineData(false);
      setListError(classified);
    } finally {
      setLoading(false);
    }
  }, [isDemoMode]);

  useFocusEffect(
    useCallback(() => {
      loadBookings();
    }, [loadBookings]),
  );

  const upcoming = bookings.filter((b) => ['created', 'confirmed', 'active'].includes(b.status));
  const past = bookings.filter((b) => ['completed', 'cancelled', 'expired', 'refunded'].includes(b.status));
  const displayed = activeTab === 'upcoming' ? upcoming : past;

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });

  const renderBooking = ({ item }: { item: BookingListItem }) => {
    const tone = STATUS_STYLE[item.status] || STATUS_STYLE.confirmed;
    const countdown = getLiveCountdownInfo(item, nowMs);
    return (
      <PressScale
        onPress={() => router.push({ pathname: '/booking/[id]', params: { id: item.id } })}
        haptic="light"
        style={styles.card}
        contentStyle={styles.cardInner}
      >
        <View style={styles.cardTop}>
          <View style={styles.bookingIcon}>
            <Ionicons name="qr-code-outline" size={20} color={colors.navy} />
          </View>
          <View style={styles.bookingInfo}>
            <Text style={styles.bookingId} numberOfLines={1}>
              {item.spaceName || `Booking #${item.id.slice(-8).toUpperCase()}`}
            </Text>
            <Text style={styles.bookingType} numberOfLines={1}>
              {item.vehiclePlate ? `${item.vehiclePlate} · ` : ''}
              {item.type.charAt(0).toUpperCase() + item.type.slice(1)} · #{item.id.slice(-8).toUpperCase()}
            </Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: tone.bg, borderColor: tone.border }]}>
            <Text style={[styles.statusText, { color: tone.fg }]}>
              {item.status.charAt(0).toUpperCase() + item.status.slice(1)}
            </Text>
          </View>
        </View>

        {countdown && (
          <View
            style={[
              styles.countdownStrip,
              {
                backgroundColor: countdown.bg,
                borderColor: countdown.border,
              },
            ]}
          >
            <Ionicons
              name={countdown.urgent ? 'hourglass-outline' : 'timer-outline'}
              size={13}
              color={countdown.fg}
            />
            <Text style={[styles.countdownText, { color: countdown.fg }]}>{countdown.text}</Text>
          </View>
        )}

        <View style={styles.cardDetails}>
          <View style={styles.timeRow}>
            <Ionicons name="time-outline" size={14} color={colors.textMuted} />
            <Text style={styles.timeText} numberOfLines={1}>
              {formatDate(item.startTime)} → {formatDate(item.endTime)}
            </Text>
          </View>
          <Text style={styles.amount}>₹{item.totalAmount}</Text>
        </View>
      </PressScale>
    );
  };

  return (
    <View style={styles.container}>
      {isDemoMode ? (
        <View style={styles.demoStrip}>
          <Ionicons name="sparkles-outline" size={14} color={colors.navy} />
          <Text style={styles.demoStripText}>DEMO MODE · Simulated Driver Gate Passes</Text>
        </View>
      ) : (
        <OfflineBanner
          visible={isOffline || isOfflineData}
          message="Offline Mode — Showing saved QR gate passes"
        />
      )}

      <View style={styles.tabs}>
        {(['upcoming', 'past'] as const).map((tab) => {
          const active = activeTab === tab;
          return (
            <PressScale
              key={tab}
              haptic="selection"
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
              rippleColor={active ? colors.rippleLight : colors.rippleDark}
              style={[styles.tab, active && styles.activeTab]}
              contentStyle={styles.tabContent}
              onPress={() => setActiveTab(tab)}
            >
              <Text style={[styles.tabText, active && styles.activeTabText]}>
                {tab === 'upcoming' ? `Upcoming (${upcoming.length})` : `Past (${past.length})`}
              </Text>
            </PressScale>
          );
        })}
      </View>

      {loading && bookings.length === 0 ? (
        <View style={styles.skeletonWrap}>
          <SkeletonBlock height={102} />
          <SkeletonBlock height={102} />
        </View>
      ) : listError ? (
        <View style={styles.emptyState}>
          <View style={[styles.emptyIconBox, styles.errorIconBox]}>
            <Ionicons name="cloud-offline-outline" size={32} color={colors.danger} />
          </View>
          <Text style={styles.emptyTitle}>Could Not Load Bookings</Text>
          <Text style={styles.errorMessage}>{listError.message}</Text>
          <View style={styles.errorActions}>
            <PressScale
              style={styles.findButton}
              contentStyle={styles.findButtonContent}
              rippleColor={colors.rippleLight}
              onPress={loadBookings}
            >
              <Text style={styles.findButtonText}>Retry</Text>
            </PressScale>
            {listError.statusRoute && (
              <PressScale
                style={styles.secondaryBtn}
                contentStyle={styles.findButtonContent}
                onPress={() => router.push(listError.statusRoute!)}
              >
                <Text style={styles.secondaryBtnText}>Service Status</Text>
              </PressScale>
            )}
          </View>
        </View>
      ) : displayed.length === 0 ? (
        <View style={styles.emptyState}>
          <View style={styles.emptyIconBox}>
            <Ionicons name="calendar-outline" size={34} color={colors.textMuted} />
          </View>
          <Text style={styles.emptyTitle}>No {activeTab} reservations</Text>
          {activeTab === 'upcoming' && (
            <PressScale
              style={styles.findButton}
              contentStyle={styles.findButtonContent}
              rippleColor={colors.rippleLight}
              onPress={() => router.push('/(tabs)/home')}
            >
              <Text style={styles.findButtonText}>Find Parking</Text>
            </PressScale>
          )}
        </View>
      ) : (
        <FlatList
          data={displayed}
          keyExtractor={(item, index) => `${item.id}-${index}`}
          renderItem={renderBooking}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl
              refreshing={loading}
              onRefresh={loadBookings}
              tintColor={colors.primary}
              colors={[colors.primary]}
            />
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  demoStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 7,
    paddingHorizontal: 12,
    backgroundColor: colors.cardElevated,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  demoStripText: {
    color: colors.navy,
    fontSize: 11.5,
    fontWeight: '700',
  },
  tabs: { flexDirection: 'row', padding: 16, gap: 10 },
  tab: {
    flex: 1,
    borderRadius: 10,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  tabContent: {
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeTab: { backgroundColor: colors.navy, borderColor: colors.navy },
  tabText: { color: colors.textSecondary, fontSize: 13.5, fontWeight: '700' },
  activeTabText: { color: colors.white },
  skeletonWrap: { paddingHorizontal: 16, gap: 12 },
  emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12, paddingHorizontal: 28 },
  emptyIconBox: {
    width: 72,
    height: 72,
    borderRadius: 20,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorIconBox: {
    backgroundColor: colors.dangerLight,
    borderColor: colors.dangerBorder,
  },
  emptyTitle: { fontSize: 18, fontWeight: '800', color: colors.navy },
  errorMessage: { fontSize: 13.5, color: colors.textSecondary, textAlign: 'center', lineHeight: 20 },
  errorActions: { flexDirection: 'row', gap: 10, marginTop: 4 },
  findButton: { backgroundColor: colors.primary, borderRadius: 10, overflow: 'hidden', marginTop: 4 },
  findButtonContent: { paddingHorizontal: 22, minHeight: 48, justifyContent: 'center', alignItems: 'center' },
  findButtonText: { color: colors.white, fontWeight: '800', fontSize: 14.5 },
  secondaryBtn: {
    backgroundColor: colors.surface,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    overflow: 'hidden',
    marginTop: 4,
  },
  secondaryBtnText: { color: colors.navy, fontWeight: '700', fontSize: 14 },
  list: { paddingHorizontal: 16, paddingBottom: 24 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
    ...theme.elevation.card,
  },
  cardInner: { padding: 16 },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
  bookingIcon: {
    width: 42,
    height: 42,
    borderRadius: 10,
    backgroundColor: colors.cardElevated,
    borderWidth: 1,
    borderColor: colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  bookingInfo: { flex: 1 },
  bookingId: { color: colors.navy, fontSize: 14.5, fontWeight: '800' },
  bookingType: { color: colors.textMuted, fontSize: 12, fontWeight: '600', marginTop: 2, fontVariant: ['tabular-nums'] },
  statusBadge: { borderRadius: 6, borderWidth: 1, paddingHorizontal: 8, paddingVertical: 4 },
  statusText: { fontSize: 11.5, fontWeight: '800' },
  countdownStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginBottom: 10,
  },
  countdownText: {
    fontSize: 12,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  cardDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: colors.cardElevated,
  },
  timeRow: { flexDirection: 'row', alignItems: 'center', gap: 5, flex: 1 },
  timeText: { color: colors.textMuted, fontSize: 11.5, fontWeight: '600', fontVariant: ['tabular-nums'] },
  amount: { color: colors.primary, fontSize: 17, fontWeight: '800', fontVariant: ['tabular-nums'] },
});
