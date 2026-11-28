const mockMemoryStorage = new Map<string, string>();
const mockSecureMemory = new Map<string, string>();

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
  getItemAsync: jest.fn(async (key: string) => mockSecureMemory.get(key) ?? null),
  setItemAsync: jest.fn(async (key: string, val: string) => {
    mockSecureMemory.set(key, val);
  }),
  deleteItemAsync: jest.fn(async (key: string) => {
    mockSecureMemory.delete(key);
  }),
}));

jest.mock('../services/notifications', () => ({
  registerForPushNotificationsAsync: jest.fn(async () => ({
    granted: true,
    platform: 'android',
    registeredOnServer: true,
  })),
}));

jest.mock('../api/client', () => {
  const realTokenStorage = {
    get: jest.fn(async (key: string) => mockSecureMemory.get(key) ?? null),
    set: jest.fn(async (key: string, val: string) => {
      mockSecureMemory.set(key, val);
    }),
    remove: jest.fn(async (key: string) => {
      mockSecureMemory.delete(key);
    }),
  };
  return {
    tokenStorage: realTokenStorage,
    authApi: {
      requestOtp: jest.fn(),
      verifyOtp: jest.fn(),
      getMe: jest.fn(),
      updateMe: jest.fn(),
    },
  };
});

import { authApi, tokenStorage } from '../api/client';
import { useAuthStore } from '../store/auth.store';
import { DEMO_USER } from '../data/demoFixtures';

describe('useAuthStore — strict real errors & opt-in Demo Mode', () => {
  beforeEach(() => {
    mockMemoryStorage.clear();
    mockSecureMemory.clear();
    jest.clearAllMocks();
    useAuthStore.setState({
      user: null,
      isAuthenticated: false,
      isHydrated: false,
      isLoading: false,
      isOffline: false,
      isDemoMode: false,
      error: null,
    });
  });

  it('rejects honestly when live requestOtp fails offline instead of entering fake offline mode', async () => {
    (authApi.requestOtp as jest.Mock).mockRejectedValueOnce(new Error('Network Error'));

    await expect(useAuthStore.getState().requestOtp('+919876543210')).rejects.toThrow(
      'Network Error',
    );

    const state = useAuthStore.getState();
    expect(state.isAuthenticated).toBe(false);
    expect(state.isDemoMode).toBe(false);
    expect(state.isOffline).toBe(true);
    expect(state.error).toBe('Network Error');
  });

  it('authenticates against live verifyOtp and persists tokens securely', async () => {
    const liveUser = {
      id: '00000000-0000-4000-8000-000000000010',
      name: 'Priya S',
      phone: '+919876543219',
      role: 'driver',
    };
    (authApi.verifyOtp as jest.Mock).mockResolvedValueOnce({
      data: {
        data: {
          user: liveUser,
          tokens: { accessToken: 'acc-123', refreshToken: 'ref-456' },
        },
      },
    });

    await useAuthStore.getState().verifyOtp('+919876543219', '654321', 'Priya S');

    expect(tokenStorage.set).toHaveBeenCalledWith('access_token', 'acc-123');
    expect(tokenStorage.set).toHaveBeenCalledWith('refresh_token', 'ref-456');
    const state = useAuthStore.getState();
    expect(state.isAuthenticated).toBe(true);
    expect(state.isDemoMode).toBe(false);
    expect(state.user).toEqual(liveUser);
  });

  it('requires code 123456 in Demo Mode and allows explicit opt-in demo session', async () => {
    await useAuthStore.getState().setDemoMode(true);
    const devOtp = await useAuthStore.getState().requestOtp('+919876543211');
    expect(devOtp).toBe('123456');

    await expect(useAuthStore.getState().verifyOtp('+919876543211', '000000')).rejects.toThrow(
      /123456/,
    );

    await useAuthStore.getState().verifyOtp('+919876543211', '123456', 'Arjun Demo');
    const state = useAuthStore.getState();
    expect(state.isAuthenticated).toBe(true);
    expect(state.isDemoMode).toBe(true);
    expect(state.user?.id).toBe(DEMO_USER.id);
    expect(state.user?.name).toBe('Arjun Demo');
  });

  it('clears expired tokens when loadUser gets 401 from /auth/me', async () => {
    mockSecureMemory.set('access_token', 'stale-jwt');
    mockSecureMemory.set('refresh_token', 'stale-refresh');
    (authApi.getMe as jest.Mock).mockRejectedValueOnce({
      response: { status: 401, data: { error: { message: 'Token expired' } } },
    });

    await useAuthStore.getState().loadUser();

    expect(mockSecureMemory.has('access_token')).toBe(false);
    expect(useAuthStore.getState().isAuthenticated).toBe(false);
    expect(useAuthStore.getState().isHydrated).toBe(true);
  });
});
