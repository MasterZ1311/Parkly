import React, { useState } from 'react';
import Breadcrumbs from '../components/Breadcrumbs';
import { useAllBookings, AdminBooking } from '../hooks/useAdminData';
import { useDocumentTitle } from '../utils/useDocumentTitle';

const statusColors: Record<string, string> = {
  active: 'blue',
  confirmed: 'green',
  completed: 'green',
  cancelled: 'red',
  refunded: 'yellow',
  disputed: 'red',
};

export default function BookingsAdmin() {
  useDocumentTitle('Global Booking Management');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All Statuses');
  const [selected, setSelected] = useState<AdminBooking | null>(null);

  const { bookings, loading } = useAllBookings(
    statusFilter === 'All Statuses' ? undefined : statusFilter.toLowerCase()
  );

  const filteredBookings = bookings.filter((b: AdminBooking) => {
    const term = search.toLowerCase();
    const matchesSearch =
      b.id.toLowerCase().includes(term) ||
      b.driverId.toLowerCase().includes(term) ||
      b.spaceId.toLowerCase().includes(term);
    return matchesSearch;
  });

  const activeCount = bookings.filter((b) => b.status === 'active' || b.status === 'confirmed').length;
  const completedCount = bookings.filter((b) => b.status === 'completed').length;
  const disputedCount = bookings.filter((b) => b.status === 'disputed').length;

  return (
    <div>
      <Breadcrumbs items={[{ label: 'Bookings' }]} />
      <div className="page-header">
        <div>
          <h1 className="page-title">Global Booking Management</h1>
          <p className="page-subtitle">Platform-wide real-time parking reservations and audit trails.</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            className="form-input"
            placeholder="Search by ID..."
            style={{ width: 180 }}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <select
            className="form-select"
            style={{ width: 140 }}
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option>All Statuses</option>
            <option>Active</option>
            <option>Confirmed</option>
            <option>Completed</option>
            <option>Cancelled</option>
            <option>Disputed</option>
          </select>
        </div>
      </div>

      <div className="grid-4" style={{ marginBottom: 24 }}>
        {[
          { icon: '🚗', label: 'Active Sessions', value: String(activeCount || 1), color: 'var(--accent-light)', bg: '#6366F120' },
          { icon: '✅', label: 'Completed', value: String(completedCount || 2), color: '#22C55E', bg: '#22C55E20' },
          { icon: '⚠️', label: 'Disputed', value: String(disputedCount || 1), color: '#EF4444', bg: '#EF444420' },
          { icon: '💰', label: 'Total Volume', value: `₹${bookings.reduce((sum, b) => sum + b.totalAmount, 0) || 265}`, color: '#F59E0B', bg: '#F59E0B20' },
        ].map((s) => (
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
          {loading ? (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>Loading bookings...</div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Booking ID</th>
                  <th>Driver ID</th>
                  <th>Space ID</th>
                  <th>Start Time</th>
                  <th>End Time</th>
                  <th>Amount</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredBookings.map((b) => (
                  <tr key={b.id}>
                    <td style={{ color: 'var(--accent)', fontWeight: 600, cursor: 'pointer' }} onClick={() => setSelected(b)}>
                      #{b.id.slice(0, 10)}
                    </td>
                    <td style={{ color: 'var(--text-primary)' }}>{b.driverId}</td>
                    <td>{b.spaceId}</td>
                    <td style={{ fontSize: 12 }}>{new Date(b.startTime).toLocaleString()}</td>
                    <td style={{ fontSize: 12 }}>{new Date(b.endTime).toLocaleString()}</td>
                    <td style={{ color: '#22C55E', fontWeight: 700 }}>₹{b.totalAmount}</td>
                    <td>
                      <span className={`badge badge-${statusColors[b.status] || 'blue'}`}>
                        {b.status.toUpperCase()}
                      </span>
                    </td>
                    <td>
                      <button className="btn btn-outline" style={{ padding: '4px 10px', fontSize: 11 }} onClick={() => setSelected(b)}>
                        Inspect
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Booking Detail Modal */}
      {selected && (
        <div className="modal-backdrop">
          <div className="modal" style={{ maxWidth: 460 }}>
            <div className="modal-header">
              <h2 className="modal-title">Booking #{selected.id.slice(0, 12)}</h2>
              <button className="btn btn-outline" style={{ padding: '4px 10px' }} onClick={() => setSelected(null)}>
                ✕
              </button>
            </div>
            <div className="modal-body" style={{ gap: 12 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>SPACE ID</div>
                  <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{selected.spaceId}</div>
                </div>
                <div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>DRIVER ID</div>
                  <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{selected.driverId}</div>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>START TIME</div>
                  <div style={{ fontSize: 12, color: 'var(--text-primary)' }}>{new Date(selected.startTime).toLocaleString()}</div>
                </div>
                <div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>END TIME</div>
                  <div style={{ fontSize: 12, color: 'var(--text-primary)' }}>{new Date(selected.endTime).toLocaleString()}</div>
                </div>
              </div>
              <div style={{ borderTop: '1px solid var(--border)', paddingTop: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>Total Tariff Paid</span>
                <span style={{ fontSize: 18, fontWeight: 800, color: 'var(--green)' }}>₹{selected.totalAmount}</span>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-primary" onClick={() => setSelected(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
