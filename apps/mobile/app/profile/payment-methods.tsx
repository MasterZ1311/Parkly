import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  Alert,
  Modal,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useDriverStore, type UpiMethod } from '../../src/store/driver.store';
import { colors, theme } from '../../src/constants/theme';
import { ENTER_FADE_UP, PressScale, triggerHaptic } from '../../src/components/Motion';

const UPI_VPA_REGEX = /^[a-zA-Z0-9._-]{2,}@[a-zA-Z]{2,}$/;
const UPI_APPS = ['Google Pay', 'PhonePe', 'BHIM UPI', 'Paytm'] as const;

export default function PaymentMethodsScreen() {
  const {
    upiMethods,
    loadUpiMethods,
    addUpiMethod,
    setDefaultUpiMethod,
    removeUpiMethod,
  } = useDriverStore();

  const [modalVisible, setModalVisible] = useState(false);
  const [vpa, setVpa] = useState('');
  const [label, setLabel] = useState('');
  const [appName, setAppName] = useState<string>('Google Pay');
  const insets = useSafeAreaInsets();

  useFocusEffect(
    useCallback(() => {
      loadUpiMethods().catch(() => {});
    }, [loadUpiMethods]),
  );

  const handleAdd = async () => {
    const cleanVpa = vpa.trim().toLowerCase();
    if (!UPI_VPA_REGEX.test(cleanVpa)) {
      Alert.alert('Invalid UPI Handle', 'Enter a valid UPI ID such as name@oksbi or driver@ybl.');
      return;
    }

    await addUpiMethod({
      vpa: cleanVpa,
      label: label.trim() || `${appName} UPI`,
      appName,
      isDefault: upiMethods.length === 0,
    });
    triggerHaptic('success');
    setVpa('');
    setLabel('');
    setModalVisible(false);
  };

  const handleRemove = (method: UpiMethod) => {
    Alert.alert('Remove UPI Handle', `Remove ${method.vpa}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          await removeUpiMethod(method.id);
          triggerHaptic('medium');
        },
      },
    ]);
  };

  return (
    <View style={styles.container}>
      <StatusBar style="light" backgroundColor={colors.navy} />

      <View style={[styles.appBar, { paddingTop: Math.max(insets.top + 8, 16) }]}>
        <PressScale
          style={styles.iconButton}
          contentStyle={styles.iconButtonContent}
          rippleColor={colors.rippleLight}
          onPress={() => router.back()}
          accessibilityLabel="Go back"
        >
          <Ionicons name="arrow-back" size={20} color={colors.white} />
        </PressScale>
        <Text style={styles.appBarTitle}>UPI &amp; Payment Methods</Text>
        <PressScale
          style={styles.iconButton}
          contentStyle={styles.iconButtonContent}
          rippleColor={colors.rippleLight}
          onPress={() => setModalVisible(true)}
          accessibilityLabel="Add UPI method"
        >
          <Ionicons name="add" size={24} color={colors.white} />
        </PressScale>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: Math.max(insets.bottom + 24, 36) },
        ]}
      >
        <Animated.View entering={ENTER_FADE_UP} style={{ gap: 12 }}>
          <Text style={styles.lead}>
            Saved UPI handles pre-fill your Razorpay checkout sheet. Full gateway verification runs server-side during payment confirmation.
          </Text>

          {upiMethods.map((method) => (
            <View
              key={method.id}
              style={[styles.card, method.isDefault && styles.cardDefault]}
            >
              <View style={styles.cardRow}>
                <View style={styles.walletIcon}>
                  <Ionicons
                    name="wallet-outline"
                    size={22}
                    color={method.isDefault ? colors.primary : colors.navy}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <View style={styles.titleRow}>
                    <Text style={styles.cardLabel}>{method.label}</Text>
                    {method.isDefault && (
                      <View style={styles.defaultBadge}>
                        <Text style={styles.defaultText}>DEFAULT</Text>
                      </View>
                    )}
                  </View>
                  <Text style={styles.vpaText}>{method.vpa}</Text>
                  <Text style={styles.appText}>{method.appName}</Text>
                </View>
              </View>

              <View style={styles.actionsRow}>
                {!method.isDefault && (
                  <PressScale
                    style={styles.secondaryBtn}
                    contentStyle={styles.smallBtnInner}
                    onPress={async () => {
                      await setDefaultUpiMethod(method.id);
                      triggerHaptic('success');
                    }}
                  >
                    <Text style={styles.secondaryBtnText}>Set Default</Text>
                  </PressScale>
                )}
                <PressScale
                  style={styles.removeBtn}
                  contentStyle={styles.smallBtnInner}
                  onPress={() => handleRemove(method)}
                >
                  <Text style={styles.removeBtnText}>Remove</Text>
                </PressScale>
              </View>
            </View>
          ))}

          <PressScale
            style={styles.primaryBtn}
            contentStyle={styles.btnInner}
            rippleColor={colors.rippleLight}
            onPress={() => setModalVisible(true)}
          >
            <Ionicons name="add-circle-outline" size={18} color={colors.white} />
            <Text style={styles.primaryBtnText}>Add UPI Handle</Text>
          </PressScale>
        </Animated.View>
      </ScrollView>

      <Modal
        visible={modalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalBackdrop}
        >
          <View style={[styles.modalSheet, { paddingBottom: Math.max(insets.bottom + 20, 28) }]}>
            <Text style={styles.modalTitle}>Add UPI ID</Text>

            <Text style={styles.inputLabel}>UPI Provider App</Text>
            <View style={styles.appRow}>
              {UPI_APPS.map((app) => {
                const active = appName === app;
                return (
                  <PressScale
                    key={app}
                    style={[styles.appChip, active && styles.appChipActive]}
                    contentStyle={styles.appChipContent}
                    onPress={() => setAppName(app)}
                  >
                    <Text style={[styles.appChipText, active && styles.appChipTextActive]}>
                      {app}
                    </Text>
                  </PressScale>
                );
              })}
            </View>

            <Text style={styles.inputLabel}>UPI VPA *</Text>
            <TextInput
              style={styles.input}
              value={vpa}
              onChangeText={setVpa}
              placeholder="name@oksbi"
              placeholderTextColor={colors.textMuted}
              autoCapitalize="none"
            />

            <Text style={styles.inputLabel}>Nickname (optional)</Text>
            <TextInput
              style={styles.input}
              value={label}
              onChangeText={setLabel}
              placeholder="Primary GPay"
              placeholderTextColor={colors.textMuted}
            />

            <PressScale
              style={[styles.primaryBtn, { marginTop: 8 }]}
              contentStyle={styles.btnInner}
              rippleColor={colors.rippleLight}
              onPress={handleAdd}
            >
              <Text style={styles.primaryBtnText}>Save UPI Handle</Text>
            </PressScale>

            <PressScale
              style={styles.cancelBtn}
              contentStyle={styles.btnInner}
              onPress={() => setModalVisible(false)}
            >
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </PressScale>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  appBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingBottom: 12,
    backgroundColor: colors.navy,
  },
  iconButton: { width: 48, height: 48, borderRadius: 12, overflow: 'hidden' },
  iconButtonContent: { width: 48, height: 48, justifyContent: 'center', alignItems: 'center' },
  appBarTitle: { color: colors.white, fontSize: 17.5, fontWeight: '800' },
  scrollContent: { padding: 16 },
  lead: { color: colors.textSecondary, fontSize: 13, lineHeight: 19, marginBottom: 4 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    gap: 12,
    ...theme.elevation.card,
  },
  cardDefault: { borderColor: colors.navy, borderWidth: 1.5 },
  cardRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  walletIcon: {
    width: 44,
    height: 44,
    borderRadius: 11,
    backgroundColor: colors.cardElevated,
    borderWidth: 1,
    borderColor: colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 2 },
  cardLabel: { color: colors.navy, fontSize: 15, fontWeight: '800' },
  defaultBadge: {
    backgroundColor: colors.successLight,
    borderColor: colors.successBorder,
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  defaultText: { color: colors.success, fontSize: 10, fontWeight: '800' },
  vpaText: { color: colors.navy, fontSize: 13.5, fontWeight: '700', fontVariant: ['tabular-nums'] },
  appText: { color: colors.textMuted, fontSize: 12, fontWeight: '600', marginTop: 1 },
  actionsRow: { flexDirection: 'row', gap: 8, borderTopWidth: 1, borderTopColor: colors.cardElevated, paddingTop: 10 },
  smallBtnInner: { minHeight: 40, paddingHorizontal: 14, justifyContent: 'center', alignItems: 'center' },
  secondaryBtn: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    overflow: 'hidden',
  },
  secondaryBtnText: { color: colors.navy, fontSize: 13.5, fontWeight: '700' },
  removeBtn: {
    backgroundColor: colors.dangerLight,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.dangerBorder,
    overflow: 'hidden',
  },
  removeBtnText: { color: colors.danger, fontSize: 13.5, fontWeight: '700' },
  primaryBtn: { backgroundColor: colors.primary, borderRadius: 12, overflow: 'hidden', marginTop: 6 },
  btnInner: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 18,
  },
  primaryBtnText: { color: colors.white, fontSize: 15, fontWeight: '800' },
  cancelBtn: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    overflow: 'hidden',
  },
  cancelBtnText: { color: colors.navy, fontSize: 14.5, fontWeight: '700' },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(11,22,40,0.56)', justifyContent: 'flex-end' },
  modalSheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    gap: 8,
    ...theme.elevation.sheet,
  },
  modalTitle: { fontSize: 19, fontWeight: '800', color: colors.navy, marginBottom: 4 },
  inputLabel: { fontSize: 12, fontWeight: '700', color: colors.textSecondary },
  appRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 4 },
  appChip: {
    backgroundColor: colors.background,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    overflow: 'hidden',
  },
  appChipActive: { backgroundColor: colors.navy, borderColor: colors.navy },
  appChipContent: { paddingHorizontal: 12, minHeight: 38, justifyContent: 'center' },
  appChipText: { fontSize: 12.5, fontWeight: '700', color: colors.navy },
  appChipTextActive: { color: colors.white },
  input: {
    backgroundColor: colors.background,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    paddingHorizontal: 12,
    minHeight: 46,
    color: colors.navy,
    fontSize: 14.5,
    fontWeight: '700',
    marginBottom: 4,
  },
});
