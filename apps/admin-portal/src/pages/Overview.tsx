import { useMemo, useState } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useMetrics, useAllBookings, useAuditLogs } from '../hooks/useAdminData';
import Breadcrumbs from '../components/Breadcrumbs';
import { useDocumentTitle } from '../utils/useDocumentTitle';
import {
  UsersIcon,
  ParkingIcon,
  CalendarIcon,
  CurrencyIcon,
  ClockIcon,
  AlertTriangleIcon,
  BellIcon,
  CheckCircleIcon,
  DownloadIcon,
  RefreshIcon,
} from '../components/Icons';

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
    { Icon: UsersIcon, label: 'Total Users', value: metrics.totalUsers.toLocaleString('en-IN'), change: 'Registered accounts', color: 'var(--blue)' },
    { Icon: ParkingIcon, label: 'Active Spaces', value: String(metrics.activeSpaces), change: 'Verified facilities', color: 'var(--green)' },
    { Icon: CalendarIcon, label: 'Total Bookings', value: String(metrics.totalBookings), change: `${metrics.completedBookings} completed`, color: 'var(--text-primary)' },
    { Icon: CurrencyIcon, label: 'Platform Volume', value: `₹${metrics.totalRevenue.toLocaleString('en-IN')}`, change: `₹${metrics.platformFeeRevenue.toLocaleString('en-IN')} platform fee`, color: 'var(--green)' },
    { Icon: ClockIcon, label: 'Pending Reviews', value: String(metrics.pendingVerifications), change: 'KYC queue', color: 'var(--accent-cta)' },
    { Icon: AlertTriangleIcon, label: 'Open Disputes', value: String(metrics.openDisputes), change: 'Awaiting arbitration', color: 'var(--yellow)' },
    { Icon: BellIcon, label: 'Active Alerts', value: String(metrics.unresolvedAlerts), change: 'Unresolved incidents', color: 'var(--red)' },
    { Icon: CheckCircleIcon, label: 'Verified Hosts', value: String(metrics.activeHosts), change: 'Approved partners', color: 'var(--green)' },
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
          <p className="page-subtitle">
            Metro smart parking telemetry, host verification pipeline, and live audit stream.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button type="button" className="btn btn-outline" onClick={handleExport} disabled={chartData.length === 0}>
            <DownloadIcon size={15} />
            Export CSV
          </button>
          <button type="button" className="btn btn-primary" onClick={handleRefresh} disabled={refreshing || loading}>
            <RefreshIcon size={15} />
            {refreshing ? 'Refreshing...' : 'Refresh Metrics'}
          </button>
        </div>
      </div>

      {metricsError && (
        <div className="status-banner status-banner--error" style={{ marginBottom: 16 }}>
          <span>{metricsError}</span>
        </div>
      )}

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
      <div className="grid-2" style={{ marginBottom: 20 }}>
        <div className="card">
          <div className="card-header">
            <h2 className="card-title">Booking Distribution by Day</h2>
            <span className="card-meta">Chennai Corridor</span>
          </div>
          {chartData.length === 0 ? (
            <div style={{ height: 220, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
              {loading ? 'Loading booking telemetry...' : 'No live bookings available yet.'}
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="colorBookings" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#D90410" stopOpacity={0.22} />
                    <stop offset="95%" stopColor="#D90410" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E2D8" vertical={false} />
                <XAxis dataKey="day" tick={{ fill: '#5A6678', fontSize: 12 }} axisLine={{ stroke: '#DFDDD4' }} tickLine={false} />
                <YAxis tick={{ fill: '#5A6678', fontSize: 12 }} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={{
                    background: '#FFFFFF',
                    border: '1px solid #C9C5B9',
                    borderRadius: 8,
                    color: '#0B1628',
                    boxShadow: '0 4px 12px rgba(11, 22, 40, 0.08)',
                  }}
                />
                <Area type="monotone" dataKey="bookings" stroke="#D90410" fillOpacity={1} fill="url(#colorBookings)" strokeWidth={2.5} />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="card">
          <div className="card-header">
            <h2 className="card-title">Live Platform Audit Stream</h2>
            <span className="card-meta">Security Trail</span>
          </div>
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
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--accent-cta)', marginTop: 6, flexShrink: 0 }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>{a.action}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                      {a.actorName} → {a.target}
                    </div>
                  </div>
                  <div className="mono-num" style={{ fontSize: 11, color: 'var(--text-muted)' }}>
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
