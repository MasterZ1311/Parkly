import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  Alert,
  ActivityIndicator,
  Modal,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { type VehiclePayloadType } from '../../src/api/client';
import { useDriverStore, type DriverVehicle } from '../../src/store/driver.store';
import { colors, theme } from '../../src/constants/theme';
import { ENTER_FADE_UP, PressScale, SkeletonBlock, triggerHaptic } from '../../src/components/Motion';
import { VehicleIllustration } from '../../src/components/VehicleIllustration';
import { classifyApiError } from '../../src/utils/apiErrors';

const INDIAN_PLATE_REGEX = /^[A-Z]{2}[0-9]{2}[A-Z]{1,2}[0-9]{4}$/;
const VEHICLE_CLASSES: VehiclePayloadType[] = [
  'motorcycle',
  'compact',
  'sedan',
  'suv',
  'van',
  'truck',
];

export default function MyVehiclesScreen() {
  const {
    vehicles,
    vehiclesLoading,
    loadVehicles,
    addVehicle,
    setDefaultVehicle,
    deleteVehicle,
  } = useDriverStore();

  const [loadError, setLoadError] = useState<string | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [plate, setPlate] = useState('');
  const [vehicleType, setVehicleType] = useState<VehiclePayloadType>('sedan');
  const [make, setMake] = useState('');
  const [model, setModel] = useState('');
  const [color, setColor] = useState('');
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const insets = useSafeAreaInsets();

  const refresh = useCallback(async () => {
    setLoadError(null);
    try {
      await loadVehicles();
    } catch (err) {
      const classified = classifyApiError(err, 'Unable to load saved vehicles.');
      setLoadError(classified.message);
    }
  }, [loadVehicles]);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh]),
  );

  const handleCreate = async () => {
    const cleaned = plate.trim().toUpperCase().replace(/\s+/g, '');
    if (!INDIAN_PLATE_REGEX.test(cleaned)) {
      Alert.alert(
        'Invalid Registration',
        'Enter a valid Indian registration number (e.g. TN01AB1234, TN09C5678).',
      );
      return;
    }

    setSaving(true);
    try {
      await addVehicle({
        licensePlate: cleaned,
        vehicleType,
        make: make.trim() || undefined,
        model: model.trim() || undefined,
        color: color.trim() || undefined,
        isDefault: vehicles.length === 0,
      });
      triggerHaptic('success');
      setPlate('');
      setMake('');
      setModel('');
      setColor('');
      setModalVisible(false);
    } catch (err) {
      const classified = classifyApiError(err, 'Unable to save vehicle.');
      Alert.alert('Save Failed', classified.message);
    } finally {
      setSaving(false);
    }
  };

  const handleSetDefault = async (item: DriverVehicle) => {
    if (item.isDefault) return;
    setBusyId(item.id);
    try {
      await setDefaultVehicle(item.id);
      triggerHaptic('success');
    } catch (err) {
      const classified = classifyApiError(err, 'Unable to update default vehicle.');
      Alert.alert('Update Failed', classified.message);
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = (item: DriverVehicle) => {
    Alert.alert('Remove Vehicle', `Remove ${item.licensePlate} from your garage?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          setBusyId(item.id);
          try {
            await deleteVehicle(item.id);
            triggerHaptic('medium');
          } catch (err) {
            const classified = classifyApiError(err, 'Unable to remove vehicle.');
            Alert.alert('Remove Failed', classified.message);
          } finally {
            setBusyId(null);
          }
        },
      },
    ]);
  };

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
        <Text style={styles.appBarTitle}>My Vehicles</Text>
        <PressScale
          style={styles.iconButton}
          contentStyle={styles.iconButtonContent}
          rippleColor={colors.rippleLight}
          onPress={() => setModalVisible(true)}
          accessibilityLabel="Add vehicle"
        >
          <Ionicons name="add" size={24} color={colors.white} />
        </PressScale>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: Math.max(insets.bottom + 24, 36) },
        ]}
      >
        <Animated.View entering={ENTER_FADE_UP} style={{ gap: 12 }}>
          <Text style={styles.lead}>
            Saved registration numbers map directly to Chennai boom-barrier validation and instant checkout.
          </Text>

          {vehiclesLoading && vehicles.length === 0 ? (
            <View style={{ gap: 12 }}>
              <SkeletonBlock height={116} />
              <SkeletonBlock height={116} />
            </View>
          ) : loadError && vehicles.length === 0 ? (
            <View style={styles.emptyCard}>
              <Ionicons name="cloud-offline-outline" size={34} color={colors.danger} />
              <Text style={styles.emptyTitle}>Could Not Load Garage</Text>
              <Text style={styles.emptyDesc}>{loadError}</Text>
              <PressScale
                style={styles.primaryBtn}
                contentStyle={styles.btnInner}
                rippleColor={colors.rippleLight}
                onPress={refresh}
              >
                <Text style={styles.primaryBtnText}>Retry</Text>
              </PressScale>
            </View>
          ) : vehicles.length === 0 ? (
            <View style={styles.emptyCard}>
              <VehicleIllustration type="sedan" width={110} height={60} />
              <Text style={styles.emptyTitle}>No Vehicles Saved Yet</Text>
              <Text style={styles.emptyDesc}>
                Add your primary car or two-wheeler plate for one-tap bay reservations.
              </Text>
              <PressScale
                style={styles.primaryBtn}
                contentStyle={styles.btnInner}
                rippleColor={colors.rippleLight}
                onPress={() => setModalVisible(true)}
              >
                <Text style={styles.primaryBtnText}>Add Vehicle</Text>
              </PressScale>
            </View>
          ) : (
            vehicles.map((item) => {
              const isBusy = busyId === item.id;
              return (
                <View
                  key={item.id}
                  style={[styles.vehicleCard, item.isDefault && styles.vehicleCardDefault]}
                >
                  <View style={styles.cardTopRow}>
                    <View style={styles.svgBox}>
                      <VehicleIllustration
                        type={item.vehicleType}
                        width={76}
                        height={42}
                        accentColor={item.isDefault ? colors.primary : colors.navy}
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <View style={styles.plateRow}>
                        <Text style={styles.plateText}>{item.licensePlate}</Text>
                        {item.isDefault && (
                          <View style={styles.defaultBadge}>
                            <Text style={styles.defaultText}>DEFAULT</Text>
                          </View>
                        )}
                      </View>
                      <Text style={styles.vehicleSub}>
                        {item.make || item.model
                          ? `${item.make || ''} ${item.model || ''}`.trim()
                          : item.vehicleType.toUpperCase()}
                        {item.color ? ` · ${item.color}` : ''}
                      </Text>
                      <Text style={styles.vehicleClass}>
                        Class: {item.vehicleType.toUpperCase()}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.cardActions}>
                    {!item.isDefault && (
                      <PressScale
                        style={styles.secondaryBtn}
                        contentStyle={styles.smallBtnInner}
                        onPress={() => handleSetDefault(item)}
                        disabled={isBusy}
                      >
                        <Text style={styles.secondaryBtnText}>Set as Default</Text>
                      </PressScale>
                    )}
                    <PressScale
                      style={styles.removeBtn}
                      contentStyle={styles.smallBtnInner}
                      onPress={() => handleDelete(item)}
                      disabled={isBusy}
                    >
                      {isBusy ? (
                        <ActivityIndicator size="small" color={colors.danger} />
                      ) : (
                        <Text style={styles.removeBtnText}>Remove</Text>
                      )}
                    </PressScale>
                  </View>
                </View>
              );
            })
          )}

          {vehicles.length > 0 && (
            <PressScale
              style={[styles.primaryBtn, { marginTop: 6 }]}
              contentStyle={styles.btnInner}
              rippleColor={colors.rippleLight}
              onPress={() => setModalVisible(true)}
            >
              <Ionicons name="add-circle-outline" size={18} color={colors.white} />
              <Text style={styles.primaryBtnText}>Add Another Vehicle</Text>
            </PressScale>
          )}
        </Animated.View>
      </ScrollView>

      <Modal
        visible={modalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => !saving && setModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalBackdrop}
        >
          <View style={[styles.modalSheet, { paddingBottom: Math.max(insets.bottom + 20, 28) }]}>
            <Text style={styles.modalTitle}>Register Vehicle</Text>

            <Text style={styles.inputLabel}>License Plate *</Text>
            <TextInput
              style={styles.input}
              value={plate}
              onChangeText={setPlate}
              placeholder="TN01AB1234"
              placeholderTextColor={colors.textMuted}
              autoCapitalize="characters"
              maxLength={12}
            />

            <Text style={styles.inputLabel}>Vehicle Class</Text>
            <View style={styles.classGrid}>
              {VEHICLE_CLASSES.map((cls) => {
                const active = vehicleType === cls;
                return (
                  <PressScale
                    key={cls}
                    style={[styles.classChip, active && styles.classChipActive]}
                    contentStyle={styles.classChipContent}
                    onPress={() => setVehicleType(cls)}
                  >
                    <VehicleIllustration
                      type={cls}
                      width={36}
                      height={20}
                      accentColor={active ? colors.primary : colors.navy}
                    />
                    <Text style={[styles.classChipText, active && styles.classChipTextActive]}>
                      {cls.charAt(0).toUpperCase() + cls.slice(1)}
                    </Text>
                  </PressScale>
                );
              })}
            </View>

            <View style={{ flexDirection: 'row', gap: 10 }}>
              <View style={{ flex: 1 }}>
                <Text style={styles.inputLabel}>Make</Text>
                <TextInput
                  style={styles.input}
                  value={make}
                  onChangeText={setMake}
                  placeholder="Hyundai"
                  placeholderTextColor={colors.textMuted}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.inputLabel}>Model</Text>
                <TextInput
                  style={styles.input}
                  value={model}
                  onChangeText={setModel}
                  placeholder="Creta"
                  placeholderTextColor={colors.textMuted}
                />
              </View>
            </View>

            <Text style={styles.inputLabel}>Color</Text>
            <TextInput
              style={styles.input}
              value={color}
              onChangeText={setColor}
              placeholder="Pearl White"
              placeholderTextColor={colors.textMuted}
            />

            <PressScale
              style={[styles.primaryBtn, saving && { opacity: 0.65 }, { marginTop: 8 }]}
              contentStyle={styles.btnInner}
              rippleColor={colors.rippleLight}
              onPress={handleCreate}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator color={colors.white} />
              ) : (
                <Text style={styles.primaryBtnText}>Save Vehicle</Text>
              )}
            </PressScale>

            <PressScale
              style={styles.secondaryBtn}
              contentStyle={styles.btnInner}
              onPress={() => setModalVisible(false)}
              disabled={saving}
            >
              <Text style={styles.secondaryBtnText}>Cancel</Text>
            </PressScale>
          </View>
        </KeyboardAvoidingView>
      </Modal>
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
  iconButton: { width: 48, height: 48, borderRadius: 12, overflow: 'hidden' },
  iconButtonContent: { width: 48, height: 48, justifyContent: 'center', alignItems: 'center' },
  appBarTitle: { color: colors.white, fontSize: 17.5, fontWeight: '800' },
  scrollContent: { padding: 16 },
  lead: { color: colors.textSecondary, fontSize: 13, lineHeight: 19, marginBottom: 4 },
  emptyCard: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 24,
    alignItems: 'center',
    gap: 10,
    ...theme.elevation.card,
  },
  emptyTitle: { fontSize: 18, fontWeight: '800', color: colors.navy },
  emptyDesc: { fontSize: 13.5, color: colors.textMuted, textAlign: 'center', lineHeight: 20 },
  vehicleCard: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    gap: 12,
    ...theme.elevation.card,
  },
  vehicleCardDefault: {
    borderColor: colors.navy,
    borderWidth: 1.5,
  },
  cardTopRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  svgBox: {
    width: 86,
    height: 54,
    borderRadius: 10,
    backgroundColor: colors.cardElevated,
    borderWidth: 1,
    borderColor: colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  plateRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 3 },
  plateText: {
    fontSize: 16.5,
    fontWeight: '800',
    color: colors.navy,
    fontVariant: ['tabular-nums'],
    letterSpacing: 0.8,
  },
  defaultBadge: {
    backgroundColor: colors.successLight,
    borderColor: colors.successBorder,
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  defaultText: { color: colors.success, fontSize: 10, fontWeight: '800', letterSpacing: 0.6 },
  vehicleSub: { color: colors.textSecondary, fontSize: 13, fontWeight: '600' },
  vehicleClass: { color: colors.textMuted, fontSize: 11.5, fontWeight: '700', marginTop: 2 },
  cardActions: { flexDirection: 'row', gap: 8, borderTopWidth: 1, borderTopColor: colors.cardElevated, paddingTop: 10 },
  smallBtnInner: { minHeight: 40, paddingHorizontal: 14, justifyContent: 'center', alignItems: 'center' },
  primaryBtn: { backgroundColor: colors.primary, borderRadius: 12, overflow: 'hidden', width: '100%' },
  btnInner: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 18,
  },
  primaryBtnText: { color: colors.white, fontSize: 15, fontWeight: '800' },
  secondaryBtn: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    overflow: 'hidden',
  },
  secondaryBtnText: { color: colors.navy, fontSize: 13.5, fontWeight: '700' },
  removeBtn: {
    backgroundColor: colors.dangerLight,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.dangerBorder,
    overflow: 'hidden',
  },
  removeBtnText: { color: colors.danger, fontSize: 13.5, fontWeight: '700' },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(11,22,40,0.56)', justifyContent: 'flex-end' },
  modalSheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    gap: 8,
    ...theme.elevation.sheet,
  },
  modalTitle: { fontSize: 19, fontWeight: '800', color: colors.navy, marginBottom: 4 },
  inputLabel: { fontSize: 12, fontWeight: '700', color: colors.textSecondary },
  input: {
    backgroundColor: colors.background,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    paddingHorizontal: 12,
    minHeight: 46,
    color: colors.navy,
    fontSize: 14.5,
    fontWeight: '700',
    marginBottom: 4,
  },
  classGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 4 },
  classChip: {
    backgroundColor: colors.background,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    overflow: 'hidden',
  },
  classChipActive: { backgroundColor: colors.navy, borderColor: colors.navy },
  classChipContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    minHeight: 40,
  },
  classChipText: { fontSize: 12, fontWeight: '700', color: colors.navy },
  classChipTextActive: { color: colors.white },
});
