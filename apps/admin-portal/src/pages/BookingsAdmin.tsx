import { useState } from 'react';
import Breadcrumbs from '../components/Breadcrumbs';
import Modal from '../components/Modal';
import { useAllBookings, AdminBooking } from '../hooks/useAdminData';
import { useDocumentTitle } from '../utils/useDocumentTitle';
import { CarIcon, CheckCircleIcon, AlertTriangleIcon, CurrencyIcon } from '../components/Icons';

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
    const driverLabel = `${b.user?.name || ''} ${b.user?.phone || ''} ${b.userId || b.driverId || ''}`.toLowerCase();
    const spaceLabel = `${b.space?.name || ''} ${b.spaceId}`.toLowerCase();
    const plate = (b.vehicle?.licensePlate || '').toLowerCase();
    return b.id.toLowerCase().includes(term) || driverLabel.includes(term) || spaceLabel.includes(term) || plate.includes(term);
  });

  const activeCount = bookings.filter((b) => b.status === 'active' || b.status === 'confirmed').length;
  const completedCount = bookings.filter((b) => b.status === 'completed').length;
  const cancelledRefundedCount = bookings.filter((b) => b.status === 'cancelled' || b.status === 'refunded').length;

  return (
    <div>
      <Breadcrumbs items={[{ label: 'Bookings' }]} />
      <div className="page-header">
        <div>
          <h1 className="page-title">Global Booking Management</h1>
          <p className="page-subtitle">Platform-wide parking reservations, tariffs, and lifecycle status.</p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <input
            className="form-input"
            placeholder="Search booking, driver, plate, space..."
            aria-label="Search bookings"
            style={{ width: 240 }}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <select
            className="form-select"
            aria-label="Filter by booking status"
            style={{ width: 155 }}
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

      {error && (
        <div className="status-banner status-banner--error" style={{ marginBottom: 16 }}>
          <span>{error}</span>
        </div>
      )}

      <div className="grid-4" style={{ marginBottom: 20 }}>
        {[
          { Icon: CarIcon, label: 'Active & Confirmed', value: String(activeCount), color: 'var(--blue)' },
          { Icon: CheckCircleIcon, label: 'Completed', value: String(completedCount), color: 'var(--green)' },
          { Icon: AlertTriangleIcon, label: 'Cancelled / Refunded', value: String(cancelledRefundedCount), color: 'var(--red)' },
          {
            Icon: CurrencyIcon,
            label: 'Total Volume',
            value: `₹${bookings.reduce((sum, b) => sum + Number(b.totalAmount || 0), 0).toLocaleString('en-IN')}`,
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
                  <th>Driver &amp; Vehicle</th>
                  <th>Parking Space</th>
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
                      {(search || statusFilter !== 'All Statuses') && (
                        <button
                          type="button"
                          className="btn btn-outline btn-sm"
                          style={{ marginLeft: 8 }}
                          onClick={() => {
                            setSearch('');
                            setStatusFilter('All Statuses');
                          }}
                        >
                          Clear Filters
                        </button>
                      )}
                    </td>
                  </tr>
                )}
                {filteredBookings.map((b) => (
                  <tr key={b.id}>
                    <td className="mono-num" style={{ color: 'var(--text-primary)', fontWeight: 700 }}>
                      #{b.id.slice(0, 10)}
                    </td>
                    <td>
                      <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                        {b.user?.name || b.user?.phone || (b.userId || b.driverId || 'Driver').slice(0, 10)}
                      </div>
                      {b.vehicle?.licensePlate && (
                        <div className="mono-num" style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>
                          {b.vehicle.licensePlate}
                        </div>
                      )}
                    </td>
                    <td>{b.space?.name || b.spaceId.slice(0, 12)}</td>
                    <td className="mono-num" style={{ fontSize: 12 }}>
                      {new Date(b.startTime).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' })}
                    </td>
                    <td className="mono-num" style={{ fontSize: 12 }}>
                      {new Date(b.endTime).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' })}
                    </td>
                    <td className="mono-num" style={{ color: 'var(--green)', fontWeight: 700 }}>
                      ₹{Number(b.totalAmount || 0).toLocaleString('en-IN')}
                    </td>
                    <td>
                      <span className={`badge badge-${statusColors[b.status] || 'neutral'}`}>
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
        titleId="booking-detail-title"
        title={selected ? `Booking #${selected.id.slice(0, 12)}` : 'Booking Details'}
        footer={
          <button type="button" className="btn btn-primary" onClick={() => setSelected(null)}>
            Close
          </button>
        }
      >
        {selected && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[
              ['Driver', selected.user?.name || selected.user?.phone || selected.userId || selected.driverId || '—'],
              ['Vehicle Plate', selected.vehicle?.licensePlate || '—'],
              ['Facility', selected.space?.name || selected.spaceId],
              ['Type', selected.type.toUpperCase()],
              ['Total Amount', `₹${Number(selected.totalAmount || 0).toLocaleString('en-IN')}`],
              ['Status', selected.status.toUpperCase()],
              ['Window', `${new Date(selected.startTime).toLocaleString()} → ${new Date(selected.endTime).toLocaleString()}`],
            ].map(([k, v]) => (
              <div
                key={k}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  gap: 12,
                  padding: '8px 0',
                  borderBottom: '1px solid var(--border)',
                  fontSize: 13.5,
                }}
              >
                <span style={{ color: 'var(--text-muted)' }}>{k}</span>
                <strong className="mono-num" style={{ color: 'var(--text-primary)', textAlign: 'right' }}>{v}</strong>
              </div>
            ))}
          </div>
        )}
      </Modal>
    </div>
  );
}
