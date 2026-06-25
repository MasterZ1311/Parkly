import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useAuthStore } from '../../src/store/auth.store';

export default function OtpScreen() {
  const { phone } = useLocalSearchParams<{ phone: string }>();
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [name, setName] = useState('');
  const [showName, setShowName] = useState(false);
  const inputs = useRef<TextInput[]>([]);
  const { verifyOtp, requestOtp, isLoading, error, clearError } = useAuthStore();

  const handleOtpChange = (value: string, index: number) => {
    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);
    if (value && index < 5) {
      inputs.current[index + 1]?.focus();
    }
  };

  const handleVerify = async () => {
    const otpString = otp.join('');
    if (otpString.length !== 6) {
      Alert.alert('Invalid OTP', 'Please enter the 6-digit OTP.');
      return;
    }
    clearError();
    try {
      await verifyOtp(phone!, otpString, name || undefined);
      router.replace('/(tabs)/home');
    } catch {
      // Error displayed via store
    }
  };

  const handleResend = async () => {
    setOtp(['', '', '', '', '', '']);
    await requestOtp(phone!);
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <View style={styles.header}>
        <Text style={styles.title}>Verify OTP</Text>
        <Text style={styles.subtitle}>
          Enter the 6-digit code sent to{'\n'}
          <Text style={styles.phone}>{phone}</Text>
        </Text>
      </View>

      {/* OTP Inputs */}
      <View style={styles.otpRow}>
        {otp.map((digit, i) => (
          <TextInput
            key={i}
            ref={(ref) => { if (ref) inputs.current[i] = ref; }}
            style={[styles.otpInput, digit ? styles.otpInputFilled : {}]}
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

      {error && <Text style={styles.errorText}>{error}</Text>}

      {/* Name input for new users */}
      <View style={styles.nameSection}>
        <Text style={styles.nameLabel}>Your Name (for new accounts)</Text>
        <TextInput
          style={styles.nameInput}
          placeholder="Enter your name"
          placeholderTextColor="#64748B"
          value={name}
          onChangeText={setName}
          autoCapitalize="words"
        />
      </View>

      <TouchableOpacity
        style={[styles.button, isLoading && styles.buttonDisabled]}
        onPress={handleVerify}
        disabled={isLoading}
      >
        {isLoading ? <ActivityIndicator color="#0F172A" /> : <Text style={styles.buttonText}>Verify & Continue</Text>}
      </TouchableOpacity>

      <TouchableOpacity onPress={handleResend} style={styles.resendButton}>
        <Text style={styles.resendText}>Resend OTP</Text>
      </TouchableOpacity>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A',
    paddingHorizontal: 24,
    paddingTop: 60,
  },
  header: { marginBottom: 40 },
  title: { fontSize: 28, fontWeight: '800', color: '#F8FAFC', marginBottom: 8 },
  subtitle: { fontSize: 15, color: '#94A3B8', lineHeight: 22 },
  phone: { color: '#38BDF8', fontWeight: '600' },
  otpRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 24 },
  otpInput: {
    width: 48,
    height: 56,
    borderRadius: 12,
    backgroundColor: '#1E293B',
    borderWidth: 1,
    borderColor: '#334155',
    color: '#F8FAFC',
    fontSize: 24,
    fontWeight: '700',
    textAlign: 'center',
  },
  otpInputFilled: { borderColor: '#38BDF8' },
  errorText: { color: '#F87171', fontSize: 13, marginBottom: 16, textAlign: 'center' },
  nameSection: { marginBottom: 24 },
  nameLabel: { color: '#CBD5E1', fontSize: 13, marginBottom: 8 },
  nameInput: {
    backgroundColor: '#1E293B',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: '#F8FAFC',
    fontSize: 15,
    borderWidth: 1,
    borderColor: '#334155',
  },
  button: {
    backgroundColor: '#38BDF8',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 16,
  },
  buttonDisabled: { opacity: 0.7 },
  buttonText: { color: '#0F172A', fontSize: 16, fontWeight: '700' },
  resendButton: { alignItems: 'center', paddingVertical: 8 },
  resendText: { color: '#38BDF8', fontSize: 14 },
});
