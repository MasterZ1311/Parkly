import React, { useState } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useMetrics, useAllBookings } from '../hooks/useAdminData';
import Breadcrumbs from '../components/Breadcrumbs';
import { useDocumentTitle } from '../utils/useDocumentTitle';

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
    { icon: '👥', label: 'Total Users', value: metrics.totalUsers.toLocaleString(), change: '+234 today', color: '#6366F1', bg: '#6366F120' },
    { icon: '🅿️', label: 'Active Spaces', value: String(metrics.activeSpaces), change: '+5 this week', color: '#22C55E', bg: '#22C55E20' },
    { icon: '📅', label: "Today's Bookings", value: String(bookings.length || 91), change: '+14 vs yesterday', color: '#06B6D4', bg: '#06B6D420' },
    { icon: '💰', label: 'Platform Revenue', value: metrics.revenueTotal, change: '+18.5%', color: '#F59E0B', bg: '#F59E0B20' },
    { icon: '⏳', label: 'Pending Reviews', value: String(metrics.pendingVerifications), change: 'Action needed', color: '#EF4444', bg: '#EF444420' },
    { icon: '🔄', label: 'Active Incidents', value: '2', change: 'Under review', color: '#8B5CF6', bg: '#8B5CF620' },
    { icon: '⭐', label: 'Platform Rating', value: '4.8/5', change: '1,420 reviews', color: '#F59E0B', bg: '#F59E0B20' },
    { icon: '💳', label: 'Host Settlements', value: '₹1,18,320', change: '18 hosts', color: '#22C55E', bg: '#22C55E20' },
  ];

  const recentActivity = [
    { time: '2 min ago', event: 'New host registration', detail: 'V. Sundaram — Panagal Park East', type: 'info' },
    { time: '12 min ago', event: 'Space verification requested', detail: 'Anna Nagar West Commercial (14 slots)', type: 'warning' },
    { time: '25 min ago', event: 'DisputeMediationAgent arbitrated', detail: 'Booking #b_sample_01 — ₹150 penalty debit', type: 'error' },
    { time: '1h ago', event: 'Booking spike detected', detail: 'T Nagar area: 240% above baseline (Pongal Rush)', type: 'info' },
    { time: '2h ago', event: 'CityAnalyticsAgent export completed', detail: 'Week 36 GCC report generated: 1,842 kg CO2 abated', type: 'warning' },
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
          <p className="page-subtitle">Chennai metro smart city parking grid telemetry, verification pipeline, and financial settlement.</p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn btn-outline" onClick={handleExport}>
            📥 Export CSV
          </button>
          <button className="btn btn-primary" onClick={handleRefresh} disabled={refreshing || loading}>
            {refreshing ? 'Refreshing...' : '🔄 Refresh Metrics'}
          </button>
        </div>
      </div>

      {/* KPI Grid */}
      <div className="grid-4" style={{ marginBottom: 24 }}>
        {statCards.map((card) => (
          <div key={card.label} className="stat-card">
            <div className="stat-icon" style={{ background: card.bg }}>
              {card.icon}
            </div>
            <div>
              <div className="stat-value">{card.value}</div>
              <div className="stat-label">
                {card.label}
                {card.change && (
                  <span style={{ color: card.color, marginLeft: 6, fontSize: 11, fontWeight: 700 }}>
                    {card.change}
                  </span>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Chart & Activity */}
      <div className="grid-2" style={{ marginBottom: 24 }}>
        <div className="card">
          <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 20, color: 'var(--text-primary)' }}>
            Weekly City-wide Booking Velocity
          </h3>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={data}>
              <defs>
                <linearGradient id="colorBookings" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#EF010C" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#EF010C" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#1E293B" />
              <XAxis dataKey="day" tick={{ fill: '#64748B', fontSize: 12 }} />
              <YAxis tick={{ fill: '#64748B', fontSize: 12 }} />
              <Tooltip contentStyle={{ background: '#1E293B', border: '1px solid #334155', borderRadius: 8, color: '#F8FAFC' }} />
              <Area type="monotone" dataKey="bookings" stroke="#EF010C" fillOpacity={1} fill="url(#colorBookings)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="card">
          <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 16, color: 'var(--text-primary)' }}>
            Live Platform Audit Stream
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {recentActivity.map((a, i) => (
              <div
                key={i}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 12,
                  paddingBottom: 10,
                  borderBottom: i < recentActivity.length - 1 ? '1px solid #1E293B' : 'none',
                }}
              >
                <div
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    background: a.type === 'error' ? '#EF010C' : a.type === 'warning' ? '#F59E0B' : '#38BDF8',
                    marginTop: 6,
                  }}
                />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{a.event}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{a.detail}</div>
                </div>
                <div style={{ fontSize: 11, color: '#64748B' }}>{a.time}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
