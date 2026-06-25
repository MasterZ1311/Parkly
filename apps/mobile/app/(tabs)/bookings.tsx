import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { bookingApi } from '../../src/api/client';

interface Booking {
  id: string;
  spaceId: string;
  status: string;
  startTime: string;
  endTime: string;
  totalAmount: number;
  type: string;
}

const STATUS_COLORS: Record<string, string> = {
  created: '#F59E0B',
  confirmed: '#22C55E',
  active: '#38BDF8',
  completed: '#64748B',
  cancelled: '#EF4444',
  refunded: '#8B5CF6',
};

export default function BookingsScreen() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'upcoming' | 'past'>('upcoming');

  useEffect(() => {
    loadBookings();
  }, []);

  const loadBookings = async () => {
    setLoading(true);
    try {
      const { data } = await bookingApi.list();
      setBookings(data.data.bookings || []);
    } catch {
      setBookings([]);
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
          <Ionicons name="car" size={20} color="#38BDF8" />
        </View>
        <View style={styles.bookingInfo}>
          <Text style={styles.bookingId}>Booking #{item.id.slice(-8).toUpperCase()}</Text>
          <Text style={styles.bookingType}>{item.type.charAt(0).toUpperCase() + item.type.slice(1)}</Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: STATUS_COLORS[item.status] + '20' }]}>
          <Text style={[styles.statusText, { color: STATUS_COLORS[item.status] }]}>
            {item.status.charAt(0).toUpperCase() + item.status.slice(1)}
          </Text>
        </View>
      </View>

      <View style={styles.cardDetails}>
        <View style={styles.timeRow}>
          <Ionicons name="time-outline" size={14} color="#64748B" />
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
          <ActivityIndicator color="#38BDF8" size="large" />
        </View>
      ) : displayed.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="calendar-outline" size={64} color="#334155" />
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
          keyExtractor={item => item.id}
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
  container: { flex: 1, backgroundColor: '#0F172A' },
  tabs: { flexDirection: 'row', padding: 16, gap: 8 },
  tab: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#1E293B',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#334155',
  },
  activeTab: { backgroundColor: '#38BDF820', borderColor: '#38BDF8' },
  tabText: { color: '#64748B', fontSize: 13, fontWeight: '600' },
  activeTabText: { color: '#38BDF8' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: '#64748B' },
  findButton: { backgroundColor: '#38BDF8', borderRadius: 10, paddingHorizontal: 24, paddingVertical: 12 },
  findButtonText: { color: '#0F172A', fontWeight: '700' },
  list: { paddingHorizontal: 16 },
  card: {
    backgroundColor: '#1E293B',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#334155',
  },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
  bookingIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#38BDF820',
    justifyContent: 'center',
    alignItems: 'center',
  },
  bookingInfo: { flex: 1 },
  bookingId: { color: '#F8FAFC', fontSize: 14, fontWeight: '700' },
  bookingType: { color: '#64748B', fontSize: 12 },
  statusBadge: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  statusText: { fontSize: 11, fontWeight: '600' },
  cardDetails: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  timeRow: { flexDirection: 'row', alignItems: 'center', gap: 4, flex: 1 },
  timeText: { color: '#94A3B8', fontSize: 11 },
  amount: { color: '#38BDF8', fontSize: 16, fontWeight: '800' },
});
