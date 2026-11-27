// ============================================================
// Parkly Mobile — Auth Store (Zustand)
// Strict real errors by default + explicit opt-in Demo Mode.
// ============================================================

import { create } from 'zustand';
import { authApi, tokenStorage } from '../api/client';
import { cacheGet, cacheSet, cacheRemove, CACHE_KEYS } from '../utils/cache';
import { classifyApiError } from '../utils/apiErrors';
import { DEMO_USER, DEMO_VEHICLES, createDemoBookings } from '../data/demoFixtures';
import { registerForPushNotificationsAsync } from '../services/notifications';

export interface AuthUser {
  id: string;
  name: string;
  phone: string;
  email?: string;
  role: 'driver' | 'host' | 'admin';
}

export interface AuthState {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isHydrated: boolean;
  isLoading: boolean;
  isOffline: boolean;
  isDemoMode: boolean;
  error: string | null;

  setDemoMode: (enabled: boolean) => Promise<void>;
  enterDemoMode: (phone?: string, name?: string) => Promise<void>;
  requestOtp: (phone: string) => Promise<string | undefined>;
  verifyOtp: (phone: string, otp: string, name?: string) => Promise<void>;
  updateProfile: (payload: { name?: string; email?: string | null }) => Promise<AuthUser>;
  logout: () => Promise<void>;
  loadUser: () => Promise<void>;
  setOfflineStatus: (offline: boolean) => void;
  clearError: () => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  isAuthenticated: false,
  isHydrated: false,
  isLoading: false,
  isOffline: false,
  isDemoMode: false,
  error: null,

  setDemoMode: async (enabled: boolean) => {
    await cacheSet(CACHE_KEYS.DEMO_MODE, enabled);
    set({ isDemoMode: enabled, error: null });
  },

  enterDemoMode: async (phone?: string, name?: string) => {
    const demoUser: AuthUser = {
      ...DEMO_USER,
      ...(phone ? { phone } : {}),
      ...(name?.trim() ? { name: name.trim() } : {}),
    };

    await cacheSet(CACHE_KEYS.DEMO_MODE, true);
    await cacheSet(CACHE_KEYS.USER_PROFILE, demoUser);

    const existingVehicles = await cacheGet(CACHE_KEYS.VEHICLES);
    if (!existingVehicles) {
      await cacheSet(CACHE_KEYS.VEHICLES, DEMO_VEHICLES);
    }

    const existingBookings = await cacheGet(CACHE_KEYS.RECENT_BOOKINGS);
    if (!existingBookings) {
      await cacheSet(CACHE_KEYS.RECENT_BOOKINGS, createDemoBookings());
    }

    set({
      user: demoUser,
      isAuthenticated: true,
      isHydrated: true,
      isDemoMode: true,
      isOffline: false,
      isLoading: false,
      error: null,
    });
  },

  requestOtp: async (phone: string) => {
    set({ isLoading: true, error: null });

    if (get().isDemoMode) {
      set({ isLoading: false });
      return '123456';
    }

    try {
      const { data } = await authApi.requestOtp(phone);
      // Dev-only: backend returns the OTP when not in production.
      return data?.data?.devOtp as string | undefined;
    } catch (err: unknown) {
      const classified = classifyApiError(err, 'Failed to send OTP');
      set({ error: classified.message, isOffline: classified.kind === 'offline' });
      throw err;
    } finally {
      set({ isLoading: false });
    }
  },

  verifyOtp: async (phone: string, otp: string, name?: string) => {
    set({ isLoading: true, error: null });

    if (get().isDemoMode) {
      if (otp !== '123456') {
        const message = 'In Demo Mode, enter code 123456 to continue.';
        set({ error: message, isLoading: false });
        throw new Error(message);
      }
      await get().enterDemoMode(phone, name);
      return;
    }

    try {
      const { data } = await authApi.verifyOtp(phone, otp, name);
      const { user, tokens } = data.data;

      await tokenStorage.set('access_token', tokens.accessToken);
      await tokenStorage.set('refresh_token', tokens.refreshToken);
      await cacheSet(CACHE_KEYS.USER_PROFILE, user);
      await cacheSet(CACHE_KEYS.DEMO_MODE, false);

      set({
        user,
        isAuthenticated: true,
        isHydrated: true,
        isDemoMode: false,
        isOffline: false,
        isLoading: false,
      });

      // Register real Expo/FCM push token asynchronously without blocking login
      registerForPushNotificationsAsync(true).catch(() => {});
    } catch (err: unknown) {
      const classified = classifyApiError(err, 'Invalid OTP');
      set({
        error: classified.message,
        isOffline: classified.kind === 'offline',
        isLoading: false,
      });
      throw err;
    }
  },

  updateProfile: async (payload: { name?: string; email?: string | null }) => {
    const current = get().user;
    if (get().isDemoMode && current) {
      const updated: AuthUser = {
        ...current,
        ...(payload.name !== undefined ? { name: payload.name.trim() } : {}),
        ...(payload.email !== undefined ? { email: payload.email || undefined } : {}),
      };
      await cacheSet(CACHE_KEYS.USER_PROFILE, updated);
      set({ user: updated });
      return updated;
    }

    const { data } = await authApi.updateMe(payload);
    const updatedUser = data?.data?.user as AuthUser;
    if (updatedUser) {
      await cacheSet(CACHE_KEYS.USER_PROFILE, updatedUser);
      set({ user: updatedUser });
    }
    return updatedUser;
  },

  logout: async () => {
    try {
      await tokenStorage.remove('access_token');
      await tokenStorage.remove('refresh_token');
    } catch {
      // Ignore secure store cleanup errors
    }
    await cacheRemove(CACHE_KEYS.DEMO_MODE);
    await cacheRemove(CACHE_KEYS.USER_PROFILE);
    await cacheRemove(CACHE_KEYS.RECENT_BOOKINGS);
    await cacheRemove(CACHE_KEYS.VEHICLES);
    set({
      user: null,
      isAuthenticated: false,
      isDemoMode: false,
      isOffline: false,
      error: null,
    });
  },

  loadUser: async () => {
    const savedDemo = await cacheGet<boolean>(CACHE_KEYS.DEMO_MODE);
    if (savedDemo === true) {
      const cachedDemoUser = await cacheGet<AuthUser>(CACHE_KEYS.USER_PROFILE);
      set({
        user: cachedDemoUser || DEMO_USER,
        isAuthenticated: true,
        isDemoMode: true,
        isOffline: false,
        isHydrated: true,
      });
      return;
    }

    // Step 1: Immediate hydration from cached real session
    let cachedUser: AuthUser | null = null;
    let token: string | null = null;
    try {
      token = await tokenStorage.get('access_token');
      cachedUser = await cacheGet<AuthUser>(CACHE_KEYS.USER_PROFILE);
      if (cachedUser && token) {
        set({ user: cachedUser, isAuthenticated: true, isOffline: false, isDemoMode: false });
      }
    } catch {
      // Ignore initial cache read error
    }

    if (!token) {
      set({ user: null, isAuthenticated: false, isHydrated: true, isDemoMode: false });
      return;
    }

    // Step 2: Background revalidation
    try {
      const { data } = await authApi.getMe();
      const freshUser = data?.data?.user;
      if (freshUser) {
        await cacheSet(CACHE_KEYS.USER_PROFILE, freshUser);
        set({ user: freshUser, isAuthenticated: true, isOffline: false, isHydrated: true });
      } else {
        set({ isHydrated: true });
      }
    } catch (err: unknown) {
      const classified = classifyApiError(err);
      if (classified.kind === 'session-expired' || classified.kind === 'restricted') {
        await tokenStorage.remove('access_token');
        await tokenStorage.remove('refresh_token');
        set({ user: null, isAuthenticated: false, isOffline: false, isHydrated: true });
      } else if (cachedUser) {
        // Retain cached user profile so offline QR gate passes remain accessible
        set({ isOffline: true, isHydrated: true });
      } else {
        set({ user: null, isAuthenticated: false, isOffline: true, isHydrated: true });
      }
    }
  },

  setOfflineStatus: (offline: boolean) => set({ isOffline: offline }),

  clearError: () => set({ error: null }),
}));
