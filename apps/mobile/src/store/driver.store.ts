import { create } from 'zustand';
import { authApi, notificationApi, type VehiclePayloadType, type NotificationPreferencesPayload } from '../api/client';
import { cacheGet, cacheSet, CACHE_KEYS } from '../utils/cache';
import { useAuthStore } from './auth.store';
import { DEMO_VEHICLES, DEMO_USER, DEMO_NOTIFICATIONS } from '../data/demoFixtures';

let localIdSeq = 0;

function createLocalId(prefix: string): string {
  localIdSeq += 1;
  return `${prefix}-${Date.now()}-${localIdSeq}`;
}

export interface DriverNotification {
  id: string;
  type: string;
  title: string;
  body: string;
  read: boolean;
  createdAt: string;
  data?: Record<string, string>;
}

export interface DriverVehicle {
  id: string;
  userId: string;
  licensePlate: string;
  vehicleType: VehiclePayloadType;
  make?: string;
  model?: string;
  color?: string;
  isDefault: boolean;
  createdAt: string;
}

export interface SavedPlace {
  id: string;
  label: string;
  address: string;
  areaQuery: string;
  lat: number;
  lng: number;
  kind: 'home' | 'work' | 'favorite';
}

export interface UpiMethod {
  id: string;
  vpa: string;
  label: string;
  appName: string;
  isDefault: boolean;
}

const DEFAULT_SAVED_PLACES: SavedPlace[] = [
  {
    id: 'place-tnagar',
    label: 'Shopping · T Nagar',
    address: 'Panagal Park Road, T Nagar, Chennai',
    areaQuery: 'T Nagar',
    lat: 13.0418,
    lng: 80.2341,
    kind: 'favorite',
  },
  {
    id: 'place-omr',
    label: 'Work · OMR IT Corridor',
    address: 'Tidel Park / OMR Corridor, Chennai',
    areaQuery: 'OMR',
    lat: 12.9345,
    lng: 80.2361,
    kind: 'work',
  },
];

const DEFAULT_UPI_METHODS: UpiMethod[] = [
  {
    id: 'upi-default-oksbi',
    vpa: 'arjun.chennai@oksbi',
    label: 'Primary GPay UPI',
    appName: 'Google Pay',
    isDefault: true,
  },
  {
    id: 'upi-phonepe-ybl',
    vpa: 'arjun.k@ybl',
    label: 'PhonePe Wallet UPI',
    appName: 'PhonePe',
    isDefault: false,
  },
];

const DEFAULT_NOTIFICATION_PREFS: NotificationPreferencesPayload = {
  bookingReminders: true,
  gateAlerts: true,
  paymentReceipts: true,
  promoOffers: false,
};

interface DriverState {
  vehicles: DriverVehicle[];
  vehiclesLoading: boolean;
  savedPlaces: SavedPlace[];
  upiMethods: UpiMethod[];
  notificationPrefs: NotificationPreferencesPayload;
  prefsLoading: boolean;
  notifications: DriverNotification[];
  notificationsLoading: boolean;
  unreadCount: number;

  loadVehicles: () => Promise<DriverVehicle[]>;
  addVehicle: (input: {
    licensePlate: string;
    vehicleType: VehiclePayloadType;
    make?: string;
    model?: string;
    color?: string;
    isDefault?: boolean;
  }) => Promise<DriverVehicle>;
  setDefaultVehicle: (id: string) => Promise<void>;
  deleteVehicle: (id: string) => Promise<void>;

  loadSavedPlaces: () => Promise<SavedPlace[]>;
  addSavedPlace: (place: Omit<SavedPlace, 'id'>) => Promise<SavedPlace>;
  removeSavedPlace: (id: string) => Promise<void>;

  loadUpiMethods: () => Promise<UpiMethod[]>;
  addUpiMethod: (input: { vpa: string; label: string; appName: string; isDefault?: boolean }) => Promise<UpiMethod>;
  setDefaultUpiMethod: (id: string) => Promise<void>;
  removeUpiMethod: (id: string) => Promise<void>;

  loadNotificationPrefs: () => Promise<NotificationPreferencesPayload>;
  saveNotificationPrefs: (prefs: NotificationPreferencesPayload) => Promise<NotificationPreferencesPayload>;

  loadNotifications: () => Promise<DriverNotification[]>;
  markNotificationRead: (id: string) => Promise<void>;
  markAllNotificationsRead: () => Promise<void>;
}

function normalizeNotification(raw: any): DriverNotification {
  return {
    id: String(raw?.id || createLocalId('notif')),
    type: String(raw?.type || 'booking'),
    title: String(raw?.title || 'Parkly Update'),
    body: String(raw?.body || ''),
    read: Boolean(raw?.read),
    createdAt: String(raw?.createdAt || raw?.sentAt || new Date().toISOString()),
    data: raw?.data && typeof raw.data === 'object' ? raw.data : undefined,
  };
}

function countUnread(list: DriverNotification[]): number {
  return list.reduce((acc, item) => (item.read ? acc : acc + 1), 0);
}

export const useDriverStore = create<DriverState>((set, get) => ({
  vehicles: [],
  vehiclesLoading: false,
  savedPlaces: DEFAULT_SAVED_PLACES,
  upiMethods: DEFAULT_UPI_METHODS,
  notificationPrefs: DEFAULT_NOTIFICATION_PREFS,
  prefsLoading: false,
  notifications: [],
  notificationsLoading: false,
  unreadCount: 0,

  loadVehicles: async () => {
    const isDemo = useAuthStore.getState().isDemoMode;
    set({ vehiclesLoading: true });
    try {
      if (isDemo) {
        const cached = await cacheGet<DriverVehicle[]>(CACHE_KEYS.VEHICLES);
        const list = cached && cached.length > 0 ? cached : DEMO_VEHICLES;
        await cacheSet(CACHE_KEYS.VEHICLES, list);
        set({ vehicles: list });
        return list;
      }

      const { data } = await authApi.listVehicles();
      const list = (data?.data?.vehicles || []) as DriverVehicle[];
      await cacheSet(CACHE_KEYS.VEHICLES, list);
      set({ vehicles: list });
      return list;
    } catch (err) {
      const cached = await cacheGet<DriverVehicle[]>(CACHE_KEYS.VEHICLES);
      if (cached) {
        set({ vehicles: cached });
        return cached;
      }
      throw err;
    } finally {
      set({ vehiclesLoading: false });
    }
  },

  addVehicle: async (input) => {
    const isDemo = useAuthStore.getState().isDemoMode;
    const normalizedPlate = input.licensePlate.trim().toUpperCase().replace(/\s+/g, '');

    if (isDemo) {
      const current = get().vehicles;
      const shouldBeDefault = input.isDefault ?? current.length === 0;
      const newVehicle: DriverVehicle = {
        id: `00000000-0000-4000-8000-${String(Date.now()).slice(-12).padStart(12, '0')}`,
        userId: DEMO_USER.id,
        licensePlate: normalizedPlate,
        vehicleType: input.vehicleType,
        make: input.make?.trim() || undefined,
        model: input.model?.trim() || undefined,
        color: input.color?.trim() || undefined,
        isDefault: shouldBeDefault,
        createdAt: new Date().toISOString(),
      };
      const next = [
        newVehicle,
        ...current.map((v) => (shouldBeDefault ? { ...v, isDefault: false } : v)),
      ];
      await cacheSet(CACHE_KEYS.VEHICLES, next);
      set({ vehicles: next });
      return newVehicle;
    }

    const { data } = await authApi.createVehicle({
      ...input,
      licensePlate: normalizedPlate,
    });
    const created = data?.data?.vehicle as DriverVehicle;
    await get().loadVehicles();
    return created;
  },

  setDefaultVehicle: async (id: string) => {
    const isDemo = useAuthStore.getState().isDemoMode;
    if (isDemo) {
      const next = get().vehicles.map((v) => ({ ...v, isDefault: v.id === id }));
      await cacheSet(CACHE_KEYS.VEHICLES, next);
      set({ vehicles: next });
      return;
    }
    await authApi.setDefaultVehicle(id);
    await get().loadVehicles();
  },

  deleteVehicle: async (id: string) => {
    const isDemo = useAuthStore.getState().isDemoMode;
    if (isDemo) {
      const remaining = get().vehicles.filter((v) => v.id !== id);
      if (remaining.length > 0 && !remaining.some((v) => v.isDefault)) {
        remaining[0] = { ...remaining[0], isDefault: true };
      }
      await cacheSet(CACHE_KEYS.VEHICLES, remaining);
      set({ vehicles: remaining });
      return;
    }
    await authApi.deleteVehicle(id);
    await get().loadVehicles();
  },

  loadSavedPlaces: async () => {
    const cached = await cacheGet<SavedPlace[]>(CACHE_KEYS.SAVED_PLACES);
    if (cached && cached.length > 0) {
      set({ savedPlaces: cached });
      return cached;
    }
    await cacheSet(CACHE_KEYS.SAVED_PLACES, DEFAULT_SAVED_PLACES);
    set({ savedPlaces: DEFAULT_SAVED_PLACES });
    return DEFAULT_SAVED_PLACES;
  },

  addSavedPlace: async (place) => {
    const nextPlace: SavedPlace = {
      ...place,
      id: createLocalId('place'),
    };
    const next = [nextPlace, ...get().savedPlaces];
    await cacheSet(CACHE_KEYS.SAVED_PLACES, next);
    set({ savedPlaces: next });
    return nextPlace;
  },

  removeSavedPlace: async (id: string) => {
    const next = get().savedPlaces.filter((p) => p.id !== id);
    await cacheSet(CACHE_KEYS.SAVED_PLACES, next);
    set({ savedPlaces: next });
  },

  loadUpiMethods: async () => {
    const cached = await cacheGet<UpiMethod[]>(CACHE_KEYS.UPI_METHODS);
    if (cached && cached.length > 0) {
      set({ upiMethods: cached });
      return cached;
    }
    await cacheSet(CACHE_KEYS.UPI_METHODS, DEFAULT_UPI_METHODS);
    set({ upiMethods: DEFAULT_UPI_METHODS });
    return DEFAULT_UPI_METHODS;
  },

  addUpiMethod: async ({ vpa, label, appName, isDefault }) => {
    const current = get().upiMethods;
    const makeDefault = isDefault ?? current.length === 0;
    const created: UpiMethod = {
      id: createLocalId('upi'),
      vpa: vpa.trim().toLowerCase(),
      label: label.trim() || appName,
      appName,
      isDefault: makeDefault,
    };
    const next = [
      created,
      ...current.map((m) => (makeDefault ? { ...m, isDefault: false } : m)),
    ];
    await cacheSet(CACHE_KEYS.UPI_METHODS, next);
    set({ upiMethods: next });
    return created;
  },

  setDefaultUpiMethod: async (id: string) => {
    const next = get().upiMethods.map((m) => ({ ...m, isDefault: m.id === id }));
    await cacheSet(CACHE_KEYS.UPI_METHODS, next);
    set({ upiMethods: next });
  },

  removeUpiMethod: async (id: string) => {
    const remaining = get().upiMethods.filter((m) => m.id !== id);
    if (remaining.length > 0 && !remaining.some((m) => m.isDefault)) {
      remaining[0] = { ...remaining[0], isDefault: true };
    }
    await cacheSet(CACHE_KEYS.UPI_METHODS, remaining);
    set({ upiMethods: remaining });
  },

  loadNotificationPrefs: async () => {
    const isDemo = useAuthStore.getState().isDemoMode;
    set({ prefsLoading: true });
    try {
      const cached = await cacheGet<NotificationPreferencesPayload>(CACHE_KEYS.NOTIFICATION_PREFS);
      if (cached) {
        set({ notificationPrefs: cached });
      }
      if (!isDemo) {
        const { data } = await notificationApi.getPreferences();
        const serverPrefs = data?.data?.preferences as NotificationPreferencesPayload | undefined;
        if (serverPrefs) {
          await cacheSet(CACHE_KEYS.NOTIFICATION_PREFS, serverPrefs);
          set({ notificationPrefs: serverPrefs });
          return serverPrefs;
        }
      }
      return cached || DEFAULT_NOTIFICATION_PREFS;
    } catch {
      const cached = await cacheGet<NotificationPreferencesPayload>(CACHE_KEYS.NOTIFICATION_PREFS);
      return cached || get().notificationPrefs;
    } finally {
      set({ prefsLoading: false });
    }
  },

  saveNotificationPrefs: async (prefs) => {
    const isDemo = useAuthStore.getState().isDemoMode;
    await cacheSet(CACHE_KEYS.NOTIFICATION_PREFS, prefs);
    set({ notificationPrefs: prefs });

    if (!isDemo) {
      const { data } = await notificationApi.updatePreferences(prefs);
      const saved = (data?.data?.preferences as NotificationPreferencesPayload | undefined) || prefs;
      await cacheSet(CACHE_KEYS.NOTIFICATION_PREFS, saved);
      set({ notificationPrefs: saved });
      return saved;
    }
    return prefs;
  },

  loadNotifications: async () => {
    const isDemo = useAuthStore.getState().isDemoMode;
    set({ notificationsLoading: true });
    try {
      if (isDemo) {
        const cached = await cacheGet<DriverNotification[]>(CACHE_KEYS.NOTIFICATION_INBOX);
        const list =
          cached && cached.length > 0
            ? cached.map(normalizeNotification)
            : DEMO_NOTIFICATIONS.map(normalizeNotification);
        await cacheSet(CACHE_KEYS.NOTIFICATION_INBOX, list);
        set({ notifications: list, unreadCount: countUnread(list) });
        return list;
      }

      const cached = await cacheGet<DriverNotification[]>(CACHE_KEYS.NOTIFICATION_INBOX);
      if (cached && cached.length > 0) {
        const normalizedCached = cached.map(normalizeNotification);
        set({ notifications: normalizedCached, unreadCount: countUnread(normalizedCached) });
      }

      const { data } = await notificationApi.list();
      const rawItems =
        data?.data?.notifications ||
        (Array.isArray(data?.data) ? data.data : []);
      const list = (rawItems as any[]).map(normalizeNotification);
      await cacheSet(CACHE_KEYS.NOTIFICATION_INBOX, list);
      set({ notifications: list, unreadCount: countUnread(list) });
      return list;
    } catch {
      const fallback = get().notifications;
      return fallback;
    } finally {
      set({ notificationsLoading: false });
    }
  },

  markNotificationRead: async (id: string) => {
    const isDemo = useAuthStore.getState().isDemoMode;
    const next = get().notifications.map((n) => (n.id === id ? { ...n, read: true } : n));
    await cacheSet(CACHE_KEYS.NOTIFICATION_INBOX, next);
    set({ notifications: next, unreadCount: countUnread(next) });

    if (!isDemo) {
      try {
        await notificationApi.markRead(id);
      } catch {
        // Optimistic read status preserved locally when offline
      }
    }
  },

  markAllNotificationsRead: async () => {
    const unread = get().notifications.filter((n) => !n.read);
    if (unread.length === 0) return;

    const isDemo = useAuthStore.getState().isDemoMode;
    const next = get().notifications.map((n) => ({ ...n, read: true }));
    await cacheSet(CACHE_KEYS.NOTIFICATION_INBOX, next);
    set({ notifications: next, unreadCount: 0 });

    if (!isDemo) {
      await Promise.allSettled(unread.map((item) => notificationApi.markRead(item.id)));
    }
  },
}));
