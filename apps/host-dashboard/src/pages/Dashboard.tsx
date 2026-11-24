import React from 'react';
import { useNavigate } from 'react-router-dom';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts';
import { useBookings, useRevenue, useListings } from '../hooks/useHostData';
import { useDocumentTitle } from '../utils/useDocumentTitle';

export default function Dashboard() {
  const navigate = useNavigate();
  useDocumentTitle('Overview & Performance');

  const { bookings, loading: bookingsLoading } = useBookings();
  const { revenueStats } = useRevenue();
  const { listings } = useListings();

  const statCards = [
    { icon: '💰', label: 'Total Earnings', value: revenueStats.totalEarnings, change: '+12.5%', color: '#22C55E', bg: '#22C55E20' },
    { icon: '📅', label: 'Total Bookings', value: bookings.length > 0 ? String(bookings.length + 412) : '416', change: '+8%', color: '#38BDF8', bg: '#38BDF820' },
    { icon: '🅿️', label: 'Active Spaces', value: listings.length > 0 ? String(listings.filter(l => l.status === 'active').length) : '3', change: '', color: '#8B5CF6', bg: '#8B5CF620' },
    { icon: '⭐', label: 'Avg Occupancy', value: revenueStats.avgOccupancy, change: '+5%', color: '#F59E0B', bg: '#F59E0B20' },
  ];

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Host Performance Dashboard</h1>
          <p className="page-subtitle">Real-time Chennai parking space occupancy, dynamic revenue surges &amp; active reservations.</p>
        </div>
        <button className="btn btn-primary" onClick={() => navigate('/listings')}>+ Add Listing</button>
      </div>

      {/* Stats */}
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
                  <span style={{ color: '#22C55E', marginLeft: 6, fontSize: 11, fontWeight: 700 }}>
                    {card.change}
                  </span>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Charts */}
      <div className="grid-2" style={{ marginBottom: 24 }}>
        <div className="card">
          <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 20, color: 'var(--text-primary)' }}>
            Monthly Revenue (₹)
          </h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={revenueStats.monthlyRevenue}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1E293B" />
              <XAxis dataKey="month" tick={{ fill: '#64748B', fontSize: 12 }} />
              <YAxis tick={{ fill: '#64748B', fontSize: 12 }} />
              <Tooltip
                contentStyle={{ background: '#1E293B', border: '1px solid #334155', borderRadius: 8, color: '#F8FAFC' }}
              />
              <Bar dataKey="revenue" fill="#38BDF8" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="card">
          <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 20, color: 'var(--text-primary)' }}>
            Bookings Trend
          </h3>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={revenueStats.monthlyRevenue}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1E293B" />
              <XAxis dataKey="month" tick={{ fill: '#64748B', fontSize: 12 }} />
              <YAxis tick={{ fill: '#64748B', fontSize: 12 }} />
              <Tooltip
                contentStyle={{ background: '#1E293B', border: '1px solid #334155', borderRadius: 8, color: '#F8FAFC' }}
              />
              <Line type="monotone" dataKey="bookings" stroke="#22C55E" strokeWidth={2} dot={{ fill: '#22C55E' }} />
            </LineChart>
          </ResponsiveContainer>
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
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Booking ID</th>
                  <th>Driver / Vehicle</th>
                  <th>Space</th>
                  <th>Date &amp; Time</th>
                  <th>Amount</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {bookings.slice(0, 5).map((b) => (
                  <tr key={b.id}>
                    <td style={{ color: 'var(--accent)', fontWeight: 600 }}>#{b.id.slice(0, 8)}</td>
                    <td style={{ color: 'var(--text-primary)' }}>
                      {b.driverName || 'Guest Driver'}
                      {b.vehiclePlate && (
                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{b.vehiclePlate}</div>
                      )}
                    </td>
                    <td>{b.spaceName || 'T Nagar Spot A'}</td>
                    <td style={{ fontSize: 12 }}>
                      {new Date(b.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
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
