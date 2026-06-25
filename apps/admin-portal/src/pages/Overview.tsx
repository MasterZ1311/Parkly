import React from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const data = [
  { day: 'Mon', bookings: 48, revenue: 3840 },
  { day: 'Tue', bookings: 62, revenue: 4960 },
  { day: 'Wed', bookings: 55, revenue: 4400 },
  { day: 'Thu', bookings: 78, revenue: 6240 },
  { day: 'Fri', bookings: 91, revenue: 7280 },
  { day: 'Sat', bookings: 103, revenue: 8240 },
  { day: 'Sun', bookings: 87, revenue: 6960 },
];

const statCards = [
  { icon: '👥', label: 'Total Users', value: '12,847', change: '+234 today', color: '#6366F1', bg: '#6366F120' },
  { icon: '🅿️', label: 'Active Spaces', value: '348', change: '+5 this week', color: '#22C55E', bg: '#22C55E20' },
  { icon: '📅', label: 'Today\'s Bookings', value: '91', change: '+14 vs yesterday', color: '#06B6D4', bg: '#06B6D420' },
  { icon: '💰', label: 'Today\'s Revenue', value: '₹7,280', change: '+18.5%', color: '#F59E0B', bg: '#F59E0B20' },
  { icon: '⏳', label: 'Pending Reviews', value: '7', change: 'Action needed', color: '#EF4444', bg: '#EF444420' },
  { icon: '🔄', label: 'Active Incidents', value: '2', change: 'Under review', color: '#8B5CF6', bg: '#8B5CF620' },
  { icon: '⭐', label: 'Platform Rating', value: '4.7/5', change: '1,203 reviews', color: '#F59E0B', bg: '#F59E0B20' },
  { icon: '💳', label: 'Pending Payouts', value: '₹84,320', change: '42 hosts', color: '#22C55E', bg: '#22C55E20' },
];

const recentActivity = [
  { time: '2 min ago', event: 'New host registration', detail: 'Vijay P. - T Nagar', type: 'info' },
  { time: '12 min ago', event: 'Space verification requested', detail: 'Anna Nagar Multi-Level (20 slots)', type: 'warning' },
  { time: '25 min ago', event: 'Payment dispute raised', detail: 'Booking #B1239 — ₹240', type: 'error' },
  { time: '1h ago', event: 'Booking spike detected', detail: 'Velachery area: 340% above baseline', type: 'info' },
  { time: '2h ago', event: 'Space auto-deactivated', detail: 'Adyar Smart Park — sensor offline 4h', type: 'warning' },
];

export default function Overview() {
  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Platform Overview</h1>
          <p className="page-subtitle">Real-time operations dashboard · Chennai, Tamil Nadu</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-outline" style={{ fontSize: 12, padding: '8px 16px' }}>📥 Export</button>
          <button className="btn btn-primary" style={{ fontSize: 12, padding: '8px 16px' }}>🔄 Refresh</button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid-4" style={{ marginBottom: 24 }}>
        {statCards.map(s => (
          <div key={s.label} className="stat-card">
            <div className="stat-icon" style={{ background: s.bg }}>{s.icon}</div>
            <div>
              <div className="stat-value" style={{ fontSize: 20 }}>{s.value}</div>
              <div className="stat-label">
                {s.label}
                <br />
                <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>{s.change}</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid-2" style={{ marginBottom: 24 }}>
        {/* Area Chart */}
        <div className="card">
          <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 20, color: 'var(--text-primary)' }}>
            This Week — Bookings & Revenue
          </h3>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={data}>
              <defs>
                <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#6366F1" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#6366F1" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#1F2937" />
              <XAxis dataKey="day" tick={{ fill: '#6B7280', fontSize: 12 }} />
              <YAxis tick={{ fill: '#6B7280', fontSize: 12 }} />
              <Tooltip contentStyle={{ background: '#111827', border: '1px solid #374151', borderRadius: 8, color: '#F9FAFB' }} />
              <Area type="monotone" dataKey="bookings" name="Bookings" stroke="#6366F1" fill="url(#colorRevenue)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Activity Feed */}
        <div className="card">
          <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 20, color: 'var(--text-primary)' }}>
            Recent Activity
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {recentActivity.map((item, i) => (
              <div key={i} style={{ display: 'flex', gap: 12, paddingBottom: 12, borderBottom: i < recentActivity.length - 1 ? '1px solid var(--border)' : 'none' }}>
                <div style={{
                  width: 8, height: 8, borderRadius: '50%', marginTop: 6, flexShrink: 0,
                  background: item.type === 'error' ? 'var(--red)' : item.type === 'warning' ? 'var(--yellow)' : 'var(--accent)',
                }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{item.event}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{item.detail}</div>
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', flexShrink: 0 }}>{item.time}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
