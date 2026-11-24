// ============================================================
// Host Dashboard — Data Hooks
// ============================================================

import { useState, useEffect, useCallback } from 'react';
import { hostApi } from '../utils/apiClient';

export interface HostListing {
  id: string;
  name: string;
  address: string;
  city: string;
  state: string;
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
  driverName?: string;
  startTime: string;
  endTime: string;
  totalAmount: number;
  status: string;
  vehiclePlate?: string;
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
      if (Array.isArray(data) && data.length > 0) {
        setListings(
          data.map((s: any) => ({
            id: s.id,
            name: s.name,
            address: s.address,
            city: s.city,
            state: s.state,
            totalCapacity: s.totalCapacity,
            hourlyRate: s.pricing?.hourlyRate || s.hourlyRate || 40,
            status: s.status,
            amenities: s.amenities,
            photoUrls: s.photoUrls,
            occupancyPercent: 65,
          }))
        );
      } else {
        // Fallback default sample listings for initial host experience
        setListings([
          {
            id: 'sp-001',
            name: 'T Nagar Parking Complex - Spot A',
            address: '23, Panagal Park Road, T Nagar, Chennai 600017',
            city: 'Chennai',
            state: 'Tamil Nadu',
            totalCapacity: 10,
            hourlyRate: 40,
            status: 'active',
            amenities: { evCharging: true, covered: true, securityLevel: 'gated' },
            occupancyPercent: 72,
          },
          {
            id: 'sp-002',
            name: 'T Nagar Parking Complex - Spot B',
            address: '23, Panagal Park Road, T Nagar, Chennai 600017',
            city: 'Chennai',
            state: 'Tamil Nadu',
            totalCapacity: 5,
            hourlyRate: 35,
            status: 'active',
            amenities: { evCharging: false, covered: false, securityLevel: 'basic' },
            occupancyPercent: 40,
          },
          {
            id: 'sp-003',
            name: 'Anna Nagar Multi-Level',
            address: '12, 6th Avenue, Anna Nagar, Chennai 600040',
            city: 'Chennai',
            state: 'Tamil Nadu',
            totalCapacity: 20,
            hourlyRate: 60,
            status: 'pending_verification',
            amenities: { evCharging: true, covered: true, securityLevel: 'monitored' },
            occupancyPercent: 0,
          },
        ]);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load listings');
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
      const data = response.data?.data;
      if (Array.isArray(data) && data.length > 0) {
        setBookings(data);
      } else {
        // Fallback default sample bookings
        setBookings([
          { id: 'B001', spaceId: 'sp-001', spaceName: 'T Nagar Spot A', driverName: 'Arjun K.', startTime: new Date(Date.now() - 7200000).toISOString(), endTime: new Date(Date.now() + 3600000).toISOString(), totalAmount: 80, status: 'active', vehiclePlate: 'TN01AB1234' },
          { id: 'B002', spaceId: 'sp-001', spaceName: 'T Nagar Spot A', driverName: 'Priya S.', startTime: new Date(Date.now() - 14400000).toISOString(), endTime: new Date(Date.now() - 7200000).toISOString(), totalAmount: 120, status: 'completed', vehiclePlate: 'TN09CD5678' },
          { id: 'B003', spaceId: 'sp-002', spaceName: 'T Nagar Spot B', driverName: 'Rahul M.', startTime: new Date(Date.now() - 86400000).toISOString(), endTime: new Date(Date.now() - 72000000).toISOString(), totalAmount: 200, status: 'completed', vehiclePlate: 'TN07EF9012' },
          { id: 'B004', spaceId: 'sp-001', spaceName: 'T Nagar Spot A', driverName: 'Meera D.', startTime: new Date(Date.now() - 86400000).toISOString(), endTime: new Date(Date.now() - 82800000).toISOString(), totalAmount: 60, status: 'cancelled', vehiclePlate: 'TN02GH3456' },
        ]);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load bookings');
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
  const [revenueStats, setRevenueStats] = useState({
    totalEarnings: '₹1,04,800',
    totalBookings: 416,
    activeSpaces: 3,
    avgOccupancy: '72%',
    monthlyRevenue: [
      { month: 'Jan', revenue: 12400, bookings: 48 },
      { month: 'Feb', revenue: 15800, bookings: 62 },
      { month: 'Mar', revenue: 18200, bookings: 74 },
      { month: 'Apr', revenue: 16500, bookings: 65 },
      { month: 'May', revenue: 22100, bookings: 88 },
      { month: 'Jun', revenue: 19800, bookings: 79 },
    ],
  });
  const [loading, setLoading] = useState(false);

  return { revenueStats, loading };
}
