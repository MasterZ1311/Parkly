// ============================================================
// Parkly Mobile — Auth Store (Zustand)
// ============================================================

import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';
import { authApi } from '../api/client';

interface AuthUser {
  id: string;
  name: string;
  phone: string;
  role: 'driver' | 'host' | 'admin';
}

interface AuthState {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;

  requestOtp: (phone: string) => Promise<void>;
  verifyOtp: (phone: string, otp: string, name?: string) => Promise<void>;
  logout: () => Promise<void>;
  loadUser: () => Promise<void>;
  clearError: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isAuthenticated: false,
  isLoading: false,
  error: null,

  requestOtp: async (phone: string) => {
    set({ isLoading: true, error: null });
    try {
      await authApi.requestOtp(phone);
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

      set({ user, isAuthenticated: true, isLoading: false });
    } catch (err: unknown) {
      const message = (err as { response?: { data?: { error?: { message?: string } } } })
        ?.response?.data?.error?.message || 'Invalid OTP';
      set({ error: message, isLoading: false });
      throw err;
    }
  },

  logout: async () => {
    await SecureStore.deleteItemAsync('access_token');
    await SecureStore.deleteItemAsync('refresh_token');
    set({ user: null, isAuthenticated: false });
  },

  loadUser: async () => {
    try {
      const token = await SecureStore.getItemAsync('access_token');
      if (!token) return;

      const { data } = await authApi.getMe();
      set({ user: data.data.user, isAuthenticated: true });
    } catch {
      set({ user: null, isAuthenticated: false });
    }
  },

  clearError: () => set({ error: null }),
}));
