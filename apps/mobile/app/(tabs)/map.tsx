import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

// In a real app, this uses react-native-maps with Google Maps
// For web/demo, we show a styled map placeholder
export default function MapScreen() {
  const [region, setRegion] = useState({
    latitude: 13.0827,
    longitude: 80.2707,
    latitudeDelta: 0.05,
    longitudeDelta: 0.05,
  });

  // Mock parking spaces on map
  const mockSpaces = [
    { id: '1', name: 'T Nagar Parking Complex', lat: 13.0418, lng: 80.2341, available: true, price: 40 },
    { id: '2', name: 'Anna Nagar Multi-Level', lat: 13.0849, lng: 80.2101, available: false, price: 60 },
    { id: '3', name: 'Adyar Smart Park', lat: 13.0067, lng: 80.2566, available: true, price: 35 },
    { id: '4', name: 'Velachery EV Park', lat: 12.9791, lng: 80.2204, available: true, price: 50 },
  ];

  return (
    <View style={styles.container}>
      {/* Map Placeholder (replace with MapView in production) */}
      <View style={styles.mapPlaceholder}>
        <View style={styles.mapGrid}>
          {/* Simulated map grid lines */}
          {[...Array(8)].map((_, i) => (
            <View key={`h${i}`} style={[styles.gridLine, styles.horizontal, { top: `${i * 14}%` }]} />
          ))}
          {[...Array(6)].map((_, i) => (
            <View key={`v${i}`} style={[styles.gridLine, styles.vertical, { left: `${i * 17}%` }]} />
          ))}
        </View>

        {/* Chennai Label */}
        <View style={styles.cityLabel}>
          <Text style={styles.cityLabelText}>Chennai, Tamil Nadu</Text>
        </View>

        {/* Parking Markers */}
        {mockSpaces.map((space) => (
          <TouchableOpacity key={space.id} style={[
            styles.marker,
            {
              top: `${40 + (space.lat - 13.0) * 200}%`,
              left: `${40 + (space.lng - 80.1) * 500}%`,
              backgroundColor: space.available ? '#22C55E' : '#EF4444',
            },
          ]}>
            <Text style={styles.markerText}>₹{space.price}</Text>
          </TouchableOpacity>
        ))}

        {/* User location dot */}
        <View style={styles.userDot}>
          <View style={styles.userDotInner} />
        </View>

        {/* Map Attribution */}
        <Text style={styles.mapNote}>
          📍 Map view (Google Maps API key needed for production)
        </Text>
      </View>

      {/* Bottom Sheet */}
      <View style={styles.bottomSheet}>
        <Text style={styles.bottomTitle}>Nearby Spaces</Text>
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

        {mockSpaces.map(space => (
          <View key={space.id} style={styles.listItem}>
            <View style={[styles.statusDot, { backgroundColor: space.available ? '#22C55E' : '#EF4444' }]} />
            <View style={styles.listInfo}>
              <Text style={styles.listName}>{space.name}</Text>
              <Text style={styles.listStatus}>{space.available ? 'Available' : 'Full'}</Text>
            </View>
            <Text style={styles.listPrice}>₹{space.price}/hr</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F172A' },
  mapPlaceholder: {
    flex: 1,
    backgroundColor: '#1A2744',
    position: 'relative',
    overflow: 'hidden',
  },
  mapGrid: { ...StyleSheet.absoluteFillObject },
  gridLine: { position: 'absolute', backgroundColor: '#1E3A5F', opacity: 0.5 },
  horizontal: { left: 0, right: 0, height: 1 },
  vertical: { top: 0, bottom: 0, width: 1 },
  cityLabel: {
    position: 'absolute',
    top: '45%',
    left: '30%',
    backgroundColor: 'rgba(30,41,59,0.8)',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  cityLabelText: { color: '#94A3B8', fontSize: 13, fontWeight: '600' },
  marker: {
    position: 'absolute',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
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
  mapNote: {
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
  bottomSheet: {
    backgroundColor: '#1E293B',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: 260,
  },
  bottomTitle: { color: '#F8FAFC', fontSize: 16, fontWeight: '700', marginBottom: 12 },
  legend: { flexDirection: 'row', gap: 16, marginBottom: 12 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  legendText: { color: '#94A3B8', fontSize: 12 },
  listItem: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#334155' },
  statusDot: { width: 10, height: 10, borderRadius: 5, flexShrink: 0 },
  listInfo: { flex: 1 },
  listName: { color: '#F8FAFC', fontSize: 13, fontWeight: '600' },
  listStatus: { color: '#64748B', fontSize: 11 },
  listPrice: { color: '#38BDF8', fontWeight: '700' },
});
