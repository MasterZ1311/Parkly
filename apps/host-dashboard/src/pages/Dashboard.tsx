import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts';

const revenueData = [
  { month: 'Jan', revenue: 12400, bookings: 48 },
  { month: 'Feb', revenue: 15800, bookings: 62 },
  { month: 'Mar', revenue: 18200, bookings: 74 },
  { month: 'Apr', revenue: 16500, bookings: 65 },
  { month: 'May', revenue: 22100, bookings: 88 },
  { month: 'Jun', revenue: 19800, bookings: 79 },
];

const recentBookings = [
  { id: 'B001', driver: 'Arjun K.', space: 'T Nagar Spot A', time: '2h ago', amount: 80, status: 'active' },
  { id: 'B002', driver: 'Priya S.', space: 'T Nagar Spot A', time: '4h ago', amount: 120, status: 'completed' },
  { id: 'B003', driver: 'Rahul M.', space: 'T Nagar Spot B', time: 'Yesterday', amount: 200, status: 'completed' },
  { id: 'B004', driver: 'Meera D.', space: 'T Nagar Spot A', time: 'Yesterday', amount: 60, status: 'cancelled' },
];

const statCards = [
  { icon: '💰', label: 'Total Earnings', value: '₹1,04,800', change: '+12.5%', color: '#22C55E', bg: '#22C55E20' },
  { icon: '📅', label: 'Total Bookings', value: '416', change: '+8%', color: '#38BDF8', bg: '#38BDF820' },
  { icon: '🅿️', label: 'Active Spaces', value: '3', change: '', color: '#8B5CF6', bg: '#8B5CF620' },
  { icon: '⭐', label: 'Avg Occupancy', value: '72%', change: '+5%', color: '#F59E0B', bg: '#F59E0B20' },
];

export default function Dashboard() {
  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Dashboard</h1>
          <p className="page-subtitle">Welcome back! Here's your parking performance.</p>
        </div>
        <button className="btn btn-primary">+ Add Listing</button>
      </div>

      {/* Stats */}
      <div className="grid-4" style={{ marginBottom: 24 }}>
        {statCards.map(card => (
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
            <BarChart data={revenueData}>
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
            <LineChart data={revenueData}>
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
          <button className="btn btn-outline" style={{ padding: '6px 14px', fontSize: 12 }}>View All</button>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Booking ID</th>
                <th>Driver</th>
                <th>Space</th>
                <th>Time</th>
                <th>Amount</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {recentBookings.map(b => (
                <tr key={b.id}>
                  <td style={{ color: 'var(--accent)', fontWeight: 600 }}>#{b.id}</td>
                  <td style={{ color: 'var(--text-primary)' }}>{b.driver}</td>
                  <td>{b.space}</td>
                  <td>{b.time}</td>
                  <td style={{ color: 'var(--green)', fontWeight: 700 }}>₹{b.amount}</td>
                  <td>
                    <span className={`badge badge-${b.status === 'active' ? 'blue' : b.status === 'completed' ? 'green' : 'red'}`}>
                      {b.status.charAt(0).toUpperCase() + b.status.slice(1)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
