import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { searchApi, pricingApi } from '../../src/api/client';

interface SpaceDetails {
  id: string;
  name: string;
  address: string;
  totalCapacity: number;
  amenities: { evCharging: boolean; covered: boolean; securityLevel: string };
  price: { value: number; currency: string };
  availability: { probabilityPercent: number };
  photoUrls: string[];
}

const SECURITY_LABELS: Record<string, string> = {
  none: 'None',
  basic: 'Basic',
  monitored: 'Monitored',
  staffed: 'Staffed',
  gated: 'Gated',
};

export default function SpaceDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [space, setSpace] = useState<SpaceDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedHours, setSelectedHours] = useState(2);

  useEffect(() => {
    loadSpace();
  }, [id]);

  const loadSpace = async () => {
    setLoading(true);
    try {
      // Mock data since we need search to provide individual space
      // In production, call GET /search/spaces/:id via host-service
      setSpace({
        id: id!,
        name: 'T Nagar Parking Complex',
        address: '23, Panagal Park Road, T Nagar, Chennai 600017',
        totalCapacity: 10,
        amenities: { evCharging: true, covered: true, securityLevel: 'gated' },
        price: { value: 40, currency: 'INR' },
        availability: { probabilityPercent: 78 },
        photoUrls: [],
      });
    } finally {
      setLoading(false);
    }
  };

  const totalCost = space ? space.price.value * selectedHours : 0;

  const handleBook = () => {
    if (!space) return;
    router.push({
      pathname: '/booking/create',
      params: {
        spaceId: space.id,
        spaceName: space.name,
        hours: selectedHours,
        totalAmount: totalCost,
        hourlyRate: space.price.value,
      },
    });
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#38BDF8" />
      </View>
    );
  }

  if (!space) {
    return (
      <View style={styles.center}>
        <Text style={{ color: '#F8FAFC' }}>Space not found</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Image Area */}
        <View style={styles.imageArea}>
          <View style={styles.imagePlaceholder}>
            <Ionicons name="car" size={64} color="#334155" />
            <Text style={styles.imagePlaceholderText}>{space.name}</Text>
          </View>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={20} color="#F8FAFC" />
          </TouchableOpacity>
        </View>

        <View style={styles.content}>
          {/* Header */}
          <View style={styles.header}>
            <View style={{ flex: 1 }}>
              <Text style={styles.name}>{space.name}</Text>
              <Text style={styles.address}>{space.address}</Text>
            </View>
            <View style={styles.availBadge}>
              <View
                style={[
                  styles.availDot,
                  { backgroundColor: space.availability.probabilityPercent > 60 ? '#22C55E' : '#F59E0B' },
                ]}
              />
              <Text style={styles.availText}>{space.availability.probabilityPercent}% free</Text>
            </View>
          </View>

          {/* Price */}
          <View style={styles.priceRow}>
            <Text style={styles.price}>₹{space.price.value}</Text>
            <Text style={styles.priceUnit}>/hour</Text>
          </View>

          {/* Amenities */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Amenities</Text>
            <View style={styles.amenitiesGrid}>
              <View style={styles.amenityItem}>
                <Ionicons name="flash" size={20} color={space.amenities.evCharging ? '#38BDF8' : '#334155'} />
                <Text style={[styles.amenityLabel, !space.amenities.evCharging && styles.amenityDisabled]}>
                  EV Charging
                </Text>
              </View>
              <View style={styles.amenityItem}>
                <Ionicons name="home" size={20} color={space.amenities.covered ? '#38BDF8' : '#334155'} />
                <Text style={[styles.amenityLabel, !space.amenities.covered && styles.amenityDisabled]}>
                  Covered
                </Text>
              </View>
              <View style={styles.amenityItem}>
                <Ionicons name="shield-checkmark" size={20} color="#38BDF8" />
                <Text style={styles.amenityLabel}>{SECURITY_LABELS[space.amenities.securityLevel]}</Text>
              </View>
              <View style={styles.amenityItem}>
                <Ionicons name="car" size={20} color="#38BDF8" />
                <Text style={styles.amenityLabel}>{space.totalCapacity} slots</Text>
              </View>
            </View>
          </View>

          {/* Duration Selector */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Duration</Text>
            <View style={styles.durationRow}>
              {[1, 2, 3, 4, 6, 8].map(h => (
                <TouchableOpacity
                  key={h}
                  style={[styles.durationChip, selectedHours === h && styles.durationChipActive]}
                  onPress={() => setSelectedHours(h)}
                >
                  <Text style={[styles.durationText, selectedHours === h && styles.durationTextActive]}>
                    {h}h
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Summary */}
          <View style={styles.summary}>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>₹{space.price.value} × {selectedHours} hours</Text>
              <Text style={styles.summaryValue}>₹{totalCost}</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Platform fee</Text>
              <Text style={styles.summaryValue}>₹{Math.round(totalCost * 0.05)}</Text>
            </View>
            <View style={[styles.summaryRow, { borderTopWidth: 1, borderTopColor: '#334155', paddingTop: 12 }]}>
              <Text style={[styles.summaryLabel, { color: '#F8FAFC', fontWeight: '700' }]}>Total</Text>
              <Text style={[styles.summaryValue, { color: '#38BDF8', fontSize: 18 }]}>
                ₹{totalCost + Math.round(totalCost * 0.05)}
              </Text>
            </View>
          </View>
        </View>
      </ScrollView>

      {/* Book Button */}
      <View style={styles.footer}>
        <TouchableOpacity style={styles.bookBtn} onPress={handleBook}>
          <Text style={styles.bookBtnText}>Book Now — ₹{totalCost + Math.round(totalCost * 0.05)}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F172A' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0F172A' },
  imageArea: { height: 220, position: 'relative' },
  imagePlaceholder: {
    flex: 1,
    backgroundColor: '#1E293B',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  imagePlaceholderText: { color: '#64748B', fontSize: 14, textAlign: 'center', paddingHorizontal: 16 },
  backBtn: {
    position: 'absolute',
    top: 16,
    left: 16,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(15,23,42,0.8)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: { padding: 20, paddingBottom: 100 },
  header: { flexDirection: 'row', gap: 12, marginBottom: 12 },
  name: { fontSize: 20, fontWeight: '800', color: '#F8FAFC', marginBottom: 4 },
  address: { fontSize: 13, color: '#64748B', lineHeight: 18 },
  availBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#1E293B',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 6,
    alignSelf: 'flex-start',
  },
  availDot: { width: 8, height: 8, borderRadius: 4 },
  availText: { color: '#CBD5E1', fontSize: 12, fontWeight: '600' },
  priceRow: { flexDirection: 'row', alignItems: 'baseline', gap: 4, marginBottom: 24 },
  price: { fontSize: 32, fontWeight: '900', color: '#38BDF8' },
  priceUnit: { fontSize: 14, color: '#64748B' },
  section: { marginBottom: 24 },
  sectionTitle: { fontSize: 14, fontWeight: '700', color: '#CBD5E1', marginBottom: 12, textTransform: 'uppercase', letterSpacing: 0.8 },
  amenitiesGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  amenityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#1E293B',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#334155',
  },
  amenityLabel: { color: '#CBD5E1', fontSize: 13, fontWeight: '500' },
  amenityDisabled: { color: '#475569' },
  durationRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  durationChip: {
    width: 52,
    height: 44,
    borderRadius: 10,
    backgroundColor: '#1E293B',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#334155',
  },
  durationChipActive: { backgroundColor: '#38BDF820', borderColor: '#38BDF8' },
  durationText: { color: '#64748B', fontSize: 14, fontWeight: '600' },
  durationTextActive: { color: '#38BDF8' },
  summary: {
    backgroundColor: '#1E293B',
    borderRadius: 16,
    padding: 16,
    gap: 10,
    borderWidth: 1,
    borderColor: '#334155',
  },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between' },
  summaryLabel: { color: '#94A3B8', fontSize: 14 },
  summaryValue: { color: '#F8FAFC', fontSize: 14, fontWeight: '600' },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#0F172A',
    borderTopWidth: 1,
    borderTopColor: '#1E293B',
    padding: 16,
    paddingBottom: 32,
  },
  bookBtn: {
    backgroundColor: '#38BDF8',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  bookBtnText: { color: '#0F172A', fontSize: 16, fontWeight: '800' },
});
