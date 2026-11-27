import { useState } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useMetrics, useAllBookings } from '../hooks/useAdminData';
import Breadcrumbs from '../components/Breadcrumbs';
import { useDocumentTitle } from '../utils/useDocumentTitle';
import {
  UsersIcon,
  ParkingIcon,
  CalendarIcon,
  CurrencyIcon,
  ClockIcon,
  AlertTriangleIcon,
  GaugeIcon,
  CheckCircleIcon,
  DownloadIcon,
  RefreshIcon,
} from '../components/Icons';

const data = [
  { day: 'Mon', bookings: 48, revenue: 3840 },
  { day: 'Tue', bookings: 62, revenue: 4960 },
  { day: 'Wed', bookings: 55, revenue: 4400 },
  { day: 'Thu', bookings: 78, revenue: 6240 },
  { day: 'Fri', bookings: 91, revenue: 7280 },
  { day: 'Sat', bookings: 103, revenue: 8240 },
  { day: 'Sun', bookings: 87, revenue: 6960 },
];

export default function Overview() {
  useDocumentTitle('City Operations Overview');
  const { metrics, loading, refetch } = useMetrics();
  const { bookings } = useAllBookings();
  const [refreshing, setRefreshing] = useState(false);

  const statCards = [
    { Icon: UsersIcon, label: 'Total Users', value: metrics.totalUsers.toLocaleString(), change: '+234 today', color: 'var(--blue)' },
    { Icon: ParkingIcon, label: 'Active Spaces', value: String(metrics.activeSpaces), change: '+5 this week', color: 'var(--green)' },
    { Icon: CalendarIcon, label: "Today's Bookings", value: String(bookings.length || 91), change: '+14 vs yesterday', color: 'var(--text-primary)' },
    { Icon: CurrencyIcon, label: 'Platform Revenue', value: metrics.revenueTotal, change: '+18.5%', color: 'var(--green)' },
    { Icon: ClockIcon, label: 'Pending Reviews', value: String(metrics.pendingVerifications), change: 'Action needed', color: 'var(--accent-cta)' },
    { Icon: AlertTriangleIcon, label: 'Active Incidents', value: '2', change: 'Under review', color: 'var(--yellow)' },
    { Icon: GaugeIcon, label: 'Platform Rating', value: '4.8/5', change: '1,420 reviews', color: 'var(--text-primary)' },
    { Icon: CheckCircleIcon, label: 'Host Settlements', value: '₹1,18,320', change: '18 hosts', color: 'var(--green)' },
  ];

  const recentActivity = [
    { time: '2 min ago', event: 'New host registration', detail: 'V. Sundaram — Panagal Park East', type: 'info' },
    { time: '12 min ago', event: 'Space verification requested', detail: 'Anna Nagar West Commercial (14 slots)', type: 'warning' },
    { time: '25 min ago', event: 'DisputeMediationAgent arbitrated', detail: 'Booking #b_sample_01 — ₹150 penalty debit', type: 'error' },
    { time: '1h ago', event: 'Booking spike detected', detail: 'T Nagar corridor: 240% above baseline', type: 'info' },
    { time: '2h ago', event: 'CityAnalyticsAgent export completed', detail: 'Week 36 GCC report: 1,842 kg CO2 abated', type: 'warning' },
  ];

  const handleExport = () => {
    const headers = ['Day', 'Bookings', 'Revenue'];
    const rows = data.map((d) => [d.day, d.bookings, d.revenue].join(','));
    const csv = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'parkly-operations-summary.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  return (
    <div>
      <Breadcrumbs items={[{ label: 'Platform Overview' }]} />
      <div className="page-header">
        <div>
          <h1 className="page-title">City Operations Overview</h1>
          <p className="page-subtitle">
            Metro smart parking telemetry, host verification pipeline, and financial settlements.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button type="button" className="btn btn-outline" onClick={handleExport}>
            <DownloadIcon size={15} />
            Export CSV
          </button>
          <button type="button" className="btn btn-primary" onClick={handleRefresh} disabled={refreshing || loading}>
            <RefreshIcon size={15} />
            {refreshing ? 'Refreshing...' : 'Refresh Metrics'}
          </button>
        </div>
      </div>

      {/* KPI Grid */}
      <div className="grid-4" style={{ marginBottom: 20 }}>
        {statCards.map(({ Icon, label, value, change, color }) => (
          <div key={label} className="stat-card">
            <div>
              <div className="stat-label">{label}</div>
              <div className="stat-value" style={{ color }}>{value}</div>
              <div className="stat-delta" style={{ color: 'var(--text-muted)' }}>
                {change}
              </div>
            </div>
            <div className="stat-icon">
              <Icon size={18} />
            </div>
          </div>
        ))}
      </div>

      {/* Chart & Audit Stream */}
      <div className="grid-2">
        <div className="card">
          <div className="card-header">
            <h2 className="card-title">Weekly City-Wide Booking Velocity</h2>
            <span className="card-meta">Mon – Sun</span>
          </div>
          <ResponsiveContainer width="100%" height={225}>
            <AreaChart data={data}>
              <defs>
                <linearGradient id="colorBookings" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#D90410" stopOpacity={0.22} />
                  <stop offset="95%" stopColor="#D90410" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#E5E2D8" vertical={false} />
              <XAxis dataKey="day" tick={{ fill: '#5A6678', fontSize: 12 }} axisLine={{ stroke: '#DFDDD4' }} tickLine={false} />
              <YAxis tick={{ fill: '#5A6678', fontSize: 12 }} axisLine={false} tickLine={false} />
              <Tooltip />
              <Area type="monotone" dataKey="bookings" name="Bookings" stroke="#D90410" fillOpacity={1} fill="url(#colorBookings)" strokeWidth={2.25} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="card">
          <div className="card-header">
            <h2 className="card-title">Live Platform Audit Stream</h2>
            <span className="card-meta">Chronological</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {recentActivity.map((a, i) => (
              <div
                key={i}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 12,
                  paddingBottom: 11,
                  borderBottom: i < recentActivity.length - 1 ? '1px solid var(--border)' : 'none',
                }}
              >
                <div
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    background: a.type === 'error' ? 'var(--accent-cta)' : a.type === 'warning' ? 'var(--yellow)' : 'var(--blue)',
                    marginTop: 6,
                    flexShrink: 0,
                  }}
                />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text-primary)' }}>{a.event}</div>
                  <div style={{ fontSize: 12.5, color: 'var(--text-muted)', marginTop: 2 }}>{a.detail}</div>
                </div>
                <div className="mono-num" style={{ fontSize: 11, color: 'var(--text-muted)', flexShrink: 0 }}>{a.time}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
