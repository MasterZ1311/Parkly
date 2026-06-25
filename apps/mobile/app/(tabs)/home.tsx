import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { searchApi } from '../../src/api/client';

interface SpaceResult {
  id: string;
  name: string;
  address: string;
  distance: { value: number; unit: string };
  price: { value: number; currency: string; per: string };
  availability: { probabilityPercent: number; confidencePercent: number };
  amenities: { evCharging: boolean; covered: boolean; securityLevel: string };
}

export default function HomeScreen() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SpaceResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  const handleSearch = useCallback(async () => {
    if (!query.trim()) return;
    setLoading(true);
    setSearched(true);
    try {
      const { data } = await searchApi.search({
        location: { type: 'text', value: query },
        arrivalTime: new Date().toISOString(),
        duration: 60,
        radius: 5,
        page: 1,
        pageSize: 20,
      });
      setResults(data.data.results || []);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, [query]);

  const renderItem = ({ item }: { item: SpaceResult }) => (
    <TouchableOpacity
      style={styles.card}
      onPress={() => router.push({ pathname: '/space/[id]', params: { id: item.id } })}
      activeOpacity={0.8}
    >
      <View style={styles.cardHeader}>
        <View style={styles.cardTitleRow}>
          <Text style={styles.cardName} numberOfLines={1}>{item.name}</Text>
          <View style={styles.availBadge}>
            <View
              style={[
                styles.availDot,
                { backgroundColor: item.availability.probabilityPercent > 60 ? '#22C55E' : '#F59E0B' },
              ]}
            />
            <Text style={styles.availText}>{item.availability.probabilityPercent}%</Text>
          </View>
        </View>
        <Text style={styles.cardAddress} numberOfLines={1}>{item.address}</Text>
      </View>

      <View style={styles.cardFooter}>
        <Text style={styles.distance}>
          <Ionicons name="location" size={12} color="#64748B" /> {item.distance.value} {item.distance.unit}
        </Text>
        <View style={styles.amenities}>
          {item.amenities.evCharging && (
            <View style={styles.badge}><Text style={styles.badgeText}>⚡ EV</Text></View>
          )}
          {item.amenities.covered && (
            <View style={styles.badge}><Text style={styles.badgeText}>🏠 Covered</Text></View>
          )}
        </View>
        <Text style={styles.price}>₹{item.price.value}<Text style={styles.priceUnit}>/hr</Text></Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <View style={styles.searchBar}>
          <Ionicons name="search" size={20} color="#64748B" style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search location (e.g. T Nagar, Chennai)"
            placeholderTextColor="#64748B"
            value={query}
            onChangeText={setQuery}
            onSubmitEditing={handleSearch}
            returnKeyType="search"
          />
          {query.length > 0 && (
            <TouchableOpacity onPress={() => { setQuery(''); setResults([]); setSearched(false); }}>
              <Ionicons name="close-circle" size={20} color="#64748B" />
            </TouchableOpacity>
          )}
        </View>
        <TouchableOpacity style={styles.searchButton} onPress={handleSearch}>
          <Ionicons name="arrow-forward" size={20} color="#0F172A" />
        </TouchableOpacity>
      </View>

      {/* Quick Filters */}
      <View style={styles.quickFilters}>
        {['All', '⚡ EV', '🏠 Covered', '🔒 Secure'].map(filter => (
          <TouchableOpacity key={filter} style={styles.filterChip}>
            <Text style={styles.filterText}>{filter}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Results */}
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#38BDF8" />
          <Text style={styles.loadingText}>Finding parking spaces...</Text>
        </View>
      ) : !searched ? (
        <View style={styles.emptyState}>
          <Ionicons name="car-outline" size={64} color="#334155" />
          <Text style={styles.emptyTitle}>Find Parking Near You</Text>
          <Text style={styles.emptySubtitle}>
            Search by area, landmark, or address to discover available parking spaces.
          </Text>
          {/* Quick area chips */}
          <View style={styles.areaSuggestions}>
            {['T Nagar', 'Anna Nagar', 'Adyar', 'Velachery'].map(area => (
              <TouchableOpacity
                key={area}
                style={styles.areaSuggestion}
                onPress={() => { setQuery(area); }}
              >
                <Text style={styles.areaSuggestionText}>{area}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      ) : results.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="sad-outline" size={64} color="#334155" />
          <Text style={styles.emptyTitle}>No Spaces Found</Text>
          <Text style={styles.emptySubtitle}>Try a different location or expand your search radius.</Text>
        </View>
      ) : (
        <FlatList
          data={results}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={
            <Text style={styles.resultCount}>{results.length} spaces found</Text>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F172A' },
  searchContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
    backgroundColor: '#0F172A',
  },
  searchBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E293B',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#334155',
  },
  searchIcon: { marginRight: 8 },
  searchInput: { flex: 1, color: '#F8FAFC', fontSize: 14 },
  searchButton: {
    backgroundColor: '#38BDF8',
    borderRadius: 12,
    width: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  quickFilters: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 8,
    marginBottom: 8,
  },
  filterChip: {
    backgroundColor: '#1E293B',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: '#334155',
  },
  filterText: { color: '#CBD5E1', fontSize: 12 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
  loadingText: { color: '#94A3B8', fontSize: 14 },
  emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 32, gap: 12 },
  emptyTitle: { fontSize: 20, fontWeight: '700', color: '#F8FAFC', textAlign: 'center' },
  emptySubtitle: { fontSize: 14, color: '#64748B', textAlign: 'center', lineHeight: 20 },
  areaSuggestions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center', marginTop: 8 },
  areaSuggestion: {
    backgroundColor: '#1E293B',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#38BDF8',
  },
  areaSuggestionText: { color: '#38BDF8', fontSize: 13 },
  list: { paddingHorizontal: 16, paddingBottom: 16 },
  resultCount: { color: '#64748B', fontSize: 13, marginBottom: 12 },
  card: {
    backgroundColor: '#1E293B',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#334155',
  },
  cardHeader: { marginBottom: 12 },
  cardTitleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  cardName: { flex: 1, fontSize: 16, fontWeight: '700', color: '#F8FAFC', marginRight: 8 },
  availBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#0F172A', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  availDot: { width: 8, height: 8, borderRadius: 4 },
  availText: { color: '#CBD5E1', fontSize: 12, fontWeight: '600' },
  cardAddress: { color: '#64748B', fontSize: 13 },
  cardFooter: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  distance: { color: '#64748B', fontSize: 12, flex: 1 },
  amenities: { flexDirection: 'row', gap: 4 },
  badge: { backgroundColor: '#0F172A', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  badgeText: { color: '#94A3B8', fontSize: 10 },
  price: { color: '#38BDF8', fontSize: 16, fontWeight: '800' },
  priceUnit: { color: '#64748B', fontSize: 11, fontWeight: '400' },
});
