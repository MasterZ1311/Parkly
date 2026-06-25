// ============================================================
// Parkly Mobile — API Client
// Centralized Axios instance with auth token injection.
// ============================================================

import axios from 'axios';
import * as SecureStore from 'expo-secure-store';

const BASE_URL = process.env['EXPO_PUBLIC_API_URL'] || 'http://localhost:4000/api/v1';

export const api = axios.create({
  baseURL: BASE_URL,
  timeout: 10000,
  headers: { 'Content-Type': 'application/json' },
});

// Inject JWT on every request
api.interceptors.request.use(async (config) => {
  const token = await SecureStore.getItemAsync('access_token');
  if (token) {
    config.headers['Authorization'] = `Bearer ${token}`;
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
        await SecureStore.deleteItemAsync('access_token');
        await SecureStore.deleteItemAsync('refresh_token');
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

export const notificationApi = {
  list: () => api.get('/notifications'),
  markRead: (id: string) => api.put(`/notifications/${id}/read`),
};
