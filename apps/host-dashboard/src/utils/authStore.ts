import { create } from 'zustand';
import { commonApi } from './api';

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
  login: (phone: string, otp: string) => Promise<void>;
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

  login: async (phone: string, otp: string) => {
    set({ isLoading: true, error: null });
    try {
      const response = await commonApi.verifyOtp(phone, otp);
      const { token, user } = response.data;
      localStorage.setItem('authToken', token);
      localStorage.setItem('user', JSON.stringify(user));
      set({ user, token, isLoading: false });
    } catch (err: any) {
      const message = err.response?.data?.message || 'Login failed';
      set({ error: message, isLoading: false });
      throw err;
    }
  },

  logout: async () => {
    await commonApi.logout();
    localStorage.removeItem('authToken');
    localStorage.removeItem('user');
    set({ user: null, token: null });
  },

  setUser: (user) => set({ user }),
  setToken: (token) => set({ token }),
  clearError: () => set({ error: null }),

  loadUserFromStorage: () => {
    const token = localStorage.getItem('authToken');
    const userJson = localStorage.getItem('user');
    if (token && userJson) {
      try {
        const user = JSON.parse(userJson);
        set({ user, token });
      } catch (e) {
        localStorage.removeItem('authToken');
        localStorage.removeItem('user');
      }
    }
  },
}));

export function useIsAuthenticated() {
  const { user } = useAuthStore();
  return !!user;
}

export function useUserRole() {
  const { user } = useAuthStore();
  return user?.role || null;
}
