import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Alert,
  Linking,
  Modal,
  TextInput,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuthStore } from '../../src/store/auth.store';
import { useDriverStore } from '../../src/store/driver.store';
import { useHostStore } from '../../src/store/host.store';
import { useKycStore } from '../../src/store/kyc.store';
import { bookingApi } from '../../src/api/client';
import { cacheGet, CACHE_KEYS } from '../../src/utils/cache';
import { colors, theme } from '../../src/constants/theme';
import { PressScale, triggerHaptic } from '../../src/components/Motion';
import { OfflineBanner } from '../../src/components/OfflineBanner';
import { classifyApiError } from '../../src/utils/apiErrors';

interface MenuItemProps {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  subtitle?: string;
  color?: string;
  bgTint?: string;
  onPress: () => void;
}

function MenuItem({
  icon,
  label,
  subtitle,
  color = colors.navy,
  bgTint = colors.cardElevated,
  onPress,
}: MenuItemProps) {
  return (
    <PressScale onPress={onPress} haptic="selection" style={styles.menuItemWrap} contentStyle={styles.menuItem}>
      <View style={[styles.menuIcon, { backgroundColor: bgTint }]}>
        <Ionicons name={icon} size={20} color={color} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.menuLabel}>{label}</Text>
        {subtitle ? <Text style={styles.menuSub}>{subtitle}</Text> : null}
      </View>
      <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
    </PressScale>
  );
}

export default function ProfileScreen() {
  const { user, logout, updateProfile, isDemoMode, isOffline } = useAuthStore();
  const {
    vehicles,
    savedPlaces,
    upiMethods,
    unreadCount,
    loadVehicles,
    loadSavedPlaces,
    loadUpiMethods,
    loadNotifications,
  } = useDriverStore();
  const myHostSpaces = useHostStore((s) => s.mySpaces);
  const loadMySpaces = useHostStore((s) => s.loadMySpaces);
  const driverKyc = useKycStore((s) => s.driverKyc);
  const hostKyc = useKycStore((s) => s.hostKyc);
  const loadKycs = useKycStore((s) => s.loadKycs);

  const [bookingCount, setBookingCount] = useState(0);
  const [totalHours, setTotalHours] = useState(0);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editName, setEditName] = useState(user?.name || '');
  const [editEmail, setEditEmail] = useState(user?.email || '');
  const [savingProfile, setSavingProfile] = useState(false);

  const insets = useSafeAreaInsets();

  const refreshProfileStats = useCallback(async () => {
    loadVehicles().catch(() => {});
    loadSavedPlaces().catch(() => {});
    loadUpiMethods().catch(() => {});
    loadNotifications().catch(() => {});
    loadMySpaces().catch(() => {});
    loadKycs().catch(() => {});

    const computeFromList = (list: any[]) => {
      setBookingCount(list.length);
      const mins = list.reduce((acc, b) => {
        if (typeof b.durationMinutes === 'number' && b.durationMinutes > 0) {
          return acc + b.durationMinutes;
        }
        const diff =
          (new Date(b.endTime).getTime() - new Date(b.startTime).getTime()) / 60000;
        return acc + (Number.isFinite(diff) && diff > 0 ? diff : 60);
      }, 0);
      setTotalHours(Math.round(mins / 60));
    };

    try {
      const cached = await cacheGet<any[]>(CACHE_KEYS.RECENT_BOOKINGS);
      if (cached && cached.length > 0) {
        computeFromList(cached);
      }

      if (!isDemoMode) {
        const { data } = await bookingApi.list();
        const rawList = data?.data?.bookings || (Array.isArray(data?.data) ? data.data : []);
        computeFromList(rawList);
      }
    } catch {
      // Cached summary retained when offline
    }
  }, [isDemoMode, loadVehicles, loadSavedPlaces, loadUpiMethods, loadNotifications, loadMySpaces, loadKycs]);

  useFocusEffect(
    useCallback(() => {
      refreshProfileStats();
    }, [refreshProfileStats]),
  );

  const handleOpenEdit = () => {
    setEditName(user?.name || '');
    setEditEmail(user?.email || '');
    setEditModalVisible(true);
  };

  const handleSaveProfile = async () => {
    const trimmedName = editName.trim();
    if (trimmedName.length < 2) {
      Alert.alert('Invalid Name', 'Please enter your full name (at least 2 characters).');
      return;
    }

    const trimmedEmail = editEmail.trim();
    if (trimmedEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      Alert.alert('Invalid Email', 'Please enter a valid email address or leave blank.');
      return;
    }

    setSavingProfile(true);
    try {
      await updateProfile({
        name: trimmedName,
        email: trimmedEmail || null,
      });
      triggerHaptic('success');
      setEditModalVisible(false);
    } catch (err) {
      const classified = classifyApiError(err, 'Unable to update your profile.');
      Alert.alert('Update Failed', classified.message);
    } finally {
      setSavingProfile(false);
    }
  };

  const handleLogout = () => {
    Alert.alert(
      isDemoMode ? 'Exit Demo Mode' : 'Logout',
      isDemoMode
        ? 'Exit simulated demo session and return to mobile login?'
        : 'Are you sure you want to logout?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: isDemoMode ? 'Exit Demo' : 'Logout',
          style: 'destructive',
          onPress: async () => {
            triggerHaptic('medium');
            await logout();
            router.replace('/(auth)/login');
          },
        },
      ],
    );
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

  const hostInfoAlert = (feature: string, description: string) => {
    Alert.alert(feature, `${description}\n\nManage host listings & payouts via the Parkly Host Portal.`);
  };

  return (
    <View style={styles.container}>
      {isDemoMode ? (
        <View style={styles.demoStrip}>
          <Ionicons name="sparkles-outline" size={14} color={colors.navy} />
          <Text style={styles.demoStripText}>DEMO MODE ACTIVE · Changes stay local</Text>
        </View>
      ) : (
        <OfflineBanner
          visible={isOffline}
          message="Offline Mode — Profile updates require connectivity"
        />
      )}

      <ScrollView
        style={styles.container}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: Math.max(insets.bottom + 24, 32) }}
      >
        {/* Harbor Navy Identity Banner */}
        <View style={styles.profileHeader}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {user?.name?.charAt(0)?.toUpperCase() || 'D'}
            </Text>
          </View>
          <View style={styles.bannerTextWrap}>
            <Text style={styles.userName} textBreakStrategy="simple">
              {user?.name || 'Parkly Driver'}
            </Text>
            <Text
              style={styles.userPhone}
              textBreakStrategy="simple"
              android_hyphenationFrequency="none"
            >
              {user?.phone || '+91 98765 43210'}
            </Text>
            {user?.email ? (
              <Text
                style={styles.userEmail}
                textBreakStrategy="simple"
                android_hyphenationFrequency="none"
              >
                {user.email}
              </Text>
            ) : null}
          </View>

          <View style={styles.bannerBadgesRow}>
            <View style={styles.roleBadge}>
              <Text style={styles.roleText}>
                {(user?.role || 'driver').toUpperCase()} {isDemoMode ? '· DEMO' : ''}
              </Text>
            </View>

            <PressScale
              style={styles.editProfileBtn}
              contentStyle={styles.editProfileInner}
              rippleColor={colors.rippleLight}
              onPress={handleOpenEdit}
            >
              <Ionicons name="create-outline" size={14} color={colors.white} />
              <Text style={styles.editProfileText}>Edit Profile</Text>
            </PressScale>
          </View>
        </View>

        {/* Stats */}
        <View style={styles.statsRow}>
          {[
            { label: 'Bookings', value: String(bookingCount) },
            { label: 'Vehicles', value: String(vehicles.length) },
            { label: 'Hours', value: `${totalHours}h` },
          ].map((stat) => (
            <View key={stat.label} style={styles.statCard}>
              <Text style={styles.statValue}>{stat.value}</Text>
              <Text style={styles.statLabel}>{stat.label}</Text>
            </View>
          ))}
        </View>

        {/* Account Menu */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Driver Garage &amp; Preferences</Text>
          <View style={styles.menuCard}>
            <MenuItem
              icon="car-outline"
              label="My Vehicles"
              subtitle={
                vehicles.length > 0
                  ? `${vehicles.length} saved · Default ${vehicles.find((v) => v.isDefault)?.licensePlate || vehicles[0]?.licensePlate}`
                  : 'Add registration plates & vehicle class'
              }
              onPress={() => router.push('/profile/vehicles')}
            />
            <MenuItem
              icon="shield-checkmark-outline"
              label="Driver KYC &amp; Licence / RC"
              subtitle={
                driverKyc
                  ? `${driverKyc.status === 'approved' ? 'Verified' : driverKyc.status === 'rejected' ? 'Resubmission needed' : 'Pending Team Review'} · ${driverKyc.vehiclePlate} · RC ${driverKyc.rcNumber}`
                  : 'Upload Driving Licence, Vehicle Reg. & RC Book'
              }
              color={driverKyc?.status === 'approved' ? colors.success : colors.primary}
              bgTint={driverKyc?.status === 'approved' ? colors.successLight : colors.primaryLight}
              onPress={() => router.push('/profile/driver-kyc')}
            />
            <MenuItem
              icon="location-outline"
              label="Saved Places"
              subtitle={`${savedPlaces.length} quick-search Chennai spots`}
              onPress={() => router.push('/profile/saved-places')}
            />
            <MenuItem
              icon="notifications-outline"
              label="Notifications"
              subtitle={
                unreadCount > 0
                  ? `${unreadCount} unread alert${unreadCount === 1 ? '' : 's'} · Gate & reminders`
                  : 'Inbox clear · Gate alerts, reminders & push'
              }
              onPress={() => router.push('/profile/notifications')}
            />
            <MenuItem
              icon="card-outline"
              label="UPI &amp; Payment Methods"
              subtitle={
                upiMethods.find((m) => m.isDefault)?.vpa || 'Manage GPay / PhonePe UPI VPAs'
              }
              onPress={() => router.push('/profile/payment-methods')}
            />
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Host &amp; Rent Out Space</Text>
          <View style={styles.menuCard}>
            <MenuItem
              icon="home-outline"
              label="Rent Out Your House / Private Space"
              subtitle={
                myHostSpaces.length > 0
                  ? `${myHostSpaces.length} private space${myHostSpaces.length === 1 ? '' : 's'} submitted · View review status`
                  : 'List vacant driveways & upload parking plot photos'
              }
              color={colors.success}
              bgTint={colors.successLight}
              onPress={() => router.push('/host/spaces')}
            />
            <MenuItem
              icon="document-text-outline"
              label="Host KYC &amp; Property Proof"
              subtitle={
                hostKyc
                  ? `${hostKyc.verificationStatus === 'approved' ? 'Verified' : hostKyc.verificationStatus === 'rejected' ? 'Action needed' : 'Pending Team Review'} · ${hostKyc.plotPhotoUrls.length} plot photo(s)`
                  : 'Submit Owner ID, ownership proof & plot pictures'
              }
              color={colors.navy}
              bgTint={colors.cardElevated}
              onPress={() => router.push('/host/kyc')}
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
                  hostInfoAlert(
                    'My Listings',
                    'Create and monitor Chennai bays, dynamic pricing, and gate QR validation.',
                  )
                }
              />
              <MenuItem
                icon="cash-outline"
                label="Earnings"
                color={colors.success}
                bgTint={colors.successLight}
                onPress={() =>
                  hostInfoAlert('Earnings', 'Track net host revenue and request settled payouts.')
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
              onPress={() =>
                openLink(
                  'mailto:support@parkly.app?subject=Parkly%20Support%20Request',
                  'Contact Support',
                )
              }
            />
            <MenuItem
              icon="document-text-outline"
              label="Terms &amp; DPDPA Privacy"
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
              onPress={() =>
                router.push({
                  pathname: '/booking/payment-failed',
                  params: { amount: '126', spaceName: 'T Nagar Parking Complex' },
                })
              }
            />
            <MenuItem
              icon="hourglass-outline"
              label="Booking Hold Expired"
              color={colors.warning}
              bgTint={colors.warningLight}
              onPress={() =>
                router.push({
                  pathname: '/booking/expired',
                  params: { spaceName: 'Anna Nagar Multi-Level' },
                })
              }
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
          <Text style={styles.logoutText}>{isDemoMode ? 'Exit Demo Mode' : 'Logout'}</Text>
        </PressScale>

        <Text style={styles.version}>Parkly v1.0.0 · ZEUS Technologies</Text>
      </ScrollView>

      {/* Edit Profile Modal */}
      <Modal
        visible={editModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => !savingProfile && setEditModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalBackdrop}
        >
          <View style={[styles.modalSheet, { paddingBottom: Math.max(insets.bottom + 20, 28) }]}>
            <Text style={styles.modalTitle}>Update Driver Profile</Text>

            <Text style={styles.inputLabel}>Full Name</Text>
            <TextInput
              style={styles.modalInput}
              value={editName}
              onChangeText={setEditName}
              placeholder="Arjun Kumar"
              placeholderTextColor={colors.textMuted}
              autoCapitalize="words"
            />

            <Text style={styles.inputLabel}>Email Address (optional)</Text>
            <TextInput
              style={styles.modalInput}
              value={editEmail}
              onChangeText={setEditEmail}
              placeholder="driver@parkly.in"
              placeholderTextColor={colors.textMuted}
              autoCapitalize="none"
              keyboardType="email-address"
            />

            <PressScale
              style={[styles.saveModalBtn, savingProfile && { opacity: 0.65 }]}
              contentStyle={styles.saveModalInner}
              rippleColor={colors.rippleLight}
              onPress={handleSaveProfile}
              disabled={savingProfile}
            >
              {savingProfile ? (
                <ActivityIndicator color={colors.white} />
              ) : (
                <Text style={styles.saveModalText}>Save Changes</Text>
              )}
            </PressScale>

            <PressScale
              style={styles.cancelModalBtn}
              contentStyle={styles.saveModalInner}
              onPress={() => setEditModalVisible(false)}
              disabled={savingProfile}
            >
              <Text style={styles.cancelModalText}>Cancel</Text>
            </PressScale>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
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
  demoStripText: { color: colors.navy, fontSize: 11.5, fontWeight: '700' },
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
  bannerTextWrap: { width: '100%', alignItems: 'stretch', paddingHorizontal: 8 },
  userName: { fontSize: 22, fontWeight: '800', color: colors.white, marginBottom: 4, width: '100%', textAlign: 'center', paddingHorizontal: 10 },
  userPhone: { fontSize: 13.5, color: '#9FB0C7', marginBottom: 3, lineHeight: 20, width: '100%', textAlign: 'center', paddingHorizontal: 16 },
  userEmail: { fontSize: 12.5, color: '#9FB0C7', marginBottom: 10, lineHeight: 19, width: '100%', textAlign: 'center', paddingHorizontal: 16 },
  bannerBadgesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 8,
  },
  roleBadge: {
    backgroundColor: colors.navySurface,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: colors.navyBorder,
  },
  roleText: { color: colors.white, fontSize: 11, fontWeight: '800', letterSpacing: 1 },
  editProfileBtn: {
    backgroundColor: colors.primary,
    borderRadius: 8,
    overflow: 'hidden',
  },
  editProfileInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  editProfileText: { color: colors.white, fontSize: 12, fontWeight: '800' },
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
    paddingVertical: 10,
    minHeight: 58,
  },
  menuIcon: {
    width: 36,
    height: 36,
    borderRadius: 9,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  menuLabel: { color: colors.navy, fontSize: 14.5, fontWeight: '700' },
  menuSub: { color: colors.textMuted, fontSize: 12, fontWeight: '500', marginTop: 1 },
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
  version: { textAlign: 'center', color: colors.textMuted, fontSize: 12, marginBottom: 12 },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(11, 22, 40, 0.56)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    gap: 10,
    ...theme.elevation.sheet,
  },
  modalTitle: { fontSize: 19, fontWeight: '800', color: colors.navy, marginBottom: 6 },
  inputLabel: { fontSize: 12.5, fontWeight: '700', color: colors.textSecondary },
  modalInput: {
    backgroundColor: colors.background,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    paddingHorizontal: 14,
    minHeight: 48,
    color: colors.navy,
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 4,
  },
  saveModalBtn: { backgroundColor: colors.primary, borderRadius: 12, overflow: 'hidden', marginTop: 8 },
  saveModalInner: { minHeight: 50, alignItems: 'center', justifyContent: 'center' },
  saveModalText: { color: colors.white, fontSize: 15.5, fontWeight: '800' },
  cancelModalBtn: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    overflow: 'hidden',
  },
  cancelModalText: { color: colors.navy, fontSize: 14.5, fontWeight: '700' },
});
