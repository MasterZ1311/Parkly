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
import { IS_DEMO_MODE, searchApi, pricingApi } from '../../src/api/client';
import { colors } from '../../src/constants/theme';
import { cacheGet, CACHE_KEYS } from '../../src/utils/cache';

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
      if (!id) return;
      // Fetch space details from search API
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
          // Dynamic pricing fetch failed; fallback to base rate
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
      console.warn('Could not fetch live space, checking cache:', err);
      const cachedSpaces = await cacheGet<any[]>(CACHE_KEYS.CACHED_SPACES);
      const match = cachedSpaces?.find((s) => s.id === id);
      if (match) {
        setSpace({
          id: match.id,
          name: match.name,
          address: match.address,
          hostId: match.hostId,
          totalCapacity: match.totalCapacity || 10,
          amenities: {
            evCharging: Boolean(match.amenities?.evCharging ?? match.evCharging),
            covered: Boolean(match.amenities?.covered ?? match.covered),
            securityLevel: match.amenities?.securityLevel || match.securityLevel || 'none',
          },
          price: { value: match.price?.value || match.hourlyRate || 40, currency: 'INR' },
          availability: { probabilityPercent: match.availability?.probabilityPercent || 85 },
          photoUrls: match.photoUrls || [],
        });
        return;
      }
    } finally {
      setLoading(false);
    }

    if (IS_DEMO_MODE) {
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
    } else {
      setSpace(null);
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
        hostId: space.hostId || 'host-chennai-001',
        hours: selectedHours,
        totalAmount: totalCost,
        hourlyRate: space.price.value,
      },
    });
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (!space) {
    return (
      <View style={styles.center}>
        <Text style={{ color: colors.text, marginBottom: 12 }}>Space not found</Text>
        <TouchableOpacity onPress={() => router.back()} style={styles.durationChip}>
          <Text style={{ color: colors.primary, fontWeight: '700', paddingHorizontal: 12 }}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Image Area */}
        <View style={styles.imageArea}>
          <View style={styles.imagePlaceholder}>
            <Ionicons name="car" size={64} color={colors.border} />
            <Text style={styles.imagePlaceholderText}>{space.name}</Text>
          </View>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={20} color={colors.text} />
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
                  { backgroundColor: space.availability.probabilityPercent > 60 ? colors.success : colors.warning },
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
                <Ionicons name="flash" size={20} color={space.amenities.evCharging ? colors.primary : colors.border} />
                <Text style={[styles.amenityLabel, !space.amenities.evCharging && styles.amenityDisabled]}>
                  EV Charging
                </Text>
              </View>
              <View style={styles.amenityItem}>
                <Ionicons name="home" size={20} color={space.amenities.covered ? colors.primary : colors.border} />
                <Text style={[styles.amenityLabel, !space.amenities.covered && styles.amenityDisabled]}>
                  Covered
                </Text>
              </View>
              <View style={styles.amenityItem}>
                <Ionicons name="shield-checkmark" size={20} color={colors.primary} />
                <Text style={styles.amenityLabel}>{SECURITY_LABELS[space.amenities.securityLevel] || space.amenities.securityLevel}</Text>
              </View>
              <View style={styles.amenityItem}>
                <Ionicons name="car" size={20} color={colors.primary} />
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
            <View style={[styles.summaryRow, { borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 12 }]}>
              <Text style={[styles.summaryLabel, { color: colors.text, fontWeight: '700' }]}>Total</Text>
              <Text style={[styles.summaryValue, { color: colors.primary, fontSize: 18 }]}>
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
  container: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background },
  imageArea: { height: 220, position: 'relative' },
  imagePlaceholder: {
    flex: 1,
    backgroundColor: colors.card,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  imagePlaceholderText: { color: colors.textMuted, fontSize: 14, textAlign: 'center', paddingHorizontal: 16 },
  backBtn: {
    position: 'absolute',
    top: 16,
    left: 16,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(10,20,37,0.85)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: { padding: 20, paddingBottom: 100 },
  header: { flexDirection: 'row', gap: 12, marginBottom: 12 },
  name: { fontSize: 20, fontWeight: '800', color: colors.text, marginBottom: 4 },
  address: { fontSize: 13, color: colors.textMuted, lineHeight: 18 },
  availBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.card,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 6,
    alignSelf: 'flex-start',
  },
  availDot: { width: 8, height: 8, borderRadius: 4 },
  availText: { color: colors.textSecondary, fontSize: 12, fontWeight: '600' },
  priceRow: { flexDirection: 'row', alignItems: 'baseline', gap: 4, marginBottom: 24 },
  price: { fontSize: 32, fontWeight: '900', color: colors.primary },
  priceUnit: { fontSize: 14, color: colors.textMuted },
  section: { marginBottom: 24 },
  sectionTitle: { fontSize: 14, fontWeight: '700', color: colors.textSecondary, marginBottom: 12, textTransform: 'uppercase', letterSpacing: 0.8 },
  amenitiesGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  amenityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.card,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  amenityLabel: { color: colors.textSecondary, fontSize: 13, fontWeight: '500' },
  amenityDisabled: { color: colors.textMuted },
  durationRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  durationChip: {
    minWidth: 52,
    height: 44,
    borderRadius: 10,
    backgroundColor: colors.card,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  durationChipActive: { backgroundColor: colors.primaryLight, borderColor: colors.primary },
  durationText: { color: colors.textMuted, fontSize: 14, fontWeight: '600' },
  durationTextActive: { color: colors.primary },
  summary: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 16,
    gap: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between' },
  summaryLabel: { color: colors.textSecondary, fontSize: 14 },
  summaryValue: { color: colors.text, fontSize: 14, fontWeight: '600' },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: colors.background,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    padding: 16,
    paddingBottom: 32,
  },
  bookBtn: {
    backgroundColor: colors.primary,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  bookBtnText: { color: colors.white, fontSize: 16, fontWeight: '800' },
});
