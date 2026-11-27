import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import { IS_DEMO_MODE, searchApi } from '../../src/api/client';
import FreeMap, { MapSpace } from '../../src/components/FreeMap';
import { colors } from '../../src/constants/theme';
import { cacheGet, CACHE_KEYS } from '../../src/utils/cache';

// Chennai city center — default map focus.
const CHENNAI = { lat: 13.0827, lng: 80.2707 };

// Demo markers used only when EXPO_PUBLIC_DEMO_MODE=true.
const FALLBACK_SPACES: MapSpace[] = [
  { id: 'sp-tng-001', name: 'T Nagar Parking Complex', lat: 13.0418, lng: 80.2341, available: true, price: 40 },
  { id: 'sp-ana-002', name: 'Anna Nagar Multi-Level', lat: 13.0849, lng: 80.2101, available: false, price: 60 },
  { id: 'sp-ady-003', name: 'Adyar Smart Park', lat: 13.0067, lng: 80.2566, available: true, price: 35 },
  { id: 'sp-vel-004', name: 'Velachery EV Park', lat: 12.9791, lng: 80.2204, available: true, price: 50 },
];

interface ApiSpace {
  id: string;
  name: string;
  coordinates?: { lat: number; lng: number };
  price?: { value: number };
  availability?: { probabilityPercent: number };
}

export default function MapScreen() {
  const [spaces, setSpaces] = useState<MapSpace[]>(IS_DEMO_MODE ? FALLBACK_SPACES : []);
  const [loading, setLoading] = useState(true);
  const [usingLive, setUsingLive] = useState(false);

  const loadSpaces = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await searchApi.search({
        location: { type: 'coordinates', lat: CHENNAI.lat, lng: CHENNAI.lng },
        arrivalTime: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
        duration: 120,
        radius: 15,
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
      setUsingLive(true);
    } catch {
      const cached = await cacheGet<ApiSpace[]>(CACHE_KEYS.CACHED_SPACES);
      if (cached && cached.length > 0) {
        const mapped = cached
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
      } else if (IS_DEMO_MODE) {
        setSpaces(FALLBACK_SPACES);
      } else {
        setSpaces([]);
      }
      setUsingLive(false);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSpaces();
  }, [loadSpaces]);

  const openSpace = (id: string) => {
    router.push({ pathname: '/space/[id]', params: { id } });
  };

  return (
    <View style={styles.container}>
      {/* Real OpenFreeMap map (web) / styled fallback (native) */}
      <View style={styles.mapWrap}>
        <FreeMap center={CHENNAI} spaces={spaces} onMarkerPress={openSpace} />
      </View>

      {/* Bottom Sheet */}
      <View style={styles.bottomSheet}>
        <View style={styles.sheetHeader}>
          <Text style={styles.bottomTitle}>Nearby Spaces</Text>
          <View style={styles.sourceBadge}>
            <View style={[styles.sourceDot, { backgroundColor: usingLive ? '#22C55E' : '#F59E0B' }]} />
            <Text style={styles.sourceText}>{usingLive ? 'Live' : 'Offline'}</Text>
          </View>
        </View>

        <View style={styles.legend}>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: '#22C55E' }]} />
            <Text style={styles.legendText}>Available</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: '#EF4444' }]} />
            <Text style={styles.legendText}>Full</Text>
          </View>
        </View>

        {loading ? (
          <View style={styles.loadingRow}>
            <ActivityIndicator color={colors.primary} />
            <Text style={styles.legendText}>Loading spaces…</Text>
          </View>
        ) : spaces.length === 0 ? (
          <View style={styles.loadingRow}>
            <Text style={styles.legendText}>Unable to load live map markers. Pull or retry.</Text>
            <TouchableOpacity onPress={loadSpaces} style={styles.retryBtn}>
              <Text style={styles.retryBtnText}>Retry</Text>
            </TouchableOpacity>
          </View>
        ) : (
          spaces.slice(0, 4).map((space) => (
            <TouchableOpacity key={space.id} style={styles.listItem} onPress={() => openSpace(space.id)} activeOpacity={0.7}>
              <View style={[styles.statusDot, { backgroundColor: space.available ? colors.success : colors.danger }]} />
              <View style={styles.listInfo}>
                <Text style={styles.listName} numberOfLines={1}>{space.name}</Text>
                <Text style={styles.listStatus}>{space.available ? 'Available' : 'Full'}</Text>
              </View>
              <Text style={styles.listPrice}>₹{space.price}/hr</Text>
            </TouchableOpacity>
          ))
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  mapWrap: { flex: 1, position: 'relative', overflow: 'hidden' },
  bottomSheet: {
    backgroundColor: colors.card,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: 300,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  sheetHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  bottomTitle: { color: colors.text, fontSize: 16, fontWeight: '700' },
  sourceBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.background, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  sourceDot: { width: 8, height: 8, borderRadius: 4 },
  sourceText: { color: colors.textSecondary, fontSize: 11, fontWeight: '600' },
  legend: { flexDirection: 'row', gap: 16, marginBottom: 12 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  legendText: { color: colors.textSecondary, fontSize: 12 },
  loadingRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 16 },
  retryBtn: { backgroundColor: colors.primary, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, marginLeft: 'auto' },
  retryBtnText: { color: colors.white, fontSize: 12, fontWeight: '700' },
  listItem: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.border },
  statusDot: { width: 10, height: 10, borderRadius: 5, flexShrink: 0 },
  listInfo: { flex: 1 },
  listName: { color: colors.text, fontSize: 13, fontWeight: '600' },
  listStatus: { color: colors.textMuted, fontSize: 11 },
  listPrice: { color: colors.primary, fontWeight: '700' },
});
