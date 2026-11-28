import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
  Linking,
  Platform,
} from 'react-native';
import { useLocalSearchParams, router, useFocusEffect } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { bookingApi, type VehiclePayloadType } from '../../src/api/client';
import { cacheGet, cacheSet, CACHE_KEYS } from '../../src/utils/cache';
import { colors, theme } from '../../src/constants/theme';
import { ENTER_FADE_UP, PressScale, SkeletonBlock, triggerHaptic } from '../../src/components/Motion';
import { OfflineBanner } from '../../src/components/OfflineBanner';
import { QrPassSvg } from '../../src/components/QrPassSvg';
import { VehicleIllustration } from '../../src/components/VehicleIllustration';
import { useAuthStore } from '../../src/store/auth.store';
import { createDemoBookings } from '../../src/data/demoFixtures';
import { classifyApiError, type ClassifiedApiError } from '../../src/utils/apiErrors';
import { scheduleBookingReminderNotification } from '../../src/services/notifications';

interface BookingDetail {
  id: string;
  spaceId: string;
  hostId?: string;
  spaceName: string;
  spaceAddress: string;
  vehicleId?: string;
  vehiclePlate: string;
  vehicleType: VehiclePayloadType;
  status: string;
  startTime: string;
  endTime: string;
  totalAmount: number;
  hourlyRate?: number;
  type: string;
  slotNumber?: string;
  qrToken?: string;
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

function formatBooking(raw: any, fallbackId: string): BookingDetail {
  const rate = Number(raw.space?.hourlyRate ?? raw.hourlyRate ?? 0);
  return {
    id: String(raw.id || fallbackId),
    spaceId: String(raw.spaceId || ''),
    hostId: raw.hostId,
    spaceName: raw.space?.name || raw.spaceName || 'Chennai Parking Bay',
    spaceAddress: raw.space?.address || raw.spaceAddress || 'Chennai Smart Grid Facility',
    vehicleId: raw.vehicleId,
    vehiclePlate:
      raw.vehicle?.licensePlate ||
      raw.vehiclePlate ||
      (typeof raw.vehicleId === 'string' && raw.vehicleId.startsWith('veh-')
        ? raw.vehicleId.replace('veh-', '')
        : 'VEHICLE'),
    vehicleType: (raw.vehicle?.vehicleType || raw.vehicleType || 'sedan') as VehiclePayloadType,
    status: String(raw.status || 'confirmed'),
    startTime: String(raw.startTime || new Date().toISOString()),
    endTime: String(raw.endTime || new Date(Date.now() + 2 * 3600000).toISOString()),
    totalAmount: Number(raw.totalAmount || 0),
    hourlyRate: Number.isFinite(rate) && rate > 0 ? rate : undefined,
    type: String(raw.type || 'instant'),
    slotNumber: raw.slotNumber || 'Assigned Bay',
    qrToken: raw.qrToken,
  };
}

export default function BookingDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [booking, setBooking] = useState<BookingDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState(false);
  const [extending, setExtending] = useState(false);
  const [isCachedView, setIsCachedView] = useState(false);
  const [loadError, setLoadError] = useState<ClassifiedApiError | null>(null);
  const isDemoMode = useAuthStore((s) => s.isDemoMode);
  const insets = useSafeAreaInsets();

  const loadBooking = useCallback(async () => {
    if (!id) {
      setBooking(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setLoadError(null);
    setIsCachedView(false);

    if (isDemoMode) {
      try {
        const cached = (await cacheGet<any[]>(CACHE_KEYS.RECENT_BOOKINGS)) || [];
        const demoPool = cached.length > 0 ? cached : createDemoBookings();
        const found = demoPool.find((b) => b.id === id) || demoPool[0];
        if (found) {
          setBooking(formatBooking(found, id));
        } else {
          setBooking(null);
        }
      } finally {
        setLoading(false);
      }
      return;
    }

    try {
      const { data } = await bookingApi.get(id);
      const apiBooking = data?.data?.booking || data?.data;
      if (apiBooking) {
        const formatted = formatBooking(apiBooking, id);
        setBooking(formatted);
        try {
          const cached = (await cacheGet<any[]>(CACHE_KEYS.RECENT_BOOKINGS)) || [];
          const next = [formatted, ...cached.filter((b) => b.id !== formatted.id)];
          await cacheSet(CACHE_KEYS.RECENT_BOOKINGS, next);
        } catch {
          // Best-effort offline pass cache
        }
        return;
      }

      setBooking(null);
      setLoadError({ kind: 'not-found', message: 'Reservation could not be found.' });
    } catch (err: unknown) {
      const classified = classifyApiError(err, 'Unable to load booking pass.');
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
        try {
          const cached = await cacheGet<any[]>(CACHE_KEYS.RECENT_BOOKINGS);
          const found = cached?.find((b) => b.id === id);
          if (found) {
            setBooking(formatBooking(found, id));
            setIsCachedView(true);
            return;
          }
        } catch {
          // Cache read unavailable
        }
      }

      setBooking(null);
      setLoadError(classified);
    } finally {
      setLoading(false);
    }
  }, [id, isDemoMode]);

  useFocusEffect(
    useCallback(() => {
      loadBooking();
    }, [loadBooking]),
  );

  const handleNavigate = () => {
    if (!booking) return;
    const address = booking.spaceAddress || 'Chennai';
    const query = encodeURIComponent(`${booking.spaceName} ${address}`);
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

    Alert.alert(
      'Cancel Booking',
      'Are you sure you want to cancel this reservation? Eligible refunds process back to your UPI source.',
      [
        { text: 'Keep Booking', style: 'cancel' },
        {
          text: 'Cancel Reservation',
          style: 'destructive',
          onPress: async () => {
            setCancelling(true);
            try {
              if (!isDemoMode) {
                await bookingApi.cancel(booking.id, 'User requested cancellation');
              }

              setBooking((prev) => (prev ? { ...prev, status: 'cancelled' } : null));
              const cached = (await cacheGet<any[]>(CACHE_KEYS.RECENT_BOOKINGS)) || [];
              const updated = cached.map((b) =>
                b.id === booking.id ? { ...b, status: 'cancelled' } : b,
              );
              await cacheSet(CACHE_KEYS.RECENT_BOOKINGS, updated);
              triggerHaptic('medium');
              Alert.alert('Booking Cancelled', 'Your reservation has been cancelled.');
            } catch (err: unknown) {
              const classified = classifyApiError(err, 'Unable to cancel reservation right now.');
              Alert.alert('Cancellation Failed', classified.message);
            } finally {
              setCancelling(false);
            }
          },
        },
      ],
    );
  };

  const handleExtendParking = () => {
    if (!booking) return;
    const estHourly = booking.hourlyRate || 40;
    Alert.alert('Extend Parking', `Extend reservation by 1 hour (approx. ₹${estHourly} + fee)?`, [
      { text: 'Not Now', style: 'cancel' },
      {
        text: 'Extend (+1h)',
        onPress: async () => {
          setExtending(true);
          try {
            if (isDemoMode) {
              const extendedEnd = new Date(
                new Date(booking.endTime).getTime() + 3600_000,
              ).toISOString();
              const addAmt = Math.round(estHourly * 1.05);
              const next = {
                ...booking,
                endTime: extendedEnd,
                totalAmount: booking.totalAmount + addAmt,
              };
              setBooking(next);
              const cached = (await cacheGet<any[]>(CACHE_KEYS.RECENT_BOOKINGS)) || [];
              await cacheSet(
                CACHE_KEYS.RECENT_BOOKINGS,
                cached.map((b) =>
                  b.id === booking.id
                    ? { ...b, endTime: extendedEnd, totalAmount: next.totalAmount }
                    : b,
                ),
              );
              triggerHaptic('success');
              Alert.alert('Parking Extended', 'Demo reservation extended by 1 hour.');
              return;
            }

            const { data } = await bookingApi.extend(booking.id, 1);
            const rawUpdated = data?.data?.booking || data?.data;
            const formatted = rawUpdated
              ? formatBooking(rawUpdated, booking.id)
              : {
                  ...booking,
                  endTime: new Date(
                    new Date(booking.endTime).getTime() + 3600_000,
                  ).toISOString(),
                };

            setBooking(formatted);
            const cached = (await cacheGet<any[]>(CACHE_KEYS.RECENT_BOOKINGS)) || [];
            await cacheSet(
              CACHE_KEYS.RECENT_BOOKINGS,
              cached.map((b) => (b.id === booking.id ? formatted : b)),
            );
            scheduleBookingReminderNotification({
              bookingId: formatted.id,
              spaceName: formatted.spaceName,
              endTimeIso: formatted.endTime,
              vehiclePlate: formatted.vehiclePlate,
            }).catch(() => {});

            triggerHaptic('success');
            Alert.alert('Parking Extended', 'Your reservation window has been extended by 1 hour.');
          } catch (err: unknown) {
            const classified = classifyApiError(
              err,
              'Could not extend reservation due to an overlapping booking.',
            );
            Alert.alert('Extension Unavailable', classified.message);
          } finally {
            setExtending(false);
          }
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
      <View
        style={[
          styles.container,
          { paddingTop: Math.max(insets.top + 16, 32), paddingHorizontal: 18, gap: 14 },
        ]}
      >
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
        <Text style={styles.errorTitle}>
          {loadError?.kind === 'offline' ? 'Pass Not Cached Offline' : 'Booking Not Found'}
        </Text>
        <Text style={styles.errorSub}>
          {loadError?.message || 'We could not load this reservation record.'}
        </Text>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <PressScale
            style={styles.backBtn}
            contentStyle={styles.backBtnContent}
            onPress={loadBooking}
          >
            <Text style={styles.backBtnText}>Retry</Text>
          </PressScale>
          <PressScale
            style={[styles.backBtn, { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.borderStrong }]}
            contentStyle={styles.backBtnContent}
            onPress={() => router.back()}
          >
            <Text style={[styles.backBtnText, { color: colors.navy }]}>Go Back</Text>
          </PressScale>
        </View>
      </View>
    );
  }

  const qrPayload =
    booking.qrToken || `PARKLY:${booking.id}:${booking.spaceId}:${booking.vehiclePlate}`;
  const statusTone = STATUS_STYLE[booking.status] || STATUS_STYLE.confirmed;
  const isPassActive = ['confirmed', 'active'].includes(booking.status);
  const canModify = ['created', 'confirmed', 'active'].includes(booking.status);

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

      <OfflineBanner
        visible={isCachedView}
        message="Offline Mode — QR Gate Pass rendered locally"
      />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: Math.max(insets.bottom + 24, 36) },
        ]}
      >
        <Animated.View entering={ENTER_FADE_UP}>
          <View style={styles.headerCard}>
            <View style={styles.statusRow}>
              <View
                style={[
                  styles.statusBadge,
                  { backgroundColor: statusTone.bg, borderColor: statusTone.border },
                ]}
              >
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

          {booking.status === 'created' && (
            <View style={styles.pendingBanner}>
              <Ionicons name="hourglass-outline" size={18} color={colors.warning} />
              <Text style={styles.pendingBannerText}>
                Awaiting UPI payment confirmation. Your gate QR code unlocks immediately after payment capture.
              </Text>
            </View>
          )}

          {isPassActive && (
            <View style={styles.qrCard}>
              <Text style={styles.qrTitle}>Offline Gate Entry &amp; Exit Pass</Text>
              <Text style={styles.qrSubtitle}>
                Scan at boom barrier — works offline in underground basements
              </Text>
              <View style={styles.qrWrapper}>
                <QrPassSvg value={qrPayload} size={184} />
              </View>
              <View style={styles.qrPlateRow}>
                <VehicleIllustration type={booking.vehicleType} width={54} height={30} />
                <Text style={styles.qrPlateText}>{booking.vehiclePlate}</Text>
              </View>
            </View>
          )}

          <View style={styles.infoCard}>
            <Text style={styles.cardSectionTitle}>Reservation Schedule</Text>
            <View style={styles.timelineRow}>
              <View style={styles.timeBlock}>
                <Text style={styles.timeLabel}>Check-In</Text>
                <Text style={styles.timeValue}>{formatDate(booking.startTime)}</Text>
              </View>
              <Ionicons
                name="arrow-forward"
                size={18}
                color={colors.textMuted}
                style={{ alignSelf: 'center', marginHorizontal: 8 }}
              />
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
              <Text style={styles.infoVal}>UPI / Razorpay</Text>
            </View>
            <View style={[styles.infoRow, styles.totalRow]}>
              <Text style={styles.totalKey}>Total Amount</Text>
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

            {canModify && (
              <View style={styles.secondaryActionsRow}>
                {isPassActive && (
                  <PressScale
                    style={[styles.secondaryActionBtn, extending && { opacity: 0.55 }]}
                    contentStyle={styles.secondaryActionContent}
                    haptic="selection"
                    onPress={handleExtendParking}
                    disabled={extending}
                  >
                    {extending ? (
                      <ActivityIndicator size="small" color={colors.navy} />
                    ) : (
                      <>
                        <Ionicons name="timer-outline" size={18} color={colors.navy} />
                        <Text style={styles.secondaryActionText}>Extend (+1h)</Text>
                      </>
                    )}
                  </PressScale>
                )}

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
  errorTitle: { color: colors.navy, fontSize: 18, fontWeight: '800', marginTop: 14, marginBottom: 8 },
  errorSub: { color: colors.textSecondary, fontSize: 13.5, textAlign: 'center', marginBottom: 18, lineHeight: 20 },
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
  pendingBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.warningLight,
    borderWidth: 1,
    borderColor: colors.warningBorder,
    borderRadius: 12,
    padding: 14,
    marginBottom: 14,
  },
  pendingBannerText: {
    flex: 1,
    color: colors.warning,
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 19,
  },
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
  qrPlateRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 12 },
  qrPlateText: {
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
  cancelActionText: { color: colors.danger, fontSize: 13.5, fontWeight: '800' },
});
