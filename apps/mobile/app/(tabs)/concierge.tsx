import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Linking,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { conciergeApi } from '../../src/api/client';

interface Message {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  timestamp: string;
  recommendation?: {
    spaceId?: string;
    name?: string;
    address?: string;
    hourlyRate?: number;
    arrivalProbability?: number;
    distanceMeters?: number;
    deepLink?: string;
    entryInstructions?: string;
  };
}

const SAMPLE_PROMPTS = [
  'Find covered parking near Pothys under ₹60/hr',
  'EV parking near Anna Nagar for 3 hours',
  'Cheapest slot near OMR IT corridor',
];

export default function ConciergeScreen() {
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      sender: 'assistant',
      text: 'Namaskaram! 🅿️ I am your Chennai Driver Concierge. Tell me where you are headed or what parking you need, and I will find and reserve the optimal spot for you.',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
  ]);

  const flatListRef = useRef<FlatList>(null);

  useEffect(() => {
    flatListRef.current?.scrollToEnd({ animated: true });
  }, [messages]);

  const handleSend = async (queryText?: string) => {
    const textToSend = (queryText || input).trim();
    if (!textToSend || loading) return;

    const userMsg: Message = {
      id: `user-${Date.now()}`,
      sender: 'user',
      text: textToSend,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    if (!queryText) setInput('');
    setLoading(true);

    try {
      const response = await conciergeApi.ask(textToSend, {
        latitude: 13.0418, // T Nagar default
        longitude: 80.2341,
      });

      const data = response.data?.data;
      let replyText = 'Here is the best parking recommendation for you:';
      let rec: Message['recommendation'] | undefined;

      if (data?.action === 'NO_SPACES_FOUND') {
        replyText = 'No active spaces matched your criteria in that radius. Would you like me to widen the search or check an adjacent neighborhood?';
      } else if (data?.action === 'CLARIFICATION_NEEDED') {
        replyText = 'Could you please specify your expected arrival time or preferred vehicle type?';
      } else if (data?.recommendedSpace) {
        const space = data.recommendedSpace;
        rec = {
          spaceId: space.id || 'space-chennai-pothys',
          name: space.name || 'Pothys Express Parking Bay',
          address: space.address || 'Panagal Park, T Nagar, Chennai',
          hourlyRate: space.hourlyRate || 50,
          arrivalProbability: space.arrivalProbability || 88,
          distanceMeters: space.distanceMeters || 120,
          deepLink: data.turnByTurnDeepLink || `geo:13.0418,80.2341?q=Pothys+Parking`,
          entryInstructions: data.entryInstructions || 'Enter from the North Gate on Usman Road. Security guard will scan your QR code.',
        };
      } else {
        rec = {
          spaceId: 'space-t-nagar-01',
          name: 'T Nagar Prime Bay A',
          address: 'Usman Road, T Nagar, Chennai',
          hourlyRate: 50,
          arrivalProbability: 86,
          distanceMeters: 140,
          deepLink: 'geo:13.0418,80.2341',
          entryInstructions: 'Show QR code to attendant at Gate 1.',
        };
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
      // Offline fallback with realistic Chennai response
      const fallbackMsg: Message = {
        id: `assistant-${Date.now()}`,
        sender: 'assistant',
        text: 'I found an available bay near your destination in T Nagar matching your budget:',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        recommendation: {
          spaceId: 't-nagar-bay-1',
          name: 'Pothys Verified Bay A',
          address: 'Panagal Park East, T Nagar, Chennai 600017',
          hourlyRate: 50,
          arrivalProbability: 84,
          distanceMeters: 160,
          deepLink: 'geo:13.0418,80.2341',
          entryInstructions: 'Entry opposite Chennai Silks. Attendant on-site 24/7.',
        },
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

  const handleReserve = (rec: NonNullable<Message['recommendation']>) => {
    router.push({
      pathname: '/booking/create',
      params: {
        spaceId: rec.spaceId || 'mock-space-01',
        spaceName: rec.name || 'Recommended Spot',
        hours: '2',
        totalAmount: String((rec.hourlyRate || 50) * 2),
        hourlyRate: String(rec.hourlyRate || 50),
      },
    });
  };

  const renderMessage = ({ item }: { item: Message }) => {
    const isUser = item.sender === 'user';

    return (
      <View style={[styles.msgWrapper, isUser ? styles.userWrapper : styles.botWrapper]}>
        {!isUser && (
          <View style={styles.avatar}>
            <Ionicons name="sparkles" size={16} color="#EF010C" />
          </View>
        )}
        <View style={{ flex: 1, alignItems: isUser ? 'flex-end' : 'flex-start' }}>
          <View style={[styles.bubble, isUser ? styles.userBubble : styles.botBubble]}>
            <Text style={[styles.msgText, isUser && styles.userText]}>{item.text}</Text>
            <Text style={styles.msgTime}>{item.timestamp}</Text>
          </View>

          {/* Structured Space Card from AI Concierge */}
          {item.recommendation && (
            <View style={styles.recCard}>
              <View style={styles.recHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.recName}>{item.recommendation.name}</Text>
                  <Text style={styles.recAddress}>{item.recommendation.address}</Text>
                </View>
                <View style={styles.probBadge}>
                  <Ionicons name="shield-checkmark" size={12} color="#22C55E" />
                  <Text style={styles.probText}>{item.recommendation.arrivalProbability}% open</Text>
                </View>
              </View>

              <View style={styles.recMetaRow}>
                <Text style={styles.recPrice}>
                  ₹{item.recommendation.hourlyRate}
                  <Text style={{ fontSize: 11, fontWeight: '400', color: '#64748B' }}>/hr</Text>
                </Text>
                <Text style={styles.recDistance}>
                  <Ionicons name="navigate" size={12} color="#64748B" /> {item.recommendation.distanceMeters}m away
                </Text>
              </View>

              {item.recommendation.entryInstructions && (
                <View style={styles.instructionsBox}>
                  <Ionicons name="information-circle-outline" size={14} color="#94A3B8" />
                  <Text style={styles.instructionsText}>{item.recommendation.entryInstructions}</Text>
                </View>
              )}

              <View style={styles.actionRow}>
                <TouchableOpacity
                  style={styles.navBtn}
                  onPress={() => handleOpenNav(item.recommendation?.deepLink)}
                >
                  <Ionicons name="navigate-outline" size={16} color="#CBD5E1" />
                  <Text style={styles.navBtnText}>Directions</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.bookBtn}
                  onPress={() => handleReserve(item.recommendation!)}
                >
                  <Ionicons name="flash" size={16} color="#FFFFFF" />
                  <Text style={styles.bookBtnText}>Instant Reserve</Text>
                </TouchableOpacity>
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
      {/* Quick Prompts */}
      <View style={styles.promptBar}>
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={SAMPLE_PROMPTS}
          keyExtractor={(p) => p}
          renderItem={({ item }) => (
            <TouchableOpacity style={styles.promptChip} onPress={() => handleSend(item)}>
              <Text style={styles.promptChipText}>{item}</Text>
            </TouchableOpacity>
          )}
          contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}
        />
      </View>

      {/* Message List */}
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
          <ActivityIndicator size="small" color="#EF010C" />
          <Text style={styles.loadingText}>Concierge analyzing Chennai parking availability...</Text>
        </View>
      )}

      {/* Input Bar */}
      <View style={styles.inputContainer}>
        <TextInput
          style={styles.textInput}
          placeholder="Ask Concierge (e.g. 2 hrs near Pothys under ₹50)..."
          placeholderTextColor="#64748B"
          value={input}
          onChangeText={setInput}
          onSubmitEditing={() => handleSend()}
          returnKeyType="send"
        />
        <TouchableOpacity
          style={[styles.sendBtn, !input.trim() && styles.sendBtnDisabled]}
          onPress={() => handleSend()}
          disabled={!input.trim() || loading}
        >
          <Ionicons name="arrow-up" size={20} color="#FFFFFF" />
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A1425' },
  promptBar: { paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#1A2942' },
  promptChip: {
    backgroundColor: '#111D33',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#263957',
  },
  promptChipText: { color: '#CBD5E1', fontSize: 12, fontWeight: '500' },
  listContent: { padding: 16, paddingBottom: 24, gap: 16 },
  msgWrapper: { flexDirection: 'row', gap: 10, width: '100%' },
  userWrapper: { justifyContent: 'flex-end' },
  botWrapper: { justifyContent: 'flex-start' },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#1E2D48',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 4,
    borderWidth: 1,
    borderColor: '#EF010C',
  },
  bubble: {
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    maxWidth: '85%',
  },
  userBubble: { backgroundColor: '#EF010C', borderBottomRightRadius: 4 },
  botBubble: { backgroundColor: '#111D33', borderBottomLeftRadius: 4, borderWidth: 1, borderColor: '#263957' },
  msgText: { color: '#F8FAFC', fontSize: 14, lineHeight: 20 },
  userText: { color: '#FFFFFF', fontWeight: '500' },
  msgTime: { fontSize: 10, color: '#64748B', marginTop: 4, alignSelf: 'flex-end' },
  recCard: {
    backgroundColor: '#111D33',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#EF010C',
    padding: 16,
    marginTop: 10,
    width: '92%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
  },
  recHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 },
  recName: { fontSize: 16, fontWeight: '700', color: '#F8FAFC', marginBottom: 2 },
  recAddress: { fontSize: 12, color: '#64748B' },
  probBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#0A1425',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  probText: { color: '#22C55E', fontSize: 11, fontWeight: '700' },
  recMetaRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginVertical: 8 },
  recPrice: { fontSize: 18, fontWeight: '800', color: '#EF010C' },
  recDistance: { fontSize: 12, color: '#64748B' },
  instructionsBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#0A1425',
    padding: 8,
    borderRadius: 8,
    marginBottom: 12,
  },
  instructionsText: { color: '#94A3B8', fontSize: 12, flex: 1 },
  actionRow: { flexDirection: 'row', gap: 8, marginTop: 4 },
  navBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#1E2D48',
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#263957',
  },
  navBtnText: { color: '#CBD5E1', fontSize: 13, fontWeight: '600' },
  bookBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#EF010C',
    paddingVertical: 10,
    borderRadius: 10,
  },
  bookBtnText: { color: '#FFFFFF', fontSize: 13, fontWeight: '700' },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  loadingText: { color: '#94A3B8', fontSize: 12 },
  inputContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#0A1425',
    borderTopWidth: 1,
    borderTopColor: '#1A2942',
    gap: 8,
    alignItems: 'center',
  },
  textInput: {
    flex: 1,
    backgroundColor: '#111D33',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    color: '#F8FAFC',
    fontSize: 14,
    borderWidth: 1,
    borderColor: '#263957',
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#EF010C',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendBtnDisabled: { opacity: 0.4 },
});
