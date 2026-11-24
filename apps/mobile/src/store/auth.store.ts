// ============================================================
// Parkly Mobile — Auth Store (Zustand)
// ============================================================

import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';
import { authApi, notificationApi } from '../api/client';
import { cacheGet, cacheSet, cacheRemove, CACHE_KEYS } from '../utils/cache';

export interface AuthUser {
  id: string;
  name: string;
  phone: string;
  role: 'driver' | 'host' | 'admin';
}

export interface AuthState {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  isOffline: boolean;
  error: string | null;

  requestOtp: (phone: string) => Promise<string | undefined>;
  verifyOtp: (phone: string, otp: string, name?: string) => Promise<void>;
  logout: () => Promise<void>;
  loadUser: () => Promise<void>;
  setOfflineStatus: (offline: boolean) => void;
  clearError: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isAuthenticated: false,
  isLoading: false,
  isOffline: false,
  error: null,

  requestOtp: async (phone: string) => {
    set({ isLoading: true, error: null });
    try {
      const { data } = await authApi.requestOtp(phone);
      // Dev-only: backend returns the OTP when not in production.
      return data?.data?.devOtp as string | undefined;
    } catch (err: unknown) {
      const message = (err as { response?: { data?: { error?: { message?: string } } } })
        ?.response?.data?.error?.message || 'Failed to send OTP';
      set({ error: message });
      throw err;
    } finally {
      set({ isLoading: false });
    }
  },

  verifyOtp: async (phone: string, otp: string, name?: string) => {
    set({ isLoading: true, error: null });
    try {
      const { data } = await authApi.verifyOtp(phone, otp, name);
      const { user, tokens } = data.data;

      await SecureStore.setItemAsync('access_token', tokens.accessToken);
      await SecureStore.setItemAsync('refresh_token', tokens.refreshToken);
      await cacheSet(CACHE_KEYS.USER_PROFILE, user);

      set({ user, isAuthenticated: true, isOffline: false, isLoading: false });

      // Automatically register device push token with notification-service
      try {
        const dummyExpoPushToken = `ExponentPushToken[${user.id.slice(0, 8)}-${Date.now()}]`;
        await notificationApi.registerDevice(dummyExpoPushToken, 'expo');
      } catch (pushErr) {
        console.warn('Device push registration warning:', pushErr);
      }
    } catch (err: unknown) {
      const message = (err as { response?: { data?: { error?: { message?: string } } } })
        ?.response?.data?.error?.message || 'Invalid OTP';
      set({ error: message, isLoading: false });
      throw err;
    }
  },

  logout: async () => {
    try {
      await SecureStore.deleteItemAsync('access_token');
      await SecureStore.deleteItemAsync('refresh_token');
    } catch {
      // Ignore secure store errors
    }
    await cacheRemove(CACHE_KEYS.USER_PROFILE);
    await cacheRemove(CACHE_KEYS.RECENT_BOOKINGS);
    set({ user: null, isAuthenticated: false, isOffline: false });
  },

  loadUser: async () => {
    // Step 1: Immediate hydration from cache
    let cachedUser: AuthUser | null = null;
    let token: string | null = null;
    try {
      token = await SecureStore.getItemAsync('access_token');
      cachedUser = await cacheGet<AuthUser>(CACHE_KEYS.USER_PROFILE);
      if (cachedUser && token) {
        set({ user: cachedUser, isAuthenticated: true, isOffline: false });
      }
    } catch {
      // Ignore initial cache read error
    }

    if (!token) {
      set({ user: null, isAuthenticated: false });
      return;
    }

    // Step 2: Background revalidation
    try {
      const { data } = await authApi.getMe();
      const freshUser = data?.data?.user;
      if (freshUser) {
        await cacheSet(CACHE_KEYS.USER_PROFILE, freshUser);
        set({ user: freshUser, isAuthenticated: true, isOffline: false });
      }
    } catch {
      // Retain cached user profile and mark isOffline: true if network fails
      if (cachedUser) {
        console.info('[AuthStore] Network unavailable, retaining cached user profile.');
        set({ isOffline: true });
      } else {
        set({ user: null, isAuthenticated: false });
      }
    }
  },

  setOfflineStatus: (offline: boolean) => set({ isOffline: offline }),

  clearError: () => set({ error: null }),
}));
