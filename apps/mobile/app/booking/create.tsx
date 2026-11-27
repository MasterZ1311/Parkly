import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  TextInput,
  Image,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { IS_DEMO_MODE, authApi, bookingApi, paymentApi } from '../../src/api/client';
import { cacheGet, cacheSet, CACHE_KEYS } from '../../src/utils/cache';
import { useAuthStore } from '../../src/store/auth.store';
import { colors } from '../../src/constants/theme';

interface SavedVehicle {
  id: string;
  licensePlate: string;
  vehicleType: 'motorcycle' | 'compact' | 'sedan' | 'suv' | 'van' | 'truck';
}

const INDIAN_PLATE_REGEX = /^[A-Z]{2}[0-9]{1,2}[A-Z]{1,3}[0-9]{4}$/;

export default function BookingCreateScreen() {
  const { spaceId, spaceName, hostId, hours, totalAmount, hourlyRate } = useLocalSearchParams<{
    spaceId: string;
    spaceName: string;
    hostId?: string;
    hours: string;
    totalAmount: string;
    hourlyRate: string;
  }>();

  const { isAuthenticated } = useAuthStore();
  const [savedVehicles, setSavedVehicles] = useState<SavedVehicle[]>([]);
  const [selectedVehicleId, setSelectedVehicleId] = useState<string | null>(null);
  const [vehiclePlate, setVehiclePlate] = useState('');
  const [vehicleType, setVehicleType] = useState<'motorcycle' | 'compact' | 'sedan' | 'suv'>('sedan');
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<'details' | 'success'>('details');
  const [confirmedBookingId, setConfirmedBookingId] = useState<string>('');
  const [confirmedQrToken, setConfirmedQrToken] = useState<string>('');
  const [finalAmountPaid, setFinalAmountPaid] = useState<number>(0);

  const parsedHours = Math.max(1, Number(hours || 2));
  const baseCost = Number(totalAmount || Number(hourlyRate || 40) * parsedHours);
  const feeAmount = Math.round(baseCost * 0.05);
  const grandTotal = baseCost + feeAmount;

  useEffect(() => {
    if (!isAuthenticated) return;
    authApi
      .listVehicles()
      .then((res) => {
        const list: SavedVehicle[] = res.data?.data?.vehicles || [];
        setSavedVehicles(list);
        if (list.length > 0) {
          const def = list[0]!;
          setSelectedVehicleId(def.id);
          setVehiclePlate(def.licensePlate);
          if (['motorcycle', 'compact', 'sedan', 'suv'].includes(def.vehicleType)) {
            setVehicleType(def.vehicleType as 'motorcycle' | 'compact' | 'sedan' | 'suv');
          }
        }
      })
      .catch(() => {});
  }, [isAuthenticated]);

  const handleSelectSavedVehicle = (v: SavedVehicle) => {
    setSelectedVehicleId(v.id);
    setVehiclePlate(v.licensePlate);
    if (['motorcycle', 'compact', 'sedan', 'suv'].includes(v.vehicleType)) {
      setVehicleType(v.vehicleType as 'motorcycle' | 'compact' | 'sedan' | 'suv');
    }
  };

  const resolveOrRegisterVehicle = async (cleanedPlate: string): Promise<string> => {
    const existing = savedVehicles.find((v) => v.licensePlate === cleanedPlate);
    if (existing) return existing.id;

    try {
      const listRes = await authApi.listVehicles();
      const freshList: SavedVehicle[] = listRes.data?.data?.vehicles || [];
      setSavedVehicles(freshList);
      const match = freshList.find((v) => v.licensePlate === cleanedPlate);
      if (match) return match.id;
    } catch {
      // Proceed to creation if listing failed
    }

    const createRes = await authApi.addVehicle({
      licensePlate: cleanedPlate,
      vehicleType,
      isDefault: savedVehicles.length === 0,
    });
    const created: SavedVehicle | undefined = createRes.data?.data?.vehicle;
    if (!created?.id) {
      throw new Error('Could not register vehicle for booking');
    }
    setSavedVehicles((prev) => [created, ...prev]);
    return created.id;
  };

  const handleConfirmBooking = async () => {
    const cleanedPlate = vehiclePlate.trim().toUpperCase().replace(/\s+/g, '');
    if (!cleanedPlate) {
      Alert.alert('Missing Info', 'Please enter your vehicle license plate.');
      return;
    }

    if (!INDIAN_PLATE_REGEX.test(cleanedPlate)) {
      Alert.alert(
        'Invalid License Plate',
        'Please enter a valid Indian vehicle registration number (e.g. TN01AB1234, TN09C5678).',
      );
      return;
    }

    if (!isAuthenticated && !IS_DEMO_MODE) {
      Alert.alert('Sign In Required', 'Please sign in with your mobile number to confirm your reservation.', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Sign In', onPress: () => router.push('/(auth)/login') },
      ]);
      return;
    }

    setLoading(true);
    try {
      const startTime = new Date().toISOString();
      const endTime = new Date(Date.now() + parsedHours * 3600000).toISOString();

      const resolvedVehicleId =
        selectedVehicleId && savedVehicles.some((v) => v.id === selectedVehicleId && v.licensePlate === cleanedPlate)
          ? selectedVehicleId
          : await resolveOrRegisterVehicle(cleanedPlate);

      const { data: bookingResp } = await bookingApi.create({
        spaceId: spaceId!,
        vehicleId: resolvedVehicleId,
        hostId: hostId || 'host-chennai-001',
        type: 'instant',
        startTime,
        endTime,
        totalAmount: grandTotal,
      });

      const createdBooking = bookingResp?.data?.booking || bookingResp?.data;
      const bookingId: string = createdBooking?.id;
      if (!bookingId) {
        throw new Error('Booking confirmation missing reservation ID');
      }
      const serverAmount = Number(createdBooking.totalAmount) || grandTotal;
      const qrToken = createdBooking.qrToken || `PARKLY:${bookingId}:${cleanedPlate}`;

      // Initiate & confirm payment when provider order is created
      try {
        const payRes = await paymentApi.initiate(bookingId, serverAmount);
        const payment = payRes.data?.data?.payment;
        if (payment?.id && payment.providerOrderId) {
          await paymentApi.confirm(payment.id, `pay_app_${Date.now()}`, 'verified-client-intent');
        }
      } catch (payErr) {
        console.warn('Payment confirmation step warning:', payErr);
      }

      setConfirmedBookingId(bookingId);
      setConfirmedQrToken(qrToken);
      setFinalAmountPaid(serverAmount);

      const cachedRecord = {
        ...createdBooking,
        id: bookingId,
        spaceId: spaceId!,
        spaceName,
        vehiclePlate: cleanedPlate,
        qrToken,
        status: 'confirmed',
        startTime: createdBooking.startTime || startTime,
        endTime: createdBooking.endTime || endTime,
        totalAmount: serverAmount,
        type: 'instant',
      };
      const currentCached = (await cacheGet<any[]>(CACHE_KEYS.RECENT_BOOKINGS)) || [];
      await cacheSet(CACHE_KEYS.RECENT_BOOKINGS, [
        cachedRecord,
        ...currentCached.filter((b) => b.id !== bookingId),
      ]);

      setStep('success');
    } catch (err: any) {
      if (IS_DEMO_MODE) {
        const demoBookingId = `bk-demo-${Date.now().toString(36)}`;
        const qrToken = `PARKLY:${demoBookingId}:${cleanedPlate}`;
        setConfirmedBookingId(demoBookingId);
        setConfirmedQrToken(qrToken);
        setFinalAmountPaid(grandTotal);
        const currentCached = (await cacheGet<any[]>(CACHE_KEYS.RECENT_BOOKINGS)) || [];
        await cacheSet(CACHE_KEYS.RECENT_BOOKINGS, [
          {
            id: demoBookingId,
            spaceId: spaceId || 'sp-tng-001',
            spaceName: spaceName || 'Parkly Space',
            vehiclePlate: cleanedPlate,
            qrToken,
            status: 'confirmed',
            startTime: new Date().toISOString(),
            endTime: new Date(Date.now() + parsedHours * 3600000).toISOString(),
            totalAmount: grandTotal,
            type: 'instant',
          },
          ...currentCached.filter((b) => b.id !== demoBookingId),
        ]);
        setStep('success');
        return;
      }

      const apiMessage =
        err?.response?.data?.error?.message || err?.message || 'Unable to complete booking right now.';
      Alert.alert('Booking Failed', apiMessage);
    } finally {
      setLoading(false);
    }
  };

  if (step === 'success') {
    const qrPayload = encodeURIComponent(confirmedQrToken || `PARKLY:${confirmedBookingId}:${vehiclePlate.toUpperCase()}`);
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${qrPayload}`;

    return (
      <View style={styles.successContainer}>
        <View style={styles.successIcon}>
          <Ionicons name="checkmark-circle" size={72} color={colors.success} />
        </View>
        <Text style={styles.successTitle}>Booking Confirmed!</Text>
        <Text style={styles.successSubtitle}>
          Your parking spot is ready at{'\n'}
          <Text style={{ fontWeight: '700', color: colors.primary }}>{spaceName}</Text>
        </Text>

        {/* QR Entry Pass */}
        <View style={styles.qrCard}>
          <Text style={styles.qrCardHeader}>Scan at Entry Gate</Text>
          <Image source={{ uri: qrUrl }} style={styles.qrImage} resizeMode="contain" />
          <Text style={styles.qrTokenText}>#{confirmedBookingId.slice(-10).toUpperCase()}</Text>
        </View>

        <View style={styles.successCard}>
          <View style={styles.detailRow}>
            <Text style={styles.successCardLabel}>Vehicle Plate</Text>
            <Text style={styles.successCardValue}>{vehiclePlate.toUpperCase()}</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.successCardLabel}>Duration</Text>
            <Text style={styles.successCardValue}>{parsedHours} hours</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.successCardLabel}>Total Paid</Text>
            <Text style={[styles.successCardValue, { color: colors.success }]}>
              ₹{finalAmountPaid || grandTotal}
            </Text>
          </View>
        </View>

        <TouchableOpacity style={styles.successBtn} onPress={() => router.replace('/(tabs)/bookings')}>
          <Text style={styles.successBtnText}>View My Bookings</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => router.replace('/(tabs)/home')}>
          <Text style={styles.linkText}>Back to Home</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 20, paddingBottom: 130 }}>
        {/* Header */}
        <View style={styles.bookingHeader}>
          <TouchableOpacity onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color={colors.primary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Confirm Booking</Text>
          <View style={{ width: 24 }} />
        </View>

        {/* Spot Summary */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>{spaceName}</Text>
          <View style={styles.row}>
            <Ionicons name="time-outline" size={16} color={colors.textMuted} />
            <Text style={styles.cardDetail}>Duration: {parsedHours} hours</Text>
          </View>
          <View style={styles.row}>
            <Ionicons name="car-outline" size={16} color={colors.textMuted} />
            <Text style={styles.cardDetail}>Starts now — ends in {parsedHours}h</Text>
          </View>
        </View>

        {/* Vehicle Details */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Vehicle Details</Text>

          {savedVehicles.length > 0 && (
            <View style={{ marginBottom: 12 }}>
              <Text style={styles.label}>Saved Vehicles</Text>
              <View style={styles.vehicleTypes}>
                {savedVehicles.map((v) => {
                  const active = selectedVehicleId === v.id;
                  return (
                    <TouchableOpacity
                      key={v.id}
                      style={[styles.typeChip, active && styles.typeChipActive]}
                      onPress={() => handleSelectSavedVehicle(v)}
                    >
                      <Text style={[styles.typeText, active && styles.typeTextActive]}>
                        {v.licensePlate}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          )}

          <View style={styles.formGroup}>
            <Text style={styles.label}>License Plate</Text>
            <TextInput
              style={styles.input}
              value={vehiclePlate}
              onChangeText={(txt) => {
                setVehiclePlate(txt);
                setSelectedVehicleId(null);
              }}
              placeholder="TN01AB1234"
              placeholderTextColor={colors.textMuted}
              autoCapitalize="characters"
              maxLength={12}
            />
          </View>

          <Text style={styles.label}>Vehicle Type</Text>
          <View style={styles.vehicleTypes}>
            {(['motorcycle', 'compact', 'sedan', 'suv'] as const).map((type) => (
              <TouchableOpacity
                key={type}
                style={[styles.typeChip, vehicleType === type && styles.typeChipActive]}
                onPress={() => setVehicleType(type)}
              >
                <Text style={[styles.typeText, vehicleType === type && styles.typeTextActive]}>
                  {type.charAt(0).toUpperCase() + type.slice(1)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Payment */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Payment Summary</Text>
          <View style={styles.summaryCard}>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>
                Parking (₹{hourlyRate} × {parsedHours}h)
              </Text>
              <Text style={styles.summaryVal}>₹{baseCost}</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Platform fee (5%)</Text>
              <Text style={styles.summaryVal}>₹{feeAmount}</Text>
            </View>
            <View style={[styles.summaryRow, styles.totalRow]}>
              <Text style={styles.totalLabel}>Total</Text>
              <Text style={styles.totalVal}>₹{grandTotal}</Text>
            </View>
          </View>

          <View style={styles.paymentMethods}>
            <Text style={styles.label}>Payment Method</Text>
            <View style={styles.paymentOption}>
              <Ionicons name="phone-portrait" size={20} color={colors.primary} />
              <Text style={styles.paymentText}>UPI / Mobile Wallet (Razorpay)</Text>
              <Ionicons name="radio-button-on" size={20} color={colors.primary} />
            </View>
          </View>
        </View>
      </ScrollView>

      {/* Confirm Button */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.confirmBtn, loading && styles.btnDisabled]}
          onPress={handleConfirmBooking}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color={colors.white} />
          ) : (
            <Text style={styles.confirmBtnText}>Confirm & Pay ₹{grandTotal}</Text>
          )}
        </TouchableOpacity>
        <Text style={styles.disclaimer}>By booking, you agree to the Parkly Terms of Service.</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  successContainer: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  successIcon: { marginBottom: 24 },
  successTitle: { fontSize: 26, fontWeight: '800', color: colors.text, marginBottom: 12, textAlign: 'center' },
  successSubtitle: { fontSize: 15, color: colors.textSecondary, textAlign: 'center', lineHeight: 22, marginBottom: 20 },
  qrCard: {
    backgroundColor: colors.white,
    borderRadius: 20,
    padding: 16,
    alignItems: 'center',
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  qrCardHeader: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textMuted,
    textTransform: 'uppercase',
    marginBottom: 8,
    letterSpacing: 0.5,
  },
  qrImage: { width: 160, height: 160, backgroundColor: colors.white },
  qrTokenText: { fontSize: 13, fontWeight: '700', color: colors.navy, marginTop: 8, fontFamily: 'monospace' },
  successCard: { backgroundColor: colors.card, borderRadius: 16, padding: 18, width: '100%', marginBottom: 20, gap: 10 },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  successCardLabel: { fontSize: 13, color: colors.textMuted },
  successCardValue: { fontSize: 15, fontWeight: '700', color: colors.text },
  successBtn: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 32,
    marginBottom: 12,
    width: '100%',
    alignItems: 'center',
  },
  successBtnText: { color: colors.white, fontSize: 16, fontWeight: '700' },
  linkText: { color: colors.textMuted, fontSize: 14 },
  bookingHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
  headerTitle: { fontSize: 18, fontWeight: '700', color: colors.text },
  card: {
    backgroundColor: colors.card,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 20,
    gap: 8,
  },
  cardTitle: { fontSize: 16, fontWeight: '700', color: colors.text, marginBottom: 4 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  cardDetail: { color: colors.textSecondary, fontSize: 13 },
  section: { marginBottom: 24 },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 12,
  },
  formGroup: { marginBottom: 12 },
  label: { fontSize: 13, fontWeight: '600', color: colors.textSecondary, marginBottom: 8 },
  input: {
    backgroundColor: colors.card,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: colors.text,
    fontSize: 14,
    borderWidth: 1,
    borderColor: colors.border,
  },
  vehicleTypes: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  typeChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  typeChipActive: { backgroundColor: colors.primaryLight, borderColor: colors.primary },
  typeText: { color: colors.textMuted, fontSize: 13, fontWeight: '600' },
  typeTextActive: { color: colors.primary },
  summaryCard: {
    backgroundColor: colors.card,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 10,
  },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between' },
  summaryLabel: { color: colors.textSecondary, fontSize: 14 },
  summaryVal: { color: colors.text, fontSize: 14, fontWeight: '600' },
  totalRow: { borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 10 },
  totalLabel: { color: colors.text, fontSize: 16, fontWeight: '700' },
  totalVal: { color: colors.primary, fontSize: 18, fontWeight: '800' },
  paymentMethods: { marginTop: 16 },
  paymentOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.primaryLight,
    borderRadius: 10,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  paymentText: { flex: 1, color: colors.text, fontSize: 14, fontWeight: '500' },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: colors.background,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    padding: 16,
    paddingBottom: 32,
    gap: 8,
  },
  confirmBtn: { backgroundColor: colors.primary, borderRadius: 14, paddingVertical: 16, alignItems: 'center' },
  btnDisabled: { opacity: 0.7 },
  confirmBtnText: { color: colors.white, fontSize: 16, fontWeight: '800' },
  disclaimer: { color: colors.textMuted, fontSize: 11, textAlign: 'center' },
});
