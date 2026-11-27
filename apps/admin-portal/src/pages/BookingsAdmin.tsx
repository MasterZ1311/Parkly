import { useState } from 'react';
import Breadcrumbs from '../components/Breadcrumbs';
import Modal from '../components/Modal';
import { useAllBookings, AdminBooking } from '../hooks/useAdminData';
import { useDocumentTitle } from '../utils/useDocumentTitle';
import { CarIcon, CheckCircleIcon, AlertTriangleIcon, CurrencyIcon } from '../components/Icons';

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
    return (
      b.id.toLowerCase().includes(term) ||
      b.driverId.toLowerCase().includes(term) ||
      b.spaceId.toLowerCase().includes(term)
    );
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
          <p className="page-subtitle">Platform-wide parking reservations, tariffs, and dispute audit status.</p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <input
            className="form-input"
            placeholder="Search booking, driver, or space ID..."
            aria-label="Search bookings"
            style={{ width: 220 }}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <select
            className="form-select"
            aria-label="Filter by booking status"
            style={{ width: 150 }}
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

      <div className="grid-4" style={{ marginBottom: 20 }}>
        {[
          { Icon: CarIcon, label: 'Active Sessions', value: String(activeCount), color: 'var(--blue)' },
          { Icon: CheckCircleIcon, label: 'Completed', value: String(completedCount), color: 'var(--green)' },
          { Icon: AlertTriangleIcon, label: 'Disputed', value: String(disputedCount), color: 'var(--red)' },
          {
            Icon: CurrencyIcon,
            label: 'Total Volume',
            value: `₹${bookings.reduce((sum, b) => sum + b.totalAmount, 0)}`,
            color: 'var(--text-primary)',
          },
        ].map(({ Icon, label, value, color }) => (
          <div key={label} className="stat-card">
            <div>
              <div className="stat-label">{label}</div>
              <div className="stat-value" style={{ color }}>{value}</div>
            </div>
            <div className="stat-icon">
              <Icon size={18} />
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
                {filteredBookings.length === 0 && (
                  <tr>
                    <td colSpan={8} style={{ textAlign: 'center', padding: 36, color: 'var(--text-muted)' }}>
                      No bookings match the current search or status filter.{' '}
                      <button
                        type="button"
                        className="btn btn-outline btn-sm"
                        style={{ marginLeft: 8 }}
                        onClick={() => {
                          setSearch('');
                          setStatusFilter('All Statuses');
                        }}
                      >
                        Reset Filters
                      </button>
                    </td>
                  </tr>
                )}
                {filteredBookings.map((b) => (
                  <tr key={b.id}>
                    <td className="mono-num">
                      <button
                        type="button"
                        onClick={() => setSelected(b)}
                        style={{
                          background: 'none',
                          border: 'none',
                          padding: 0,
                          color: 'var(--accent-cta)',
                          fontWeight: 700,
                          cursor: 'pointer',
                        }}
                      >
                        #{b.id.slice(0, 10)}
                      </button>
                    </td>
                    <td className="mono-num" style={{ color: 'var(--text-primary)' }}>{b.driverId}</td>
                    <td className="mono-num">{b.spaceId}</td>
                    <td className="mono-num" style={{ fontSize: 12 }}>{new Date(b.startTime).toLocaleString()}</td>
                    <td className="mono-num" style={{ fontSize: 12 }}>{new Date(b.endTime).toLocaleString()}</td>
                    <td className="mono-num" style={{ color: 'var(--green)', fontWeight: 700 }}>₹{b.totalAmount}</td>
                    <td>
                      <span className={`badge badge-${statusColors[b.status] || 'blue'}`}>
                        {b.status.toUpperCase()}
                      </span>
                    </td>
                    <td>
                      <button type="button" className="btn btn-outline btn-sm" onClick={() => setSelected(b)}>
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

      <Modal
        open={Boolean(selected)}
        onClose={() => setSelected(null)}
        titleId="admin-booking-modal-title"
        maxWidth={460}
        title={
          selected ? (
            <>
              Booking <span className="mono-num">#{selected.id.slice(0, 12)}</span>
            </>
          ) : null
        }
        footer={
          <button type="button" className="btn btn-primary" onClick={() => setSelected(null)}>
            Close
          </button>
        }
      >
        {selected && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <div className="stat-label">Space ID</div>
                <div className="mono-num" style={{ fontWeight: 700, color: 'var(--text-primary)', marginTop: 3 }}>
                  {selected.spaceId}
                </div>
              </div>
              <div>
                <div className="stat-label">Driver ID</div>
                <div className="mono-num" style={{ fontWeight: 700, color: 'var(--text-primary)', marginTop: 3 }}>
                  {selected.driverId}
                </div>
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <div className="stat-label">Start Time</div>
                <div className="mono-num" style={{ fontSize: 12, color: 'var(--text-primary)', marginTop: 3 }}>
                  {new Date(selected.startTime).toLocaleString()}
                </div>
              </div>
              <div>
                <div className="stat-label">End Time</div>
                <div className="mono-num" style={{ fontSize: 12, color: 'var(--text-primary)', marginTop: 3 }}>
                  {new Date(selected.endTime).toLocaleString()}
                </div>
              </div>
            </div>
            <div
              style={{
                borderTop: '1px solid var(--border)',
                paddingTop: 12,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>Total Tariff Paid</span>
              <span className="mono-num" style={{ fontSize: 20, fontWeight: 800, color: 'var(--green)' }}>
                ₹{selected.totalAmount}
              </span>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
