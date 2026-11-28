import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { router } from 'expo-router';
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { searchApi } from '../../src/api/client';
import FreeMap, { MapSpace } from '../../src/components/FreeMap';
import { SearchFilterBar } from '../../src/components/SearchFilterBar';
import { colors, theme } from '../../src/constants/theme';
import { PressScale, SkeletonBlock, triggerHaptic } from '../../src/components/Motion';
import { useAuthStore } from '../../src/store/auth.store';
import { useDriverStore } from '../../src/store/driver.store';
import {
  buildServerSearchFilters,
  computeArrivalIso,
  filterSpaceResults,
  useSearchStore,
} from '../../src/store/search.store';
import { DEMO_SPACES } from '../../src/data/demoFixtures';
import { cacheGet, cacheSet, CACHE_KEYS } from '../../src/utils/cache';
import { classifyApiError, type ClassifiedApiError } from '../../src/utils/apiErrors';

const CHENNAI = { lat: 13.0827, lng: 80.2707 };

interface ApiSpace {
  id: string;
  name: string;
  coordinates?: { lat: number; lng: number };
  price?: { value: number };
  availability?: { probabilityPercent: number };
  amenities?: { evCharging: boolean; covered: boolean; securityLevel: string };
}

const EXPANDED_OFFSET = -110;

export default function MapScreen() {
  const [center, setCenter] = useState(CHENNAI);
  const [pannedCenter, setPannedCenter] = useState(CHENNAI);
  const [areaMoved, setAreaMoved] = useState(false);
  const lastFetchedCoordsRef = useRef(CHENNAI);

  const [spaces, setSpaces] = useState<MapSpace[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [sourceMode, setSourceMode] = useState<'live' | 'cache' | 'demo' | 'error'>('live');
  const [mapError, setMapError] = useState<ClassifiedApiError | null>(null);
  const [locationDenied, setLocationDenied] = useState(false);
  const [hasLocationPermission, setHasLocationPermission] = useState(false);

  const isDemoMode = useAuthStore((s) => s.isDemoMode);
  const vehicles = useDriverStore((s) => s.vehicles);
  const defaultVehicle = vehicles.find((v) => v.isDefault) || vehicles[0];
  const { arrivalOffsetMinutes, durationHours } = useSearchStore();

  const reducedMotion = useReducedMotion();
  const sheetY = useSharedValue(0);
  const startY = useSharedValue(0);

  const fetchGpsLocation = useCallback(async () => {
    try {
      const existing = await Location.getForegroundPermissionsAsync();
      let status = existing.status;
      if (status !== 'granted' && existing.canAskAgain) {
        const req = await Location.requestForegroundPermissionsAsync();
        status = req.status;
      }

      if (status === 'granted') {
        setLocationDenied(false);
        setHasLocationPermission(true);
        const pos = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        const coords = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        };
        setCenter(coords);
        return coords;
      }

      setLocationDenied(true);
      setHasLocationPermission(false);
    } catch {
      setLocationDenied(false);
    }
    return CHENNAI;
  }, []);

  const loadSpaces = useCallback(
    async (targetCoords?: { lat: number; lng: number }) => {
      setLoading(true);
      setMapError(null);
      const queryCoords = targetCoords || lastFetchedCoordsRef.current || center;
      lastFetchedCoordsRef.current = queryCoords;
      setAreaMoved(false);

      const {
        arrivalOffsetMinutes: offsetMins,
        durationHours: hrs,
        amenities: activeAmenities,
        matchDefaultVehicle: useVeh,
      } = useSearchStore.getState();

      if (isDemoMode) {
        const filteredDemo = filterSpaceResults(DEMO_SPACES, activeAmenities);
        const demoMapped: MapSpace[] = filteredDemo.map((s) => ({
          id: s.id,
          name: s.name,
          lat: s.coordinates.lat,
          lng: s.coordinates.lng,
          available: s.availability.probabilityPercent > 50,
          price: s.price.value,
        }));
        setSpaces(demoMapped);
        setSourceMode('demo');
        setLoading(false);
        return;
      }

      try {
        const vehType = useVeh ? defaultVehicle?.vehicleType : undefined;
        const { data } = await searchApi.search({
          location: { type: 'coordinates', lat: queryCoords.lat, lng: queryCoords.lng },
          arrivalTime: computeArrivalIso(offsetMins),
          duration: hrs * 60,
          radius: 15,
          filters: buildServerSearchFilters(activeAmenities, vehType),
          page: 1,
          pageSize: 50,
        });

        const results: ApiSpace[] = data?.data?.results || [];
        const mapped: MapSpace[] = results
          .filter((r) => r.coordinates)
          .map((r) => ({
            id: r.id,
            name: r.name,
            lat: r.coordinates!.lat,
            lng: r.coordinates!.lng,
            available: (r.availability?.probabilityPercent ?? 0) > 50,
            price: r.price?.value ?? 0,
          }));

        setSpaces(mapped);
        setSourceMode('live');
        if (mapped.length > 0) {
          await cacheSet(CACHE_KEYS.CACHED_SPACES, results);
        }
      } catch (err: unknown) {
        const classified = classifyApiError(err, 'Unable to load nearby bays on map.');
        if (classified.kind === 'session-expired') {
          router.replace('/status/session-expired');
          return;
        }
        if (classified.kind === 'maintenance') {
          router.replace('/status/maintenance');
          return;
        }

        if (classified.kind === 'offline') {
          const cached = await cacheGet<ApiSpace[]>(CACHE_KEYS.CACHED_SPACES);
          const filteredCache = (cached || []).filter((r) => {
            if (!r.coordinates) return false;
            if (!r.amenities) return true;
            return filterSpaceResults([{ amenities: r.amenities }], activeAmenities).length > 0;
          });
          const mappedCache: MapSpace[] = filteredCache.map((r) => ({
            id: r.id,
            name: r.name,
            lat: r.coordinates!.lat,
            lng: r.coordinates!.lng,
            available: (r.availability?.probabilityPercent ?? 0) > 50,
            price: r.price?.value ?? 0,
          }));
          if (mappedCache.length > 0) {
            setSpaces(mappedCache);
            setSourceMode('cache');
            return;
          }
        }

        setSpaces([]);
        setSourceMode('error');
        setMapError(classified);
      } finally {
        setLoading(false);
      }
    },
    [center, isDemoMode, defaultVehicle?.vehicleType],
  );

  useEffect(() => {
    let active = true;
    (async () => {
      const coords = await fetchGpsLocation();
      if (active) {
        await loadSpaces(coords);
      }
    })();
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDemoMode]);

  const handleRecenter = async () => {
    triggerHaptic('selection');
    const coords = await fetchGpsLocation();
    await loadSpaces(coords);
  };

  const handleRegionChange = useCallback(
    (coords: { lat: number; lng: number }, userInitiated: boolean) => {
      if (!userInitiated) return;
      const last = lastFetchedCoordsRef.current;
      const approxKm = Math.hypot((coords.lat - last.lat) * 111, (coords.lng - last.lng) * 108);
      if (approxKm >= 0.4) {
        setPannedCenter(coords);
        setAreaMoved(true);
      }
    },
    [],
  );

  const handleSearchThisArea = async () => {
    triggerHaptic('medium');
    setCenter(pannedCenter);
    await loadSpaces(pannedCenter);
  };

  const openSpace = (id: string) => {
    setSelectedId(id);
    router.push({
      pathname: '/space/[id]',
      params: {
        id,
        hours: String(durationHours),
        arrivalTime: computeArrivalIso(arrivalOffsetMinutes),
      },
    });
  };

  const snapHaptic = useCallback(() => {
    triggerHaptic('selection');
  }, []);

  const toggleSheet = useCallback(() => {
    const isCollapsed = sheetY.get() > EXPANDED_OFFSET / 2;
    const target = isCollapsed ? EXPANDED_OFFSET : 0;
    if (reducedMotion) {
      sheetY.set(target);
    } else {
      sheetY.set(withSpring(target, { duration: 300, dampingRatio: 0.8, overshootClamping: true }));
    }
    triggerHaptic('selection');
  }, [reducedMotion, sheetY]);

  const panGesture = useMemo(
    () =>
      Gesture.Pan()
        .onStart(() => {
          startY.set(sheetY.get());
        })
        .onUpdate((e) => {
          const next = Math.max(EXPANDED_OFFSET, Math.min(24, startY.get() + e.translationY));
          sheetY.set(next);
        })
        .onEnd((e) => {
          const shouldExpand = e.velocityY < -300 || sheetY.get() < EXPANDED_OFFSET / 2;
          const target = shouldExpand ? EXPANDED_OFFSET : 0;
          if (reducedMotion) {
            sheetY.set(target);
          } else {
            sheetY.set(
              withSpring(target, {
                duration: 300,
                dampingRatio: 0.8,
                velocity: e.velocityY,
                overshootClamping: true,
              }),
            );
          }
          scheduleOnRN(snapHaptic);
        }),
    [reducedMotion, sheetY, startY, snapHaptic],
  );

  const sheetAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: sheetY.get() }],
  }));

  const badgeTone =
    sourceMode === 'live'
      ? { bg: colors.successLight, border: colors.successBorder, fg: colors.success, label: 'Live MapLibre' }
      : sourceMode === 'demo'
        ? { bg: colors.warningLight, border: colors.warningBorder, fg: colors.warning, label: 'Demo Mode' }
        : sourceMode === 'cache'
          ? { bg: colors.warningLight, border: colors.warningBorder, fg: colors.warning, label: 'Offline Cache' }
          : { bg: colors.dangerLight, border: colors.dangerBorder, fg: colors.danger, label: 'Error' };

  return (
    <View style={styles.container}>
      <View style={styles.mapWrap}>
        <FreeMap
          center={center}
          spaces={spaces}
          selectedId={selectedId}
          hasLocationPermission={hasLocationPermission}
          onMarkerPress={openSpace}
          onRegionChange={handleRegionChange}
        />

        {areaMoved && (
          <View style={[styles.searchAreaWrap, locationDenied && { top: 68 }]}>
            <PressScale
              onPress={handleSearchThisArea}
              style={styles.searchAreaBtn}
              contentStyle={styles.searchAreaInner}
              rippleColor={colors.rippleLight}
              accessibilityLabel="Search parking spaces in visible map area"
            >
              <Ionicons name="refresh" size={15} color={colors.white} />
              <Text style={styles.searchAreaText}>Search This Area</Text>
            </PressScale>
          </View>
        )}

        {locationDenied && (
          <View style={styles.gpsBannerWrap}>
            <PressScale
              onPress={() => router.push('/status/location-denied')}
              accessibilityLabel="Location permission disabled, tap to enable GPS"
              style={styles.gpsBanner}
              contentStyle={styles.gpsBannerInner}
            >
              <Text style={styles.gpsBannerText}>
                GPS permission disabled — centered on Chennai
              </Text>
              <Text style={styles.gpsEnableText}>Enable</Text>
            </PressScale>
          </View>
        )}

        <PressScale
          onPress={handleRecenter}
          style={styles.recenterBtn}
          contentStyle={styles.recenterInner}
          accessibilityLabel="Recenter map to current GPS location"
          haptic="light"
        >
          <Ionicons name="locate" size={20} color={colors.navy} />
        </PressScale>
      </View>

      <Animated.View style={[styles.bottomSheet, sheetAnimatedStyle]}>
        <GestureDetector gesture={panGesture}>
          <Pressable
            onPress={toggleSheet}
            accessibilityRole="button"
            accessibilityLabel="Toggle nearby parking list drawer"
            style={styles.dragZone}
          >
            <View style={styles.dragHandle} />
            <View style={styles.sheetHeader}>
              <Text style={styles.bottomTitle}>Nearby Spaces ({spaces.length})</Text>
              <View
                style={[
                  styles.sourceBadge,
                  { backgroundColor: badgeTone.bg, borderColor: badgeTone.border },
                ]}
              >
                <View style={[styles.sourceDot, { backgroundColor: badgeTone.fg }]} />
                <Text style={[styles.sourceText, { color: badgeTone.fg }]}>{badgeTone.label}</Text>
              </View>
            </View>

            <View style={styles.legend}>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: colors.success }]} />
                <Text style={styles.legendText}>Available</Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: colors.primary }]} />
                <Text style={styles.legendText}>Full</Text>
              </View>
              <Text style={styles.dragHint}>Drag or tap to expand</Text>
            </View>
          </Pressable>
        </GestureDetector>

        <SearchFilterBar
          compact
          defaultVehicle={defaultVehicle}
          onApply={() => void loadSpaces(lastFetchedCoordsRef.current)}
        />

        {loading ? (
          <View style={{ gap: 8 }}>
            <SkeletonBlock height={48} borderRadius={10} />
            <SkeletonBlock height={48} borderRadius={10} />
          </View>
        ) : mapError ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorBoxText}>{mapError.message}</Text>
            <View style={styles.errorBoxActions}>
              <PressScale
                style={styles.retryBtn}
                contentStyle={styles.retryBtnInner}
                rippleColor={colors.rippleLight}
                onPress={() => loadSpaces()}
              >
                <Text style={styles.retryBtnText}>Retry</Text>
              </PressScale>
              {mapError.statusRoute && (
                <PressScale
                  style={styles.statusBtn}
                  contentStyle={styles.retryBtnInner}
                  onPress={() => router.push(mapError.statusRoute!)}
                >
                  <Text style={styles.statusBtnText}>Status</Text>
                </PressScale>
              )}
            </View>
          </View>
        ) : spaces.length === 0 ? (
          <View style={styles.emptyListBox}>
            <Text style={styles.emptyListText}>No bays found near this map center.</Text>
          </View>
        ) : (
          spaces.slice(0, 5).map((space) => (
            <PressScale
              key={space.id}
              haptic="light"
              onPress={() => openSpace(space.id)}
              style={styles.listItemWrap}
              contentStyle={styles.listItem}
            >
              <View
                style={[
                  styles.statusDot,
                  { backgroundColor: space.available ? colors.success : colors.primary },
                ]}
              />
              <View style={styles.listInfo}>
                <Text style={styles.listName} numberOfLines={1}>
                  {space.name}
                </Text>
                <Text style={styles.listStatus}>{space.available ? 'Open bays ready' : 'Currently full'}</Text>
              </View>
              <Text style={styles.listPrice}>₹{space.price}/hr</Text>
            </PressScale>
          ))
        )}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  mapWrap: { flex: 1, position: 'relative', overflow: 'hidden' },
  gpsBannerWrap: {
    position: 'absolute',
    top: 12,
    left: 12,
    right: 12,
    zIndex: 20,
  },
  searchAreaWrap: {
    position: 'absolute',
    top: 14,
    alignSelf: 'center',
    zIndex: 21,
  },
  searchAreaBtn: {
    backgroundColor: colors.navy,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: colors.white,
    overflow: 'hidden',
    elevation: 5,
    shadowColor: '#0B1628',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.22,
    shadowRadius: 5,
  },
  searchAreaInner: {
    minHeight: 48,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  searchAreaText: { color: colors.white, fontSize: 13, fontWeight: '800' },
  gpsBanner: {
    backgroundColor: colors.infoLight,
    borderWidth: 1,
    borderColor: colors.infoBorder,
    borderRadius: 12,
    overflow: 'hidden',
  },
  gpsBannerInner: {
    minHeight: 48,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  gpsBannerText: { color: colors.info, fontSize: 12.5, fontWeight: '700', flex: 1 },
  gpsEnableText: { color: colors.navy, fontSize: 12.5, fontWeight: '800' },
  recenterBtn: {
    position: 'absolute',
    right: 14,
    bottom: 16,
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    overflow: 'hidden',
    elevation: 4,
    shadowColor: '#0B1628',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.18,
    shadowRadius: 4,
  },
  recenterInner: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bottomSheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderTopWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 18,
    paddingTop: 10,
    marginBottom: EXPANDED_OFFSET,
    paddingBottom: 16 - EXPANDED_OFFSET,
    ...theme.elevation.sheet,
  },
  dragZone: {
    paddingBottom: 8,
  },
  dragHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.borderStrong,
    alignSelf: 'center',
    marginBottom: 10,
  },
  sheetHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  bottomTitle: { color: colors.navy, fontSize: 16, fontWeight: '800' },
  sourceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  sourceDot: { width: 7, height: 7, borderRadius: 3.5 },
  sourceText: { fontSize: 11.5, fontWeight: '700' },
  legend: { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 4 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 9, height: 9, borderRadius: 4.5 },
  legendText: { color: colors.textMuted, fontSize: 12, fontWeight: '600' },
  dragHint: { marginLeft: 'auto', color: colors.textMuted, fontSize: 11, fontWeight: '600' },
  errorBox: {
    backgroundColor: colors.dangerLight,
    borderWidth: 1,
    borderColor: colors.dangerBorder,
    borderRadius: 12,
    padding: 12,
    gap: 10,
  },
  errorBoxText: { color: colors.danger, fontSize: 13, fontWeight: '700' },
  errorBoxActions: { flexDirection: 'row', gap: 8 },
  retryBtn: { backgroundColor: colors.primary, borderRadius: 10, overflow: 'hidden' },
  statusBtn: {
    backgroundColor: colors.surface,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    overflow: 'hidden',
  },
  retryBtnInner: { minHeight: 48, paddingHorizontal: 16, justifyContent: 'center', alignItems: 'center' },
  retryBtnText: { color: colors.white, fontSize: 13.5, fontWeight: '800' },
  statusBtnText: { color: colors.navy, fontSize: 13.5, fontWeight: '700' },
  emptyListBox: { paddingVertical: 18, alignItems: 'center' },
  emptyListText: { color: colors.textMuted, fontSize: 13, fontWeight: '600' },
  listItemWrap: {
    borderBottomWidth: 1,
    borderBottomColor: colors.cardElevated,
    overflow: 'hidden',
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 50,
    paddingVertical: 8,
  },
  statusDot: { width: 9, height: 9, borderRadius: 4.5, flexShrink: 0 },
  listInfo: { flex: 1 },
  listName: { color: colors.navy, fontSize: 14, fontWeight: '700' },
  listStatus: { color: colors.textMuted, fontSize: 12 },
  listPrice: { color: colors.primary, fontWeight: '800', fontSize: 14.5, fontVariant: ['tabular-nums'] },
});
