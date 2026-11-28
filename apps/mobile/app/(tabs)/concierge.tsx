import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Linking,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { useReducedMotion } from 'react-native-reanimated';
import { conciergeApi, searchApi } from '../../src/api/client';
import { cacheGet, cacheSet, CACHE_KEYS } from '../../src/utils/cache';
import { useAuthStore } from '../../src/store/auth.store';
import { OfflineBanner } from '../../src/components/OfflineBanner';
import { colors, theme } from '../../src/constants/theme';
import { PressScale, triggerHaptic } from '../../src/components/Motion';
import { DEMO_SPACES } from '../../src/data/demoFixtures';
import { classifyApiError, type ClassifiedApiError } from '../../src/utils/apiErrors';

interface Recommendation {
  spaceId: string;
  hostId?: string;
  name: string;
  address: string;
  hourlyRate: number;
  arrivalProbability: number;
  distanceMeters: number;
  deepLink: string;
  entryInstructions: string;
}

interface Message {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  timestamp: string;
  recommendation?: Recommendation;
  errorStatusRoute?: ClassifiedApiError['statusRoute'];
}

const SAMPLE_PROMPTS = [
  'Find covered parking near Pothys under ₹60/hr',
  'EV parking near Anna Nagar for 3 hours',
  'Cheapest slot near OMR IT corridor',
];

const DEFAULT_COORDS = { latitude: 13.0418, longitude: 80.2341 };

function formatDistanceLabel(meters: number): string {
  if (meters >= 1000) {
    return `${(meters / 1000).toFixed(1)}km away`;
  }
  return `${Math.max(1, Math.round(meters))}m away`;
}

export default function ConciergeScreen() {
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const isOffline = useAuthStore((s) => s.isOffline);
  const isDemoMode = useAuthStore((s) => s.isDemoMode);
  const user = useAuthStore((s) => s.user);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      sender: 'assistant',
      text: 'Namaskaram! I am your Chennai Driver Concierge. Tell me where you are headed and I will find and reserve the nearest open bay.',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
  ]);

  const flatListRef = useRef<FlatList>(null);
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    flatListRef.current?.scrollToEnd({ animated: !reducedMotion });
  }, [messages, reducedMotion]);

  const resolveUserCoords = async () => {
    try {
      const perm = await Location.getForegroundPermissionsAsync();
      if (perm.status === 'granted') {
        const pos = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        return { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
      }
    } catch {
      // Default to Chennai central coords when GPS is unavailable
    }
    return DEFAULT_COORDS;
  };

  const handleSend = async (queryText?: string) => {
    const textToSend = (queryText || input).trim();
    if (!textToSend || loading) return;

    triggerHaptic('light');
    const userMsg: Message = {
      id: `user-${Date.now()}`,
      sender: 'user',
      text: textToSend,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    if (!queryText) setInput('');
    setLoading(true);

    if (isDemoMode) {
      const qLower = textToSend.toLowerCase();
      const matched =
        DEMO_SPACES.find(
          (s) =>
            (qLower.includes('ev') && s.amenities.evCharging) ||
            (qLower.includes('adyar') && s.name.toLowerCase().includes('adyar')) ||
            (qLower.includes('velachery') && s.name.toLowerCase().includes('velachery')) ||
            s.address.toLowerCase().includes(qLower),
        ) || DEMO_SPACES[0];

      const demoRec: Recommendation = {
        spaceId: matched.id,
        hostId: matched.hostId,
        name: matched.name,
        address: matched.address,
        hourlyRate: matched.price.value,
        arrivalProbability: matched.availability.probabilityPercent,
        distanceMeters: Math.round(matched.distance.value * 1000),
        deepLink: `geo:${matched.coordinates.lat},${matched.coordinates.lng}?q=${encodeURIComponent(matched.name)}`,
        entryInstructions: 'Demo bay pass active. Present offline QR code at Gate 1.',
      };

      await cacheSet(CACHE_KEYS.LAST_CONCIERGE_REC, demoRec);
      setMessages((prev) => [
        ...prev,
        {
          id: `assistant-${Date.now()}`,
          sender: 'assistant',
          text: 'Demo Concierge match ready for your Chennai route:',
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          recommendation: demoRec,
        },
      ]);
      setLoading(false);
      return;
    }

    const userCoords = await resolveUserCoords();

    try {
      let data: any = null;
      let agentError: unknown = null;

      try {
        const response = await conciergeApi.ask(textToSend, userCoords, user?.id);
        data = response.data?.data;
      } catch (err) {
        agentError = err;
      }

      if (agentError) {
        const classified = classifyApiError(agentError, 'AI Concierge could not reach the server.');
        if (classified.kind === 'session-expired') {
          router.replace('/status/session-expired');
          return;
        }
        if (classified.kind === 'restricted') {
          router.replace('/status/restricted');
          return;
        }

        // Only try live inventory search fallback if we are not offline/maintenance-blocked
        if (classified.kind !== 'offline' && classified.kind !== 'maintenance') {
          const searchQuery =
            textToSend.replace(/find|parking|near|under|for|hours|cheapest|slot|rupees|₹\d+/gi, '').trim() ||
            'Chennai';
          try {
            const searchResp = await searchApi.search({
              location: { type: 'text', value: searchQuery },
              arrivalTime: new Date(Date.now() + 2 * 60 * 1000).toISOString(),
              duration: 60,
              radius: 8,
              page: 1,
              pageSize: 5,
            });
            const candidateResults = searchResp?.data?.data?.results || [];
            if (candidateResults.length > 0) {
              const top = candidateResults[0];
              const distanceMeters = top.distance
                ? top.distance.unit === 'km'
                  ? Math.round(Number(top.distance.value) * 1000)
                  : Math.round(Number(top.distance.value))
                : 500;
              const searchRec: Recommendation = {
                spaceId: top.id,
                hostId: top.hostId,
                name: top.name,
                address: top.address,
                hourlyRate: Number(top.price?.value ?? 40),
                arrivalProbability: Number(top.availability?.probabilityPercent ?? 80),
                distanceMeters,
                deepLink: `geo:${top.coordinates?.lat ?? userCoords.latitude},${top.coordinates?.lng ?? userCoords.longitude}?q=${encodeURIComponent(top.name)}`,
                entryInstructions: 'Live inventory bay ready. Show booking QR pass at entry.',
              };
              await cacheSet(CACHE_KEYS.LAST_CONCIERGE_REC, searchRec);
              setMessages((prev) => [
                ...prev,
                {
                  id: `assistant-${Date.now()}`,
                  sender: 'assistant',
                  text: 'Concierge AI is busy right now, so I fetched the best live bay match for you:',
                  timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                  recommendation: searchRec,
                },
              ]);
              return;
            }
          } catch {
            // Fall through to honest error display below
          }
        }

        if (classified.kind === 'offline') {
          const cachedRec = await cacheGet<Recommendation>(CACHE_KEYS.LAST_CONCIERGE_REC);
          if (cachedRec) {
            setMessages((prev) => [
              ...prev,
              {
                id: `assistant-${Date.now()}`,
                sender: 'assistant',
                text: 'Device is offline. Showing your most recent cached bay recommendation (verify live availability once online):',
                timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                recommendation: cachedRec,
              },
            ]);
            return;
          }
        }

        setMessages((prev) => [
          ...prev,
          {
            id: `assistant-${Date.now()}`,
            sender: 'assistant',
            text: classified.message,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            errorStatusRoute: classified.statusRoute,
          },
        ]);
        return;
      }

      if (data?.action === 'NO_SPACES_FOUND') {
        setMessages((prev) => [
          ...prev,
          {
            id: `assistant-${Date.now()}`,
            sender: 'assistant',
            text: 'No active parking bays matched your criteria in that area. Try expanding to an adjacent zone.',
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          },
        ]);
        return;
      }

      if (data?.action === 'CLARIFICATION_NEEDED') {
        setMessages((prev) => [
          ...prev,
          {
            id: `assistant-${Date.now()}`,
            sender: 'assistant',
            text:
              data?.message ||
              'Could you clarify the Chennai neighborhood, arrival time, or EV/covered requirement?',
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          },
        ]);
        return;
      }

      const recommended = data?.recommendedSpace;
      if (!recommended?.id) {
        setMessages((prev) => [
          ...prev,
          {
            id: `assistant-${Date.now()}`,
            sender: 'assistant',
            text:
              data?.message ||
              'I could not confirm an open bay right now. Try searching from the Find tab.',
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          },
        ]);
        return;
      }

      const rec: Recommendation = {
        spaceId: recommended.id,
        hostId: recommended.hostId,
        name: recommended.name,
        address: recommended.address || 'Chennai Smart Parking Grid',
        hourlyRate: Number(recommended.hourlyRate ?? 40),
        arrivalProbability: Number(recommended.arrivalProbability ?? 85),
        distanceMeters: Number(recommended.distanceMeters ?? 350),
        deepLink:
          data?.turnByTurnDeepLink ||
          `geo:${userCoords.latitude},${userCoords.longitude}?q=${encodeURIComponent(recommended.name)}`,
        entryInstructions:
          data?.entryInstructions ||
          'Enter through the main barrier and scan your active QR pass.',
      };

      await cacheSet(CACHE_KEYS.LAST_CONCIERGE_REC, rec);

      setMessages((prev) => [
        ...prev,
        {
          id: `assistant-${Date.now()}`,
          sender: 'assistant',
          text: data?.message || 'Here is the highest-confidence bay matching your route:',
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          recommendation: rec,
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenNav = (deepLink?: string) => {
    if (!deepLink) return;
    Linking.openURL(deepLink).catch(() => {
      Linking.openURL('https://maps.google.com/?q=Chennai');
    });
  };

  const handleReserve = (rec: Recommendation) => {
    router.push({
      pathname: '/booking/create',
      params: {
        spaceId: rec.spaceId,
        spaceName: rec.name,
        hostId: rec.hostId || '',
        hours: '2',
        totalAmount: String(rec.hourlyRate * 2),
        hourlyRate: String(rec.hourlyRate),
      },
    });
  };

  const renderMessage = ({ item }: { item: Message }) => {
    const isUser = item.sender === 'user';

    return (
      <View style={[styles.msgWrapper, isUser ? styles.userWrapper : styles.botWrapper]}>
        {!isUser && (
          <View style={styles.avatar}>
            <Ionicons name="navigate-circle-outline" size={18} color={colors.white} />
          </View>
        )}
        <View style={{ flex: 1, alignItems: isUser ? 'flex-end' : 'flex-start' }}>
          <View style={[styles.bubble, isUser ? styles.userBubble : styles.botBubble]}>
            <Text style={[styles.msgText, isUser && styles.userText]}>{item.text}</Text>
            {item.errorStatusRoute && (
              <Text
                style={styles.statusLink}
                onPress={() => router.push(item.errorStatusRoute!)}
              >
                Check Service Status →
              </Text>
            )}
            <Text style={[styles.msgTime, isUser && styles.userTime]}>{item.timestamp}</Text>
          </View>

          {item.recommendation && (
            <View style={styles.recCard}>
              <View style={styles.recHeader}>
                <View style={{ flex: 1, marginRight: 8 }}>
                  <Text style={styles.recName}>{item.recommendation.name}</Text>
                  <Text style={styles.recAddress}>{item.recommendation.address}</Text>
                </View>
                <View style={styles.probBadge}>
                  <Ionicons name="shield-checkmark" size={12} color={colors.success} />
                  <Text style={styles.probText}>{item.recommendation.arrivalProbability}% open</Text>
                </View>
              </View>

              <View style={styles.recMetaRow}>
                <Text style={styles.recPrice}>
                  ₹{item.recommendation.hourlyRate}
                  <Text style={{ fontSize: 12, fontWeight: '600', color: colors.textMuted }}>/hr</Text>
                </Text>
                <View style={styles.distRow}>
                  <Ionicons name="navigate-outline" size={13} color={colors.textMuted} />
                  <Text style={styles.recDistance}>
                    {formatDistanceLabel(item.recommendation.distanceMeters)}
                  </Text>
                </View>
              </View>

              {item.recommendation.entryInstructions && (
                <View style={styles.instructionsBox}>
                  <Ionicons name="information-circle-outline" size={15} color={colors.textSecondary} />
                  <Text style={styles.instructionsText}>{item.recommendation.entryInstructions}</Text>
                </View>
              )}

              <View style={styles.actionRow}>
                <PressScale
                  style={styles.navBtn}
                  contentStyle={styles.actionBtnContent}
                  haptic="light"
                  onPress={() => handleOpenNav(item.recommendation?.deepLink)}
                >
                  <Ionicons name="navigate-outline" size={16} color={colors.navy} />
                  <Text style={styles.navBtnText}>Directions</Text>
                </PressScale>

                <PressScale
                  style={styles.bookBtn}
                  contentStyle={styles.actionBtnContent}
                  rippleColor={colors.rippleLight}
                  haptic="medium"
                  onPress={() => handleReserve(item.recommendation!)}
                >
                  <Ionicons name="flash" size={16} color={colors.white} />
                  <Text style={styles.bookBtnText}>Reserve</Text>
                </PressScale>
              </View>
            </View>
          )}
        </View>
      </View>
    );
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      {isDemoMode ? (
        <View style={styles.demoStrip}>
          <Ionicons name="sparkles-outline" size={14} color={colors.navy} />
          <Text style={styles.demoStripText}>DEMO MODE · Simulated Chennai AI Concierge</Text>
        </View>
      ) : (
        <OfflineBanner
          visible={isOffline}
          message="Offline Mode — Live concierge unavailable until reconnected"
        />
      )}

      <View style={styles.promptBar}>
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={SAMPLE_PROMPTS}
          keyExtractor={(p) => p}
          renderItem={({ item }) => (
            <PressScale
              style={styles.promptChip}
              contentStyle={styles.promptChipContent}
              haptic="selection"
              onPress={() => handleSend(item)}
            >
              <Text style={styles.promptChipText}>{item}</Text>
            </PressScale>
          )}
          contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}
        />
      </View>

      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={(m) => m.id}
        renderItem={renderMessage}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
      />

      {loading && (
        <View style={styles.loadingRow}>
          <ActivityIndicator size="small" color={colors.primary} />
          <Text style={styles.loadingText}>Analyzing live Chennai bay availability...</Text>
        </View>
      )}

      <View style={styles.inputContainer}>
        <TextInput
          style={styles.textInput}
          placeholder="Ask Concierge (e.g. 2 hrs near Pothys under ₹50)..."
          placeholderTextColor={colors.textMuted}
          value={input}
          onChangeText={setInput}
          onSubmitEditing={() => handleSend()}
          returnKeyType="send"
        />
        <PressScale
          style={[styles.sendBtn, !input.trim() && styles.sendBtnDisabled]}
          contentStyle={styles.sendBtnContent}
          rippleColor={colors.rippleLight}
          onPress={() => handleSend()}
          disabled={!input.trim() || loading}
          accessibilityLabel="Send concierge query"
        >
          <Ionicons name="arrow-up" size={20} color={colors.white} />
        </PressScale>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  demoStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 7,
    paddingHorizontal: 12,
    backgroundColor: colors.cardElevated,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  demoStripText: {
    color: colors.navy,
    fontSize: 11.5,
    fontWeight: '700',
  },
  promptBar: {
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.surface,
  },
  promptChip: {
    backgroundColor: colors.cardElevated,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  promptChipContent: { paddingHorizontal: 14, minHeight: 48, justifyContent: 'center' },
  promptChipText: { color: colors.navy, fontSize: 12.5, fontWeight: '600' },
  listContent: { padding: 16, paddingBottom: 24, gap: 16 },
  msgWrapper: { flexDirection: 'row', gap: 10, width: '100%' },
  userWrapper: { justifyContent: 'flex-end' },
  botWrapper: { justifyContent: 'flex-start' },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: colors.navy,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 2,
  },
  bubble: {
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 11,
    maxWidth: '86%',
  },
  userBubble: { backgroundColor: colors.navy, borderBottomRightRadius: 4 },
  botBubble: {
    backgroundColor: colors.surface,
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: colors.border,
  },
  msgText: { color: colors.navy, fontSize: 14, lineHeight: 20, fontWeight: '500' },
  userText: { color: colors.white, fontWeight: '600' },
  statusLink: {
    color: colors.primary,
    fontSize: 12.5,
    fontWeight: '800',
    marginTop: 6,
    textDecorationLine: 'underline',
  },
  msgTime: { fontSize: 10, color: colors.textMuted, marginTop: 4, alignSelf: 'flex-end', fontVariant: ['tabular-nums'] },
  userTime: { color: '#9FB0C7' },
  recCard: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    padding: 16,
    marginTop: 10,
    width: '94%',
    ...theme.elevation.card,
  },
  recHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 },
  recName: { fontSize: 15.5, fontWeight: '800', color: colors.navy, marginBottom: 2 },
  recAddress: { fontSize: 12.5, color: colors.textMuted },
  probBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.successLight,
    borderWidth: 1,
    borderColor: colors.successBorder,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  probText: { color: colors.success, fontSize: 11.5, fontWeight: '800', fontVariant: ['tabular-nums'] },
  recMetaRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginVertical: 8 },
  recPrice: { fontSize: 20, fontWeight: '800', color: colors.primary, fontVariant: ['tabular-nums'] },
  distRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  recDistance: { fontSize: 12.5, color: colors.textMuted, fontWeight: '600', fontVariant: ['tabular-nums'] },
  instructionsBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.cardElevated,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 10,
    borderRadius: 8,
    marginBottom: 12,
  },
  instructionsText: { color: colors.textSecondary, fontSize: 12.5, flex: 1, lineHeight: 17 },
  actionRow: { flexDirection: 'row', gap: 10, marginTop: 2 },
  navBtn: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    overflow: 'hidden',
  },
  bookBtn: {
    flex: 1,
    backgroundColor: colors.primary,
    borderRadius: 10,
    overflow: 'hidden',
  },
  actionBtnContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    minHeight: 48,
  },
  navBtnText: { color: colors.navy, fontSize: 13.5, fontWeight: '700' },
  bookBtnText: { color: colors.white, fontSize: 13.5, fontWeight: '800' },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  loadingText: { color: colors.textMuted, fontSize: 12.5, fontWeight: '600' },
  inputContainer: {
    flexDirection: 'row',
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    gap: 8,
    alignItems: 'center',
  },
  textInput: {
    flex: 1,
    backgroundColor: colors.background,
    borderRadius: 12,
    paddingHorizontal: 14,
    minHeight: 48,
    color: colors.navy,
    fontSize: 14,
    borderWidth: 1,
    borderColor: colors.borderStrong,
  },
  sendBtn: {
    width: 48,
    borderRadius: 12,
    backgroundColor: colors.primary,
    overflow: 'hidden',
  },
  sendBtnContent: {
    width: 48,
    minHeight: 48,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendBtnDisabled: { opacity: 0.45 },
});
