// ============================================================
// Host Dashboard — API Client
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

// Inject auth token from localStorage
apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('authToken');
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle 401s
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

export const hostApi = {
  // Listings
  getListings: () => apiClient.get('/host/listings'),
  createListing: (data: ListingPayload) => apiClient.post('/host/listings', data),
  getUploadUrl: (spaceId: string, filename: string) =>
    apiClient.post(`/host/listings/${spaceId}/upload-url`, { filename }),
  
  // AI Verification trigger (Runs HostOnboardingAgent & VisualInspectionAgent)
  aiVerify: (spaceId: string, payload?: { documentUrls?: string[]; photoUrls?: string[] }) =>
    apiClient.post(`/host/listings/${spaceId}/ai-verify`, payload || {}),

  // Bookings & Occupancy
  getBookings: (status?: string) => apiClient.get('/bookings', { params: { status } }),
  getOccupancy: (spaceId: string) => apiClient.get(`/occupancy/current/${spaceId}`),

  // Revenue & Payouts
  getRevenue: () => apiClient.get('/admin/revenue'),
  requestPayout: (data: any) => apiClient.post('/host/payouts', data),
  getPayouts: () => apiClient.get('/host/payouts'),
};
