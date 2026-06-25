import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  TextInput,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { bookingApi, paymentApi } from '../../src/api/client';

export default function BookingCreateScreen() {
  const { spaceId, spaceName, hours, totalAmount, hourlyRate } = useLocalSearchParams<{
    spaceId: string;
    spaceName: string;
    hours: string;
    totalAmount: string;
    hourlyRate: string;
  }>();

  const [vehiclePlate, setVehiclePlate] = useState('');
  const [vehicleType, setVehicleType] = useState<'motorcycle' | 'compact' | 'sedan' | 'suv'>('sedan');
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<'details' | 'payment' | 'success'>('details');

  const feeAmount = Math.round(Number(totalAmount) * 0.05);
  const grandTotal = Number(totalAmount) + feeAmount;

  const handleConfirmBooking = async () => {
    if (!vehiclePlate.trim()) {
      Alert.alert('Missing Info', 'Please enter your vehicle license plate.');
      return;
    }

    setLoading(true);
    try {
      const startTime = new Date().toISOString();
      const endTime = new Date(Date.now() + Number(hours) * 3600000).toISOString();

      // Step 1: Create booking
      const { data: bookingResp } = await bookingApi.create({
        spaceId: spaceId!,
        vehicleId: 'mock-vehicle-id', // In production, from user's saved vehicles
        hostId: 'mock-host-id',
        type: 'instant',
        startTime,
        endTime,
        totalAmount: grandTotal,
      });

      const bookingId = bookingResp.data.booking.id;

      // Step 2: Initiate payment (mock provider)
      await paymentApi.initiate(bookingId, grandTotal);

      setStep('success');
    } catch (err: any) {
      Alert.alert('Booking Failed', err.response?.data?.error?.message || 'Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (step === 'success') {
    return (
      <View style={styles.successContainer}>
        <View style={styles.successIcon}>
          <Ionicons name="checkmark-circle" size={80} color="#22C55E" />
        </View>
        <Text style={styles.successTitle}>Booking Confirmed! 🎉</Text>
        <Text style={styles.successSubtitle}>
          Your parking spot has been reserved at{'\n'}
          <Text style={{ fontWeight: '700', color: '#38BDF8' }}>{spaceName}</Text>
        </Text>
        <View style={styles.successCard}>
          <Text style={styles.successCardLabel}>Duration</Text>
          <Text style={styles.successCardValue}>{hours} hours</Text>
          <Text style={styles.successCardLabel}>Total Paid</Text>
          <Text style={[styles.successCardValue, { color: '#38BDF8' }]}>₹{grandTotal}</Text>
        </View>
        <TouchableOpacity
          style={styles.successBtn}
          onPress={() => router.replace('/(tabs)/bookings')}
        >
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
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 20, paddingBottom: 120 }}>
        {/* Header */}
        <View style={styles.bookingHeader}>
          <TouchableOpacity onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color="#38BDF8" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Confirm Booking</Text>
          <View style={{ width: 24 }} />
        </View>

        {/* Spot Summary */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>{spaceName}</Text>
          <View style={styles.row}>
            <Ionicons name="time-outline" size={16} color="#64748B" />
            <Text style={styles.cardDetail}>Duration: {hours} hours</Text>
          </View>
          <View style={styles.row}>
            <Ionicons name="car-outline" size={16} color="#64748B" />
            <Text style={styles.cardDetail}>Starts now — ends in {hours}h</Text>
          </View>
        </View>

        {/* Vehicle Details */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Vehicle Details</Text>

          <View style={styles.formGroup}>
            <Text style={styles.label}>License Plate</Text>
            <TextInput
              style={styles.input}
              value={vehiclePlate}
              onChangeText={setVehiclePlate}
              placeholder="TN01AB1234"
              placeholderTextColor="#64748B"
              autoCapitalize="characters"
              maxLength={12}
            />
          </View>

          <Text style={styles.label}>Vehicle Type</Text>
          <View style={styles.vehicleTypes}>
            {(['motorcycle', 'compact', 'sedan', 'suv'] as const).map(type => (
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
              <Text style={styles.summaryLabel}>Parking (₹{hourlyRate} × {hours}h)</Text>
              <Text style={styles.summaryVal}>₹{totalAmount}</Text>
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
              <Ionicons name="phone-portrait" size={20} color="#38BDF8" />
              <Text style={styles.paymentText}>UPI / Mobile Wallet</Text>
              <Ionicons name="radio-button-on" size={20} color="#38BDF8" />
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
            <ActivityIndicator color="#0F172A" />
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
  container: { flex: 1, backgroundColor: '#0F172A' },
  successContainer: { flex: 1, backgroundColor: '#0F172A', alignItems: 'center', justifyContent: 'center', padding: 32 },
  successIcon: { marginBottom: 24 },
  successTitle: { fontSize: 26, fontWeight: '800', color: '#F8FAFC', marginBottom: 12, textAlign: 'center' },
  successSubtitle: { fontSize: 15, color: '#94A3B8', textAlign: 'center', lineHeight: 22, marginBottom: 24 },
  successCard: { backgroundColor: '#1E293B', borderRadius: 16, padding: 20, width: '100%', marginBottom: 24, gap: 8 },
  successCardLabel: { fontSize: 12, color: '#64748B', textTransform: 'uppercase', letterSpacing: 0.8 },
  successCardValue: { fontSize: 20, fontWeight: '700', color: '#F8FAFC', marginBottom: 8 },
  successBtn: { backgroundColor: '#38BDF8', borderRadius: 12, paddingVertical: 14, paddingHorizontal: 32, marginBottom: 12 },
  successBtnText: { color: '#0F172A', fontSize: 16, fontWeight: '700' },
  linkText: { color: '#64748B', fontSize: 14 },
  bookingHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#F8FAFC' },
  card: {
    backgroundColor: '#1E293B',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#334155',
    marginBottom: 20,
    gap: 8,
  },
  cardTitle: { fontSize: 16, fontWeight: '700', color: '#F8FAFC', marginBottom: 4 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  cardDetail: { color: '#94A3B8', fontSize: 13 },
  section: { marginBottom: 24 },
  sectionTitle: { fontSize: 12, fontWeight: '700', color: '#64748B', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 12 },
  formGroup: { marginBottom: 12 },
  label: { fontSize: 13, fontWeight: '600', color: '#CBD5E1', marginBottom: 8 },
  input: {
    backgroundColor: '#1E293B',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: '#F8FAFC',
    fontSize: 14,
    borderWidth: 1,
    borderColor: '#334155',
  },
  vehicleTypes: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  typeChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8, backgroundColor: '#1E293B', borderWidth: 1, borderColor: '#334155' },
  typeChipActive: { backgroundColor: '#38BDF820', borderColor: '#38BDF8' },
  typeText: { color: '#64748B', fontSize: 13, fontWeight: '600' },
  typeTextActive: { color: '#38BDF8' },
  summaryCard: { backgroundColor: '#1E293B', borderRadius: 14, padding: 16, borderWidth: 1, borderColor: '#334155', gap: 10 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between' },
  summaryLabel: { color: '#94A3B8', fontSize: 14 },
  summaryVal: { color: '#F8FAFC', fontSize: 14, fontWeight: '600' },
  totalRow: { borderTopWidth: 1, borderTopColor: '#334155', paddingTop: 10 },
  totalLabel: { color: '#F8FAFC', fontSize: 16, fontWeight: '700' },
  totalVal: { color: '#38BDF8', fontSize: 18, fontWeight: '800' },
  paymentMethods: { marginTop: 16 },
  paymentOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#38BDF820',
    borderRadius: 10,
    padding: 14,
    borderWidth: 1,
    borderColor: '#38BDF8',
  },
  paymentText: { flex: 1, color: '#F8FAFC', fontSize: 14, fontWeight: '500' },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#0F172A',
    borderTopWidth: 1,
    borderTopColor: '#1E293B',
    padding: 16,
    paddingBottom: 32,
    gap: 8,
  },
  confirmBtn: { backgroundColor: '#38BDF8', borderRadius: 14, paddingVertical: 16, alignItems: 'center' },
  btnDisabled: { opacity: 0.7 },
  confirmBtnText: { color: '#0F172A', fontSize: 16, fontWeight: '800' },
  disclaimer: { color: '#475569', fontSize: 11, textAlign: 'center' },
});
