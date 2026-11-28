import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { searchApi, pricingApi, type SpaceType } from '../../src/api/client';
import { colors, theme } from '../../src/constants/theme';
import { ENTER_FADE_UP, PressScale, SkeletonBlock } from '../../src/components/Motion';
import { OfflineBanner } from '../../src/components/OfflineBanner';
import { useAuthStore } from '../../src/store/auth.store';
import { hostSpaceToDemoItem, useHostStore } from '../../src/store/host.store';
import { computeArrivalIso, useSearchStore } from '../../src/store/search.store';
import { DEMO_SPACES, getSpaceTypeMeta } from '../../src/data/demoFixtures';
import { cacheGet, CACHE_KEYS } from '../../src/utils/cache';
import { classifyApiError, type ClassifiedApiError } from '../../src/utils/apiErrors';

interface SpaceDetails {
  id: string;
  name: string;
  spaceType?: SpaceType;
  entryInstructions?: string;
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
  const { id, hours, arrivalTime } = useLocalSearchParams<{
    id: string;
    hours?: string;
    arrivalTime?: string;
  }>();
  const initialDuration = (() => {
    const parsed = Number(hours);
    if (Number.isFinite(parsed) && [1, 2, 3, 4, 6, 8].includes(parsed)) {
      return parsed;
    }
    return useSearchStore.getState().durationHours || 2;
  })();
  const effectiveArrivalIso =
    arrivalTime && Number.isFinite(Date.parse(arrivalTime))
      ? arrivalTime
      : computeArrivalIso(useSearchStore.getState().arrivalOffsetMinutes);

  const [space, setSpace] = useState<SpaceDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [isCachedView, setIsCachedView] = useState(false);
  const [loadError, setLoadError] = useState<ClassifiedApiError | null>(null);
  const [selectedHours, setSelectedHours] = useState(initialDuration);
  const isDemoMode = useAuthStore((s) => s.isDemoMode);
  const insets = useSafeAreaInsets();

  const loadSpace = useCallback(async () => {
    if (!id || id === 'not-found' || id === 'unavailable') {
      setSpace(null);
      setLoadError(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setLoadError(null);
    setIsCachedView(false);

    if (isDemoMode) {
      await useHostStore.getState().loadMySpaces().catch(() => {});
      const demoPool = [
        ...useHostStore.getState().mySpaces.map(hostSpaceToDemoItem),
        ...DEMO_SPACES,
      ];
      const foundDemo = demoPool.find((s) => s.id === id) || demoPool[0];
      setSpace({
        id: foundDemo.id,
        name: foundDemo.name,
        spaceType: foundDemo.spaceType,
        entryInstructions: foundDemo.entryInstructions,
        address: foundDemo.address,
        hostId: foundDemo.hostId,
        totalCapacity: foundDemo.totalCapacity,
        amenities: foundDemo.amenities,
        price: { value: foundDemo.price.value, currency: 'INR' },
        availability: { probabilityPercent: foundDemo.availability.probabilityPercent },
        photoUrls: [],
      });
      setLoading(false);
      return;
    }

    try {
      const response = await searchApi.getSpace(id);
      const data = response.data?.data;
      if (data) {
        const parsedRate = Number(data.hourlyRate ?? data.price?.value);
        let priceVal = Number.isFinite(parsedRate) && parsedRate > 0 ? parsedRate : 40;
        try {
          const priceResp = await pricingApi.getPrice(id, effectiveArrivalIso);
          const dynamicRate = Number(priceResp.data?.data?.effectiveRate);
          if (Number.isFinite(dynamicRate) && dynamicRate > 0) {
            priceVal = dynamicRate;
          }
        } catch {
          // Base hourly rate remains authoritative if pricing quote call fails
        }

        const parsedCap = Number(data.totalCapacity);
        setSpace({
          id: data.id,
          name: data.name,
          spaceType: data.spaceType,
          entryInstructions: data.entryInstructions,
          address: data.address,
          hostId: data.hostId,
          totalCapacity: Number.isFinite(parsedCap) && parsedCap > 0 ? parsedCap : 10,
          amenities: {
            evCharging: Boolean(data.evCharging),
            covered: Boolean(data.covered),
            securityLevel: data.securityLevel || 'none',
          },
          price: { value: priceVal, currency: 'INR' },
          availability: {
            probabilityPercent: Number(data.availability?.probabilityPercent ?? 85),
          },
          photoUrls: data.photoUrls || [],
        });
        return;
      }

      setSpace(null);
      setLoadError({
        kind: 'not-found',
        message: 'Parking space details could not be found.',
      });
    } catch (err: unknown) {
      const classified = classifyApiError(err, 'Unable to load parking space details.');
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

      if (classified.kind === 'offline') {
        try {
          const cachedSpaces = await cacheGet<any[]>(CACHE_KEYS.CACHED_SPACES);
          const cachedMatch = cachedSpaces?.find((s) => s.id === id);
          if (cachedMatch) {
            const cachedRate = Number(cachedMatch.price?.value ?? cachedMatch.hourlyRate ?? 40);
            setSpace({
              id: cachedMatch.id,
              name: cachedMatch.name,
              spaceType: cachedMatch.spaceType,
              entryInstructions: cachedMatch.entryInstructions,
              address: cachedMatch.address,
              hostId: cachedMatch.hostId,
              totalCapacity: Number(cachedMatch.totalCapacity || 10),
              amenities: {
                evCharging: Boolean(cachedMatch.amenities?.evCharging ?? cachedMatch.evCharging),
                covered: Boolean(cachedMatch.amenities?.covered ?? cachedMatch.covered),
                securityLevel:
                  cachedMatch.amenities?.securityLevel ?? cachedMatch.securityLevel ?? 'none',
              },
              price: {
                value: Number.isFinite(cachedRate) && cachedRate > 0 ? cachedRate : 40,
                currency: 'INR',
              },
              availability: {
                probabilityPercent: Number(cachedMatch.availability?.probabilityPercent ?? 80),
              },
              photoUrls: cachedMatch.photoUrls || [],
            });
            setIsCachedView(true);
            return;
          }
        } catch {
          // Ignore cache error and present honest error card
        }
      }

      setSpace(null);
      setLoadError(classified);
    } finally {
      setLoading(false);
    }
  }, [id, isDemoMode, effectiveArrivalIso]);

  useEffect(() => {
    loadSpace();
  }, [loadSpace]);

  const totalCost = space ? space.price.value * selectedHours : 0;
  const feeAmount = Math.round(totalCost * 0.05);

  const handleBook = () => {
    if (!space) return;
    router.push({
      pathname: '/booking/create',
      params: {
        spaceId: space.id,
        spaceName: space.name,
        hostId: space.hostId || '',
        hours: String(selectedHours),
        totalAmount: String(totalCost),
        hourlyRate: String(space.price.value),
        arrivalTime: effectiveArrivalIso,
        spaceType: space.spaceType || 'commercial',
        entryInstructions: space.entryInstructions || '',
      },
    });
  };

  if (loading) {
    return (
      <View
        style={[
          styles.container,
          { paddingTop: Math.max(insets.top + 16, 32), paddingHorizontal: 16, gap: 16 },
        ]}
      >
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
        <View style={styles.unavailableCard}>
          <View style={styles.unavailableIconWrap}>
            <Ionicons
              name={loadError?.kind === 'offline' ? 'cloud-offline-outline' : 'alert-circle-outline'}
              size={30}
              color={colors.primary}
            />
          </View>
          <Text style={styles.unavailableTitle}>
            {loadError?.kind === 'offline' ? 'Unable to Reach Server' : 'Parking Space Unavailable'}
          </Text>
          <Text style={styles.unavailableDesc}>
            {loadError?.message ||
              'This Chennai bay listing is currently offline, unlisted by its host, or the link is invalid.'}
          </Text>
          <View style={{ width: '100%', gap: 10 }}>
            <PressScale
              style={styles.unavailablePrimaryBtn}
              contentStyle={styles.unavailableBtnInner}
              rippleColor={colors.rippleLight}
              onPress={loadSpace}
            >
              <Text style={styles.unavailablePrimaryText}>Retry</Text>
            </PressScale>
            {loadError?.statusRoute && (
              <PressScale
                style={styles.unavailableSecondaryBtn}
                contentStyle={styles.unavailableBtnInner}
                onPress={() => router.push(loadError.statusRoute!)}
              >
                <Text style={styles.unavailableSecondaryText}>Check Service Status</Text>
              </PressScale>
            )}
            <PressScale
              style={styles.unavailableSecondaryBtn}
              contentStyle={styles.unavailableBtnInner}
              onPress={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)/home'))}
            >
              <Text style={styles.unavailableSecondaryText}>Back to Search</Text>
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
              <Ionicons
                name={getSpaceTypeMeta(space.spaceType).isPrivate ? 'home' : 'car-sport'}
                size={40}
                color={colors.navy}
              />
            </View>
            <Text style={styles.heroTag}>
              {getSpaceTypeMeta(space.spaceType).isPrivate
                ? `${getSpaceTypeMeta(space.spaceType).label.toUpperCase()} · ${space.totalCapacity} SLOT${space.totalCapacity === 1 ? '' : 'S'}`
                : `VERIFIED CHENNAI BAY · ${space.totalCapacity} SLOTS`}
            </Text>
          </View>
        </View>

        <OfflineBanner
          visible={isCachedView}
          message="Showing cached space snapshot — verify rate when back online"
        />

        <Animated.View
          entering={ENTER_FADE_UP}
          style={[styles.content, { paddingBottom: 120 + insets.bottom }]}
        >
          {/* Header Info */}
          <View style={styles.header}>
            <View style={{ flex: 1 }}>
              <Text style={styles.name}>{space.name}</Text>
              <Text style={styles.address}>{space.address}</Text>
              {getSpaceTypeMeta(space.spaceType).isPrivate && (
                <View style={styles.privatePill}>
                  <Ionicons name="home-outline" size={12} color={colors.success} />
                  <Text style={styles.privatePillText}>
                    {getSpaceTypeMeta(space.spaceType).label}
                  </Text>
                </View>
              )}
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
              <Text
                style={[
                  styles.availText,
                  { color: highAvail ? colors.success : colors.warning },
                ]}
              >
                {space.availability.probabilityPercent}% open
              </Text>
            </View>
          </View>

          <View style={styles.priceRow}>
            <Text style={styles.price}>₹{space.price.value}</Text>
            <Text style={styles.priceUnit}>/hour</Text>
          </View>

          {/* Amenities */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Amenities</Text>
            <View style={styles.amenitiesGrid}>
              <View style={styles.amenityItem}>
                <Ionicons
                  name="flash"
                  size={18}
                  color={space.amenities.evCharging ? colors.success : colors.textMuted}
                />
                <Text
                  style={[
                    styles.amenityLabel,
                    !space.amenities.evCharging && styles.amenityDisabled,
                  ]}
                >
                  {space.amenities.evCharging ? 'EV Charging' : 'No EV'}
                </Text>
              </View>
              <View style={styles.amenityItem}>
                <Ionicons
                  name="umbrella"
                  size={18}
                  color={space.amenities.covered ? colors.navy : colors.textMuted}
                />
                <Text
                  style={[
                    styles.amenityLabel,
                    !space.amenities.covered && styles.amenityDisabled,
                  ]}
                >
                  {space.amenities.covered ? 'Covered Bay' : 'Open Air'}
                </Text>
              </View>
              <View style={styles.amenityItem}>
                <Ionicons name="shield-checkmark" size={18} color={colors.success} />
                <Text style={styles.amenityLabel}>
                  {SECURITY_LABELS[space.amenities.securityLevel] ||
                    space.amenities.securityLevel}
                </Text>
              </View>
            </View>
          </View>

          {(space.entryInstructions || getSpaceTypeMeta(space.spaceType).isPrivate) && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Host Arrival & Entry Instructions</Text>
              <View style={styles.instructionsCard}>
                <Ionicons name="key-outline" size={18} color={colors.navy} />
                <Text style={styles.instructionsText}>
                  {space.entryInstructions ||
                    'Private residential parking space. Ring the bell or call the host upon arrival and show your QR gate pass.'}
                </Text>
              </View>
            </View>
          )}

          {/* Duration Picker */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Parking Duration &amp; Leaving Time</Text>
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
            {(() => {
              const arrMs = Number.isFinite(Date.parse(effectiveArrivalIso))
                ? Date.parse(effectiveArrivalIso)
                : Date.now();
              const leaveMs = arrMs + selectedHours * 3600_000;
              const fmt = (ms: number) =>
                new Date(ms).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
              return (
                <View style={styles.windowHintCard}>
                  <Ionicons name="time-outline" size={16} color={colors.navy} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.windowHintMain}>
                      Park {fmt(arrMs)} → Leave by {fmt(leaveMs)}
                    </Text>
                    <Text style={styles.windowHintSub}>
                      Check-in opens 15m early · 10m exit grace · Extendable later
                    </Text>
                  </View>
                </View>
              );
            })()}
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
  unavailableCard: {
    backgroundColor: colors.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 24,
    alignItems: 'center',
    gap: 10,
    ...theme.elevation.card,
  },
  unavailableIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 16,
    backgroundColor: colors.primaryLight,
    borderWidth: 1,
    borderColor: colors.primaryBorder,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  unavailableTitle: {
    color: colors.navy,
    fontSize: 20,
    fontWeight: '800',
    textAlign: 'center',
  },
  unavailableDesc: {
    color: colors.textSecondary,
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    marginBottom: 8,
  },
  unavailablePrimaryBtn: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    overflow: 'hidden',
  },
  unavailablePrimaryText: {
    color: colors.white,
    fontSize: 15,
    fontWeight: '800',
  },
  unavailableSecondaryBtn: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    overflow: 'hidden',
  },
  unavailableSecondaryText: {
    color: colors.navy,
    fontSize: 14.5,
    fontWeight: '700',
  },
  unavailableBtnInner: {
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  imageArea: {
    backgroundColor: colors.navy,
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  privatePill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 5,
    marginTop: 8,
    backgroundColor: colors.successLight,
    borderWidth: 1,
    borderColor: colors.successBorder,
    borderRadius: 8,
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  privatePillText: { color: colors.success, fontSize: 12, fontWeight: '800' },
  instructionsCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
  },
  instructionsText: {
    flex: 1,
    color: colors.textSecondary,
    fontSize: 13.5,
    lineHeight: 19,
  },
  windowHintCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 10,
    backgroundColor: colors.cardElevated,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  windowHintMain: { color: colors.navy, fontSize: 13, fontWeight: '700' },
  windowHintSub: { color: colors.textMuted, fontSize: 11.5, marginTop: 2 },
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
  durationText: {
    color: colors.textSecondary,
    fontSize: 14.5,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
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
  summaryTotalValue: {
    color: colors.primary,
    fontSize: 20,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
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
  bookBtnText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
});
