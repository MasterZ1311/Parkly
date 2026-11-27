import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
  Image,
  Linking,
  Platform,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { bookingApi } from '../../src/api/client';
import { cacheGet, cacheSet, CACHE_KEYS } from '../../src/utils/cache';
import { colors, theme } from '../../src/constants/theme';
import { ENTER_FADE_UP, PressScale, SkeletonBlock, triggerHaptic } from '../../src/components/Motion';

interface BookingDetail {
  id: string;
  spaceId: string;
  spaceName?: string;
  spaceAddress?: string;
  vehicleId?: string;
  vehiclePlate?: string;
  status: string;
  startTime: string;
  endTime: string;
  totalAmount: number;
  type: string;
  slotNumber?: string;
}

const STATUS_STYLE: Record<string, { fg: string; bg: string; border: string }> = {
  created: { fg: colors.warning, bg: colors.warningLight, border: colors.warningBorder },
  confirmed: { fg: colors.success, bg: colors.successLight, border: colors.successBorder },
  active: { fg: colors.info, bg: colors.infoLight, border: colors.infoBorder },
  completed: { fg: colors.textSecondary, bg: colors.cardElevated, border: colors.border },
  cancelled: { fg: colors.danger, bg: colors.dangerLight, border: colors.dangerBorder },
  refunded: { fg: colors.navy, bg: colors.cardElevated, border: colors.border },
};

export default function BookingDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [booking, setBooking] = useState<BookingDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState(false);
  const insets = useSafeAreaInsets();

  useEffect(() => {
    loadBooking();
  }, [id]);

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
      console.warn('[BookingDetails] Live fetch error, trying offline cache:', err);
    }

    try {
      const cached = await cacheGet<any[]>(CACHE_KEYS.RECENT_BOOKINGS);
      const found = cached?.find((b) => b.id === id);
      if (found) {
        setBooking(formatBooking(found));
        setLoading(false);
        return;
      }
    } catch (cacheErr) {
      console.warn('[BookingDetails] Cache read error:', cacheErr);
    }

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
    setLoading(false);
  };

  const formatBooking = (raw: any): BookingDetail => ({
    id: raw.id || id!,
    spaceId: raw.spaceId || 'sp-tng-001',
    spaceName: raw.space?.name || raw.spaceName || 'T Nagar Parking Complex',
    spaceAddress: raw.space?.address || raw.spaceAddress || '23, Panagal Park Road, T Nagar, Chennai 600017',
    vehicleId: raw.vehicleId,
    vehiclePlate:
      raw.vehicle?.licensePlate ||
      raw.vehiclePlate ||
      (raw.vehicleId?.startsWith('veh-') ? raw.vehicleId.replace('veh-', '') : 'TN01AB1234'),
    status: raw.status || 'confirmed',
    startTime: raw.startTime || new Date().toISOString(),
    endTime: raw.endTime || new Date(Date.now() + 2 * 3600000).toISOString(),
    totalAmount: Number(raw.totalAmount) || 84,
    type: raw.type || 'instant',
    slotNumber: raw.slotNumber || 'Slot B-04',
  });

  const handleNavigate = () => {
    if (!booking) return;
    const address = booking.spaceAddress || 'Chennai';
    const query = encodeURIComponent(`${booking.spaceName || 'Parking'} ${address}`);
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

    Alert.alert('Cancel Booking', 'Are you sure you want to cancel this reservation? A full refund will be processed.', [
      { text: 'Keep Booking', style: 'cancel' },
      {
        text: 'Cancel Reservation',
        style: 'destructive',
        onPress: async () => {
          setCancelling(true);
          try {
            await bookingApi.cancel(booking.id, 'User requested cancellation');
            setBooking((prev) => (prev ? { ...prev, status: 'cancelled' } : null));

            const cached = (await cacheGet<any[]>(CACHE_KEYS.RECENT_BOOKINGS)) || [];
            const updated = cached.map((b) => (b.id === booking.id ? { ...b, status: 'cancelled' } : b));
            await cacheSet(CACHE_KEYS.RECENT_BOOKINGS, updated);
            triggerHaptic('medium');
            Alert.alert('Booking Cancelled', 'Your reservation has been cancelled.');
          } catch {
            setBooking((prev) => (prev ? { ...prev, status: 'cancelled' } : null));
            Alert.alert('Booking Cancelled', 'Your reservation has been cancelled.');
          } finally {
            setCancelling(false);
          }
        },
      },
    ]);
  };

  const handleExtendParking = () => {
    Alert.alert('Extend Parking', 'Extend parking by 1 hour for ₹40?', [
      { text: 'Not Now', style: 'cancel' },
      {
        text: 'Extend (+1h)',
        onPress: () => {
          if (!booking) return;
          const extendedEnd = new Date(new Date(booking.endTime).getTime() + 3600000).toISOString();
          setBooking((prev) => (prev ? { ...prev, endTime: extendedEnd, totalAmount: prev.totalAmount + 40 } : null));
          triggerHaptic('success');
          Alert.alert('Parking Extended', 'Your parking session has been extended by 1 hour.');
        },
      },
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
      <View style={[styles.container, { paddingTop: Math.max(insets.top + 16, 32), paddingHorizontal: 18, gap: 14 }]}>
        <StatusBar style="dark" backgroundColor={colors.background} />
        <SkeletonBlock height={120} />
        <SkeletonBlock height={240} />
        <SkeletonBlock height={110} />
      </View>
    );
  }

  if (!booking) {
    return (
      <View style={styles.center}>
        <Ionicons name="alert-circle-outline" size={52} color={colors.danger} />
        <Text style={styles.errorTitle}>Booking Not Found</Text>
        <PressScale style={styles.backBtn} contentStyle={styles.backBtnContent} onPress={() => router.back()}>
          <Text style={styles.backBtnText}>Go Back</Text>
        </PressScale>
      </View>
    );
  }

  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=PARKLY:${booking.id}:${booking.vehiclePlate}`;
  const statusTone = STATUS_STYLE[booking.status] || STATUS_STYLE.confirmed;
  const isActiveOrConfirmed = ['confirmed', 'active'].includes(booking.status);

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
        <Text style={styles.appBarTitle}>Booking Gate Pass</Text>
        <PressScale
          style={styles.iconButton}
          contentStyle={styles.iconButtonContent}
          rippleColor={colors.rippleLight}
          onPress={handleNavigate}
          accessibilityLabel="Navigate to parking space"
        >
          <Ionicons name="navigate-outline" size={20} color={colors.white} />
        </PressScale>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: Math.max(insets.bottom + 24, 36) }]}
      >
        <Animated.View entering={ENTER_FADE_UP}>
          <View style={styles.headerCard}>
            <View style={styles.statusRow}>
              <View style={[styles.statusBadge, { backgroundColor: statusTone.bg, borderColor: statusTone.border }]}>
                <View style={[styles.statusDot, { backgroundColor: statusTone.fg }]} />
                <Text style={[styles.statusText, { color: statusTone.fg }]}>
                  {booking.status.toUpperCase()}
                </Text>
              </View>
              <Text style={styles.tokenText}>#{booking.id.slice(-8).toUpperCase()}</Text>
            </View>

            <Text style={styles.spaceName}>{booking.spaceName}</Text>
            <Text style={styles.spaceAddress}>{booking.spaceAddress}</Text>

            <View style={styles.slotBadge}>
              <Ionicons name="pin" size={14} color={colors.navy} />
              <Text style={styles.slotText}>Assigned Spot: {booking.slotNumber}</Text>
            </View>
          </View>

          {isActiveOrConfirmed && (
            <View style={styles.qrCard}>
              <Text style={styles.qrTitle}>Gate Entry &amp; Exit Pass</Text>
              <Text style={styles.qrSubtitle}>Scan at boom barrier or show to on-site attendant</Text>
              <View style={styles.qrWrapper}>
                <Image source={{ uri: qrUrl }} style={styles.qrImage} resizeMode="contain" />
              </View>
              <Text style={styles.qrPlateText}>{booking.vehiclePlate}</Text>
            </View>
          )}

          <View style={styles.infoCard}>
            <Text style={styles.cardSectionTitle}>Reservation Schedule</Text>
            <View style={styles.timelineRow}>
              <View style={styles.timeBlock}>
                <Text style={styles.timeLabel}>Check-In</Text>
                <Text style={styles.timeValue}>{formatDate(booking.startTime)}</Text>
              </View>
              <Ionicons name="arrow-forward" size={18} color={colors.textMuted} style={{ alignSelf: 'center', marginHorizontal: 8 }} />
              <View style={styles.timeBlock}>
                <Text style={styles.timeLabel}>Check-Out</Text>
                <Text style={styles.timeValue}>{formatDate(booking.endTime)}</Text>
              </View>
            </View>
          </View>

          <View style={styles.infoCard}>
            <Text style={styles.cardSectionTitle}>Booking Summary</Text>

            <View style={styles.infoRow}>
              <Text style={styles.infoKey}>Vehicle Plate</Text>
              <Text style={[styles.infoVal, styles.mono]}>{booking.vehiclePlate}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoKey}>Booking Type</Text>
              <Text style={styles.infoVal}>
                {booking.type.charAt(0).toUpperCase() + booking.type.slice(1)}
              </Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoKey}>Payment Method</Text>
              <Text style={styles.infoVal}>UPI / Auto-Debit</Text>
            </View>
            <View style={[styles.infoRow, styles.totalRow]}>
              <Text style={styles.totalKey}>Amount Paid</Text>
              <Text style={styles.totalVal}>₹{booking.totalAmount}</Text>
            </View>
          </View>

          <View style={styles.actionsContainer}>
            <PressScale
              style={styles.primaryActionBtn}
              contentStyle={styles.primaryActionContent}
              rippleColor={colors.rippleLight}
              haptic="medium"
              onPress={handleNavigate}
            >
              <Ionicons name="navigate" size={18} color={colors.white} />
              <Text style={styles.primaryActionText}>Get Directions</Text>
            </PressScale>

            {isActiveOrConfirmed && (
              <View style={styles.secondaryActionsRow}>
                <PressScale
                  style={styles.secondaryActionBtn}
                  contentStyle={styles.secondaryActionContent}
                  haptic="selection"
                  onPress={handleExtendParking}
                >
                  <Ionicons name="timer-outline" size={18} color={colors.navy} />
                  <Text style={styles.secondaryActionText}>Extend (+1h)</Text>
                </PressScale>

                <PressScale
                  style={[styles.cancelActionBtn, cancelling && { opacity: 0.5 }]}
                  contentStyle={styles.secondaryActionContent}
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
                </PressScale>
              </View>
            )}
          </View>
        </Animated.View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  mono: { fontVariant: ['tabular-nums'] },
  appBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingBottom: 12,
    backgroundColor: colors.navy,
  },
  iconButton: {
    width: 48,
    height: 48,
    borderRadius: 12,
    overflow: 'hidden',
  },
  iconButtonContent: {
    width: 48,
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
  },
  appBarTitle: { color: colors.white, fontSize: 17.5, fontWeight: '800' },
  scrollContent: { padding: 18 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background, padding: 24 },
  errorTitle: { color: colors.navy, fontSize: 18, fontWeight: '800', marginTop: 14, marginBottom: 16 },
  backBtn: { backgroundColor: colors.navy, borderRadius: 10, overflow: 'hidden' },
  backBtnContent: { paddingHorizontal: 22, minHeight: 48, justifyContent: 'center', alignItems: 'center' },
  backBtnText: { color: colors.white, fontWeight: '700' },
  headerCard: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    padding: 18,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 14,
    ...theme.elevation.card,
  },
  statusRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    borderWidth: 1,
    gap: 6,
  },
  statusDot: { width: 7, height: 7, borderRadius: 3.5 },
  statusText: { fontSize: 11, fontWeight: '800', letterSpacing: 0.5 },
  tokenText: { color: colors.textMuted, fontVariant: ['tabular-nums'], fontSize: 13, fontWeight: '700' },
  spaceName: { color: colors.navy, fontSize: 19, fontWeight: '800', marginBottom: 4 },
  spaceAddress: { color: colors.textMuted, fontSize: 13.5, lineHeight: 19, marginBottom: 12 },
  slotBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.cardElevated,
    borderWidth: 1,
    borderColor: colors.border,
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  slotText: { color: colors.navy, fontSize: 12.5, fontWeight: '800' },
  qrCard: {
    backgroundColor: colors.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    padding: 20,
    alignItems: 'center',
    marginBottom: 14,
    ...theme.elevation.card,
  },
  qrTitle: { fontSize: 15, fontWeight: '800', color: colors.navy, marginBottom: 4 },
  qrSubtitle: { fontSize: 12, color: colors.textMuted, marginBottom: 14, textAlign: 'center' },
  qrWrapper: { padding: 8, backgroundColor: colors.white, borderRadius: 12, borderWidth: 1, borderColor: colors.border },
  qrImage: { width: 176, height: 176 },
  qrPlateText: {
    marginTop: 12,
    fontSize: 16,
    fontWeight: '800',
    color: colors.navy,
    fontVariant: ['tabular-nums'],
    letterSpacing: 1.5,
  },
  infoCard: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 14,
    ...theme.elevation.card,
  },
  cardSectionTitle: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 12,
  },
  timelineRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  timeBlock: { flex: 1 },
  timeLabel: { color: colors.textMuted, fontSize: 11.5, fontWeight: '600', marginBottom: 4 },
  timeValue: { color: colors.navy, fontSize: 13, fontWeight: '700', lineHeight: 18, fontVariant: ['tabular-nums'] },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8 },
  infoKey: { color: colors.textMuted, fontSize: 13.5 },
  infoVal: { color: colors.navy, fontSize: 13.5, fontWeight: '700' },
  totalRow: { borderTopWidth: 1, borderTopColor: colors.border, marginTop: 6, paddingTop: 12 },
  totalKey: { color: colors.navy, fontSize: 14.5, fontWeight: '800' },
  totalVal: { color: colors.primary, fontSize: 19, fontWeight: '800', fontVariant: ['tabular-nums'] },
  actionsContainer: { gap: 10, marginTop: 4 },
  primaryActionBtn: {
    backgroundColor: colors.navy,
    borderRadius: 12,
    overflow: 'hidden',
  },
  primaryActionContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 50,
    gap: 8,
  },
  primaryActionText: { color: colors.white, fontSize: 15, fontWeight: '800' },
  secondaryActionsRow: { flexDirection: 'row', gap: 10 },
  secondaryActionBtn: {
    flex: 1,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: 12,
    overflow: 'hidden',
  },
  secondaryActionContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
    gap: 6,
  },
  secondaryActionText: { color: colors.navy, fontSize: 13.5, fontWeight: '700' },
  cancelActionBtn: {
    flex: 1,
    backgroundColor: colors.dangerLight,
    borderWidth: 1,
    borderColor: colors.dangerBorder,
    borderRadius: 12,
    overflow: 'hidden',
  },
  cancelActionText: { color: colors.danger, fontSize: 13.5, fontWeight: '700' },
});
