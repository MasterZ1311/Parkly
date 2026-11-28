import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { SpaceType, VehiclePayloadType } from '../../src/api/client';
import * as Location from 'expo-location';
import { useAuthStore } from '../../src/store/auth.store';
import { useHostStore, type HostOwnedSpace } from '../../src/store/host.store';
import { useKycStore } from '../../src/store/kyc.store';
import { getSpaceTypeMeta } from '../../src/data/demoFixtures';
import { colors, theme } from '../../src/constants/theme';
import { ENTER_FADE_UP, PressScale, triggerHaptic } from '../../src/components/Motion';
import { DocumentPickerField } from '../../src/components/DocumentPickerField';
import { pickDocumentPhoto } from '../../src/utils/documentPicker';
import { classifyApiError } from '../../src/utils/apiErrors';

const PROPERTY_TYPES: Array<{ value: SpaceType; label: string; hint: string }> = [
  { value: 'private_house', label: 'House / Driveway', hint: 'Vacant home porch or gate bay' },
  { value: 'apartment_bay', label: 'Apartment Bay', hint: 'Flat stilt or visitor slot' },
  { value: 'gated_compound', label: 'Gated Compound', hint: 'Private walled plot' },
  { value: 'commercial', label: 'Commercial Lot', hint: 'Multi-bay business lot' },
];

const CHENNAI_AREAS = ['T Nagar', 'Anna Nagar', 'Adyar', 'Velachery', 'OMR', 'Mylapore'];

const VEHICLE_OPTIONS: Array<{ value: VehiclePayloadType; label: string }> = [
  { value: 'motorcycle', label: '2-Wheeler' },
  { value: 'compact', label: 'Hatchback' },
  { value: 'sedan', label: 'Sedan' },
  { value: 'suv', label: 'SUV' },
];

export default function HostSpacesScreen() {
  const isDemoMode = useAuthStore((s) => s.isDemoMode);
  const { mySpaces, totalEarnings, loading, saving, loadMySpaces, createPrivateSpace, toggleSpaceAvailability } =
    useHostStore();
  const { hostKyc, loadKycs } = useKycStore();
  const insets = useSafeAreaInsets();

  const [modalOpen, setModalOpen] = useState(false);
  const [spaceType, setSpaceType] = useState<SpaceType>('private_house');
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [area, setArea] = useState('T Nagar');
  const [pincode, setPincode] = useState('600017');
  const [slots, setSlots] = useState('1');
  const [hourlyRate, setHourlyRate] = useState('30');
  const [entryInstructions, setEntryInstructions] = useState('');
  const [covered, setCovered] = useState(true);
  const [evCharging, setEvCharging] = useState(false);
  const [gated, setGated] = useState(true);
  const [vehicleTypes, setVehicleTypes] = useState<VehiclePayloadType[]>(['motorcycle', 'compact', 'sedan']);
  const [plotPhotos, setPlotPhotos] = useState<string[]>([]);
  const [ownershipProofUrl, setOwnershipProofUrl] = useState<string | undefined>();
  const [pinnedCoords, setPinnedCoords] = useState<{ lat: number; lng: number } | undefined>();

  useFocusEffect(
    useCallback(() => {
      loadMySpaces().catch(() => {});
      loadKycs().catch(() => {});
    }, [loadMySpaces, loadKycs]),
  );

  const resetForm = () => {
    setSpaceType('private_house');
    setName('');
    setAddress('');
    setArea('T Nagar');
    setPincode('600017');
    setSlots('1');
    setHourlyRate('30');
    setEntryInstructions('');
    setCovered(true);
    setEvCharging(false);
    setGated(true);
    setVehicleTypes(['motorcycle', 'compact', 'sedan']);
    setPlotPhotos([]);
    setOwnershipProofUrl(undefined);
    setPinnedCoords(undefined);
  };

  const handleAddPlotPhoto = (mode: 'camera' | 'gallery' | 'sample') => {
    if (plotPhotos.length >= 6) {
      Alert.alert('Photo Limit', 'Attach up to 6 pictures of your parking plot or gate.');
      return;
    }
    triggerHaptic('selection');
    pickDocumentPhoto(mode, `Plot View ${plotPhotos.length + 1}`).then((picked) => {
      if (picked) {
        triggerHaptic('success');
        setPlotPhotos((prev) => [...prev, picked.uri]);
      }
    });
  };

  const handlePinGps = async () => {
    try {
      const perm = await Location.requestForegroundPermissionsAsync();
      if (perm.status !== 'granted') {
        Alert.alert('GPS Needed', 'Allow location access to pin exact parking plot coordinates.');
        return;
      }
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      setPinnedCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      triggerHaptic('success');
    } catch {
      Alert.alert('Location Unavailable', 'Could not read current GPS coordinates; neighborhood center will be used.');
    }
  };

  const toggleVehicleClass = (vt: VehiclePayloadType) => {
    triggerHaptic('selection');
    setVehicleTypes((prev) =>
      prev.includes(vt) ? (prev.length > 1 ? prev.filter((item) => item !== vt) : prev) : [...prev, vt],
    );
  };

  const handleCreate = async () => {
    const cleanName = name.trim();
    const cleanAddr = address.trim();
    const parsedSlots = parseInt(slots, 10);
    const parsedRate = parseFloat(hourlyRate);

    if (cleanName.length < 3) {
      Alert.alert('Check Space Name', 'Enter a descriptive name (e.g. "My House Driveway · T Nagar").');
      return;
    }
    if (cleanAddr.length < 5) {
      Alert.alert('Check Street Address', 'Enter your street or flat number so drivers can find your gate.');
      return;
    }
    if (!Number.isFinite(parsedSlots) || parsedSlots < 1 || parsedSlots > 500) {
      Alert.alert('Invalid Capacity', 'Enter between 1 and 500 parking slots.');
      return;
    }
    if (!Number.isFinite(parsedRate) || parsedRate < 10 || parsedRate > 2000) {
      Alert.alert('Invalid Hourly Rate', 'Set an hourly tariff between ₹10 and ₹2,000.');
      return;
    }
    if (plotPhotos.length === 0) {
      Alert.alert(
        'Plot Pictures Required',
        'Upload at least 1 picture of the parking plot or gate entrance so the team can verify the location.',
      );
      return;
    }

    try {
      const created = await createPrivateSpace({
        name: cleanName,
        spaceType,
        entryInstructions: entryInstructions.trim() || undefined,
        address: cleanAddr,
        area,
        pincode,
        totalCapacity: parsedSlots,
        hourlyRate: parsedRate,
        evCharging,
        covered,
        gated,
        vehicleTypes,
        photoUrls: plotPhotos,
        ownershipProofUrl,
        coordinates: pinnedCoords,
      });
      triggerHaptic('success');
      setModalOpen(false);
      resetForm();
      Alert.alert(
        'Submitted for Location Verification',
        `"${created.name}" (${created.photoUrls?.length || plotPhotos.length} plot photo(s)) is stored and queued for the Parkly Team to review and verify.`,
      );
    } catch (err) {
      const classified = classifyApiError(err, 'Unable to publish your parking space right now.');
      Alert.alert('Could Not List Space', classified.message);
    }
  };

  const handleToggleSpace = async (space: HostOwnedSpace) => {
    triggerHaptic('selection');
    try {
      await toggleSpaceAvailability(space.id);
    } catch (err) {
      const classified = classifyApiError(err, 'Unable to update availability.');
      Alert.alert('Update Failed', classified.message);
    }
  };

  const activeCount = mySpaces.filter((s) => s.status === 'active').length;

  return (
    <View style={styles.container}>
      <StatusBar style="light" backgroundColor={colors.navy} />

      <View style={[styles.header, { paddingTop: Math.max(insets.top + 8, 18) }]}>
        <PressScale
          style={styles.backBtn}
          contentStyle={styles.backBtnInner}
          rippleColor={colors.rippleLight}
          onPress={() => router.back()}
          accessibilityLabel="Go back"
        >
          <Ionicons name="arrow-back" size={20} color={colors.white} />
        </PressScale>
        <Text style={styles.headerTitle}>Rent Out Private Space</Text>
        <PressScale
          style={styles.addHeaderBtn}
          contentStyle={styles.backBtnInner}
          rippleColor={colors.rippleLight}
          onPress={() => {
            resetForm();
            setModalOpen(true);
          }}
          accessibilityLabel="Add private space"
        >
          <Ionicons name="add" size={22} color={colors.white} />
        </PressScale>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          padding: 16,
          paddingBottom: Math.max(insets.bottom + 28, 40),
          gap: 14,
        }}
      >
        <Animated.View entering={ENTER_FADE_UP} style={styles.heroCard}>
          <View style={styles.heroTopRow}>
            <View style={styles.heroIconWrap}>
              <Ionicons name="home-outline" size={24} color={colors.navy} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.heroTitle}>Turn Vacant Home Parking Into Income</Text>
              <Text style={styles.heroSub}>
                Rent out your empty house driveway, stilt bay, or compound slot hourly. Pause anytime when you return home.
              </Text>
            </View>
          </View>

          <View style={styles.metricsRow}>
            <View style={styles.metricBox}>
              <Text style={styles.metricVal}>{mySpaces.length}</Text>
              <Text style={styles.metricLabel}>Listed</Text>
            </View>
            <View style={styles.metricBox}>
              <Text style={[styles.metricVal, { color: colors.success }]}>{activeCount}</Text>
              <Text style={styles.metricLabel}>Active Now</Text>
            </View>
            <View style={styles.metricBox}>
              <Text style={[styles.metricVal, { color: colors.primary }]}>₹{totalEarnings}</Text>
              <Text style={styles.metricLabel}>Earnings</Text>
            </View>
          </View>

          <PressScale
            style={styles.primaryBtn}
            contentStyle={styles.primaryBtnInner}
            rippleColor={colors.rippleLight}
            haptic="medium"
            onPress={() => {
              resetForm();
              setModalOpen(true);
            }}
          >
            <Ionicons name="add-circle-outline" size={19} color={colors.white} />
            <Text style={styles.primaryBtnText}>List Vacant House / Private Space</Text>
          </PressScale>
        </Animated.View>

        <PressScale
          style={styles.kycStrip}
          contentStyle={styles.kycStripInner}
          onPress={() => router.push('/host/kyc')}
        >
          <Ionicons
            name={hostKyc?.verificationStatus === 'approved' ? 'shield-checkmark' : 'document-attach-outline'}
            size={20}
            color={hostKyc?.verificationStatus === 'approved' ? colors.success : colors.primary}
          />
          <View style={{ flex: 1 }}>
            <Text style={styles.kycStripTitle}>
              {hostKyc
                ? `Host KYC: ${hostKyc.verificationStatus === 'approved' ? 'Verified' : hostKyc.verificationStatus === 'rejected' ? 'Action Needed' : 'Pending Team Review'}`
                : 'Complete Host KYC & Property Ownership Proof'}
            </Text>
            <Text style={styles.kycStripSub}>
              {hostKyc
                ? `${hostKyc.plotPhotoUrls.length} plot photo(s) stored · Tap to update ID or proof`
                : 'Upload Owner ID, property bill/tax receipt & plot photos'}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
        </PressScale>

        <Text style={styles.sectionLabel}>YOUR PRIVATE &amp; HOST LISTINGS</Text>

        {loading ? (
          <View style={styles.emptyBox}>
            <ActivityIndicator color={colors.primary} />
            <Text style={styles.emptySub}>Loading your spaces...</Text>
          </View>
        ) : mySpaces.length === 0 ? (
          <View style={styles.emptyBox}>
            <Ionicons name="car-sport-outline" size={34} color={colors.textMuted} />
            <Text style={styles.emptyTitle}>No Private Spaces Listed Yet</Text>
            <Text style={styles.emptySub}>
              Have a vacant carport, independent house gate bay, or apartment visitor slot? List it in 30 seconds and start accepting hourly bookings.
            </Text>
          </View>
        ) : (
          mySpaces.map((space) => {
            const typeMeta = getSpaceTypeMeta(space.spaceType);
            const isActive = space.status === 'active';
            const canToggle = space.status === 'active' || space.status === 'inactive';
            return (
              <View key={space.id} style={styles.spaceCard}>
                <View style={styles.spaceHeader}>
                  <View style={{ flex: 1 }}>
                    <View style={styles.typePill}>
                      <Ionicons name="home-outline" size={12} color={colors.info} />
                      <Text style={styles.typePillText}>{typeMeta.shortLabel}</Text>
                    </View>
                    <Text style={styles.spaceName}>{space.name}</Text>
                    <Text style={styles.spaceAddress}>{space.address}</Text>
                  </View>
                  <Text style={styles.spaceRate}>
                    ₹{space.hourlyRate}
                    <Text style={styles.spaceRateUnit}>/hr</Text>
                  </Text>
                </View>

                {space.entryInstructions ? (
                  <View style={styles.noteRow}>
                    <Ionicons name="key-outline" size={14} color={colors.navy} />
                    <Text style={styles.noteText}>{space.entryInstructions}</Text>
                  </View>
                ) : null}

                {(space.photoUrls && space.photoUrls.length > 0) || space.ownershipProofUrl ? (
                  <View style={styles.noteRow}>
                    <Ionicons name="images-outline" size={14} color={colors.info} />
                    <Text style={styles.noteText}>
                      {space.photoUrls?.length || 0} plot picture(s) stored
                      {space.ownershipProofUrl ? ' · Ownership proof attached' : ''}
                    </Text>
                  </View>
                ) : null}

                <View style={styles.spaceFooter}>
                  <View style={styles.metaTags}>
                    <Text style={styles.slotCount}>
                      {space.totalCapacity} {space.totalCapacity === 1 ? 'slot' : 'slots'}
                    </Text>
                    <View
                      style={[
                        styles.statusPill,
                        {
                          backgroundColor: isActive ? colors.successLight : colors.warningLight,
                          borderColor: isActive ? colors.successBorder : colors.warningBorder,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.statusPillText,
                          { color: isActive ? colors.success : colors.warning },
                        ]}
                      >
                        {space.status === 'pending_verification'
                          ? 'Pending KYC'
                          : isActive
                            ? 'Available Now'
                            : 'Paused'}
                      </Text>
                    </View>
                  </View>

                  {canToggle && (
                    <View style={styles.switchWrap}>
                      <Text style={styles.switchLabel}>{isActive ? 'Open' : 'Paused'}</Text>
                      <Switch
                        value={isActive}
                        onValueChange={() => handleToggleSpace(space)}
                        trackColor={{ false: colors.borderStrong, true: colors.success }}
                        thumbColor={colors.white}
                      />
                    </View>
                  )}
                </View>
              </View>
            );
          })
        )}
      </ScrollView>

      {/* Add Private Space Modal */}
      <Modal
        visible={modalOpen}
        animationType="slide"
        transparent
        onRequestClose={() => setModalOpen(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalBackdrop}
        >
          <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom + 18, 28) }]}>
            <View style={styles.sheetHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.sheetTitle}>List Vacant Parking Space</Text>
                <Text style={styles.sheetSub}>Private home driveways, apartment bays &amp; plots</Text>
              </View>
              <PressScale
                style={styles.closeBtn}
                contentStyle={styles.closeBtnInner}
                onPress={() => setModalOpen(false)}
                accessibilityLabel="Close form"
              >
                <Ionicons name="close" size={20} color={colors.navy} />
              </PressScale>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 540 }}>
              <Text style={styles.fieldLabel}>PROPERTY TYPE</Text>
              <View style={styles.typeGrid}>
                {PROPERTY_TYPES.map((pt) => {
                  const active = spaceType === pt.value;
                  return (
                    <PressScale
                      key={pt.value}
                      style={[styles.typeOption, active && styles.typeOptionActive]}
                      contentStyle={styles.typeOptionInner}
                      haptic="selection"
                      onPress={() => {
                        setSpaceType(pt.value);
                        setSlots(pt.value === 'commercial' ? '8' : '1');
                        setHourlyRate(pt.value === 'commercial' ? '40' : '30');
                      }}
                    >
                      <Text style={[styles.typeOptionTitle, active && { color: colors.white }]}>
                        {pt.label}
                      </Text>
                      <Text style={[styles.typeOptionHint, active && { color: '#CBD5E1' }]}>
                        {pt.hint}
                      </Text>
                    </PressScale>
                  );
                })}
              </View>

              <Text style={styles.fieldLabel}>SPACE NAME *</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. 14B Gandhi Street House Driveway"
                placeholderTextColor={colors.textMuted}
                value={name}
                onChangeText={setName}
              />

              <Text style={styles.fieldLabel}>STREET / HOUSE ADDRESS *</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. 14B, North Usman Road"
                placeholderTextColor={colors.textMuted}
                value={address}
                onChangeText={setAddress}
              />

              <Text style={styles.fieldLabel}>CHENNAI NEIGHBORHOOD</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ gap: 8, marginBottom: 14 }}
              >
                {CHENNAI_AREAS.map((hood) => {
                  const active = area === hood;
                  return (
                    <PressScale
                      key={hood}
                      style={[styles.pill, active && styles.pillActive]}
                      contentStyle={styles.pillInner}
                      onPress={() => setArea(hood)}
                    >
                      <Text style={[styles.pillText, active && { color: colors.white }]}>{hood}</Text>
                    </PressScale>
                  );
                })}
              </ScrollView>

              <View style={styles.row2}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.fieldLabel}>VACANT SLOTS *</Text>
                  <TextInput
                    style={[styles.input, styles.mono]}
                    keyboardType="number-pad"
                    value={slots}
                    onChangeText={setSlots}
                    placeholder="1"
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.fieldLabel}>HOURLY RATE (₹) *</Text>
                  <TextInput
                    style={[styles.input, styles.mono]}
                    keyboardType="number-pad"
                    value={hourlyRate}
                    onChangeText={setHourlyRate}
                    placeholder="30"
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.fieldLabel}>PINCODE</Text>
                  <TextInput
                    style={[styles.input, styles.mono]}
                    keyboardType="number-pad"
                    maxLength={6}
                    value={pincode}
                    onChangeText={setPincode}
                    placeholder="600017"
                  />
                </View>
              </View>

              <Text style={styles.fieldLabel}>SUPPORTED VEHICLES</Text>
              <View style={styles.pillWrap}>
                {VEHICLE_OPTIONS.map((v) => {
                  const active = vehicleTypes.includes(v.value);
                  return (
                    <PressScale
                      key={v.value}
                      style={[styles.pill, active && styles.pillActive]}
                      contentStyle={styles.pillInner}
                      onPress={() => toggleVehicleClass(v.value)}
                    >
                      <Text style={[styles.pillText, active && { color: colors.white }]}>
                        {v.label}
                      </Text>
                    </PressScale>
                  );
                })}
              </View>

              <Text style={styles.fieldLabel}>GATE / ENTRY INSTRUCTIONS FOR DRIVERS</Text>
              <TextInput
                style={[styles.input, { minHeight: 72, textAlignVertical: 'top', paddingTop: 10 }]}
                multiline
                placeholder="e.g. Ring bell at wooden gate or call on arrival; park under shaded porch."
                placeholderTextColor={colors.textMuted}
                value={entryInstructions}
                onChangeText={setEntryInstructions}
              />

              <Text style={styles.fieldLabel}>PARKING PLOT PICTURES * ({plotPhotos.length}/6)</Text>
              <View style={styles.photoRow}>
                <PressScale
                  style={styles.photoActionBtn}
                  contentStyle={styles.photoActionInner}
                  onPress={() => handleAddPlotPhoto('camera')}
                >
                  <Ionicons name="camera-outline" size={15} color={colors.navy} />
                  <Text style={styles.photoActionText}>Camera</Text>
                </PressScale>
                <PressScale
                  style={styles.photoActionBtn}
                  contentStyle={styles.photoActionInner}
                  onPress={() => handleAddPlotPhoto('gallery')}
                >
                  <Ionicons name="images-outline" size={15} color={colors.navy} />
                  <Text style={styles.photoActionText}>Gallery</Text>
                </PressScale>
                <PressScale
                  style={[styles.photoActionBtn, { backgroundColor: colors.primaryLight, borderColor: colors.primaryBorder }]}
                  contentStyle={styles.photoActionInner}
                  onPress={() => handleAddPlotPhoto('sample')}
                >
                  <Ionicons name="scan-outline" size={15} color={colors.primary} />
                  <Text style={[styles.photoActionText, { color: colors.primary }]}>Sample Plot</Text>
                </PressScale>
              </View>
              {plotPhotos.length > 0 && (
                <Text style={styles.storedPhotoSummary}>
                  {plotPhotos.length} parking plot picture(s) attached for location verification
                </Text>
              )}

              <View style={{ marginBottom: 14 }}>
                <DocumentPickerField
                  label="Ownership / Residence Proof (Optional here)"
                  hint="Property tax receipt, EB bill, or society NOC"
                  value={ownershipProofUrl}
                  onChange={setOwnershipProofUrl}
                />
              </View>

              <PressScale
                style={styles.gpsBtn}
                contentStyle={styles.photoActionInner}
                onPress={handlePinGps}
              >
                <Ionicons name="locate-outline" size={15} color={colors.navy} />
                <Text style={styles.photoActionText}>
                  {pinnedCoords
                    ? `GPS Pinned: ${pinnedCoords.lat.toFixed(4)}, ${pinnedCoords.lng.toFixed(4)}`
                    : `Pin Plot GPS Coordinates (${area} default)`}
                </Text>
              </PressScale>

              <View style={styles.togglesBox}>
                <View style={styles.toggleRow}>
                  <Text style={styles.toggleLabel}>Covered Porch / Roof</Text>
                  <Switch
                    value={covered}
                    onValueChange={setCovered}
                    trackColor={{ false: colors.borderStrong, true: colors.navy }}
                    thumbColor={colors.white}
                  />
                </View>
                <View style={styles.toggleRow}>
                  <Text style={styles.toggleLabel}>EV Charging Socket (15A / Type 2)</Text>
                  <Switch
                    value={evCharging}
                    onValueChange={setEvCharging}
                    trackColor={{ false: colors.borderStrong, true: colors.navy }}
                    thumbColor={colors.white}
                  />
                </View>
                <View style={styles.toggleRow}>
                  <Text style={styles.toggleLabel}>Locked Gate / CCTV Security</Text>
                  <Switch
                    value={gated}
                    onValueChange={setGated}
                    trackColor={{ false: colors.borderStrong, true: colors.navy }}
                    thumbColor={colors.white}
                  />
                </View>
              </View>

              <PressScale
                style={[styles.submitBtn, saving && { opacity: 0.65 }]}
                contentStyle={styles.primaryBtnInner}
                rippleColor={colors.rippleLight}
                disabled={saving}
                onPress={handleCreate}
              >
                {saving ? (
                  <ActivityIndicator color={colors.white} />
                ) : (
                  <Text style={styles.primaryBtnText}>Publish Private Space</Text>
                )}
              </PressScale>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  mono: { fontVariant: ['tabular-nums'] },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingBottom: 14,
    backgroundColor: colors.navy,
  },
  backBtn: { borderRadius: 12, backgroundColor: colors.navySurface, overflow: 'hidden' },
  addHeaderBtn: { borderRadius: 12, backgroundColor: colors.primary, overflow: 'hidden' },
  backBtnInner: { width: 48, height: 48, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { color: colors.white, fontSize: 17, fontWeight: '800' },
  heroCard: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 18,
    gap: 14,
    ...theme.elevation.card,
  },
  kycStrip: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    overflow: 'hidden',
    ...theme.elevation.card,
  },
  kycStripInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 13,
  },
  kycStripTitle: { color: colors.navy, fontSize: 13.5, fontWeight: '800' },
  kycStripSub: { color: colors.textMuted, fontSize: 11.5, marginTop: 2 },
  photoRow: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  photoActionBtn: {
    flex: 1,
    backgroundColor: colors.cardElevated,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    overflow: 'hidden',
  },
  photoActionInner: {
    minHeight: 40,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingHorizontal: 8,
  },
  photoActionText: { color: colors.navy, fontSize: 12, fontWeight: '700' },
  storedPhotoSummary: { color: colors.success, fontSize: 12, fontWeight: '700', marginBottom: 12 },
  gpsBtn: {
    backgroundColor: colors.cardElevated,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    overflow: 'hidden',
    marginBottom: 14,
  },
  heroTopRow: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  heroIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: colors.cardElevated,
    borderWidth: 1,
    borderColor: colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  heroTitle: { color: colors.navy, fontSize: 16.5, fontWeight: '800', marginBottom: 4 },
  heroSub: { color: colors.textMuted, fontSize: 13, lineHeight: 18 },
  metricsRow: { flexDirection: 'row', gap: 10 },
  metricBox: {
    flex: 1,
    backgroundColor: colors.cardElevated,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 10,
    alignItems: 'center',
  },
  metricVal: { color: colors.navy, fontSize: 18, fontWeight: '800', fontVariant: ['tabular-nums'] },
  metricLabel: { color: colors.textMuted, fontSize: 11, fontWeight: '700', marginTop: 2 },
  primaryBtn: { backgroundColor: colors.primary, borderRadius: 12, overflow: 'hidden' },
  primaryBtnInner: {
    minHeight: 50,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  primaryBtnText: { color: colors.white, fontSize: 14.5, fontWeight: '800' },
  sectionLabel: {
    color: colors.textMuted,
    fontSize: 11.5,
    fontWeight: '800',
    letterSpacing: 0.9,
    marginTop: 4,
  },
  emptyBox: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 28,
    alignItems: 'center',
    gap: 8,
  },
  emptyTitle: { color: colors.navy, fontSize: 16, fontWeight: '800', textAlign: 'center' },
  emptySub: { color: colors.textMuted, fontSize: 13, lineHeight: 19, textAlign: 'center' },
  spaceCard: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    gap: 10,
    ...theme.elevation.card,
  },
  spaceHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  typePill: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.infoLight,
    borderWidth: 1,
    borderColor: colors.infoBorder,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginBottom: 6,
  },
  typePillText: { color: colors.info, fontSize: 11, fontWeight: '800' },
  spaceName: { color: colors.navy, fontSize: 15.5, fontWeight: '800', marginBottom: 2 },
  spaceAddress: { color: colors.textMuted, fontSize: 12.5 },
  spaceRate: { color: colors.primary, fontSize: 18, fontWeight: '800', fontVariant: ['tabular-nums'] },
  spaceRateUnit: { color: colors.textMuted, fontSize: 11.5, fontWeight: '600' },
  noteRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: colors.cardElevated,
    borderRadius: 8,
    padding: 10,
  },
  noteText: { flex: 1, color: colors.textSecondary, fontSize: 12.5, lineHeight: 17 },
  spaceFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: colors.cardElevated,
    paddingTop: 10,
  },
  metaTags: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  slotCount: { color: colors.navy, fontSize: 12.5, fontWeight: '700' },
  statusPill: { borderRadius: 6, borderWidth: 1, paddingHorizontal: 8, paddingVertical: 3 },
  statusPillText: { fontSize: 11, fontWeight: '800' },
  switchWrap: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  switchLabel: { color: colors.textSecondary, fontSize: 12, fontWeight: '700' },
  modalBackdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(11, 22, 40, 0.56)',
  },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    paddingHorizontal: 18,
    paddingTop: 16,
    ...theme.elevation.sheet,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  sheetTitle: { color: colors.navy, fontSize: 18, fontWeight: '800' },
  sheetSub: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
  closeBtn: { borderRadius: 10, backgroundColor: colors.cardElevated, overflow: 'hidden' },
  closeBtnInner: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center' },
  fieldLabel: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.7,
    marginBottom: 6,
  },
  typeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 },
  typeOption: {
    width: '48.5%',
    borderRadius: 10,
    backgroundColor: colors.cardElevated,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  typeOptionActive: { backgroundColor: colors.navy, borderColor: colors.navy },
  typeOptionInner: { padding: 10, minHeight: 58, justifyContent: 'center' },
  typeOptionTitle: { color: colors.navy, fontSize: 12.5, fontWeight: '800' },
  typeOptionHint: { color: colors.textMuted, fontSize: 11, marginTop: 2 },
  input: {
    backgroundColor: colors.surface,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    paddingHorizontal: 12,
    minHeight: 46,
    color: colors.navy,
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 12,
  },
  row2: { flexDirection: 'row', gap: 8 },
  pillWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 },
  pill: {
    borderRadius: 10,
    backgroundColor: colors.cardElevated,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  pillActive: { backgroundColor: colors.navy, borderColor: colors.navy },
  pillInner: { paddingHorizontal: 12, minHeight: 40, justifyContent: 'center' },
  pillText: { color: colors.navy, fontSize: 12.5, fontWeight: '700' },
  togglesBox: {
    backgroundColor: colors.cardElevated,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 12,
    paddingVertical: 4,
    marginBottom: 16,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  toggleLabel: { color: colors.navy, fontSize: 13, fontWeight: '700' },
  submitBtn: { backgroundColor: colors.primary, borderRadius: 12, overflow: 'hidden', marginBottom: 8 },
});
