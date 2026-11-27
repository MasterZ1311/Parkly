// ============================================================
// Admin Portal — Live Data Hooks
// ============================================================

import { useState, useEffect, useCallback } from 'react';
import { IS_DEMO_MODE, adminApi } from '../utils/apiClient';

export interface AdminUser {
  id: string;
  phone: string;
  name: string | null;
  email: string | null;
  role: string;
  isActive: boolean;
  isAnonymized?: boolean;
  createdAt: string;
}

export interface AdminBooking {
  id: string;
  spaceId: string;
  userId?: string;
  driverId?: string;
  startTime: string;
  endTime: string;
  totalAmount: number;
  status: string;
  type: string;
  createdAt: string;
  user?: { id: string; name: string | null; phone: string };
  space?: { id: string; name: string; city: string };
  vehicle?: { id: string; licensePlate: string; vehicleType: string };
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

export interface AdminDispute {
  id: string;
  bookingId: string;
  disputeType: string;
  description: string;
  status: 'open' | 'under_review' | 'resolved' | 'closed';
  resolution?: string | null;
  createdAt: string;
  booking?: {
    id: string;
    totalAmount: number;
    space?: { name: string };
    vehicle?: { licensePlate: string };
  };
  user?: { name: string | null; phone: string };
}

export interface AdminAlert {
  id: string;
  severity: 'critical' | 'warning' | 'info';
  title: string;
  detail: string;
  source: string;
  resolved: boolean;
  createdAt: string;
}

export interface AdminAuditLog {
  id: string;
  actorId?: string | null;
  actorName: string;
  action: string;
  target: string;
  ipAddress?: string | null;
  createdAt: string;
}

export function useMetrics() {
  const [metrics, setMetrics] = useState({
    totalUsers: 0,
    activeSpaces: 0,
    totalBookings: 0,
    completedBookings: 0,
    pendingVerifications: 0,
    activeHosts: 0,
    openDisputes: 0,
    unresolvedAlerts: 0,
    totalRevenue: 0,
    platformFeeRevenue: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchMetrics = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await adminApi.getMetrics();
      if (res.data?.data) {
        setMetrics((prev) => ({ ...prev, ...res.data.data }));
      }
    } catch (err: any) {
      if (!IS_DEMO_MODE) {
        setError(err.response?.data?.error?.message || err.message || 'Failed to load platform metrics');
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMetrics();
  }, [fetchMetrics]);

  return { metrics, loading, error, refetch: fetchMetrics };
}

export function useUsers(roleFilter?: string) {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await adminApi.getUsers({ role: roleFilter });
      setUsers(Array.isArray(res.data?.data?.users) ? res.data.data.users : []);
    } catch (err: any) {
      setError(err.response?.data?.error?.message || err.message || 'Failed to load users');
      setUsers([]);
    } finally {
      setLoading(false);
    }
  }, [roleFilter]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  return { users, loading, error, refetch: fetchUsers };
}

export function useAllBookings(statusFilter?: string) {
  const [bookings, setBookings] = useState<AdminBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchBookings = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await adminApi.getBookings({ status: statusFilter });
      setBookings(Array.isArray(res.data?.data?.bookings) ? res.data.data.bookings : []);
    } catch (err: any) {
      setError(err.response?.data?.error?.message || err.message || 'Failed to load bookings');
      setBookings([]);
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    fetchBookings();
  }, [fetchBookings]);

  return { bookings, loading, error, refetch: fetchBookings };
}

export function useVerifications() {
  const [verifications, setVerifications] = useState<PendingVerification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchVerifications = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await adminApi.getVerifications();
      setVerifications(Array.isArray(res.data?.data?.spaces) ? res.data.data.spaces : []);
    } catch (err: any) {
      setError(err.response?.data?.error?.message || err.message || 'Failed to load verifications');
      setVerifications([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchVerifications();
  }, [fetchVerifications]);

  return { verifications, loading, error, refetch: fetchVerifications };
}

export function useDisputes() {
  const [disputes, setDisputes] = useState<AdminDispute[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDisputes = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await adminApi.getDisputes();
      setDisputes(Array.isArray(res.data?.data?.disputes) ? res.data.data.disputes : []);
    } catch (err: any) {
      setError(err.response?.data?.error?.message || err.message || 'Failed to load disputes');
      setDisputes([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDisputes();
  }, [fetchDisputes]);

  return { disputes, loading, error, refetch: fetchDisputes };
}

export function useAlerts() {
  const [alerts, setAlerts] = useState<AdminAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAlerts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await adminApi.getAlerts();
      setAlerts(Array.isArray(res.data?.data?.alerts) ? res.data.data.alerts : []);
    } catch (err: any) {
      setError(err.response?.data?.error?.message || err.message || 'Failed to load alerts');
      setAlerts([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAlerts();
  }, [fetchAlerts]);

  return { alerts, loading, error, refetch: fetchAlerts };
}

export function useAuditLogs() {
  const [logs, setLogs] = useState<AdminAuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await adminApi.getAuditLogs();
      setLogs(Array.isArray(res.data?.data?.logs) ? res.data.data.logs : []);
    } catch (err: any) {
      setError(err.response?.data?.error?.message || err.message || 'Failed to load audit logs');
      setLogs([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  return { logs, loading, error, refetch: fetchLogs };
}
