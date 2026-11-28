import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { GovIdType } from '../../src/api/client';
import { useAuthStore } from '../../src/store/auth.store';
import { useDriverStore } from '../../src/store/driver.store';
import { useKycStore } from '../../src/store/kyc.store';
import { colors, theme } from '../../src/constants/theme';
import { ENTER_FADE_UP, PressScale, triggerHaptic } from '../../src/components/Motion';
import { DocumentPickerField } from '../../src/components/DocumentPickerField';
import { classifyApiError } from '../../src/utils/apiErrors';

const INDIAN_PLATE_REGEX = /^[A-Z]{2}[0-9]{1,2}[A-Z]{1,3}[0-9]{4}$/;

const GOV_ID_OPTIONS: Array<{ value: GovIdType; label: string; hint: string }> = [
  { value: 'aadhaar', label: 'Aadhaar', hint: '12-digit Aadhaar No.' },
  { value: 'pan', label: 'PAN Card', hint: '10-char PAN (ABCDE1234F)' },
  { value: 'passport', label: 'Passport', hint: 'Passport File/No.' },
  { value: 'voter_id', label: 'Voter ID', hint: 'EPIC No.' },
];

export default function DriverKycScreen() {
  const user = useAuthStore((s) => s.user);
  const isDemoMode = useAuthStore((s) => s.isDemoMode);
  const vehicles = useDriverStore((s) => s.vehicles);
  const loadVehicles = useDriverStore((s) => s.loadVehicles);
  const { driverKyc, saving, loadKycs, submitDriverKyc } = useKycStore();
  const insets = useSafeAreaInsets();

  const defaultVehicle = vehicles.find((v) => v.isDefault) || vehicles[0];

  const [fullName, setFullName] = useState(user?.name?.replace(' (Demo)', '') || '');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [address, setAddress] = useState('');
  const [emergencyContact, setEmergencyContact] = useState('');
  const [dlNumber, setDlNumber] = useState('');
  const [dlExpiry, setDlExpiry] = useState('');
  const [dlFrontUrl, setDlFrontUrl] = useState<string | undefined>();
  const [dlBackUrl, setDlBackUrl] = useState<string | undefined>();
  const [govIdType, setGovIdType] = useState<GovIdType>('aadhaar');
  const [govIdNumber, setGovIdNumber] = useState('');
  const [govIdUrl, setGovIdUrl] = useState<string | undefined>();
  const [vehiclePlate, setVehiclePlate] = useState(defaultVehicle?.licensePlate || 'TN01AB1234');
  const [rcNumber, setRcNumber] = useState(defaultVehicle?.rcNumber || '');
  const [rcDocUrl, setRcDocUrl] = useState<string | undefined>();
  const [insuranceUrl, setInsuranceUrl] = useState<string | undefined>();
  const [selfieUrl, setSelfieUrl] = useState<string | undefined>();

  useFocusEffect(
    useCallback(() => {
      loadVehicles().catch(() => {});
      loadKycs().catch(() => {});
    }, [loadVehicles, loadKycs]),
  );

  useEffect(() => {
    if (driverKyc) {
      setFullName(driverKyc.fullName);
      setDateOfBirth(driverKyc.dateOfBirth || '');
      setAddress(driverKyc.address || '');
      setEmergencyContact(driverKyc.emergencyContact || '');
      setDlNumber(driverKyc.drivingLicenseNumber);
      setDlExpiry(driverKyc.drivingLicenseExpiry || '');
      setDlFrontUrl(driverKyc.drivingLicenseFrontUrl);
      setDlBackUrl(driverKyc.drivingLicenseBackUrl);
      setGovIdType(driverKyc.govIdType);
      setGovIdNumber(driverKyc.govIdNumberMasked);
      setGovIdUrl(driverKyc.govIdDocumentUrl);
      setVehiclePlate(driverKyc.vehiclePlate);
      setRcNumber(driverKyc.rcNumber);
      setRcDocUrl(driverKyc.rcDocumentUrl);
      setInsuranceUrl(driverKyc.insuranceDocumentUrl);
      setSelfieUrl(driverKyc.selfieUrl);
    } else if (defaultVehicle && !vehiclePlate) {
      setVehiclePlate(defaultVehicle.licensePlate);
    }
  }, [driverKyc, defaultVehicle, vehiclePlate]);

  const handleSubmit = async () => {
    const cleanName = fullName.trim();
    const cleanDl = dlNumber.trim().toUpperCase().replace(/\s+/g, '');
    const cleanPlate = vehiclePlate.trim().toUpperCase().replace(/\s+/g, '');
    const cleanRc = rcNumber.trim().toUpperCase().replace(/\s+/g, '');
    const cleanGov = govIdNumber.trim();

    if (cleanName.length < 2) {
      Alert.alert('Missing Full Name', 'Enter your legal name matching your Driving Licence & RC.');
      return;
    }
    if (cleanDl.length < 6) {
      Alert.alert('Invalid Driving Licence', 'Enter your valid Driving Licence number (e.g. TN0120190012345).');
      return;
    }
    if (!dlFrontUrl) {
      Alert.alert('Driving Licence Photo Needed', 'Upload the front photo/scan of your Driving Licence.');
      return;
    }
    if (!INDIAN_PLATE_REGEX.test(cleanPlate)) {
      Alert.alert('Invalid Vehicle Registration', 'Enter a valid registration plate (e.g. TN01AB1234).');
      return;
    }
    if (cleanRc.length < 4) {
      Alert.alert('RC Book Number Needed', 'Enter your Vehicle Registration Certificate (RC) number.');
      return;
    }
    if (!rcDocUrl) {
      Alert.alert('RC Book Photo Needed', 'Upload a photo/scan of your vehicle RC Book.');
      return;
    }
    if (cleanGov.length < 4 || !govIdUrl) {
      Alert.alert('Government ID Required', 'Enter your Govt ID number and upload an ID scan.');
      return;
    }

    try {
      await submitDriverKyc({
        fullName: cleanName,
        dateOfBirth: dateOfBirth.trim() || undefined,
        address: address.trim() || undefined,
        emergencyContact: emergencyContact.trim() || undefined,
        drivingLicenseNumber: cleanDl,
        drivingLicenseExpiry: dlExpiry.trim() || undefined,
        drivingLicenseFrontUrl: dlFrontUrl,
        drivingLicenseBackUrl: dlBackUrl,
        govIdType,
        govIdNumberMasked: cleanGov,
        govIdDocumentUrl: govIdUrl,
        vehiclePlate: cleanPlate,
        rcNumber: cleanRc,
        rcDocumentUrl: rcDocUrl,
        insuranceDocumentUrl: insuranceUrl,
        selfieUrl,
      });
      triggerHaptic('success');
      Alert.alert(
        isDemoMode ? 'Driver KYC Stored (Demo)' : 'KYC Submitted for Review',
        'Your Driving Licence, Vehicle RC Book, and Govt ID details are saved and queued for Parkly Verification Team review.',
      );
    } catch (err) {
      const classified = classifyApiError(err, 'Could not submit Driver KYC right now.');
      Alert.alert('Submission Failed', classified.message);
    }
  };

  const kycStatus = driverKyc?.status;
  const statusTone =
    kycStatus === 'approved'
      ? { fg: colors.success, bg: colors.successLight, border: colors.successBorder, title: 'Verified Driver KYC' }
      : kycStatus === 'rejected'
        ? { fg: colors.danger, bg: colors.dangerLight, border: colors.dangerBorder, title: 'KYC Resubmission Needed' }
        : kycStatus === 'pending'
          ? { fg: colors.warning, bg: colors.warningLight, border: colors.warningBorder, title: 'Pending Team Review' }
          : { fg: colors.navy, bg: colors.cardElevated, border: colors.borderStrong, title: 'Verification Not Submitted' };

  return (
    <View style={styles.container}>
      <StatusBar style="light" backgroundColor={colors.navy} />

      <View style={[styles.appBar, { paddingTop: Math.max(insets.top + 8, 16) }]}>
        <PressScale
          style={styles.iconBtn}
          contentStyle={styles.iconBtnInner}
          rippleColor={colors.rippleLight}
          onPress={() => router.back()}
          accessibilityLabel="Go back"
        >
          <Ionicons name="arrow-back" size={20} color={colors.white} />
        </PressScale>
        <Text style={styles.appBarTitle}>Driver KYC &amp; RC Verification</Text>
        <View style={{ width: 48 }} />
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[styles.scroll, { paddingBottom: Math.max(insets.bottom + 28, 40) }]}
        >
          <Animated.View entering={ENTER_FADE_UP} style={{ gap: 14 }}>
            <View style={[styles.statusCard, { backgroundColor: statusTone.bg, borderColor: statusTone.border }]}>
              <Ionicons
                name={kycStatus === 'approved' ? 'shield-checkmark' : 'document-text-outline'}
                size={22}
                color={statusTone.fg}
              />
              <View style={{ flex: 1 }}>
                <Text style={[styles.statusTitle, { color: statusTone.fg }]}>{statusTone.title}</Text>
                <Text style={styles.statusBody}>
                  {driverKyc?.reviewNotes ||
                    'Submit your Driving Licence, Vehicle Reg. No., RC Book, and Govt ID. The Parkly review team verifies documents before instant barrier access.'}
                </Text>
              </View>
            </View>

            {/* Section 1: Driver Identity */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>1. Driver Identity Details</Text>
              <Text style={styles.inputLabel}>Full Legal Name (as on Driving Licence) *</Text>
              <TextInput
                style={styles.input}
                value={fullName}
                onChangeText={setFullName}
                placeholder="Arjun Kumar"
                placeholderTextColor={colors.textMuted}
              />

              <View style={styles.row2}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.inputLabel}>Date of Birth</Text>
                  <TextInput
                    style={styles.input}
                    value={dateOfBirth}
                    onChangeText={setDateOfBirth}
                    placeholder="DD/MM/YYYY"
                    placeholderTextColor={colors.textMuted}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.inputLabel}>Emergency Phone</Text>
                  <TextInput
                    style={styles.input}
                    value={emergencyContact}
                    onChangeText={setEmergencyContact}
                    placeholder="+91 98400 00000"
                    placeholderTextColor={colors.textMuted}
                    keyboardType="phone-pad"
                  />
                </View>
              </View>

              <Text style={styles.inputLabel}>Residential Address</Text>
              <TextInput
                style={styles.input}
                value={address}
                onChangeText={setAddress}
                placeholder="Street, Locality, City & Pincode"
                placeholderTextColor={colors.textMuted}
              />
            </View>

            {/* Section 2: Driving Licence */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>2. Driving Licence (DL)</Text>
              <View style={styles.row2}>
                <View style={{ flex: 1.4 }}>
                  <Text style={styles.inputLabel}>Driving Licence No. *</Text>
                  <TextInput
                    style={styles.input}
                    value={dlNumber}
                    onChangeText={setDlNumber}
                    placeholder="TN0120190012345"
                    placeholderTextColor={colors.textMuted}
                    autoCapitalize="characters"
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.inputLabel}>Valid Till</Text>
                  <TextInput
                    style={styles.input}
                    value={dlExpiry}
                    onChangeText={setDlExpiry}
                    placeholder="2036-08-15"
                    placeholderTextColor={colors.textMuted}
                  />
                </View>
              </View>

              <DocumentPickerField
                label="Driving Licence (Front Side)"
                hint="Clear photo showing DL number, photo, and DOB"
                required
                value={dlFrontUrl}
                onChange={setDlFrontUrl}
              />
              <DocumentPickerField
                label="Driving Licence (Back Side)"
                hint="Validity & transport class endorsement"
                value={dlBackUrl}
                onChange={setDlBackUrl}
              />
            </View>

            {/* Section 3: Vehicle Reg & RC Book */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>3. Vehicle Registration &amp; RC Book</Text>
              {vehicles.length > 0 && (
                <View style={styles.chipRow}>
                  {vehicles.map((v) => {
                    const active = vehiclePlate.toUpperCase() === v.licensePlate;
                    return (
                      <PressScale
                        key={v.id}
                        style={[styles.chip, active && styles.chipActive]}
                        contentStyle={styles.chipInner}
                        onPress={() => {
                          setVehiclePlate(v.licensePlate);
                          if (v.rcNumber) setRcNumber(v.rcNumber);
                        }}
                      >
                        <Text style={[styles.chipText, active && styles.chipTextActive]}>
                          {v.licensePlate}
                        </Text>
                      </PressScale>
                    );
                  })}
                </View>
              )}

              <View style={styles.row2}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.inputLabel}>Vehicle Reg. No. *</Text>
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
                <View style={{ flex: 1.2 }}>
                  <Text style={styles.inputLabel}>RC Book / Reg Cert No. *</Text>
                  <TextInput
                    style={styles.input}
                    value={rcNumber}
                    onChangeText={setRcNumber}
                    placeholder="RC-TN01-2022-8410"
                    placeholderTextColor={colors.textMuted}
                    autoCapitalize="characters"
                  />
                </View>
              </View>

              <DocumentPickerField
                label="Vehicle RC Book / Smart Card"
                hint="Front/back scan showing chassis/reg number & owner"
                required
                value={rcDocUrl}
                onChange={setRcDocUrl}
              />
              <DocumentPickerField
                label="Vehicle Insurance / PUC Copy"
                hint="Active third-party or comprehensive motor policy"
                value={insuranceUrl}
                onChange={setInsuranceUrl}
              />
            </View>

            {/* Section 4: Govt ID & Selfie */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>4. Government ID &amp; Selfie</Text>
              <View style={styles.chipRow}>
                {GOV_ID_OPTIONS.map((opt) => {
                  const active = govIdType === opt.value;
                  return (
                    <PressScale
                      key={opt.value}
                      style={[styles.chip, active && styles.chipActive]}
                      contentStyle={styles.chipInner}
                      onPress={() => setGovIdType(opt.value)}
                    >
                      <Text style={[styles.chipText, active && styles.chipTextActive]}>{opt.label}</Text>
                    </PressScale>
                  );
                })}
              </View>

              <Text style={styles.inputLabel}>
                {GOV_ID_OPTIONS.find((o) => o.value === govIdType)?.hint || 'Government ID No.'} *
              </Text>
              <TextInput
                style={styles.input}
                value={govIdNumber}
                onChangeText={setGovIdNumber}
                placeholder="Stored masked (last 4 digits visible)"
                placeholderTextColor={colors.textMuted}
                autoCapitalize="characters"
              />

              <DocumentPickerField
                label="Government ID Scan"
                hint="Aadhaar / PAN / Passport photo page"
                required
                value={govIdUrl}
                onChange={setGovIdUrl}
              />
              <DocumentPickerField
                label="Driver Selfie Check"
                hint="Helps match gate / host arrival identity"
                value={selfieUrl}
                onChange={setSelfieUrl}
              />
            </View>

            <PressScale
              style={[styles.submitBtn, saving && { opacity: 0.65 }]}
              contentStyle={styles.submitBtnInner}
              rippleColor={colors.rippleLight}
              onPress={handleSubmit}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator color={colors.white} />
              ) : (
                <>
                  <Ionicons name="shield-checkmark-outline" size={18} color={colors.white} />
                  <Text style={styles.submitBtnText}>
                    {driverKyc ? 'Update & Resubmit Driver KYC' : 'Store & Submit Driver KYC'}
                  </Text>
                </>
              )}
            </PressScale>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  appBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingBottom: 12,
    backgroundColor: colors.navy,
  },
  iconBtn: { width: 48, height: 48, borderRadius: 12, overflow: 'hidden' },
  iconBtnInner: { width: 48, height: 48, justifyContent: 'center', alignItems: 'center' },
  appBarTitle: { color: colors.white, fontSize: 17, fontWeight: '800' },
  scroll: { padding: 16 },
  statusCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
  },
  statusTitle: { fontSize: 14.5, fontWeight: '800', marginBottom: 3 },
  statusBody: { color: colors.textSecondary, fontSize: 12.5, lineHeight: 18 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    gap: 10,
    ...theme.elevation.card,
  },
  cardTitle: { color: colors.navy, fontSize: 15.5, fontWeight: '800', marginBottom: 2 },
  row2: { flexDirection: 'row', gap: 10 },
  inputLabel: { color: colors.textSecondary, fontSize: 12, fontWeight: '700' },
  input: {
    backgroundColor: colors.background,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    paddingHorizontal: 12,
    minHeight: 46,
    color: colors.navy,
    fontSize: 14,
    fontWeight: '600',
  },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    backgroundColor: colors.cardElevated,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    overflow: 'hidden',
  },
  chipActive: { backgroundColor: colors.primaryLight, borderColor: colors.primary },
  chipInner: { minHeight: 38, paddingHorizontal: 12, justifyContent: 'center', alignItems: 'center' },
  chipText: { color: colors.navy, fontSize: 12.5, fontWeight: '700' },
  chipTextActive: { color: colors.primary, fontWeight: '800' },
  submitBtn: { backgroundColor: colors.primary, borderRadius: 14, overflow: 'hidden', marginTop: 4 },
  submitBtnInner: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  submitBtnText: { color: colors.white, fontSize: 15.5, fontWeight: '800' },
});
