// ============================================================
// Host Dashboard — Unified API Client
// ============================================================

import axios, { AxiosInstance, AxiosError, InternalAxiosRequestConfig } from 'axios';
import { hostMockAdapter } from './mockAdapter';

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000/api/v1';

export const USE_MOCK_DATA = import.meta.env.VITE_LIVE_API !== 'true';
export const IS_DEMO_MODE = USE_MOCK_DATA;

export const apiClient: AxiosInstance = axios.create({
  baseURL: BASE_URL,
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
  },
  ...(USE_MOCK_DATA ? { adapter: hostMockAdapter } : {}),
});

interface RetryConfig extends InternalAxiosRequestConfig {
  _retry?: boolean;
}

apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('authToken');
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const original = error.config as RetryConfig | undefined;
    if (error.response?.status === 401 && original && !original._retry) {
      original._retry = true;
      const refreshToken = localStorage.getItem('refreshToken');
      if (refreshToken) {
        try {
          const { data } = await axios.post(`${BASE_URL}/auth/refresh`, { refreshToken });
          const tokens = data?.data?.tokens;
          if (tokens?.accessToken) {
            localStorage.setItem('authToken', tokens.accessToken);
            if (tokens.refreshToken) {
              localStorage.setItem('refreshToken', tokens.refreshToken);
            }
            original.headers.Authorization = `Bearer ${tokens.accessToken}`;
            return apiClient(original);
          }
        } catch {
          // Fall through to session clear
        }
      }

      localStorage.removeItem('authToken');
      localStorage.removeItem('refreshToken');
      localStorage.removeItem('user');
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  },
);

export function initializeApiClient(): AxiosInstance {
  return apiClient;
}

export interface ListingPayload {
  name: string;
  description?: string;
  latitude: number;
  longitude: number;
  address: string;
  city: string;
  state: string;
  pincode: string;
  totalCapacity: number;
  vehicleTypes: string[];
  hourlyRate: number;
  evCharging?: boolean;
  covered?: boolean;
}

export const commonApi = {
  requestOtp: (phone: string) => apiClient.post('/auth/otp/request', { phone }),
  verifyOtp: (phone: string, otp: string, name?: string) =>
    apiClient.post('/auth/otp/verify', { phone, otp, name }),
  logout: () => apiClient.post('/auth/logout').catch(() => undefined),
  getProfile: () => apiClient.get('/auth/profile'),
  updateProfile: (data: { name?: string; email?: string; bankAccount?: string; ifscCode?: string }) =>
    apiClient.patch('/auth/profile', data),
};

export const hostApi = {
  // Listings
  getListings: () => apiClient.get('/host/listings'),
  createListing: (data: ListingPayload) => apiClient.post('/host/listings', data),
  updateListing: (spaceId: string, data: Partial<ListingPayload>) =>
    apiClient.patch(`/host/listings/${spaceId}`, data),
  deleteListing: (spaceId: string) => apiClient.delete(`/host/listings/${spaceId}`),
  getUploadUrl: (spaceId: string, filename: string) =>
    apiClient.post(`/host/listings/${spaceId}/upload-url`, { filename }),

  // AI Verification trigger
  aiVerify: (spaceId: string, payload?: { documentUrls?: string[]; photoUrls?: string[] }) =>
    apiClient.post(`/host/listings/${spaceId}/ai-verify`, payload || {}),

  // Host Bookings & Live Occupancy
  getBookings: (status?: string) => apiClient.get('/host/bookings', { params: { status } }),
  getOccupancy: (spaceId: string) => apiClient.get(`/occupancy/current/${spaceId}`),

  // Host Revenue & Payouts
  getRevenue: () => apiClient.get('/host/revenue'),
  requestPayout: (data: { amount: number }) => apiClient.post('/host/payouts', data),
  getPayouts: () => apiClient.get('/host/payouts'),
};
