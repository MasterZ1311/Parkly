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

export const hostApi = {
  listListings: () => getApiClient().get('/host/spaces'),
  createListing: (data: any) => getApiClient().post('/host/spaces', data),
  updateListing: (spaceId: string, data: any) => getApiClient().patch(`/host/spaces/${spaceId}`, data),
  deleteListing: (spaceId: string) => getApiClient().delete(`/host/spaces/${spaceId}`),
  getRevenue: (timeRange?: string) => getApiClient().get('/host/revenue', { params: { timeRange } }),
  requestPayout: (data: any) => getApiClient().post('/host/payouts', data),
  getPayouts: () => getApiClient().get('/host/payouts'),
  getBookings: () => getApiClient().get('/bookings', { params: { role: 'host' } }),
  getBookingDetail: (bookingId: string) => getApiClient().get(`/bookings/${bookingId}`),
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
