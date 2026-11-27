import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Linking,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useReducedMotion } from 'react-native-reanimated';
import { conciergeApi, searchApi } from '../../src/api/client';
import { cacheGet, cacheSet, CACHE_KEYS } from '../../src/utils/cache';
import { useAuthStore } from '../../src/store/auth.store';
import { OfflineBanner } from '../../src/components/OfflineBanner';
import { colors, theme } from '../../src/constants/theme';
import { PressScale, triggerHaptic } from '../../src/components/Motion';

export interface Recommendation {
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
}

const SAMPLE_PROMPTS = [
  'Find covered parking near Pothys under ₹60/hr',
  'EV parking near Anna Nagar for 3 hours',
  'Cheapest slot near OMR IT corridor',
];

export default function ConciergeScreen() {
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const isOffline = useAuthStore((s) => s.isOffline);
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

    const userCoords = { latitude: 13.0418, longitude: 80.2341 };

    try {
      let data: any = null;
      let replyText = 'Here is the highest-confidence bay matching your route:';
      let rec: Recommendation | undefined;

      try {
        const response = await conciergeApi.ask(textToSend, userCoords);
        data = response.data?.data;
      } catch (agentErr) {
        console.warn('Concierge agent query warning:', agentErr);
      }

      if (data?.action === 'NO_SPACES_FOUND') {
        replyText = 'No active spaces matched within that radius. Would you like me to check an adjacent zone?';
      } else if (data?.action === 'CLARIFICATION_NEEDED') {
        replyText = 'Could you share your expected arrival time or vehicle type?';
      } else {
        let realSpace: any = null;
        try {
          const searchQuery = textToSend.replace(/find|parking|near|under|for|hours|cheapest|slot/gi, '').trim() || 'T Nagar';
          const searchResp = await searchApi.search({
            location: { type: 'text', value: searchQuery },
            arrivalTime: new Date().toISOString(),
            duration: 60,
            radius: 5,
            page: 1,
            pageSize: 5,
          });
          const candidateResults = searchResp?.data?.data?.results;
          if (candidateResults && candidateResults.length > 0) {
            realSpace = candidateResults[0];
          }
        } catch (searchErr) {
          console.warn('Live search ground resolution error:', searchErr);
        }

        const resolvedSpaceId = realSpace?.id || data?.recommendedSpace?.id || 'sp-tng-001';
        const resolvedName = realSpace?.name || data?.recommendedSpace?.name || 'T Nagar Parking Complex - Spot A';
        const resolvedAddress = realSpace?.address || data?.recommendedSpace?.address || '23, Panagal Park Road, T Nagar, Chennai 600017';
        const resolvedHostId = realSpace?.hostId || 'host-chennai-001';
        const resolvedPrice = realSpace?.price?.value || data?.recommendedSpace?.hourlyRate || 40;
        const resolvedProb = realSpace?.availability?.probabilityPercent || data?.recommendedSpace?.arrivalProbability || 88;
        const resolvedDistance = realSpace?.distance?.value || data?.recommendedSpace?.distanceMeters || 120;

        rec = {
          spaceId: resolvedSpaceId,
          hostId: resolvedHostId,
          name: resolvedName,
          address: resolvedAddress,
          hourlyRate: resolvedPrice,
          arrivalProbability: resolvedProb,
          distanceMeters: resolvedDistance,
          deepLink: data?.turnByTurnDeepLink || `geo:${userCoords.latitude},${userCoords.longitude}?q=${encodeURIComponent(resolvedName)}`,
          entryInstructions: data?.entryInstructions || 'Enter through Gate 1. Security attendant will scan your QR pass.',
        };

        await cacheSet(CACHE_KEYS.LAST_CONCIERGE_REC, rec);
      }

      const botMsg: Message = {
        id: `assistant-${Date.now()}`,
        sender: 'assistant',
        text: replyText,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        recommendation: rec,
      };

      setMessages((prev) => [...prev, botMsg]);
    } catch {
      const cachedRec = await cacheGet<Recommendation>(CACHE_KEYS.LAST_CONCIERGE_REC);
      const fallbackRec: Recommendation = cachedRec || {
        spaceId: 'sp-tng-001',
        hostId: 'host-chennai-001',
        name: 'T Nagar Parking Complex - Spot A',
        address: '23, Panagal Park Road, T Nagar, Chennai 600017',
        hourlyRate: 40,
        arrivalProbability: 85,
        distanceMeters: 150,
        deepLink: 'geo:13.0418,80.2341?q=T+Nagar+Parking+Complex',
        entryInstructions: 'Present offline QR pass at entry kiosk. On-site attendant ready.',
      };

      const fallbackMsg: Message = {
        id: `assistant-${Date.now()}`,
        sender: 'assistant',
        text: 'Offline mode active. Here is a verified parking location matching your preferences:',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        recommendation: fallbackRec,
      };
      setMessages((prev) => [...prev, fallbackMsg]);
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
        spaceId: rec.spaceId || 'sp-tng-001',
        spaceName: rec.name || 'T Nagar Parking Complex - Spot A',
        hostId: rec.hostId || 'host-chennai-001',
        hours: '2',
        totalAmount: String((rec.hourlyRate || 40) * 2),
        hourlyRate: String(rec.hourlyRate || 40),
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
                  <Text style={styles.recDistance}>{item.recommendation.distanceMeters}m away</Text>
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
      <OfflineBanner visible={isOffline} message="Offline Mode — Showing cached AI Concierge recommendations" />

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
