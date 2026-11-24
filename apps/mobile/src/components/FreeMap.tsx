// ============================================================
// Parkly Mobile — FreeMap (Native fallback)
// MapLibre GL JS is web-only. On native we render a lightweight
// styled map surface with positioned markers so the screen stays
// functional without pulling a web-only dependency into the
// native bundle. (Swap for @maplibre/maplibre-react-native when
// targeting production native builds.)
// ============================================================

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';

export interface MapSpace {
  id: string;
  name: string;
  lat: number;
  lng: number;
  available: boolean;
  price: number;
}

interface FreeMapProps {
  center: { lat: number; lng: number };
  spaces: MapSpace[];
  onMarkerPress?: (id: string) => void;
}

export default function FreeMap({ center, spaces, onMarkerPress }: FreeMapProps) {
  return (
    <View style={styles.container}>
      <View style={styles.grid}>
        {[...Array(8)].map((_, i) => (
          <View key={`h${i}`} style={[styles.line, styles.h, { top: `${i * 14}%` }]} />
        ))}
        {[...Array(6)].map((_, i) => (
          <View key={`v${i}`} style={[styles.line, styles.v, { left: `${i * 17}%` }]} />
        ))}
      </View>

      {spaces.map((s) => (
        <TouchableOpacity
          key={s.id}
          onPress={() => onMarkerPress?.(s.id)}
          style={[
            styles.marker,
            {
              top: `${50 - (s.lat - center.lat) * 220}%`,
              left: `${50 + (s.lng - center.lng) * 520}%`,
              backgroundColor: s.available ? '#22C55E' : '#EF4444',
            },
          ]}
        >
          <Text style={styles.markerText}>₹{s.price}</Text>
        </TouchableOpacity>
      ))}

      <View style={styles.userDot}>
        <View style={styles.userDotInner} />
      </View>

      <Text style={styles.note}>🗺️ OpenFreeMap renders on web · install native MapLibre for device builds</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1A2744', position: 'relative', overflow: 'hidden' },
  grid: { ...StyleSheet.absoluteFillObject },
  line: { position: 'absolute', backgroundColor: '#1E3A5F', opacity: 0.5 },
  h: { left: 0, right: 0, height: 1 },
  v: { top: 0, bottom: 0, width: 1 },
  marker: {
    position: 'absolute',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
    elevation: 4,
  },
  markerText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  userDot: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(56,189,248,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  userDotInner: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#38BDF8' },
  note: {
    position: 'absolute',
    bottom: 8,
    left: 0,
    right: 0,
    textAlign: 'center',
    color: '#64748B',
    fontSize: 11,
    backgroundColor: 'rgba(15,23,42,0.7)',
    paddingVertical: 4,
  },
});
