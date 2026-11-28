import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
  Linking,
  Platform,
  BackHandler,
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
import { hostSpaceToDemoItem, useHostStore } from '../../src/store/host.store';
import { createDemoBookings, DEMO_SPACES, getSpaceTypeMeta } from '../../src/data/demoFixtures';
import { classifyApiError, type ClassifiedApiError } from '../../src/utils/apiErrors';
import { scheduleBookingReminderNotification } from '../../src/services/notifications';

interface BookingDetail {
  id: string;
  spaceId: string;
  hostId?: string;
  spaceName: string;
  spaceAddress: string;
  spaceType?: string;
  entryInstructions?: string;
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
  gateCode?: string;
  checkedInAt?: string;
  checkedOutAt?: string;
  leavingNotifiedAt?: string;
  overstayMinutes?: number;
  overstayAmount?: number;
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
    spaceType: raw.space?.spaceType || raw.spaceType,
    entryInstructions: raw.space?.entryInstructions || raw.entryInstructions,
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
    gateCode:
      raw.gateCode ||
      String(1000 + (parseInt(String(raw.id || fallbackId).replace(/[^0-9]/g, '').slice(-4) || '4821', 10) % 9000)),
    checkedInAt: raw.checkedInAt,
    checkedOutAt: raw.checkedOutAt,
    leavingNotifiedAt: raw.leavingNotifiedAt,
    overstayMinutes: raw.overstayMinutes !== undefined ? Number(raw.overstayMinutes) : 0,
    overstayAmount: raw.overstayAmount !== undefined ? Number(raw.overstayAmount) : 0,
  };
}

function getLiveSessionStatus(booking: BookingDetail, nowMs: number): {
  headline: string;
  subline: string;
  tone: 'info' | 'warning' | 'danger' | 'success';
} {
  const startMs = new Date(booking.startTime).getTime();
  const endMs = new Date(booking.endTime).getTime();

  if (booking.status === 'completed') {
    if ((booking.overstayMinutes || 0) > 0) {
      return {
        headline: `Checked out (+${booking.overstayMinutes}m overstay)`,
        subline: `Extra ₹${booking.overstayAmount || 0} settled on final bill`,
        tone: 'warning',
      };
    }
    return {
      headline: 'Completed on time',
      subline: booking.checkedOutAt
        ? `Left at ${new Date(booking.checkedOutAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}`
        : 'Bay released cleanly',
      tone: 'success',
    };
  }

  if (booking.status === 'confirmed') {
    const minsUntilStart = Math.round((startMs - nowMs) / 60_000);
    if (minsUntilStart > 15) {
      const h = Math.floor(minsUntilStart / 60);
      const m = minsUntilStart % 60;
      return {
        headline: h > 0 ? `Arrival in ${h}h ${m}m` : `Arrival in ${m}m`,
        subline: 'Check-in opens 15 minutes before start · Show QR or Gate PIN to host',
        tone: 'info',
      };
    }
    return {
      headline: 'Check-In Window Open',
      subline: 'Tap "I Have Arrived" or let the host scan your QR / enter Gate PIN',
      tone: 'success',
    };
  }

  const minsLeft = Math.round((endMs - nowMs) / 60_000);
  if (minsLeft > 15) {
    const h = Math.floor(minsLeft / 60);
    const m = minsLeft % 60;
    return {
      headline: h > 0 ? `${h}h ${m}m remaining` : `${m}m remaining`,
      subline: `Scheduled leaving time: ${new Date(endMs).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}`,
      tone: 'info',
    };
  }
  if (minsLeft >= 0) {
    return {
      headline: `${minsLeft}m left before leaving time`,
      subline: 'Extend now to keep the bay or notify host as you exit',
      tone: 'warning',
    };
  }
  const overMins = Math.abs(minsLeft);
  if (overMins <= 10) {
    return {
      headline: `Grace Period (${overMins}/10 mins)`,
      subline: 'Leave within 10 mins of end time with zero overstay fee',
      tone: 'warning',
    };
  }
  return {
    headline: `Overstay +${overMins}m`,
    subline: 'Extra hourly prorated charge applies until you check out',
    tone: 'danger',
  };
}

export default function BookingDetailScreen() {
  const { id, fromCheckout } = useLocalSearchParams<{ id: string; fromCheckout?: string }>();
  const [booking, setBooking] = useState<BookingDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState(false);
  const [extending, setExtending] = useState(false);
  const [handshaking, setHandshaking] = useState(false);
  const [nowTick, setNowTick] = useState(() => Date.now());
  const [isCachedView, setIsCachedView] = useState(false);
  const [loadError, setLoadError] = useState<ClassifiedApiError | null>(null);
  const isDemoMode = useAuthStore((s) => s.isDemoMode);
  const insets = useSafeAreaInsets();

  const handleGoBack = useCallback(() => {
    if (fromCheckout === '1') {
      router.replace('/(tabs)/bookings');
      return;
    }
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace('/(tabs)/bookings');
  }, [fromCheckout]);

  useEffect(() => {
    if (fromCheckout !== '1') return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      router.replace('/(tabs)/bookings');
      return true;
    });
    return () => sub.remove();
  }, [fromCheckout]);

  useEffect(() => {
    const timer = setInterval(() => setNowTick(Date.now()), 30_000);
    return () => clearInterval(timer);
  }, []);

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
        await useHostStore.getState().loadMySpaces().catch(() => {});
        const cached = (await cacheGet<any[]>(CACHE_KEYS.RECENT_BOOKINGS)) || [];
        const demoPool = cached.length > 0 ? cached : createDemoBookings();
        const found = demoPool.find((b) => b.id === id) || demoPool[0];
        if (found) {
          const formatted = formatBooking(found, id);
          const matchingSpace = [
            ...useHostStore.getState().mySpaces.map(hostSpaceToDemoItem),
            ...DEMO_SPACES,
          ].find((s) => s.id === formatted.spaceId);
          setBooking({
            ...formatted,
            spaceType: formatted.spaceType || matchingSpace?.spaceType,
            entryInstructions: formatted.entryInstructions || matchingSpace?.entryInstructions,
          });
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

  const handleCheckIn = async () => {
    if (!booking || handshaking) return;
    setHandshaking(true);
    try {
      let updated: BookingDetail;
      if (isDemoMode) {
        const nowIso = new Date().toISOString();
        updated = { ...booking, status: 'active', checkedInAt: nowIso };
      } else {
        const { data } = await bookingApi.checkIn(booking.id, booking.gateCode);
        const raw = data?.data?.booking || data?.data;
        updated = raw
          ? formatBooking(raw, booking.id)
          : { ...booking, status: 'active', checkedInAt: new Date().toISOString() };
      }
      setBooking(updated);
      const cached = (await cacheGet<any[]>(CACHE_KEYS.RECENT_BOOKINGS)) || [];
      await cacheSet(
        CACHE_KEYS.RECENT_BOOKINGS,
        cached.map((b) => (b.id === booking.id ? { ...b, ...updated } : b)),
      );
      triggerHaptic('success');
      Alert.alert(
        'Checked In',
        `Parking session started. Scheduled leaving time: ${new Date(updated.endTime).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}.`,
      );
    } catch (err: unknown) {
      const classified = classifyApiError(err, 'Could not complete check-in right now.');
      Alert.alert('Check-In Notice', classified.message);
    } finally {
      setHandshaking(false);
    }
  };

  const handleNotifyLeaving = async () => {
    if (!booking || handshaking) return;
    setHandshaking(true);
    try {
      const nowIso = new Date().toISOString();
      let updated: BookingDetail = { ...booking, leavingNotifiedAt: nowIso };
      if (!isDemoMode) {
        const { data } = await bookingApi.notifyLeaving(booking.id);
        const raw = data?.data?.booking || data?.data;
        if (raw) updated = formatBooking(raw, booking.id);
      }
      setBooking(updated);
      const cached = (await cacheGet<any[]>(CACHE_KEYS.RECENT_BOOKINGS)) || [];
      await cacheSet(
        CACHE_KEYS.RECENT_BOOKINGS,
        cached.map((b) => (b.id === booking.id ? { ...b, ...updated } : b)),
      );
      triggerHaptic('selection');
      Alert.alert('Host Notified', 'The host has been alerted that you are preparing to leave the space.');
    } catch (err: unknown) {
      const classified = classifyApiError(err, 'Unable to notify host right now.');
      Alert.alert('Notice Failed', classified.message);
    } finally {
      setHandshaking(false);
    }
  };

  const handleCheckOut = () => {
    if (!booking || handshaking) return;
    Alert.alert(
      'Finish & Check Out',
      'Confirm that you have exited the parking space? Any overstay past the 10-minute grace period will be settled automatically.',
      [
        { text: 'Not Yet', style: 'cancel' },
        {
          text: 'Check Out Now',
          onPress: async () => {
            setHandshaking(true);
            try {
              let updated: BookingDetail;
              if (isDemoMode) {
                const nowMs = Date.now();
                const endMs = new Date(booking.endTime).getTime();
                let overstayMinutes = 0;
                let overstayAmount = 0;
                if (nowMs > endMs + 10 * 60_000) {
                  overstayMinutes = Math.ceil((nowMs - endMs) / 60_000);
                  const rate = booking.hourlyRate || 40;
                  overstayAmount = Math.round(rate * (overstayMinutes / 60) * 1.05 * 100) / 100;
                }
                const nowIso = new Date(nowMs).toISOString();
                updated = {
                  ...booking,
                  status: 'completed',
                  checkedInAt: booking.checkedInAt || booking.startTime,
                  checkedOutAt: nowIso,
                  overstayMinutes,
                  overstayAmount,
                  totalAmount: Math.round((booking.totalAmount + overstayAmount) * 100) / 100,
                };
              } else {
                const { data } = await bookingApi.checkOut(booking.id);
                const raw = data?.data?.booking || data?.data;
                updated = raw
                  ? formatBooking(raw, booking.id)
                  : { ...booking, status: 'completed', checkedOutAt: new Date().toISOString() };
              }

              setBooking(updated);
              const cached = (await cacheGet<any[]>(CACHE_KEYS.RECENT_BOOKINGS)) || [];
              await cacheSet(
                CACHE_KEYS.RECENT_BOOKINGS,
                cached.map((b) => (b.id === booking.id ? { ...b, ...updated } : b)),
              );
              triggerHaptic('success');
              Alert.alert(
                'Checked Out',
                updated.overstayMinutes && updated.overstayMinutes > 0
                  ? `Session ended with ${updated.overstayMinutes}m overstay (+₹${updated.overstayAmount || 0}).`
                  : 'Checked out on time. Thank you for using Parkly!',
              );
            } catch (err: unknown) {
              const classified = classifyApiError(err, 'Could not complete check-out.');
              Alert.alert('Check-Out Error', classified.message);
            } finally {
              setHandshaking(false);
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
          onPress={handleGoBack}
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
            {getSpaceTypeMeta(booking.spaceType).isPrivate && (
              <View style={styles.privateHostPill}>
                <Ionicons name="home-outline" size={12} color={colors.success} />
                <Text style={styles.privateHostText}>
                  {getSpaceTypeMeta(booking.spaceType).label}
                </Text>
              </View>
            )}

            <View style={styles.slotBadge}>
              <Ionicons name="pin" size={14} color={colors.navy} />
              <Text style={styles.slotText}>Assigned Spot: {booking.slotNumber}</Text>
            </View>

            {booking.entryInstructions && (
              <View style={styles.instructionsBox}>
                <Ionicons name="key-outline" size={15} color={colors.navy} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.instructionsTitle}>Arrival & Gate Instructions</Text>
                  <Text style={styles.instructionsText}>{booking.entryInstructions}</Text>
                </View>
              </View>
            )}
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
              {booking.gateCode && (
                <View style={styles.gatePinPill}>
                  <Ionicons name="keypad-outline" size={14} color={colors.navy} />
                  <Text style={styles.gatePinText}>
                    Backup Host PIN: {booking.gateCode}
                  </Text>
                </View>
              )}
            </View>
          )}

          {(() => {
            const session = getLiveSessionStatus(booking, nowTick);
            const toneBg =
              session.tone === 'success'
                ? colors.successLight
                : session.tone === 'warning'
                ? colors.warningLight
                : session.tone === 'danger'
                ? colors.dangerLight
                : colors.infoLight;
            const toneFg =
              session.tone === 'success'
                ? colors.success
                : session.tone === 'warning'
                ? colors.warning
                : session.tone === 'danger'
                ? colors.danger
                : colors.info;
            const toneBorder =
              session.tone === 'success'
                ? colors.successBorder
                : session.tone === 'warning'
                ? colors.warningBorder
                : session.tone === 'danger'
                ? colors.dangerBorder
                : colors.infoBorder;
            return (
              <View style={[styles.liveBanner, { backgroundColor: toneBg, borderColor: toneBorder }]}>
                <Ionicons name="time" size={18} color={toneFg} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.liveBannerTitle, { color: toneFg }]}>{session.headline}</Text>
                  <Text style={styles.liveBannerSub}>{session.subline}</Text>
                </View>
              </View>
            );
          })()}

          <View style={styles.infoCard}>
            <Text style={styles.cardSectionTitle}>Parking &amp; Leaving Schedule</Text>
            <View style={styles.timelineRow}>
              <View style={styles.timeBlock}>
                <Text style={styles.timeLabel}>Check-In Window</Text>
                <Text style={styles.timeValue}>{formatDate(booking.startTime)}</Text>
                {booking.checkedInAt && (
                  <Text style={styles.actualStamp}>
                    Arrived {new Date(booking.checkedInAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                  </Text>
                )}
              </View>
              <Ionicons
                name="arrow-forward"
                size={18}
                color={colors.textMuted}
                style={{ alignSelf: 'center', marginHorizontal: 8 }}
              />
              <View style={styles.timeBlock}>
                <Text style={styles.timeLabel}>Leaving By</Text>
                <Text style={styles.timeValue}>{formatDate(booking.endTime)}</Text>
                {booking.checkedOutAt && (
                  <Text style={styles.actualStamp}>
                    Left {new Date(booking.checkedOutAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                  </Text>
                )}
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

            {booking.status === 'confirmed' && (
              <PressScale
                style={[styles.checkInBtn, handshaking && { opacity: 0.6 }]}
                contentStyle={styles.primaryActionContent}
                rippleColor={colors.rippleLight}
                haptic="medium"
                onPress={handleCheckIn}
                disabled={handshaking}
              >
                <Ionicons name="enter-outline" size={18} color={colors.white} />
                <Text style={styles.primaryActionText}>
                  {handshaking ? 'Checking In...' : 'I Have Arrived · Check In'}
                </Text>
              </PressScale>
            )}

            {booking.status === 'active' && (
              <View style={styles.secondaryActionsRow}>
                <PressScale
                  style={[styles.secondaryActionBtn, handshaking && { opacity: 0.55 }]}
                  contentStyle={styles.secondaryActionContent}
                  haptic="selection"
                  onPress={handleNotifyLeaving}
                  disabled={handshaking || Boolean(booking.leavingNotifiedAt)}
                >
                  <Ionicons name="notifications-outline" size={17} color={colors.navy} />
                  <Text style={styles.secondaryActionText}>
                    {booking.leavingNotifiedAt ? 'Host Notified' : 'Leaving Soon'}
                  </Text>
                </PressScale>

                <PressScale
                  style={[styles.checkOutBtn, handshaking && { opacity: 0.55 }]}
                  contentStyle={styles.secondaryActionContent}
                  haptic="medium"
                  onPress={handleCheckOut}
                  disabled={handshaking}
                >
                  <Ionicons name="exit-outline" size={17} color={colors.white} />
                  <Text style={styles.checkOutBtnText}>Leave &amp; Check Out</Text>
                </PressScale>
              </View>
            )}

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
  privateHostPill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 5,
    marginBottom: 10,
    backgroundColor: colors.successLight,
    borderWidth: 1,
    borderColor: colors.successBorder,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  privateHostText: { color: colors.success, fontSize: 11.5, fontWeight: '800' },
  instructionsBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginTop: 10,
    backgroundColor: colors.cardElevated,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    padding: 10,
  },
  instructionsTitle: { color: colors.navy, fontSize: 12, fontWeight: '800', marginBottom: 2 },
  instructionsText: { color: colors.textSecondary, fontSize: 12.5, lineHeight: 18 },
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
  gatePinPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 10,
    backgroundColor: colors.cardElevated,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  gatePinText: {
    color: colors.navy,
    fontSize: 13,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
    letterSpacing: 0.5,
  },
  liveBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 12,
    borderWidth: 1,
    padding: 13,
    marginBottom: 14,
  },
  liveBannerTitle: { fontSize: 13.5, fontWeight: '800' },
  liveBannerSub: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
  actualStamp: {
    color: colors.success,
    fontSize: 11,
    fontWeight: '700',
    marginTop: 3,
    fontVariant: ['tabular-nums'],
  },
  checkInBtn: {
    backgroundColor: colors.success,
    borderRadius: 12,
    overflow: 'hidden',
  },
  checkOutBtn: {
    flex: 1,
    backgroundColor: colors.primary,
    borderRadius: 12,
    overflow: 'hidden',
  },
  checkOutBtnText: { color: colors.white, fontSize: 13.5, fontWeight: '800' },
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
