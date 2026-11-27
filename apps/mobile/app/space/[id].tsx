import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { searchApi, pricingApi } from '../../src/api/client';
import { colors, theme } from '../../src/constants/theme';
import { ENTER_FADE_UP, PressScale, SkeletonBlock } from '../../src/components/Motion';

interface SpaceDetails {
  id: string;
  name: string;
  address: string;
  hostId?: string;
  totalCapacity: number;
  amenities: { evCharging: boolean; covered: boolean; securityLevel: string };
  price: { value: number; currency: string };
  availability: { probabilityPercent: number };
  photoUrls: string[];
}

const SECURITY_LABELS: Record<string, string> = {
  none: 'Standard',
  basic: 'Basic Guard',
  monitored: 'CCTV Monitored',
  staffed: 'Attendant Staffed',
  gated: 'Boom Gated',
};

export default function SpaceDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [space, setSpace] = useState<SpaceDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedHours, setSelectedHours] = useState(2);
  const insets = useSafeAreaInsets();

  useEffect(() => {
    loadSpace();
  }, [id]);

  const loadSpace = async () => {
    if (!id || id === 'not-found' || id === 'unavailable') {
      setSpace(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const response = await searchApi.getSpace(id);
      const data = response.data?.data;
      if (data) {
        let priceVal = typeof data.hourlyRate === 'number' ? data.hourlyRate : 40;
        try {
          const priceResp = await pricingApi.getPrice(id, new Date().toISOString());
          if (priceResp.data?.data?.effectiveRate) {
            priceVal = priceResp.data.data.effectiveRate;
          }
        } catch {
          // Dynamic pricing fallback
        }

        setSpace({
          id: data.id,
          name: data.name,
          address: data.address,
          hostId: data.hostId,
          totalCapacity: data.totalCapacity || 10,
          amenities: {
            evCharging: Boolean(data.evCharging),
            covered: Boolean(data.covered),
            securityLevel: data.securityLevel || 'none',
          },
          price: { value: priceVal, currency: 'INR' },
          availability: { probabilityPercent: 85 },
          photoUrls: data.photoUrls || [],
        });
        return;
      }
    } catch (err) {
      console.warn('Could not fetch live space, falling back to local dataset:', err);
    } finally {
      setLoading(false);
    }

    setSpace({
      id: id!,
      name: id === 'sp-tng-001' ? 'Express Avenue Premium Parking' : 'T Nagar Parking Complex',
      address: id === 'sp-tng-001' ? 'Royapettah / T Nagar Hub, Chennai' : '23, Panagal Park Road, T Nagar, Chennai 600017',
      hostId: 'host-chennai-001',
      totalCapacity: 25,
      amenities: { evCharging: true, covered: true, securityLevel: 'gated' },
      price: { value: id === 'sp-tng-001' ? 60 : 40, currency: 'INR' },
      availability: { probabilityPercent: 88 },
      photoUrls: [],
    });
  };

  const totalCost = space ? space.price.value * selectedHours : 0;
  const feeAmount = Math.round(totalCost * 0.05);

  const handleBook = () => {
    if (!space) return;
    router.push({
      pathname: '/booking/create',
      params: {
        spaceId: space.id,
        spaceName: space.name,
        hostId: space.hostId || 'host-chennai-001',
        hours: selectedHours,
        totalAmount: totalCost,
        hourlyRate: space.price.value,
      },
    });
  };

  if (loading) {
    return (
      <View style={[styles.container, { paddingTop: Math.max(insets.top + 16, 32), paddingHorizontal: 16, gap: 16 }]}>
        <StatusBar style="dark" backgroundColor={colors.background} />
        <SkeletonBlock height={180} borderRadius={16} />
        <SkeletonBlock height={110} />
        <SkeletonBlock height={140} />
      </View>
    );
  }

  if (!space) {
    return (
      <ScrollView
        style={styles.container}
        contentContainerStyle={{
          flexGrow: 1,
          paddingTop: Math.max(insets.top + 16, 36),
          paddingBottom: Math.max(insets.bottom + 24, 36),
          paddingHorizontal: 18,
          justifyContent: 'center',
        }}
      >
        <StatusBar style="dark" backgroundColor={colors.background} />
        <View
          style={{
            backgroundColor: colors.surface,
            borderRadius: 18,
            borderWidth: 1,
            borderColor: colors.border,
            padding: 24,
            alignItems: 'center',
            gap: 10,
            ...theme.elevation.card,
          }}
        >
          <View
            style={{
              width: 64,
              height: 64,
              borderRadius: 16,
              backgroundColor: colors.primaryLight,
              borderWidth: 1,
              borderColor: colors.primaryBorder,
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 4,
            }}
          >
            <Ionicons name="alert-circle-outline" size={30} color={colors.primary} />
          </View>
          <Text style={{ color: colors.navy, fontSize: 20, fontWeight: '800', textAlign: 'center' }}>
            Parking Space Unavailable
          </Text>
          <Text style={{ color: colors.textSecondary, fontSize: 14, lineHeight: 20, textAlign: 'center', marginBottom: 8 }}>
            This Chennai bay listing is currently offline, unlisted by its host, or the shared link is invalid.
          </Text>
          <View style={{ width: '100%', gap: 10 }}>
            <PressScale
              style={{ backgroundColor: colors.primary, borderRadius: 12, overflow: 'hidden' }}
              contentStyle={{ minHeight: 48, alignItems: 'center', justifyContent: 'center' }}
              rippleColor={colors.rippleLight}
              onPress={() => router.replace('/(tabs)/map')}
            >
              <Text style={{ color: colors.white, fontSize: 15, fontWeight: '800' }}>Explore Nearby Map</Text>
            </PressScale>
            <PressScale
              style={{
                backgroundColor: colors.surface,
                borderRadius: 12,
                borderWidth: 1,
                borderColor: colors.borderStrong,
                overflow: 'hidden',
              }}
              contentStyle={{ minHeight: 48, alignItems: 'center', justifyContent: 'center' }}
              onPress={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)/home'))}
            >
              <Text style={{ color: colors.navy, fontSize: 14.5, fontWeight: '700' }}>Back to Search</Text>
            </PressScale>
          </View>
        </View>
      </ScrollView>
    );
  }

  const highAvail = space.availability.probabilityPercent > 60;

  return (
    <View style={styles.container}>
      <StatusBar style="light" backgroundColor={colors.navy} />

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Architectural Facility Header */}
        <View style={[styles.imageArea, { paddingTop: Math.max(insets.top + 8, 20) }]}>
          <PressScale
            style={styles.backBtn}
            contentStyle={styles.backBtnContent}
            rippleColor={colors.rippleLight}
            onPress={() => router.back()}
            accessibilityLabel="Go back"
          >
            <Ionicons name="arrow-back" size={20} color={colors.white} />
          </PressScale>

          <View style={styles.heroBanner}>
            <View style={styles.heroIconWrap}>
              <Ionicons name="car-sport" size={40} color={colors.navy} />
            </View>
            <Text style={styles.heroTag}>VERIFIED OFF-STREET HUB · {space.totalCapacity} BAYS</Text>
          </View>
        </View>

        <Animated.View entering={ENTER_FADE_UP} style={[styles.content, { paddingBottom: 110 + insets.bottom }]}>
          <View style={styles.header}>
            <View style={{ flex: 1 }}>
              <Text style={styles.name}>{space.name}</Text>
              <Text style={styles.address}>{space.address}</Text>
            </View>
            <View
              style={[
                styles.availBadge,
                {
                  backgroundColor: highAvail ? colors.successLight : colors.warningLight,
                  borderColor: highAvail ? colors.successBorder : colors.warningBorder,
                },
              ]}
            >
              <View
                style={[
                  styles.availDot,
                  { backgroundColor: highAvail ? colors.success : colors.warning },
                ]}
              />
              <Text style={[styles.availText, { color: highAvail ? colors.success : colors.warning }]}>
                {space.availability.probabilityPercent}% free
              </Text>
            </View>
          </View>

          <View style={styles.priceRow}>
            <Text style={styles.price}>₹{space.price.value}</Text>
            <Text style={styles.priceUnit}>/hour</Text>
          </View>

          {/* Amenities */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Facility Amenities</Text>
            <View style={styles.amenitiesGrid}>
              <View style={styles.amenityItem}>
                <Ionicons
                  name="flash"
                  size={18}
                  color={space.amenities.evCharging ? colors.info : colors.textMuted}
                />
                <Text style={[styles.amenityLabel, !space.amenities.evCharging && styles.amenityDisabled]}>
                  EV Charging
                </Text>
              </View>
              <View style={styles.amenityItem}>
                <Ionicons
                  name="umbrella"
                  size={18}
                  color={space.amenities.covered ? colors.navy : colors.textMuted}
                />
                <Text style={[styles.amenityLabel, !space.amenities.covered && styles.amenityDisabled]}>
                  Covered
                </Text>
              </View>
              <View style={styles.amenityItem}>
                <Ionicons name="shield-checkmark" size={18} color={colors.success} />
                <Text style={styles.amenityLabel}>
                  {SECURITY_LABELS[space.amenities.securityLevel] || 'Gated'}
                </Text>
              </View>
              <View style={styles.amenityItem}>
                <Ionicons name="car" size={18} color={colors.navy} />
                <Text style={styles.amenityLabel}>{space.totalCapacity} slots</Text>
              </View>
            </View>
          </View>

          {/* Duration Selector */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Duration</Text>
            <View style={styles.durationRow}>
              {[1, 2, 3, 4, 6, 8].map((h) => {
                const active = selectedHours === h;
                return (
                  <PressScale
                    key={h}
                    haptic="selection"
                    accessibilityState={{ selected: active }}
                    rippleColor={active ? colors.rippleLight : colors.rippleDark}
                    style={[styles.durationChip, active && styles.durationChipActive]}
                    contentStyle={styles.durationChipContent}
                    onPress={() => setSelectedHours(h)}
                  >
                    <Text style={[styles.durationText, active && styles.durationTextActive]}>
                      {h}h
                    </Text>
                  </PressScale>
                );
              })}
            </View>
          </View>

          {/* Tariff Breakdown */}
          <View style={styles.summary}>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>
                Parking (₹{space.price.value} × {selectedHours} hours)
              </Text>
              <Text style={styles.summaryValue}>₹{totalCost}</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Platform fee (5%)</Text>
              <Text style={styles.summaryValue}>₹{feeAmount}</Text>
            </View>
            <View style={styles.summaryTotalRow}>
              <Text style={styles.summaryTotalLabel}>Total Payable</Text>
              <Text style={styles.summaryTotalValue}>₹{totalCost + feeAmount}</Text>
            </View>
          </View>
        </Animated.View>
      </ScrollView>

      {/* Sticky Footer */}
      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom + 12, 20) }]}>
        <PressScale
          style={styles.bookBtn}
          contentStyle={styles.bookBtnContent}
          rippleColor={colors.rippleLight}
          haptic="medium"
          onPress={handleBook}
        >
          <Text style={styles.bookBtnText}>Book Bay — ₹{totalCost + feeAmount}</Text>
        </PressScale>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background },
  imageArea: {
    backgroundColor: colors.navy,
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  backBtn: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: colors.navySurface,
    borderWidth: 1,
    borderColor: colors.navyBorder,
    overflow: 'hidden',
    marginBottom: 16,
  },
  backBtnContent: {
    width: 48,
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
  },
  heroBanner: {
    alignItems: 'center',
    gap: 10,
  },
  heroIconWrap: {
    width: 72,
    height: 72,
    borderRadius: 18,
    backgroundColor: colors.white,
    justifyContent: 'center',
    alignItems: 'center',
  },
  heroTag: {
    color: '#9FB0C7',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
    fontVariant: ['tabular-nums'],
  },
  content: { padding: 18 },
  header: { flexDirection: 'row', gap: 12, marginBottom: 10, alignItems: 'flex-start' },
  name: { fontSize: 21, fontWeight: '800', color: colors.navy, marginBottom: 4 },
  address: { fontSize: 13.5, color: colors.textMuted, lineHeight: 19 },
  availBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  availDot: { width: 7, height: 7, borderRadius: 3.5 },
  availText: { fontSize: 12, fontWeight: '800', fontVariant: ['tabular-nums'] },
  priceRow: { flexDirection: 'row', alignItems: 'baseline', gap: 4, marginBottom: 22 },
  price: { fontSize: 32, fontWeight: '800', color: colors.primary, fontVariant: ['tabular-nums'] },
  priceUnit: { fontSize: 14, color: colors.textMuted, fontWeight: '600' },
  section: { marginBottom: 22 },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.textMuted,
    marginBottom: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  amenitiesGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  amenityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.surface,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  amenityLabel: { color: colors.navy, fontSize: 13, fontWeight: '700' },
  amenityDisabled: { color: colors.textMuted, fontWeight: '500' },
  durationRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  durationChip: {
    minWidth: 54,
    borderRadius: 10,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    overflow: 'hidden',
  },
  durationChipContent: {
    minHeight: 48,
    paddingHorizontal: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  durationChipActive: { backgroundColor: colors.navy, borderColor: colors.navy },
  durationText: { color: colors.textSecondary, fontSize: 14.5, fontWeight: '700', fontVariant: ['tabular-nums'] },
  durationTextActive: { color: colors.white },
  summary: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    padding: 16,
    gap: 10,
    borderWidth: 1,
    borderColor: colors.border,
    ...theme.elevation.card,
  },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  summaryLabel: { color: colors.textMuted, fontSize: 13.5, fontWeight: '500' },
  summaryValue: { color: colors.navy, fontSize: 14, fontWeight: '700', fontVariant: ['tabular-nums'] },
  summaryTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 12,
  },
  summaryTotalLabel: { color: colors.navy, fontSize: 15, fontWeight: '800' },
  summaryTotalValue: { color: colors.primary, fontSize: 20, fontWeight: '800', fontVariant: ['tabular-nums'] },
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
  },
  bookBtn: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    overflow: 'hidden',
  },
  bookBtnContent: {
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bookBtnText: { color: colors.white, fontSize: 16, fontWeight: '800', fontVariant: ['tabular-nums'] },
});
