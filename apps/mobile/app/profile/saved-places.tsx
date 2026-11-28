import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  Alert,
  Modal,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useDriverStore, type SavedPlace } from '../../src/store/driver.store';
import { colors, theme } from '../../src/constants/theme';
import { ENTER_FADE_UP, PressScale, triggerHaptic } from '../../src/components/Motion';

const CHENNAI_PRESETS: Array<{ label: string; address: string; areaQuery: string; lat: number; lng: number }> = [
  { label: 'Shopping · T Nagar', address: 'Panagal Park Road, T Nagar, Chennai', areaQuery: 'T Nagar', lat: 13.0418, lng: 80.2341 },
  { label: 'Work · OMR IT Corridor', address: 'Tidel Park / Taramani, OMR', areaQuery: 'OMR', lat: 12.9896, lng: 80.2498 },
  { label: 'Dining · Anna Nagar', address: '2nd Avenue, Anna Nagar East, Chennai', areaQuery: 'Anna Nagar', lat: 13.085, lng: 80.2101 },
  { label: 'Adyar Signal Hub', address: 'LB Road, Gandhi Nagar, Adyar', areaQuery: 'Adyar', lat: 13.0067, lng: 80.2566 },
];

const KIND_ICON: Record<SavedPlace['kind'], keyof typeof Ionicons.glyphMap> = {
  home: 'home-outline',
  work: 'briefcase-outline',
  favorite: 'bookmark-outline',
};

export default function SavedPlacesScreen() {
  const { savedPlaces, loadSavedPlaces, addSavedPlace, removeSavedPlace } = useDriverStore();
  const [modalVisible, setModalVisible] = useState(false);
  const [label, setLabel] = useState('');
  const [address, setAddress] = useState('');
  const [areaQuery, setAreaQuery] = useState('');
  const [kind, setKind] = useState<SavedPlace['kind']>('favorite');
  const insets = useSafeAreaInsets();

  useFocusEffect(
    useCallback(() => {
      loadSavedPlaces().catch(() => {});
    }, [loadSavedPlaces]),
  );

  const handleAdd = async () => {
    const cleanLabel = label.trim();
    const cleanQuery = areaQuery.trim() || address.trim();
    if (!cleanLabel || !cleanQuery) {
      Alert.alert('Missing Details', 'Enter both a shortcut label and a Chennai area or street.');
      return;
    }

    await addSavedPlace({
      label: cleanLabel,
      address: address.trim() || `${cleanQuery}, Chennai`,
      areaQuery: cleanQuery,
      lat: 13.0418,
      lng: 80.2341,
      kind,
    });
    triggerHaptic('success');
    setLabel('');
    setAddress('');
    setAreaQuery('');
    setKind('favorite');
    setModalVisible(false);
  };

  const handleDelete = (place: SavedPlace) => {
    Alert.alert('Remove Saved Place', `Remove "${place.label}" from quick shortcuts?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          await removeSavedPlace(place.id);
          triggerHaptic('medium');
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
        <Text style={styles.appBarTitle}>Saved Places</Text>
        <PressScale
          style={styles.iconButton}
          contentStyle={styles.iconButtonContent}
          rippleColor={colors.rippleLight}
          onPress={() => setModalVisible(true)}
          accessibilityLabel="Add saved place"
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
            Tap any saved hub to jump straight to live bay availability in that Chennai neighborhood.
          </Text>

          {savedPlaces.length === 0 ? (
            <View style={styles.emptyCard}>
              <Ionicons name="location-outline" size={34} color={colors.textMuted} />
              <Text style={styles.emptyTitle}>No Saved Destinations</Text>
              <Text style={styles.emptyDesc}>
                Add Home, Work, or your frequent Chennai shopping hubs for one-tap search.
              </Text>
            </View>
          ) : (
            savedPlaces.map((place) => (
              <View key={place.id} style={styles.placeCard}>
                <PressScale
                  style={styles.placeTapArea}
                  contentStyle={styles.placeTapContent}
                  onPress={() =>
                    router.push({ pathname: '/(tabs)/home', params: { area: place.areaQuery } })
                  }
                >
                  <View style={styles.kindIconBox}>
                    <Ionicons
                      name={KIND_ICON[place.kind] || 'bookmark-outline'}
                      size={20}
                      color={colors.navy}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.placeLabel}>{place.label}</Text>
                    <Text style={styles.placeAddress}>{place.address}</Text>
                    <Text style={styles.placeQuery}>Search query: {place.areaQuery}</Text>
                  </View>
                  <Ionicons name="arrow-forward-circle-outline" size={20} color={colors.primary} />
                </PressScale>

                <PressScale
                  style={styles.deleteBtn}
                  contentStyle={styles.deleteBtnInner}
                  onPress={() => handleDelete(place)}
                  accessibilityLabel={`Remove ${place.label}`}
                >
                  <Ionicons name="trash-outline" size={16} color={colors.danger} />
                  <Text style={styles.deleteText}>Remove</Text>
                </PressScale>
              </View>
            ))
          )}

          <PressScale
            style={styles.primaryBtn}
            contentStyle={styles.btnInner}
            rippleColor={colors.rippleLight}
            onPress={() => setModalVisible(true)}
          >
            <Ionicons name="add-circle-outline" size={18} color={colors.white} />
            <Text style={styles.primaryBtnText}>Add Chennai Place</Text>
          </PressScale>
        </Animated.View>
      </ScrollView>

      <Modal
        visible={modalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalBackdrop}
        >
          <View style={[styles.modalSheet, { paddingBottom: Math.max(insets.bottom + 20, 28) }]}>
            <Text style={styles.modalTitle}>Add Saved Destination</Text>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, marginBottom: 4 }}>
              {CHENNAI_PRESETS.map((preset) => (
                <PressScale
                  key={preset.areaQuery}
                  style={styles.presetChip}
                  contentStyle={styles.presetChipContent}
                  onPress={() => {
                    setLabel(preset.label);
                    setAddress(preset.address);
                    setAreaQuery(preset.areaQuery);
                  }}
                >
                  <Text style={styles.presetText}>{preset.areaQuery}</Text>
                </PressScale>
              ))}
            </ScrollView>

            <Text style={styles.inputLabel}>Category</Text>
            <View style={{ flexDirection: 'row', gap: 8, marginBottom: 4 }}>
              {(['home', 'work', 'favorite'] as const).map((k) => {
                const active = kind === k;
                return (
                  <PressScale
                    key={k}
                    style={[styles.kindChip, active && styles.kindChipActive]}
                    contentStyle={styles.kindChipContent}
                    onPress={() => setKind(k)}
                  >
                    <Text style={[styles.kindChipText, active && styles.kindChipTextActive]}>
                      {k.charAt(0).toUpperCase() + k.slice(1)}
                    </Text>
                  </PressScale>
                );
              })}
            </View>

            <Text style={styles.inputLabel}>Label *</Text>
            <TextInput
              style={styles.input}
              value={label}
              onChangeText={setLabel}
              placeholder="Home · Adyar"
              placeholderTextColor={colors.textMuted}
            />

            <Text style={styles.inputLabel}>Chennai Area / Corridor *</Text>
            <TextInput
              style={styles.input}
              value={areaQuery}
              onChangeText={setAreaQuery}
              placeholder="Adyar"
              placeholderTextColor={colors.textMuted}
            />

            <Text style={styles.inputLabel}>Street / Landmark</Text>
            <TextInput
              style={styles.input}
              value={address}
              onChangeText={setAddress}
              placeholder="Gandhi Nagar 1st Main Road"
              placeholderTextColor={colors.textMuted}
            />

            <PressScale
              style={[styles.primaryBtn, { marginTop: 8 }]}
              contentStyle={styles.btnInner}
              rippleColor={colors.rippleLight}
              onPress={handleAdd}
            >
              <Text style={styles.primaryBtnText}>Save Place</Text>
            </PressScale>

            <PressScale
              style={styles.cancelBtn}
              contentStyle={styles.btnInner}
              onPress={() => setModalVisible(false)}
            >
              <Text style={styles.cancelBtnText}>Cancel</Text>
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
  placeCard: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
    ...theme.elevation.card,
  },
  placeTapArea: { overflow: 'hidden' },
  placeTapContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
  },
  kindIconBox: {
    width: 42,
    height: 42,
    borderRadius: 10,
    backgroundColor: colors.cardElevated,
    borderWidth: 1,
    borderColor: colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeLabel: { color: colors.navy, fontSize: 15, fontWeight: '800', marginBottom: 2 },
  placeAddress: { color: colors.textSecondary, fontSize: 12.5, lineHeight: 17 },
  placeQuery: { color: colors.primary, fontSize: 11.5, fontWeight: '700', marginTop: 3 },
  deleteBtn: {
    borderTopWidth: 1,
    borderTopColor: colors.cardElevated,
    backgroundColor: colors.dangerLight,
  },
  deleteBtnInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    minHeight: 40,
  },
  deleteText: { color: colors.danger, fontSize: 12.5, fontWeight: '700' },
  primaryBtn: { backgroundColor: colors.primary, borderRadius: 12, overflow: 'hidden', marginTop: 6 },
  btnInner: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 18,
  },
  primaryBtnText: { color: colors.white, fontSize: 15, fontWeight: '800' },
  cancelBtn: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    overflow: 'hidden',
  },
  cancelBtnText: { color: colors.navy, fontSize: 14.5, fontWeight: '700' },
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
  presetChip: {
    backgroundColor: colors.cardElevated,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  presetChipContent: { paddingHorizontal: 12, minHeight: 36, justifyContent: 'center' },
  presetText: { fontSize: 12, fontWeight: '700', color: colors.navy },
  kindChip: {
    flex: 1,
    backgroundColor: colors.background,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    overflow: 'hidden',
  },
  kindChipActive: { backgroundColor: colors.navy, borderColor: colors.navy },
  kindChipContent: { minHeight: 42, alignItems: 'center', justifyContent: 'center' },
  kindChipText: { fontSize: 12.5, fontWeight: '700', color: colors.navy },
  kindChipTextActive: { color: colors.white },
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
    fontWeight: '600',
    marginBottom: 4,
  },
});
