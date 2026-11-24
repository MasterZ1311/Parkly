// ============================================================
// Admin Portal — API Client
// Centralized Axios instance with JWT auth injection
// ============================================================

import axios, { AxiosInstance, AxiosError } from 'axios';

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000/api/v1';

export const apiClient: AxiosInstance = axios.create({
  baseURL: BASE_URL,
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
  },
});

apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('authToken');
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('authToken');
      localStorage.removeItem('user');
    }
    return Promise.reject(error);
  }
);

export const adminApi = {
  // Metrics & Stats
  getMetrics: () => apiClient.get('/admin/metrics'),
  getOverview: () => apiClient.get('/admin/metrics'),

  // Users
  getUsers: (params?: { page?: number; pageSize?: number; role?: string }) =>
    apiClient.get('/admin/users', { params }),
  updateUserRole: (userId: string, role: string) =>
    apiClient.put(`/admin/users/${userId}/role`, { role }),
  suspendUser: (userId: string, reason?: string) =>
    apiClient.put(`/admin/users/${userId}/suspend`, { reason }),

  // Bookings
  getBookings: (params?: { page?: number; pageSize?: number; status?: string }) =>
    apiClient.get('/admin/bookings', { params }),

  // Verifications
  getVerifications: () => apiClient.get('/admin/verifications'),
  approveVerification: (spaceId: string) =>
    apiClient.post(`/admin/verifications/${spaceId}/approve`),
  rejectVerification: (spaceId: string, reason?: string) =>
    apiClient.post(`/admin/verifications/${spaceId}/reject`, { reason }),

  // Autonomous Dispute Mediation (DisputeMediationAgent)
  getDisputes: () => apiClient.get('/admin/disputes'),
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

  // Alerts & Audit Logs
  getAlerts: () => apiClient.get('/admin/alerts'),
  getAuditLogs: () => apiClient.get('/admin/audit-logs'),
};
