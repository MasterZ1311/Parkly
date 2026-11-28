import { create } from 'zustand';
import {
  authApi,
  hostApi,
  type DriverKycPayload,
  type GovIdType,
  type HostKycPayload,
  type KycVerificationStatus,
  type OwnershipProofType,
} from '../api/client';
import { useAuthStore } from './auth.store';
import { cacheGet, cacheSet, CACHE_KEYS } from '../utils/cache';

export interface StoredDriverKyc extends DriverKycPayload {
  id: string;
  userId: string;
  status: KycVerificationStatus;
  reviewNotes?: string;
  submittedAt: string;
  updatedAt: string;
}

export interface StoredHostKyc extends HostKycPayload {
  id: string;
  userId: string;
  verificationStatus: KycVerificationStatus;
  reviewNotes?: string;
  submittedAt: string;
  updatedAt: string;
}

interface KycState {
  driverKyc: StoredDriverKyc | null;
  hostKyc: StoredHostKyc | null;
  loading: boolean;
  saving: boolean;

  loadKycs: () => Promise<void>;
  submitDriverKyc: (payload: DriverKycPayload) => Promise<StoredDriverKyc>;
  submitHostKyc: (payload: HostKycPayload) => Promise<StoredHostKyc>;
}

export function maskGovIdNumber(govIdType: GovIdType, rawValue: string): string {
  const clean = rawValue.trim().toUpperCase().replace(/\s+/g, '');
  if (clean.length <= 4) return clean;
  if (govIdType === 'aadhaar' && clean.length >= 8) {
    return `XXXX-XXXX-${clean.slice(-4)}`;
  }
  return `${'X'.repeat(Math.max(2, clean.length - 4))}${clean.slice(-4)}`;
}

export function formatOwnershipProofLabel(type?: OwnershipProofType | string): string {
  switch (type) {
    case 'property_tax':
      return 'Property Tax Receipt';
    case 'electricity_bill':
      return 'Electricity / EB Bill';
    case 'sale_deed':
      return 'Registered Sale Deed';
    case 'noc_society':
      return 'Apartment / Society NOC';
    case 'rental_agreement':
      return 'Rental Agreement + Owner NOC';
    default:
      return 'Property Proof';
  }
}

export const useKycStore = create<KycState>((set) => ({
  driverKyc: null,
  hostKyc: null,
  loading: false,
  saving: false,

  loadKycs: async () => {
    const isDemo = useAuthStore.getState().isDemoMode;
    set({ loading: true });

    try {
      if (isDemo) {
        const [d, h] = await Promise.all([
          cacheGet<StoredDriverKyc>(CACHE_KEYS.DRIVER_KYC),
          cacheGet<StoredHostKyc>(CACHE_KEYS.HOST_KYC),
        ]);
        set({ driverKyc: d, hostKyc: h, loading: false });
        return;
      }

      const [dRes, hRes] = await Promise.all([
        authApi.getDriverKyc().catch(() => null),
        hostApi.getKyc().catch(() => null),
      ]);

      const serverDriver = dRes?.data?.data?.kyc as StoredDriverKyc | null | undefined;
      const rawHost = hRes?.data?.data?.kyc as any;
      const serverHost: StoredHostKyc | null =
        rawHost && rawHost.submittedAt
          ? {
              id: String(rawHost.id),
              userId: String(rawHost.userId),
              kycFullName: rawHost.kycFullName || '',
              kycPhone: rawHost.kycPhone || undefined,
              businessName: rawHost.businessName || undefined,
              panNumber: rawHost.panNumber || undefined,
              govIdType: (rawHost.govIdType || 'aadhaar') as GovIdType,
              govIdNumberMasked: rawHost.govIdNumberMasked || '',
              govIdDocumentUrl: rawHost.govIdDocumentUrl || '',
              ownershipProofType: (rawHost.ownershipProofType || 'property_tax') as OwnershipProofType,
              ownershipDocumentUrl: rawHost.ownershipDocumentUrl || '',
              addressProofUrl: rawHost.addressProofUrl || undefined,
              plotPhotoUrls: Array.isArray(rawHost.plotPhotoUrls) ? rawHost.plotPhotoUrls : [],
              bankAccountNumber: rawHost.bankAccountNumber || undefined,
              ifscCode: rawHost.ifscCode || undefined,
              upiId: rawHost.upiId || undefined,
              kycNotes: rawHost.kycNotes || undefined,
              verificationStatus: (rawHost.verificationStatus || 'pending') as KycVerificationStatus,
              reviewNotes: rawHost.reviewNotes || undefined,
              submittedAt: String(rawHost.submittedAt),
              updatedAt: String(rawHost.updatedAt || rawHost.submittedAt),
            }
          : null;

      const [cachedD, cachedH] = await Promise.all([
        cacheGet<StoredDriverKyc>(CACHE_KEYS.DRIVER_KYC),
        cacheGet<StoredHostKyc>(CACHE_KEYS.HOST_KYC),
      ]);

      const nextD = serverDriver ?? cachedD ?? null;
      const nextH = serverHost ?? cachedH ?? null;
      if (nextD) await cacheSet(CACHE_KEYS.DRIVER_KYC, nextD);
      if (nextH) await cacheSet(CACHE_KEYS.HOST_KYC, nextH);
      set({ driverKyc: nextD, hostKyc: nextH, loading: false });
    } catch {
      set({ loading: false });
    }
  },

  submitDriverKyc: async (payload: DriverKycPayload) => {
    const auth = useAuthStore.getState();
    set({ saving: true });
    try {
      const normalized: DriverKycPayload = {
        ...payload,
        fullName: payload.fullName.trim(),
        drivingLicenseNumber: payload.drivingLicenseNumber.trim().toUpperCase().replace(/\s+/g, ''),
        vehiclePlate: payload.vehiclePlate.trim().toUpperCase().replace(/\s+/g, ''),
        rcNumber: payload.rcNumber.trim().toUpperCase().replace(/\s+/g, ''),
        govIdNumberMasked: maskGovIdNumber(payload.govIdType, payload.govIdNumberMasked),
      };

      let saved: StoredDriverKyc;
      if (auth.isDemoMode) {
        const now = new Date().toISOString();
        saved = {
          ...normalized,
          id: `dkyc-${Date.now()}`,
          userId: auth.user?.id || 'demo-driver',
          status: 'pending',
          reviewNotes: 'Documents stored locally and queued for Parkly Verification Team review.',
          submittedAt: now,
          updatedAt: now,
        };
      } else {
        const { data } = await authApi.submitDriverKyc(normalized);
        saved = data?.data?.kyc as StoredDriverKyc;
      }

      await cacheSet(CACHE_KEYS.DRIVER_KYC, saved);
      set({ driverKyc: saved, saving: false });
      return saved;
    } catch (err) {
      set({ saving: false });
      throw err;
    }
  },

  submitHostKyc: async (payload: HostKycPayload) => {
    const auth = useAuthStore.getState();
    set({ saving: true });
    try {
      const normalized: HostKycPayload = {
        ...payload,
        kycFullName: payload.kycFullName.trim(),
        panNumber: payload.panNumber?.trim().toUpperCase() || undefined,
        ifscCode: payload.ifscCode?.trim().toUpperCase() || undefined,
        govIdNumberMasked: maskGovIdNumber(payload.govIdType, payload.govIdNumberMasked),
      };

      let saved: StoredHostKyc;
      if (auth.isDemoMode) {
        const now = new Date().toISOString();
        saved = {
          ...normalized,
          id: `hkyc-${Date.now()}`,
          userId: auth.user?.id || 'demo-host',
          verificationStatus: 'pending',
          reviewNotes: 'Host ID, ownership document, and plot photos stored for team verification.',
          submittedAt: now,
          updatedAt: now,
        };
      } else {
        if (auth.user && auth.user.role === 'driver') {
          await authApi.becomeHost({
            businessName: payload.businessName,
            bankAccount: payload.bankAccountNumber,
            ifscCode: payload.ifscCode,
          }).catch(() => {});
        }
        const { data } = await hostApi.submitKyc(normalized);
        const raw = data?.data?.kyc || {};
        saved = {
          ...normalized,
          id: String(raw.id || `hkyc-${Date.now()}`),
          userId: String(raw.userId || auth.user?.id || ''),
          verificationStatus: (raw.verificationStatus || 'pending') as KycVerificationStatus,
          reviewNotes: raw.reviewNotes || undefined,
          submittedAt: String(raw.submittedAt || new Date().toISOString()),
          updatedAt: String(raw.updatedAt || new Date().toISOString()),
        };
      }

      await cacheSet(CACHE_KEYS.HOST_KYC, saved);
      set({ hostKyc: saved, saving: false });
      return saved;
    } catch (err) {
      set({ saving: false });
      throw err;
    }
  },
}));
