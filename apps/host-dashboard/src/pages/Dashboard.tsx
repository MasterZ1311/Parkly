import React from 'react';
import { useNavigate } from 'react-router-dom';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts';
import { useBookings, useRevenue, useListings } from '../hooks/useHostData';
import { useDocumentTitle } from '../utils/useDocumentTitle';

export default function Dashboard() {
  const navigate = useNavigate();
  useDocumentTitle('Overview & Performance');

  const { bookings, loading: bookingsLoading, error: bookingsError } = useBookings();
  const { revenueStats } = useRevenue();
  const { listings } = useListings();

  const activeSpaces = listings.filter((l) => l.status === 'active').length;
  const avgOccupancy =
    listings.length > 0
      ? `${Math.round(listings.reduce((s, l) => s + (l.occupancyPercent || 0), 0) / listings.length)}%`
      : '0%';

  const statCards = [
    { icon: '💰', label: 'Total Earnings', value: `₹${revenueStats.totalEarnings.toLocaleString('en-IN')}`, color: '#10B981', bg: '#10B98120' },
    { icon: '📅', label: 'Total Bookings', value: String(bookings.length), color: '#EF010C', bg: 'rgba(239,1,12,0.15)' },
    { icon: '🅿️', label: 'Active Spaces', value: String(activeSpaces), color: '#8B5CF6', bg: '#8B5CF620' },
    { icon: '⭐', label: 'Avg Occupancy', value: avgOccupancy, color: '#F59E0B', bg: '#F59E0B20' },
  ];

  const chartData = revenueStats.monthlyBreakdown.map((m) => ({
    month: m.month,
    revenue: m.net,
    bookings: m.bookings,
  }));

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Host Performance Dashboard</h1>
          <p className="page-subtitle">Real-time parking space occupancy, earnings breakdown, and active reservations.</p>
        </div>
        <button className="btn btn-primary" onClick={() => navigate('/listings')}>+ Add Listing</button>
      </div>

      {bookingsError && <div className="alert-error">{bookingsError}</div>}

      {/* Stats */}
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

      {/* Charts */}
      <div className="grid-2" style={{ marginBottom: 24 }}>
        <div className="card">
          <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 20, color: 'var(--text-primary)' }}>
            Monthly Net Revenue (₹)
          </h3>
          {chartData.length === 0 ? (
            <div style={{ height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
              No monthly revenue recorded yet.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#263957" />
                <XAxis dataKey="month" tick={{ fill: '#94A3B8', fontSize: 12 }} />
                <YAxis tick={{ fill: '#94A3B8', fontSize: 12 }} />
                <Tooltip contentStyle={{ background: '#111D33', border: '1px solid #263957', borderRadius: 8, color: '#F8FAFC' }} />
                <Bar dataKey="revenue" fill="#EF010C" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="card">
          <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 20, color: 'var(--text-primary)' }}>
            Bookings Trend
          </h3>
          {chartData.length === 0 ? (
            <div style={{ height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
              Bookings trend appears once drivers reserve your spaces.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#263957" />
                <XAxis dataKey="month" tick={{ fill: '#94A3B8', fontSize: 12 }} />
                <YAxis tick={{ fill: '#94A3B8', fontSize: 12 }} />
                <Tooltip contentStyle={{ background: '#111D33', border: '1px solid #263957', borderRadius: 8, color: '#F8FAFC' }} />
                <Line type="monotone" dataKey="bookings" stroke="#10B981" strokeWidth={2} dot={{ fill: '#10B981' }} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Recent Bookings */}
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>Recent Bookings</h3>
          <button className="btn btn-outline" style={{ padding: '6px 14px', fontSize: 12 }} onClick={() => navigate('/bookings')}>
            View All
          </button>
        </div>
        <div className="table-wrap">
          {bookingsLoading ? (
            <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)' }}>Loading bookings...</div>
          ) : bookings.length === 0 ? (
            <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)' }}>No reservations recorded yet.</div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Booking ID</th>
                  <th>Driver / Vehicle</th>
                  <th>Space</th>
                  <th>Start Time</th>
                  <th>Amount</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {bookings.slice(0, 5).map((b) => (
                  <tr key={b.id}>
                    <td style={{ color: 'var(--accent)', fontWeight: 600 }}>#{b.id.slice(0, 8)}</td>
                    <td style={{ color: 'var(--text-primary)' }}>
                      {b.driverName || 'Driver'}
                      {b.vehiclePlate && (
                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{b.vehiclePlate}</div>
                      )}
                    </td>
                    <td>{b.spaceName}</td>
                    <td style={{ fontSize: 12 }}>
                      {new Date(b.startTime).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td style={{ color: 'var(--green)', fontWeight: 700 }}>₹{b.totalAmount}</td>
                    <td>
                      <span className={`badge badge-${b.status === 'active' || b.status === 'confirmed' ? 'blue' : b.status === 'completed' ? 'green' : 'red'}`}>
                        {b.status.charAt(0).toUpperCase() + b.status.slice(1)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
