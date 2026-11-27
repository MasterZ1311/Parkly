import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { bookingApi } from '../../src/api/client';
import { cacheGet, cacheSet, CACHE_KEYS } from '../../src/utils/cache';
import { useAuthStore } from '../../src/store/auth.store';
import { OfflineBanner } from '../../src/components/OfflineBanner';
import { colors, theme } from '../../src/constants/theme';
import { PressScale, SkeletonBlock } from '../../src/components/Motion';

export interface Booking {
  id: string;
  spaceId: string;
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
  refunded: { fg: colors.navy, bg: colors.cardElevated, border: colors.border },
};

export default function BookingsScreen() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [isOfflineData, setIsOfflineData] = useState(false);
  const [activeTab, setActiveTab] = useState<'upcoming' | 'past'>('upcoming');
  const isOffline = useAuthStore((s) => s.isOffline);

  useEffect(() => {
    cacheGet<Booking[]>(CACHE_KEYS.RECENT_BOOKINGS).then((cached) => {
      if (cached && cached.length > 0) {
        setBookings(cached);
        setLoading(false);
      }
    });
    loadBookings();
  }, []);

  const loadBookings = async () => {
    try {
      const { data } = await bookingApi.list();
      const freshBookings = data?.data?.bookings || [];
      setBookings(freshBookings);
      setIsOfflineData(false);
      await cacheSet(CACHE_KEYS.RECENT_BOOKINGS, freshBookings);
    } catch (err) {
      console.warn('[Bookings] Failed to fetch live bookings, using cached list:', err);
      const cached = await cacheGet<Booking[]>(CACHE_KEYS.RECENT_BOOKINGS);
      if (cached && cached.length > 0) {
        setBookings(cached);
        setIsOfflineData(true);
      } else {
        const demoBookings: Booking[] = [
          {
            id: 'bk-demo-001',
            spaceId: 'sp-tng-001',
            status: 'confirmed',
            startTime: new Date().toISOString(),
            endTime: new Date(Date.now() + 2 * 3600000).toISOString(),
            totalAmount: 126,
            type: 'instant',
          },
          {
            id: 'bk-demo-002',
            spaceId: 'sp-tng-002',
            status: 'completed',
            startTime: new Date(Date.now() - 86400000).toISOString(),
            endTime: new Date(Date.now() - 86400000 + 3600000).toISOString(),
            totalAmount: 84,
            type: 'instant',
          },
        ];
        setBookings(demoBookings);
        setIsOfflineData(true);
      }
    } finally {
      setLoading(false);
    }
  };

  const upcoming = bookings.filter((b) => ['created', 'confirmed', 'active'].includes(b.status));
  const past = bookings.filter((b) => ['completed', 'cancelled', 'refunded'].includes(b.status));
  const displayed = activeTab === 'upcoming' ? upcoming : past;

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });

  const renderBooking = ({ item }: { item: Booking }) => {
    const tone = STATUS_STYLE[item.status] || STATUS_STYLE.confirmed;
    return (
      <PressScale
        onPress={() => router.push({ pathname: '/booking/[id]', params: { id: item.id } })}
        haptic="light"
        style={styles.card}
        contentStyle={styles.cardInner}
      >
        <View style={styles.cardTop}>
          <View style={styles.bookingIcon}>
            <Ionicons name="car-outline" size={20} color={colors.navy} />
          </View>
          <View style={styles.bookingInfo}>
            <Text style={styles.bookingId}>Booking #{item.id.slice(-8).toUpperCase()}</Text>
            <Text style={styles.bookingType}>{item.type.charAt(0).toUpperCase() + item.type.slice(1)} Reserve</Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: tone.bg, borderColor: tone.border }]}>
            <Text style={[styles.statusText, { color: tone.fg }]}>
              {item.status.charAt(0).toUpperCase() + item.status.slice(1)}
            </Text>
          </View>
        </View>

        <View style={styles.cardDetails}>
          <View style={styles.timeRow}>
            <Ionicons name="time-outline" size={14} color={colors.textMuted} />
            <Text style={styles.timeText}>
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
      <OfflineBanner visible={isOffline || isOfflineData} message="Offline Mode — Showing saved reservations" />

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

      {loading ? (
        <View style={styles.skeletonWrap}>
          <SkeletonBlock height={102} />
          <SkeletonBlock height={102} />
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
          refreshing={loading}
          onRefresh={loadBookings}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
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
  emptyTitle: { fontSize: 18, fontWeight: '800', color: colors.navy },
  findButton: { backgroundColor: colors.primary, borderRadius: 10, overflow: 'hidden', marginTop: 4 },
  findButtonContent: { paddingHorizontal: 24, minHeight: 48, justifyContent: 'center', alignItems: 'center' },
  findButtonText: { color: colors.white, fontWeight: '800', fontSize: 14.5 },
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
  bookingId: { color: colors.navy, fontSize: 14.5, fontWeight: '800', fontVariant: ['tabular-nums'] },
  bookingType: { color: colors.textMuted, fontSize: 12, fontWeight: '600', marginTop: 2 },
  statusBadge: { borderRadius: 6, borderWidth: 1, paddingHorizontal: 8, paddingVertical: 4 },
  statusText: { fontSize: 11.5, fontWeight: '800' },
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
