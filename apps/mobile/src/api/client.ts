// ============================================================
// Parkly Mobile — API Client
// Centralized Axios instance with auth token injection & refresh.
// ============================================================

import axios from 'axios';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';

export function resolveBaseUrl(): string {
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

export const tokenStorage = {
  async get(key: string): Promise<string | null> {
    if (Platform.OS === 'web') {
      return AsyncStorage.getItem(`@parkly_sec/${key}`);
    }
    try {
      return await SecureStore.getItemAsync(key);
    } catch {
      return null;
    }
  },
  async set(key: string, value: string): Promise<void> {
    if (Platform.OS === 'web') {
      await AsyncStorage.setItem(`@parkly_sec/${key}`, value);
      return;
    }
    try {
      await SecureStore.setItemAsync(key, value);
    } catch {
      // Ignore secure store errors on unsupported runtimes
    }
  },
  async remove(key: string): Promise<void> {
    if (Platform.OS === 'web') {
      await AsyncStorage.removeItem(`@parkly_sec/${key}`);
      return;
    }
    try {
      await SecureStore.deleteItemAsync(key);
    } catch {
      // Ignore cleanup errors
    }
  },
};

export const api = axios.create({
  baseURL: BASE_URL,
  timeout: 10000,
  headers: { 'Content-Type': 'application/json' },
});

// Inject JWT on every request
api.interceptors.request.use(async (config) => {
  const token = await tokenStorage.get('access_token');
  if (token) {
    config.headers['Authorization'] = `Bearer ${token}`;
  }
  return config;
});

// Handle token refresh on 401
api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config as
      | (typeof error.config & { _retry?: boolean; url?: string })
      | undefined;
    if (
      error.response?.status === 401 &&
      original &&
      !original._retry &&
      !original.url?.includes('/auth/refresh')
    ) {
      original._retry = true;
      try {
        const refreshToken = await tokenStorage.get('refresh_token');
        if (!refreshToken) {
          throw new Error('No refresh token available');
        }
        const { data } = await axios.post(`${BASE_URL}/auth/refresh`, { refreshToken });
        const newAccessToken = data?.data?.tokens?.accessToken;
        const newRefreshToken = data?.data?.tokens?.refreshToken;
        if (!newAccessToken) {
          throw new Error('Invalid refresh response');
        }
        await tokenStorage.set('access_token', newAccessToken);
        if (newRefreshToken) {
          await tokenStorage.set('refresh_token', newRefreshToken);
        }
        original.headers['Authorization'] = `Bearer ${newAccessToken}`;
        return api(original);
      } catch {
        await tokenStorage.remove('access_token');
        await tokenStorage.remove('refresh_token');
      }
    }
    return Promise.reject(error);
  },
);

// ============================================================
// API Functions
// ============================================================

export type VehiclePayloadType = 'motorcycle' | 'compact' | 'sedan' | 'suv' | 'van' | 'truck';
export type SpaceType = 'commercial' | 'private_house' | 'apartment_bay' | 'gated_compound';
export type GovIdType = 'aadhaar' | 'pan' | 'passport' | 'voter_id';
export type OwnershipProofType =
  | 'property_tax'
  | 'electricity_bill'
  | 'sale_deed'
  | 'noc_society'
  | 'rental_agreement';
export type KycVerificationStatus = 'pending' | 'approved' | 'rejected';

export interface NotificationPreferencesPayload {
  bookingReminders: boolean;
  gateAlerts: boolean;
  paymentReceipts: boolean;
  promoOffers: boolean;
}

export interface CreateHostSpacePayload {
  name: string;
  description?: string;
  spaceType: SpaceType;
  entryInstructions?: string;
  latitude: number;
  longitude: number;
  address: string;
  city: string;
  state: string;
  pincode: string;
  totalCapacity: number;
  vehicleTypes: VehiclePayloadType[];
  evCharging: boolean;
  covered: boolean;
  securityLevel: 'none' | 'basic' | 'monitored' | 'staffed' | 'gated';
  hourlyRate: number;
  photoUrls?: string[];
  ownershipProofUrl?: string;
}

export interface DriverKycPayload {
  fullName: string;
  dateOfBirth?: string;
  address?: string;
  emergencyContact?: string;
  drivingLicenseNumber: string;
  drivingLicenseExpiry?: string;
  drivingLicenseFrontUrl: string;
  drivingLicenseBackUrl?: string;
  govIdType: GovIdType;
  govIdNumberMasked: string;
  govIdDocumentUrl: string;
  vehiclePlate: string;
  rcNumber: string;
  rcDocumentUrl: string;
  insuranceDocumentUrl?: string;
  selfieUrl?: string;
}

export interface HostKycPayload {
  kycFullName: string;
  kycPhone?: string;
  businessName?: string;
  panNumber?: string;
  govIdType: GovIdType;
  govIdNumberMasked: string;
  govIdDocumentUrl: string;
  ownershipProofType: OwnershipProofType;
  ownershipDocumentUrl: string;
  addressProofUrl?: string;
  plotPhotoUrls: string[];
  bankAccountNumber?: string;
  ifscCode?: string;
  upiId?: string;
  kycNotes?: string;
}

export const authApi = {
  requestOtp: (phone: string) => api.post('/auth/otp/request', { phone }),
  verifyOtp: (phone: string, otp: string, name?: string) =>
    api.post('/auth/otp/verify', { phone, otp, name }),
  getMe: () => api.get('/auth/me'),
  updateMe: (payload: { name?: string; email?: string | null }) =>
    api.patch('/auth/me', payload),
  refresh: (refreshToken: string) => api.post('/auth/refresh', { refreshToken }),
  listVehicles: () => api.get('/auth/vehicles'),
  createVehicle: (payload: {
    licensePlate: string;
    vehicleType: VehiclePayloadType;
    make?: string;
    model?: string;
    color?: string;
    rcNumber?: string;
    rcDocumentUrl?: string;
    insuranceNumber?: string;
    isDefault?: boolean;
  }) => api.post('/auth/vehicles', payload),
  setDefaultVehicle: (id: string) => api.put(`/auth/vehicles/${id}/default`),
  deleteVehicle: (id: string) => api.delete(`/auth/vehicles/${id}`),
  becomeHost: (payload?: { businessName?: string; bankAccount?: string; ifscCode?: string }) =>
    api.post('/auth/become-host', payload || {}),
  getDriverKyc: () => api.get('/auth/driver-kyc'),
  submitDriverKyc: (payload: DriverKycPayload) => api.put('/auth/driver-kyc', payload),
};

export const hostApi = {
  listMySpaces: () => api.get('/host/listings'),
  createSpace: (payload: CreateHostSpacePayload) => api.post('/host/listings', payload),
  updateSpace: (id: string, payload: Partial<CreateHostSpacePayload> & { status?: 'active' | 'inactive' }) =>
    api.patch(`/host/listings/${id}`, payload),
  getRevenue: () => api.get('/host/revenue'),
  getKyc: () => api.get('/host/kyc'),
  submitKyc: (payload: HostKycPayload) => api.put('/host/kyc', payload),
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
    hostId?: string;
    type: string;
    startTime: string;
    endTime: string;
    totalAmount?: number;
  }) => api.post('/bookings', data),
  list: (status?: string) => api.get('/bookings', { params: { status } }),
  get: (id: string) => api.get(`/bookings/${id}`),
  checkIn: (id: string, gateCode?: string) =>
    api.post(`/bookings/${id}/check-in`, gateCode ? { gateCode } : {}),
  checkOut: (id: string) => api.post(`/bookings/${id}/check-out`, {}),
  notifyLeaving: (id: string) => api.post(`/bookings/${id}/leaving-soon`, {}),
  extend: (id: string, hours = 1) => api.put(`/bookings/${id}/extend`, { hours }),
  cancel: (id: string, reason?: string) => api.put(`/bookings/${id}/cancel`, { reason }),
};

export const paymentApi = {
  initiate: (bookingId: string, amount?: number) =>
    api.post('/payments/initiate', { bookingId, ...(amount ? { amount } : {}) }),
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
  getPreferences: () => api.get('/notifications/preferences'),
  updatePreferences: (prefs: NotificationPreferencesPayload) =>
    api.put('/notifications/preferences', prefs),
};

export default api;
