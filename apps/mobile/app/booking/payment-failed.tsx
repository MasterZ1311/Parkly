import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, theme } from '../../src/constants/theme';
import { ENTER_FADE_UP, PressScale } from '../../src/components/Motion';

export default function PaymentFailedScreen() {
  const {
    spaceId,
    spaceName,
    hostId,
    hours,
    totalAmount,
    hourlyRate,
    amount,
    reason,
  } = useLocalSearchParams<{
    spaceId?: string;
    spaceName?: string;
    hostId?: string;
    hours?: string;
    totalAmount?: string;
    hourlyRate?: string;
    amount?: string;
    reason?: string;
  }>();

  const insets = useSafeAreaInsets();
  const parsedAmount = Number(amount || totalAmount || 0);
  const displayAmount = Number.isFinite(parsedAmount) && parsedAmount > 0 ? Math.round(parsedAmount) : 84;

  const handleRetryPayment = () => {
    if (spaceId && Number(totalAmount) > 0) {
      router.replace({
        pathname: '/booking/create',
        params: {
          spaceId,
          spaceName: spaceName || 'Chennai Parking Complex',
          hostId: hostId || 'host-chennai-001',
          hours: hours || '2',
          totalAmount: String(totalAmount),
          hourlyRate: hourlyRate || '40',
        },
      });
    } else {
      router.replace('/(tabs)/bookings');
    }
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[
        styles.content,
        {
          paddingTop: Math.max(insets.top + 16, 36),
          paddingBottom: Math.max(insets.bottom + 24, 36),
        },
      ]}
    >
      <StatusBar style="dark" backgroundColor={colors.background} />

      <PressScale
        onPress={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)/home'))}
        style={styles.backBtn}
        contentStyle={styles.backBtnContent}
        accessibilityLabel="Go back"
      >
        <Ionicons name="arrow-back" size={20} color={colors.navy} />
      </PressScale>

      <Animated.View entering={ENTER_FADE_UP} style={styles.card}>
        <View style={styles.iconCircle}>
          <Ionicons name="card-outline" size={34} color={colors.danger} />
        </View>

        <Text style={styles.meta}>UPI OR GATEWAY INTERRUPTION</Text>
        <Text style={styles.title}>Payment Could Not Be Captured</Text>
        <Text style={styles.amount}>₹{displayAmount}</Text>
        <Text style={styles.subtitle}>
          {reason || 'Your UPI app or card issuer timed out before Razorpay confirmation completed.'}
        </Text>

        <View style={styles.assuranceBox}>
          <Ionicons name="shield-checkmark-outline" size={18} color={colors.info} />
          <Text style={styles.assuranceText}>
            No duplicate charge was applied. If funds were debited by your bank, automatic reversal clears within 24 to 48 hours.
          </Text>
        </View>

        <View style={styles.actions}>
          <PressScale
            style={styles.primaryBtn}
            contentStyle={styles.btnInner}
            rippleColor={colors.rippleLight}
            haptic="medium"
            onPress={handleRetryPayment}
          >
            <Ionicons name="refresh" size={18} color={colors.white} />
            <Text style={styles.primaryBtnText}>Retry UPI / Card Payment</Text>
          </PressScale>

          <PressScale
            style={styles.outlineBtn}
            contentStyle={styles.btnInner}
            haptic="light"
            onPress={() => router.replace('/(tabs)/bookings')}
          >
            <Ionicons name="calendar-outline" size={18} color={colors.navy} />
            <Text style={styles.outlineBtnText}>Check Booking Status</Text>
          </PressScale>

          <PressScale
            style={styles.outlineBtn}
            contentStyle={styles.btnInner}
            haptic="light"
            onPress={() => router.replace('/(tabs)/home')}
          >
            <Ionicons name="search-outline" size={18} color={colors.navy} />
            <Text style={styles.outlineBtnText}>Choose Another Parking Bay</Text>
          </PressScale>
        </View>
      </Animated.View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { flexGrow: 1, paddingHorizontal: 18 },
  backBtn: {
    alignSelf: 'flex-start',
    borderRadius: 12,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 16,
    overflow: 'hidden',
  },
  backBtnContent: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 24,
    alignItems: 'center',
    ...theme.elevation.card,
  },
  iconCircle: {
    width: 68,
    height: 68,
    borderRadius: 16,
    backgroundColor: colors.dangerLight,
    borderWidth: 1,
    borderColor: colors.dangerBorder,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 14,
  },
  meta: { color: colors.danger, fontSize: 11, fontWeight: '800', letterSpacing: 1, marginBottom: 6 },
  title: { color: colors.navy, fontSize: 22, fontWeight: '800', textAlign: 'center', marginBottom: 6 },
  amount: {
    color: colors.navy,
    fontSize: 30,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
    marginBottom: 10,
  },
  subtitle: {
    color: colors.textSecondary,
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    marginBottom: 18,
  },
  assuranceBox: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: colors.infoLight,
    borderWidth: 1,
    borderColor: colors.infoBorder,
    borderRadius: 12,
    padding: 13,
    marginBottom: 22,
  },
  assuranceText: { flex: 1, color: colors.info, fontSize: 12.5, lineHeight: 18, fontWeight: '600' },
  actions: { width: '100%', gap: 10 },
  primaryBtn: { backgroundColor: colors.primary, borderRadius: 12, overflow: 'hidden' },
  outlineBtn: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    overflow: 'hidden',
  },
  btnInner: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 16,
  },
  primaryBtnText: { color: colors.white, fontSize: 15, fontWeight: '800' },
  outlineBtnText: { color: colors.navy, fontSize: 14.5, fontWeight: '700' },
});
