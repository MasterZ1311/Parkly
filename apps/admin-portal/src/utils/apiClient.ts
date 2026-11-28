// ============================================================
// Admin Portal — Unified API Client
// Strict real API by default; Demo Mode is strictly opt-in.
// ============================================================

import axios, { AxiosInstance, AxiosError, InternalAxiosRequestConfig } from 'axios';
import { adminMockAdapter } from './mockAdapter';

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000/api/v1';
const DEMO_STORAGE_KEY = 'parkly_admin_demo_mode';

export function isDemoModeEnabled(): boolean {
  if (import.meta.env.VITE_DEMO_MODE === 'true') return true;
  try {
    return localStorage.getItem(DEMO_STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
}

export let USE_MOCK_DATA = isDemoModeEnabled();
export let IS_DEMO_MODE = USE_MOCK_DATA;

export function setDemoModeEnabled(enabled: boolean): void {
  try {
    localStorage.setItem(DEMO_STORAGE_KEY, enabled ? 'true' : 'false');
  } catch {
    // Ignore storage errors in restricted environments
  }
  USE_MOCK_DATA = enabled;
  IS_DEMO_MODE = enabled;
}

const defaultAdapter = axios.defaults.adapter;

export const apiClient: AxiosInstance = axios.create({
  baseURL: BASE_URL,
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
  },
  adapter: (config) => {
    if (isDemoModeEnabled()) {
      return adminMockAdapter(config);
    }
    const resolved = axios.getAdapter(defaultAdapter);
    return resolved(config);
  },
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
      if (refreshToken && !isDemoModeEnabled()) {
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
          // Fall through to logout
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
  USE_MOCK_DATA = isDemoModeEnabled();
  IS_DEMO_MODE = USE_MOCK_DATA;
  return apiClient;
}

export const commonApi = {
  requestOtp: (phone: string) => apiClient.post('/auth/otp/request', { phone }),
  loginOtp: (phone: string) => apiClient.post('/auth/otp/request', { phone }),
  verifyOtp: (phone: string, otp: string, name?: string) =>
    apiClient.post('/auth/otp/verify', { phone, otp, name }),
  logout: () => apiClient.post('/auth/logout').catch(() => undefined),
  getProfile: () => apiClient.get('/auth/profile'),
  updateProfile: (data: { name?: string; email?: string }) =>
    apiClient.patch('/auth/profile', data),
};

export const adminApi = {
  // Metrics & Stats
  getMetrics: () => apiClient.get('/admin/metrics'),
  getOverview: () => apiClient.get('/admin/metrics'),
  getRevenue: () => apiClient.get('/admin/revenue'),

  // Users
  getUsers: (params?: { page?: number; pageSize?: number; role?: string; search?: string }) =>
    apiClient.get('/admin/users', { params }),
  updateUserRole: (userId: string, role: string) =>
    apiClient.put(`/admin/users/${userId}/role`, { role }),
  suspendUser: (userId: string, reason?: string) =>
    apiClient.put(`/admin/users/${userId}/suspend`, { reason }),
  unsuspendUser: (userId: string) =>
    apiClient.put(`/admin/users/${userId}/unsuspend`),
  anonymizeUser: (userId: string) =>
    apiClient.post(`/admin/users/${userId}/anonymize`),

  // Bookings
  getBookings: (params?: { page?: number; pageSize?: number; status?: string; search?: string }) =>
    apiClient.get('/admin/bookings', { params }),

  // Verifications (Spaces & Plot Locations, Driver KYC, Host KYC)
  getVerifications: () => apiClient.get('/admin/verifications'),
  approveVerification: (spaceId: string, notes?: string) =>
    apiClient.post(`/admin/verifications/${spaceId}/approve`, { notes }),
  rejectVerification: (spaceId: string, reason?: string) =>
    apiClient.post(`/admin/verifications/${spaceId}/reject`, { reason }),
  approveDriverKyc: (kycId: string, notes?: string) =>
    apiClient.post(`/admin/verifications/drivers/${kycId}/approve`, { notes }),
  rejectDriverKyc: (kycId: string, reason?: string) =>
    apiClient.post(`/admin/verifications/drivers/${kycId}/reject`, { reason }),
  approveHostKyc: (hostId: string, notes?: string) =>
    apiClient.post(`/admin/verifications/hosts/${hostId}/approve`, { notes }),
  rejectHostKyc: (hostId: string, reason?: string) =>
    apiClient.post(`/admin/verifications/hosts/${hostId}/reject`, { reason }),

  // Autonomous Dispute Mediation (DisputeMediationAgent)
  getDisputes: (status?: string) => apiClient.get('/admin/disputes', { params: { status } }),
  mediateDispute: (disputeId: string, data: { bookingId: string; incidentType: string; evidence?: unknown }) =>
    apiClient.post(`/admin/disputes/${disputeId}/mediate`, data),

  // City-Scale Mobility & Carbon Analytics (CityAnalyticsAgent)
  getCityAnalytics: (params: { cityId?: string; period?: string; zones?: string[] }) =>
    apiClient.get('/admin/analytics/city', {
      params: {
        cityId: params.cityId || 'chennai',
        period: params.period || '2026-W36',
        zones: (params.zones || ['t-nagar', 'anna-nagar', 'omr']).join(','),
      },
    }),

  // Alerts, Audit Logs & Settings
  getAlerts: () => apiClient.get('/admin/alerts'),
  resolveAlert: (id: string) => apiClient.put(`/admin/alerts/${id}/resolve`),
  dismissAlert: (id: string) => apiClient.delete(`/admin/alerts/${id}`),
  getAuditLogs: (action?: string) => apiClient.get('/admin/audit-logs', { params: { action } }),
  getSettings: () => apiClient.get('/admin/settings'),
  updateSettings: (settings: Record<string, string | boolean | number>) =>
    apiClient.put('/admin/settings', { settings }),
};
