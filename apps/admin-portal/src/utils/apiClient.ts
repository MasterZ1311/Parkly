// ============================================================
// Admin Portal — Unified API Client
// ============================================================

import axios, { AxiosInstance, AxiosError, InternalAxiosRequestConfig } from 'axios';
import { adminMockAdapter } from './mockAdapter';

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000/api/v1';

export const USE_MOCK_DATA = import.meta.env.VITE_LIVE_API !== 'true';
export const IS_DEMO_MODE = USE_MOCK_DATA;

export const apiClient: AxiosInstance = axios.create({
  baseURL: BASE_URL,
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
  },
  ...(USE_MOCK_DATA ? { adapter: adminMockAdapter } : {}),
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
  return apiClient;
}

export const commonApi = {
  requestOtp: (phone: string) => apiClient.post('/auth/otp/request', { phone }),
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

  // Verifications
  getVerifications: () => apiClient.get('/admin/verifications'),
  approveVerification: (spaceId: string) =>
    apiClient.post(`/admin/verifications/${spaceId}/approve`),
  rejectVerification: (spaceId: string, reason?: string) =>
    apiClient.post(`/admin/verifications/${spaceId}/reject`, { reason }),

  // Autonomous Dispute Mediation (DisputeMediationAgent)
  getDisputes: (status?: string) => apiClient.get('/admin/disputes', { params: { status } }),
  mediateDispute: (disputeId: string, data: { bookingId: string; incidentType: string; evidence?: any }) =>
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
