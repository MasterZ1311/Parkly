// ============================================================
// Admin Portal — Data Hooks
// ============================================================

import { useState, useEffect, useCallback } from 'react';
import { adminApi } from '../utils/apiClient';

export interface AdminUser {
  id: string;
  phone: string;
  name: string | null;
  email: string | null;
  role: string;
  isActive: boolean;
  createdAt: string;
}

export interface AdminBooking {
  id: string;
  spaceId: string;
  driverId: string;
  startTime: string;
  endTime: string;
  totalAmount: number;
  status: string;
  type: string;
  createdAt: string;
}

export interface PendingVerification {
  id: string;
  name: string;
  address: string;
  totalCapacity: number;
  hourlyRate: number;
  status: string;
  host?: {
    id: string;
    user?: {
      name: string | null;
      phone: string;
    };
  };
}

export function useMetrics() {
  const [metrics, setMetrics] = useState({
    totalUsers: 1420,
    activeSpaces: 38,
    totalBookings: 6850,
    completedBookings: 6510,
    pendingVerifications: 4,
    revenueTotal: '₹14,82,000',
  });
  const [loading, setLoading] = useState(false);

  const fetchMetrics = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminApi.getMetrics();
      if (res.data?.data) {
        setMetrics((prev) => ({ ...prev, ...res.data.data }));
      }
    } catch {
      // Use fallback stats if mock DB offline
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMetrics();
  }, [fetchMetrics]);

  return { metrics, loading, refetch: fetchMetrics };
}

export function useUsers(roleFilter?: string) {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminApi.getUsers({ role: roleFilter });
      const list = res.data?.data?.users;
      if (Array.isArray(list) && list.length > 0) {
        setUsers(list);
      } else {
        // Fallback default Chennai users
        setUsers([
          { id: 'usr-001', phone: '+919876543210', name: 'Siva K.', email: 'siva@example.com', role: 'admin', isActive: true, createdAt: '2026-01-10T10:00:00Z' },
          { id: 'usr-002', phone: '+919840123456', name: 'Arjun Kumar', email: 'arjun@example.com', role: 'driver', isActive: true, createdAt: '2026-02-14T09:30:00Z' },
          { id: 'usr-003', phone: '+919789012345', name: 'V. Sundaram', email: 'sundaram@example.com', role: 'host', isActive: true, createdAt: '2026-03-01T12:00:00Z' },
          { id: 'usr-004', phone: '+919444123456', name: 'Priya Sharma', email: 'priya@example.com', role: 'driver', isActive: true, createdAt: '2026-03-15T15:20:00Z' },
          { id: 'usr-005', phone: '+919176123456', name: 'GCC Ward 117 Officer', email: 'gcc.ward117@tn.gov.in', role: 'government', isActive: true, createdAt: '2026-04-01T11:00:00Z' },
        ]);
      }
    } catch {
      // Offline fallback
      setUsers([
        { id: 'usr-001', phone: '+919876543210', name: 'Siva K.', email: 'siva@example.com', role: 'admin', isActive: true, createdAt: '2026-01-10T10:00:00Z' },
        { id: 'usr-002', phone: '+919840123456', name: 'Arjun Kumar', email: 'arjun@example.com', role: 'driver', isActive: true, createdAt: '2026-02-14T09:30:00Z' },
        { id: 'usr-003', phone: '+919789012345', name: 'V. Sundaram', email: 'sundaram@example.com', role: 'host', isActive: true, createdAt: '2026-03-01T12:00:00Z' },
      ]);
    } finally {
      setLoading(false);
    }
  }, [roleFilter]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  return { users, loading, refetch: fetchUsers };
}

export function useAllBookings(statusFilter?: string) {
  const [bookings, setBookings] = useState<AdminBooking[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchBookings = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminApi.getBookings({ status: statusFilter });
      const list = res.data?.data?.bookings;
      if (Array.isArray(list) && list.length > 0) {
        setBookings(list);
      } else {
        setBookings([
          { id: 'b_sample_01', spaceId: 'sp-001', driverId: 'usr-002', startTime: '2026-07-01T09:00:00Z', endTime: '2026-07-01T11:00:00Z', totalAmount: 80, status: 'active', type: 'instant', createdAt: '2026-07-01T08:50:00Z' },
          { id: 'b_sample_02', spaceId: 'sp-002', driverId: 'usr-004', startTime: '2026-06-30T14:00:00Z', endTime: '2026-06-30T17:00:00Z', totalAmount: 105, status: 'completed', type: 'instant', createdAt: '2026-06-30T13:40:00Z' },
          { id: 'b_sample_03', spaceId: 'sp-001', driverId: 'usr-002', startTime: '2026-06-29T10:00:00Z', endTime: '2026-06-29T12:00:00Z', totalAmount: 80, status: 'disputed', type: 'instant', createdAt: '2026-06-29T09:45:00Z' },
        ]);
      }
    } catch {
      setBookings([
        { id: 'b_sample_01', spaceId: 'sp-001', driverId: 'usr-002', startTime: '2026-07-01T09:00:00Z', endTime: '2026-07-01T11:00:00Z', totalAmount: 80, status: 'active', type: 'instant', createdAt: '2026-07-01T08:50:00Z' },
        { id: 'b_sample_02', spaceId: 'sp-002', driverId: 'usr-004', startTime: '2026-06-30T14:00:00Z', endTime: '2026-06-30T17:00:00Z', totalAmount: 105, status: 'completed', type: 'instant', createdAt: '2026-06-30T13:40:00Z' },
        { id: 'b_sample_03', spaceId: 'sp-001', driverId: 'usr-002', startTime: '2026-06-29T10:00:00Z', endTime: '2026-06-29T12:00:00Z', totalAmount: 80, status: 'disputed', type: 'instant', createdAt: '2026-06-29T09:45:00Z' },
      ]);
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    fetchBookings();
  }, [fetchBookings]);

  return { bookings, loading, refetch: fetchBookings };
}

export function useVerifications() {
  const [verifications, setVerifications] = useState<PendingVerification[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchVerifications = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminApi.getVerifications();
      const list = res.data?.data?.spaces;
      if (Array.isArray(list) && list.length > 0) {
        setVerifications(list);
      } else {
        setVerifications([
          {
            id: 'sp-pending-01',
            name: 'Anna Nagar West Commercial Bay',
            address: '42, 2nd Avenue, Anna Nagar, Chennai 600040',
            totalCapacity: 14,
            hourlyRate: 50,
            status: 'pending_verification',
            host: { id: 'host-01', user: { name: 'K. Rajan', phone: '+919841234567' } },
          },
          {
            id: 'sp-pending-02',
            name: 'OMR Sholinganallur Tech Park Spot',
            address: '77, Rajiv Gandhi Salai, Sholinganallur, Chennai 600119',
            totalCapacity: 25,
            hourlyRate: 40,
            status: 'pending_verification',
            host: { id: 'host-02', user: { name: 'Deepa V.', phone: '+919940123456' } },
          },
        ]);
      }
    } catch {
      setVerifications([
        {
          id: 'sp-pending-01',
          name: 'Anna Nagar West Commercial Bay',
          address: '42, 2nd Avenue, Anna Nagar, Chennai 600040',
          totalCapacity: 14,
          hourlyRate: 50,
          status: 'pending_verification',
          host: { id: 'host-01', user: { name: 'K. Rajan', phone: '+919841234567' } },
        },
      ]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchVerifications();
  }, [fetchVerifications]);

  return { verifications, loading, refetch: fetchVerifications };
}
