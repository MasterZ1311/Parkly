import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { IS_DEMO_MODE, bookingApi } from '../../src/api/client';
import { cacheGet, cacheSet, CACHE_KEYS } from '../../src/utils/cache';
import { useAuthStore } from '../../src/store/auth.store';
import { OfflineBanner } from '../../src/components/OfflineBanner';
import { colors } from '../../src/constants/theme';

export interface Booking {
  id: string;
  spaceId: string;
  status: string;
  startTime: string;
  endTime: string;
  totalAmount: number;
  type: string;
  space?: { name?: string };
}

const STATUS_COLORS: Record<string, string> = {
  created: colors.warning,
  confirmed: colors.success,
  active: colors.info,
  completed: colors.textMuted,
  cancelled: colors.danger,
  refunded: '#8B5CF6',
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
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadBookings();
    }, []),
  );

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
      } else if (IS_DEMO_MODE) {
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
      } else {
        setBookings([]);
        setIsOfflineData(true);
      }
    } finally {
      setLoading(false);
    }
  };

  const upcoming = bookings.filter(b => ['created', 'confirmed', 'active'].includes(b.status));
  const past = bookings.filter(b => ['completed', 'cancelled', 'refunded'].includes(b.status));
  const displayed = activeTab === 'upcoming' ? upcoming : past;

  const formatDate = (iso: string) => {
    return new Date(iso).toLocaleDateString('en-IN', {
      day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
    });
  };

  const renderBooking = ({ item }: { item: Booking }) => (
    <TouchableOpacity
      style={styles.card}
      onPress={() => router.push({ pathname: '/booking/[id]', params: { id: item.id } })}
    >
      <View style={styles.cardTop}>
        <View style={styles.bookingIcon}>
          <Ionicons name="car" size={20} color={colors.primary} />
        </View>
        <View style={styles.bookingInfo}>
          <Text style={styles.bookingId}>{item.space?.name || `Booking #${item.id.slice(-8).toUpperCase()}`}</Text>
          <Text style={styles.bookingType}>#{item.id.slice(-8).toUpperCase()} · {item.type.charAt(0).toUpperCase() + item.type.slice(1)}</Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: (STATUS_COLORS[item.status] || colors.info) + '20' }]}>
          <Text style={[styles.statusText, { color: STATUS_COLORS[item.status] || colors.info }]}>
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
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <OfflineBanner visible={isOffline || isOfflineData} message="Offline Mode — Showing saved reservations" />
      {/* Tabs */}
      <View style={styles.tabs}>
        {(['upcoming', 'past'] as const).map(tab => (
          <TouchableOpacity
            key={tab}
            style={[styles.tab, activeTab === tab && styles.activeTab]}
            onPress={() => setActiveTab(tab)}
          >
            <Text style={[styles.tabText, activeTab === tab && styles.activeTabText]}>
              {tab === 'upcoming' ? `Upcoming (${upcoming.length})` : `Past (${past.length})`}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      ) : displayed.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="calendar-outline" size={64} color={colors.border} />
          <Text style={styles.emptyTitle}>No {activeTab} bookings</Text>
          {activeTab === 'upcoming' && (
            <TouchableOpacity style={styles.findButton} onPress={() => router.push('/(tabs)/home')}>
              <Text style={styles.findButtonText}>Find Parking</Text>
            </TouchableOpacity>
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
  tabs: { flexDirection: 'row', padding: 16, gap: 8 },
  tab: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: colors.card,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  activeTab: { backgroundColor: colors.primaryLight, borderColor: colors.primary },
  tabText: { color: colors.textMuted, fontSize: 13, fontWeight: '600' },
  activeTabText: { color: colors.primary },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: colors.textMuted },
  findButton: { backgroundColor: colors.primary, borderRadius: 10, paddingHorizontal: 24, paddingVertical: 12 },
  findButtonText: { color: colors.white, fontWeight: '700' },
  list: { paddingHorizontal: 16 },
  card: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
  bookingIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  bookingInfo: { flex: 1 },
  bookingId: { color: colors.text, fontSize: 14, fontWeight: '700' },
  bookingType: { color: colors.textMuted, fontSize: 12 },
  statusBadge: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  statusText: { fontSize: 11, fontWeight: '600' },
  cardDetails: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  timeRow: { flexDirection: 'row', alignItems: 'center', gap: 4, flex: 1 },
  timeText: { color: colors.textSecondary, fontSize: 11 },
  amount: { color: colors.primary, fontSize: 16, fontWeight: '800' },
});
