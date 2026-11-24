import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import { searchApi } from '../../src/api/client';
import FreeMap, { MapSpace } from '../../src/components/FreeMap';

// Chennai city center — default map focus.
const CHENNAI = { lat: 13.0827, lng: 80.2707 };

// Fallback markers used only if the search service is unreachable.
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
  const [spaces, setSpaces] = useState<MapSpace[]>(FALLBACK_SPACES);
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

      if (mapped.length > 0) {
        setSpaces(mapped);
        setUsingLive(true);
      }
    } catch {
      // Keep fallback markers — map still renders.
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
            <ActivityIndicator color="#38BDF8" />
            <Text style={styles.legendText}>Loading spaces…</Text>
          </View>
        ) : (
          spaces.slice(0, 4).map((space) => (
            <TouchableOpacity key={space.id} style={styles.listItem} onPress={() => openSpace(space.id)} activeOpacity={0.7}>
              <View style={[styles.statusDot, { backgroundColor: space.available ? '#22C55E' : '#EF4444' }]} />
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
  container: { flex: 1, backgroundColor: '#0F172A' },
  mapWrap: { flex: 1, position: 'relative', overflow: 'hidden' },
  bottomSheet: {
    backgroundColor: '#1E293B',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: 300,
  },
  sheetHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  bottomTitle: { color: '#F8FAFC', fontSize: 16, fontWeight: '700' },
  sourceBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#0F172A', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  sourceDot: { width: 8, height: 8, borderRadius: 4 },
  sourceText: { color: '#CBD5E1', fontSize: 11, fontWeight: '600' },
  legend: { flexDirection: 'row', gap: 16, marginBottom: 12 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  legendText: { color: '#94A3B8', fontSize: 12 },
  loadingRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 16 },
  listItem: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#334155' },
  statusDot: { width: 10, height: 10, borderRadius: 5, flexShrink: 0 },
  listInfo: { flex: 1 },
  listName: { color: '#F8FAFC', fontSize: 13, fontWeight: '600' },
  listStatus: { color: '#64748B', fontSize: 11 },
  listPrice: { color: '#38BDF8', fontWeight: '700' },
});
