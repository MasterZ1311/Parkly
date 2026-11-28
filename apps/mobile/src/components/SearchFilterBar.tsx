import React, { useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, theme } from '../constants/theme';
import { CHIP_LAYOUT_TRANSITION, PressScale, triggerHaptic } from './Motion';
import {
  ARRIVAL_OPTIONS,
  DURATION_OPTIONS,
  formatArrivalSummary,
  type SearchAmenitiesFilter,
  useSearchStore,
} from '../store/search.store';
import type { DriverVehicle } from '../store/driver.store';

interface SearchFilterBarProps {
  defaultVehicle?: DriverVehicle;
  compact?: boolean;
  onApply?: () => void;
}

const AMENITY_CHIPS: Array<{
  key: keyof SearchAmenitiesFilter;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
}> = [
  { key: 'evOnly', label: 'EV Ready', icon: 'flash-outline' },
  { key: 'coveredOnly', label: 'Covered', icon: 'umbrella-outline' },
  { key: 'gatedOnly', label: 'Gated', icon: 'shield-checkmark-outline' },
];

export function SearchFilterBar({
  defaultVehicle,
  compact = false,
  onApply,
}: SearchFilterBarProps) {
  const {
    arrivalOffsetMinutes,
    durationHours,
    amenities,
    matchDefaultVehicle,
    setArrivalOffset,
    setDurationHours,
    toggleAmenity,
    setMatchDefaultVehicle,
    resetFilters,
  } = useSearchStore();

  const [sheetOpen, setSheetOpen] = useState(false);
  const insets = useSafeAreaInsets();

  const handleToggleAmenity = (key: keyof SearchAmenitiesFilter) => {
    toggleAmenity(key);
    onApply?.();
  };

  return (
    <>
      <View style={[styles.wrap, compact && styles.wrapCompact]}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={[styles.scrollContent, compact && styles.scrollCompact]}
        >
          <Animated.View layout={CHIP_LAYOUT_TRANSITION}>
            <PressScale
              onPress={() => setSheetOpen(true)}
              haptic="selection"
              style={[styles.timingChip, compact && styles.chipCompact]}
              contentStyle={[styles.chipInner, compact && styles.chipInnerCompact]}
              accessibilityLabel="Configure arrival time, parking duration, and vehicle filter"
            >
              <Ionicons name="time-outline" size={14} color={colors.white} />
              <Text style={styles.timingText}>
                {formatArrivalSummary(arrivalOffsetMinutes)} · {durationHours}h
              </Text>
              <Ionicons name="chevron-down" size={13} color="#CBD5E1" />
            </PressScale>
          </Animated.View>

          {AMENITY_CHIPS.map((chip) => {
            const active = amenities[chip.key];
            return (
              <Animated.View key={chip.key} layout={CHIP_LAYOUT_TRANSITION}>
                <PressScale
                  onPress={() => handleToggleAmenity(chip.key)}
                  haptic="selection"
                  accessibilityState={{ selected: active }}
                  rippleColor={active ? colors.rippleLight : colors.rippleDark}
                  style={[
                    styles.filterChip,
                    compact && styles.chipCompact,
                    active && styles.filterChipActive,
                  ]}
                  contentStyle={[styles.chipInner, compact && styles.chipInnerCompact]}
                >
                  <Ionicons
                    name={chip.icon}
                    size={14}
                    color={active ? colors.white : colors.textSecondary}
                  />
                  <Text style={[styles.filterText, active && styles.filterTextActive]}>
                    {chip.label}
                  </Text>
                </PressScale>
              </Animated.View>
            );
          })}
        </ScrollView>
      </View>

      <Modal
        visible={sheetOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setSheetOpen(false)}
      >
        <View style={styles.modalBackdrop}>
          <Pressable style={styles.modalDismiss} onPress={() => setSheetOpen(false)} />
          <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom + 18, 28) }]}>
            <View style={styles.handle} />
            <View style={styles.sheetHeader}>
              <View>
                <Text style={styles.sheetTitle}>Parking Window &amp; Filters</Text>
                <Text style={styles.sheetSub}>Synced across Home discovery &amp; Chennai Map</Text>
              </View>
              <PressScale
                onPress={() => {
                  resetFilters();
                  triggerHaptic('selection');
                }}
                style={styles.resetBtn}
                contentStyle={styles.resetInner}
              >
                <Text style={styles.resetText}>Reset</Text>
              </PressScale>
            </View>

            <Text style={styles.groupLabel}>ARRIVAL TIME</Text>
            <View style={styles.optionRow}>
              {ARRIVAL_OPTIONS.map((opt) => {
                const active = arrivalOffsetMinutes === opt.offsetMinutes;
                return (
                  <PressScale
                    key={opt.offsetMinutes}
                    haptic="selection"
                    accessibilityState={{ selected: active }}
                    style={[styles.optionPill, active && styles.optionPillActive]}
                    contentStyle={styles.optionPillInner}
                    onPress={() => setArrivalOffset(opt.offsetMinutes)}
                  >
                    <Text style={[styles.optionText, active && styles.optionTextActive]}>
                      {opt.label}
                    </Text>
                  </PressScale>
                );
              })}
            </View>

            <Text style={styles.groupLabel}>PARKING DURATION</Text>
            <View style={styles.optionRow}>
              {DURATION_OPTIONS.map((hrs) => {
                const active = durationHours === hrs;
                return (
                  <PressScale
                    key={hrs}
                    haptic="selection"
                    accessibilityState={{ selected: active }}
                    style={[styles.optionPill, active && styles.optionPillActive]}
                    contentStyle={styles.optionPillInner}
                    onPress={() => setDurationHours(hrs)}
                  >
                    <Text style={[styles.optionText, active && styles.optionTextActive]}>
                      {hrs}h
                    </Text>
                  </PressScale>
                );
              })}
            </View>

            {defaultVehicle && (
              <View style={styles.vehicleRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.vehicleTitle}>
                    Fit {defaultVehicle.vehicleType.toUpperCase()} ({defaultVehicle.licensePlate})
                  </Text>
                  <Text style={styles.vehicleDesc}>
                    Filter compatible bays using your default vehicle clearance
                  </Text>
                </View>
                <Switch
                  value={matchDefaultVehicle}
                  onValueChange={(next) => {
                    triggerHaptic('selection');
                    setMatchDefaultVehicle(next);
                  }}
                  trackColor={{ false: colors.borderStrong, true: colors.primary }}
                  thumbColor={colors.white}
                />
              </View>
            )}

            <PressScale
              style={styles.applyBtn}
              contentStyle={styles.applyInner}
              rippleColor={colors.rippleLight}
              haptic="medium"
              onPress={() => {
                setSheetOpen(false);
                onApply?.();
              }}
            >
              <Text style={styles.applyText}>Apply Search Filters</Text>
            </PressScale>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: 8 },
  wrapCompact: { marginBottom: 6 },
  scrollContent: { flexDirection: 'row', paddingHorizontal: 16, gap: 8 },
  scrollCompact: { paddingHorizontal: 0 },
  timingChip: {
    backgroundColor: colors.navy,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.navy,
    overflow: 'hidden',
  },
  filterChip: {
    backgroundColor: colors.surface,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  chipCompact: { borderRadius: 9 },
  chipInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 13,
    minHeight: 48,
  },
  chipInnerCompact: { minHeight: 48, paddingHorizontal: 11 },
  timingText: { color: colors.white, fontSize: 12.5, fontWeight: '800', fontVariant: ['tabular-nums'] },
  filterText: { color: colors.textSecondary, fontSize: 12.5, fontWeight: '700' },
  filterChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  filterTextActive: { color: colors.white },
  modalBackdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(11, 22, 40, 0.45)',
  },
  modalDismiss: { flex: 1 },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    paddingHorizontal: 20,
    paddingTop: 12,
    borderTopWidth: 1,
    borderColor: colors.border,
    ...theme.elevation.sheet,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.borderStrong,
    alignSelf: 'center',
    marginBottom: 14,
  },
  sheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sheetTitle: { color: colors.navy, fontSize: 18, fontWeight: '800' },
  sheetSub: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
  resetBtn: {
    backgroundColor: colors.cardElevated,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  resetInner: { minHeight: 40, paddingHorizontal: 12, justifyContent: 'center' },
  resetText: { color: colors.navy, fontSize: 12.5, fontWeight: '700' },
  groupLabel: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.9,
    marginBottom: 8,
  },
  optionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  optionPill: {
    backgroundColor: colors.cardElevated,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  optionPillActive: { backgroundColor: colors.navy, borderColor: colors.navy },
  optionPillInner: { minHeight: 48, paddingHorizontal: 16, justifyContent: 'center', alignItems: 'center' },
  optionText: { color: colors.navy, fontSize: 13.5, fontWeight: '700', fontVariant: ['tabular-nums'] },
  optionTextActive: { color: colors.white },
  vehicleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.cardElevated,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
    marginBottom: 16,
  },
  vehicleTitle: { color: colors.navy, fontSize: 13.5, fontWeight: '800' },
  vehicleDesc: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
  applyBtn: { backgroundColor: colors.primary, borderRadius: 12, overflow: 'hidden' },
  applyInner: { minHeight: 50, justifyContent: 'center', alignItems: 'center' },
  applyText: { color: colors.white, fontSize: 15, fontWeight: '800' },
});
