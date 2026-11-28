// ============================================================
// Host Dashboard — Live Data Hooks
// ============================================================

import { useState, useEffect, useCallback } from 'react';
import { isDemoModeEnabled, hostApi } from '../utils/apiClient';

export type HostSpaceType = 'commercial' | 'private_house' | 'apartment_bay' | 'gated_compound';

export interface HostListing {
  id: string;
  name: string;
  spaceType?: HostSpaceType;
  entryInstructions?: string;
  address: string;
  city: string;
  state: string;
  pincode?: string;
  latitude?: number;
  longitude?: number;
  totalCapacity: number;
  hourlyRate: number;
  status: string;
  amenities?: {
    evCharging?: boolean;
    covered?: boolean;
    securityLevel?: string;
  };
  photoUrls?: string[];
  occupancyPercent?: number;
}

export interface HostBooking {
  id: string;
  spaceId: string;
  spaceName?: string;
  spaceType?: string;
  driverName?: string;
  driverPhone?: string;
  startTime: string;
  endTime: string;
  checkedInAt?: string | null;
  checkedOutAt?: string | null;
  leavingNotifiedAt?: string | null;
  gateCode?: string;
  overstayMinutes?: number;
  overstayAmount?: number;
  totalAmount: number;
  status: string;
  vehiclePlate?: string;
}

export interface HostPayout {
  id: string;
  amount: number;
  status: string;
  createdAt: string;
  processedAt?: string | null;
}

export interface HostRevenueStats {
  totalEarnings: number;
  totalPayouts: number;
  availableBalance: number;
  grossRevenue: number;
  platformFees: number;
  netRevenue: number;
  monthlyBreakdown: Array<{ month: string; gross: number; fees: number; net: number; bookings: number }>;
  recentPayouts: HostPayout[];
}

export function useListings() {
  const [listings, setListings] = useState<HostListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchListings = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await hostApi.getListings();
      const data = response.data?.data;
      if (Array.isArray(data)) {
        const mapped: HostListing[] = await Promise.all(
          data.map(async (s: any) => {
            let occupancyPercent = 0;
            try {
              const occ = await hostApi.getOccupancy(s.id);
              const occPct = occ.data?.data?.occupancyPercentage ?? occ.data?.data?.occupancyRate;
              if (typeof occPct === 'number') {
                occupancyPercent = occPct <= 1 ? Math.round(occPct * 100) : Math.round(occPct);
              }
            } catch {
              occupancyPercent = 0;
            }
            return {
              id: s.id,
              name: s.name,
              spaceType: s.spaceType || 'commercial',
              entryInstructions: s.entryInstructions,
              address: s.address,
              city: s.city,
              state: s.state,
              pincode: s.pincode,
              latitude: s.coordinates?.lat,
              longitude: s.coordinates?.lng,
              totalCapacity: s.totalCapacity,
              hourlyRate: s.pricing?.hourlyRate || s.hourlyRate || 40,
              status: s.status,
              amenities: s.amenities,
              photoUrls: s.photoUrls,
              occupancyPercent,
            };
          }),
        );
        setListings(mapped);
      } else {
        setListings([]);
      }
    } catch (err: any) {
      if (isDemoModeEnabled()) {
        setListings([
          {
            id: '00000000-0000-4000-8000-000000001001',
            name: 'T Nagar Parking Complex - Spot A',
            address: '23, Panagal Park Road, T Nagar, Chennai 600017',
            city: 'Chennai',
            state: 'Tamil Nadu',
            totalCapacity: 10,
            hourlyRate: 40,
            status: 'active',
            amenities: { evCharging: true, covered: true, securityLevel: 'gated' },
            occupancyPercent: 70,
          },
        ]);
      } else {
        setError(err.response?.data?.error?.message || err.message || 'Failed to load listings');
        setListings([]);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchListings();
  }, [fetchListings]);

  return { listings, loading, error, refetch: fetchListings };
}

export function useBookings(status?: string) {
  const [bookings, setBookings] = useState<HostBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchBookings = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await hostApi.getBookings(status);
      const raw = response.data?.data?.bookings ?? response.data?.data;
      if (Array.isArray(raw)) {
        setBookings(
          raw.map((b: any) => ({
            id: b.id,
            spaceId: b.spaceId,
            spaceName: b.space?.name || b.spaceName || b.spaceId,
            spaceType: b.space?.spaceType || b.spaceType,
            driverName: b.user?.name || b.driverName || 'Driver',
            driverPhone: b.user?.phone,
            startTime: b.startTime,
            endTime: b.endTime,
            checkedInAt: b.checkedInAt || null,
            checkedOutAt: b.checkedOutAt || null,
            leavingNotifiedAt: b.leavingNotifiedAt || null,
            gateCode: b.gateCode,
            overstayMinutes: Number(b.overstayMinutes || 0),
            overstayAmount: Number(b.overstayAmount || 0),
            totalAmount: Number(b.totalAmount || 0),
            status: b.status,
            vehiclePlate: b.vehicle?.licensePlate || b.vehiclePlate || '—',
          })),
        );
      } else {
        setBookings([]);
      }
    } catch (err: any) {
      setError(err.response?.data?.error?.message || err.message || 'Failed to load bookings');
      setBookings([]);
    } finally {
      setLoading(false);
    }
  }, [status]);

  useEffect(() => {
    fetchBookings();
  }, [fetchBookings]);

  return { bookings, loading, error, refetch: fetchBookings };
}

export function useRevenue() {
  const [revenueStats, setRevenueStats] = useState<HostRevenueStats>({
    totalEarnings: 0,
    totalPayouts: 0,
    availableBalance: 0,
    grossRevenue: 0,
    platformFees: 0,
    netRevenue: 0,
    monthlyBreakdown: [],
    recentPayouts: [],
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchRevenue = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await hostApi.getRevenue();
      const data = response.data?.data;
      if (data) {
        setRevenueStats({
          totalEarnings: Number(data.totalEarnings || 0),
          totalPayouts: Number(data.totalPayouts || 0),
          availableBalance: Number(data.availableBalance || 0),
          grossRevenue: Number(data.grossRevenue || 0),
          platformFees: Number(data.platformFees || 0),
          netRevenue: Number(data.netRevenue || 0),
          monthlyBreakdown: Array.isArray(data.monthlyBreakdown) ? data.monthlyBreakdown : [],
          recentPayouts: Array.isArray(data.recentPayouts) ? data.recentPayouts : [],
        });
      }
    } catch (err: any) {
      setError(err.response?.data?.error?.message || err.message || 'Failed to load revenue telemetry');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRevenue();
  }, [fetchRevenue]);

  return { revenueStats, loading, error, refetch: fetchRevenue };
}
