import React, { useMemo, useState } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useMetrics, useAllBookings, useAuditLogs } from '../hooks/useAdminData';
import Breadcrumbs from '../components/Breadcrumbs';
import { useDocumentTitle } from '../utils/useDocumentTitle';

export default function Overview() {
  useDocumentTitle('City Operations Overview');
  const { metrics, loading, error: metricsError, refetch } = useMetrics();
  const { bookings } = useAllBookings();
  const { logs } = useAuditLogs();
  const [refreshing, setRefreshing] = useState(false);

  const chartData = useMemo(() => {
    const byDay = new Map<string, { day: string; bookings: number; revenue: number }>();
    for (const b of bookings) {
      const day = new Date(b.startTime).toLocaleDateString('en-IN', { weekday: 'short' });
      const entry = byDay.get(day) || { day, bookings: 0, revenue: 0 };
      entry.bookings += 1;
      entry.revenue += Number(b.totalAmount || 0);
      byDay.set(day, entry);
    }
    return Array.from(byDay.values());
  }, [bookings]);

  const statCards = [
    { icon: '👥', label: 'Total Users', value: metrics.totalUsers.toLocaleString('en-IN'), color: '#EF010C', bg: 'rgba(239,1,12,0.15)' },
    { icon: '🅿️', label: 'Active Spaces', value: String(metrics.activeSpaces), color: '#10B981', bg: '#10B98120' },
    { icon: '📅', label: 'Total Bookings', value: String(metrics.totalBookings), color: '#06B6D4', bg: '#06B6D420' },
    { icon: '💰', label: 'Platform Volume', value: `₹${metrics.totalRevenue.toLocaleString('en-IN')}`, color: '#F59E0B', bg: '#F59E0B20' },
    { icon: '⏳', label: 'Pending Reviews', value: String(metrics.pendingVerifications), color: '#EF010C', bg: 'rgba(239,1,12,0.15)' },
    { icon: '⚖️', label: 'Open Disputes', value: String(metrics.openDisputes), color: '#8B5CF6', bg: '#8B5CF620' },
    { icon: '🔔', label: 'Active Alerts', value: String(metrics.unresolvedAlerts), color: '#F59E0B', bg: '#F59E0B20' },
    { icon: '💳', label: 'Verified Hosts', value: String(metrics.activeHosts), color: '#10B981', bg: '#10B98120' },
  ];

  const handleExport = () => {
    const headers = ['Day', 'Bookings', 'Revenue'];
    const rows = chartData.map((d) => [d.day, d.bookings, d.revenue].join(','));
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
          <p className="page-subtitle">Chennai metro smart city parking telemetry, verification queue, and audit stream.</p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn btn-outline" onClick={handleExport} disabled={chartData.length === 0}>
            📥 Export CSV
          </button>
          <button className="btn btn-primary" onClick={handleRefresh} disabled={refreshing || loading}>
            {refreshing ? 'Refreshing...' : '🔄 Refresh Metrics'}
          </button>
        </div>
      </div>

      {metricsError && <div className="alert-error">{metricsError}</div>}

      {/* KPI Grid */}
      <div className="grid-4" style={{ marginBottom: 24 }}>
        {statCards.map((card) => (
          <div key={card.label} className="stat-card">
            <div className="stat-icon" style={{ background: card.bg, color: card.color }}>
              {card.icon}
            </div>
            <div>
              <div className="stat-value">{card.value}</div>
              <div className="stat-label">{card.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Chart & Audit Stream */}
      <div className="grid-2" style={{ marginBottom: 24 }}>
        <div className="card">
          <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 20, color: 'var(--text-primary)' }}>
            Booking Distribution by Day
          </h3>
          {chartData.length === 0 ? (
            <div style={{ height: 220, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
              No live bookings available yet.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="colorBookings" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#EF010C" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#EF010C" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#263957" />
                <XAxis dataKey="day" tick={{ fill: '#9CA3AF', fontSize: 12 }} />
                <YAxis tick={{ fill: '#9CA3AF', fontSize: 12 }} />
                <Tooltip contentStyle={{ background: '#111D33', border: '1px solid #263957', borderRadius: 8, color: '#F9FAFB' }} />
                <Area type="monotone" dataKey="bookings" stroke="#EF010C" fillOpacity={1} fill="url(#colorBookings)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="card">
          <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 16, color: 'var(--text-primary)' }}>
            Live Platform Audit Stream
          </h3>
          {logs.length === 0 ? (
            <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
              No audit log entries recorded yet.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {logs.slice(0, 5).map((a, i) => (
                <div
                  key={a.id}
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 12,
                    paddingBottom: 10,
                    borderBottom: i < Math.min(logs.length, 5) - 1 ? '1px solid var(--border)' : 'none',
                  }}
                >
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#EF010C', marginTop: 6 }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{a.action}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                      {a.actorName} → {a.target}
                    </div>
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                    {new Date(a.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
