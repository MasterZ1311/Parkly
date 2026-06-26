import axios, { AxiosInstance, AxiosError } from 'axios';

let apiInstance: AxiosInstance | null = null;

export interface ApiConfig {
  baseURL?: string;
  timeout?: number;
}

export function initializeApiClient(config: ApiConfig = {}) {
  const baseURL = config.baseURL || process.env.REACT_APP_API_URL || 'http://localhost:4000/api/v1';
  const timeout = config.timeout || 30000;

  apiInstance = axios.create({
    baseURL,
    timeout,
    headers: {
      'Content-Type': 'application/json',
    },
  });

  apiInstance.interceptors.request.use((config) => {
    const token = localStorage.getItem('authToken');
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  });

  apiInstance.interceptors.response.use(
    (response) => response,
    (error: AxiosError) => {
      if (error.response?.status === 401) {
        localStorage.removeItem('authToken');
        window.location.href = '/login';
      }
      return Promise.reject(error);
    }
  );

  return apiInstance;
}

export function getApiClient(): AxiosInstance {
  if (!apiInstance) {
    initializeApiClient();
  }
  return apiInstance!;
}

export const adminApi = {
  getStats: () => getApiClient().get('/admin/stats'),
  getUsers: () => getApiClient().get('/admin/users'),
  getUserDetail: (userId: string) => getApiClient().get(`/admin/users/${userId}`),
  suspendUser: (userId: string, reason: string) =>
    getApiClient().post(`/admin/users/${userId}/suspend`, { reason }),
  unsuspendUser: (userId: string) =>
    getApiClient().post(`/admin/users/${userId}/unsuspend`),
  getBookings: (filters?: any) => getApiClient().get('/admin/bookings', { params: filters }),
  getBookingDetail: (bookingId: string) => getApiClient().get(`/admin/bookings/${bookingId}`),
  getVerifications: () => getApiClient().get('/admin/verifications'),
  approveVerification: (hostId: string, spaceId: string) =>
    getApiClient().post(`/admin/verifications/${hostId}/${spaceId}/approve`),
  rejectVerification: (hostId: string, spaceId: string, reason: string) =>
    getApiClient().post(`/admin/verifications/${hostId}/${spaceId}/reject`, { reason }),
  requestVerificationInfo: (hostId: string, spaceId: string, fields: string[]) =>
    getApiClient().post(`/admin/verifications/${hostId}/${spaceId}/request-info`, { fields }),
};

export const commonApi = {
  loginOtp: (phone: string) => getApiClient().post('/auth/otp/request', { phone }),
  verifyOtp: (phone: string, otp: string) => getApiClient().post('/auth/otp/verify', { phone, otp }),
  logout: () => {
    localStorage.removeItem('authToken');
    localStorage.removeItem('user');
    return Promise.resolve();
  },
  getProfile: () => getApiClient().get('/auth/profile'),
  updateProfile: (data: any) => getApiClient().patch('/auth/profile', data),
};
