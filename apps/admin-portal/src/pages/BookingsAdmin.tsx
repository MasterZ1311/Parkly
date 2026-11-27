import React, { useState } from 'react';
import Breadcrumbs from '../components/Breadcrumbs';
import { useAllBookings, AdminBooking } from '../hooks/useAdminData';
import { useDocumentTitle } from '../utils/useDocumentTitle';

const statusColors: Record<string, string> = {
  created: 'yellow',
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
  const [selected, setSelected] = useState<AdminBooking | null>(null);

  const { bookings, loading, error } = useAllBookings(
    statusFilter === 'All Statuses' ? undefined : statusFilter.toLowerCase(),
  );

  const filteredBookings = bookings.filter((b: AdminBooking) => {
    const term = search.toLowerCase();
    return (
      b.id.toLowerCase().includes(term) ||
      (b.user?.name || '').toLowerCase().includes(term) ||
      (b.space?.name || '').toLowerCase().includes(term) ||
      (b.vehicle?.licensePlate || '').toLowerCase().includes(term)
    );
  });

  const activeCount = bookings.filter((b) => b.status === 'active' || b.status === 'confirmed').length;
  const completedCount = bookings.filter((b) => b.status === 'completed').length;
  const cancelledCount = bookings.filter((b) => b.status === 'cancelled' || b.status === 'refunded').length;
  const totalVolume = bookings.reduce((sum, b) => sum + Number(b.totalAmount || 0), 0);

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
            placeholder="Search ID, driver, plate..."
            style={{ width: 200 }}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <select
            className="form-select"
            style={{ width: 150 }}
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option>All Statuses</option>
            <option>Created</option>
            <option>Confirmed</option>
            <option>Active</option>
            <option>Completed</option>
            <option>Cancelled</option>
            <option>Refunded</option>
          </select>
        </div>
      </div>

      {error && <div className="alert-error">{error}</div>}

      <div className="grid-4" style={{ marginBottom: 24 }}>
        {[
          { icon: '🚗', label: 'Active / Confirmed', value: String(activeCount), color: '#EF010C', bg: 'rgba(239,1,12,0.15)' },
          { icon: '✅', label: 'Completed', value: String(completedCount), color: '#10B981', bg: '#10B98120' },
          { icon: '↩️', label: 'Cancelled / Refunded', value: String(cancelledCount), color: '#F59E0B', bg: '#F59E0B20' },
          { icon: '💰', label: 'Total Volume', value: `₹${totalVolume.toLocaleString('en-IN')}`, color: '#06B6D4', bg: '#06B6D420' },
        ].map((s) => (
          <div key={s.label} className="stat-card">
            <div className="stat-icon" style={{ background: s.bg, color: s.color, fontSize: 20 }}>{s.icon}</div>
            <div>
              <div className="stat-value" style={{ fontSize: 20 }}>{s.value}</div>
              <div className="stat-label">{s.label}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="card">
        <div className="table-wrap">
          {loading ? (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>Loading bookings...</div>
          ) : filteredBookings.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>No bookings match your search.</div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Booking ID</th>
                  <th>Driver</th>
                  <th>Vehicle</th>
                  <th>Space</th>
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
                    <td style={{ color: 'var(--text-primary)' }}>{b.user?.name || b.userId || b.driverId}</td>
                    <td>{b.vehicle?.licensePlate || '—'}</td>
                    <td>{b.space?.name || b.spaceId}</td>
                    <td style={{ fontSize: 12 }}>{new Date(b.startTime).toLocaleString()}</td>
                    <td style={{ fontSize: 12 }}>{new Date(b.endTime).toLocaleString()}</td>
                    <td style={{ color: 'var(--green)', fontWeight: 700 }}>₹{Number(b.totalAmount)}</td>
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

      {selected && (
        <div className="modal-backdrop">
          <div className="modal" style={{ maxWidth: 460 }}>
            <div className="modal-header">
              <h2 className="modal-title">Booking #{selected.id.slice(0, 12)}</h2>
              <button className="btn btn-secondary" style={{ padding: '4px 10px' }} onClick={() => setSelected(null)}>
                ✕
              </button>
            </div>
            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>SPACE</div>
                  <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{selected.space?.name || selected.spaceId}</div>
                </div>
                <div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>DRIVER</div>
                  <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{selected.user?.name || selected.userId}</div>
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
                <span style={{ fontSize: 18, fontWeight: 800, color: 'var(--green)' }}>₹{Number(selected.totalAmount)}</span>
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
