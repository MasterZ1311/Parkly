import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  StyleSheet,
  RefreshControl,
} from 'react-native';
import { router, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Animated from 'react-native-reanimated';
import { searchApi } from '../../src/api/client';
import { cacheGet, cacheSet, CACHE_KEYS } from '../../src/utils/cache';
import { useAuthStore } from '../../src/store/auth.store';
import { useDriverStore } from '../../src/store/driver.store';
import {
  buildServerSearchFilters,
  computeArrivalIso,
  filterSpaceResults,
  formatArrivalSummary,
  useSearchStore,
} from '../../src/store/search.store';
import { OfflineBanner } from '../../src/components/OfflineBanner';
import { SearchFilterBar } from '../../src/components/SearchFilterBar';
import { colors, theme } from '../../src/constants/theme';
import {
  ENTER_FADE_UP,
  PressScale,
  SkeletonBlock,
} from '../../src/components/Motion';
import { ParklyBrandBadge } from '../../src/components/ParklyBrandBadge';
import { classifyApiError, type ClassifiedApiError } from '../../src/utils/apiErrors';
import { DEMO_SPACES } from '../../src/data/demoFixtures';

export interface SpaceResult {
  id: string;
  hostId?: string;
  name: string;
  address: string;
  distance: { value: number; unit: string };
  price: { value: number; currency: string; per: string };
  availability: { probabilityPercent: number; confidencePercent: number };
  amenities: { evCharging: boolean; covered: boolean; securityLevel: string };
}

export default function HomeScreen() {
  const { area } = useLocalSearchParams<{ area?: string }>();
  const {
    query,
    arrivalOffsetMinutes,
    durationHours,
    amenities,
    matchDefaultVehicle,
    setQuery,
  } = useSearchStore();

  const [results, setResults] = useState<SpaceResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [isOfflineResults, setIsOfflineResults] = useState(false);
  const [searchError, setSearchError] = useState<ClassifiedApiError | null>(null);

  const isOffline = useAuthStore((s) => s.isOffline);
  const isDemoMode = useAuthStore((s) => s.isDemoMode);
  const savedPlaces = useDriverStore((s) => s.savedPlaces);
  const vehicles = useDriverStore((s) => s.vehicles);
  const unreadCount = useDriverStore((s) => s.unreadCount);
  const loadSavedPlaces = useDriverStore((s) => s.loadSavedPlaces);
  const loadVehicles = useDriverStore((s) => s.loadVehicles);
  const loadNotifications = useDriverStore((s) => s.loadNotifications);

  const defaultVehicle = vehicles.find((v) => v.isDefault) || vehicles[0];

  useEffect(() => {
    loadSavedPlaces().catch(() => {});
    loadVehicles().catch(() => {});
    cacheGet<{ query: string; results: SpaceResult[] }>(CACHE_KEYS.LAST_SEARCH).then((cached) => {
      if (cached && cached.results && cached.results.length > 0 && !area) {
        setQuery(cached.query || '');
        setResults(cached.results);
        setSearched(true);
      }
    });
  }, [loadSavedPlaces, loadVehicles, area, setQuery]);

  useFocusEffect(
    useCallback(() => {
      loadNotifications().catch(() => {});
    }, [loadNotifications]),
  );

  const visibleResults = filterSpaceResults(results, amenities);

  const handleSearch = useCallback(
    async (searchQuery?: string) => {
      const q = (typeof searchQuery === 'string' ? searchQuery : useSearchStore.getState().query).trim();
      if (!q) return;

      const {
        arrivalOffsetMinutes: offsetMins,
        durationHours: hrs,
        amenities: activeAmenities,
        matchDefaultVehicle: useVeh,
      } = useSearchStore.getState();

      setLoading(true);
      setSearched(true);
      setSearchError(null);

      if (isDemoMode) {
        const normalized = q.toLowerCase();
        const filtered = DEMO_SPACES.filter(
          (s) =>
            s.name.toLowerCase().includes(normalized) ||
            s.address.toLowerCase().includes(normalized) ||
            normalized === 'chennai',
        );
        const finalDemo = filtered.length > 0 ? filtered : DEMO_SPACES;
        setResults(finalDemo);
        setIsOfflineResults(false);
        await cacheSet(CACHE_KEYS.LAST_SEARCH, { query: q, results: finalDemo });
        await cacheSet(CACHE_KEYS.CACHED_SPACES, finalDemo);
        setLoading(false);
        return;
      }

      try {
        const vehType = useVeh ? defaultVehicle?.vehicleType : undefined;
        const { data } = await searchApi.search({
          location: { type: 'text', value: q },
          arrivalTime: computeArrivalIso(offsetMins),
          duration: hrs * 60,
          radius: 8,
          filters: buildServerSearchFilters(activeAmenities, vehType),
          page: 1,
          pageSize: 20,
        });
        const searchResults: SpaceResult[] = data?.data?.results || [];
        setResults(searchResults);
        setIsOfflineResults(false);
        await cacheSet(CACHE_KEYS.LAST_SEARCH, { query: q, results: searchResults });
        await cacheSet(CACHE_KEYS.CACHED_SPACES, searchResults);
      } catch (err: unknown) {
        const classified = classifyApiError(err, 'Unable to search parking spaces right now.');

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
          const cached = await cacheGet<{ query: string; results: SpaceResult[] }>(CACHE_KEYS.LAST_SEARCH);
          if (cached?.results?.length) {
            setResults(cached.results);
            setIsOfflineResults(true);
            return;
          }
          const cachedSpaces = await cacheGet<SpaceResult[]>(CACHE_KEYS.CACHED_SPACES);
          if (cachedSpaces?.length) {
            setResults(cachedSpaces);
            setIsOfflineResults(true);
            return;
          }
        }

        setResults([]);
        setIsOfflineResults(false);
        setSearchError(classified);
      } finally {
        setLoading(false);
      }
    },
    [isDemoMode, defaultVehicle?.vehicleType],
  );

  useEffect(() => {
    if (area && area.trim()) {
      setQuery(area);
      handleSearch(area);
    }
  }, [area, handleSearch, setQuery]);

  const renderItem = ({ item }: { item: SpaceResult }) => {
    const highAvail = item.availability.probabilityPercent > 60;
    return (
      <PressScale
        onPress={() =>
          router.push({
            pathname: '/space/[id]',
            params: {
              id: item.id,
              hours: String(durationHours),
              arrivalTime: computeArrivalIso(arrivalOffsetMinutes),
            },
          })
        }
        haptic="light"
        style={styles.card}
        contentStyle={styles.cardInner}
      >
        <View style={styles.cardHeader}>
          <View style={styles.cardTitleRow}>
            <Text style={styles.cardName} numberOfLines={1}>
              {item.name}
            </Text>
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
                {item.availability.probabilityPercent}% open
              </Text>
            </View>
          </View>
          <Text style={styles.cardAddress} numberOfLines={1}>
            {item.address}
          </Text>
        </View>

        <View style={styles.cardFooter}>
          <View style={styles.distanceRow}>
            <Ionicons name="location-outline" size={14} color={colors.textMuted} />
            <Text style={styles.distance}>
              {item.distance.value} {item.distance.unit}
            </Text>
          </View>

          <View style={styles.amenities}>
            {item.amenities.evCharging && (
              <View style={styles.badge}>
                <Ionicons name="flash-outline" size={11} color={colors.info} />
                <Text style={styles.badgeText}>EV</Text>
              </View>
            )}
            {item.amenities.covered && (
              <View style={styles.badge}>
                <Ionicons name="umbrella-outline" size={11} color={colors.textSecondary} />
                <Text style={styles.badgeText}>Covered</Text>
              </View>
            )}
          </View>

          <Text style={styles.price}>
            ₹{item.price.value}
            <Text style={styles.priceUnit}>/hr</Text>
          </Text>
        </View>
      </PressScale>
    );
  };

  return (
    <View style={styles.container}>
      {isDemoMode ? (
        <View style={styles.demoStrip}>
          <Ionicons name="sparkles-outline" size={14} color={colors.navy} />
          <Text style={styles.demoStripText}>DEMO MODE · Showing simulated Chennai parking inventory</Text>
        </View>
      ) : (
        <OfflineBanner
          visible={isOffline || isOfflineResults}
          message="Offline Mode — Showing cached parking spaces"
        />
      )}

      {/* Harbor Navy Brand Strip */}
      <View style={styles.brandHeader}>
        <ParklyBrandBadge size="sm" darkSurface />
        <View style={{ flex: 1 }}>
          <Text style={styles.brandTitle}>Parkly Chennai</Text>
          <Text style={styles.brandSubtitle}>
            {formatArrivalSummary(arrivalOffsetMinutes).toUpperCase()} · {durationHours}H WINDOW
            {matchDefaultVehicle && defaultVehicle ? ` · ${defaultVehicle.vehicleType.toUpperCase()}` : ''}
          </Text>
        </View>
        <PressScale
          style={styles.bellBtn}
          contentStyle={styles.bellBtnInner}
          rippleColor={colors.rippleLight}
          onPress={() => router.push('/profile/notifications')}
          accessibilityLabel={`Notifications inbox${unreadCount > 0 ? `, ${unreadCount} unread` : ''}`}
        >
          <Ionicons name="notifications-outline" size={20} color={colors.white} />
          {unreadCount > 0 && (
            <View style={styles.bellBadge}>
              <Text style={styles.bellBadgeText}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
            </View>
          )}
        </PressScale>
      </View>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <View style={styles.searchBar}>
          <Ionicons name="search" size={19} color={colors.textMuted} style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search area (e.g. T Nagar, Anna Nagar)"
            placeholderTextColor={colors.textMuted}
            value={query}
            onChangeText={setQuery}
            onSubmitEditing={() => handleSearch()}
            returnKeyType="search"
          />
          {query.length > 0 && (
            <PressScale
              onPress={() => {
                setQuery('');
                setResults([]);
                setSearched(false);
                setSearchError(null);
              }}
              haptic="selection"
              contentStyle={styles.clearBtn}
              accessibilityLabel="Clear search query"
            >
              <Ionicons name="close-circle" size={18} color={colors.textMuted} />
            </PressScale>
          )}
        </View>
        <PressScale
          onPress={() => handleSearch()}
          rippleColor={colors.rippleLight}
          haptic="medium"
          style={styles.searchButton}
          contentStyle={styles.searchButtonContent}
          accessibilityLabel="Search parking spaces"
        >
          <Ionicons name="arrow-forward" size={20} color={colors.white} />
        </PressScale>
      </View>

      {/* Shared Timing & Amenity Filter Strip */}
      <SearchFilterBar
        defaultVehicle={defaultVehicle}
        onApply={() => {
          if (searched && query.trim()) {
            void handleSearch(query);
          }
        }}
      />

      {/* Results */}
      {loading ? (
        <View style={styles.skeletonList}>
          <SkeletonBlock height={106} />
          <SkeletonBlock height={106} />
          <SkeletonBlock height={106} />
        </View>
      ) : searchError ? (
        <View style={styles.emptyState}>
          <View style={[styles.emptyIconBox, { borderColor: colors.dangerBorder, backgroundColor: colors.dangerLight }]}>
            <Ionicons
              name={searchError.kind === 'offline' ? 'cloud-offline-outline' : 'alert-circle-outline'}
              size={34}
              color={colors.danger}
            />
          </View>
          <Text style={styles.emptyTitle}>
            {searchError.kind === 'offline' ? 'Connection Unavailable' : 'Search Request Failed'}
          </Text>
          <Text style={styles.emptySubtitle}>{searchError.message}</Text>
          <View style={styles.errorActionRow}>
            <PressScale
              style={styles.retryBtn}
              contentStyle={styles.retryBtnInner}
              rippleColor={colors.rippleLight}
              onPress={() => handleSearch()}
            >
              <Text style={styles.retryBtnText}>Retry Search</Text>
            </PressScale>
            {searchError.statusRoute && (
              <PressScale
                style={styles.diagBtn}
                contentStyle={styles.retryBtnInner}
                onPress={() => router.push(searchError.statusRoute!)}
              >
                <Text style={styles.diagBtnText}>Service Notice</Text>
              </PressScale>
            )}
          </View>
        </View>
      ) : !searched ? (
        <Animated.View entering={ENTER_FADE_UP} style={styles.emptyState}>
          <View style={styles.emptyIconBox}>
            <Ionicons name="car-sport-outline" size={38} color={colors.navy} />
          </View>
          <Text style={styles.emptyTitle}>Find Parking Across Chennai</Text>
          <Text style={styles.emptySubtitle}>
            Tap a neighborhood below or search any street to see live hourly rates and bay availability.
          </Text>
          <View style={styles.areaSuggestions}>
            {['T Nagar', 'Anna Nagar', 'Adyar', 'Velachery'].map((hood) => (
              <PressScale
                key={hood}
                style={styles.areaSuggestion}
                contentStyle={styles.areaSuggestionContent}
                haptic="selection"
                onPress={() => {
                  setQuery(hood);
                  handleSearch(hood);
                }}
              >
                <Text style={styles.areaSuggestionText}>{hood}</Text>
              </PressScale>
            ))}
          </View>

          {savedPlaces.length > 0 && (
            <View style={styles.savedPlacesWrap}>
              <Text style={styles.savedLabel}>SAVED PLACES</Text>
              <View style={styles.areaSuggestions}>
                {savedPlaces.slice(0, 3).map((place) => (
                  <PressScale
                    key={place.id}
                    style={styles.savedChip}
                    contentStyle={styles.savedChipInner}
                    haptic="selection"
                    onPress={() => {
                      setQuery(place.areaQuery);
                      handleSearch(place.areaQuery);
                    }}
                  >
                    <Ionicons name="bookmark-outline" size={14} color={colors.navy} />
                    <Text style={styles.savedChipText}>{place.label}</Text>
                  </PressScale>
                ))}
              </View>
            </View>
          )}
        </Animated.View>
      ) : results.length === 0 ? (
        <View style={styles.emptyState}>
          <View style={styles.emptyIconBox}>
            <Ionicons name="search-outline" size={34} color={colors.textMuted} />
          </View>
          <Text style={styles.emptyTitle}>No Spaces Found</Text>
          <Text style={styles.emptySubtitle}>
            Try another Chennai neighborhood or clear your filters.
          </Text>
        </View>
      ) : visibleResults.length === 0 ? (
        <View style={styles.emptyState}>
          <View style={styles.emptyIconBox}>
            <Ionicons name="options-outline" size={34} color={colors.textMuted} />
          </View>
          <Text style={styles.emptyTitle}>No Matches for Active Filters</Text>
          <Text style={styles.emptySubtitle}>
            {results.length} space{results.length === 1 ? '' : 's'} nearby. Reset EV, Covered, or Gated filters to see all bays.
          </Text>
        </View>
      ) : (
        <FlatList
          data={visibleResults}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={loading}
              onRefresh={() => void handleSearch(query)}
              tintColor={colors.primary}
              colors={[colors.primary]}
            />
          }
          ListHeaderComponent={
            <Text style={styles.resultCount}>
              {visibleResults.length} space{visibleResults.length === 1 ? '' : 's'} available ·{' '}
              {formatArrivalSummary(arrivalOffsetMinutes)} · {durationHours}h
            </Text>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  demoStrip: {
    backgroundColor: colors.warningLight,
    borderBottomWidth: 1,
    borderBottomColor: colors.warningBorder,
    paddingVertical: 7,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  demoStripText: { color: colors.navy, fontSize: 11.5, fontWeight: '800', letterSpacing: 0.2 },
  brandHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 14,
    gap: 12,
    backgroundColor: colors.navy,
  },
  brandTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.white,
    letterSpacing: -0.3,
  },
  brandSubtitle: {
    fontSize: 10.5,
    color: '#9FB0C7',
    fontWeight: '700',
    letterSpacing: 0.9,
    marginTop: 2,
  },
  bellBtn: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: colors.navySurface,
    borderWidth: 1,
    borderColor: colors.navyBorder,
    overflow: 'hidden',
  },
  bellBtnInner: {
    width: 48,
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  bellBadge: {
    position: 'absolute',
    top: 7,
    right: 7,
    minWidth: 17,
    height: 17,
    borderRadius: 9,
    backgroundColor: colors.primary,
    borderWidth: 1.5,
    borderColor: colors.navy,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 3,
  },
  bellBadgeText: {
    color: colors.white,
    fontSize: 9.5,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  searchContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 10,
    gap: 8,
  },
  searchBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 12,
    paddingLeft: 12,
    paddingRight: 6,
    minHeight: 48,
    borderWidth: 1,
    borderColor: colors.borderStrong,
  },
  searchIcon: { marginRight: 8 },
  searchInput: { flex: 1, color: colors.navy, fontSize: 14.5, fontWeight: '500', minHeight: 44 },
  clearBtn: { width: 48, minHeight: 48, justifyContent: 'center', alignItems: 'center' },
  searchButton: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    width: 48,
    overflow: 'hidden',
  },
  searchButtonContent: {
    width: 48,
    minHeight: 48,
    justifyContent: 'center',
    alignItems: 'center',
  },
  quickFiltersWrap: { marginBottom: 8 },
  quickFilters: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 8,
  },
  filterChip: {
    backgroundColor: colors.surface,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  filterChipContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    minHeight: 48,
  },
  filterText: { color: colors.textSecondary, fontSize: 13, fontWeight: '700' },
  filterChipActive: { backgroundColor: colors.navy, borderColor: colors.navy },
  filterTextActive: { color: colors.white },
  skeletonList: { paddingHorizontal: 16, paddingTop: 12, gap: 12 },
  emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 28, gap: 10 },
  emptyIconBox: {
    width: 72,
    height: 72,
    borderRadius: 20,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },
  emptyTitle: { fontSize: 20, fontWeight: '800', color: colors.navy, textAlign: 'center' },
  emptySubtitle: { fontSize: 13.5, color: colors.textMuted, textAlign: 'center', lineHeight: 20 },
  areaSuggestions: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, justifyContent: 'center', marginTop: 8 },
  areaSuggestion: {
    backgroundColor: colors.surface,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.primary,
    overflow: 'hidden',
  },
  areaSuggestionContent: {
    paddingHorizontal: 18,
    minHeight: 48,
    justifyContent: 'center',
    alignItems: 'center',
  },
  areaSuggestionText: { color: colors.primary, fontSize: 13.5, fontWeight: '700' },
  savedPlacesWrap: { marginTop: 14, alignItems: 'center', width: '100%' },
  savedLabel: { color: colors.textMuted, fontSize: 10.5, fontWeight: '800', letterSpacing: 1 },
  savedChip: {
    backgroundColor: colors.cardElevated,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    overflow: 'hidden',
  },
  savedChipInner: {
    minHeight: 48,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  savedChipText: { color: colors.navy, fontSize: 13, fontWeight: '700' },
  errorActionRow: { flexDirection: 'row', gap: 10, marginTop: 8 },
  retryBtn: { backgroundColor: colors.primary, borderRadius: 10, overflow: 'hidden' },
  diagBtn: {
    backgroundColor: colors.surface,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    overflow: 'hidden',
  },
  retryBtnInner: { minHeight: 48, paddingHorizontal: 18, justifyContent: 'center', alignItems: 'center' },
  retryBtnText: { color: colors.white, fontSize: 14, fontWeight: '800' },
  diagBtnText: { color: colors.navy, fontSize: 14, fontWeight: '700' },
  list: { paddingHorizontal: 16, paddingBottom: 24, paddingTop: 4 },
  resultCount: {
    color: colors.textMuted,
    fontSize: 12.5,
    fontWeight: '700',
    marginBottom: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
    ...theme.elevation.card,
  },
  cardInner: {
    padding: 16,
  },
  cardHeader: { marginBottom: 12 },
  cardTitleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4, gap: 8 },
  cardName: { flex: 1, fontSize: 16, fontWeight: '800', color: colors.navy },
  availBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  availDot: { width: 7, height: 7, borderRadius: 3.5 },
  availText: { fontSize: 11.5, fontWeight: '800', fontVariant: ['tabular-nums'] },
  cardAddress: { color: colors.textMuted, fontSize: 13 },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: colors.cardElevated,
  },
  distanceRow: { flexDirection: 'row', alignItems: 'center', gap: 4, flex: 1 },
  distance: { color: colors.textMuted, fontSize: 12.5, fontWeight: '600', fontVariant: ['tabular-nums'] },
  amenities: { flexDirection: 'row', gap: 6 },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.cardElevated,
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  badgeText: { color: colors.textSecondary, fontSize: 11, fontWeight: '700' },
  price: { color: colors.primary, fontSize: 18, fontWeight: '800', fontVariant: ['tabular-nums'] },
  priceUnit: { color: colors.textMuted, fontSize: 11.5, fontWeight: '600' },
});
