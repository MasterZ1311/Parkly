import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
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
import type { GovIdType, OwnershipProofType } from '../../src/api/client';
import { useAuthStore } from '../../src/store/auth.store';
import { formatOwnershipProofLabel, useKycStore } from '../../src/store/kyc.store';
import { colors, theme } from '../../src/constants/theme';
import { ENTER_FADE_UP, PressScale, triggerHaptic } from '../../src/components/Motion';
import { DocumentPickerField } from '../../src/components/DocumentPickerField';
import { pickDocumentPhoto } from '../../src/utils/documentPicker';
import { classifyApiError } from '../../src/utils/apiErrors';

const GOV_ID_TYPES: Array<{ value: GovIdType; label: string }> = [
  { value: 'aadhaar', label: 'Aadhaar' },
  { value: 'pan', label: 'PAN' },
  { value: 'passport', label: 'Passport' },
];

const OWNERSHIP_TYPES: Array<{ value: OwnershipProofType; label: string }> = [
  { value: 'property_tax', label: 'Property Tax' },
  { value: 'electricity_bill', label: 'EB / Utility Bill' },
  { value: 'sale_deed', label: 'Sale Deed' },
  { value: 'noc_society', label: 'Society NOC' },
  { value: 'rental_agreement', label: 'Rent + NOC' },
];

export default function HostKycScreen() {
  const user = useAuthStore((s) => s.user);
  const isDemoMode = useAuthStore((s) => s.isDemoMode);
  const { hostKyc, saving, loadKycs, submitHostKyc } = useKycStore();
  const insets = useSafeAreaInsets();

  const [kycFullName, setKycFullName] = useState(user?.name?.replace(' (Demo)', '') || '');
  const [kycPhone, setKycPhone] = useState(user?.phone || '');
  const [panNumber, setPanNumber] = useState('');
  const [govIdType, setGovIdType] = useState<GovIdType>('aadhaar');
  const [govIdNumber, setGovIdNumber] = useState('');
  const [govIdDocUrl, setGovIdDocUrl] = useState<string | undefined>();
  const [ownershipType, setOwnershipType] = useState<OwnershipProofType>('property_tax');
  const [ownershipDocUrl, setOwnershipDocUrl] = useState<string | undefined>();
  const [upiId, setUpiId] = useState('');
  const [bankAccountNumber, setBankAccountNumber] = useState('');
  const [ifscCode, setIfscCode] = useState('');
  const [kycNotes, setKycNotes] = useState('');
  const [plotPhotos, setPlotPhotos] = useState<string[]>([]);

  useFocusEffect(
    useCallback(() => {
      loadKycs().catch(() => {});
    }, [loadKycs]),
  );

  useEffect(() => {
    if (hostKyc) {
      setKycFullName(hostKyc.kycFullName);
      setKycPhone(hostKyc.kycPhone || user?.phone || '');
      setPanNumber(hostKyc.panNumber || '');
      setGovIdType(hostKyc.govIdType);
      setGovIdNumber(hostKyc.govIdNumberMasked);
      setGovIdDocUrl(hostKyc.govIdDocumentUrl);
      setOwnershipType(hostKyc.ownershipProofType);
      setOwnershipDocUrl(hostKyc.ownershipDocumentUrl);
      setUpiId(hostKyc.upiId || '');
      setBankAccountNumber(hostKyc.bankAccountNumber || '');
      setIfscCode(hostKyc.ifscCode || '');
      setKycNotes(hostKyc.kycNotes || '');
      setPlotPhotos(hostKyc.plotPhotoUrls || []);
    }
  }, [hostKyc, user?.phone]);

  const handleAddPlotPhoto = (mode: 'camera' | 'gallery' | 'sample') => {
    if (plotPhotos.length >= 6) {
      Alert.alert('Photo Limit', 'You can attach up to 6 parking plot photos.');
      return;
    }
    triggerHaptic('selection');
    pickDocumentPhoto(mode, `Parking Plot Photo ${plotPhotos.length + 1}`).then((picked) => {
      if (picked) {
        triggerHaptic('success');
        setPlotPhotos((prev) => [...prev, picked.uri]);
      }
    });
  };

  const handleSubmit = async () => {
    if (kycFullName.trim().length < 2) {
      Alert.alert('Owner Name Required', 'Enter the property owner legal name.');
      return;
    }
    if (govIdNumber.trim().length < 4 || !govIdDocUrl) {
      Alert.alert('Owner ID Required', 'Enter your ID number and attach a Government ID scan.');
      return;
    }
    if (!ownershipDocUrl) {
      Alert.alert(
        'Ownership Proof Required',
        `Attach your ${formatOwnershipProofLabel(ownershipType)} so the team can verify the space.`,
      );
      return;
    }
    if (plotPhotos.length === 0) {
      Alert.alert(
        'Plot Pictures Required',
        'Upload at least 1 picture of the parking plot, driveway, or gate entrance.',
      );
      return;
    }

    try {
      await submitHostKyc({
        kycFullName: kycFullName.trim(),
        kycPhone: kycPhone.trim() || undefined,
        panNumber: panNumber.trim() || undefined,
        govIdType,
        govIdNumberMasked: govIdNumber.trim(),
        govIdDocumentUrl: govIdDocUrl,
        ownershipProofType: ownershipType,
        ownershipDocumentUrl: ownershipDocUrl,
        plotPhotoUrls: plotPhotos,
        bankAccountNumber: bankAccountNumber.trim() || undefined,
        ifscCode: ifscCode.trim() || undefined,
        upiId: upiId.trim() || undefined,
        kycNotes: kycNotes.trim() || undefined,
      });
      triggerHaptic('success');
      Alert.alert(
        isDemoMode ? 'Host KYC & Plot Photos Stored' : 'Submitted for Team Review',
        'Your host ID, property proof, and plot photos have been stored for verification by the Parkly Review Team.',
      );
    } catch (err) {
      const classified = classifyApiError(err, 'Unable to submit Host KYC.');
      Alert.alert('Submission Failed', classified.message);
    }
  };

  const status = hostKyc?.verificationStatus;
  const tone =
    status === 'approved'
      ? { fg: colors.success, bg: colors.successLight, border: colors.successBorder, label: 'Verified Host & Property' }
      : status === 'rejected'
        ? { fg: colors.danger, bg: colors.dangerLight, border: colors.dangerBorder, label: 'Host KYC Needs Update' }
        : status === 'pending'
          ? { fg: colors.warning, bg: colors.warningLight, border: colors.warningBorder, label: 'Pending Team Verification' }
          : { fg: colors.navy, bg: colors.cardElevated, border: colors.borderStrong, label: 'Host KYC Not Submitted' };

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
        <Text style={styles.appBarTitle}>Host KYC &amp; Plot Proof</Text>
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
            <View style={[styles.statusCard, { backgroundColor: tone.bg, borderColor: tone.border }]}>
              <Ionicons name="shield-outline" size={22} color={tone.fg} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.statusTitle, { color: tone.fg }]}>{tone.label}</Text>
                <Text style={styles.statusBody}>
                  {hostKyc?.reviewNotes ||
                    'Before drivers book your space live, our review team checks owner identity, property ownership proof, and parking plot photos.'}
                </Text>
              </View>
            </View>

            {/* 1. Owner Identity */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>1. Property Owner Identity</Text>
              <Text style={styles.inputLabel}>Owner Full Legal Name *</Text>
              <TextInput
                style={styles.input}
                value={kycFullName}
                onChangeText={setKycFullName}
                placeholder="Karthik Subramanian"
                placeholderTextColor={colors.textMuted}
              />

              <View style={styles.row2}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.inputLabel}>Contact Phone</Text>
                  <TextInput
                    style={styles.input}
                    value={kycPhone}
                    onChangeText={setKycPhone}
                    placeholder="+91 98400 00000"
                    placeholderTextColor={colors.textMuted}
                    keyboardType="phone-pad"
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.inputLabel}>PAN Number</Text>
                  <TextInput
                    style={styles.input}
                    value={panNumber}
                    onChangeText={setPanNumber}
                    placeholder="ABCDE1234F"
                    placeholderTextColor={colors.textMuted}
                    autoCapitalize="characters"
                    maxLength={10}
                  />
                </View>
              </View>

              <View style={styles.chipRow}>
                {GOV_ID_TYPES.map((t) => {
                  const active = govIdType === t.value;
                  return (
                    <PressScale
                      key={t.value}
                      style={[styles.chip, active && styles.chipActive]}
                      contentStyle={styles.chipInner}
                      onPress={() => setGovIdType(t.value)}
                    >
                      <Text style={[styles.chipText, active && styles.chipTextActive]}>{t.label}</Text>
                    </PressScale>
                  );
                })}
              </View>

              <Text style={styles.inputLabel}>Government ID Number *</Text>
              <TextInput
                style={styles.input}
                value={govIdNumber}
                onChangeText={setGovIdNumber}
                placeholder="Stored masked after submission"
                placeholderTextColor={colors.textMuted}
                autoCapitalize="characters"
              />

              <DocumentPickerField
                label="Owner Government ID Photo/Scan"
                hint="Aadhaar, PAN, or Passport verification photo"
                required
                value={govIdDocUrl}
                onChange={setGovIdDocUrl}
              />
            </View>

            {/* 2. Property Ownership & Payout */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>2. Property Ownership &amp; Payout</Text>
              <View style={styles.chipRow}>
                {OWNERSHIP_TYPES.map((t) => {
                  const active = ownershipType === t.value;
                  return (
                    <PressScale
                      key={t.value}
                      style={[styles.chip, active && styles.chipActive]}
                      contentStyle={styles.chipInner}
                      onPress={() => setOwnershipType(t.value)}
                    >
                      <Text style={[styles.chipText, active && styles.chipTextActive]}>{t.label}</Text>
                    </PressScale>
                  );
                })}
              </View>

              <DocumentPickerField
                label={`${formatOwnershipProofLabel(ownershipType)} Scan`}
                hint="Confirms address and permission to rent out bay"
                required
                value={ownershipDocUrl}
                onChange={setOwnershipDocUrl}
              />

              <Text style={styles.inputLabel}>Payout UPI ID (optional)</Text>
              <TextInput
                style={styles.input}
                value={upiId}
                onChangeText={setUpiId}
                placeholder="owner@oksbi"
                placeholderTextColor={colors.textMuted}
                autoCapitalize="none"
              />

              <View style={styles.row2}>
                <View style={{ flex: 1.2 }}>
                  <Text style={styles.inputLabel}>Bank Account (optional)</Text>
                  <TextInput
                    style={styles.input}
                    value={bankAccountNumber}
                    onChangeText={setBankAccountNumber}
                    placeholder="XXXXXXXX1234"
                    placeholderTextColor={colors.textMuted}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.inputLabel}>IFSC Code</Text>
                  <TextInput
                    style={styles.input}
                    value={ifscCode}
                    onChangeText={setIfscCode}
                    placeholder="SBIN0001234"
                    placeholderTextColor={colors.textMuted}
                    autoCapitalize="characters"
                  />
                </View>
              </View>
            </View>

            {/* 3. Plot Pictures */}
            <View style={styles.card}>
              <View style={styles.plotHeaderRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.cardTitle}>3. Pictures of Parking Plot *</Text>
                  <Text style={styles.plotHint}>
                    Capture entrance gate, surface/shed, and street landmark ({plotPhotos.length}/6 stored).
                  </Text>
                </View>
              </View>

              {plotPhotos.length > 0 && (
                <View style={styles.photoGrid}>
                  {plotPhotos.map((uri, idx) => (
                    <View key={`${uri}-${idx}`} style={styles.photoItem}>
                      {uri.startsWith('sample://') ? (
                        <View style={styles.samplePhoto}>
                          <Ionicons name="image-outline" size={24} color={colors.navy} />
                          <Text style={styles.samplePhotoText}>Plot #{idx + 1}</Text>
                        </View>
                      ) : (
                        <Image source={{ uri }} style={styles.realPhoto} />
                      )}
                      <PressScale
                        style={styles.removePhotoBtn}
                        contentStyle={styles.removePhotoInner}
                        onPress={() => setPlotPhotos((prev) => prev.filter((_, i) => i !== idx))}
                      >
                        <Ionicons name="close" size={14} color={colors.white} />
                      </PressScale>
                    </View>
                  ))}
                </View>
              )}

              <View style={styles.btnRow}>
                <PressScale
                  style={styles.pickBtn}
                  contentStyle={styles.pickBtnInner}
                  onPress={() => handleAddPlotPhoto('camera')}
                >
                  <Ionicons name="camera-outline" size={16} color={colors.navy} />
                  <Text style={styles.pickBtnText}>Plot Camera</Text>
                </PressScale>
                <PressScale
                  style={styles.pickBtn}
                  contentStyle={styles.pickBtnInner}
                  onPress={() => handleAddPlotPhoto('gallery')}
                >
                  <Ionicons name="images-outline" size={16} color={colors.navy} />
                  <Text style={styles.pickBtnText}>Gallery</Text>
                </PressScale>
                <PressScale
                  style={styles.sampleBtn}
                  contentStyle={styles.pickBtnInner}
                  onPress={() => handleAddPlotPhoto('sample')}
                >
                  <Ionicons name="add-circle-outline" size={16} color={colors.primary} />
                  <Text style={styles.sampleBtnText}>Sample Plot</Text>
                </PressScale>
              </View>

              <Text style={styles.inputLabel}>Notes for Verification Team (optional)</Text>
              <TextInput
                style={styles.input}
                value={kycNotes}
                onChangeText={setKycNotes}
                placeholder="Landmark, gate width, or available timings"
                placeholderTextColor={colors.textMuted}
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
                  <Ionicons name="cloud-upload-outline" size={18} color={colors.white} />
                  <Text style={styles.submitBtnText}>
                    {hostKyc ? 'Update Host KYC & Plot Proof' : 'Store & Submit Host KYC'}
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
  cardTitle: { color: colors.navy, fontSize: 15.5, fontWeight: '800' },
  plotHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  plotHint: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
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
  photoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  photoItem: { position: 'relative', width: 92, height: 76, borderRadius: 10, overflow: 'hidden' },
  realPhoto: { width: '100%', height: '100%' },
  samplePhoto: {
    width: '100%',
    height: '100%',
    backgroundColor: colors.cardElevated,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  samplePhotoText: { color: colors.navy, fontSize: 11, fontWeight: '700' },
  removePhotoBtn: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(11,22,40,0.78)',
    overflow: 'hidden',
  },
  removePhotoInner: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  btnRow: { flexDirection: 'row', gap: 8 },
  pickBtn: {
    flex: 1,
    backgroundColor: colors.cardElevated,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    overflow: 'hidden',
  },
  sampleBtn: {
    flex: 1.15,
    backgroundColor: colors.primaryLight,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.primaryBorder,
    overflow: 'hidden',
  },
  pickBtnInner: {
    minHeight: 42,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingHorizontal: 8,
  },
  pickBtnText: { color: colors.navy, fontSize: 12, fontWeight: '700' },
  sampleBtnText: { color: colors.primary, fontSize: 12, fontWeight: '800' },
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
