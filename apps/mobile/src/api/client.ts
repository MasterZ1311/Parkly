// ============================================================
// Parkly Mobile — API Client
// Centralized Axios instance with auth token injection.
// ============================================================

import axios from 'axios';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { mobileMockAdapter } from './mockAdapter';

function resolveBaseUrl(): string {
  const configured = process.env['EXPO_PUBLIC_API_URL'];
  if (configured && configured.trim().length > 0) {
    return configured.trim();
  }

  const hostUri = Constants.expoConfig?.hostUri;
  if (hostUri) {
    const host = hostUri.split(':')[0];
    if (host && host !== '127.0.0.1' && host !== 'localhost') {
      return `http://${host}:4000/api/v1`;
    }
  }

  if (Platform.OS === 'android') {
    return 'http://10.0.2.2:4000/api/v1';
  }
  return 'http://localhost:4000/api/v1';
}

export const BASE_URL = resolveBaseUrl();
export const USE_MOCK_DATA = process.env['EXPO_PUBLIC_LIVE_API'] !== 'true';
export const IS_DEMO_MODE = USE_MOCK_DATA;

export const api = axios.create({
  baseURL: BASE_URL,
  timeout: 10000,
  headers: { 'Content-Type': 'application/json' },
  ...(USE_MOCK_DATA ? { adapter: mobileMockAdapter } : {}),
});

// Inject JWT on every request
api.interceptors.request.use(async (config) => {
  try {
    const token = await SecureStore.getItemAsync('access_token');
    if (token) {
      config.headers['Authorization'] = `Bearer ${token}`;
    }
  } catch {
    // Silently fail if SecureStore is not available
  }
  return config;
});

// Handle token refresh on 401
api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config;
    if (error.response?.status === 401 && !original._retry) {
      original._retry = true;
      try {
        const refreshToken = await SecureStore.getItemAsync('refresh_token');
        const { data } = await axios.post(`${BASE_URL}/auth/refresh`, { refreshToken });
        const newToken = data.data.tokens.accessToken;
        await SecureStore.setItemAsync('access_token', newToken);
        original.headers['Authorization'] = `Bearer ${newToken}`;
        return api(original);
      } catch {
        try {
          await SecureStore.deleteItemAsync('access_token');
          await SecureStore.deleteItemAsync('refresh_token');
        } catch {
          // Silently fail if cleanup fails
        }
      }
    }
    return Promise.reject(error);
  },
);

// ============================================================
// API Functions
// ============================================================

export const authApi = {
  requestOtp: (phone: string) => api.post('/auth/otp/request', { phone }),
  verifyOtp: (phone: string, otp: string, name?: string) =>
    api.post('/auth/otp/verify', { phone, otp, name }),
  getMe: () => api.get('/auth/me'),
  getProfile: () => api.get('/auth/profile'),
  updateProfile: (data: { name?: string; email?: string }) => api.patch('/auth/profile', data),
  listVehicles: () => api.get('/auth/vehicles'),
  addVehicle: (data: { licensePlate: string; vehicleType: string; make?: string; model?: string; color?: string; isDefault?: boolean }) =>
    api.post('/auth/vehicles', data),
  deleteVehicle: (vehicleId: string) => api.delete(`/auth/vehicles/${vehicleId}`),
  refresh: (refreshToken: string) => api.post('/auth/refresh', { refreshToken }),
};

export const searchApi = {
  search: (query: {
    location: { type: string; lat?: number; lng?: number; value?: string };
    arrivalTime: string;
    duration?: number;
    radius?: number;
    filters?: Record<string, unknown>;
    page?: number;
    pageSize?: number;
  }) => api.post('/search', query),
  getSpace: (id: string) => api.get(`/search/spaces/${id}`),
};

export const bookingApi = {
  create: (data: {
    spaceId: string;
    vehicleId: string;
    hostId: string;
    type: string;
    startTime: string;
    endTime: string;
    totalAmount: number;
  }) => api.post('/bookings', data),
  list: (status?: string) => api.get('/bookings', { params: { status } }),
  get: (id: string) => api.get(`/bookings/${id}`),
  extend: (id: string, additionalMinutes: number) =>
    api.put(`/bookings/${id}/extend`, { additionalMinutes }),
  verifyQr: (qrToken: string) => api.get('/bookings/verify-qr', { params: { qrToken } }),
  cancel: (id: string, reason?: string) => api.put(`/bookings/${id}/cancel`, { reason }),
};

export const paymentApi = {
  initiate: (bookingId: string, amount: number) =>
    api.post('/payments/initiate', { bookingId, amount }),
  confirm: (paymentId: string, providerPaymentId: string, signature: string) =>
    api.put(`/payments/${paymentId}/confirm`, { providerPaymentId, signature }),
};

export const pricingApi = {
  getPrice: (spaceId: string, arrivalTime: string) =>
    api.get(`/pricing/${spaceId}`, { params: { arrivalTime } }),
};

export const conciergeApi = {
  ask: (query: string, currentLocation?: { latitude: number; longitude: number }, driverId?: string) =>
    api.post('/concierge', { query, currentLocation, driverId }),
};

export const notificationApi = {
  list: () => api.get('/notifications'),
  markRead: (id: string) => api.put(`/notifications/${id}/read`),
  registerDevice: (token: string, platform: string = 'expo') =>
    api.post('/notifications/devices', { token, platform }),
};

