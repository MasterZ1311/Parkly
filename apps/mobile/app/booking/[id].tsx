import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Image,
  Linking,
  Platform,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { IS_DEMO_MODE, bookingApi } from '../../src/api/client';
import { cacheGet, cacheSet, CACHE_KEYS } from '../../src/utils/cache';
import { colors } from '../../src/constants/theme';

interface BookingDetail {
  id: string;
  spaceId: string;
  spaceName?: string;
  spaceAddress?: string;
  vehicleId?: string;
  vehiclePlate?: string;
  qrToken?: string;
  status: string;
  startTime: string;
  endTime: string;
  totalAmount: number;
  type: string;
  slotNumber?: string;
}

const STATUS_COLORS: Record<string, string> = {
  created: colors.warning,
  confirmed: colors.success,
  active: colors.info,
  completed: colors.textMuted,
  cancelled: colors.danger,
  refunded: '#8B5CF6',
};

export default function BookingDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [booking, setBooking] = useState<BookingDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState(false);
  const [extending, setExtending] = useState(false);

  useEffect(() => {
    loadBooking();
  }, [id]);

  const formatBooking = (raw: any): BookingDetail => ({
    id: raw.id || id!,
    spaceId: raw.spaceId || 'sp-tng-001',
    spaceName: raw.space?.name || raw.spaceName || 'Parkly Space',
    spaceAddress: raw.space?.address || raw.spaceAddress || '',
    vehicleId: raw.vehicleId,
    vehiclePlate:
      raw.vehicle?.licensePlate ||
      raw.vehiclePlate ||
      (raw.vehicleId?.startsWith('veh-') ? raw.vehicleId.replace('veh-', '') : 'Registered Vehicle'),
    qrToken: raw.qrToken,
    status: raw.status || 'confirmed',
    startTime: raw.startTime || new Date().toISOString(),
    endTime: raw.endTime || new Date(Date.now() + 2 * 3600000).toISOString(),
    totalAmount: Number(raw.totalAmount) || 0,
    type: raw.type || 'instant',
    slotNumber: raw.slotNumber || 'Gate A',
  });

  const loadBooking = async () => {
    if (!id) return;
    setLoading(true);

    try {
      const { data } = await bookingApi.get(id);
      const apiBooking = data?.data?.booking || data?.data;
      if (apiBooking) {
        setBooking(formatBooking(apiBooking));
        return;
      }
    } catch (err) {
      console.warn('[BookingDetails] Live fetch error, checking offline cache:', err);
    } finally {
      setLoading(false);
    }

    try {
      const cached = await cacheGet<any[]>(CACHE_KEYS.RECENT_BOOKINGS);
      const found = cached?.find((b) => b.id === id);
      if (found) {
        setBooking(formatBooking(found));
        return;
      }
    } catch (cacheErr) {
      console.warn('[BookingDetails] Cache read error:', cacheErr);
    }

    if (IS_DEMO_MODE) {
      setBooking({
        id,
        spaceId: 'sp-tng-001',
        spaceName: 'T Nagar Parking Complex',
        spaceAddress: '23, Panagal Park Road, T Nagar, Chennai 600017',
        vehiclePlate: 'TN01AB1234',
        status: 'confirmed',
        startTime: new Date().toISOString(),
        endTime: new Date(Date.now() + 2 * 3600000).toISOString(),
        totalAmount: 84,
        type: 'instant',
        slotNumber: 'Slot B-04',
      });
    } else {
      setBooking(null);
    }
  };

  const handleNavigate = () => {
    if (!booking) return;
    const query = encodeURIComponent(`${booking.spaceName || 'Parking'} ${booking.spaceAddress || 'Chennai'}`);
    const url = Platform.select({
      ios: `maps:0,0?q=${query}`,
      android: `geo:0,0?q=${query}`,
      default: `https://www.google.com/maps/search/?api=1&query=${query}`,
    });

    Linking.openURL(url!).catch(() => {
      Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${query}`);
    });
  };

  const handleCancelBooking = () => {
    if (!booking) return;

    const executeCancel = async () => {
      setCancelling(true);
      try {
        await bookingApi.cancel(booking.id, 'User requested cancellation');
        setBooking((prev) => (prev ? { ...prev, status: 'cancelled' } : null));
        const cached = (await cacheGet<any[]>(CACHE_KEYS.RECENT_BOOKINGS)) || [];
        await cacheSet(
          CACHE_KEYS.RECENT_BOOKINGS,
          cached.map((b) => (b.id === booking.id ? { ...b, status: 'cancelled' } : b)),
        );
        Alert.alert('Booking Cancelled', 'Your reservation has been cancelled.');
      } catch (err: any) {
        if (IS_DEMO_MODE) {
          setBooking((prev) => (prev ? { ...prev, status: 'cancelled' } : null));
          Alert.alert('Booking Cancelled', 'Your reservation has been cancelled.');
        } else {
          const message = err?.response?.data?.error?.message || 'Unable to cancel booking right now.';
          Alert.alert('Cancellation Failed', message);
        }
      } finally {
        setCancelling(false);
      }
    };

    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined' && window.confirm('Cancel this reservation?')) {
        void executeCancel();
      }
      return;
    }

    Alert.alert('Cancel Booking', 'Are you sure you want to cancel this reservation? A refund will be processed according to policy.', [
      { text: 'Keep Booking', style: 'cancel' },
      { text: 'Cancel Reservation', style: 'destructive', onPress: executeCancel },
    ]);
  };

  const handleExtendParking = () => {
    if (!booking) return;

    const executeExtend = async () => {
      setExtending(true);
      try {
        const { data } = await bookingApi.extend(booking.id, 60);
        const updated = data?.data;
        if (updated) {
          const formatted = formatBooking(updated);
          setBooking(formatted);
          const cached = (await cacheGet<any[]>(CACHE_KEYS.RECENT_BOOKINGS)) || [];
          await cacheSet(
            CACHE_KEYS.RECENT_BOOKINGS,
            cached.map((b) => (b.id === booking.id ? { ...b, ...updated } : b)),
          );
          Alert.alert('Parking Extended', `Session extended. Updated total: ₹${formatted.totalAmount}`);
        }
      } catch (err: any) {
        if (IS_DEMO_MODE) {
          const extendedEnd = new Date(new Date(booking.endTime).getTime() + 3600000).toISOString();
          setBooking((prev) => (prev ? { ...prev, endTime: extendedEnd, totalAmount: prev.totalAmount + 40 } : null));
          Alert.alert('Parking Extended', 'Your parking session has been extended by 1 hour.');
        } else {
          const message = err?.response?.data?.error?.message || 'Could not extend reservation due to slot availability.';
          Alert.alert('Extension Unavailable', message);
        }
      } finally {
        setExtending(false);
      }
    };

    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined' && window.confirm('Extend reservation by 1 hour at current space rate?')) {
        void executeExtend();
      }
      return;
    }

    Alert.alert('Extend Parking', 'Extend reservation by 1 hour at current space rate?', [
      { text: 'Not Now', style: 'cancel' },
      { text: 'Extend (+1h)', onPress: executeExtend },
    ]);
  };

  const formatDate = (iso: string) => {
    try {
      return new Date(iso).toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return iso;
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Loading booking details…</Text>
      </View>
    );
  }

  if (!booking) {
    return (
      <View style={styles.center}>
        <Ionicons name="alert-circle-outline" size={56} color={colors.danger} />
        <Text style={styles.errorTitle}>Booking Not Found</Text>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Text style={styles.backBtnText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const qrPayload = encodeURIComponent(booking.qrToken || `PARKLY:${booking.id}:${booking.vehiclePlate}`);
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${qrPayload}`;
  const statusColor = STATUS_COLORS[booking.status] || colors.info;
  const isActiveOrConfirmed = ['confirmed', 'active', 'created'].includes(booking.status);

  return (
    <View style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {/* Top App Bar */}
        <View style={styles.appBar}>
          <TouchableOpacity style={styles.iconButton} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={22} color={colors.text} />
          </TouchableOpacity>
          <Text style={styles.appBarTitle}>Booking Pass</Text>
          <TouchableOpacity style={styles.iconButton} onPress={handleNavigate}>
            <Ionicons name="navigate-outline" size={22} color={colors.primary} />
          </TouchableOpacity>
        </View>

        {/* Status & Space Info */}
        <View style={styles.headerCard}>
          <View style={styles.statusRow}>
            <View style={[styles.statusBadge, { backgroundColor: `${statusColor}20` }]}>
              <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
              <Text style={[styles.statusText, { color: statusColor }]}>{booking.status.toUpperCase()}</Text>
            </View>
            <Text style={styles.tokenText}>#{booking.id.slice(-8).toUpperCase()}</Text>
          </View>

          <Text style={styles.spaceName}>{booking.spaceName}</Text>
          {booking.spaceAddress ? <Text style={styles.spaceAddress}>{booking.spaceAddress}</Text> : null}

          <View style={styles.slotBadge}>
            <Ionicons name="pin" size={14} color={colors.primary} />
            <Text style={styles.slotText}>Access Point: {booking.slotNumber}</Text>
          </View>
        </View>

        {/* Signed QR Entry Pass */}
        {isActiveOrConfirmed && (
          <View style={styles.qrCard}>
            <Text style={styles.qrTitle}>Signed Gate Entry & Exit Pass</Text>
            <Text style={styles.qrSubtitle}>Scan at boom barrier or show to gate attendant</Text>
            <View style={styles.qrWrapper}>
              <Image source={{ uri: qrUrl }} style={styles.qrImage} resizeMode="contain" />
            </View>
            <Text style={styles.qrPlateText}>{booking.vehiclePlate}</Text>
          </View>
        )}

        {/* Timing Card */}
        <View style={styles.infoCard}>
          <Text style={styles.cardSectionTitle}>Reservation Schedule</Text>
          <View style={styles.timelineRow}>
            <View style={styles.timeBlock}>
              <Text style={styles.timeLabel}>Check-In Time</Text>
              <Text style={styles.timeValue}>{formatDate(booking.startTime)}</Text>
            </View>
            <Ionicons name="arrow-forward" size={18} color={colors.textMuted} style={{ alignSelf: 'center' }} />
            <View style={styles.timeBlock}>
              <Text style={styles.timeLabel}>Check-Out Time</Text>
              <Text style={styles.timeValue}>{formatDate(booking.endTime)}</Text>
            </View>
          </View>
        </View>

        {/* Vehicle & Payment Summary */}
        <View style={styles.infoCard}>
          <Text style={styles.cardSectionTitle}>Booking Information</Text>

          <View style={styles.infoRow}>
            <Text style={styles.infoKey}>Vehicle Registration</Text>
            <Text style={styles.infoVal}>{booking.vehiclePlate}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoKey}>Booking Type</Text>
            <Text style={styles.infoVal}>
              {booking.type.charAt(0).toUpperCase() + booking.type.slice(1)}
            </Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoKey}>Payment Method</Text>
            <Text style={styles.infoVal}>UPI / Razorpay</Text>
          </View>
          <View style={[styles.infoRow, styles.totalRow]}>
            <Text style={styles.totalKey}>Total Amount</Text>
            <Text style={styles.totalVal}>₹{booking.totalAmount}</Text>
          </View>
        </View>

        {/* Action Buttons */}
        <View style={styles.actionsContainer}>
          <TouchableOpacity style={styles.primaryActionBtn} onPress={handleNavigate}>
            <Ionicons name="navigate" size={20} color={colors.white} />
            <Text style={styles.primaryActionText}>Get Directions</Text>
          </TouchableOpacity>

          {isActiveOrConfirmed && (
            <View style={styles.secondaryActionsRow}>
              <TouchableOpacity
                style={[styles.secondaryActionBtn, extending && { opacity: 0.6 }]}
                onPress={handleExtendParking}
                disabled={extending}
              >
                {extending ? (
                  <ActivityIndicator size="small" color={colors.primary} />
                ) : (
                  <>
                    <Ionicons name="timer-outline" size={18} color={colors.primary} />
                    <Text style={styles.secondaryActionText}>Extend (+1h)</Text>
                  </>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.cancelActionBtn, cancelling && { opacity: 0.5 }]}
                onPress={handleCancelBooking}
                disabled={cancelling}
              >
                {cancelling ? (
                  <ActivityIndicator size="small" color={colors.danger} />
                ) : (
                  <>
                    <Ionicons name="close-circle-outline" size={18} color={colors.danger} />
                    <Text style={styles.cancelActionText}>Cancel</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  scrollContent: { padding: 20, paddingBottom: 40 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background, padding: 24 },
  loadingText: { color: colors.textSecondary, marginTop: 12, fontSize: 14 },
  errorTitle: { color: colors.text, fontSize: 18, fontWeight: '700', marginTop: 16, marginBottom: 16 },
  backBtn: { backgroundColor: colors.card, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 10, borderWidth: 1, borderColor: colors.border },
  backBtnText: { color: colors.primary, fontWeight: '600' },
  appBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.card,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  appBarTitle: { color: colors.text, fontSize: 18, fontWeight: '700' },
  headerCard: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 16,
  },
  statusRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    gap: 6,
  },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  statusText: { fontSize: 11, fontWeight: '800', letterSpacing: 0.5 },
  tokenText: { color: colors.textMuted, fontFamily: 'monospace', fontSize: 13, fontWeight: '600' },
  spaceName: { color: colors.text, fontSize: 20, fontWeight: '800', marginBottom: 6 },
  spaceAddress: { color: colors.textSecondary, fontSize: 13, lineHeight: 18, marginBottom: 12 },
  slotBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.primaryLight,
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  slotText: { color: colors.primary, fontSize: 12, fontWeight: '700' },
  qrCard: {
    backgroundColor: colors.white,
    borderRadius: 20,
    padding: 20,
    alignItems: 'center',
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 8,
  },
  qrTitle: { fontSize: 15, fontWeight: '800', color: colors.navy, marginBottom: 4 },
  qrSubtitle: { fontSize: 11, color: colors.textMuted, marginBottom: 14, textAlign: 'center' },
  qrWrapper: { padding: 10, backgroundColor: colors.white, borderRadius: 12 },
  qrImage: { width: 180, height: 180 },
  qrPlateText: {
    marginTop: 10,
    fontSize: 16,
    fontWeight: '800',
    color: colors.navy,
    fontFamily: 'monospace',
    letterSpacing: 1.5,
  },
  infoCard: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 16,
  },
  cardSectionTitle: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 14,
  },
  timelineRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  timeBlock: { flex: 1 },
  timeLabel: { color: colors.textMuted, fontSize: 11, marginBottom: 4 },
  timeValue: { color: colors.text, fontSize: 13, fontWeight: '700', lineHeight: 18 },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8 },
  infoKey: { color: colors.textSecondary, fontSize: 13 },
  infoVal: { color: colors.text, fontSize: 13, fontWeight: '600' },
  totalRow: { borderTopWidth: 1, borderTopColor: colors.border, marginTop: 6, paddingTop: 12 },
  totalKey: { color: colors.text, fontSize: 14, fontWeight: '700' },
  totalVal: { color: colors.primary, fontSize: 18, fontWeight: '800' },
  actionsContainer: { gap: 12, marginTop: 4 },
  primaryActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    paddingVertical: 15,
    borderRadius: 12,
    gap: 8,
  },
  primaryActionText: { color: colors.white, fontSize: 15, fontWeight: '800' },
  secondaryActionsRow: { flexDirection: 'row', gap: 10 },
  secondaryActionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 13,
    borderRadius: 12,
    gap: 6,
  },
  secondaryActionText: { color: colors.primary, fontSize: 13, fontWeight: '700' },
  cancelActionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primaryLight,
    borderWidth: 1,
    borderColor: 'rgba(239, 1, 12, 0.35)',
    paddingVertical: 13,
    borderRadius: 12,
    gap: 6,
  },
  cancelActionText: { color: colors.danger, fontSize: 13, fontWeight: '700' },
});
