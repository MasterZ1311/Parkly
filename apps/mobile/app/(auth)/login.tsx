import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
  Switch,
  ScrollView,
} from 'react-native';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuthStore } from '../../src/store/auth.store';
import { colors, theme } from '../../src/constants/theme';
import { ENTER_FADE_UP, PressScale, triggerHaptic } from '../../src/components/Motion';
import { ParklyBrandBadge } from '../../src/components/ParklyBrandBadge';
import { classifyApiError, type ClassifiedApiError } from '../../src/utils/apiErrors';

export default function LoginScreen() {
  const [phone, setPhone] = useState('');
  const [lastFailure, setLastFailure] = useState<ClassifiedApiError | null>(null);
  const { requestOtp, isLoading, error, clearError, isDemoMode, setDemoMode, enterDemoMode } =
    useAuthStore();
  const insets = useSafeAreaInsets();

  const handleSendOtp = async () => {
    const cleaned = phone.replace(/\D/g, '');
    if (cleaned.length !== 10) {
      Alert.alert('Invalid Phone', 'Please enter a valid 10-digit Indian mobile number.');
      return;
    }
    clearError();
    setLastFailure(null);
    const formattedPhone = `+91${cleaned}`;

    try {
      const devOtp = await requestOtp(formattedPhone);
      router.push({
        pathname: '/(auth)/otp',
        params: { phone: formattedPhone, ...(devOtp ? { devOtp } : {}) },
      });
    } catch (err) {
      const classified = classifyApiError(err, 'Unable to send OTP right now.');
      setLastFailure(classified);
    }
  };

  const handleToggleDemo = async (next: boolean) => {
    triggerHaptic('selection');
    setLastFailure(null);
    clearError();
    await setDemoMode(next);
  };

  const handleEnterDemoDirectly = async () => {
    triggerHaptic('medium');
    const cleaned = phone.replace(/\D/g, '');
    const formatted = cleaned.length === 10 ? `+91${cleaned}` : undefined;
    await enterDemoMode(formatted);
    router.replace('/(tabs)/home');
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.flex}
    >
      <StatusBar style="dark" backgroundColor={colors.background} />
      <ScrollView
        contentContainerStyle={[
          styles.container,
          {
            paddingTop: Math.max(insets.top + 16, 28),
            paddingBottom: Math.max(insets.bottom + 20, 28),
          },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Animated.View entering={ENTER_FADE_UP} style={styles.logoContainer}>
          <ParklyBrandBadge size="lg" />
          <Text style={styles.appName}>Parkly</Text>
          <Text style={styles.tagline}>Chennai Smart Parking Network</Text>
        </Animated.View>

        <View style={styles.card}>
          <Text style={styles.label}>Mobile Number</Text>
          <View style={styles.phoneRow}>
            <View style={styles.countryCode}>
              <Text style={styles.countryCodeCode}>IN</Text>
              <Text style={styles.countryCodeText}>+91</Text>
            </View>
            <TextInput
              style={styles.input}
              placeholder="Enter 10-digit mobile number"
              placeholderTextColor={colors.textMuted}
              keyboardType="phone-pad"
              maxLength={10}
              value={phone}
              onChangeText={(v) => {
                setPhone(v.replace(/\D/g, ''));
                if (error) clearError();
                if (lastFailure) setLastFailure(null);
              }}
            />
          </View>

          {error && (
            <View style={styles.errorBanner}>
              <Ionicons name="alert-circle-outline" size={18} color={colors.danger} />
              <View style={{ flex: 1 }}>
                <Text style={styles.errorText}>{error}</Text>
                {lastFailure?.statusRoute && (
                  <Text
                    style={styles.statusLink}
                    onPress={() => router.push(lastFailure.statusRoute!)}
                  >
                    Open Service Status &amp; Diagnostics →
                  </Text>
                )}
              </View>
            </View>
          )}

          <PressScale
            onPress={handleSendOtp}
            disabled={isLoading}
            rippleColor={colors.rippleLight}
            haptic="medium"
            style={[styles.button, isLoading && styles.buttonDisabled]}
            contentStyle={styles.buttonContent}
          >
            {isLoading ? (
              <ActivityIndicator color={colors.white} />
            ) : (
              <Text style={styles.buttonText}>
                {isDemoMode ? 'Send Demo OTP (123456)' : 'Get OTP'}
              </Text>
            )}
          </PressScale>

          <Text style={styles.terms}>
            By continuing, you agree to Parkly&apos;s{' '}
            <Text style={styles.link} accessibilityRole="link" onPress={() => router.push('/legal')}>
              Terms of Service
            </Text>{' '}
            and{' '}
            <Text style={styles.link} accessibilityRole="link" onPress={() => router.push('/legal')}>
              Privacy Policy
            </Text>
            .
          </Text>
        </View>

        {/* Explicit Opt-In Demo Mode Card */}
        <View style={styles.demoCard}>
          <View style={styles.demoHeader}>
            <View style={{ flex: 1 }}>
              <Text style={styles.demoTitle}>Demo Mode (Offline Preview)</Text>
              <Text style={styles.demoSub}>
                Explore Chennai bays, interactive MapLibre map, UPI checkout, and offline QR passes without a live server.
              </Text>
            </View>
            <Switch
              value={isDemoMode}
              onValueChange={handleToggleDemo}
              trackColor={{ false: colors.borderStrong, true: colors.navy }}
              thumbColor={isDemoMode ? colors.white : colors.surface}
              accessibilityLabel="Toggle Demo Mode"
            />
          </View>

          {isDemoMode && (
            <PressScale
              onPress={handleEnterDemoDirectly}
              style={styles.demoEnterBtn}
              contentStyle={styles.demoEnterContent}
              rippleColor={colors.rippleLight}
              haptic="medium"
            >
              <Ionicons name="sparkles-outline" size={17} color={colors.white} />
              <Text style={styles.demoEnterText}>Enter Demo Mode as Arjun</Text>
            </PressScale>
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
  container: {
    flexGrow: 1,
    backgroundColor: colors.background,
    justifyContent: 'center',
    paddingHorizontal: 20,
    gap: 16,
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 12,
  },
  appName: {
    fontSize: 30,
    fontWeight: '800',
    color: colors.navy,
    letterSpacing: -0.6,
    marginTop: 14,
  },
  tagline: {
    fontSize: 13.5,
    color: colors.textMuted,
    fontWeight: '600',
    marginTop: 4,
  },
  card: {
    width: '100%',
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 20,
    ...theme.elevation.card,
  },
  label: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  phoneRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  countryCode: {
    backgroundColor: colors.cardElevated,
    borderRadius: 10,
    paddingHorizontal: 14,
    minHeight: 50,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: colors.borderStrong,
  },
  countryCodeCode: {
    color: colors.primary,
    fontSize: 11,
    fontWeight: '800',
  },
  countryCodeText: {
    color: colors.navy,
    fontSize: 15,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  input: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: 10,
    paddingHorizontal: 14,
    minHeight: 50,
    color: colors.navy,
    fontSize: 16,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
    borderWidth: 1,
    borderColor: colors.borderStrong,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: colors.dangerLight,
    borderWidth: 1,
    borderColor: colors.dangerBorder,
    borderRadius: 10,
    padding: 12,
    marginBottom: 14,
  },
  errorText: {
    color: colors.danger,
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 18,
  },
  statusLink: {
    color: colors.navy,
    fontSize: 12.5,
    fontWeight: '800',
    marginTop: 6,
  },
  button: {
    backgroundColor: colors.primary,
    borderRadius: 10,
    overflow: 'hidden',
    marginBottom: 14,
  },
  buttonContent: {
    minHeight: 50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonDisabled: {
    opacity: 0.65,
  },
  buttonText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '800',
  },
  terms: {
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'center',
  },
  link: {
    color: colors.navy,
    fontWeight: '700',
  },
  demoCard: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    gap: 12,
    ...theme.elevation.card,
  },
  demoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  demoTitle: {
    color: colors.navy,
    fontSize: 14,
    fontWeight: '800',
  },
  demoSub: {
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 17,
    marginTop: 2,
  },
  demoEnterBtn: {
    backgroundColor: colors.navy,
    borderRadius: 10,
    overflow: 'hidden',
  },
  demoEnterContent: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  demoEnterText: {
    color: colors.white,
    fontSize: 14.5,
    fontWeight: '800',
  },
});
