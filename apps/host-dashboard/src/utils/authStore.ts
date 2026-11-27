import { create } from 'zustand';
import { commonApi } from './apiClient';

export interface User {
  id: string;
  phone: string;
  role: 'driver' | 'host' | 'admin' | 'government';
  email?: string;
  name?: string;
  verified?: boolean;
}

export interface AuthStore {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  error: string | null;
  requestOtp: (phone: string) => Promise<{ devOtp?: string }>;
  login: (phone: string, otp: string, name?: string) => Promise<void>;
  logout: () => Promise<void>;
  setUser: (user: User | null) => void;
  setToken: (token: string | null) => void;
  clearError: () => void;
  loadUserFromStorage: () => void;
}

export const useAuthStore = create<AuthStore>((set) => ({
  user: null,
  token: null,
  isLoading: false,
  error: null,

  requestOtp: async (phone: string) => {
    set({ isLoading: true, error: null });
    try {
      const response = await commonApi.requestOtp(phone);
      set({ isLoading: false });
      return { devOtp: response.data?.data?.devOtp };
    } catch (err: any) {
      const message =
        err.response?.data?.error?.message || err.response?.data?.message || 'Failed to send OTP';
      set({ error: message, isLoading: false });
      throw err;
    }
  },

  login: async (phone: string, otp: string, name?: string) => {
    set({ isLoading: true, error: null });
    try {
      const response = await commonApi.verifyOtp(phone, otp, name);
      const payload = response.data?.data;
      const user: User | undefined = payload?.user;
      const accessToken: string | undefined = payload?.tokens?.accessToken;
      const refreshToken: string | undefined = payload?.tokens?.refreshToken;

      if (!user || !accessToken) {
        throw new Error('Authentication response missing session tokens');
      }

      if (user.role !== 'host' && user.role !== 'admin') {
        throw new Error('This account does not have Host or Admin portal permissions.');
      }

      localStorage.setItem('authToken', accessToken);
      if (refreshToken) {
        localStorage.setItem('refreshToken', refreshToken);
      }
      localStorage.setItem('user', JSON.stringify(user));
      set({ user, token: accessToken, isLoading: false });
    } catch (err: any) {
      const message =
        err.response?.data?.error?.message || err.response?.data?.message || err.message || 'Login failed';
      set({ error: message, isLoading: false });
      throw err;
    }
  },

  logout: async () => {
    await commonApi.logout();
    localStorage.removeItem('authToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('user');
    set({ user: null, token: null });
  },

  setUser: (user) => {
    if (user) {
      localStorage.setItem('user', JSON.stringify(user));
    }
    set({ user });
  },
  setToken: (token) => set({ token }),
  clearError: () => set({ error: null }),

  loadUserFromStorage: () => {
    const token = localStorage.getItem('authToken');
    const userJson = localStorage.getItem('user');
    if (token && userJson) {
      try {
        const user = JSON.parse(userJson);
        set({ user, token });
      } catch {
        localStorage.removeItem('authToken');
        localStorage.removeItem('refreshToken');
        localStorage.removeItem('user');
      }
    }
  },
}));

export function useIsAuthenticated() {
  const { user, token } = useAuthStore();
  return !!(user && token);
}
