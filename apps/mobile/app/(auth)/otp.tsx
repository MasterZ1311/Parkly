import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuthStore } from '../../src/store/auth.store';
import { colors, theme } from '../../src/constants/theme';
import { ENTER_FADE_UP, PressScale, triggerHaptic } from '../../src/components/Motion';
import { classifyApiError, type ClassifiedApiError } from '../../src/utils/apiErrors';

export default function OtpScreen() {
  const { phone, devOtp } = useLocalSearchParams<{ phone: string; devOtp?: string }>();
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [name, setName] = useState('');
  const [lastFailure, setLastFailure] = useState<ClassifiedApiError | null>(null);
  const inputs = useRef<TextInput[]>([]);
  const { verifyOtp, requestOtp, isLoading, error, clearError, isDemoMode } = useAuthStore();
  const insets = useSafeAreaInsets();

  React.useEffect(() => {
    if (devOtp && devOtp.length === 6) {
      setOtp(devOtp.split(''));
    }
  }, [devOtp]);

  const handleOtpChange = (value: string, index: number) => {
    const clean = value.replace(/\D/g, '');
    const newOtp = [...otp];
    newOtp[index] = clean;
    setOtp(newOtp);
    if (error) clearError();
    if (lastFailure) setLastFailure(null);
    if (clean && index < 5) {
      inputs.current[index + 1]?.focus();
    }
  };

  const handleVerify = async () => {
    const otpString = otp.join('');
    if (otpString.length !== 6) {
      Alert.alert('Invalid OTP', 'Please enter the 6-digit OTP.');
      return;
    }
    if (!phone) {
      router.replace('/(auth)/login');
      return;
    }
    clearError();
    setLastFailure(null);

    try {
      await verifyOtp(phone, otpString, name || undefined);
      triggerHaptic('success');
      router.replace('/(tabs)/home');
    } catch (err) {
      const classified = classifyApiError(err, 'OTP verification failed');
      setLastFailure(classified);
      if (classified.kind === 'restricted' || classified.kind === 'maintenance' || classified.kind === 'server-error') {
        router.push(classified.statusRoute!);
      }
    }
  };

  const handleResend = async () => {
    if (!phone) return;
    setOtp(['', '', '', '', '', '']);
    clearError();
    setLastFailure(null);
    try {
      const newOtp = await requestOtp(phone);
      if (newOtp && newOtp.length === 6) {
        setOtp(newOtp.split(''));
      }
    } catch (err) {
      setLastFailure(classifyApiError(err, 'Failed to resend OTP'));
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={[styles.container, { paddingTop: Math.max(insets.top + 16, 40) }]}
    >
      <StatusBar style="dark" backgroundColor={colors.background} />

      <PressScale
        onPress={() => router.back()}
        style={styles.backButton}
        contentStyle={styles.backButtonContent}
        accessibilityLabel="Go back"
      >
        <Ionicons name="arrow-back" size={20} color={colors.navy} />
      </PressScale>

      <Animated.View entering={ENTER_FADE_UP} style={styles.header}>
        <Text style={styles.title}>Verify Mobile</Text>
        <Text style={styles.subtitle}>
          Enter the 6-digit verification code sent to{'\n'}
          <Text style={styles.phone}>{phone}</Text>
        </Text>
      </Animated.View>

      <View style={styles.otpRow}>
        {otp.map((digit, i) => (
          <TextInput
            key={i}
            ref={(ref) => {
              if (ref) inputs.current[i] = ref;
            }}
            accessibilityLabel={`OTP digit ${i + 1}`}
            style={[styles.otpInput, digit ? styles.otpInputFilled : undefined]}
            value={digit}
            onChangeText={(v) => handleOtpChange(v.slice(-1), i)}
            keyboardType="number-pad"
            maxLength={1}
            onKeyPress={({ nativeEvent }) => {
              if (nativeEvent.key === 'Backspace' && !digit && i > 0) {
                inputs.current[i - 1]?.focus();
              }
            }}
          />
        ))}
      </View>

      {error && (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>{error}</Text>
          {lastFailure?.statusRoute && (
            <Text style={styles.statusLink} onPress={() => router.push(lastFailure.statusRoute!)}>
              Check Service Status →
            </Text>
          )}
        </View>
      )}

      {isDemoMode ? (
        <View style={styles.devHint}>
          <Ionicons name="sparkles-outline" size={16} color={colors.primary} />
          <Text style={styles.devHintText}>Demo Mode active · Enter code 123456</Text>
        </View>
      ) : devOtp ? (
        <View style={styles.devHint}>
          <Ionicons name="key-outline" size={16} color={colors.primary} />
          <Text style={styles.devHintText}>Dev mode: OTP {devOtp} prefilled</Text>
        </View>
      ) : null}

      <View style={styles.card}>
        <Text style={styles.nameLabel}>Your Name (new accounts)</Text>
        <TextInput
          style={styles.nameInput}
          placeholder="Enter your full name"
          placeholderTextColor={colors.textMuted}
          value={name}
          onChangeText={setName}
          autoCapitalize="words"
        />

        <PressScale
          onPress={handleVerify}
          disabled={isLoading}
          rippleColor={colors.rippleLight}
          haptic="medium"
          style={[styles.button, isLoading && styles.buttonDisabled]}
          contentStyle={styles.buttonContent}
        >
          {isLoading ? (
            <ActivityIndicator color={colors.white} />
          ) : (
            <Text style={styles.buttonText}>Verify &amp; Continue</Text>
          )}
        </PressScale>

        <PressScale
          onPress={handleResend}
          haptic="selection"
          style={styles.resendButton}
          contentStyle={styles.resendContent}
        >
          <Text style={styles.resendText}>Resend OTP</Text>
        </PressScale>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    paddingHorizontal: 20,
  },
  backButton: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
    marginBottom: 20,
  },
  backButtonContent: {
    width: 48,
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: { marginBottom: 24 },
  title: { fontSize: 28, fontWeight: '800', color: colors.navy, marginBottom: 8, letterSpacing: -0.5 },
  subtitle: { fontSize: 14.5, color: colors.textMuted, lineHeight: 22 },
  phone: { color: colors.primary, fontWeight: '800', fontVariant: ['tabular-nums'] },
  otpRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20, gap: 6 },
  otpInput: {
    flex: 1,
    height: 54,
    borderRadius: 10,
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.borderStrong,
    color: colors.navy,
    fontSize: 22,
    fontWeight: '800',
    textAlign: 'center',
    fontVariant: ['tabular-nums'],
  },
  otpInputFilled: { borderColor: colors.primary, backgroundColor: colors.primaryLight },
  errorBanner: {
    backgroundColor: colors.dangerLight,
    borderWidth: 1,
    borderColor: colors.dangerBorder,
    borderRadius: 10,
    padding: 12,
    marginBottom: 14,
    alignItems: 'center',
    gap: 4,
  },
  errorText: { color: colors.danger, fontSize: 13, fontWeight: '700', textAlign: 'center' },
  statusLink: { color: colors.navy, fontSize: 12.5, fontWeight: '800' },
  devHint: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.primaryLight,
    borderWidth: 1,
    borderColor: colors.primaryBorder,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 18,
  },
  devHintText: { color: colors.primary, fontSize: 13, fontWeight: '700', fontVariant: ['tabular-nums'] },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 18,
    ...theme.elevation.card,
  },
  nameLabel: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 8,
  },
  nameInput: {
    backgroundColor: colors.surface,
    borderRadius: 10,
    paddingHorizontal: 14,
    minHeight: 48,
    color: colors.navy,
    fontSize: 15,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    marginBottom: 16,
  },
  button: {
    backgroundColor: colors.primary,
    borderRadius: 10,
    overflow: 'hidden',
    marginBottom: 8,
  },
  buttonContent: { minHeight: 50, alignItems: 'center', justifyContent: 'center' },
  buttonDisabled: { opacity: 0.65 },
  buttonText: { color: colors.white, fontSize: 16, fontWeight: '800' },
  resendButton: { borderRadius: 8, overflow: 'hidden' },
  resendContent: { minHeight: 48, alignItems: 'center', justifyContent: 'center' },
  resendText: { color: colors.navy, fontSize: 14, fontWeight: '700' },
});
