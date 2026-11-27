import React from 'react';
import { View, Text, StyleSheet, ScrollView, Alert, Linking } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../../src/store/auth.store';
import { colors, theme } from '../../src/constants/theme';
import { PressScale, triggerHaptic } from '../../src/components/Motion';

interface MenuItemProps {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  color?: string;
  bgTint?: string;
}

function MenuItem({
  icon,
  label,
  onPress,
  color = colors.navy,
  bgTint = colors.cardElevated,
}: MenuItemProps) {
  return (
    <PressScale
      style={styles.menuItemWrap}
      contentStyle={styles.menuItem}
      haptic="light"
      onPress={onPress}
    >
      <View style={[styles.menuIcon, { backgroundColor: bgTint }]}>
        <Ionicons name={icon} size={19} color={color} />
      </View>
      <Text style={styles.menuLabel}>{label}</Text>
      <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
    </PressScale>
  );
}

export default function ProfileScreen() {
  const { user, logout } = useAuthStore();

  const handleLogout = () => {
    Alert.alert('Logout', 'Are you sure you want to logout?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Logout',
        style: 'destructive',
        onPress: async () => {
          triggerHaptic('medium');
          await logout();
          router.replace('/(auth)/login');
        },
      },
    ]);
  };

  const openLink = async (url: string, label: string) => {
    try {
      const supported = await Linking.canOpenURL(url);
      if (supported) {
        await Linking.openURL(url);
      } else {
        Alert.alert(label, `Unable to open ${url} on this device.`);
      }
    } catch {
      Alert.alert(label, `Something went wrong opening ${label}.`);
    }
  };

  const comingSoon = (feature: string, description: string) => {
    Alert.alert(feature, `${description}\n\nThis is coming in an upcoming Parkly update.`, [
      { text: 'Got it' },
    ]);
  };

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {/* Harbor Navy Identity Banner */}
      <View style={styles.profileHeader}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{user?.name?.charAt(0)?.toUpperCase() || 'U'}</Text>
        </View>
        <Text style={styles.userName}>{user?.name || 'Parkly Driver'}</Text>
        <Text style={styles.userPhone}>{user?.phone || '+91 98765 43210'}</Text>
        <View style={styles.roleBadge}>
          <Text style={styles.roleText}>{user?.role?.toUpperCase() || 'DRIVER'}</Text>
        </View>
      </View>

      {/* Stats */}
      <View style={styles.statsRow}>
        {[
          { label: 'Bookings', value: '0' },
          { label: 'Saved', value: '₹0' },
          { label: 'Hours', value: '0h' },
        ].map((stat) => (
          <View key={stat.label} style={styles.statCard}>
            <Text style={styles.statValue}>{stat.value}</Text>
            <Text style={styles.statLabel}>{stat.label}</Text>
          </View>
        ))}
      </View>

      {/* Account Menu */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Account</Text>
        <View style={styles.menuCard}>
          <MenuItem
            icon="car-outline"
            label="My Vehicles"
            onPress={() => comingSoon('My Vehicles', 'Save your vehicles and number plates for faster booking.')}
          />
          <MenuItem
            icon="notifications-outline"
            label="Notifications"
            onPress={() => comingSoon('Notifications', 'Manage booking reminders and alert preferences.')}
          />
          <MenuItem
            icon="card-outline"
            label="Payment Methods"
            onPress={() => comingSoon('Payment Methods', 'Add and manage cards, UPI, and wallets.')}
          />
          <MenuItem
            icon="location-outline"
            label="Saved Places"
            onPress={() => comingSoon('Saved Places', 'Save home, work, and favourite spots for quick search.')}
          />
        </View>
      </View>

      {user?.role === 'host' && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Host</Text>
          <View style={styles.menuCard}>
            <MenuItem
              icon="business-outline"
              label="My Listings"
              color={colors.success}
              bgTint={colors.successLight}
              onPress={() =>
                comingSoon('My Listings', 'Manage your parking spaces from the Parkly Host Dashboard at host.parkly.app.')
              }
            />
            <MenuItem
              icon="cash-outline"
              label="Earnings"
              color={colors.success}
              bgTint={colors.successLight}
              onPress={() =>
                comingSoon('Earnings', 'Track revenue and payouts from the Parkly Host Dashboard at host.parkly.app.')
              }
            />
          </View>
        </View>
      )}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Support</Text>
        <View style={styles.menuCard}>
          <MenuItem
            icon="help-circle-outline"
            label="Help Center"
            color={colors.info}
            bgTint={colors.infoLight}
            onPress={() => router.push('/support')}
          />
          <MenuItem
            icon="chatbubble-outline"
            label="Contact Support"
            color={colors.info}
            bgTint={colors.infoLight}
            onPress={() => openLink('mailto:support@parkly.app?subject=Parkly%20Support%20Request', 'Contact Support')}
          />
          <MenuItem
            icon="document-text-outline"
            label="Terms & Privacy"
            color={colors.info}
            bgTint={colors.infoLight}
            onPress={() => router.push('/legal')}
          />
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Recovery &amp; Status Views</Text>
        <View style={styles.menuCard}>
          <MenuItem
            icon="card-outline"
            label="Payment Failed Notice"
            color={colors.danger}
            bgTint={colors.dangerLight}
            onPress={() => router.push({ pathname: '/booking/payment-failed', params: { amount: '126', spaceName: 'T Nagar Parking Complex' } })}
          />
          <MenuItem
            icon="hourglass-outline"
            label="Booking Hold Expired"
            color={colors.warning}
            bgTint={colors.warningLight}
            onPress={() => router.push({ pathname: '/booking/expired', params: { spaceName: 'Anna Nagar Multi-Level' } })}
          />
          <MenuItem
            icon="location-outline"
            label="GPS Permission Recovery"
            color={colors.info}
            bgTint={colors.infoLight}
            onPress={() => router.push('/status/location-denied')}
          />
          <MenuItem
            icon="cloud-offline-outline"
            label="Offline Mode Notice"
            color={colors.warning}
            bgTint={colors.warningLight}
            onPress={() => router.push('/status/offline')}
          />
          <MenuItem
            icon="construct-outline"
            label="Scheduled Maintenance Notice"
            color={colors.warning}
            bgTint={colors.warningLight}
            onPress={() => router.push('/status/maintenance')}
          />
          <MenuItem
            icon="server-outline"
            label="Gateway Error Notice"
            color={colors.danger}
            bgTint={colors.dangerLight}
            onPress={() => router.push('/status/server-error')}
          />
          <MenuItem
            icon="lock-closed-outline"
            label="Session Timed Out Notice"
            color={colors.danger}
            bgTint={colors.dangerLight}
            onPress={() => router.push('/status/session-expired')}
          />
          <MenuItem
            icon="alert-circle-outline"
            label="Account Review Notice"
            color={colors.danger}
            bgTint={colors.dangerLight}
            onPress={() => router.push('/status/restricted')}
          />
        </View>
      </View>

      <PressScale
        style={styles.logoutButton}
        contentStyle={styles.logoutContent}
        onPress={handleLogout}
      >
        <Ionicons name="log-out-outline" size={20} color={colors.danger} />
        <Text style={styles.logoutText}>Logout</Text>
      </PressScale>

      <Text style={styles.version}>Parkly v1.0.0 · ZEUS Technologies</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  profileHeader: {
    alignItems: 'center',
    paddingVertical: 28,
    paddingHorizontal: 24,
    backgroundColor: colors.navy,
  },
  avatar: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: colors.white,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  avatarText: { fontSize: 32, fontWeight: '800', color: colors.navy },
  userName: { fontSize: 22, fontWeight: '800', color: colors.white, marginBottom: 4 },
  userPhone: { fontSize: 13.5, color: '#9FB0C7', marginBottom: 10, fontVariant: ['tabular-nums'] },
  roleBadge: {
    backgroundColor: colors.navySurface,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: colors.navyBorder,
  },
  roleText: { color: colors.white, fontSize: 11, fontWeight: '800', letterSpacing: 1 },
  statsRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 16,
    gap: 10,
  },
  statCard: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    ...theme.elevation.card,
  },
  statValue: { fontSize: 20, fontWeight: '800', color: colors.navy, fontVariant: ['tabular-nums'] },
  statLabel: { fontSize: 11, color: colors.textMuted, fontWeight: '700', marginTop: 3, textTransform: 'uppercase' },
  section: { paddingHorizontal: 16, marginBottom: 16 },
  sectionTitle: {
    color: colors.textMuted,
    fontSize: 11.5,
    fontWeight: '800',
    letterSpacing: 0.9,
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  menuCard: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
    ...theme.elevation.card,
  },
  menuItemWrap: {
    borderBottomWidth: 1,
    borderBottomColor: colors.cardElevated,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    minHeight: 56,
  },
  menuIcon: {
    width: 36,
    height: 36,
    borderRadius: 9,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  menuLabel: { flex: 1, color: colors.navy, fontSize: 14.5, fontWeight: '600' },
  logoutButton: {
    margin: 16,
    backgroundColor: colors.dangerLight,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.dangerBorder,
    overflow: 'hidden',
  },
  logoutContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    minHeight: 50,
  },
  logoutText: { color: colors.danger, fontSize: 15, fontWeight: '800' },
  version: { textAlign: 'center', color: colors.textMuted, fontSize: 12, marginBottom: 32 },
});
