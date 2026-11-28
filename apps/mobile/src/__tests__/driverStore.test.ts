const mockMemoryStorage = new Map<string, string>();

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(async (key: string) => mockMemoryStorage.get(key) ?? null),
  setItem: jest.fn(async (key: string, val: string) => {
    mockMemoryStorage.set(key, val);
  }),
  removeItem: jest.fn(async (key: string) => {
    mockMemoryStorage.delete(key);
  }),
}));

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(async () => null),
  setItemAsync: jest.fn(async () => undefined),
  deleteItemAsync: jest.fn(async () => undefined),
}));

jest.mock('../services/notifications', () => ({
  registerForPushNotificationsAsync: jest.fn(async () => ({
    granted: false,
    platform: 'web',
    registeredOnServer: false,
  })),
}));

jest.mock('../api/client', () => ({
  tokenStorage: {
    get: jest.fn(async () => null),
    set: jest.fn(async () => undefined),
    remove: jest.fn(async () => undefined),
  },
  authApi: {
    listVehicles: jest.fn(),
    createVehicle: jest.fn(),
    setDefaultVehicle: jest.fn(),
    deleteVehicle: jest.fn(),
    requestOtp: jest.fn(),
    verifyOtp: jest.fn(),
    getMe: jest.fn(),
    updateMe: jest.fn(),
  },
  notificationApi: {
    getPreferences: jest.fn(),
    updatePreferences: jest.fn(),
  },
}));

import { authApi, notificationApi } from '../api/client';
import { useAuthStore } from '../store/auth.store';
import { useDriverStore } from '../store/driver.store';

describe('useDriverStore — vehicles, saved places, UPI handles & notifications', () => {
  beforeEach(() => {
    mockMemoryStorage.clear();
    jest.clearAllMocks();
    useAuthStore.setState({ isDemoMode: false });
    useDriverStore.setState({
      vehicles: [],
      vehiclesLoading: false,
      savedPlaces: [],
      upiMethods: [],
      notificationPrefs: {
        bookingReminders: true,
        gateAlerts: true,
        paymentReceipts: true,
        promoOffers: false,
      },
      prefsLoading: false,
    });
  });

  it('creates vehicles in live mode and returns server-assigned UUID vehicleId', async () => {
    const serverVehicle = {
      id: '33333333-3333-4333-8333-000000000001',
      userId: '00000000-0000-4000-8000-000000000010',
      licensePlate: 'TN09EF4321',
      vehicleType: 'suv',
      isDefault: true,
      createdAt: '2026-11-28T00:00:00.000Z',
    };

    (authApi.createVehicle as jest.Mock).mockResolvedValueOnce({
      data: { data: { vehicle: serverVehicle } },
    });
    (authApi.listVehicles as jest.Mock).mockResolvedValueOnce({
      data: { data: { vehicles: [serverVehicle] } },
    });

    const created = await useDriverStore.getState().addVehicle({
      licensePlate: ' tn09 ef 4321 ',
      vehicleType: 'suv',
    });

    expect(authApi.createVehicle).toHaveBeenCalledWith(
      expect.objectContaining({ licensePlate: 'TN09EF4321', vehicleType: 'suv' }),
    );
    expect(created.id).toBe('33333333-3333-4333-8333-000000000001');
    expect(useDriverStore.getState().vehicles).toHaveLength(1);
  });

  it('manages UPI methods with automatic default reassignment on removal', async () => {
    const first = await useDriverStore.getState().addUpiMethod({
      vpa: 'Driver.Primary@OKSBI',
      label: 'Primary GPay',
      appName: 'Google Pay',
    });
    const second = await useDriverStore.getState().addUpiMethod({
      vpa: 'driver.alt@ybl',
      label: 'Backup PhonePe',
      appName: 'PhonePe',
    });

    expect(first.vpa).toBe('driver.primary@oksbi');
    expect(first.isDefault).toBe(true);
    expect(second.isDefault).toBe(false);

    await useDriverStore.getState().removeUpiMethod(first.id);
    const remaining = useDriverStore.getState().upiMethods;
    expect(remaining).toHaveLength(1);
    expect(remaining[0].id).toBe(second.id);
    expect(remaining[0].isDefault).toBe(true);
  });

  it('persists and syncs notification preferences with notification-service in live mode', async () => {
    const updated = {
      bookingReminders: true,
      gateAlerts: false,
      paymentReceipts: true,
      promoOffers: true,
    };

    (notificationApi.updatePreferences as jest.Mock).mockResolvedValueOnce({
      data: { data: { preferences: updated } },
    });

    const saved = await useDriverStore.getState().saveNotificationPrefs(updated);
    expect(notificationApi.updatePreferences).toHaveBeenCalledWith(updated);
    expect(saved).toEqual(updated);
    expect(useDriverStore.getState().notificationPrefs.gateAlerts).toBe(false);
  });

  it('adds and removes Saved Chennai Places', async () => {
    const added = await useDriverStore.getState().addSavedPlace({
      label: 'Office · Guindy',
      address: 'Olympia Tech Park, Guindy',
      areaQuery: 'Guindy',
      lat: 13.0068,
      lng: 80.2206,
      kind: 'work',
    });

    expect(useDriverStore.getState().savedPlaces[0].areaQuery).toBe('Guindy');
    await useDriverStore.getState().removeSavedPlace(added.id);
    expect(useDriverStore.getState().savedPlaces).toHaveLength(0);
  });
});
