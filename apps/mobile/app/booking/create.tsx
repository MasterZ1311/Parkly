import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
  TextInput,
  Modal,
  KeyboardAvoidingView,
  Platform,
  BackHandler,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  bookingApi,
  paymentApi,
  type VehiclePayloadType,
} from '../../src/api/client';
import { cacheGet, cacheSet, CACHE_KEYS } from '../../src/utils/cache';
import { colors, theme } from '../../src/constants/theme';
import { ENTER_FADE_UP, PressScale, triggerHaptic } from '../../src/components/Motion';
import { QrPassSvg } from '../../src/components/QrPassSvg';
import { VehicleIllustration } from '../../src/components/VehicleIllustration';
import { useAuthStore } from '../../src/store/auth.store';
import { useDriverStore } from '../../src/store/driver.store';
import { classifyApiError } from '../../src/utils/apiErrors';
import { scheduleBookingReminderNotification } from '../../src/services/notifications';
import { DEMO_HOST_ID } from '../../src/data/demoFixtures';

const HOLD_DURATION_SECONDS = 15 * 60; // 15-minute checkout reservation hold
const INDIAN_PLATE_REGEX = /^[A-Z]{2}[0-9]{2}[A-Z]{1,2}[0-9]{4}$/;
const UPI_VPA_REGEX = /^[a-zA-Z0-9._-]{2,}@[a-zA-Z]{2,}$/;

interface PendingOrderState {
  bookingId: string;
  paymentId: string;
  amount: number;
  provider: string;
  orderRef: string;
  startTimeIso: string;
  endTimeIso: string;
  vehicleId: string;
  vehiclePlate: string;
  vehicleType: VehiclePayloadType;
  slotNumber?: string;
}

function formatHoldClock(seconds: number): string {
  const safe = Math.max(0, seconds);
  const mins = Math.floor(safe / 60);
  const secs = safe % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

export default function BookingCreateScreen() {
  const {
    spaceId,
    spaceName,
    hostId,
    hours,
    totalAmount,
    hourlyRate,
    arrivalTime,
    spaceType,
    entryInstructions,
  } = useLocalSearchParams<{
    spaceId: string;
    spaceName: string;
    hostId?: string;
    hours: string;
    totalAmount: string;
    hourlyRate: string;
    arrivalTime?: string;
    spaceType?: string;
    entryInstructions?: string;
  }>();

  const isDemoMode = useAuthStore((s) => s.isDemoMode);
  const vehicles = useDriverStore((s) => s.vehicles);
  const upiMethods = useDriverStore((s) => s.upiMethods);
  const loadVehicles = useDriverStore((s) => s.loadVehicles);
  const addVehicle = useDriverStore((s) => s.addVehicle);
  const loadUpiMethods = useDriverStore((s) => s.loadUpiMethods);

  const [selectedVehicleId, setSelectedVehicleId] = useState<string>('custom');
  const [vehiclePlate, setVehiclePlate] = useState('TN01AB1234');
  const [vehicleType, setVehicleType] = useState<VehiclePayloadType>('sedan');
  const [selectedUpiVpa, setSelectedUpiVpa] = useState<string>('');
  const [customUpiVpa, setCustomUpiVpa] = useState<string>('');

  const [loading, setLoading] = useState(false);
  const [authorizingPayment, setAuthorizingPayment] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [step, setStep] = useState<'details' | 'success'>('details');
  const [upiSheetOpen, setUpiSheetOpen] = useState(false);
  const [pendingOrder, setPendingOrder] = useState<PendingOrderState | null>(null);
  const [holdSecondsLeft, setHoldSecondsLeft] = useState<number>(HOLD_DURATION_SECONDS);
  const [confirmedBookingId, setConfirmedBookingId] = useState<string>('');
  const [confirmedQrToken, setConfirmedQrToken] = useState<string>('');
  const [confirmedGateCode, setConfirmedGateCode] = useState<string>('');
  const [confirmedEndTimeIso, setConfirmedEndTimeIso] = useState<string>('');
  const [confirmedAmount, setConfirmedAmount] = useState<number>(0);

  const insets = useSafeAreaInsets();

  useEffect(() => {
    loadVehicles()
      .then((list) => {
        if (list.length > 0) {
          const def = list.find((v) => v.isDefault) || list[0];
          setSelectedVehicleId(def.id);
          setVehiclePlate(def.licensePlate);
          setVehicleType(def.vehicleType);
        } else {
          setSelectedVehicleId('custom');
        }
      })
      .catch(() => {
        setSelectedVehicleId('custom');
      });

    loadUpiMethods()
      .then((list) => {
        if (list.length > 0) {
          const def = list.find((m) => m.isDefault) || list[0];
          setSelectedUpiVpa(def.vpa);
        }
      })
      .catch(() => {});
  }, [loadVehicles, loadUpiMethods]);

  // Prevent Android hardware Back on success screen from reviving hold timer or stepping back into confirm state
  useEffect(() => {
    if (step !== 'success') return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      router.replace('/(tabs)/bookings');
      return true;
    });
    return () => sub.remove();
  }, [step]);
  // Live 15-minute checkout hold timer while pendingOrder is awaiting confirmation
  useEffect(() => {
    if (!pendingOrder || step === 'success') return;

    const timer = setInterval(() => {
      setHoldSecondsLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          setUpiSheetOpen(false);
          router.replace({
            pathname: '/booking/expired',
            params: {
              bookingId: pendingOrder.bookingId,
              spaceName: spaceName || 'Chennai Parking Complex',
              zone: '15-Minute Checkout Hold',
            },
          });
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [pendingOrder, step, spaceName]);

  const parsedAmount = Number(totalAmount);
  const parsedHours = Number(hours || 1);
  const parsedHourlyRate = Number(hourlyRate || (parsedAmount > 0 ? parsedAmount / parsedHours : 40));
  const hasValidParams =
    Boolean(spaceId) &&
    Number.isFinite(parsedAmount) &&
    parsedAmount > 0 &&
    Number.isFinite(parsedHours) &&
    parsedHours > 0;

  if (!hasValidParams) {
    return (
      <ScrollView
        style={styles.container}
        contentContainerStyle={{
          flexGrow: 1,
          justifyContent: 'center',
          paddingTop: Math.max(insets.top + 20, 40),
          paddingBottom: Math.max(insets.bottom + 24, 36),
          paddingHorizontal: 18,
        }}
      >
        <StatusBar style="dark" backgroundColor={colors.background} />
        <View style={styles.card}>
          <Ionicons name="hourglass-outline" size={32} color={colors.warning} />
          <Text style={[styles.cardTitle, { marginTop: 8 }]}>
            Checkout Session Expired or Incomplete
          </Text>
          <Text style={styles.cardDetail}>
            Missing parking space selection or pricing quote. Select a space again to lock a fresh bay hold.
          </Text>
          <PressScale
            style={[styles.confirmBtn, { marginTop: 14 }]}
            contentStyle={styles.confirmBtnContent}
            rippleColor={colors.rippleLight}
            onPress={() => router.replace('/(tabs)/home')}
          >
            <Text style={styles.confirmBtnText}>Find Parking Bay</Text>
          </PressScale>
          <PressScale
            style={[styles.backHomeBtn, { marginTop: 6 }]}
            contentStyle={styles.backHomeContent}
            onPress={() => router.replace('/(tabs)/bookings')}
          >
            <Text style={styles.linkText}>Open My Bookings</Text>
          </PressScale>
        </View>
      </ScrollView>
    );
  }

  const feeAmount = Math.round(parsedAmount * 0.05);
  const grandTotal = parsedAmount + feeAmount;
  const effectiveUpiVpa =
    selectedUpiVpa === '__custom__' ? customUpiVpa.trim().toLowerCase() : selectedUpiVpa;

  const resolveActiveVehicle = async (): Promise<{
    id: string;
    plate: string;
    type: VehiclePayloadType;
  }> => {
    if (selectedVehicleId !== 'custom') {
      const existing = vehicles.find((v) => v.id === selectedVehicleId);
      if (existing) {
        return {
          id: existing.id,
          plate: existing.licensePlate,
          type: existing.vehicleType,
        };
      }
    }

    const cleanedPlate = vehiclePlate.trim().toUpperCase().replace(/\s+/g, '');
    if (!cleanedPlate) {
      throw new Error('VALIDATION:Please enter your vehicle license plate.');
    }
    if (!INDIAN_PLATE_REGEX.test(cleanedPlate)) {
      throw new Error(
        'VALIDATION:Enter a valid Indian vehicle registration number (e.g. TN01AB1234).',
      );
    }

    const matchedExisting = vehicles.find((v) => v.licensePlate === cleanedPlate);
    if (matchedExisting) {
      return {
        id: matchedExisting.id,
        plate: matchedExisting.licensePlate,
        type: matchedExisting.vehicleType,
      };
    }

    const created = await addVehicle({
      licensePlate: cleanedPlate,
      vehicleType,
      isDefault: vehicles.length === 0,
    });
    return {
      id: created.id,
      plate: created.licensePlate,
      type: created.vehicleType,
    };
  };

  const handleLockAndInitiatePayment = async () => {
    setCheckoutError(null);
    if (selectedUpiVpa === '__custom__' && !UPI_VPA_REGEX.test(effectiveUpiVpa)) {
      Alert.alert('Invalid UPI ID', 'Please enter a valid UPI handle (e.g. name@oksbi).');
      return;
    }

    setLoading(true);
    try {
      const activeVehicle = await resolveActiveVehicle();
      const parsedArrivalMs = arrivalTime ? Date.parse(arrivalTime) : NaN;
      const startMs =
        Number.isFinite(parsedArrivalMs) && parsedArrivalMs > Date.now() + 30_000
          ? parsedArrivalMs
          : Date.now() + 30_000;
      const startTimeIso = new Date(startMs).toISOString();
      const endTimeIso = new Date(startMs + parsedHours * 3600_000).toISOString();

      if (isDemoMode) {
        const demoBookingId = `11111111-1111-4111-8111-${String(Date.now()).slice(-12).padStart(12, '0')}`;
        const demoPaymentId = `22222222-2222-4222-8222-${String(Date.now()).slice(-12).padStart(12, '0')}`;
        setPendingOrder({
          bookingId: demoBookingId,
          paymentId: demoPaymentId,
          amount: grandTotal,
          provider: 'mock',
          orderRef: `DEMO_ORD_${demoBookingId.slice(-6).toUpperCase()}`,
          startTimeIso,
          endTimeIso,
          vehicleId: activeVehicle.id,
          vehiclePlate: activeVehicle.plate,
          vehicleType: activeVehicle.type,
          slotNumber: 'Bay A-04',
        });
        setHoldSecondsLeft(HOLD_DURATION_SECONDS);
        setUpiSheetOpen(true);
        triggerHaptic('selection');
        return;
      }

      // If a pending booking hold already exists for this screen, reuse its payment initiation
      if (pendingOrder) {
        setUpiSheetOpen(true);
        return;
      }

      const { data: bookingResp } = await bookingApi.create({
        spaceId: spaceId!,
        vehicleId: activeVehicle.id,
        ...(hostId && hostId !== 'host-chennai-001' ? { hostId } : {}),
        type: 'instant',
        startTime: startTimeIso,
        endTime: endTimeIso,
        totalAmount: grandTotal,
      });

      const createdBooking = bookingResp?.data?.booking || bookingResp?.data;
      if (!createdBooking?.id) {
        throw new Error('Booking reservation could not be initialized.');
      }

      const authoritativeAmount = Number(createdBooking.totalAmount || grandTotal);
      const { data: payResp } = await paymentApi.initiate(
        createdBooking.id,
        authoritativeAmount,
      );
      const payment = payResp?.data;
      if (!payment?.id) {
        throw new Error('Payment gateway order could not be initialized.');
      }

      setPendingOrder({
        bookingId: createdBooking.id,
        paymentId: payment.id,
        amount: Number(payment.amount || authoritativeAmount),
        provider: String(payment.provider || 'mock'),
        orderRef: String(payment.providerOrderId || payment.id.slice(-8).toUpperCase()),
        startTimeIso: createdBooking.startTime || startTimeIso,
        endTimeIso: createdBooking.endTime || endTimeIso,
        vehicleId: activeVehicle.id,
        vehiclePlate: activeVehicle.plate,
        vehicleType: activeVehicle.type,
        slotNumber: createdBooking.slotNumber,
      });
      setHoldSecondsLeft(HOLD_DURATION_SECONDS);
      setUpiSheetOpen(true);
      triggerHaptic('selection');
    } catch (err: unknown) {
      if (err instanceof Error && err.message.startsWith('VALIDATION:')) {
        Alert.alert('Check Vehicle Details', err.message.replace('VALIDATION:', ''));
        return;
      }

      const classified = classifyApiError(err, 'Unable to lock bay hold right now.');
      if (classified.kind === 'session-expired') {
        router.replace('/status/session-expired');
        return;
      }
      if (classified.kind === 'restricted') {
        router.replace('/status/restricted');
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
      if (classified.kind === 'conflict') {
        router.replace({
          pathname: '/booking/expired',
          params: {
            spaceName: spaceName || 'Chennai Parking Complex',
            zone: 'No Available Bay Window',
          },
        });
        return;
      }

      setCheckoutError(classified.message);
      Alert.alert('Checkout Error', classified.message);
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmUpiPayment = async (simulateFailure = false) => {
    if (!pendingOrder || authorizingPayment) return;
    setAuthorizingPayment(true);

    try {
      if (isDemoMode) {
        if (simulateFailure) {
          setUpiSheetOpen(false);
          router.replace({
            pathname: '/booking/payment-failed',
            params: {
              spaceId,
              spaceName: spaceName || 'Chennai Parking Complex',
              hostId: hostId || DEMO_HOST_ID,
              hours: String(parsedHours),
              totalAmount: String(parsedAmount),
              hourlyRate: String(parsedHourlyRate),
              amount: String(pendingOrder.amount),
              reason: 'Simulated UPI bank decline in Demo Mode.',
            },
          });
          return;
        }

        const demoGateCode = String(1000 + (Number(pendingOrder.bookingId.slice(-4).replace(/\D/g, '') || 4821) % 9000));
        const newDemoBooking = {
          id: pendingOrder.bookingId,
          spaceId: spaceId!,
          hostId: hostId || DEMO_HOST_ID,
          vehicleId: pendingOrder.vehicleId,
          spaceName: spaceName || 'Chennai Parking Complex',
          spaceAddress: 'Chennai Smart Grid Facility',
          spaceType: spaceType || 'commercial',
          entryInstructions: entryInstructions || undefined,
          vehiclePlate: pendingOrder.vehiclePlate,
          vehicleType: pendingOrder.vehicleType,
          status: 'confirmed',
          startTime: pendingOrder.startTimeIso,
          endTime: pendingOrder.endTimeIso,
          durationMinutes: parsedHours * 60,
          totalAmount: pendingOrder.amount,
          hourlyRate: parsedHourlyRate,
          type: 'instant',
          slotNumber: pendingOrder.slotNumber || 'Bay A-04',
          gateCode: demoGateCode,
        };
        const currentCached = (await cacheGet<any[]>(CACHE_KEYS.RECENT_BOOKINGS)) || [];
        await cacheSet(CACHE_KEYS.RECENT_BOOKINGS, [newDemoBooking, ...currentCached]);

        const demoQr = `PARKLY.DEMO.${pendingOrder.bookingId}.${pendingOrder.vehiclePlate}`;
        setConfirmedBookingId(pendingOrder.bookingId);
        setConfirmedQrToken(demoQr);
        setConfirmedGateCode(demoGateCode);
        setConfirmedEndTimeIso(pendingOrder.endTimeIso);
        setConfirmedAmount(pendingOrder.amount);
        setVehiclePlate(pendingOrder.vehiclePlate);
        setUpiSheetOpen(false);
        setStep('success');
        triggerHaptic('success');

        scheduleBookingReminderNotification({
          bookingId: pendingOrder.bookingId,
          spaceName: spaceName || 'Parking Complex',
          endTimeIso: pendingOrder.endTimeIso,
          vehiclePlate: pendingOrder.vehiclePlate,
        }).catch(() => {});
        return;
      }

      const providerPaymentId = `pay_upi_${Date.now()}`;
      const signature = simulateFailure
        ? 'invalid'
        : `sig_upi_${pendingOrder.paymentId.slice(0, 8)}_${Date.now()}`;

      await paymentApi.confirm(pendingOrder.paymentId, providerPaymentId, signature);

      let confirmedBooking: any = null;
      try {
        const fetched = await bookingApi.get(pendingOrder.bookingId);
        confirmedBooking = fetched.data?.data?.booking || fetched.data?.data;
      } catch {
        // Fallback to summary fields if GET refresh fails momentarily
      }

      const record = confirmedBooking || {
        id: pendingOrder.bookingId,
        spaceId: spaceId!,
        spaceName: spaceName || 'Chennai Parking Complex',
        spaceType: spaceType || 'commercial',
        entryInstructions: entryInstructions || undefined,
        vehicleId: pendingOrder.vehicleId,
        vehiclePlate: pendingOrder.vehiclePlate,
        status: 'confirmed',
        startTime: pendingOrder.startTimeIso,
        endTime: pendingOrder.endTimeIso,
        totalAmount: pendingOrder.amount,
        type: 'instant',
      };

      try {
        const cached = (await cacheGet<any[]>(CACHE_KEYS.RECENT_BOOKINGS)) || [];
        const deduped = cached.filter((item) => item.id !== record.id);
        await cacheSet(CACHE_KEYS.RECENT_BOOKINGS, [record, ...deduped]);
      } catch {
        // Cache persistence is best-effort
      }

      setConfirmedBookingId(pendingOrder.bookingId);
      setConfirmedQrToken(
        record.qrToken || `PARKLY:${pendingOrder.bookingId}:${pendingOrder.vehiclePlate}`,
      );
      setConfirmedGateCode(
        record.gateCode ||
          String(1000 + (parseInt(pendingOrder.bookingId.replace(/\D/g, '').slice(-4) || '4821', 10) % 9000)),
      );
      setConfirmedEndTimeIso(record.endTime || pendingOrder.endTimeIso);
      setConfirmedAmount(Number(record.totalAmount || pendingOrder.amount));
      setVehiclePlate(pendingOrder.vehiclePlate);
      setUpiSheetOpen(false);
      setStep('success');
      triggerHaptic('success');

      scheduleBookingReminderNotification({
        bookingId: pendingOrder.bookingId,
        spaceName: spaceName || record.spaceName || 'Parking Complex',
        endTimeIso: record.endTime || pendingOrder.endTimeIso,
        vehiclePlate: pendingOrder.vehiclePlate,
      }).catch(() => {});
    } catch (err: unknown) {
      const classified = classifyApiError(err, 'UPI payment confirmation failed.');
      setUpiSheetOpen(false);

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
      if (classified.kind === 'conflict') {
        router.replace({
          pathname: '/booking/expired',
          params: {
            bookingId: pendingOrder.bookingId,
            spaceName: spaceName || 'Chennai Parking Complex',
          },
        });
        return;
      }

      router.replace({
        pathname: '/booking/payment-failed',
        params: {
          spaceId,
          spaceName: spaceName || 'Chennai Parking Complex',
          hostId: hostId || '',
          hours: String(parsedHours),
          totalAmount: String(parsedAmount),
          hourlyRate: String(parsedHourlyRate),
          amount: String(pendingOrder.amount),
          reason: classified.message,
        },
      });
    } finally {
      setAuthorizingPayment(false);
    }
  };

  if (step === 'success') {
    const displayPaid = confirmedAmount || grandTotal;
    return (
      <ScrollView
        style={styles.container}
        contentContainerStyle={[
          styles.successContainer,
          {
            paddingTop: Math.max(insets.top + 20, 40),
            paddingBottom: Math.max(insets.bottom + 24, 36),
          },
        ]}
      >
        <StatusBar style="dark" backgroundColor={colors.background} />

        <Animated.View entering={ENTER_FADE_UP} style={styles.successInner}>
          <View style={styles.successBadge}>
            <Ionicons name="checkmark-circle" size={48} color={colors.success} />
          </View>
          <Text style={styles.successTitle} textBreakStrategy="simple">
            Bay Reserved
          </Text>
          <Text style={styles.successSubtitle} textBreakStrategy="simple">
            Your offline QR gate pass is ready for
          </Text>
          <Text style={styles.successSpaceName} textBreakStrategy="simple">
            {spaceName || 'Reserved Parking Bay'}
          </Text>

          <View style={styles.qrCard}>
            <Text style={styles.qrCardHeader}>Scan At Entry Barrier</Text>
            <View style={styles.qrSvgWrap}>
              <QrPassSvg
                value={confirmedQrToken || `PARKLY:${confirmedBookingId}:${vehiclePlate}`}
                size={180}
              />
            </View>
            <Text style={styles.qrTokenText}>
              #{confirmedBookingId.slice(-8).toUpperCase()} · OFFLINE PASS
            </Text>
            {Boolean(confirmedGateCode) && (
              <Text style={[styles.qrTokenText, { marginTop: 4, color: colors.navy }]}>
                Host / Gate Backup PIN: {confirmedGateCode}
              </Text>
            )}
          </View>

          <View style={styles.successCard}>
            <View style={styles.detailRow}>
              <Text style={styles.successCardLabel}>Vehicle Plate</Text>
              <Text style={[styles.successCardValue, styles.mono]}>
                {vehiclePlate.toUpperCase()}
              </Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.successCardLabel}>Duration</Text>
              <Text style={[styles.successCardValue, styles.mono]}>{parsedHours} hours</Text>
            </View>
            {Boolean(confirmedEndTimeIso) && (
              <View style={styles.detailRow}>
                <Text style={styles.successCardLabel}>Leaving By</Text>
                <Text style={[styles.successCardValue, styles.mono]}>
                  {new Date(confirmedEndTimeIso).toLocaleTimeString('en-IN', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </Text>
              </View>
            )}
            <View style={styles.detailRow}>
              <Text style={styles.successCardLabel}>Total Paid</Text>
              <Text style={[styles.successCardValue, styles.mono, { color: colors.success }]}>
                ₹{displayPaid}
              </Text>
            </View>
          </View>

          <PressScale
            style={styles.successBtn}
            contentStyle={styles.successBtnContent}
            rippleColor={colors.rippleLight}
            haptic="medium"
            onPress={() => {
              router.replace({
                pathname: '/booking/[id]',
                params: { id: confirmedBookingId, fromCheckout: '1' },
              });
            }}
          >
            <Text style={styles.successBtnText}>Open Gate Pass Details</Text>
          </PressScale>

          <PressScale
            style={styles.backHomeBtn}
            contentStyle={styles.backHomeContent}
            haptic="selection"
            onPress={() => router.replace('/(tabs)/bookings')}
          >
            <Text style={styles.linkText}>View All Bookings</Text>
          </PressScale>
        </Animated.View>
      </ScrollView>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar style="light" backgroundColor={colors.navy} />

      <View style={[styles.bookingHeader, { paddingTop: Math.max(insets.top + 8, 18) }]}>
        <PressScale
          style={styles.headerBackBtn}
          contentStyle={styles.headerBackContent}
          rippleColor={colors.rippleLight}
          onPress={() => router.back()}
          accessibilityLabel="Go back"
        >
          <Ionicons name="arrow-back" size={20} color={colors.white} />
        </PressScale>
        <Text style={styles.headerTitle}>Confirm Reservation</Text>
        <View style={styles.holdPill}>
          <Ionicons name="time-outline" size={13} color={colors.warning} />
          <Text style={styles.holdPillText}>{formatHoldClock(holdSecondsLeft)}</Text>
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ padding: 18, paddingBottom: 140 + insets.bottom }}
      >
        {/* Spot Summary */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>{spaceName}</Text>
          <View style={styles.row}>
            <Ionicons name="time-outline" size={16} color={colors.textMuted} />
            <Text style={styles.cardDetail}>
              {(() => {
                const startMs =
                  arrivalTime && Number.isFinite(Date.parse(arrivalTime))
                    ? Date.parse(arrivalTime)
                    : Date.now();
                const leaveMs = startMs + parsedHours * 3600_000;
                const fmt = (ms: number) =>
                  new Date(ms).toLocaleTimeString('en-IN', {
                    hour: '2-digit',
                    minute: '2-digit',
                  });
                return `Park ${fmt(startMs)} → Leave ${fmt(leaveMs)} (${parsedHours}h) · 15-min hold`;
              })()}
            </Text>
          </View>
        </View>

        {checkoutError && (
          <View style={styles.errorBanner}>
            <Ionicons name="alert-circle-outline" size={18} color={colors.danger} />
            <Text style={styles.errorBannerText}>{checkoutError}</Text>
          </View>
        )}

        {/* Vehicle Selector */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Select Vehicle</Text>

          {vehicles.length > 0 && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.savedVehicleRow}
            >
              {vehicles.map((v) => {
                const active = selectedVehicleId === v.id;
                return (
                  <PressScale
                    key={v.id}
                    style={[styles.savedVehicleCard, active && styles.savedVehicleCardActive]}
                    contentStyle={styles.savedVehicleInner}
                    haptic="selection"
                    onPress={() => {
                      setSelectedVehicleId(v.id);
                      setVehiclePlate(v.licensePlate);
                      setVehicleType(v.vehicleType);
                    }}
                  >
                    <VehicleIllustration
                      type={v.vehicleType}
                      width={60}
                      height={34}
                      accentColor={active ? colors.primary : colors.navy}
                    />
                    <Text
                      style={[
                        styles.savedVehiclePlate,
                        active && styles.savedVehiclePlateActive,
                      ]}
                    >
                      {v.licensePlate}
                    </Text>
                    <Text style={styles.savedVehicleSub}>
                      {v.make ? `${v.make} ${v.model || ''}`.trim() : v.vehicleType.toUpperCase()}
                    </Text>
                  </PressScale>
                );
              })}

              <PressScale
                style={[
                  styles.savedVehicleCard,
                  selectedVehicleId === 'custom' && styles.savedVehicleCardActive,
                ]}
                contentStyle={styles.savedVehicleInner}
                haptic="selection"
                onPress={() => {
                  setSelectedVehicleId('custom');
                  setVehiclePlate('');
                }}
              >
                <Ionicons
                  name="add-circle-outline"
                  size={28}
                  color={selectedVehicleId === 'custom' ? colors.primary : colors.navy}
                />
                <Text
                  style={[
                    styles.savedVehiclePlate,
                    selectedVehicleId === 'custom' && styles.savedVehiclePlateActive,
                  ]}
                >
                  New Plate
                </Text>
                <Text style={styles.savedVehicleSub}>Register &amp; Save</Text>
              </PressScale>
            </ScrollView>
          )}

          {selectedVehicleId === 'custom' && (
            <View style={{ marginTop: vehicles.length > 0 ? 12 : 0 }}>
              <View style={styles.formGroup}>
                <Text style={styles.label}>License Plate</Text>
                <TextInput
                  style={styles.input}
                  value={vehiclePlate}
                  onChangeText={setVehiclePlate}
                  placeholder="TN01AB1234"
                  placeholderTextColor={colors.textMuted}
                  autoCapitalize="characters"
                  maxLength={12}
                />
              </View>

              <Text style={styles.label}>Vehicle Class</Text>
              <View style={styles.vehicleTypes}>
                {(['motorcycle', 'compact', 'sedan', 'suv'] as const).map((type) => {
                  const active = vehicleType === type;
                  return (
                    <PressScale
                      key={type}
                      haptic="selection"
                      accessibilityState={{ selected: active }}
                      rippleColor={active ? colors.rippleLight : colors.rippleDark}
                      style={[styles.typeChip, active && styles.typeChipActive]}
                      contentStyle={styles.typeChipContent}
                      onPress={() => setVehicleType(type)}
                    >
                      <VehicleIllustration
                        type={type}
                        width={42}
                        height={24}
                        accentColor={active ? colors.primary : colors.navy}
                      />
                      <Text style={[styles.typeText, active && styles.typeTextActive]}>
                        {type.charAt(0).toUpperCase() + type.slice(1)}
                      </Text>
                    </PressScale>
                  );
                })}
              </View>
            </View>
          )}
        </View>

        {/* Payment Summary */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Payment Summary</Text>
          <View style={styles.summaryCard}>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>
                Parking (₹{parsedHourlyRate} × {parsedHours}h)
              </Text>
              <Text style={styles.summaryVal}>₹{parsedAmount}</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Platform Fee (5%)</Text>
              <Text style={styles.summaryVal}>₹{feeAmount}</Text>
            </View>
            <View style={[styles.summaryRow, styles.totalRow]}>
              <Text style={styles.totalLabel}>Total Payable</Text>
              <Text style={styles.totalVal}>₹{pendingOrder?.amount || grandTotal}</Text>
            </View>
          </View>

          <View style={styles.paymentMethods}>
            <Text style={styles.label}>UPI Handle for Checkout</Text>
            {upiMethods.map((m) => {
              const active = selectedUpiVpa === m.vpa;
              return (
                <PressScale
                  key={m.id}
                  style={[styles.paymentOption, active && styles.paymentOptionActive]}
                  contentStyle={styles.paymentOptionContent}
                  haptic="selection"
                  onPress={() => setSelectedUpiVpa(m.vpa)}
                >
                  <Ionicons
                    name="wallet-outline"
                    size={20}
                    color={active ? colors.primary : colors.navy}
                  />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.paymentText}>{m.label}</Text>
                    <Text style={styles.paymentSub}>{m.vpa}</Text>
                  </View>
                  <Ionicons
                    name={active ? 'checkmark-circle' : 'ellipse-outline'}
                    size={20}
                    color={active ? colors.success : colors.textMuted}
                  />
                </PressScale>
              );
            })}

            <PressScale
              style={[
                styles.paymentOption,
                selectedUpiVpa === '__custom__' && styles.paymentOptionActive,
              ]}
              contentStyle={styles.paymentOptionContent}
              haptic="selection"
              onPress={() => setSelectedUpiVpa('__custom__')}
            >
              <Ionicons name="at-outline" size={20} color={colors.navy} />
              <Text style={styles.paymentText}>Enter Another UPI ID</Text>
              <Ionicons
                name={selectedUpiVpa === '__custom__' ? 'checkmark-circle' : 'ellipse-outline'}
                size={20}
                color={selectedUpiVpa === '__custom__' ? colors.success : colors.textMuted}
              />
            </PressScale>

            {selectedUpiVpa === '__custom__' && (
              <TextInput
                style={[styles.input, { marginTop: 8 }]}
                placeholder="yourname@oksbi"
                placeholderTextColor={colors.textMuted}
                autoCapitalize="none"
                value={customUpiVpa}
                onChangeText={setCustomUpiVpa}
              />
            )}
          </View>
        </View>
      </ScrollView>

      {/* Sticky Footer */}
      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom + 12, 20) }]}>
        <PressScale
          style={[styles.confirmBtn, loading && styles.btnDisabled]}
          contentStyle={styles.confirmBtnContent}
          rippleColor={colors.rippleLight}
          haptic="medium"
          onPress={handleLockAndInitiatePayment}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color={colors.white} />
          ) : (
            <Text style={styles.confirmBtnText}>
              {pendingOrder
                ? `Complete UPI Payment — ₹${pendingOrder.amount}`
                : `Lock Bay & Pay ₹${grandTotal}`}
            </Text>
          )}
        </PressScale>
        <Text style={styles.disclaimer}>
          Free cancellation up to 15 minutes before arrival · Two-step Razorpay/UPI checkout
        </Text>
      </View>

      {/* In-App UPI / Razorpay Checkout Sheet */}
      <Modal
        visible={upiSheetOpen && Boolean(pendingOrder)}
        transparent
        animationType="slide"
        onRequestClose={() => !authorizingPayment && setUpiSheetOpen(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalBackdrop}
        >
          <View
            style={[
              styles.upiSheet,
              { paddingBottom: Math.max(insets.bottom + 20, 28) },
            ]}
          >
            <View style={styles.sheetHeader}>
              <View>
                <Text style={styles.sheetEyebrow}>PARKLY RAZORPAY / UPI CHECKOUT</Text>
                <Text style={styles.sheetTitle}>Authorize ₹{pendingOrder?.amount || grandTotal}</Text>
              </View>
              <View style={styles.sheetHoldBadge}>
                <Ionicons name="hourglass-outline" size={14} color={colors.warning} />
                <Text style={styles.sheetHoldText}>{formatHoldClock(holdSecondsLeft)}</Text>
              </View>
            </View>

            <View style={styles.sheetSummaryBox}>
              <View style={styles.detailRow}>
                <Text style={styles.cardDetail}>Facility</Text>
                <Text style={styles.sheetDetailVal} numberOfLines={1}>
                  {spaceName}
                </Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.cardDetail}>Order Ref</Text>
                <Text style={[styles.sheetDetailVal, styles.mono]}>
                  {pendingOrder?.orderRef}
                </Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.cardDetail}>UPI Handle</Text>
                <Text style={[styles.sheetDetailVal, styles.mono]}>
                  {effectiveUpiVpa || 'driver@upi'}
                </Text>
              </View>
            </View>

            <PressScale
              style={[styles.confirmBtn, authorizingPayment && styles.btnDisabled]}
              contentStyle={styles.confirmBtnContent}
              rippleColor={colors.rippleLight}
              onPress={() => handleConfirmUpiPayment(false)}
              disabled={authorizingPayment}
            >
              {authorizingPayment ? (
                <ActivityIndicator color={colors.white} />
              ) : (
                <Text style={styles.confirmBtnText}>
                  Authorize &amp; Pay ₹{pendingOrder?.amount || grandTotal}
                </Text>
              )}
            </PressScale>

            {(isDemoMode || pendingOrder?.provider === 'mock') && (
              <PressScale
                style={styles.failSimBtn}
                contentStyle={styles.backHomeContent}
                onPress={() => handleConfirmUpiPayment(true)}
                disabled={authorizingPayment}
              >
                <Text style={styles.failSimText}>Simulate Bank Decline (Test Failure)</Text>
              </PressScale>
            )}

            <PressScale
              style={styles.backHomeBtn}
              contentStyle={styles.backHomeContent}
              onPress={() => setUpiSheetOpen(false)}
              disabled={authorizingPayment}
            >
              <Text style={styles.linkText}>Dismiss Sheet (Keep Hold Active)</Text>
            </PressScale>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  mono: { fontVariant: ['tabular-nums'] },
  bookingHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingBottom: 14,
    backgroundColor: colors.navy,
  },
  headerBackBtn: {
    width: 48,
    height: 48,
    borderRadius: 12,
    overflow: 'hidden',
  },
  headerBackContent: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: { color: colors.white, fontSize: 17.5, fontWeight: '800' },
  holdPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.warningLight,
    borderRadius: 8,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: colors.warningBorder,
  },
  holdPillText: {
    color: colors.warning,
    fontSize: 12,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.dangerLight,
    borderWidth: 1,
    borderColor: colors.dangerBorder,
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
  },
  errorBannerText: { flex: 1, color: colors.danger, fontSize: 13, fontWeight: '700' },
  savedVehicleRow: { gap: 10, paddingBottom: 4 },
  savedVehicleCard: {
    width: 140,
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    overflow: 'hidden',
    ...theme.elevation.card,
  },
  savedVehicleCardActive: {
    borderColor: colors.primary,
    borderWidth: 2,
    backgroundColor: colors.primaryLight,
  },
  savedVehicleInner: {
    padding: 12,
    alignItems: 'center',
    gap: 6,
    minHeight: 96,
    justifyContent: 'center',
  },
  savedVehiclePlate: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.navy,
    fontVariant: ['tabular-nums'],
  },
  savedVehiclePlateActive: { color: colors.primary },
  savedVehicleSub: { fontSize: 11, color: colors.textMuted, fontWeight: '600' },
  successContainer: { flexGrow: 1, paddingHorizontal: 22, justifyContent: 'center' },
  successInner: { alignItems: 'center', width: '100%' },
  successBadge: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: colors.successLight,
    borderWidth: 1,
    borderColor: colors.successBorder,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 14,
  },
  successTitle: { fontSize: 26, fontWeight: '800', color: colors.navy, marginBottom: 6, width: '100%', textAlign: 'center' },
  successSubtitle: {
    width: '100%',
    fontSize: 14,
    color: colors.textMuted,
    textAlign: 'center',
    paddingHorizontal: 8,
    marginBottom: 4,
    lineHeight: 21,
  },
  successSpaceName: {
    width: '100%',
    fontSize: 15.5,
    fontWeight: '800',
    color: colors.navy,
    textAlign: 'center',
    paddingHorizontal: 8,
    marginBottom: 18,
    lineHeight: 22,
  },
  qrCard: {
    backgroundColor: colors.surface,
    borderRadius: 18,
    padding: 20,
    alignItems: 'center',
    marginBottom: 18,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    width: '100%',
    ...theme.elevation.card,
  },
  qrCardHeader: {
    color: colors.textMuted,
    fontSize: 11.5,
    fontWeight: '800',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 12,
  },
  qrSvgWrap: {
    padding: 8,
    backgroundColor: colors.white,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  qrTokenText: {
    marginTop: 12,
    fontSize: 12.5,
    fontWeight: '800',
    color: colors.navy,
    fontVariant: ['tabular-nums'],
    letterSpacing: 1,
  },
  successCard: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    width: '100%',
    marginBottom: 20,
    gap: 10,
  },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 },
  successCardLabel: { fontSize: 13, color: colors.textMuted, fontWeight: '600' },
  successCardValue: { fontSize: 15, fontWeight: '800', color: colors.navy },
  successBtn: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    marginBottom: 8,
    width: '100%',
    overflow: 'hidden',
  },
  successBtnContent: { minHeight: 50, alignItems: 'center', justifyContent: 'center' },
  successBtnText: { color: colors.white, fontSize: 16, fontWeight: '800' },
  backHomeBtn: { width: '100%', borderRadius: 10, overflow: 'hidden' },
  backHomeContent: { minHeight: 48, alignItems: 'center', justifyContent: 'center' },
  linkText: { color: colors.navy, fontSize: 14, fontWeight: '700' },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 20,
    gap: 6,
    ...theme.elevation.card,
  },
  cardTitle: { fontSize: 16.5, fontWeight: '800', color: colors.navy },
  row: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  cardDetail: { color: colors.textMuted, fontSize: 13, fontWeight: '500' },
  section: { marginBottom: 22 },
  sectionTitle: {
    fontSize: 11.5,
    fontWeight: '800',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 10,
  },
  formGroup: { marginBottom: 14 },
  label: { fontSize: 13, fontWeight: '700', color: colors.textSecondary, marginBottom: 8 },
  input: {
    backgroundColor: colors.surface,
    borderRadius: 10,
    paddingHorizontal: 14,
    minHeight: 48,
    color: colors.navy,
    fontSize: 15.5,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
    borderWidth: 1,
    borderColor: colors.borderStrong,
  },
  vehicleTypes: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  typeChip: {
    borderRadius: 10,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    overflow: 'hidden',
  },
  typeChipContent: {
    paddingHorizontal: 12,
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  typeChipActive: { backgroundColor: colors.navy, borderColor: colors.navy },
  typeText: { color: colors.textSecondary, fontSize: 13, fontWeight: '700' },
  typeTextActive: { color: colors.white },
  summaryCard: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 10,
    ...theme.elevation.card,
  },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  summaryLabel: { color: colors.textMuted, fontSize: 13.5, fontWeight: '500' },
  summaryVal: { color: colors.navy, fontSize: 14, fontWeight: '700', fontVariant: ['tabular-nums'] },
  totalRow: { borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 10 },
  totalLabel: { color: colors.navy, fontSize: 15.5, fontWeight: '800' },
  totalVal: { color: colors.primary, fontSize: 20, fontWeight: '800', fontVariant: ['tabular-nums'] },
  paymentMethods: { marginTop: 16, gap: 8 },
  paymentOption: {
    backgroundColor: colors.surface,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    overflow: 'hidden',
  },
  paymentOptionActive: {
    borderWidth: 1.5,
    borderColor: colors.navy,
  },
  paymentOptionContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    minHeight: 54,
  },
  paymentText: { color: colors.navy, fontSize: 14, fontWeight: '700', flex: 1 },
  paymentSub: { color: colors.textMuted, fontSize: 12, fontWeight: '600', fontVariant: ['tabular-nums'] },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingHorizontal: 16,
    paddingTop: 12,
    gap: 8,
  },
  confirmBtn: { backgroundColor: colors.primary, borderRadius: 12, overflow: 'hidden' },
  confirmBtnContent: { minHeight: 52, alignItems: 'center', justifyContent: 'center' },
  btnDisabled: { opacity: 0.65 },
  confirmBtnText: { color: colors.white, fontSize: 16, fontWeight: '800', fontVariant: ['tabular-nums'] },
  disclaimer: { color: colors.textMuted, fontSize: 11, textAlign: 'center' },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(11, 22, 40, 0.56)',
    justifyContent: 'flex-end',
  },
  upiSheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    gap: 14,
    ...theme.elevation.sheet,
  },
  sheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  sheetEyebrow: {
    fontSize: 10.5,
    fontWeight: '800',
    color: colors.textMuted,
    letterSpacing: 1,
    marginBottom: 4,
  },
  sheetTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.navy,
    fontVariant: ['tabular-nums'],
  },
  sheetHoldBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.warningLight,
    borderColor: colors.warningBorder,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  sheetHoldText: {
    color: colors.warning,
    fontSize: 12.5,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  sheetSummaryBox: {
    backgroundColor: colors.cardElevated,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    gap: 8,
  },
  sheetDetailVal: {
    color: colors.navy,
    fontSize: 13.5,
    fontWeight: '700',
    maxWidth: '60%',
    textAlign: 'right',
  },
  failSimBtn: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.dangerBorder,
    backgroundColor: colors.dangerLight,
    overflow: 'hidden',
  },
  failSimText: {
    color: colors.danger,
    fontSize: 13.5,
    fontWeight: '700',
  },
});
