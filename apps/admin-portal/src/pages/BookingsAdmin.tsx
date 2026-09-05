import React, { useState } from 'react';
import Breadcrumbs from '../components/Breadcrumbs';
import { useDocumentTitle } from '../utils/useDocumentTitle';

const bookings = [
  { id: 'B1291', driver: 'Arjun K.', space: 'T Nagar Spot A', host: 'Ravi Kumar', amount: 80, status: 'active', type: 'Instant', date: '2024-07-01' },
  { id: 'B1290', driver: 'Priya S.', space: 'Anna Nagar ML', host: 'Meena V.', amount: 180, status: 'confirmed', type: 'Scheduled', date: '2024-06-30' },
  { id: 'B1289', driver: 'Kiran R.', space: 'T Nagar Spot B', host: 'Ravi Kumar', amount: 70, status: 'completed', type: 'Instant', date: '2024-06-30' },
  { id: 'B1288', driver: 'Meera D.', space: 'T Nagar Spot A', host: 'Ravi Kumar', amount: 40, status: 'cancelled', type: 'Instant', date: '2024-06-29' },
  { id: 'B1287', driver: 'Rahul M.', space: 'Velachery EP', host: 'Suresh R.', amount: 150, status: 'refunded', type: 'Scheduled', date: '2024-06-29' },
];

type Booking = typeof bookings[0];

const statusColors: Record<string, string> = {
  active: 'blue',
  confirmed: 'green',
  completed: 'green',
  cancelled: 'red',
  refunded: 'yellow',
};

export default function BookingsAdmin() {
  useDocumentTitle('Global Booking Management');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All Statuses');
  const [selected, setSelected] = useState<Booking | null>(null);

  const filteredBookings = bookings.filter(b => {
    const matchesSearch =
      b.id.toLowerCase().includes(search.toLowerCase()) ||
      b.driver.toLowerCase().includes(search.toLowerCase()) ||
      b.space.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === 'All Statuses' || b.status === statusFilter.toLowerCase();
    return matchesSearch && matchesStatus;
  });

  return (
    <div>
      <Breadcrumbs items={[{ label: 'Bookings' }]} />
      <div className="page-header">
        <div>
          <h1 className="page-title">Global Booking Management</h1>
          <p className="page-subtitle">Platform-wide booking activity</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            className="form-input"
            placeholder="Search by ID..."
            style={{ width: 180 }}
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          <select
            className="form-input"
            style={{ width: 140 }}
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
          >
            <option>All Statuses</option>
            <option>Active</option>
            <option>Confirmed</option>
            <option>Completed</option>
            <option>Cancelled</option>
            <option>Refunded</option>
          </select>
        </div>
      </div>

      <div className="grid-4" style={{ marginBottom: 24 }}>
        {[
          { icon: '🚗', label: 'Active', value: '91', color: 'var(--accent-light)', bg: '#6366F120' },
          { icon: '✅', label: 'Completed Today', value: '48', color: '#22C55E', bg: '#22C55E20' },
          { icon: '❌', label: 'Cancelled Today', value: '7', color: '#EF4444', bg: '#EF444420' },
          { icon: '💰', label: 'Revenue Today', value: '₹7,280', color: '#F59E0B', bg: '#F59E0B20' },
        ].map(s => (
          <div key={s.label} className="stat-card">
            <div className="stat-icon" style={{ background: s.bg, fontSize: 20 }}>{s.icon}</div>
            <div>
              <div className="stat-value" style={{ color: s.color, fontSize: 20 }}>{s.value}</div>
              <div className="stat-label">{s.label}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="card">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Booking ID</th>
                <th>Driver</th>
                <th>Space</th>
                <th>Host</th>
                <th>Date</th>
                <th>Type</th>
                <th>Amount</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredBookings.map(b => (
                <tr key={b.id}>
                  <td style={{ color: 'var(--accent-light)', fontWeight: 600, cursor: 'pointer' }} onClick={() => setSelected(b)}>#{b.id}</td>
                  <td style={{ color: 'var(--text-primary)' }}>{b.driver}</td>
                  <td>{b.space}</td>
                  <td>{b.host}</td>
                  <td>{b.date}</td>
                  <td><span className="badge badge-blue">{b.type}</span></td>
                  <td style={{ color: '#22C55E', fontWeight: 700 }}>₹{b.amount}</td>
                  <td>
                    <span className={`badge badge-${statusColors[b.status]}`}>
                      {b.status.charAt(0).toUpperCase() + b.status.slice(1)}
                    </span>
                  </td>
                  <td>
                    <button className="btn btn-outline" style={{ padding: '4px 10px', fontSize: 11 }} onClick={() => setSelected(b)}>
                      View
                    </button>
                  </td>
                </tr>
              ))}
              {filteredBookings.length === 0 && (
                <tr>
                  <td colSpan={9} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 24 }}>
                    No bookings match your search.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Booking Detail Modal */}
      {selected && (
        <div
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100,
          }}
          onClick={() => setSelected(null)}
        >
          <div className="card" style={{ width: 460 }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h2 style={{ fontSize: 18, fontWeight: 800 }}>Booking #{selected.id}</h2>
              <span className={`badge badge-${statusColors[selected.status]}`}>
                {selected.status.charAt(0).toUpperCase() + selected.status.slice(1)}
              </span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {[
                ['Driver', selected.driver],
                ['Space', selected.space],
                ['Host', selected.host],
                ['Date', selected.date],
                ['Type', selected.type],
                ['Amount', `₹${selected.amount}`],
              ].map(([label, value]) => (
                <div key={label} style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border)', paddingBottom: 8 }}>
                  <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>{label}</span>
                  <span style={{ color: 'var(--text-primary)', fontSize: 13, fontWeight: 600 }}>{value}</span>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 20 }}>
              <button className="btn btn-primary" onClick={() => setSelected(null)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
