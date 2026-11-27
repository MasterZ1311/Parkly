import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  Linking,
  Modal,
  TextInput,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../../src/store/auth.store';
import { authApi, bookingApi, notificationApi } from '../../src/api/client';
import { cacheGet, cacheSet, CACHE_KEYS } from '../../src/utils/cache';
import { colors } from '../../src/constants/theme';

interface Vehicle {
  id: string;
  licensePlate: string;
  vehicleType: string;
  make?: string;
  model?: string;
}

interface NotificationItem {
  id: string;
  title?: string;
  message: string;
  read?: boolean;
  createdAt?: string;
}

interface SavedPlace {
  id: string;
  label: string;
  query: string;
}

interface MenuItemProps {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  subtitle?: string;
  onPress: () => void;
  color?: string;
}

function MenuItem({ icon, label, subtitle, onPress, color = colors.primary }: MenuItemProps) {
  return (
    <TouchableOpacity style={styles.menuItem} onPress={onPress}>
      <View style={[styles.menuIcon, { backgroundColor: color + '20' }]}>
        <Ionicons name={icon} size={20} color={color} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.menuLabel}>{label}</Text>
        {subtitle ? <Text style={styles.menuSub}>{subtitle}</Text> : null}
      </View>
      <Ionicons name="chevron-forward" size={16} color={colors.border} />
    </TouchableOpacity>
  );
}

export default function ProfileScreen() {
  const { user, isAuthenticated, logout } = useAuthStore();
  const [stats, setStats] = useState({ count: 0, spent: 0, hours: 0 });
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [savedPlaces, setSavedPlaces] = useState<SavedPlace[]>([]);
  const [preferredUpi, setPreferredUpi] = useState('driver@okicici');

  const [activeModal, setActiveModal] = useState<null | 'editProfile' | 'vehicles' | 'notifications' | 'payments' | 'places'>(null);
  const [saving, setSaving] = useState(false);

  // Edit Profile form
  const [editName, setEditName] = useState(user?.name || '');
  const [editEmail, setEditEmail] = useState(user?.email || '');

  // Add Vehicle form
  const [newPlate, setNewPlate] = useState('');
  const [newType, setNewType] = useState<'motorcycle' | 'compact' | 'sedan' | 'suv'>('sedan');
  const [newMake, setNewMake] = useState('');

  // Saved Place form
  const [placeLabel, setPlaceLabel] = useState('');
  const [placeQuery, setPlaceQuery] = useState('');

  useEffect(() => {
    setEditName(user?.name || '');
    setEditEmail(user?.email || '');
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      loadProfileExtras();
    }, [isAuthenticated]),
  );

  const loadProfileExtras = async () => {
    try {
      const [cachedBookings, storedPlaces, storedUpi] = await Promise.all([
        cacheGet<any[]>(CACHE_KEYS.RECENT_BOOKINGS),
        cacheGet<SavedPlace[]>(CACHE_KEYS.SAVED_PLACES),
        cacheGet<string>(CACHE_KEYS.PREFERRED_UPI),
      ]);
      if (storedPlaces) setSavedPlaces(storedPlaces);
      if (storedUpi) setPreferredUpi(storedUpi);

      let list = cachedBookings || [];
      if (isAuthenticated) {
        try {
          const bRes = await bookingApi.list();
          list = bRes.data?.data?.bookings || list;
        } catch { }
        try {
          const vRes = await authApi.listVehicles();
          setVehicles(vRes.data?.data?.vehicles || []);
        } catch { }
        try {
          const nRes = await notificationApi.list();
          const rawNotifs = nRes.data?.data;
          setNotifications(Array.isArray(rawNotifs) ? rawNotifs : (rawNotifs?.notifications || []));
        } catch { }
      }

      const spent = list.reduce((s, b) => s + Number(b.totalAmount || 0), 0);
      const mins = list.reduce((s, b) => {
        if (b.durationMinutes) return s + Number(b.durationMinutes);
        if (b.startTime && b.endTime) {
          return s + Math.max(0, Math.round((new Date(b.endTime).getTime() - new Date(b.startTime).getTime()) / 60000));
        }
        return s + 120;
      }, 0);
      setStats({ count: list.length, spent: Math.round(spent), hours: Math.round(mins / 60) });
    } catch { }
  };

  const handleSaveProfile = async () => {
    if (!editName.trim()) {
      Alert.alert('Validation', 'Name cannot be empty.');
      return;
    }
    setSaving(true);
    try {
      const { data } = await authApi.updateProfile({
        name: editName.trim(),
        ...(editEmail.trim() ? { email: editEmail.trim() } : {}),
      });
      if (data?.data?.user) {
        useAuthStore.setState({ user: data.data.user });
        await cacheSet(CACHE_KEYS.USER_PROFILE, data.data.user);
      }
      setActiveModal(null);
      Alert.alert('Profile Updated', 'Your profile details have been saved.');
    } catch (err: any) {
      Alert.alert('Update Failed', err?.response?.data?.error?.message || 'Unable to save profile.');
    } finally {
      setSaving(false);
    }
  };

  const handleAddVehicle = async () => {
    const cleaned = newPlate.trim().toUpperCase().replace(/\s+/g, '');
    if (!/^[A-Z]{2}[0-9]{1,2}[A-Z]{1,3}[0-9]{4}$/.test(cleaned)) {
      Alert.alert('Invalid Plate', 'Enter a valid Indian registration number (e.g. TN01AB1234).');
      return;
    }
    setSaving(true);
    try {
      const { data } = await authApi.addVehicle({
        licensePlate: cleaned,
        vehicleType: newType,
        ...(newMake.trim() ? { make: newMake.trim() } : {}),
      });
      const v = data?.data?.vehicle;
      if (v) {
        setVehicles((prev) => [v, ...prev.filter((item) => item.id !== v.id)]);
      }
      setNewPlate('');
      setNewMake('');
    } catch (err: any) {
      Alert.alert('Could Not Add Vehicle', err?.response?.data?.error?.message || 'Registration failed.');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteVehicle = async (vehicleId: string) => {
    try {
      await authApi.deleteVehicle(vehicleId);
      setVehicles((prev) => prev.filter((v) => v.id !== vehicleId));
    } catch (err: any) {
      Alert.alert('Error', err?.response?.data?.error?.message || 'Unable to remove vehicle.');
    }
  };

  const handleMarkNotificationRead = async (id: string) => {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
    try {
      await notificationApi.markRead(id);
    } catch { }
  };

  const handleSaveUpi = async () => {
    if (!preferredUpi.includes('@')) {
      Alert.alert('Invalid UPI ID', 'Please enter a valid UPI VPA (e.g. name@okicici).');
      return;
    }
    await cacheSet(CACHE_KEYS.PREFERRED_UPI, preferredUpi.trim());
    setActiveModal(null);
    Alert.alert('Saved', 'Default payment method updated.');
  };

  const handleAddPlace = async () => {
    if (!placeLabel.trim() || !placeQuery.trim()) return;
    const next = [{ id: String(Date.now()), label: placeLabel.trim(), query: placeQuery.trim() }, ...savedPlaces];
    setSavedPlaces(next);
    await cacheSet(CACHE_KEYS.SAVED_PLACES, next);
    setPlaceLabel('');
    setPlaceQuery('');
  };

  const handleRemovePlace = async (id: string) => {
    const next = savedPlaces.filter((p) => p.id !== id);
    setSavedPlaces(next);
    await cacheSet(CACHE_KEYS.SAVED_PLACES, next);
  };

  const handleLogout = () => {
    const runLogout = async () => {
      await logout();
      router.replace('/(auth)/login');
    };
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined' && window.confirm('Are you sure you want to logout?')) {
        void runLogout();
      }
      return;
    }
    Alert.alert('Logout', 'Are you sure you want to logout?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Logout',
        style: 'destructive',
        onPress: runLogout,
      },
    ]);
  };

  const openLink = async (url: string, label: string) => {
    try {
      const supported = await Linking.canOpenURL(url);
      if (supported) await Linking.openURL(url);
      else Alert.alert(label, `Unable to open ${url} on this device.`);
    } catch {
      Alert.alert(label, `Something went wrong opening ${label}.`);
    }
  };

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {/* Profile Header */}
      <View style={styles.profileHeader}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{user?.name?.charAt(0)?.toUpperCase() || 'P'}</Text>
        </View>
        <Text style={styles.userName}>{user?.name || 'Guest Driver'}</Text>
        <Text style={styles.userPhone}>{user?.phone || 'Sign in to sync bookings & vehicles'}</Text>

        <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
          <View style={styles.roleBadge}>
            <Text style={styles.roleText}>{user?.role?.toUpperCase() || 'GUEST'}</Text>
          </View>
          {isAuthenticated ? (
            <TouchableOpacity style={styles.editBadge} onPress={() => setActiveModal('editProfile')}>
              <Ionicons name="create-outline" size={14} color={colors.text} />
              <Text style={styles.editBadgeText}>Edit Profile</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={styles.editBadge} onPress={() => router.push('/(auth)/login')}>
              <Ionicons name="log-in-outline" size={14} color={colors.text} />
              <Text style={styles.editBadgeText}>Sign In</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Stats */}
      <View style={styles.statsRow}>
        {[
          { label: 'Bookings', value: String(stats.count) },
          { label: 'Total Spent', value: `₹${stats.spent}` },
          { label: 'Parked', value: `${stats.hours}h` },
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
            subtitle={vehicles.length > 0 ? `${vehicles.length} registered (${vehicles[0]!.licensePlate})` : 'Manage number plates'}
            onPress={() => setActiveModal('vehicles')}
          />
          <MenuItem
            icon="notifications-outline"
            label="Notifications"
            subtitle={`${notifications.filter((n) => !n.read).length} unread`}
            onPress={() => setActiveModal('notifications')}
          />
          <MenuItem
            icon="card-outline"
            label="Payment Methods"
            subtitle={`UPI: ${preferredUpi}`}
            onPress={() => setActiveModal('payments')}
          />
          <MenuItem
            icon="location-outline"
            label="Saved Places"
            subtitle={`${savedPlaces.length} shortcuts`}
            onPress={() => setActiveModal('places')}
          />
        </View>
      </View>

      {/* Support */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Support</Text>
        <View style={styles.menuCard}>
          <MenuItem
            icon="help-circle-outline"
            label="Help Center"
            color={colors.warning}
            onPress={() => openLink('https://parkly.app/help', 'Help Center')}
          />
          <MenuItem
            icon="chatbubble-outline"
            label="Contact Support"
            color={colors.warning}
            onPress={() => openLink('mailto:support@parkly.app?subject=Parkly%20Support%20Request', 'Contact Support')}
          />
          <MenuItem
            icon="document-text-outline"
            label="Terms & Privacy"
            color={colors.warning}
            onPress={() => openLink('https://parkly.app/legal', 'Terms & Privacy')}
          />
        </View>
      </View>

      {isAuthenticated && (
        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <Ionicons name="log-out-outline" size={20} color={colors.danger} />
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>
      )}

      <Text style={styles.version}>Parkly v1.0.0 by ZEUS Technologies</Text>

      {/* Shared In-App Management Modal */}
      <Modal visible={activeModal !== null} animationType="slide" transparent onRequestClose={() => setActiveModal(null)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {activeModal === 'editProfile' && 'Edit Profile'}
                {activeModal === 'vehicles' && 'My Vehicles'}
                {activeModal === 'notifications' && 'Notifications'}
                {activeModal === 'payments' && 'Payment Methods'}
                {activeModal === 'places' && 'Saved Places'}
              </Text>
              <TouchableOpacity onPress={() => setActiveModal(null)}>
                <Ionicons name="close" size={22} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <ScrollView style={{ maxHeight: 420 }} showsVerticalScrollIndicator={false}>
              {activeModal === 'editProfile' && (
                <View style={{ gap: 12 }}>
                  <Text style={styles.inputLabel}>Full Name</Text>
                  <TextInput style={styles.input} value={editName} onChangeText={setEditName} placeholder="Full Name" placeholderTextColor={colors.textMuted} />
                  <Text style={styles.inputLabel}>Email Address</Text>
                  <TextInput style={styles.input} value={editEmail} onChangeText={setEditEmail} placeholder="email@example.com" placeholderTextColor={colors.textMuted} keyboardType="email-address" autoCapitalize="none" />
                  <TouchableOpacity style={styles.modalBtn} onPress={handleSaveProfile} disabled={saving}>
                    {saving ? <ActivityIndicator color={colors.white} /> : <Text style={styles.modalBtnText}>Save Profile</Text>}
                  </TouchableOpacity>
                </View>
              )}

              {activeModal === 'vehicles' && (
                <View style={{ gap: 12 }}>
                  {vehicles.map((v) => (
                    <View key={v.id} style={styles.listRow}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.listRowTitle}>{v.licensePlate}</Text>
                        <Text style={styles.listRowSub}>
                          {v.vehicleType.toUpperCase()} {v.make ? `· ${v.make}` : ''}
                        </Text>
                      </View>
                      <TouchableOpacity onPress={() => handleDeleteVehicle(v.id)}>
                        <Ionicons name="trash-outline" size={18} color={colors.danger} />
                      </TouchableOpacity>
                    </View>
                  ))}
                  {vehicles.length === 0 && <Text style={styles.emptyModalText}>No vehicles saved yet.</Text>}
                  <Text style={styles.inputLabel}>Add Vehicle</Text>
                  <TextInput
                    style={styles.input}
                    value={newPlate}
                    onChangeText={setNewPlate}
                    placeholder="License Plate (TN01AB1234)"
                    placeholderTextColor={colors.textMuted}
                    autoCapitalize="characters"
                  />
                  <TextInput
                    style={styles.input}
                    value={newMake}
                    onChangeText={setNewMake}
                    placeholder="Make / Model (optional)"
                    placeholderTextColor={colors.textMuted}
                  />
                  <View style={styles.chipRow}>
                    {(['motorcycle', 'compact', 'sedan', 'suv'] as const).map((t) => (
                      <TouchableOpacity key={t} style={[styles.chip, newType === t && styles.chipActive]} onPress={() => setNewType(t)}>
                        <Text style={[styles.chipText, newType === t && styles.chipTextActive]}>{t}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                  <TouchableOpacity style={styles.modalBtn} onPress={handleAddVehicle} disabled={saving}>
                    {saving ? <ActivityIndicator color={colors.white} /> : <Text style={styles.modalBtnText}>Add Vehicle</Text>}
                  </TouchableOpacity>
                </View>
              )}

              {activeModal === 'notifications' && (
                <View style={{ gap: 10 }}>
                  {notifications.length === 0 ? (
                    <Text style={styles.emptyModalText}>You are all caught up.</Text>
                  ) : (
                    notifications.map((n) => (
                      <TouchableOpacity key={n.id} style={[styles.listRow, !n.read && { borderColor: colors.primary }]} onPress={() => handleMarkNotificationRead(n.id)}>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.listRowTitle}>{n.title || 'Parkly Alert'}</Text>
                          <Text style={styles.listRowSub}>{n.message}</Text>
                        </View>
                        {!n.read && <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: colors.primary }} />}
                      </TouchableOpacity>
                    ))
                  )}
                </View>
              )}

              {activeModal === 'payments' && (
                <View style={{ gap: 12 }}>
                  <Text style={styles.inputLabel}>Preferred UPI ID (VPA)</Text>
                  <TextInput
                    style={styles.input}
                    value={preferredUpi}
                    onChangeText={setPreferredUpi}
                    placeholder="name@okicici"
                    placeholderTextColor={colors.textMuted}
                    autoCapitalize="none"
                  />
                  <TouchableOpacity style={styles.modalBtn} onPress={handleSaveUpi}>
                    <Text style={styles.modalBtnText}>Save Payment Preference</Text>
                  </TouchableOpacity>
                </View>
              )}

              {activeModal === 'places' && (
                <View style={{ gap: 12 }}>
                  {savedPlaces.map((p) => (
                    <View key={p.id} style={styles.listRow}>
                      <TouchableOpacity
                        style={{ flex: 1 }}
                        onPress={() => {
                          setActiveModal(null);
                          router.push('/(tabs)/home');
                        }}
                      >
                        <Text style={styles.listRowTitle}>{p.label}</Text>
                        <Text style={styles.listRowSub}>{p.query}</Text>
                      </TouchableOpacity>
                      <TouchableOpacity onPress={() => handleRemovePlace(p.id)}>
                        <Ionicons name="trash-outline" size={18} color={colors.danger} />
                      </TouchableOpacity>
                    </View>
                  ))}
                  {savedPlaces.length === 0 && <Text style={styles.emptyModalText}>Save frequent hubs like Office or Mall.</Text>}
                  <TextInput style={styles.input} value={placeLabel} onChangeText={setPlaceLabel} placeholder="Label (e.g. Work)" placeholderTextColor={colors.textMuted} />
                  <TextInput style={styles.input} value={placeQuery} onChangeText={setPlaceQuery} placeholder="Area (e.g. T Nagar)" placeholderTextColor={colors.textMuted} />
                  <TouchableOpacity style={styles.modalBtn} onPress={handleAddPlace}>
                    <Text style={styles.modalBtnText}>Save Place</Text>
                  </TouchableOpacity>
                </View>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  profileHeader: {
    alignItems: 'center',
    paddingVertical: 32,
    paddingHorizontal: 24,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  avatarText: { fontSize: 36, fontWeight: '800', color: colors.white },
  userName: { fontSize: 22, fontWeight: '800', color: colors.text, marginBottom: 4 },
  userPhone: { fontSize: 14, color: colors.textMuted, marginBottom: 10 },
  roleBadge: {
    backgroundColor: colors.primaryLight,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  roleText: { color: colors.primary, fontSize: 11, fontWeight: '700', letterSpacing: 1 },
  editBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: colors.card,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: colors.border,
  },
  editBadgeText: { color: colors.text, fontSize: 11, fontWeight: '600' },
  statsRow: { flexDirection: 'row', paddingHorizontal: 16, paddingVertical: 16, gap: 8 },
  statCard: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  statValue: { fontSize: 18, fontWeight: '800', color: colors.text },
  statLabel: { fontSize: 11, color: colors.textMuted, marginTop: 2 },
  section: { paddingHorizontal: 16, marginBottom: 16 },
  sectionTitle: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1,
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  menuCard: {
    backgroundColor: colors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  menuIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  menuLabel: { color: colors.text, fontSize: 14, fontWeight: '600' },
  menuSub: { color: colors.textMuted, fontSize: 11, marginTop: 2 },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    margin: 16,
    padding: 14,
    backgroundColor: colors.primaryLight,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.danger,
  },
  logoutText: { color: colors.danger, fontSize: 15, fontWeight: '700' },
  version: { textAlign: 'center', color: colors.border, fontSize: 12, marginBottom: 32 },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.65)', justifyContent: 'flex-end' },
  modalSheet: {
    backgroundColor: colors.card,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  modalTitle: { fontSize: 18, fontWeight: '800', color: colors.text },
  inputLabel: { color: colors.textSecondary, fontSize: 12, fontWeight: '600', marginTop: 4 },
  input: {
    backgroundColor: colors.background,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: colors.text,
    fontSize: 14,
    borderWidth: 1,
    borderColor: colors.border,
  },
  modalBtn: { backgroundColor: colors.primary, borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 6 },
  modalBtnText: { color: colors.white, fontSize: 15, fontWeight: '700' },
  listRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.background,
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  listRowTitle: { color: colors.text, fontSize: 14, fontWeight: '700' },
  listRowSub: { color: colors.textSecondary, fontSize: 12, marginTop: 2 },
  emptyModalText: { color: colors.textMuted, fontSize: 13, textAlign: 'center', paddingVertical: 12 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border },
  chipActive: { backgroundColor: colors.primaryLight, borderColor: colors.primary },
  chipText: { color: colors.textMuted, fontSize: 12, fontWeight: '600', textTransform: 'capitalize' },
  chipTextActive: { color: colors.primary },
});
